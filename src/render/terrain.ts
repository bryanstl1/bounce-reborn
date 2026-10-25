import * as Phaser from 'phaser';
import { Point, distToSegment, pointInPolygon, polygonBounds, polygonToSegments } from '../physics/geometry';
import type { LevelData, TerrainStyle } from '../level/types';

interface Palette {
  body: number;
  outline: number;
  pattern: number;
  grass: number;
  grassLight: number;
  grassDark: number;
  grassy: boolean;
}

const PALETTES: Record<string, Record<TerrainStyle, Palette>> = {
  forest: {
    ground: { body: 0x2c6b55, outline: 0x143a30, pattern: 0x245c49, grass: 0x5fc43c, grassLight: 0xa9ef5c, grassDark: 0x2e8a2c, grassy: true },
    island: { body: 0x2f6f62, outline: 0x143a30, pattern: 0x275f54, grass: 0x5fc43c, grassLight: 0xa9ef5c, grassDark: 0x2e8a2c, grassy: true },
    rock: { body: 0x4e4a6e, outline: 0x231f3a, pattern: 0x433f60, grass: 0x8a86ad, grassLight: 0xb3afd3, grassDark: 0x3a3656, grassy: true },
    log: { body: 0x9a6236, outline: 0x3b2112, pattern: 0x87532c, grass: 0xc98a4e, grassLight: 0xe6b27a, grassDark: 0x7a4824, grassy: true },
  },
  lab: {
    ground: { body: 0x3f4a6b, outline: 0x1c2238, pattern: 0x37415f, grass: 0x7d8fc7, grassLight: 0xb8c6f0, grassDark: 0x56669b, grassy: true },
    island: { body: 0x3f4a6b, outline: 0x1c2238, pattern: 0x37415f, grass: 0x7d8fc7, grassLight: 0xb8c6f0, grassDark: 0x56669b, grassy: true },
    rock: { body: 0x55507a, outline: 0x231f3a, pattern: 0x4a4570, grass: 0x9a95c4, grassLight: 0xc8c4ea, grassDark: 0x6c6799, grassy: true },
    log: { body: 0x9a6236, outline: 0x3b2112, pattern: 0x87532c, grass: 0xc98a4e, grassLight: 0xe6b27a, grassDark: 0x7a4824, grassy: true },
  },
};

/** Small deterministic PRNG so decorations are identical every run. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export interface Cullable {
  obj: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface SurfaceSpot {
  x: number;
  y: number;
  /** surface angle (radians) */
  a: number;
}

function flat(pts: Point[]): number[] {
  const out: number[] = [];
  for (const [x, y] of pts) out.push(x, y);
  return out;
}

