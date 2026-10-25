import { Point, Segment, polygonToSegments } from './geometry';

/** A solid that moves along a path (kinematic). */
export interface MovingSolid {
  id: number;
  /** polygon points relative to the solid origin */
  shape: Point[];
  /** segments relative to the origin (offset applied at query time) */
  localSegs: Segment[];
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Contact {
  seg: Segment;
  /** -1 for static geometry, otherwise MovingSolid.id */
  owner: number;
  /** offset to apply to the segment (moving solids) */
  ox: number;
  oy: number;
}

const CELL = 128;

/**
 * Static collision geometry stored in a uniform grid for fast queries,
 * plus a small list of moving solids.
 */
export class CollisionWorld {
  readonly segments: Segment[] = [];
  private grid = new Map<number, number[]>();
  readonly movers: MovingSolid[] = [];

  addPolygon(pts: Point[]) {
    for (const s of polygonToSegments(pts)) this.addSegment(s);
  }

  addSegment(s: Segment) {
    const idx = this.segments.push(s) - 1;
    const minX = Math.floor((Math.min(s.ax, s.bx) - 2) / CELL);
    const maxX = Math.floor((Math.max(s.ax, s.bx) + 2) / CELL);
    const minY = Math.floor((Math.min(s.ay, s.by) - 2) / CELL);
    const maxY = Math.floor((Math.max(s.ay, s.by) + 2) / CELL);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const key = this.key(cx, cy);
        let list = this.grid.get(key);
        if (!list) this.grid.set(key, (list = []));
        list.push(idx);
      }
    }
  }

  addMover(id: number, shape: Point[], x: number, y: number): MovingSolid {
    const m: MovingSolid = { id, shape, localSegs: polygonToSegments(shape), x, y, vx: 0, vy: 0 };
    this.movers.push(m);
    return m;
  }

  private key(cx: number, cy: number) {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  private stamp = 0;
  private seen = new Uint32Array(0);

  /** Collects contacts candidates near (x, y) within radius r. */
  query(x: number, y: number, r: number, out: Contact[]): Contact[] {
    out.length = 0;
    if (this.seen.length < this.segments.length) this.seen = new Uint32Array(this.segments.length + 64);
    this.stamp++;
    const minX = Math.floor((x - r) / CELL);
    const maxX = Math.floor((x + r) / CELL);
    const minY = Math.floor((y - r) / CELL);
    const maxY = Math.floor((y + r) / CELL);
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const list = this.grid.get(this.key(cx, cy));
        if (!list) continue;
        for (const i of list) {
          if (this.seen[i] === this.stamp) continue;
          this.seen[i] = this.stamp;
          out.push({ seg: this.segments[i], owner: -1, ox: 0, oy: 0 });
        }
      }
    }
    for (const m of this.movers) {
      for (const s of m.localSegs) out.push({ seg: s, owner: m.id, ox: m.x, oy: m.y });
    }
    return out;
  }

  mover(id: number): MovingSolid | undefined {
    for (const m of this.movers) if (m.id === id) return m;
    return undefined;
  }
}
