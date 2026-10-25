import { smoothPolyline, Point } from '../../physics/geometry';
import { ground, island, rect, roundRect } from '../shapes';
import type { LevelData } from '../types';

/**
 * Nivel 1 — "Bosque Brillante". Original layout.
 * Coordinates: x right, y down. Main ground line GY = 800. Ball radius = 24.
 */
const GY = 800;
const BOTTOM = 1500;

const slopeDown: Point[] = smoothPolyline([[2900, 540], [3000, 560], [3150, 700], [3250, 790], [3320, GY]], 8);

export const forest01: LevelData = {
  id: 'forest-01',
  name: 'Bosque Brillante',
  subtitle: 'Mundo 1 · Nivel 1',
  theme: 'forest',
  width: 6900,
  height: 1300,
  spawn: [160, GY - 26],
  killY: 1180,
  lives: 3,
  parTime: 60,
  terrain: [
    { style: 'rock', points: rect(-400, -800, 400, 2400) },
    // A — start meadow, hill and plateau
    { style: 'ground', points: ground([[0, GY], [600, GY], [760, 765], [900, 690], [1010, 680], [1350, 680]], BOTTOM, true) },
    { style: 'log', points: roundRect(1080, 612, 92, 68, 18) },
    // B — meadow with spikes, spring wall, high ledge and the long slope down
    { style: 'ground', points: ground([[1500, GY], [2440, GY], [2440, 540], ...slopeDown, [3750, GY]], BOTTOM) },
    // C — landing after the moving platform
    { style: 'ground', points: ground([[4350, GY], [4600, GY]], BOTTOM) },
    // D — floating islands (jump section)
    { style: 'island', points: island(4760, 730, 150) },
    { style: 'island', points: island(5010, 650, 130) },
    { style: 'island', points: island(5270, 710, 150) },
    { style: 'island', points: island(5520, 620, 130) },
    // bonus island reached with the lift
    { style: 'island', points: island(5990, 330, 140, 60) },
    // E — final meadow and goal
    { style: 'ground', points: ground([[5700, 680], [6700, 680]], BOTTOM) },
    { style: 'rock', points: rect(6700, -800, 400, 2400) },
  ],
  platforms: [
    // horizontal: crosses the chasm between B and C
    { shape: roundRect(-75, 0, 150, 26, 12), path: [[3850, GY], [4250, GY]], period: 7 },
    // vertical lift to the bonus island
    { shape: roundRect(-60, 0, 120, 24, 11), path: [[5850, 600], [5850, 360]], period: 6, phase: 0.5 },
  ],
  spikes: [
    { x: 1700, y: GY, length: 96, dir: 'up' },
    { x: 2150, y: GY, length: 264, dir: 'up' },
    { x: 6270, y: 680, length: 72, dir: 'up' },
  ],
  eggs: [
    [300, GY - 40], [380, GY - 40], [460, GY - 40],
    [850, 675],
    [1126, 560],
    [1425, 700],
    [1570, GY - 40], [1620, GY - 40],
    [1700, 690], [1750, 662], [1800, 690],
    [2091, 575], [2192, 448], [2292, 364],
    [2560, 500], [2620, 500],
    [2980, 515], [3080, 590], [3180, 690],
    [3550, 690],
    [4050, 740], [4150, 740],
    [4760, 690], [5010, 610], [5270, 670], [5520, 580],
    [5850, 312], [5960, 290], [6020, 290],
    [6150, 600], [6306, 600], [6450, 640],
  ],
  enemies: [
    { type: 'beetle', x: 3550, y: GY, minX: 3420, maxX: 3690, speed: 70 },
    { type: 'beetle', x: 6100, y: 680, minX: 6020, maxX: 6230, speed: 85 },
  ],
  springs: [{ x: 1990, y: GY, power: 640 }],
  checkpoints: [[2700, 540], [4470, GY], [5780, 680]],
  goal: [6560, 680],
  hints: [
    { x: 230, y: 690, text: '← →  rodar', only: 'keys' },
    { x: 230, y: 690, text: '◀ ▶  rodar', only: 'touch' },
    { x: 1000, y: 560, text: 'Salta  ⤒', },
    { x: 1560, y: 660, text: 'Mantén SALTAR para rebotar' },
    { x: 1990, y: 700, text: '¡Resorte!' },
    { x: 3700, y: 690, text: '¡Súbete!' },
  ],
  deco: [
    { type: 'tree', x: 90, y: GY, scale: 1.1 },
    { type: 'bush', x: 560, y: GY, v: 1 },
    { type: 'mushroom', x: 640, y: GY - 6, scale: 0.9, v: 0 },
    { type: 'tree', x: 1270, y: 680, scale: 0.9, v: 1 },
    { type: 'flower', x: 980, y: 683, v: 2 },
    { type: 'sign', x: 1655, y: GY, text: '!' },
    { type: 'sign', x: 2120, y: GY, text: '!' },
    { type: 'fern', x: 1560, y: GY },
    { type: 'tree', x: 1640, y: GY, scale: 1.2, v: 2 },
    { type: 'crystal', x: 1880, y: GY, scale: 0.9 },
    
    { type: 'tree', x: 2520, y: 540, scale: 0.8, v: 0 },
    { type: 'flower', x: 2860, y: 540, v: 0 },
    { type: 'mushroom', x: 3380, y: GY - 4, scale: 1.2, v: 1 },
    { type: 'sign', x: 3720, y: GY, text: '→' },
    { type: 'tree', x: 4560, y: GY, scale: 1, v: 1 },
    { type: 'fern', x: 4420, y: GY, flip: true },
    { type: 'flower', x: 4790, y: 730, v: 1 },
    { type: 'flower', x: 5300, y: 710, v: 2 },
    { type: 'crystal', x: 5740, y: 680, scale: 0.8 },
    { type: 'pine', x: 6000, y: 330, scale: 0.7 },
    { type: 'bush', x: 5960, y: 680, v: 1 },
    { type: 'tree', x: 6640, y: 680, scale: 1.1, v: 2 },
    { type: 'rock', x: 6380, y: 680, scale: 0.9 },
    { type: 'grass', x: 5100, y: 650, front: true },
  ],
};
