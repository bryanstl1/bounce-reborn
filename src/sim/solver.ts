import type { BallInput } from '../physics/ball';
import type { LevelData } from '../level/types';
import { LevelSim, SimState } from './LevelSim';
import type { PhysicsParams } from '../physics/params';

/** One macro action, held for `STEPS_PER_ACTION` fixed steps. */
export type Action = 0 | 1 | 2 | 3 | 4 | 5; // dir (-1,0,1) x jump (no,yes)
export const STEPS_PER_ACTION = 12;

export function actionInput(a: Action, prevA: Action | null, stepInAction: number): BallInput {
  const dir = (a % 3) - 1;
  const jump = a >= 3;
  const prevJump = prevA !== null && prevA >= 3;
  return {
    left: dir < 0,
    right: dir > 0,
    jumpHeld: jump,
    jumpPressed: jump && !prevJump && stepInAction === 0,
  };
}

interface Node {
  snap: SimState;
  actions: Action[];
  score: number;
}

export interface SolveResult {
  ok: boolean;
  actions: Action[];
  time: number;
  eggs: number;
  bestX: number;
  expanded: number;
}

/**
 * Beam search over macro actions using the deterministic simulation.
 * Used by the tests to prove a level can be completed from start to finish
 * without dying, and to produce a replay for the browser test.
 */
export function solveLevel(level: LevelData, params: PhysicsParams, opts: { beam?: number; maxSeconds?: number } = {}): SolveResult {
  const beam = opts.beam ?? 120;
  const maxLayers = Math.ceil((opts.maxSeconds ?? 120) / (STEPS_PER_ACTION / 120));
  const sim = new LevelSim(level, params);
  let layer: Node[] = [{ snap: sim.snapshot(), actions: [], score: 0 }];
  let bestX = -Infinity;
  let expanded = 0;
  const cell = 14;
  for (let depth = 0; depth < maxLayers; depth++) {
    const next = new Map<string, Node>();
    for (const node of layer) {
      const prev = node.actions.length ? node.actions[node.actions.length - 1] : null;
      for (let a = 0 as Action; a <= 5; a = (a + 1) as Action) {
        sim.restore(node.snap);
        let dead = false;
        for (let i = 0; i < STEPS_PER_ACTION; i++) {
          sim.step(actionInput(a, prev, i));
          if (sim.state.status !== 'playing') break;
        }
        sim.events.length = 0;
        expanded++;
        const st = sim.state;
        if (st.status === 'dying' || st.status === 'gameover') dead = true;
        if (dead) continue;
        const actions = node.actions.concat(a);
        if (st.status === 'won') {
          let eggs = 0;
          for (const e of st.eggs) if (e) eggs++;
          return { ok: true, actions, time: st.time, eggs, bestX: st.ball.x, expanded };
        }
        const b = st.ball;
        if (b.x > bestX) bestX = b.x;
        const score = b.x + st.checkpoint * 400 - Math.max(0, b.y - 900) * 0.5;
        const key = `${Math.round(b.x / cell)},${Math.round(b.y / cell)},${Math.round(b.vx / 90)},${Math.round(b.vy / 200)}`;
        const old = next.get(key);
        if (!old || old.score < score) next.set(key, { snap: sim.snapshot(), actions, score });
      }
    }
    if (next.size === 0) break;
    // Keep diversity: a few nodes per horizontal bucket survive even if others got further,
    // so states that wait for a moving platform are not crowded out by doomed ones.
    const sorted = [...next.values()].sort((p, q) => q.score - p.score);
    const perBucket = new Map<number, number>();
    const picked: Node[] = [];
    const rest: Node[] = [];
    for (const n of sorted) {
      const bk = Math.floor(n.snap.ball.x / 96);
      const c = perBucket.get(bk) ?? 0;
      if (c < 6) { perBucket.set(bk, c + 1); picked.push(n); } else rest.push(n);
    }
    layer = picked.slice(0, beam);
    for (const n of rest) { if (layer.length >= beam) break; layer.push(n); }
  }
  return { ok: false, actions: [], time: 0, eggs: 0, bestX, expanded };
}
