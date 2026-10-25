import { BallEvent, BallInput, BallState, createBall, stepBall } from '../physics/ball';
import { circleRectOverlap } from '../physics/geometry';
import { BallForm, PhysicsParams, paramsForForm } from '../physics/params';
import { CollisionWorld } from '../physics/world';
import type { LevelData, PlatformDef } from '../level/types';

export const FIXED_DT = 1 / 120;

export const SPIKE_HEIGHT = 24;
export const ENEMY_W = 46;
export const ENEMY_H = 30;
export const SPRING_W = 56;
export const SPRING_H = 30;
export const EGG_RADIUS = 13;

export type SimStatus = 'playing' | 'dying' | 'won' | 'gameover';
export type DeathCause = 'spikes' | 'enemy' | 'fall' | 'crushed';

export type SimEvent =
  | BallEvent
  | { type: 'egg'; index: number; x: number; y: number }
  | { type: 'checkpoint'; index: number; x: number; y: number }
  | { type: 'spring'; index: number; x: number; y: number }
  | { type: 'stomp'; index: number; x: number; y: number }
  | { type: 'death'; cause: DeathCause; x: number; y: number }
  | { type: 'respawn'; x: number; y: number }
  | { type: 'form'; form: BallForm; x: number; y: number }
  | { type: 'win'; x: number; y: number }
  | { type: 'gameover' };

export interface EnemyState {
  x: number;
  dir: number;
  alive: boolean;
  /** seconds since squashed (for the death animation) */
  deadT: number;
}

export interface PlatformState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Everything that changes while playing. Cloneable for search/replays. */
export interface SimState {
  ball: BallState;
  form: BallForm;
  status: SimStatus;
  time: number;
  deathTimer: number;
  lives: number;
  eggs: boolean[];
  checkpoint: number;
  enemies: EnemyState[];
  springT: number[];
  steps: number;
}

function platformPos(def: PlatformDef, t: number): [number, number] {
  const path = def.path;
  if (path.length === 1) return [path[0][0], path[0][1]];
  const ph = t / def.period + (def.phase ?? 0);
  const u = (1 - Math.cos(2 * Math.PI * ph)) / 2; // 0..1..0 eased
  // arc length along polyline
  let total = 0;
  const lens: number[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const l = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
    lens.push(l);
    total += l;
  }
  let d = u * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const k = lens[i] === 0 ? 0 : Math.min(1, d / lens[i]);
      return [path[i][0] + (path[i + 1][0] - path[i][0]) * k, path[i][1] + (path[i + 1][1] - path[i][1]) * k];
    }
    d -= lens[i];
  }
  return [path[0][0], path[0][1]];
}

export class LevelSim {
  readonly level: LevelData;
  readonly world = new CollisionWorld();
  baseParams: PhysicsParams;
  params: PhysicsParams;
  state: SimState;
  readonly events: SimEvent[] = [];
  readonly platforms: PlatformState[];
  /** disable deaths (lab) */
  invincible = false;
  private ballEvents: BallEvent[] = [];

  constructor(level: LevelData, params: PhysicsParams) {
    this.level = level;
    this.baseParams = { ...params };
    this.params = paramsForForm(this.baseParams, 'normal');
    for (const t of level.terrain) this.world.addPolygon(t.points);
    this.platforms = level.platforms.map((p, i) => {
      const [x, y] = platformPos(p, 0);
      this.world.addMover(i, p.shape, x, y);
      return { x, y, vx: 0, vy: 0 };
    });
    this.state = this.freshState();
  }

  private freshState(): SimState {
    const [sx, sy] = this.level.spawn;
    return {
      ball: createBall(sx, sy),
      form: 'normal',
      status: 'playing',
      time: 0,
      deathTimer: 0,
      lives: this.level.lives,
      eggs: this.level.eggs.map(() => false),
      checkpoint: -1,
      enemies: this.level.enemies.map((e) => ({ x: (e.minX + e.maxX) / 2, dir: 1, alive: true, deadT: 0 })),
      springT: this.level.springs.map(() => 99),
      steps: 0,
    };
  }

