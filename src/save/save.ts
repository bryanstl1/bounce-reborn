import type { PhysicsParams } from '../physics/params';

export type Quality = 'auto' | 'high' | 'saver';

export interface Settings {
  music: number; // 0..1
  sfx: number; // 0..1
  quality: Quality;
  showFps: boolean;
  /** custom physics from the lab (applied to all levels when set) */
  customPhysics: Partial<PhysicsParams> | null;
}

export interface LevelRecord {
  completed: boolean;
  bestEggs: number;
  bestTime: number | null;
  allEggs: boolean;
}

export interface SaveData {
  version: 1;
  unlocked: string[];
  levels: Record<string, LevelRecord>;
  eggsCollected: Record<string, number[]>;
  settings: Settings;
}

const KEY = 'bounce-reborn/save/v1';

export const DEFAULT_SETTINGS: Settings = { music: 0.55, sfx: 0.8, quality: 'auto', showFps: false, customPhysics: null };

function fresh(firstLevel: string): SaveData {
  return { version: 1, unlocked: [firstLevel], levels: {}, eggsCollected: {}, settings: { ...DEFAULT_SETTINGS } };
}

/** Local persistence. Every access is guarded: private mode or blocked storage falls back to memory. */
export class SaveStore {
  data: SaveData;
  private storageOk = true;

  constructor(private firstLevel: string) {
    this.data = fresh(firstLevel);
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        if (parsed && parsed.version === 1) {
          this.data = {
            ...fresh(firstLevel),
            ...parsed,
            settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
          } as SaveData;
          if (!this.data.unlocked.includes(firstLevel)) this.data.unlocked.unshift(firstLevel);
        }
      }
    } catch {
      this.storageOk = false;
    }
  }

  get persistent() {
    return this.storageOk;
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      this.storageOk = false;
    }
  }

  isUnlocked(id: string) {
    return this.data.unlocked.includes(id);
  }

  record(id: string): LevelRecord {
    return this.data.levels[id] ?? { completed: false, bestEggs: 0, bestTime: null, allEggs: false };
  }

  /** Stores a finished run. Returns flags about new records. */
  completeLevel(id: string, eggs: number[], totalEggs: number, time: number, nextId?: string) {
    const prev = this.record(id);
    const union = new Set([...(this.data.eggsCollected[id] ?? []), ...eggs]);
    this.data.eggsCollected[id] = [...union].sort((a, b) => a - b);
    const newBestTime = prev.bestTime === null || time < prev.bestTime;
    const rec: LevelRecord = {
      completed: true,
      bestEggs: Math.max(prev.bestEggs, eggs.length),
      bestTime: newBestTime ? time : prev.bestTime,
      allEggs: prev.allEggs || eggs.length === totalEggs,
    };
    this.data.levels[id] = rec;
    if (nextId && !this.data.unlocked.includes(nextId)) this.data.unlocked.push(nextId);
    this.save();
    return { newBestTime, newBestEggs: eggs.length > prev.bestEggs, record: rec };
  }

  updateSettings(patch: Partial<Settings>) {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
  }

  resetProgress() {
    const settings = this.data.settings;
    this.data = fresh(this.firstLevel);
    this.data.settings = settings;
    this.save();
  }
}
