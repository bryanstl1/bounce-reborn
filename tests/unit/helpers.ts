import type { BallInput } from '../../src/physics/ball';
import type { Point } from '../../src/physics/geometry';
import type { LevelData, PlatformDef } from '../../src/level/types';
import { LevelSim } from '../../src/sim/LevelSim';
import { DEFAULT_PARAMS, PhysicsParams } from '../../src/physics/params';

export function input(o: Partial<BallInput> = {}): BallInput {
  return { left: false, right: false, jumpHeld: false, jumpPressed: false, ...o };
}

export function testLevel(terrain: Point[][], extra: Partial<LevelData> = {}): LevelData {
  return {
    id: 'test', name: 'test', subtitle: '', theme: 'lab', width: 4000, height: 2000,
    spawn: [100, 700], killY: 5000, lives: 3, parTime: 60,
    terrain: terrain.map((points) => ({ points, style: 'ground' as const })),
    platforms: [] as PlatformDef[], spikes: [], eggs: [], enemies: [], springs: [],
    checkpoints: [], goal: [99999, 0], deco: [], hints: [],
    ...extra,
  };
}

export function makeSim(level: LevelData, params: Partial<PhysicsParams> = {}) {
  return new LevelSim(level, { ...DEFAULT_PARAMS, ...params });
}

export function run(sim: LevelSim, seconds: number, inp: BallInput | ((t: number) => BallInput)) {
  const steps = Math.round(seconds * 120);
  for (let i = 0; i < steps; i++) {
    sim.step(typeof inp === 'function' ? inp(i / 120) : inp);
  }
}
