import { Contact, CollisionWorld } from './world';
import { PhysicsParams } from './params';
import { approach } from './geometry';

export interface BallInput {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  /** true only on the step where jump was pressed */
  jumpPressed: boolean;
}

export const NO_INPUT: BallInput = Object.freeze({ left: false, right: false, jumpHeld: false, jumpPressed: false });

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** visual rotation (radians) */
  angle: number;
  grounded: boolean;
  /** ground normal when grounded */
  gnx: number;
  gny: number;
  /** id of the solid we stand on (-1 static, -2 none) */
  groundOwner: number;
  groundVx: number;
  groundVy: number;
  coyote: number;
  jumpBuffer: number;
  jumping: boolean;
  /** set after landing, cleared on jump: enables hold-to-bounce */
  canAutoJump: boolean;
  /** seconds since leaving the ground */
  airTime: number;
  /** seconds since the last jump started */
  jumpTime: number;
}

export type BallEvent =
  | { type: 'jump'; x: number; y: number }
  | { type: 'land'; x: number; y: number; impact: number }
  | { type: 'bounce'; x: number; y: number; impact: number; nx: number; ny: number }
  | { type: 'crushed'; x: number; y: number };

export function createBall(x: number, y: number): BallState {
  return {
    x, y, vx: 0, vy: 0, angle: 0,
    grounded: false, gnx: 0, gny: -1, groundOwner: -2, groundVx: 0, groundVy: 0,
    coyote: 0, jumpBuffer: 0, jumping: false, canAutoJump: true, airTime: 0, jumpTime: 0,
  };
}

const contacts: Contact[] = [];
const penOut: [number, number, number, number] = [0, 0, 0, 0];

/**
 * Penetration of a circle against one segment: [depth, nx, ny] or null.
 * Back faces are ignored; if the centre is slightly behind the face (fast impact),
 * the face normal is used so the ball is pushed back to the front side.
 */
export function penetration(x: number, y: number, r: number, c: Contact): [number, number, number, number] | null {
  const s = c.seg;
  const ax = s.ax + c.ox, ay = s.ay + c.oy;
  const side = (x - ax) * s.nx + (y - ay) * s.ny;
  if (side < -r * 0.5) return null;
  const t0 = (x - ax) * s.dx + (y - ay) * s.dy;
  if (side < 0) {
    if (t0 <= 0 || t0 >= s.len) return null;
    penOut[0] = r - side; penOut[1] = s.nx; penOut[2] = s.ny; penOut[3] = 0;
    return penOut;
  }
  const t = t0 < 0 ? 0 : t0 > s.len ? s.len : t0;
  const dx = x - (ax + s.dx * t), dy = y - (ay + s.dy * t);
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  const d = Math.sqrt(d2);
  const corner = t0 < 0 || t0 > s.len ? 1 : 0;
  if (d < 1e-4) { penOut[0] = r; penOut[1] = s.nx; penOut[2] = s.ny; penOut[3] = corner; return penOut; }
  penOut[0] = r - d; penOut[1] = dx / d; penOut[2] = dy / d; penOut[3] = corner;
  return penOut;
}

/**
 * Advances the ball one fixed step.
 * Order: control -> jump -> gravity -> integrate -> collide -> ground detection.
 */
