import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../../src/level/registry';
import { DEFAULT_PARAMS } from '../../src/physics/params';
import { pointInPolygon } from '../../src/physics/geometry';
import { solveLevel } from '../../src/sim/solver';

for (const level of LEVELS.filter((l) => l.theme !== 'lab')) {
  test(`${level.id}: has every required element`, () => {
    assert.ok(level.eggs.length >= 10, 'collectibles');
    assert.ok(level.spikes.length >= 1, 'obstacles');
    assert.ok(level.enemies.length >= 1, 'enemy');
    assert.ok(level.platforms.length >= 1, 'moving platform');
    assert.ok(level.checkpoints.length >= 1, 'checkpoint');
    assert.ok(level.goal[0] > level.spawn[0], 'goal after spawn');
  });

  test(`${level.id}: spawn, eggs and checkpoints are not inside solid terrain`, () => {
    const pts: [string, number, number][] = [
      ['spawn', level.spawn[0], level.spawn[1]],
      ...level.eggs.map((e, i) => [`egg ${i}`, e[0], e[1]] as [string, number, number]),
      ...level.checkpoints.map((c, i) => [`checkpoint ${i}`, c[0], c[1] - 30] as [string, number, number]),
      ['goal', level.goal[0], level.goal[1] - 30],
    ];
    for (const [name, x, y] of pts) {
      for (const t of level.terrain) assert.ok(!pointInPolygon(x, y, t.points), `${name} (${x},${y}) is inside terrain`);
    }
  });

  test(`${level.id}: can be completed start to finish without dying (beam search over the real simulation)`, () => {
    const res = solveLevel(level, DEFAULT_PARAMS, { beam: 90, maxSeconds: 150 });
    assert.ok(res.ok, `not solvable, furthest x reached: ${res.bestX.toFixed(0)}`);
    console.log(`  ${level.id}: solved in ${res.time.toFixed(1)}s game time, ${res.eggs}/${level.eggs.length} eggs on the way, ${res.expanded} expansions`);
  });
}