/** Builds vector terrain (crisp at any zoom). Returns objects for culling and grass spots for decoration. */
export function buildTerrain(scene: Phaser.Scene, level: LevelData, depth: number): { cull: Cullable[]; spots: SurfaceSpot[] } {
  const pal = PALETTES[level.theme] ?? PALETTES.forest;
  const cull: Cullable[] = [];
  const spots: SurfaceSpot[] = [];
  const rand = rng(1234 + level.width);
  const addCull = (obj: Cullable['obj'], b: { minX: number; maxX: number; minY: number; maxY: number }) => cull.push({ obj, ...b });

  level.terrain.forEach((piece) => {
    const P = pal[piece.style];
    const pts = piece.points;
    const b = polygonBounds(pts);
    // limit very deep bodies to what can be seen
    const body = scene.add.polygon(0, 0, flat(pts), P.body).setOrigin(0, 0).setDepth(depth);
    body.setStrokeStyle(2.5, P.outline);
    addCull(body, b);

    const segs = polygonToSegments(pts);

    // pattern blobs near the surface
    const step = piece.style === 'log' ? 30 : 64;
    for (let x = b.minX + step / 2; x < b.maxX; x += step) {
      const depthLimit = piece.style === 'rock' ? 2600 : 520;
      for (let y = b.minY + 30; y < Math.min(b.maxY, b.minY + depthLimit); y += step * 0.8) {
        const jx = x + (rand() - 0.5) * step * 0.7;
        const jy = y + (rand() - 0.5) * step * 0.6;
        if (!pointInPolygon(jx, jy, pts)) continue;
        let near = Infinity;
        for (const s of segs) near = Math.min(near, distToSegment(jx, jy, s));
        const r = 6 + rand() * 9;
        if (near < r + 14) continue;
        if (piece.style === 'log') {
          const e = scene.add.ellipse(jx, jy, r * 2.2, r * 0.7, P.pattern).setDepth(depth);
          addCull(e, { minX: jx - r * 2, maxX: jx + r * 2, minY: jy - r, maxY: jy + r });
        } else {
          const e = scene.add.ellipse(jx, jy, r * 2, r * 1.5, P.pattern).setDepth(depth);
          addCull(e, { minX: jx - r, maxX: jx + r, minY: jy - r, maxY: jy + r });
        }
      }
    }

    if (!P.grassy) return;
    // grass bands along runs of up-facing edges
    const n = pts.length;
    const up: boolean[] = [];
    // map segments back to edges (polygonToSegments skips degenerate edges; our shapes have none)
    for (let i = 0; i < n; i++) up.push(segs[i] ? segs[i].ny < -0.42 : false);
    let start = 0;
    while (start < n && up[start]) start++; // begin at a non-grass edge so runs do not wrap
    if (start === n) start = 0;
    let i = 0;
    while (i < n) {
      const e = (start + i) % n;
      if (!up[e]) { i++; continue; }
      const run: number[] = [];
      while (i < n && up[(start + i) % n]) { run.push((start + i) % n); i++; }
      const top: Point[] = [pts[run[0]]];
      for (const ei of run) top.push(pts[(ei + 1) % n]);
      const normals: [number, number][] = top.map((_, k) => {
        const sa = segs[run[Math.max(0, k - 1)]];
        const sb = segs[run[Math.min(run.length - 1, k)]];
        const nx = sa.nx + sb.nx, ny = sa.ny + sb.ny;
        const l = Math.hypot(nx, ny) || 1;
        return [nx / l, ny / l];
      });
      const band = (th: number, color: number, d: number) => {
        const poly: Point[] = top.map((p) => [p[0], p[1]] as Point);
        for (let k = top.length - 1; k >= 0; k--) poly.push([top[k][0] - normals[k][0] * th, top[k][1] - normals[k][1] * th]);
        const bb = polygonBounds(poly);
        const o = scene.add.polygon(0, 0, flat(poly), color).setOrigin(0, 0).setDepth(d);
        addCull(o, bb);
        return o;
      };
      const g1 = band(17, P.grass, depth + 0.1);
      g1.setStrokeStyle(2, P.outline);
      band(6, P.grassLight, depth + 0.2);
      // scalloped drips under the band
      for (let k = 0; k < top.length - 1; k++) {
        const [ax, ay] = top[k];
        const [bx, by] = top[k + 1];
        const len = Math.hypot(bx - ax, by - ay);
        const [nx, ny] = normals[k];
        for (let t = 10; t < len - 6; t += 26 + rand() * 10) {
          const x = ax + ((bx - ax) * t) / len - nx * 16;
          const y = ay + ((by - ay) * t) / len - ny * 16;
          const rr = 5 + rand() * 4;
          const c = scene.add.circle(x, y, rr, P.grass).setDepth(depth + 0.05);
          c.setStrokeStyle(2, P.outline);
          addCull(c, { minX: x - rr, maxX: x + rr, minY: y - rr, maxY: y + rr });
          if (piece.style === 'ground' || piece.style === 'island') {
            const sx = ax + ((bx - ax) * t) / len, sy = ay + ((by - ay) * t) / len;
            spots.push({ x: sx, y: sy, a: Math.atan2(by - ay, bx - ax) });
          }
        }
      }
    }
  });
  return { cull, spots };
}

/** Parallax background layers (vector). */
export function buildBackground(scene: Phaser.Scene, level: LevelData): Cullable[] {
  const out: Cullable[] = [];
  if (level.theme === 'lab') return out;
  const typicalScrollY = level.spawn[1] - 300;
  const layers = [
    { f: 0.1, screenY: 210, color: 0xc9f1e3, amp: 70, wave: 520, depth: -30 },
    { f: 0.22, screenY: 255, color: 0xa3e2cc, amp: 55, wave: 330, depth: -25 },
    { f: 0.4, screenY: 300, color: 0x7bcdb0, amp: 0, wave: 0, depth: -20, trees: true },
    { f: 0.62, screenY: 375, color: 0x52b38f, amp: 22, wave: 160, depth: -15 },
  ];
  for (const L of layers) {
    const baseY = typicalScrollY * L.f + L.screenY;
    const x0 = -1600;
    const x1 = (level.width - 400) * L.f + 3200;
    const pts: number[] = [];
    if (L.trees) {
      // rounded canopy silhouettes
      pts.push(x0, baseY + 900);
      for (let x = x0; x <= x1; x += 18) {
        const k = Math.sin(x / 47) * 0.5 + Math.sin(x / 113 + 1) * 0.5;
        const bump = Math.abs(Math.sin(x / 38)) * 26;
        pts.push(x, baseY - 30 - k * 35 - bump);
      }
      pts.push(x1, baseY + 900);
    } else {
      pts.push(x0, baseY + 900);
      for (let x = x0; x <= x1; x += 24) {
        const y = baseY - Math.sin(x / L.wave) * L.amp - Math.sin(x / (L.wave * 0.37) + 2) * L.amp * 0.35;
        pts.push(x, y);
      }
      pts.push(x1, baseY + 900);
    }
    const poly = scene.add.polygon(0, 0, pts, L.color).setOrigin(0, 0).setScrollFactor(L.f, L.f).setDepth(L.depth);
    void poly;
  }
  return out;
}
