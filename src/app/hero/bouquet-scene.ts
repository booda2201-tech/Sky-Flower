import type * as THREE from 'three';
import type { ParametricGeometry as ParametricGeometryCtor } from 'three/examples/jsm/geometries/ParametricGeometry.js';
import type { mergeGeometries as MergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  DEPTH_ONLY_FRAGMENT,
  PETAL_BASE_OFFSET,
  PETAL_VERTEX,
  leafSurface,
  petalFragment,
  petalSurface,
} from './bloom-shaders';

// =======================================================================================
// A procedural, hand-tied bouquet rendered with Three.js.
//
//  - every bloom (rose, peony, hydrangea) is built from curved, translucent petals laid out
//    on a golden-angle spiral, so a close-up still shows real structure (all petals live in
//    two InstancedMeshes: one draw call each)
//  - stems, leaves, baby's-breath, wrapping paper and a satin bow complete the bouquet
//  - a scroll value 0 -> 1 flies the camera from the whole bouquet into the heart of the
//    hero rose; the camera path is expressed relative to that rose, so it stays locked on
//    it however the bouquet sways
// =======================================================================================

export interface BouquetPalette {
  /** Two shades per flower family; every petal picks a point between them. */
  readonly rose: readonly [string, string];
  readonly peony: readonly [string, string];
  readonly hydrangea: readonly [string, string];
  /** Inner layer of the wrapping paper. */
  readonly paper: string;
}

/** One palette per featured creation (same order as the catalogue). */
export const BOUQUET_PALETTES: readonly BouquetPalette[] = [
  // Ferrero Crown - deep red roses
  { rose: ['#6b0a1c', '#b3202f'], peony: ['#a3223a', '#d9586c'], hydrangea: ['#c9566b', '#eeb0bb'], paper: '#d98a98' },
  // Heart of Roses - bright red roses
  { rose: ['#8a0f20', '#d62a3b'], peony: ['#b82a40', '#ea6b7c'], hydrangea: ['#d9667a', '#f6bfc8'], paper: '#e8a2ad' },
  // Pink Cloud - soft pink roses
  { rose: ['#e98bab', '#f8cfdc'], peony: ['#f3a6c0', '#fde0ea'], hydrangea: ['#f7d9e4', '#fdeff4'], paper: '#f6cfdb' },
  // Chocolate Rose Bouquet - red roses with warm cocoa accents
  { rose: ['#7a0d1e', '#c3263a'], peony: ['#6b3a2c', '#a46a4e'], hydrangea: ['#8f4a3a', '#d3a07f'], paper: '#d9aa98' },
  // Surprise Gift Box - pink and warm gold
  { rose: ['#d94a73', '#f39ab4'], peony: ['#f0b8a0', '#fbe0cf'], hydrangea: ['#f6e2b4', '#fff3d6'], paper: '#f3c9c0' },
  // Roses & Lilies - red roses with pink lilies and white
  { rose: ['#8c0f22', '#cf2a3c'], peony: ['#f0a9c1', '#fbdbe6'], hydrangea: ['#f6f0f2', '#e6dfe8'], paper: '#f2d5da' },
];

export type BouquetLayout = 'side' | 'stack';

export interface BouquetSceneOptions {
  readonly canvas: HTMLCanvasElement;
  /** Touch / small screens: fewer petals, lower pixel ratio. */
  readonly coarse: boolean;
  /** prefers-reduced-motion: no sway, no flutter, fewer drifting petals. */
  readonly calm: boolean;
}

type Kind = 0 | 1 | 2; // rose, peony, hydrangea

interface HeadSpec {
  readonly kind: Kind;
  /** Polar angle from the top of the dome (degrees) and azimuth (0 = +x, 90 = towards the viewer). */
  readonly pol: number;
  readonly az: number;
  readonly size: number;
  readonly hero?: boolean;
}

const ROSE: Kind = 0;
const PEONY: Kind = 1;
const HYDRANGEA: Kind = 2;

const HEADS: readonly HeadSpec[] = [
  { kind: PEONY, pol: 4, az: 0, size: 1.3 },
  // inner ring
  { kind: ROSE, pol: 27, az: 25, size: 1.0 },
  { kind: ROSE, pol: 25, az: 95, size: 1.05 },
  { kind: PEONY, pol: 28, az: 165, size: 1.15 },
  { kind: HYDRANGEA, pol: 27, az: 235, size: 1.05 },
  { kind: ROSE, pol: 26, az: 305, size: 1.0 },
  // middle ring - the hero rose faces the viewer
  { kind: ROSE, pol: 50, az: 90, size: 1.3, hero: true },
  { kind: HYDRANGEA, pol: 50, az: 143, size: 1.1 },
  { kind: PEONY, pol: 52, az: 197, size: 1.2 },
  { kind: ROSE, pol: 50, az: 250, size: 1.0 },
  { kind: HYDRANGEA, pol: 51, az: 301, size: 1.05 },
  { kind: ROSE, pol: 49, az: 352, size: 1.05 },
  { kind: PEONY, pol: 50, az: 41, size: 1.15 },
  // outer ring: heads spill over the rim of the wrap
  { kind: HYDRANGEA, pol: 74, az: 18, size: 1.0 },
  { kind: ROSE, pol: 75, az: 64, size: 0.95 },
  { kind: PEONY, pol: 74, az: 118, size: 1.05 },
  { kind: ROSE, pol: 76, az: 168, size: 0.9 },
  { kind: HYDRANGEA, pol: 74, az: 210, size: 0.95 },
];

const DOME_CENTER_Y = -0.9;
const DOME_RADIUS = 2.55;
const GATHER_Y = -2.9; // where the stems are tied
const GOLDEN_ANGLE = 2.399963;
/** 'fan': layered ruffled sheets with bare stems below; 'cone': a single paper cone. */
const WRAP_STYLE: 'fan' | 'cone' = 'fan';

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Petal instances waiting to become one InstancedMesh. */
class PetalBatch {
  readonly matrices: number[] = [];
  readonly kind: Kind[] = [];
  readonly shade: number[] = [];
  readonly mix: number[] = [];
  readonly seeds: number[] = [];
  /** Per-petal "come apart" data (delay, spin, distance, random) - only the hero rose uses it. */
  readonly burst: number[] = [];
  pending: readonly [number, number, number, number] | null = null;
  tint!: THREE.InstancedBufferAttribute;
  mesh!: THREE.InstancedMesh;

  get count(): number {
    return this.kind.length;
  }

  add(m: THREE.Matrix4, kind: Kind, shade: number, mix: number, flutter: number, rnd: () => number): void {
    this.burst.push(...(this.pending ?? [0, 0, 0, 0]));
    this.matrices.push(...m.elements);
    this.kind.push(kind);
    this.shade.push(shade);
    this.mix.push(mix);
    this.seeds.push(rnd() * 6.283, 0.5 + rnd() * 0.8, flutter * (0.6 + rnd() * 0.8), rnd());
  }
}

export class BouquetScene {
  static async create(opts: BouquetSceneOptions): Promise<BouquetScene> {
    const [T, geo, utils] = await Promise.all([
      import('three'),
      import('three/examples/jsm/geometries/ParametricGeometry.js'),
      import('three/examples/jsm/utils/BufferGeometryUtils.js'),
    ]);
    return new BouquetScene(T, geo.ParametricGeometry, utils.mergeGeometries, opts);
  }

  // ---- three ----------------------------------------------------------------------------
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly bouquet: THREE.Group;
  private readonly disposables: { dispose(): void }[] = [];

  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly batches: PetalBatch[] = [];
  private readonly paperMaterial: THREE.MeshStandardMaterial;

  // ---- ambient layer: drifting petals + dust -------------------------------------------
  private readonly drift: {
    mesh: THREE.InstancedMesh;
    n: number;
    p: Float32Array;
    v: Float32Array;
    r: Float32Array;
    sr: Float32Array;
    size: Float32Array;
    fall: Float32Array;
    phase: Float32Array;
  };
  private readonly dust: THREE.Points;