export function stepBall(ball: BallState, input: BallInput, p: PhysicsParams, world: CollisionWorld, dt: number, events: BallEvent[]) {
  const r = p.radius;
  ball.coyote -= dt;
  ball.jumpBuffer -= dt;
  if (input.jumpPressed) ball.jumpBuffer = p.jumpBuffer;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  // ---- horizontal control ----
  if (ball.grounded) {
    const nx = ball.gnx, ny = ball.gny;
    const tx = -ny, ty = nx; // tangent pointing "right"
    let rvx = ball.vx - ball.groundVx;
    let rvy = ball.vy - ball.groundVy;
    let s = rvx * tx + rvy * ty;
    const vn = rvx * nx + rvy * ny;
    if (dir !== 0) {
      if (s * dir < 0) s += dir * p.turnAccel * dt;
      else if (Math.abs(s) < p.maxSpeed) s = dir * Math.min(Math.abs(s) + p.groundAccel * dt, p.maxSpeed);
      else s = approach(s, dir * p.maxSpeed, p.overspeedDecel * dt);
    } else {
      // Rolling friction proportional to the normal force (cos of the slope), like the classic.
      const decel = p.groundDecel * Math.max(0, -ny);
      s = approach(s, 0, decel * dt);
      // Static friction: on gentle slopes cancel the gravity pull so a resting ball does not creep.
      const gt = p.gravity * ty;
      if (Math.abs(s) <= decel * dt && Math.abs(gt) < decel) s = -gt * dt;
    }
    if (s > p.maxRollSpeed) s = p.maxRollSpeed;
    else if (s < -p.maxRollSpeed) s = -p.maxRollSpeed;
    rvx = tx * s + nx * vn;
    rvy = ty * s + ny * vn;
    ball.vx = rvx + ball.groundVx;
    ball.vy = rvy + ball.groundVy;
  } else {
    if (dir !== 0) {
      if (ball.vx * dir < 0 || Math.abs(ball.vx) < p.maxSpeed) {
        ball.vx = approach(ball.vx, dir * p.maxSpeed, p.airAccel * dt);
      } else {
        ball.vx = approach(ball.vx, dir * p.maxSpeed, p.overspeedDecel * 0.5 * dt);
      }
    } else {
      ball.vx = approach(ball.vx, 0, p.airDecel * dt);
    }
  }

  if (ball.vx > p.maxRollSpeed) ball.vx = p.maxRollSpeed;
  else if (ball.vx < -p.maxRollSpeed) ball.vx = -p.maxRollSpeed;

  // ---- jump ----
  const canJump = ball.grounded || ball.coyote > 0;
  const wantsJump = ball.jumpBuffer > 0 || (p.autoJump && input.jumpHeld && ball.canAutoJump);
  if (canJump && wantsJump) {
    const carryUp = Math.min(0, ball.groundVy);
    ball.vy = -p.jumpSpeed + carryUp;
    ball.grounded = false;
    ball.coyote = 0;
    ball.jumpBuffer = 0;
    ball.jumping = true;
    ball.canAutoJump = false;
    ball.jumpTime = 0;
    events.push({ type: 'jump', x: ball.x, y: ball.y });
  }
  ball.jumpTime += dt;
  if (ball.jumping) {
    if (!input.jumpHeld && ball.vy < 0 && ball.jumpTime >= p.minJumpTime) {
      ball.vy *= p.jumpCut;
      ball.jumping = false;
    } else if (ball.vy >= 0) {
      ball.jumping = false;
    }
  }

  // ---- gravity & integrate ----
  ball.vy = Math.min(ball.vy + p.gravity * dt, p.maxFallSpeed);
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // ---- collide ----
  const wasGrounded = ball.grounded;
  ball.grounded = false;
  let gAccX = 0, gAccY = 0, gOwner = -2, gVx = 0, gVy = 0;
  let maxImpact = 0;
  let bounced = false;
  world.query(ball.x, ball.y, r + 4, contacts);

  for (let iter = 0; iter < 5; iter++) {
    let best: Contact | null = null;
    let bestPen = 0, bnx = 0, bny = 0, bCorner = 0;
    for (const c of contacts) {
      const pen0 = penetration(ball.x, ball.y, r, c);
      if (pen0 === null) continue;
      if (pen0[0] > bestPen) {
        bestPen = pen0[0]; best = c; bnx = pen0[1]; bny = pen0[2]; bCorner = pen0[3];
      }
    }
    if (!best) break;
    ball.x += bnx * (bestPen + 0.01);
    ball.y += bny * (bestPen + 0.01);
    let ovx = 0, ovy = 0;
    if (best.owner >= 0) {
      const m = world.mover(best.owner);
      if (m) { ovx = m.vx; ovy = m.vy; }
    }
    const rvx = ball.vx - ovx, rvy = ball.vy - ovy;
    const vn = rvx * bnx + rvy * bny;
    const isFloor = bny < -p.floorNormalY;
    if (vn < 0) {
      const impact = -vn;
      let e = 0;
      if (impact > p.bounceThreshold) e = isFloor ? p.restitution : bny > p.floorNormalY ? 0.1 : p.wallRestitution;
      // Rounded corners: soften the bounce so edges do not act as speed boosters.
      if (bCorner) e *= 0.35;
      ball.vx -= (1 + e) * vn * bnx;
      ball.vy -= (1 + e) * vn * bny;
      if (e > 0) {
        bounced = true;
        events.push({ type: 'bounce', x: ball.x - bnx * r, y: ball.y - bny * r, impact, nx: bnx, ny: bny });
      }
      if (isFloor && impact > maxImpact) maxImpact = impact;
    }
    if (isFloor) {
      gAccX += bnx; gAccY += bny;
      gOwner = best.owner; gVx = ovx; gVy = ovy;
    }
  }

  // Crushed: still deeply overlapping after the solver (e.g. between a moving solid and a wall).
  let worstPen = 0;
  for (const c of contacts) {
    const pen = penetration(ball.x, ball.y, r, c);
    if (pen && pen[0] > worstPen) worstPen = pen[0];
  }
  if (worstPen > r * 0.6) events.push({ type: 'crushed', x: ball.x, y: ball.y });

  // Ground probe: resting contact within a small tolerance counts as grounded.
  if (gOwner === -2) {
    for (const c of contacts) {
      const s = c.seg;
      if (-s.ny <= p.floorNormalY) continue;
      const ax = s.ax + c.ox, ay = s.ay + c.oy;
      let t = (ball.x - ax) * s.dx + (ball.y - ay) * s.dy;
      if (t < 0 || t > s.len) continue;
      const side = (ball.x - ax) * s.nx + (ball.y - ay) * s.ny;
      if (side < 0 || side > r + 1.5) continue;
      let ovx = 0, ovy = 0;
      if (c.owner >= 0) {
        const m = world.mover(c.owner);
        if (m) { ovx = m.vx; ovy = m.vy; }
      }
      const vn = (ball.vx - ovx) * s.nx + (ball.vy - ovy) * s.ny;
      if (vn > 40) continue;
      gAccX += s.nx; gAccY += s.ny; gOwner = c.owner; gVx = ovx; gVy = ovy;
      break;
    }
  }

  if (gOwner !== -2) {
    const len = Math.hypot(gAccX, gAccY) || 1;
    const nx = gAccX / len, ny = gAccY / len;
    // A strong bounce leaves the ground this step.
    const vn = (ball.vx - gVx) * nx + (ball.vy - gVy) * ny;
    if (!(bounced && vn > 60)) {
      ball.grounded = true;
      ball.gnx = nx; ball.gny = ny;
      ball.groundOwner = gOwner; ball.groundVx = gVx; ball.groundVy = gVy;
      ball.coyote = p.coyoteTime;
    }
  }
  if (!ball.grounded) {
    ball.groundOwner = -2;
    ball.airTime += dt;
    // Keep the platform's momentum on take-off: velocity is already absolute, nothing to add.
  } else {
    if (!wasGrounded && ball.airTime > 0.05) {
      events.push({ type: 'land', x: ball.x, y: ball.y + r, impact: maxImpact });
    }
    ball.airTime = 0;
    if (!ball.jumping) ball.canAutoJump = true;
  }
  if (maxImpact > 0 && !ball.grounded && !wasGrounded) {
    // bounced off the floor without settling: allow hold-to-bounce on next contact
    ball.canAutoJump = true;
  }

  // visual rolling: angle follows tangential speed when grounded, keeps spinning in the air
  ball.angle += (ball.vx / r) * dt;
}
