import { test } from 'node:test';
import assert from 'node:assert/strict';
import { input, makeSim, run, testLevel } from './helpers';
import { rect, roundRect } from '../../src/level/shapes';
import { DEFAULT_PARAMS, derived } from '../../src/physics/params';
import type { Point } from '../../src/physics/geometry';

const R = DEFAULT_PARAMS.radius;
const FLAT = rect(-1000, 800, 6000, 400);

test('ball falls and rests on flat ground', () => {
  const sim = makeSim(testLevel([FLAT]));
  run(sim, 2, input());
  const b = sim.state.ball;
  assert.ok(b.grounded, 'grounded');
  assert.ok(Math.abs(b.y - (800 - R)) < 1.5, `y=${b.y}`);
  assert.ok(Math.abs(b.vy) < 5, `vy=${b.vy}`);
});

test('landing from height bounces, then settles', () => {
  const sim = makeSim(testLevel([FLAT], { spawn: [100, 400] }));
  const ev: string[] = [];
  for (let i = 0; i < 240; i++) {
    sim.step(input());
    for (const e of sim.events) ev.push(e.type);
    sim.events.length = 0;
  }
  assert.ok(ev.includes('bounce'), 'should bounce on impact');
  assert.ok(sim.state.ball.grounded, 'settles');
});

test('horizontal acceleration is gradual and capped at maxSpeed', () => {
  const sim = makeSim(testLevel([FLAT], { spawn: [100, 800 - R] }));
  run(sim, 0.5, input());
  run(sim, 0.1, input({ right: true }));
  const early = sim.state.ball.vx;
  assert.ok(early > 50 && early < DEFAULT_PARAMS.maxSpeed * 0.6, `gradual: ${early}`);
  run(sim, 2, input({ right: true }));
  assert.ok(Math.abs(sim.state.ball.vx - DEFAULT_PARAMS.maxSpeed) < 2, `capped: ${sim.state.ball.vx}`);
});

test('inertia: releasing input keeps rolling for a while, then friction stops it', () => {
  const sim = makeSim(testLevel([FLAT], { spawn: [100, 800 - R] }));
  run(sim, 2, input({ right: true }));
  const x0 = sim.state.ball.x;
  run(sim, 0.2, input());
  assert.ok(sim.state.ball.vx > 100, 'still moving after release');
  run(sim, 2, input());
  assert.ok(Math.abs(sim.state.ball.vx) < 1, 'stopped by friction');
  const slide = sim.state.ball.x - x0;
  const expected = (DEFAULT_PARAMS.maxSpeed ** 2) / (2 * DEFAULT_PARAMS.groundDecel);
  assert.ok(Math.abs(slide - expected) < 15, `slide ${slide} ~ ${expected}`);
});

test('jump apex matches v^2/2g', () => {
  const sim = makeSim(testLevel([FLAT], { spawn: [100, 800 - R] }));
  run(sim, 0.5, input());
  const y0 = sim.state.ball.y;
  sim.step(input({ jumpPressed: true, jumpHeld: true }));
  let minY = y0;
  for (let i = 0; i < 200; i++) {
    sim.step(input({ jumpHeld: i < 100 }));
    minY = Math.min(minY, sim.state.ball.y);
  }
  const h = y0 - minY;
  const expected = derived(DEFAULT_PARAMS).jumpHeight;
  assert.ok(Math.abs(h - expected) / expected < 0.04, `apex ${h} vs ${expected}`);
});

test('variable jump: short tap jumps lower than held jump', () => {
  const heights: number[] = [];
  for (const holdSteps of [6, 100]) {
    const sim = makeSim(testLevel([FLAT], { spawn: [100, 800 - R] }), { autoJump: false });
    run(sim, 0.5, input());
    const y0 = sim.state.ball.y;
    sim.step(input({ jumpPressed: true, jumpHeld: true }));
    let minY = y0;
    for (let i = 0; i < 160; i++) {
      sim.step(input({ jumpHeld: i < holdSteps }));
      minY = Math.min(minY, sim.state.ball.y);
    }
    heights.push(y0 - minY);
  }
  assert.ok(heights[0] < heights[1] * 0.65, `tap ${heights[0]} vs hold ${heights[1]}`);
});

