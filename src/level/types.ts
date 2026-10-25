import type { Point } from '../physics/geometry';

export type TerrainStyle = 'ground' | 'island' | 'rock' | 'log';

export interface TerrainPiece {
  points: Point[];
  style: TerrainStyle;
}

export interface PlatformDef {
  /** polygon relative to the platform origin */
  shape: Point[];
  /** path waypoints for the origin (absolute) */
  path: Point[];
  /** seconds for a full A->B->A cycle (ping-pong, sine eased) */
  period: number;
  /** phase offset in [0,1) */
  phase?: number;
}

export type SpikeDir = 'up' | 'down' | 'left' | 'right';
export interface SpikeDef {
  /** left/top corner of the strip base */
  x: number;
  y: number;
  /** length of the strip along its base */
  length: number;
  dir: SpikeDir;
}

export interface EnemyDef {
  type: 'beetle' | 'thorn';
  /** feet position */
  x: number;
  y: number;
  minX: number;
  maxX: number;
  speed: number;
}

export interface SpringDef {
  x: number;
  /** ground y at the spring base */
  y: number;
  power: number;
}

export type DecoType = 'tree' | 'pine' | 'flower' | 'mushroom' | 'bush' | 'rock' | 'grass' | 'sign' | 'crystal' | 'fern';
export interface DecoDef {
  type: DecoType;
  x: number;
  y: number;
  scale?: number;
  flip?: boolean;
  /** palette variant */
  v?: number;
  /** for signs: icon text */
  text?: string;
  /** draw in front of the ball */
  front?: boolean;
}

export interface HintDef {
  x: number;
  y: number;
  text: string;
  /** shown only on touch devices / keyboard devices */
  only?: 'touch' | 'keys';
}

export interface FormPadDef {
  x: number;
  y: number;
  form: 'normal' | 'heavy' | 'light';
}

export interface LevelData {
  id: string;
  name: string;
  subtitle: string;
  theme: 'forest' | 'lab';
  width: number;
  height: number;
  spawn: Point;
  killY: number;
  terrain: TerrainPiece[];
  platforms: PlatformDef[];
  spikes: SpikeDef[];
  eggs: Point[];
  enemies: EnemyDef[];
  springs: SpringDef[];
  checkpoints: Point[];
  goal: Point;
  deco: DecoDef[];
  hints: HintDef[];
  formPads?: FormPadDef[];
  /** target time (s) for the "fast" medal */
  parTime: number;
  lives: number;
}
