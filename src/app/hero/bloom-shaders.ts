import type * as THREE from 'three';

// =====================================================================================
// Petal shaders
// A thin, translucent, double-sided petal: wrapped diffuse + light transmission through
// the membrane + silky specular + fresnel rim + base-to-tip colour gradient + veins +
// fine mottling + edge thinning. Wind flutter is applied per-vertex on the GPU (the
// petal flexes, it does not just move).
// Two flavours share the same code: the OPAQUE one paints the bouquet blooms, the
// default one (alpha + distance fade) paints the petals drifting around them.
// =====================================================================================
export const PETAL_VERTEX = /* glsl */ `
  uniform float uTime;
  attribute vec3 aTint;
  attribute vec4 aSeed;          // x: phase, y: flutter speed, z: flutter amplitude, w: tone variation
  varying vec3 vTint;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vTone;
  #ifdef BURST
  uniform float uBurst;
  uniform vec3 uBurstCenter;
  uniform vec3 uBurstAxis;
  attribute vec4 aBurst;         // x: delay, y: spin, z: position in the bloom (0 heart .. 1 outer), w: random
  attribute vec3 aPieceC;        // centre of this petal piece (petal space)
  attribute vec4 aPieceD;        // xyz: direction the piece slides away from the petal, w: random
  varying float vBurst;
  vec3 rotAxis(vec3 v, vec3 a, float ang) {
    float cs = cos(ang), sn = sin(ang);
    return v * cs + cross(a, v) * sn + a * dot(a, v) * (1.0 - cs);
  }
  #endif

  void main() {
    vUv = uv;
    vTint = aTint;
    vTone = aSeed.w;

    vec3 p = position;
    vec3 n = normal;

    // Flutter: tip and edges flex in the wind, the base (claw) stays anchored.
    float tipMask = smoothstep(0.12, 1.0, uv.y);
    float edgeMask = abs(uv.x - 0.5) * 2.0;
    float t = uTime * aSeed.y + aSeed.x;
    float wave = sin(t * 2.4 + uv.y * 5.5 + uv.x * 2.5);
    p.z += wave * 0.085 * aSeed.z * tipMask * (0.55 + edgeMask * 0.45);
    p.x += sin(t * 1.7 + uv.y * 4.0) * 0.035 * aSeed.z * tipMask;
    n.xy += vec2(cos(t * 2.4 + uv.y * 5.5) * 0.35, sin(t * 1.7 + uv.y * 4.0) * 0.18) * aSeed.z * tipMask;

    vec3 nl = normalize(n);

    #ifdef BURST
    float b = smoothstep(aBurst.x, aBurst.x + 0.6, uBurst);
    vBurst = b;
    float e = b * b * (3.0 - 2.0 * b);                   // ease in and out: unhurried, never abrupt
    // 1) the petal is cut into clean ribbons that slide apart and turn a little on their own.
    vec3 pa = normalize(vec3(aPieceD.w - 0.5, 0.35, 0.6 - aPieceD.w * 0.7));
    float pang = e * (aPieceD.w - 0.5) * 2.6;
    p = aPieceC + rotAxis(p - aPieceC, pa, pang) + aPieceD.xyz * e * 0.55;
    nl = rotAxis(nl, pa, pang);
    #endif

    vec4 wp = instanceMatrix * vec4(p, 1.0);
    vec3 nn = mat3(instanceMatrix) * nl;

    #ifdef BURST
    // 2) the bloom opens like a rose in fast-forward: each petal hinges outward from its base,
    //    layer after layer, so the lens can slide down between the walls into the heart.
    if (b > 0.0) {
      vec3 o = instanceMatrix[3].xyz;
      float h = aBurst.w * 437.58;
      vec3 r3 = vec3(fract(sin(h) * 43.5), fract(sin(h * 1.3 + 4.1) * 31.7), fract(sin(h * 2.1 + 9.2) * 27.3)) * 2.0 - 1.0;
      vec3 rad = o - uBurstCenter;
      rad -= uBurstAxis * dot(rad, uBurstAxis);
      vec3 rdir = normalize(rad + vec3(0.0013, 0.0007, 0.0011));
      // hinge: horizontal, tangent to the bloom - rotating about it tips the petal outward
      vec3 hinge = normalize(cross(uBurstAxis, rdir));
      // the heart petals peel right back and clear the way; the outer ones only loosen,
      // so what remains is a deep cup of petal walls around the lens.
      float inner = 1.0 - smoothstep(0.25, 0.6, aBurst.z);
      float reach = 0.45 + aBurst.w * 1.25;
      float open = e * mix(0.28 + 0.4 * aBurst.z, 1.5, inner);
      vec3 v = rotAxis(wp.xyz - o, hinge, open);
      nn = rotAxis(nn, hinge, open);
      // a slight twist along the petal's own length
      float twist = e * aBurst.y * 0.1;
      vec3 along = normalize(mix(uBurstAxis, rdir, 0.5));
      v = rotAxis(v, along, twist);
      nn = rotAxis(nn, along, twist);
      // the whole bloom turns a little, and each petal loosens and floats clear of its neighbours
      float swirl = e * 0.28 * sign(aBurst.y);
      vec3 q = rotAxis(o - uBurstCenter, uBurstAxis, swirl);
      v = rotAxis(v, uBurstAxis, swirl);
      nn = rotAxis(nn, uBurstAxis, swirl);
      vec3 drift = rdir * e * reach * mix(0.12, 0.55, inner) + uBurstAxis * e * (r3.y * 0.15 + inner * (0.5 + 0.5 * aBurst.w));
      vec3 bob = vec3(0.0, 0.05 * sin(uTime * 0.9 + aBurst.w * 20.0) * e, 0.0);
      wp.xyz = uBurstCenter + q + drift + v + bob;
    }
    #endif

    vec4 mv = modelViewMatrix * wp;
    vViewPos = mv.xyz;
    vNormalV = normalize(normalMatrix * nn);
    gl_Position = projectionMatrix * mv;
  }
`;