  reset() {
    this.state = this.freshState();
    this.params = paramsForForm(this.baseParams, 'normal');
    this.syncPlatforms();
  }

  setParams(p: PhysicsParams) {
    this.baseParams = { ...p };
    this.params = paramsForForm(this.baseParams, this.state.form);
  }

  setForm(form: BallForm) {
    this.state.form = form;
    this.params = paramsForForm(this.baseParams, form);
  }

  get eggsCollected(): number {
    let n = 0;
    for (const e of this.state.eggs) if (e) n++;
    return n;
  }

  /** Deep copy of the dynamic state. */
  snapshot(): SimState {
    const s = this.state;
    return {
      ...s,
      ball: { ...s.ball },
      eggs: s.eggs.slice(),
      enemies: s.enemies.map((e) => ({ ...e })),
      springT: s.springT.slice(),
    };
  }

  restore(snap: SimState) {
    this.state = {
      ...snap,
      ball: { ...snap.ball },
      eggs: snap.eggs.slice(),
      enemies: snap.enemies.map((e) => ({ ...e })),
      springT: snap.springT.slice(),
    };
    this.params = paramsForForm(this.baseParams, this.state.form);
    this.syncPlatforms();
  }

  private syncPlatforms() {
    const t = this.state.time;
    this.level.platforms.forEach((def, i) => {
      const [x, y] = platformPos(def, t);
      const [px, py] = platformPos(def, t - FIXED_DT);
      const ps = this.platforms[i];
      ps.x = x; ps.y = y; ps.vx = (x - px) / FIXED_DT; ps.vy = (y - py) / FIXED_DT;
      const m = this.world.movers[i];
      m.x = x; m.y = y; m.vx = ps.vx; m.vy = ps.vy;
    });
  }

  respawnPoint(): [number, number] {
    const s = this.state;
    if (s.checkpoint >= 0) {
      const [cx, cy] = this.level.checkpoints[s.checkpoint];
      return [cx, cy - this.params.radius - 2];
    }
    return [this.level.spawn[0], this.level.spawn[1]];
  }

  step(input: BallInput) {
    const s = this.state;
    if (s.status === 'won' || s.status === 'gameover') return;
    const dt = FIXED_DT;
    s.steps++;
    s.time += dt;
    this.syncPlatforms();
    this.stepEnemies(dt);
    for (let i = 0; i < s.springT.length; i++) s.springT[i] += dt;

    if (s.status === 'dying') {
      s.deathTimer -= dt;
      if (s.deathTimer <= 0) {
        if (s.lives <= 0) {
          s.status = 'gameover';
          this.events.push({ type: 'gameover' });
        } else {
          const [x, y] = this.respawnPoint();
          s.ball = createBall(x, y);
          s.status = 'playing';
          this.setForm('normal');
          this.events.push({ type: 'respawn', x, y });
        }
      }
      return;
    }

    const ball = s.ball;
    const p = this.params;
    this.ballEvents.length = 0;
    stepBall(ball, input, p, this.world, dt, this.ballEvents);
    for (const e of this.ballEvents) {
      if (e.type === 'crushed') {
        this.die('crushed');
        return;
      }
      this.events.push(e);
    }
    this.checkTriggers();
  }

  private stepEnemies(dt: number) {
    const s = this.state;
    this.level.enemies.forEach((def, i) => {
      const e = s.enemies[i];
      if (!e.alive) {
        e.deadT += dt;
        return;
      }
      e.x += e.dir * def.speed * dt;
      if (e.x > def.maxX) { e.x = def.maxX; e.dir = -1; }
      if (e.x < def.minX) { e.x = def.minX; e.dir = 1; }
    });
  }

  die(cause: DeathCause) {
    const s = this.state;
    if (s.status !== 'playing' || this.invincible) {
      if (this.invincible && cause === 'fall') {
        const [x, y] = this.respawnPoint();
        s.ball = createBall(x, y);
      }
      return;
    }
    s.status = 'dying';
    s.deathTimer = 1.1;
    s.lives -= 1;
    this.events.push({ type: 'death', cause, x: s.ball.x, y: s.ball.y });
  }