  // ---- palette --------------------------------------------------------------------------
  private readonly curCols: THREE.Color[];
  private readonly tgtCols: THREE.Color[];
  private readonly curPaper: THREE.Color;
  private readonly tgtPaper: THREE.Color;
  private paletteDirty = true;

  // ---- camera path ----------------------------------------------------------------------
  private readonly heroPos: THREE.Vector3;
  private readonly heroAxis: THREE.Vector3;
  private readonly posCurve: THREE.CatmullRomCurve3;
  private readonly lookCurve: THREE.CatmullRomCurve3;
  private readonly tmpA: THREE.Vector3;
  private readonly tmpB: THREE.Vector3;
  private readonly tmpH: THREE.Vector3;
  private readonly tmpN: THREE.Vector3;

  // ---- state ----------------------------------------------------------------------------
  private width = 1;
  private height = 1;
  private layout: BouquetLayout = 'side';
  private rtl = false;
  private fitDistance = 10.4;
  private time = 0;
  private intro = 0;
  private glow!: THREE.Sprite;
  private scrollTarget = 0;
  private scrollCur = 0;
  private px = 0;
  private py = 0;
  private pxCur = 0;
  private pyCur = 0;
  // Free spin: the finger (or a slow automatic turn while nobody touches it) turns the bouquet round.
  private spin = 0; // radians, kept in -PI..PI
  private spinVel = 0; // rad/s left over from a flick
  private dragging = false;
  private idle = 0; // seconds since the last touch
  private autoK = 0; // 0..1 ease-in of the automatic turn
  private readonly calm: boolean;
  /** Phones: petals are drawn as depth first so each pixel is shaded once (see `finishBatch`). */
  private readonly prepass: boolean;
  // Adaptive resolution (phones): if frames stay slow the canvas quietly renders at a lower pixel
  // ratio (never below 1), so a weak GPU keeps scrolling smooth. Capable phones never trigger it.
  private pixelRatio = 1;
  private readonly adaptive: boolean;
  private frameEma = 1 / 60;
  private frameCount = 0;