export function petalFragment(opaque: boolean): string {
  return /* glsl */ `
  uniform float uIntro;
  uniform vec3 uKeyDir;          // view-space direction TOWARDS the key light
  uniform vec3 uBackDir;         // view-space direction towards the warm back light
  uniform vec3 uRimColor;
  uniform vec3 uBackColor;
  uniform vec3 uFogColor;
  uniform vec3 uHaze;
  uniform float uHazeWhite;
  uniform float uHazeNear;
  uniform float uHazeFar;
  varying vec3 vTint;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;
  varying float vTone;
  #ifdef BURST
  varying float vBurst;
  #endif

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
               mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {


    vec3 V = normalize(-vViewPos);
    vec3 N = normalize(vNormalV);
    if (dot(N, V) < 0.0) N = -N;                  // double-sided: always shade the side facing us

    vec3 K = normalize(uKeyDir);
    vec3 B = normalize(uBackDir);

    // ---- albedo: darker saturated claw -> bright, slightly desaturated tip ------------
    float v = vUv.y;
    vec3 base = vTint * (0.86 + vTone * 0.28);
    vec3 albedo = mix(base * 0.5, base, smoothstep(0.0, 0.5, v));
    albedo = mix(albedo, mix(albedo, vec3(1.0, 0.9, 0.93), 0.16), smoothstep(0.68, 1.0, v));

    // Longitudinal veins - faint, fade in near the claw and out at the tip.
    float vein = sin(vUv.x * 52.0 + sin(v * 7.0) * 1.8);
    vein = smoothstep(0.78, 1.0, vein) * smoothstep(0.02, 0.5, v) * (1.0 - smoothstep(0.7, 1.0, v));
    albedo *= 1.0 - vein * 0.14;

    // Velvet mottling: a fine, soft grain so a close-up never reads as flat colour.
    float grain = vnoise(vUv * vec2(26.0, 44.0)) * 0.6 + vnoise(vUv * vec2(70.0, 120.0)) * 0.4;
    albedo *= 0.93 + grain * 0.14;

    // Edge thinning: the membrane is thinner (lighter) at the rim.
    float edge = min(vUv.x, 1.0 - vUv.x);
    float thin = 1.0 - smoothstep(0.0, 0.2, edge);
    albedo = mix(albedo, albedo * 1.2 + 0.035, thin * 0.5);

    // ---- lighting ---------------------------------------------------------------------
    float ndl = dot(N, K);
    float wrap = clamp((ndl + 0.55) / 1.55, 0.0, 1.0);        // wrapped diffuse = soft, waxy falloff
    float transmit = clamp(-ndl, 0.0, 1.0);                    // key light hitting the far side
    float backLit = clamp(dot(N, B) * 0.5 + 0.5, 0.0, 1.0);
    backLit *= backLit;

    vec3 sss = pow(albedo, vec3(0.62)) * vec3(1.12, 0.82, 0.88);   // light that passes through is more saturated
    vec3 H = normalize(K + V);
    float spec = pow(max(dot(N, H), 0.0), 64.0) * 0.34 + pow(max(dot(N, H), 0.0), 9.0) * 0.07;
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.6);

    vec3 col = albedo * (0.3 + wrap * 0.8);
    col += sss * transmit * 0.5;
    col += uBackColor * albedo * backLit * 0.3;
    col += uRimColor * fres * 0.2 * (0.4 + albedo.r + albedo.g + albedo.b);
    col += vec3(1.0, 0.95, 0.96) * spec * (0.5 + thin * 0.5);

    // Keep colours rich in the shade (ACES would otherwise grey them).
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = max(mix(vec3(lum), col, 1.2), 0.0);
    #ifdef BURST
    // Once loose, the petals catch the light like silk: a soft inner glow and a brighter edge.
    col += sss * vBurst * (0.1 + 0.22 * thin);
    #endif

    ${
      opaque
        ? `
    gl_FragColor = vec4(col, 1.0);
    `
        : `
    // ---- depth: far petals dissolve into the background, ones too close to the lens fade -
    float depth = -vViewPos.z;
    float far = smoothstep(26.0, 9.0, depth);
    float near = smoothstep(1.2, 3.6, depth);
    col = mix(uFogColor, col, 0.35 + 0.65 * far);
    float alpha = 0.9 * uIntro * (0.4 + 0.6 * far) * near;
    gl_FragColor = vec4(col, alpha);
    `
    }

    #include <tonemapping_fragment>
    #include <colorspace_fragment>

    // Haze: the deeper the lens goes into the bloom, the more everything turns to soft light.
    float hz = max(smoothstep(uHazeNear, uHazeFar, -vViewPos.z), uHazeWhite);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uHaze, hz);
  }
`;
}

