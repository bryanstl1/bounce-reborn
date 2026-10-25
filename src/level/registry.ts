import type { LevelData } from './types';
import { forest01 } from './levels/forest01';
import { lab } from './levels/lab';

/** Playable campaign levels, in order. */
export const CAMPAIGN: LevelData[] = [forest01];

/** Planned levels shown as locked in the level select. */
export const UPCOMING: { name: string; subtitle: string }[] = [
  { name: 'Raíces Profundas', subtitle: 'Mundo 1 · Nivel 2' },
  { name: 'Lago de Burbujas', subtitle: 'Mundo 1 · Nivel 3' },
  { name: 'Cuevas Murmullo', subtitle: 'Mundo 2 · Nivel 1' },
];

export const LEVELS: LevelData[] = [...CAMPAIGN, lab];

export function levelById(id: string): LevelData | undefined {
  return LEVELS.find((l) => l.id === id);
}
