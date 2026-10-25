import { Point, smoothPolyline } from '../physics/geometry';

/**
 * Ground body built from a top surface polyline (left to right) down to `bottom`.
 * Points with `smooth` get Catmull-Rom rounding so slopes feel like hills.
 */
export function ground(top: Point[], bottom: number, smooth = false): Point[] {
  const surface = smooth ? smoothPolyline(top, 8) : top;
  const first = surface[0];
  const last = surface[surface.length - 1];
  return [...surface, [last[0], bottom], [first[0], bottom]];
}

/** Floating island: flat grassy top, rounded hanging bottom. */
export function island(cx: number, top: number, w: number, depth = 70): Point[] {
  const hw = w / 2;
  const pts: Point[] = [[cx - hw, top], [cx + hw, top]];
  const n = 12;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const x = cx + hw - t * w;
    // rounded, slightly pointy bottom
    const k = Math.sin(t * Math.PI);
    const y = top + 14 + k * depth * (0.75 + 0.25 * Math.sin(t * Math.PI * 3) * 0.3);
    pts.push([Math.round(x), Math.round(y)]);
  }
  return pts;
}

/** Axis-aligned rectangle (clockwise). */
export function rect(x: number, y: number, w: number, h: number): Point[] {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

/** Rounded rectangle (used for logs and moving platforms). */
export function roundRect(x: number, y: number, w: number, h: number, r: number, seg = 4): Point[] {
  const pts: Point[] = [];
  const corners: [number, number, number][] = [
    [x + w - r, y + r, -Math.PI / 2],
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, Math.PI / 2],
    [x + r, y + r, Math.PI],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([Math.round((cx + Math.cos(a) * r) * 10) / 10, Math.round((cy + Math.sin(a) * r) * 10) / 10]);
    }
  }
  return pts;
}