// =======================================================================================
// Procedural surfaces
// =======================================================================================

/**
 * Rose-petal surface for `ParametricGeometry`.
 *  u: 0 -> 1 across the width, v: 0 -> 1 from the claw (base) to the tip.
 *  - narrow claw, broad belly near 62%, softly rounded tip
 *  - cupped across the width (edges lift) and spoon-curved along the length
 *  - the tip rolls back, and the rim gets a faint ripple, like real petals
 * The base sits at y = -0.725 and the concave side faces +z.
 */
export function petalSurface(u: number, v: number, target: THREE.Vector3): void {
  const w = (u - 0.5) * 2; // -1 .. 1
  // Widest at ~62% of the length, a broad rounded fan above a narrow claw.
  const belly = Math.sin(Math.PI * Math.pow(v, 1.45));
  const half = 0.5 * Math.pow(Math.max(belly, 0), 0.52) * (0.94 + 0.06 * Math.sin(v * 5.0));

  const x = w * half;
  const y = (v - 0.5) * 1.45;

  const cup = Math.pow(Math.abs(w), 1.9) * half * 0.8 * (0.35 + 0.65 * v);
  const spoon = Math.pow(v, 2.0) * 0.3;
  const roll = Math.pow(Math.max(v - 0.72, 0) / 0.28, 2) * 0.09;
  const ripple = Math.sin(v * 15 + w * 3) * 0.016 * Math.abs(w) * v;

  target.set(x, y, cup + spoon - roll + ripple);
}

/** Height of the petal geometry above its anchor once translated (see `petalSurface`). */
export const PETAL_BASE_OFFSET = 0.725;

/** A pointed leaf folded along its midrib; the base sits at the origin and the tip points to +y. */
export function leafSurface(u: number, v: number, target: THREE.Vector3): void {
  const w = (u - 0.5) * 2;
  const width = 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(v, 0.72)), 0.9);
  const x = w * width;
  const y = v * 1.6;
  const fold = Math.abs(w) * width * 0.55; // V-shaped fold along the midrib
  const droop = Math.pow(v, 2.2) * 0.42; // tip arches over
  target.set(x, y, fold + droop);
}