  private checkTriggers() {
    const s = this.state;
    const b = s.ball;
    const r = this.params.radius;
    const L = this.level;

    if (b.y - r > L.killY) {
      this.die('fall');
      return;
    }

    // eggs
    for (let i = 0; i < L.eggs.length; i++) {
      if (s.eggs[i]) continue;
      const [ex, ey] = L.eggs[i];
      const dx = b.x - ex, dy = b.y - ey;
      const rr = r + EGG_RADIUS;
      if (dx * dx + dy * dy < rr * rr) {
        s.eggs[i] = true;
        this.events.push({ type: 'egg', index: i, x: ex, y: ey });
      }
    }

    // spikes
    for (const sp of L.spikes) {
      const h = SPIKE_HEIGHT * 0.7;
      let x = sp.x, y = sp.y, w = sp.length, hh = h;
      switch (sp.dir) {
        case 'up': x = sp.x + 3; y = sp.y - h; w = sp.length - 6; hh = h; break;
        case 'down': x = sp.x + 3; y = sp.y; w = sp.length - 6; hh = h; break;
        case 'left': x = sp.x - h; y = sp.y + 3; w = h; hh = sp.length - 6; break;
        case 'right': x = sp.x; y = sp.y + 3; w = h; hh = sp.length - 6; break;
      }
      if (circleRectOverlap(b.x, b.y, r * 0.85, x, y, w, hh)) {
        this.die('spikes');
        return;
      }
    }

    // enemies
    for (let i = 0; i < L.enemies.length; i++) {
      const e = s.enemies[i];
      if (!e.alive) continue;
      const def = L.enemies[i];
      const left = e.x - ENEMY_W / 2, top = def.y - ENEMY_H;
      if (circleRectOverlap(b.x, b.y, r * 0.88, left, top, ENEMY_W, ENEMY_H)) {
        const fromAbove = b.vy > 40 && b.y < top + 4;
        if (def.type === 'beetle' && fromAbove) {
          e.alive = false;
          e.deadT = 0;
          b.vy = -this.params.jumpSpeed * 1.05;
          b.jumping = false;
          b.grounded = false;
          this.events.push({ type: 'stomp', index: i, x: e.x, y: top });
        } else {
          this.die('enemy');
          return;
        }
      }
    }

    // springs
    for (let i = 0; i < L.springs.length; i++) {
      const sp = L.springs[i];
      const top = sp.y - SPRING_H;
      if (Math.abs(b.x - sp.x) < SPRING_W / 2 + r * 0.55 && b.y + r > top - 2 && b.y < sp.y && b.vy > -80 && s.springT[i] > 0.15) {
        b.vy = -sp.power;
        b.y = Math.min(b.y, top - r + 2);
        b.grounded = false;
        b.jumping = false;
        b.coyote = 0;
        b.canAutoJump = false;
        s.springT[i] = 0;
        this.events.push({ type: 'spring', index: i, x: sp.x, y: top });
      }
    }

    // form pads
    if (L.formPads) {
      for (const fp of L.formPads) {
        if (s.form !== fp.form && Math.abs(b.x - fp.x) < 30 && Math.abs(b.y - (fp.y - r)) < 40) {
          this.setForm(fp.form);
          this.events.push({ type: 'form', form: fp.form, x: fp.x, y: fp.y });
        }
      }
    }

    // checkpoints
    for (let i = 0; i < L.checkpoints.length; i++) {
      if (i <= s.checkpoint) continue;
      const [cx, cy] = L.checkpoints[i];
      if (Math.abs(b.x - cx) < 36 && b.y > cy - 150 && b.y < cy + 10) {
        s.checkpoint = i;
        this.events.push({ type: 'checkpoint', index: i, x: cx, y: cy });
      }
    }

    // goal
    const [gx, gy] = L.goal;
    if (Math.abs(b.x - gx) < 34 && b.y > gy - 120 && b.y < gy + 10) {
      s.status = 'won';
      b.vx = 0; b.vy = 0;
      this.events.push({ type: 'win', x: gx, y: gy });
    }
  }
}
