/**
 * Pure geometry for the bouquet preview (viewBox 0 0 400 540).
 * Shared by the builder service (placement rules) and the SVG preview (drawing), so what the
 * customer can drag and what is drawn can never drift apart.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Centre of the bouquet's head: where the first stem lands. */
export const HEAD_X = 200;
export const HEAD_Y = 196;

/** Where all stems gather before the ribbon. */
export const GATHER_X = 200;
export const GATHER_Y = 396;

/** Blooms can be placed anywhere inside this ellipse (the open mouth of the paper). */
export const AREA = { cx: HEAD_X, cy: HEAD_Y, rx: 132, ry: 104 } as const;

/** Two stems closer than this are considered stacked on top of each other. */
export const CROWDED_DISTANCE = 14;

const GOLDEN_ANGLE = 2.399963;

/** Default distance scale of the spiral (fits about 36 blooms inside the area). */
export const DEFAULT_SPACING = 21;

/** Spiral scale that keeps `total` blooms inside the area: tighter as the bouquet gets fuller. */
export function spacingFor(total: number): number {
  return Math.min(DEFAULT_SPACING, 124 / Math.sqrt(Math.max(total, 1) + 0.6));
}

/** The default (phyllotaxis) position of a slot: a tidy spiral, centre first. */
export function slotPosition(slot: number, spacing = DEFAULT_SPACING): Point {
  const r = spacing * Math.sqrt(slot + 0.6);
  const theta = slot * GOLDEN_ANGLE;
  return { x: HEAD_X + r * Math.cos(theta), y: HEAD_Y + r * Math.sin(theta) * 0.84 };
}

/** A varied but stable rotation per slot, so identical blooms do not look stamped. */
export function slotRotation(slot: number): number {
  return ((slot * 53) % 360) - 180;
}

/** Normalised distance from the area centre: `<= 1` is inside. `grow` widens the ellipse. */
function areaDistance(x: number, y: number, grow: number): number {
  return Math.hypot((x - AREA.cx) / (AREA.rx * grow), (y - AREA.cy) / (AREA.ry * grow));
}

export function insideArea(x: number, y: number, grow = 1): boolean {
  return areaDistance(x, y, grow) <= 1;
}

/** Pulls a point back onto the edge of the placement area. */
export function clampToArea(x: number, y: number): Point {
  const d = areaDistance(x, y, 1);
  if (d <= 1) return { x, y };
  return { x: AREA.cx + (x - AREA.cx) / d, y: AREA.cy + (y - AREA.cy) / d };
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Smallest distance from `p` to any of `others` (Infinity when there are none). */
export function minDistance(p: Point, others: readonly Point[]): number {
  let min = Infinity;
  for (const o of others) min = Math.min(min, distanceBetween(p, o));
  return min;
}