test('jump buffer: pressing just before landing still jumps', () => {
  const sim = makeSim(testLevel([FLAT], { spawn: [100, 800 - R - 60] }), { autoJump: false });
  let jumped = false;
  // fall ~60px; press jump while still in the air (~5 steps before contact)
  for (let i = 0; i < 120; i++) {
    const b = sim.state.ball;
    const press = !jumped && b.vy > 0 && b.y > 800 - R - 12 && b.y < 800 - R - 2;
    sim.step(input({ jumpPressed: press, jumpHeld: press }));
    if (sim.events.some((e) => e.type === 'jump')) jumped = true;
    sim.events.length = 0;
  }
  assert.ok(jumped, 'buffered jump fired');
});

test('walls stop the ball (no tunnelling at max speed)', () => {
  const sim = makeSim(testLevel([FLAT, rect(600, 500, 40, 300)], { spawn: [100, 800 - R] }));
  run(sim, 4, input({ right: true }));
  assert.ok(sim.state.ball.x <= 600 - R + 1, `x=${sim.state.ball.x}`);
});

test('thin platform does not let a fast falling ball through', () => {
  const sim = makeSim(testLevel([rect(0, 900, 400, 14)], { spawn: [200, -800] }));
  run(sim, 5, input());
  assert.ok(sim.state.ball.y < 900, `y=${sim.state.ball.y}`);
  assert.ok(sim.state.ball.grounded);
});

function slope(deg: number): Point[] {
  const a = (deg * Math.PI) / 180;
  const len = 1200;
  return [[0, 800], [len, 800 - Math.tan(a) * len], [len, 1400], [0, 1400]];
}

test('gentle slope (15°): ball rests when idle; steep slope (40°): ball rolls down', () => {
  const gentle = makeSim(testLevel([slope(15)], { spawn: [600, 400] }));
  run(gentle, 3, input());
  const x1 = gentle.state.ball.x;
  run(gentle, 2, input());
  assert.ok(Math.abs(gentle.state.ball.x - x1) < 3, 'stays on 15°');

  const steep = makeSim(testLevel([slope(40)], { spawn: [600, 100] }));
  run(steep, 3, input());
  assert.ok(steep.state.ball.x < 560, `rolled down: ${steep.state.ball.x}`);
});

test('ball can climb a 30° slope with input', () => {
  const sim = makeSim(testLevel([slope(30)], { spawn: [80, 700] }));
  run(sim, 4, input({ right: true }));
  assert.ok(sim.state.ball.x > 700, `x=${sim.state.ball.x}`);
});

test('moving platform carries the ball', () => {
  const lvl = testLevel([], {
    spawn: [500, 760],
    platforms: [{ shape: roundRect(-80, 0, 160, 24, 10), path: [[500, 800], [900, 800]], period: 8 }],
  });
  const sim = makeSim(lvl);
  run(sim, 4, input()); // half period: platform reached the far end
  const b = sim.state.ball;
  assert.ok(b.grounded, 'on platform');
  assert.ok(Math.abs(b.x - sim.platforms[0].x) < 30, `ball ${b.x} platform ${sim.platforms[0].x}`);
  assert.ok(sim.platforms[0].x > 880);
});

test('heavy and light forms change jump height', () => {
  const h: Record<string, number> = {};
  for (const form of ['normal', 'heavy', 'light'] as const) {
    const sim = makeSim(testLevel([FLAT], { spawn: [100, 800 - R] }));
    sim.setForm(form);
    run(sim, 0.5, input());
    const y0 = sim.state.ball.y;
    sim.step(input({ jumpPressed: true, jumpHeld: true }));
    let minY = y0;
    for (let i = 0; i < 300; i++) {
      sim.step(input({ jumpHeld: i < 200 }));
      minY = Math.min(minY, sim.state.ball.y);
    }
    h[form] = y0 - minY;
  }
  assert.ok(h.heavy < h.normal && h.light > h.normal, JSON.stringify(h));
});
