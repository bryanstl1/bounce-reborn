import { ground, rect, roundRect } from '../shapes';
import type { LevelData } from '../types';

/**
 * Laboratorio de físicas: test course to compare and tune movement.
 * Every section isolates one behaviour; distances are multiples of the ball diameter (48).
 */
const GY = 800;
const B = 1500;
const D = 48;

export const lab: LevelData = {
  id: 'lab',
  name: 'Laboratorio de físicas',
  subtitle: 'Prueba y ajusta la sensación',
  theme: 'lab',
  width: 6200,
  height: 1300,
  spawn: [160, GY - 26],
  killY: 1180,
  lives: 99,
  parTime: 999,
  terrain: [
    { style: 'rock', points: rect(-400, -800, 400, 2400) },
    // flat runway (acceleration / inertia), then 15° ramp up, plateau, 30° ramp down
    { style: 'ground', points: ground([[0, GY], [900, GY], [1300, GY - 107], [1500, GY - 107], [1685, GY], [2200, GY]], B) },
    // steps 1D, 2D, 3D high
    { style: 'rock', points: rect(1750, GY - D, 100, D) },
    { style: 'rock', points: rect(1900, GY - 2 * D, 100, 2 * D) },
    { style: 'rock', points: rect(2050, GY - 3 * D, 100, 3 * D) },
    // 45° ramp
    { style: 'ground', points: ground([[2200, GY], [2400, GY - 200], [2600, GY - 200], [2600, GY]], B) },
    // gap course: gaps of 2D, 3D, 4D, 5D, 6D
    { style: 'ground', points: ground([[2600, GY], [2800, GY]], B) },
    { style: 'ground', points: ground([[2800 + 2 * D, GY], [3000 + 2 * D, GY]], B) },
    { style: 'ground', points: ground([[3000 + 5 * D, GY], [3200 + 5 * D, GY]], B) },
    { style: 'ground', points: ground([[3200 + 9 * D, GY], [3400 + 9 * D, GY]], B) },
    { style: 'ground', points: ground([[3400 + 14 * D, GY], [3600 + 14 * D, GY]], B) },
    { style: 'ground', points: ground([[3600 + 20 * D, GY], [5200, GY]], B) },
    // bounce wall
    { style: 'rock', points: rect(5200, 200, 60, 600) },
    { style: 'rock', points: rect(5260, GY - 20, 900, 20 + 700) },
    { style: 'rock', points: rect(6160, -800, 400, 2400) },
  ],
  platforms: [
    { shape: roundRect(-70, 0, 140, 24, 10), path: [[4700, 640], [5000, 640]], period: 6 },
    { shape: roundRect(-60, 0, 120, 24, 10), path: [[4520, 760], [4520, 480]], period: 5 },
  ],
  spikes: [{ x: 4300, y: GY, length: 96, dir: 'up' }],
  eggs: [[600, GY - 40], [640, GY - 40], [680, GY - 40]],
  enemies: [{ type: 'beetle', x: 4100, y: GY, minX: 4000, maxX: 4200, speed: 70 }],
  springs: [{ x: 5500, y: GY - 20, power: 700 }],
  checkpoints: [],
  goal: [99999, 0],
  formPads: [
    { x: 5700, y: GY - 20, form: 'heavy' },
    { x: 5850, y: GY - 20, form: 'light' },
    { x: 6000, y: GY - 20, form: 'normal' },
  ],
  hints: [
    { x: 450, y: 700, text: 'Pista plana · aceleración e inercia' },
    { x: 1300, y: 620, text: 'Rampa 15° / 30°' },
    { x: 1950, y: 600, text: 'Escalones 1D · 2D · 3D' },
    { x: 2400, y: 520, text: 'Rampa 45°' },
    { x: 3300, y: 640, text: 'Huecos 2D · 3D · 4D · 5D · 6D' },
    { x: 4300, y: 660, text: 'Peligros (invencible)' },
    { x: 4760, y: 440, text: 'Plataformas móviles' },
    { x: 5500, y: 560, text: 'Resorte' },
    { x: 5850, y: 640, text: 'Formas: pesada · ligera · normal' },
  ],
  deco: [],
};