  private constructor(
    private readonly T: typeof THREE,
    Parametric: typeof ParametricGeometryCtor,
    private readonly merge: typeof MergeGeometries,
    opts: BouquetSceneOptions,
  ) {
    this.calm = opts.calm;
    const { coarse, calm } = opts;
    this.prepass = coarse;
    const lod = coarse ? 0 : 1;
    const rnd = mulberry32(20261101);

    // ---- renderer / camera -----------------------------------------------------------
    this.renderer = new T.WebGLRenderer({
      canvas: opts.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    this.adaptive = coarse && !calm;
    this.renderer.setPixelRatio(this.pixelRatio);

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(40, 1, 0.05, 80);
    this.camera.position.set(0, 0.8, 10.4);

    // ---- lights (for the stems, leaves and paper; petals have their own shading) -------
    this.scene.add(new T.HemisphereLight(0xfff3f6, 0xd7a7b4, 1.25));
    const key = new T.DirectionalLight(0xfff2e8, 2.4);
    key.position.set(4.5, 7.5, 6);
    const rim = new T.DirectionalLight(0xff9fba, 1.1);
    rim.position.set(-6, 2.5, -5);
    this.scene.add(key, rim);

    // ---- shared petal material -----------------------------------------------------------
    this.uniforms = {
      uTime: { value: 0 },
      uIntro: { value: calm ? 1 : 0 },
      uKeyDir: { value: new T.Vector3(0.45, 0.78, 0.55).normalize() },
      uBackDir: { value: new T.Vector3(-0.6, -0.15, -0.65).normalize() },
      uRimColor: { value: new T.Color('#f7b6c6') },
      uBackColor: { value: new T.Color('#e8879f') },
      uFogColor: { value: new T.Color('#f6e4e8') },
      uBurst: { value: 0 },
      uBurstCenter: { value: new T.Vector3() },
      uBurstAxis: { value: new T.Vector3(0, 1, 0) },
      // Haze: once the lens is inside the bloom the world dissolves into the page's own colour.
      uHaze: { value: new T.Vector3(1, 0.9608, 0.9725) }, // #fff5f8, in output (sRGB) space
      uHazeWhite: { value: 0 },
      uHazeNear: { value: 60 },
      uHazeFar: { value: 120 },
    };
    this.scene.fog = new T.Fog(0xfff5f8, 60, 120);
    const bloomMaterial = new T.ShaderMaterial({
      vertexShader: PETAL_VERTEX,
      fragmentShader: petalFragment(true),
      uniforms: this.uniforms,
      side: T.DoubleSide,
    });
    // Same petal, plus the "come apart" motion and torn edges (hero rose only).
    const heroMaterial = new T.ShaderMaterial({
      vertexShader: PETAL_VERTEX,
      fragmentShader: petalFragment(true),
      uniforms: this.uniforms,
      defines: { BURST: 1 },
      side: T.DoubleSide,
    });
    const driftMaterial = new T.ShaderMaterial({
      vertexShader: PETAL_VERTEX,
      fragmentShader: petalFragment(false),
      uniforms: this.uniforms,
      side: T.DoubleSide,
      transparent: true,
      depthWrite: false,
    });
    this.disposables.push(bloomMaterial, heroMaterial, driftMaterial);

    // ---- petal geometries: hi-res for the hero rose, lean for everything else -----------
    const makePetal = (nu: number, nv: number): THREE.BufferGeometry => {
      const g = new Parametric((u, v, t) => petalSurface(u, v, t), nu, nv);
      g.translate(0, PETAL_BASE_OFFSET, 0);
      this.disposables.push(g);
      return g;
    };
    const geoHero = this.sliceIntoRibbons(makePetal(coarse ? 18 : 24, coarse ? 24 : 34), mulberry32(4417));
    const geoLean = makePetal(lod ? 12 : 9, lod ? 16 : 12);
    const geoDrift = makePetal(10, 14);

    // ---- palette state -------------------------------------------------------------------
    this.curCols = Array.from({ length: 6 }, () => new T.Color());
    this.tgtCols = Array.from({ length: 6 }, () => new T.Color());
    this.curPaper = new T.Color();
    this.tgtPaper = new T.Color();

    // ---- bouquet group ---------------------------------------------------------------------
    this.bouquet = new T.Group();
    this.scene.add(this.bouquet);

    this.heroPos = new T.Vector3();
    this.heroAxis = new T.Vector3(0, 1, 0);
    this.tmpA = new T.Vector3();
    this.tmpB = new T.Vector3();
    this.tmpH = new T.Vector3();
    this.tmpN = new T.Vector3();
    this.posCurve = new T.CatmullRomCurve3([new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()]);
    this.lookCurve = new T.CatmullRomCurve3([new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()]);

    const heroBatch = new PetalBatch();
    const leanBatch = new PetalBatch();
    const stemCurves: THREE.Curve<THREE.Vector3>[] = [];

    this.buildHeads(heroBatch, leanBatch, stemCurves, rnd, lod);

    (this.uniforms['uBurstCenter'].value as THREE.Vector3).copy(this.heroPos);
    (this.uniforms['uBurstAxis'].value as THREE.Vector3).copy(this.heroAxis);
    this.finishBatch(heroBatch, geoHero, heroMaterial);
    this.finishBatch(leanBatch, geoLean, bloomMaterial);

    this.buildStemsAndFiller(stemCurves, rnd);
    this.buildFoliage(Parametric, rnd, lod);
    this.paperMaterial = this.buildWrap();

    // ---- drifting petals + dust ----------------------------------------------------------
    const n = calm ? 14 : coarse ? 18 : 30;
    this.drift = this.buildDrift(geoDrift, driftMaterial, n, rnd);
    this.dust = this.buildDust(coarse ? 70 : 150, rnd, calm);

    this.glow = this.buildGlow();

    this.setPalette(0, true);
    this.setIntro(calm ? 1 : 0);
    this.resize(1, 1, 'side');
  }

  // =====================================================================================
  // Public API
  // =====================================================================================
  setPalette(index: number, instant = false): void {
    const pal = BOUQUET_PALETTES[((index % BOUQUET_PALETTES.length) + BOUQUET_PALETTES.length) % BOUQUET_PALETTES.length];
    const list = [...pal.rose, ...pal.peony, ...pal.hydrangea];
    list.forEach((hex, i) => this.tgtCols[i].set(hex));
    this.tgtPaper.set(pal.paper);
    if (instant) {
      this.curCols.forEach((c, i) => c.copy(this.tgtCols[i]));
      this.curPaper.copy(this.tgtPaper);
    }
    this.paletteDirty = true;
  }

  /** The light at the heart of the rose, revealed as its petals let go. */
  private buildGlow(): THREE.Sprite {
    const T = this.T;
    const size = 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.25, 'rgba(255,226,236,0.75)');
      grad.addColorStop(0.6, 'rgba(255,196,214,0.22)');
      grad.addColorStop(1, 'rgba(255,196,214,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    const map = new T.CanvasTexture(cv);
    map.colorSpace = T.SRGBColorSpace;
    const mat = new T.SpriteMaterial({ map, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false });
    const sprite = new T.Sprite(mat);
    // The light sits at the bottom of the cup (just under the heart), seen once the heart petals have gone.
    sprite.position.copy(this.heroPos).addScaledVector(this.heroAxis, -0.3);
    sprite.renderOrder = 5;
    this.bouquet.add(sprite);
    this.disposables.push(map, mat);
    return sprite;
  }

  /** 0 -> 1 as the page scrolls through the hero. */
  setScroll(p: number): void {
    // ScrollTrigger reports NaN while the hero has no scroll distance yet (page still laying out);
    // ignore that - a NaN here would poison the camera curve for good.
    if (!Number.isFinite(p)) return;
    this.scrollTarget = Math.min(1, Math.max(0, p));
  }

  /** Pointer in NDC (-1..1). */
  setPointer(x: number, y: number): void {
    this.px = x;
    this.py = y;
  }

  /** A finger went down on the bouquet: stop any automatic / inertial turn. */
  beginDrag(): void {
    this.dragging = true;
    this.spinVel = 0;
    this.idle = 0;
  }

  /** The finger moved `dxPx` sideways over `dt` seconds: turn the bouquet with it. */
  dragBy(dxPx: number, dt: number): void {
    const rad = dxPx * 0.012;
    this.spin += rad;
    if (dt > 0) {
      const v = Math.max(-14, Math.min(14, rad / dt));
      this.spinVel += (v - this.spinVel) * 0.5;
    }
  }

  /** The finger lifted: the bouquet keeps turning with what is left of the flick, then slows down. */
  endDrag(): void {
    this.dragging = false;
    this.idle = 0;
  }

  /** The bouquet grows in: 0 -> 1. */
  setIntro(v: number): void {
    this.intro = v;
    this.uniforms['uIntro'].value = v;
    const e = v * v * (3 - 2 * v);
    const s = 0.72 + 0.28 * e;
    this.bouquet.scale.setScalar(s);
    this.bouquet.visible = v > 0.002;
    (this.dust.material as THREE.PointsMaterial).opacity = Math.min(0.75, v * 0.75);
  }

  resize(width: number, height: number, layout: BouquetLayout, rtl = false): void {
    this.rtl = rtl;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.layout = layout;
    this.renderer.setSize(this.width, this.height, false);
    const aspect = this.width / this.height;
    this.camera.aspect = aspect;
    // Keep the whole bouquet inside the frame whatever the aspect ratio.
    // Phones: the copy and the product card take the top and bottom, so the bouquet sits a bit smaller.
    this.fitDistance =
      layout === 'stack' ? Math.max(15.5, 9 / aspect) * (aspect < 0.75 ? 1.16 : 1) : Math.max(12.6, 9.8 / aspect);
    this.render(0);
  }

  render(dtRaw: number): void {
    const dt = dtRaw * (this.calm ? 0.35 : 1);
    this.time += dt;
    const t = this.time;
    this.uniforms['uTime'].value = t;
    // The hero rose comes apart while the lens closes in on it.
    const burst = smooth(0.4, 0.92, this.scrollCur);
    this.uniforms['uBurst'].value = burst;
    this.stepHaze(burst);

    // Smooth the inputs: scroll glides, the pointer eases.
    this.scrollCur += (this.scrollTarget - this.scrollCur) * (dtRaw === 0 ? 1 : 1 - Math.exp(-dtRaw * 7));
    const pe = dtRaw === 0 ? 1 : 1 - Math.exp(-dtRaw * 5);
    this.pxCur += (this.px - this.pxCur) * pe;
    this.pyCur += (this.py - this.pyCur) * pe;

    this.stepPalette(dtRaw);

    // Sway: the bouquet breathes; the pointer tilts it. Both fade as the camera dives in.
    const calmK = this.calm ? 0.25 : 1;
    const settle = 1 - smooth(0.05, 0.7, this.scrollCur);
    const introE = this.intro * this.intro * (3 - 2 * this.intro);
    // Free spin: flick inertia, then a slow automatic turn once it has been left alone for a moment.
    if (!this.dragging) {
      this.spin += this.spinVel * dtRaw;
      this.spinVel *= Math.exp(-dtRaw * 2.6);
      this.idle += dtRaw;
    }
    const autoOn = !this.calm && !this.dragging && this.idle > 1.2 && this.intro > 0.95 && this.scrollTarget < 0.03;
    this.autoK += ((autoOn ? 1 : 0) - this.autoK) * (dtRaw === 0 ? 0 : 1 - Math.exp(-dtRaw * 1.4));
    this.spin += 0.42 * this.autoK * dtRaw;
    const TAU = Math.PI * 2;
    this.spin = ((((this.spin + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

    // The spin eases back to facing front while the camera dives in, so the dive always starts from the front.
    this.bouquet.rotation.y =
      (Math.sin(t * 0.32) * 0.16 + this.pxCur * 0.28) * calmK * settle + (1 - introE) * -0.9 + this.spin * settle;
    this.bouquet.rotation.x = -this.pyCur * 0.07 * calmK * settle;
    this.bouquet.position.y = Math.sin(t * 0.55) * 0.05 * calmK * settle;

    this.stepDrift(dt);
    this.dust.rotation.y = t * 0.02;
    this.dust.position.y = Math.sin(t * 0.3) * 0.2;

    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    if (this.adaptive && dtRaw > 0) this.adaptResolution(dtRaw);
  }

  /** Steps the pixel ratio down by 0.25 after ~1s of sustained slow frames (below ~50fps). */
  private adaptResolution(dtRaw: number): void {
    this.frameEma += (dtRaw - this.frameEma) * 0.06;
    if (++this.frameCount < 60 || this.frameEma < 0.0205 || this.pixelRatio <= 1) return;
    this.pixelRatio = Math.max(1, this.pixelRatio - 0.25);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.frameCount = 0;
    this.frameEma = 1 / 60; // judge the new resolution on its own frames
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    this.batches.forEach((b) => b.mesh.dispose());
    this.drift.mesh.dispose();
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss(); // free the GL context now (browsers cap live contexts)
  }

  /** Inner light + haze: the closer the lens gets to the core, the more the world turns to light. */
  private stepHaze(burst: number): void {
    const p = this.scrollCur;
    // Looking down the throat of the bloom, things fade into warm light with distance:
    // the tunnel glows, the petal walls beside you stay rich.
    const w = smooth(0.5, 0.85, p);
    // The last stretch closes the haze right up to the lens: the frame ends as pure page colour.
    const k = smooth(0.985, 1, p);
    const near = 40 * Math.pow(0.45 / 40, w) * (1 - k) + 0.01 * k;
    const far = 70 * Math.pow(1.8 / 70, w) * (1 - k) + 0.03 * k;
    this.uniforms['uHazeWhite'].value = k;
    this.uniforms['uHazeNear'].value = near;
    this.uniforms['uHazeFar'].value = far;    const fog = this.scene.fog as THREE.Fog;
    fog.near = near;
    fog.far = far;
    const mat = this.glow.material as THREE.SpriteMaterial;
    mat.opacity = 0.5 * smooth(0.42, 0.85, p) * (1 - smooth(0.94, 1, p));
    this.glow.scale.setScalar(1.2 + 2.2 * burst);
  }

  // =====================================================================================
  // Camera
  // =====================================================================================
  private updateCamera(): void {
    const T = this.T;
    const p = this.scrollCur;
    const cam = this.camera;
    const g = this.bouquet;
    g.updateMatrixWorld(true);

    const H = this.tmpH.copy(this.heroPos).applyMatrix4(g.matrixWorld);
    const N = this.tmpN.copy(this.heroAxis).transformDirection(g.matrixWorld);

    // Control points, expressed relative to the hero rose: whole bouquet -> a few blooms ->
    // the rose -> inside its spiral.
    const pp = this.posCurve.points;
    pp[0].set(0, 0.7, this.fitDistance);
    pp[1].copy(H).addScaledVector(N, 5.2).add(this.tmpA.set(-0.35, 0.6, 0));
    pp[2].copy(H).addScaledVector(N, 3.2).add(this.tmpA.set(0.08, 0.02, 0));
    pp[3].copy(H).addScaledVector(N, 0.75).add(this.tmpA.set(0.03, 0, 0));
    const lp = this.lookCurve.points;
    lp[0].set(0, -0.55, 0);
    lp[1].copy(H).addScaledVector(N, 0.25);
    lp[2].copy(H).addScaledVector(N, 0.12);
    lp[3].copy(H).addScaledVector(N, -1.1);

    this.posCurve.getPoint(p, cam.position);
    this.lookCurve.getPoint(p, this.tmpB);

    // A touch of pointer parallax early on.
    const par = (1 - smooth(0, 0.3, p)) * (this.calm ? 0.2 : 1);
    cam.position.x += this.pxCur * 0.45 * par;
    cam.position.y += this.pyCur * 0.3 * par;

    // Slow cinematic roll while diving in.
    const roll = smooth(0.3, 1, p) * 0.32;
    cam.up.set(Math.sin(roll), Math.cos(roll), 0);
    cam.lookAt(this.tmpB);

    // A longer lens as we get close flattens the perspective around the petals.
    // ...then opens up again at the very end, so we are inside the bloom rather than looking at it.
    cam.fov = 40 - 11 * smooth(0.3, 0.75, p) + 26 * smooth(0.78, 1, p);

    // Composition: copy on the left (side) or above (stack) -> the bouquet sits off-centre,
    // then glides to the middle as it becomes the subject.
    const off = 1 - smooth(0.03, 0.4, p);
    const offX = this.layout === 'side' ? -this.width * 0.205 * off * (this.rtl ? -1 : 1) : 0;
    const offY = this.layout === 'stack' ? -this.height * (this.width / this.height < 0.75 ? 0.095 : 0.07) * off : 0;
    cam.setViewOffset(this.width, this.height, offX, offY, this.width, this.height);
    cam.updateProjectionMatrix();
    void T;
  }

  // =====================================================================================
  // Palette
  // =====================================================================================
  private stepPalette(dtRaw: number): void {
    const k = dtRaw === 0 ? 1 : 1 - Math.exp(-dtRaw * 3.4);
    let moving = false;
    const advance = (cur: THREE.Color, tgt: THREE.Color): void => {
      const d = Math.abs(cur.r - tgt.r) + Math.abs(cur.g - tgt.g) + Math.abs(cur.b - tgt.b);
      if (d > 0.002) {
        cur.lerp(tgt, k);
        moving = true;
      } else if (d > 0) {
        cur.copy(tgt);
        moving = true;
      }
    };
    this.curCols.forEach((c, i) => advance(c, this.tgtCols[i]));
    advance(this.curPaper, this.tgtPaper);
    if (!moving && !this.paletteDirty) return;
    this.paletteDirty = false;

    this.paperMaterial.color.copy(this.curPaper);
    for (const b of this.batches) {
      const arr = b.tint.array as Float32Array;
      for (let i = 0; i < b.count; i++) {
        const a = this.curCols[b.kind[i] * 2];
        const c = this.curCols[b.kind[i] * 2 + 1];
        const m = b.mix[i];
        const s = b.shade[i];
        arr[i * 3] = (a.r + (c.r - a.r) * m) * s;
        arr[i * 3 + 1] = (a.g + (c.g - a.g) * m) * s;
        arr[i * 3 + 2] = (a.b + (c.b - a.b) * m) * s;
      }
      b.tint.needsUpdate = true;
    }
  }

  // =====================================================================================
  // Blooms
  // =====================================================================================
  private buildHeads(
    heroBatch: PetalBatch,
    leanBatch: PetalBatch,
    stems: THREE.Curve<THREE.Vector3>[],
    rnd: () => number,
    lod: number,
  ): void {
    const T = this.T;
    const gather = new T.Vector3(0, GATHER_Y, 0);
    const up = new T.Vector3(0, 1, 0);

    for (const head of HEADS) {
      const pol = (head.pol * Math.PI) / 180;
      const az = (head.az * Math.PI) / 180;
      const dir = new T.Vector3(Math.sin(pol) * Math.cos(az), Math.cos(pol), Math.sin(pol) * Math.sin(az));
      const jitter = 1 + (rnd() - 0.5) * 0.08;
      const pos = dir.clone().multiplyScalar(DOME_RADIUS * jitter);
      pos.y += DOME_CENTER_Y;

      // Heads lean towards the viewer a little, so the front of the bouquet reads as blooms.
      const axis = new T.Vector3(dir.x, dir.y * 0.9 + 0.1, dir.z + (dir.z > 0 ? 0.3 : 0)).normalize();

      const q = new T.Quaternion().setFromUnitVectors(up, axis);
      q.multiply(new T.Quaternion().setFromAxisAngle(up, rnd() * 6.283));
      const base = new T.Matrix4().compose(pos, q, new T.Vector3(1, 1, 1));

      const batch = head.hero ? heroBatch : leanBatch;
      if (head.kind === ROSE) this.addRose(batch, base, head.size, head.hero ? 40 : lod ? 30 : 24, !!head.hero, rnd);
      else if (head.kind === PEONY) this.addPeony(batch, base, head.size, lod ? 56 : 42, rnd);
      else this.addHydrangea(batch, base, head.size, lod ? 30 : 20, rnd);

      if (head.hero) {
        this.heroPos.copy(pos);
        this.heroAxis.copy(axis);
      }

      // Stem: from the tying point, swelling outward, up to the base of the head.
      const end = pos.clone().addScaledVector(axis, -0.12 * head.size);
      const start = gather.clone().add(new T.Vector3((rnd() - 0.5) * 0.14, 0, (rnd() - 0.5) * 0.14));
      const c1 = start.clone().add(new T.Vector3(dir.x * 0.25, 1.5, dir.z * 0.25));
      const c2 = end.clone().addScaledVector(axis, -1.25);
      stems.push(new T.CubicBezierCurve3(start, c1, c2, end));
    }
  }

  private petalMatrix(
    out: THREE.Matrix4,
    base: THREE.Matrix4,
    theta: number,
    y0: number,
    r: number,
    phi: number,
    sx: number,
    sy: number,
    sz: number,
    roll = 0,
  ): void {
    const T = this.T;
    const a = this.mA ?? (this.mA = new T.Matrix4());
    const b = this.mB ?? (this.mB = new T.Matrix4());
    a.makeRotationY(theta);
    b.makeTranslation(0, y0, -r);
    a.multiply(b);
    b.makeRotationX(-phi);
    a.multiply(b);
    if (roll) {
      b.makeRotationY(roll);
      a.multiply(b);
    }
    b.makeScale(sx, sy, sz);
    a.multiply(b);
    out.multiplyMatrices(base, a);
  }
  private mA?: THREE.Matrix4;
  private mB?: THREE.Matrix4;

  /** A rose: petals on a golden-angle spiral, a tight bud in the middle, outer petals folding back. */
  private addRose(batch: PetalBatch, base: THREE.Matrix4, size: number, count: number, hero: boolean, rnd: () => number): void {
    const out = new this.T.Matrix4();
    for (let k = 0; k < count; k++) {
      const t = k / (count - 1);
      const theta = k * GOLDEN_ANGLE + (rnd() - 0.5) * 0.1;
      const s = size * (0.18 + 0.25 * Math.pow(t, 0.9)) * (0.97 + rnd() * 0.06);
      const r = size * (0.03 + 0.13 * Math.pow(t, 0.85));
      const y0 = size * 0.12 * (1 - t);
      // Inner petals lean in over the centre (a closed bud), outer ones fold open.
      const phi = -0.5 + (hero ? 1.5 : 1.58) * Math.pow(t, 1.1) + (rnd() - 0.5) * 0.08;
      const sx = 1.45 - 0.2 * t;
      this.petalMatrix(out, base, theta, y0, r, phi, s * sx, s, s * (0.5 + 0.5 * Math.pow(t, 0.6)));
      // The hero rose comes apart on scroll: the heart petals peel away first, then the cup widens.
      if (hero) rnd(); // keeps the seeded layout identical to before
      batch.pending = hero ? [t * 0.3 + rnd() * 0.06, (rnd() < 0.5 ? -1 : 1) * (1.6 + rnd() * 2.6), t, rnd()] : null;
      // Inner petals sit deeper in the bloom: darker (cheap ambient occlusion).
      batch.add(out, ROSE, 0.55 + 0.45 * Math.pow(t, 0.7), 0.15 + t * 0.55 + (rnd() - 0.5) * 0.15, 0.1, rnd);
    }
    batch.pending = null;
  }

  /** A peony: many broad, ruffled petals that open flat. */
  private addPeony(batch: PetalBatch, base: THREE.Matrix4, size: number, count: number, rnd: () => number): void {
    const out = new this.T.Matrix4();
    for (let k = 0; k < count; k++) {
      const t = k / (count - 1);
      const theta = k * GOLDEN_ANGLE + (rnd() - 0.5) * 0.2;
      const s = size * (0.16 + 0.32 * Math.pow(t, 0.7)) * (0.92 + rnd() * 0.16);
      const r = size * (0.02 + 0.15 * t);
      const y0 = size * 0.08 * (1 - t);
      const phi = -0.45 + 2.2 * Math.pow(t, 1.1) + (rnd() - 0.5) * 0.3;
      const sx = 1.5 - 0.1 * t;
      this.petalMatrix(out, base, theta, y0, r, phi, s * sx, s * (0.95 + rnd() * 0.12), s, (rnd() - 0.5) * 0.35);
      batch.add(out, PEONY, 0.55 + 0.45 * Math.pow(t, 0.6), rnd(), 0.35, rnd);
    }
  }
  /** A hydrangea head: a dome of tiny four-petal florets. */
  private addHydrangea(batch: PetalBatch, base: THREE.Matrix4, size: number, florets: number, rnd: () => number): void {
    const T = this.T;
    const out = new T.Matrix4();
    const fBase = new T.Matrix4();
    const q = new T.Quaternion();
    const up = new T.Vector3(0, 1, 0);
    const d = new T.Vector3();
    const p = new T.Vector3();
    const one = new T.Vector3(1, 1, 1);
    const radius = 0.5 * size;
    for (let j = 0; j < florets; j++) {
      const y = 1 - (j / (florets - 1)) * 0.78;
      const ring = Math.sqrt(1 - y * y);
      const ang = j * GOLDEN_ANGLE;
      d.set(Math.cos(ang) * ring, y, Math.sin(ang) * ring);
      p.copy(d).multiplyScalar(radius);
      p.y += 0.04 * size;
      q.setFromUnitVectors(up, d);
      fBase.compose(p, q, one);
      fBase.premultiply(base);
      const mix = rnd();
      const spin = rnd() * 6.283;
      const s = size * (0.17 + rnd() * 0.06);
      for (let k = 0; k < 4; k++) {
        this.petalMatrix(out, fBase, spin + (k * Math.PI) / 2, 0, 0.0, 1.22 + (rnd() - 0.5) * 0.12, s * 1.05, s, s);
        batch.add(out, HYDRANGEA, 0.75 + rnd() * 0.25, mix, 0.2, rnd);
      }
    }
  }

  /**
   * Prepares the hero petal to be cut apart: the surface is un-welded, then every triangle is
   * assigned to one of six ribbons (3 across x 2 along, cut along the surface's own grid lines). The shader
   * slides each ribbon away from the petal's middle, so the cuts are clean and follow the petal.
   */
  private sliceIntoRibbons(source: THREE.BufferGeometry, rnd: () => number): THREE.BufferGeometry {
    const T = this.T;
    const g = source.index ? source.toNonIndexed() : source;
    this.disposables.push(g);
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    const COLS = 3;
    const ROWS = 2;
    const pieces = COLS * ROWS;
    const sum = Array.from({ length: pieces }, () => [0, 0, 0, 0]);
    const whole = [0, 0, 0, 0];
    const owner = new Uint8Array(pos.count / 3);

    for (let t = 0; t < owner.length; t++) {
      let cu = 0;
      let cv = 0;
      for (let k = 0; k < 3; k++) {
        cu += uv.getX(t * 3 + k) / 3;
        cv += uv.getY(t * 3 + k) / 3;
      }
      // Seams sit exactly on grid lines (24 and 34 divide evenly), so the cuts are razor clean.
      const col = Math.min(COLS - 1, Math.max(0, Math.floor(cu * COLS)));
      const row = Math.min(ROWS - 1, Math.max(0, Math.floor(cv * ROWS)));
      const id = row * COLS + col;
      owner[t] = id;
      for (let k = 0; k < 3; k++) {
        const i = t * 3 + k;
        for (const acc of [sum[id], whole]) {
          acc[0] += pos.getX(i);
          acc[1] += pos.getY(i);
          acc[2] += pos.getZ(i);
          acc[3] += 1;
        }
      }
    }

    const centre = pieces ? sum.map((s) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : [0, 0, 0])) : [];
    const middle = [whole[0] / whole[3], whole[1] / whole[3], whole[2] / whole[3]];
    const rand = Array.from({ length: pieces }, () => rnd());
    const pc = new Float32Array(pos.count * 3);
    const pd = new Float32Array(pos.count * 4);
    for (let t = 0; t < owner.length; t++) {
      const id = owner[t];
      const c = centre[id];
      const d = new T.Vector3(c[0] - middle[0], c[1] - middle[1], c[2] - middle[2]);
      // Ribbons part sideways more than lengthways, and a little out of the petal's plane.
      d.x *= 1.5;
      d.z += (rand[id] - 0.5) * 0.12;
      for (let k = 0; k < 3; k++) {
        const i = t * 3 + k;
        pc.set(c, i * 3);
        pd.set([d.x, d.y, d.z, rand[id]], i * 4);
      }
    }
    g.setAttribute('aPieceC', new T.BufferAttribute(pc, 3));
    g.setAttribute('aPieceD', new T.BufferAttribute(pd, 4));
    return g;
  }

  private finishBatch(batch: PetalBatch, geometry: THREE.BufferGeometry, material: THREE.ShaderMaterial): void {
    const T = this.T;
    const n = batch.count;
    const mesh = new T.InstancedMesh(geometry, material, Math.max(1, n));
    const m = new T.Matrix4();
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, m.fromArray(batch.matrices, i * 16));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;

    batch.tint = new T.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    batch.tint.setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('aTint', batch.tint);
    geometry.setAttribute('aSeed', new T.InstancedBufferAttribute(new Float32Array(batch.seeds), 4));
    if (material.defines?.['BURST']) {
      geometry.setAttribute('aBurst', new T.InstancedBufferAttribute(new Float32Array(batch.burst), 4));
    }
    batch.mesh = mesh;
    this.batches.push(batch);
    this.bouquet.add(mesh);

    if (this.prepass) {
      // Depth pre-pass: the same petals (same vertex shader, same instances and attributes), but with
      // no colour output. Petals overlap a lot, so without it the heavy petal shading runs for every
      // layer under a pixel; with it, only for the visible one. The picture is identical - the pass
      // pushes its depth back by a hair so the colour pass always wins the depth test.
      const depthMaterial = new T.ShaderMaterial({
        vertexShader: PETAL_VERTEX,
        fragmentShader: DEPTH_ONLY_FRAGMENT,
        uniforms: this.uniforms,
        defines: { ...(material.defines ?? {}) },
        side: T.DoubleSide,
        colorWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      });
      this.disposables.push(depthMaterial);
      const pre = new T.InstancedMesh(geometry, depthMaterial, Math.max(1, n));
      pre.instanceMatrix = mesh.instanceMatrix; // shared, not copied
      pre.frustumCulled = false;
      pre.renderOrder = -10; // before everything else in the opaque pass
      this.bouquet.add(pre);
    }
  }

  // =====================================================================================
  // Stems, filler, foliage, wrap
  // =====================================================================================
  private buildStemsAndFiller(curves: THREE.Curve<THREE.Vector3>[], rnd: () => number): void {
    const T = this.T;
    const stemGeos: THREE.BufferGeometry[] = [];
    for (const c of curves) stemGeos.push(new T.TubeGeometry(c, 20, 0.042, 6, false));

    // Baby's breath: thin sprigs ending in clouds of tiny white blossoms.
    const dots: THREE.Vector3[] = [];
    const sprigs = 11;
    for (let i = 0; i < sprigs; i++) {
      const az = (i / sprigs) * Math.PI * 2 + rnd() * 0.4;
      const pol = (58 + rnd() * 30) * (Math.PI / 180);
      const dir = new T.Vector3(Math.sin(pol) * Math.cos(az), Math.cos(pol), Math.sin(pol) * Math.sin(az));
      const tip = dir.clone().multiplyScalar(DOME_RADIUS * (1.12 + rnd() * 0.12));
      tip.y += DOME_CENTER_Y;
      const start = new T.Vector3(0, GATHER_Y, 0);
      const c1 = start.clone().add(new T.Vector3(dir.x * 0.2, 1.4, dir.z * 0.2));
      const c2 = tip.clone().sub(dir.clone().multiplyScalar(1.1));
      stemGeos.push(new T.TubeGeometry(new T.CubicBezierCurve3(start, c1, c2, tip), 16, 0.014, 4, false));
      for (let k = 0; k < 9; k++) {
        dots.push(
          tip.clone().add(new T.Vector3((rnd() - 0.5) * 0.55, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.55)),
        );
      }
    }
    const stems = new T.Mesh(
      this.merge(stemGeos, false) ?? new T.BufferGeometry(),
      new T.MeshStandardMaterial({ color: '#58794a', roughness: 0.72 }),
    );
    this.bouquet.add(stems);
    stemGeos.forEach((g) => g.dispose());

    const dotGeo = new T.IcosahedronGeometry(0.036, 1);
    const dotMesh = new T.InstancedMesh(
      dotGeo,
      new T.MeshStandardMaterial({ color: '#fffaf5', roughness: 0.8 }),
      dots.length,
    );
    const m = new T.Matrix4();
    dots.forEach((p, i) => {
      const s = 0.7 + rnd() * 0.9;
      dotMesh.setMatrixAt(i, m.compose(p, new T.Quaternion(), new T.Vector3(s, s, s)));
    });
    dotMesh.frustumCulled = false;
    this.bouquet.add(dotMesh);
  }

  private buildFoliage(Parametric: typeof ParametricGeometryCtor, rnd: () => number, lod: number): void {
    const T = this.T;
    const leafGeo = new Parametric((u, v, t) => leafSurface(u, v, t), lod ? 10 : 7, lod ? 18 : 12);
    leafGeo.computeVertexNormals(); // the parametric normals are NaN at the pointed ends (renders black)
    const count = lod ? 22 : 16;
    const leaves = new T.InstancedMesh(
      leafGeo,
      new T.MeshStandardMaterial({ color: '#ffffff', side: T.DoubleSide, roughness: 0.55 }),
      count,
    );
    const greens = ['#648d5f', '#4f7b56', '#7b9d6e', '#3f6a4c', '#8aa879'].map((c) => new T.Color(c));
    const m = new T.Matrix4();
    const x = new T.Vector3();
    const y = new T.Vector3();
    const z = new T.Vector3();
    const down = new T.Vector3(0, -1, 0);
    const pos = new T.Vector3();
    const scale = new T.Matrix4();
    for (let i = 0; i < count; i++) {
      const az = i * GOLDEN_ANGLE;
      const pol = (66 + rnd() * 30) * (Math.PI / 180);
      const dir = new T.Vector3(Math.sin(pol) * Math.cos(az), Math.cos(pol), Math.sin(pol) * Math.sin(az));
      y.set(dir.x, dir.y * 0.45 + 0.12, dir.z).normalize();
      z.copy(down).addScaledVector(y, -down.dot(y)).normalize();
      x.crossVectors(y, z).normalize();
      pos.set(dir.x * 1.55, -0.65 + dir.y * 0.4, dir.z * 1.55);
      m.makeBasis(x, y, z).setPosition(pos);
      const s = 0.5 + rnd() * 0.45;
      leaves.setMatrixAt(i, m.multiply(scale.makeScale(s * 0.9, s, s)));
      leaves.setColorAt(i, greens[(rnd() * greens.length) | 0]);
    }
    leaves.frustumCulled = false;
    this.bouquet.add(leaves);
  }

  /** Radius of the paper cone at height `y` and angle `th`. */
  private wrapRadius(th: number, y: number, scale: number, lift: number, spin: number): number {
    const a = th + spin;
    const back = 0.5 - 0.5 * Math.sin(a);
    const top = -0.75 + lift + 1.05 * Math.pow(back, 1.25) + 0.07 * Math.sin(a * 9 + 1.3);
    const t = Math.min(1, Math.max(0, (y + 3.45) / (top + 3.45)));
    // Six soft, crisp-edged folds that deepen towards the opening and twist a little, like
    // florist paper gathered by hand (no fine ripples: those read as stripes).
    const fold = 0.05 * (0.25 + 0.75 * t) * (Math.abs(Math.sin(a * 3 + t * 1.1)) - 0.64);
    return (0.34 + (2.0 * scale - 0.34) * Math.pow(t, 0.82)) * (1 + fold + 0.012 * Math.sin(a * 5 + 0.7));
  }

  private wrapGeometry(scale: number, lift: number, spin: number, shade = false): THREE.BufferGeometry {
    const T = this.T;
    const seg = 96;
    const rows = 18;
    const pos: number[] = [];
    const idx: number[] = [];
    const col: number[] = [];
    const tip = new T.Color('#e3a9b8');
    const rim = new T.Color('#fde9eb');
    const c = new T.Color();
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      for (let s = 0; s <= seg; s++) {
        const th = (s / seg) * Math.PI * 2;
        const a = th + spin;
        const back = 0.5 - 0.5 * Math.sin(a);
        const top = -0.75 + lift + 1.05 * Math.pow(back, 1.25) + 0.07 * Math.sin(a * 9 + 1.3);
        const y = -3.45 + (top + 3.45) * t;
        const rad = this.wrapRadius(th, y, scale, lift, spin);
        pos.push(rad * Math.cos(th), y, rad * Math.sin(th));
        // Paper picks up a blush towards the point and goes pale at the open rim.
        c.copy(tip).lerp(rim, Math.pow(t, 0.7));
        col.push(c.r, c.g, c.b);
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let s = 0; s < seg; s++) {
        const a = r * (seg + 1) + s;
        const b = a + seg + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    if (shade) g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  private buildWrap(): THREE.MeshStandardMaterial {
    const T = this.T;
    const satin = new T.MeshPhysicalMaterial({
      color: '#b8395a',
      roughness: 0.36,
      metalness: 0,
      sheen: 1,
      sheenRoughness: 0.35,
      sheenColor: new T.Color('#ffc0d0'),
      side: T.DoubleSide,
    });
    return WRAP_STYLE === 'fan' ? this.buildFanWrap(satin) : this.buildConeWrap(satin);
  }

  /**
   * "Fan" wrap: the look florists use for a hand-held bouquet. Layered sheets of paper fan out
   * behind and under the blooms, their edges ruffled, and the bare stems show below the ribbon.
   * Returns the lining sheet, whose colour follows the palette.
   */
  private buildFanWrap(satin: THREE.MeshPhysicalMaterial): THREE.MeshStandardMaterial {
    const T = this.T;
    const sheet = (color: string, roughness = 0.82): THREE.MeshStandardMaterial =>
      new T.MeshStandardMaterial({
        color,
        roughness,
        emissive: new T.Color(color),
        emissiveIntensity: 0.08,
        side: T.DoubleSide,
      });
    const lining = sheet('#e9b6c3', 0.78);
    lining.emissiveIntensity = 0; // its colour is driven by the palette
    this.disposables.push(lining);

    // [centre angle (3pi/2 is straight behind), half-width, rim height, rim radius, ruffle, material]
    const BACK = Math.PI * 1.5;
    const layers: [number, number, number, number, number, THREE.MeshStandardMaterial][] = [
      [BACK, 1.75, 0.95, 3.25, 0.16, lining],
      [BACK - 0.95, 1.55, 0.55, 3.05, 0.14, sheet('#f2b3c2')],
      [BACK + 0.95, 1.55, 0.55, 3.05, 0.14, sheet('#fbe6e3')],
      [BACK - 1.75, 1.2, 0.05, 2.7, 0.12, sheet('#e48ba2')],
      [BACK + 1.75, 1.2, 0.05, 2.7, 0.12, sheet('#f6cad4')],
    ];
    for (const [centre, half, rimY, rimR, ruffle, material] of layers) {
      this.bouquet.add(new T.Mesh(this.fanSheet(centre, half, rimY, rimR, ruffle), material));
    }

    // Bare stems below the tie, cut at different lengths.
    const gather = new T.Vector3(0, GATHER_Y, 0);
    const cuts: THREE.BufferGeometry[] = [];
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = i * GOLDEN_ANGLE;
      const rr = 0.07 + 0.12 * Math.sqrt(i / n);
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      const end = new T.Vector3(x * 1.7, -4.25 - (i % 3) * 0.18, z * 1.7);
      const mid = new T.Vector3(x * 1.2, -3.55, z * 1.2);
      cuts.push(new T.TubeGeometry(new T.CatmullRomCurve3([gather.clone().add(new T.Vector3(0, 0.15, 0)), mid, end]), 12, 0.05, 7, false));
      // a pale, freshly cut end
      const disc = new T.CircleGeometry(0.05, 7);
      disc.rotateX(Math.PI / 2);
      disc.translate(end.x, end.y, end.z);
      cuts.push(disc);
    }
    const bare = new T.Mesh(
      this.merge(cuts, false) ?? new T.BufferGeometry(),
      new T.MeshStandardMaterial({ color: '#6f9460', roughness: 0.7, side: T.DoubleSide }),
    );
    this.bouquet.add(bare);
    cuts.forEach((g) => g.dispose());

    // Ribbon wound round the stems, with the bow in front.
    const tie = new T.Mesh(new T.CylinderGeometry(0.34, 0.27, 0.42, 28, 1, true), satin);
    tie.position.set(0, -3.3, 0);
    this.bouquet.add(tie);
    const bow = this.makeBow(satin);
    bow.position.set(0, -3.3, 0.36);
    bow.scale.setScalar(1.05);
    this.bouquet.add(bow);

    return lining;
  }

  /**
   * One sheet of paper: a fan-shaped piece of cone seen from the tying point, widening upwards,
   * highest in the middle and rolling over into soft ruffles at the rim.
   */
  private fanSheet(centre: number, half: number, rimY: number, rimR: number, ruffle: number): THREE.BufferGeometry {
    const T = this.T;
    const cols = 48;
    const rows = 16;
    const y0 = GATHER_Y - 0.1;
    const pos: number[] = [];
    const idx: number[] = [];
    for (let r = 0; r <= rows; r++) {
      const v = r / rows;
      for (let c = 0; c <= cols; c++) {
        const u = c / cols; // 0..1 across the arc
        const s = u * 2 - 1;
        const th = centre + s * half;
        // taller in the middle, lower towards the sides
        const top = rimY - 0.55 * Math.pow(Math.abs(s), 2.2);
        const y = y0 + (top - y0) * v;
        const rim = rimR * (1 - 0.18 * Math.pow(Math.abs(s), 2));
        // The paper flares quickly near the top (a fan, not a straight cone) and ripples at the edge.
        const flare = 0.12 + (rim - 0.12) * Math.pow(v, 0.78);
        const wave = ruffle * Math.pow(v, 2.2) * Math.sin(th * 11 + centre * 3);
        const rad = flare + wave;
        pos.push(rad * Math.cos(th), y + wave * 0.5, rad * Math.sin(th));
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = r * (cols + 1) + c;
        const b = a + cols + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.disposables.push(g);
    return g;
  }

  /** The original single paper cone with a ribbon band and bow. */
  private buildConeWrap(satin: THREE.MeshPhysicalMaterial): THREE.MeshStandardMaterial {
    const T = this.T;
    const paperOuter = new T.MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness: 0.86,
      emissive: new T.Color('#f6d9df'),
      emissiveIntensity: 0.28,
      side: T.DoubleSide,
    });
    const paperInner = new T.MeshStandardMaterial({ color: '#e9b6c3', roughness: 0.78, side: T.DoubleSide });
    // The lining sits just inside the outer sheet and shows above its low front edge, never through it.
    this.bouquet.add(new T.Mesh(this.wrapGeometry(0.9, 0.35, 0.5), paperInner));
    this.bouquet.add(new T.Mesh(this.wrapGeometry(1, 0, 0, true), paperOuter));

    // Satin ribbon hugging the cone, with a proper bow at the front (rose, to match the page).
    const yBand = -2.55;
    const seg = 96;
    const bandHalf = 0.15;
    const pos: number[] = [];
    const idx: number[] = [];
    for (const dy of [-bandHalf, bandHalf]) {
      for (let s = 0; s <= seg; s++) {
        const th = (s / seg) * Math.PI * 2;
        const rad = this.wrapRadius(th, yBand + dy, 1, 0, 0) + 0.025;
        pos.push(rad * Math.cos(th), yBand + dy, rad * Math.sin(th));
      }
    }
    for (let s = 0; s < seg; s++) idx.push(s, s + seg + 1, s + 1, s + seg + 1, s + seg + 2, s + 1);
    const band = new T.BufferGeometry();
    band.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    band.setIndex(idx);
    band.computeVertexNormals();
    this.bouquet.add(new T.Mesh(band, satin));

    const front = this.wrapRadius(Math.PI / 2, yBand, 1, 0, 0) + 0.06;
    const bow = this.makeBow(satin);
    bow.position.set(0, yBand, front);
    // The cone widens upwards, so its front face leans down: tip the bow to lie flat on it.
    bow.rotation.x = 0.5;
    bow.scale.setScalar(1.3);
    this.bouquet.add(bow);

    return paperInner;
  }

  /** A satin bow facing +z: two pairs of loops, two tails and a knot. */
  private makeBow(satin: THREE.Material): THREE.Group {
    const T = this.T;
    const bow = new T.Group();
    // Loops: closed teardrop bands that meet at the knot, a big pair and a smaller pair above.
    const loopPath = (side: number, rx: number, ry: number, lift: number, puff: number): THREE.Vector3[] => {
      const pts: THREE.Vector3[] = [];
      const n = 44;
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const x = side * rx * (1 - Math.cos(t));
        // pinched towards the knot, fuller at the far end
        const y = ry * Math.sin(t) * (0.55 + 0.45 * (1 - Math.cos(t)) * 0.5) + Math.abs(x) * lift;
        const z = puff * (1 - Math.cos(t)) * 0.5;
        pts.push(new T.Vector3(x, y, z));
      }
      return pts;
    };
    for (const side of [-1, 1]) {
      bow.add(new T.Mesh(this.ribbonStrip(loopPath(side, 0.36, 0.2, 0.18, 0.1), 0.07, true), satin));
      bow.add(new T.Mesh(this.ribbonStrip(loopPath(side, 0.25, 0.15, 0.62, 0.14), 0.062, true), satin));

      // Tails: long, with a slight outward sweep, ends cut on a slant.
      const tail: THREE.Vector3[] = [];
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        tail.push(new T.Vector3(side * (0.04 + 0.34 * u * u + 0.04 * Math.sin(u * Math.PI)), -0.06 - 0.95 * u, 0.04 + 0.05 * u));
      }
      bow.add(new T.Mesh(this.ribbonStrip(tail, 0.085, false, true), satin));
    }
    const knot = new T.Mesh(new T.SphereGeometry(0.12, 16, 14), satin);
    knot.scale.set(1, 0.92, 0.75);
    knot.position.z = 0.03;
    bow.add(knot);
    return bow;
  }

  /**
   * A flat ribbon (half-width `w`) following `pts`, facing +z. `closed` joins the ends into a loop;
   * `slant` cuts the free end at an angle, like a snipped tail.
   */
  private ribbonStrip(pts: THREE.Vector3[], w: number, closed: boolean, slant = false): THREE.BufferGeometry {
    const T = this.T;
    const n = pts.length;
    const pos: number[] = [];
    const idx: number[] = [];
    const tan = new T.Vector3();
    for (let i = 0; i < n; i++) {
      const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
      const next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      tan.subVectors(next, prev);
      // side = tangent x z  (in the ribbon's plane, perpendicular to its direction)
      const sx = tan.y;
      const sy = -tan.x;
      const len = Math.hypot(sx, sy) || 1;
      const p = pts[i];
      const k = slant && i === n - 1 ? 0.55 : 1;
      const ox = (sx / len) * w;
      const oy = (sy / len) * w;
      pos.push(p.x + ox, p.y + oy, p.z, p.x - ox * k, p.y - oy * k - (slant && i === n - 1 ? 0.09 : 0), p.z);
    }
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = i * 2;
      const b = ((i + 1) % n) * 2;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.disposables.push(g);
    return g;
  }

  // =====================================================================================
  // Ambient layer
  // =====================================================================================
  private buildDrift(
    geometry: THREE.BufferGeometry,
    material: THREE.ShaderMaterial,
    n: number,
    rnd: () => number,
  ): BouquetScene['drift'] {
    const T = this.T;
    const mesh = new T.InstancedMesh(geometry, material, n);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    const tint = new Float32Array(n * 3);
    const seed = new Float32Array(n * 4);
    const palette = ['#d9708f', '#e8a0b6', '#f2c4d0', '#c43a5d', '#efb4c4', '#f6d3dc'].map((c) => new T.Color(c));
    for (let i = 0; i < n; i++) {
      const c = palette[(rnd() * palette.length) | 0];
      tint.set([c.r, c.g, c.b], i * 3);
      seed.set([rnd() * 6.283, 0.55 + rnd() * 0.9, 0.7 + rnd() * 0.9, rnd()], i * 4);
    }
    geometry.setAttribute('aTint', new T.InstancedBufferAttribute(tint, 3));
    geometry.setAttribute('aSeed', new T.InstancedBufferAttribute(seed, 4));
    this.scene.add(mesh);

    const d = {
      mesh,
      n,
      p: new Float32Array(n * 3),
      v: new Float32Array(n * 3),
      r: new Float32Array(n * 3),
      sr: new Float32Array(n * 3),
      size: new Float32Array(n),
      fall: new Float32Array(n),
      phase: new Float32Array(n),
    };
    for (let i = 0; i < n; i++) {
      d.p.set([(rnd() - 0.5) * 20, (rnd() - 0.5) * 11, -6 + rnd() * 8], i * 3);
      d.r.set([rnd() * 6.283, rnd() * 6.283, rnd() * 6.283], i * 3);
      d.sr.set([(rnd() - 0.5) * 1.6, (rnd() - 0.5) * 2, (rnd() - 0.5) * 1.2], i * 3);
      d.size[i] = 0.22 + rnd() * 0.3;
      d.fall[i] = 0.18 + rnd() * 0.3;
      d.phase[i] = rnd() * 6.283;
    }
    return d;
  }

  private stepDrift(dt: number): void {
    const d = this.drift;
    const t = this.time;
    const T = this.T;
    const dummy = this.dummy ?? (this.dummy = new T.Object3D());
    const introE = this.intro * this.intro * (3 - 2 * this.intro);
    for (let i = 0; i < d.n; i++) {
      const o = i * 3;
      let x = d.p[o];
      let y = d.p[o + 1];
      let z = d.p[o + 2];
      const wx = (Math.sin(t * 0.3 + y * 0.4 + z * 0.2) * 0.7 + 0.35) * 0.9;
      const wy = Math.cos(t * 0.27 + x * 0.3) * 0.18 - d.fall[i];
      const wz = Math.sin(t * 0.23 + x * 0.2 + y * 0.3) * 0.25;
      const k = 1 - Math.exp(-dt * 1.2);
      d.v[o] += (wx - d.v[o]) * k;
      d.v[o + 1] += (wy - d.v[o + 1]) * k;
      d.v[o + 2] += (wz - d.v[o + 2]) * k;
      x += d.v[o] * dt;
      y += d.v[o + 1] * dt;
      z += d.v[o + 2] * dt;
      if (y < -6.5) y += 13;
      if (x > 11) x -= 22;
      else if (x < -11) x += 22;
      d.p[o] = x;
      d.p[o + 1] = y;
      d.p[o + 2] = z;
      d.r[o] += d.sr[o] * dt;
      d.r[o + 1] += d.sr[o + 1] * dt;
      d.r[o + 2] += d.sr[o + 2] * dt;
      const ft = t * 1.3 + d.phase[i];
      dummy.position.set(x, y, z);
      dummy.rotation.set(d.r[o] + Math.sin(ft) * 0.3, d.r[o + 1], d.r[o + 2] + Math.cos(ft * 0.8) * 0.2);
      dummy.scale.setScalar(d.size[i] * introE);
      dummy.updateMatrix();
      d.mesh.setMatrixAt(i, dummy.matrix);
    }
    d.mesh.instanceMatrix.needsUpdate = true;
  }
  private dummy?: THREE.Object3D;

  private buildDust(count: number, rnd: () => number, calm: boolean): THREE.Points {
    const T = this.T;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rnd() - 0.5) * 26;
      positions[i * 3 + 1] = (rnd() - 0.5) * 15;
      positions[i * 3 + 2] = -10 + rnd() * 12;
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3));

    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (ctx) {
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
    }
    const map = new T.CanvasTexture(c);
    map.colorSpace = T.SRGBColorSpace;
    const material = new T.PointsMaterial({
      map,
      color: 0xf0b8c8,
      size: 0.14,
      sizeAttenuation: true,
      transparent: true,
      opacity: calm ? 0.6 : 0,
      depthWrite: false,
    });
    this.disposables.push(map);
    const points = new T.Points(geometry, material);
    points.frustumCulled = false;
    this.scene.add(points);
    return points;
  }
}
