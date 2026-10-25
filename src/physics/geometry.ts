export interface Vec {
  x: number;
  y: number;
}

export type Point = [number, number];

/** A collision segment. The normal points out of the solid. */
export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** unit direction a->b */
  dx: number;
  dy: number;
  len: number;
  /** outward unit normal */
  nx: number;
  ny: number;
}

export function makeSegment(ax: number, ay: number, bx: number, by: number, nx: number, ny: number): Segment {
  const ex = bx - ax;
  const ey = by - ay;
  const len = Math.hypot(ex, ey) || 1;
  return { ax, ay, bx, by, dx: ex / len, dy: ey / len, len, nx, ny };
}

/** Signed area (positive = clockwise on screen, because y points down). */
export function signedArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/**
 * Converts a closed polygon into segments with outward normals.
 * Works for both windings.
 */
export function polygonToSegments(pts: Point[], ox = 0, oy = 0): Segment[] {
  const segs: Segment[] = [];
  const cw = signedArea(pts) > 0; // clockwise in screen space (y down)
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const ex = bx - ax;
    const ey = by - ay;
    const len = Math.hypot(ex, ey);
    if (len < 1e-6) continue;
    // For a clockwise polygon on a y-down screen, the outward normal of edge e is (ey, -ex)/len.
    let nx = ey / len;
    let ny = -ex / len;
    if (!cw) {
      nx = -nx;
      ny = -ny;
    }
    segs.push(makeSegment(ax + ox, ay + oy, bx + ox, by + oy, nx, ny));
  }
  return segs;
}

export function polygonBounds(pts: Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function pointInPolygon(x: number, y: number, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from a point to a segment. */
export function distToSegment(px: number, py: number, s: Segment): number {
  let t = (px - s.ax) * s.dx + (py - s.ay) * s.dy;
  if (t < 0) t = 0;
  else if (t > s.len) t = s.len;
  return Math.hypot(px - (s.ax + s.dx * t), py - (s.ay + s.dy * t));
}

export function circleRectOverlap(cx: number, cy: number, r: number, x: number, y: number, w: number, h: number): boolean {
  const nx = Math.max(x, Math.min(cx, x + w));
  const ny = Math.max(y, Math.min(cy, y + h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function approach(v: number, target: number, delta: number): number {
  if (v < target) return Math.min(v + delta, target);
  if (v > target) return Math.max(v - delta, target);
  return v;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Catmull-Rom smoothing of an open polyline (keeps end points). */
export function smoothPolyline(pts: Point[], segmentsPerSpan = 6): Point[] {
  if (pts.length < 3) return pts.slice();
  const out: Point[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < segmentsPerSpan; s++) {
      const t = s / segmentsPerSpan;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
