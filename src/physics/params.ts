/**
 * Physics parameters. All values are in world units (px) and seconds.
 * The ball radius is the reference unit: 1 "D" (diameter) = 2 * radius.
 *
 * Defaults are estimates taken from the reference videos (see docs/ANALISIS-BOUNCE-TALES.md)
 * and are meant to be tuned in the physics lab.
 */
export interface PhysicsParams {
  radius: number;
  gravity: number;
  maxFallSpeed: number;
  /** Max horizontal speed reached by input on flat ground. */
  maxSpeed: number;
  /** Acceleration on the ground when pushing in the direction of motion. */
  groundAccel: number;
  /** Deceleration on the ground with no input (rolling friction). */
  groundDecel: number;
  /** Deceleration when pushing against the current motion (turning). */
  turnAccel: number;
  /** Hard cap for horizontal / rolling speed (downhill, bounces). */
  maxRollSpeed: number;
  /** Extra drag applied when going faster than maxSpeed (downhill, springs). */
  overspeedDecel: number;
  airAccel: number;
  airDecel: number;
  jumpSpeed: number;
  /** Multiplier applied to upward speed when the jump button is released early. */
  jumpCut: number;
  /** The jump cannot be cut before this many seconds (taps still give a decent hop). */
  minJumpTime: number;
  coyoteTime: number;
  jumpBuffer: number;
  /** Bounciness on floors (0 = dead, 1 = perfect). */
  restitution: number;
  /** Bounciness on walls and ceilings. */
  wallRestitution: number;
  /** Impacts slower than this (px/s along the normal) do not bounce. */
  bounceThreshold: number;
  /** Surfaces whose normal has y below -this are considered floor. */
  floorNormalY: number;
  /** Holding jump keeps bouncing (classic behaviour). */
  autoJump: boolean;
}

/*
 * Calibration: the classic game's own tuning constants (documented in the community
 * decompilation HelloOO7/BounceTales, BounceObject.java) were used as reference values.
 * Only the numbers were used; no code was copied. Original unit: 1 px with ball radius 20;
 * here radius 24, so every distance-based value is scaled by k = 24/20 = 1.2.
 *   gravity 400 -> 480 · jump impulse 288 -> 345.6 · max speed 280 -> 336
 *   move accel 500 -> 600 · mid-air accel 500/1.5 -> 400 · friction 0.6·g -> 288
 *   ricochet 0.1 · terminal velocity 999 -> 1200 · jump allowed on slopes up to 55°
 * Extras that the original did not have (coyote time, jump buffer, variable jump,
 * rolling speed cap) are modern quality-of-life additions and can be disabled in the lab.
 */
export const DEFAULT_PARAMS: Readonly<PhysicsParams> = Object.freeze({
  radius: 24,
  gravity: 480,
  maxFallSpeed: 1200,
  maxSpeed: 336,
  groundAccel: 600,
  groundDecel: 288,
  turnAccel: 890,
  maxRollSpeed: 560,
  overspeedDecel: 300,
  airAccel: 400,
  airDecel: 0,
  jumpSpeed: 346,
  jumpCut: 0.7,
  minJumpTime: 0.12,
  coyoteTime: 0.08,
  jumpBuffer: 0.12,
  restitution: 0.12,
  wallRestitution: 0.1,
  bounceThreshold: 140,
  floorNormalY: 0.574, // cos(55°)
  autoJump: true,
});

export type BallForm = 'normal' | 'heavy' | 'light';

/** Multipliers applied on top of the base params for each ball form. */
export const FORM_MODIFIERS: Record<BallForm, Partial<Record<keyof PhysicsParams, number>>> = {
  normal: {},
  // Heavy (stone): jump 255/1.4, speed 350, accel 350/1.4, mid-air suppression 2.5, low friction.
  heavy: { jumpSpeed: 0.632, maxSpeed: 1.25, maxRollSpeed: 1.2, groundAccel: 0.5, airAccel: 0.3, groundDecel: 0.7, turnAccel: 0.6, restitution: 0.5 },
  // Light (bubble): jump 162.5/0.5, speed 150, accel 312.5/0.5, mid-air suppression 1.2.
  light: { jumpSpeed: 1.128, maxSpeed: 0.536, groundAccel: 1.25, airAccel: 1.56, turnAccel: 1.2, maxFallSpeed: 0.7 },
};

export function paramsForForm(base: PhysicsParams, form: BallForm): PhysicsParams {
  const out = { ...base };
  const mods = FORM_MODIFIERS[form];
  for (const k of Object.keys(mods) as (keyof PhysicsParams)[]) {
    const m = mods[k]!;
    const v = out[k];
    if (typeof v === 'number') (out as unknown as Record<string, number>)[k] = v * m;
  }
  if (out.restitution > 0.85) out.restitution = 0.85;
  return out;
}

/** Derived values useful for level design and the lab. */
export function derived(p: PhysicsParams) {
  const jumpHeight = (p.jumpSpeed * p.jumpSpeed) / (2 * p.gravity);
  const riseTime = p.jumpSpeed / p.gravity;
  const airTime = 2 * riseTime;
  return {
    diameter: p.radius * 2,
    jumpHeight,
    jumpHeightD: jumpHeight / (p.radius * 2),
    riseTime,
    airTime,
    /** Horizontal distance covered at max speed during a full flat jump. */
    jumpDistance: airTime * p.maxSpeed,
    timeToMaxSpeed: p.maxSpeed / p.groundAccel,
  };
}

export interface ParamMeta {
  key: keyof PhysicsParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

/** Slider definitions for the physics lab. */
export const PARAM_META: ParamMeta[] = [
  { key: 'gravity', label: 'Gravedad', min: 150, max: 2500, step: 10 },
  { key: 'jumpSpeed', label: 'Impulso de salto', min: 150, max: 1200, step: 10 },
  { key: 'jumpCut', label: 'Corte de salto (soltar)', min: 0.1, max: 1, step: 0.05 },
  { key: 'minJumpTime', label: 'Salto mínimo (s)', min: 0, max: 0.3, step: 0.01 },
  { key: 'maxSpeed', label: 'Velocidad máxima', min: 80, max: 700, step: 5 },
  { key: 'groundAccel', label: 'Aceleración suelo', min: 50, max: 3000, step: 10 },
  { key: 'groundDecel', label: 'Fricción suelo (inercia)', min: 0, max: 2000, step: 10 },
  { key: 'turnAccel', label: 'Frenado al girar', min: 50, max: 4000, step: 10 },
  { key: 'airAccel', label: 'Control en el aire', min: 0, max: 3000, step: 10 },
  { key: 'airDecel', label: 'Fricción en el aire', min: 0, max: 1000, step: 10 },
  { key: 'restitution', label: 'Rebote en suelo', min: 0, max: 0.9, step: 0.01 },
  { key: 'wallRestitution', label: 'Rebote en paredes', min: 0, max: 0.9, step: 0.01 },
  { key: 'bounceThreshold', label: 'Umbral de rebote', min: 0, max: 900, step: 10 },
  { key: 'overspeedDecel', label: 'Freno sobre-velocidad', min: 0, max: 2000, step: 10 },
  { key: 'maxRollSpeed', label: 'Velocidad tope (bajadas)', min: 200, max: 1200, step: 10 },
  { key: 'maxFallSpeed', label: 'Caída máxima', min: 200, max: 2500, step: 10 },
  { key: 'coyoteTime', label: 'Tiempo coyote', min: 0, max: 0.3, step: 0.01 },
  { key: 'jumpBuffer', label: 'Búfer de salto', min: 0, max: 0.3, step: 0.01 },
];
