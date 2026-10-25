import * as Phaser from 'phaser';
import { AudioEngine } from './audio/audio';
import { InputController } from './input/input';
import { LabPanel } from './lab/labPanel';
import { CAMPAIGN, UPCOMING, levelById } from './level/registry';
import { lab } from './level/levels/lab';
import type { LevelData } from './level/types';
import type { BallInput } from './physics/ball';
import { DEFAULT_PARAMS, PhysicsParams } from './physics/params';
import { GameBridge, GameScene, HudState, WinResult } from './render/GameScene';
import { SaveStore } from './save/save';
import type { LevelSim } from './sim/LevelSim';
import { STEPS_PER_ACTION, actionInput, solveLevel, type Action } from './sim/solver';

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

type ScreenId = 'title' | 'levels' | 'settings' | 'pause' | 'victory' | 'defeat' | null;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const save = new SaveStore(CAMPAIGN[0].id);
const audio = new AudioEngine();
const input = new InputController($('touch'));
const labPanel = new LabPanel({ ...DEFAULT_PARAMS, ...(save.data.settings.customPhysics ?? {}) });

let game: Phaser.Game | null = null;
let currentLevel: LevelData | null = null;
let currentSim: LevelSim | null = null;
let screen: ScreenId = 'title';
let settingsReturn: ScreenId = 'title';
let playing = false;
let paused = false;
let inputOverride: ((step: number) => BallInput | null) | null = null;

// ------------------------------------------------------------------ helpers
function gameParams(): PhysicsParams {
  const custom = save.data.settings.customPhysics;
  return { ...DEFAULT_PARAMS, ...(custom ?? {}) };
}

function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function toast(msg: string) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  window.setTimeout(() => el.classList.remove('show'), 1800);
}

function showScreen(id: ScreenId) {
  screen = id;
  for (const s of ['title', 'levels', 'settings', 'pause', 'victory', 'defeat']) $(s).classList.toggle('show', s === id);
  input.enabled = id === null;
  if (id !== null) input.clear();
}

function dpr(): number {
  const q = save.data.settings.quality;
  const d = window.devicePixelRatio || 1;
  if (q === 'high') return Math.min(d, 3);
  if (q === 'saver') return Math.min(d, 1.25);
  return Math.min(d, 2);
}

// ------------------------------------------------------------------ Phaser
function viewport() {
  const vv = window.visualViewport;
  const w = Math.round(vv ? vv.width : window.innerWidth);
  const h = Math.round(vv ? vv.height : window.innerHeight);
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

function createGame() {
  const { w, h } = viewport();
  const r = dpr();
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    transparent: true,
    banner: false,
    antialias: true,
    width: Math.round(w * r),
    height: Math.round(h * r),
    scale: { mode: Phaser.Scale.NONE, zoom: 1 / r },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    audio: { noAudio: true },
    fps: { smoothStep: false },
    render: { powerPreference: 'high-performance', antialias: true, roundPixels: false },
    scene: [],
  });
  game.scene.add('game', GameScene, false);
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

function resizeGame() {
  if (!game || !game.isBooted || !game.canvas) return;
  const { w, h } = viewport();
  const r = dpr();
  game.scale.setZoom(1 / r);
  game.scale.resize(Math.round(w * r), Math.round(h * r));
}

const bridge: GameBridge = {
  sampleInput: () => input.sample(),
  audio,
  isTouch: () => input.touchMode || matchMedia('(pointer: coarse)').matches,
  onHud: (h: HudState) => updateHud(h),
  onWin: (r: WinResult) => onWin(r),
  onGameOver: () => onGameOver(),
  onSim: (sim) => {
    currentSim = sim;
    if (currentLevel?.theme === 'lab') labPanel.attach(sim);
  },
  onLabStats: (s) => labPanel.update(s),
  get inputOverride() {
    return inputOverride;
  },
  set inputOverride(v) {
    inputOverride = v;
  },
};

function startLevel(level: LevelData) {
  if (!game) createGame();
  currentLevel = level;
  playing = true;
  paused = false;
  document.body.classList.add('playing');
  document.body.classList.toggle('lab', level.theme === 'lab');
  $('hud').classList.add('show');
  $('touch').classList.add('show');
  labPanel.show(level.theme === 'lab');
  showScreen(null);
  const params = level.theme === 'lab' ? labPanel.params : gameParams();
  const g = game!;
  const sm = g.scene;
  if (sm.isActive('game') || sm.isPaused('game')) sm.stop('game');
  sm.start('game', { level, params, bridge });
  audio.unlock();
  audio.startMusic();
}

function stopLevel() {
  playing = false;
  inputOverride = null;
  paused = false;
  document.body.classList.remove('playing', 'lab');
  $('hud').classList.remove('show');
  $('touch').classList.remove('show');
  labPanel.show(false);
  if (game && (game.scene.isActive('game') || game.scene.isPaused('game'))) game.scene.stop('game');
  currentSim = null;
}

function pause() {
  if (!playing || paused || !game) return;
  if (currentSim && currentSim.state.status !== 'playing' && currentSim.state.status !== 'dying') return;
  paused = true;
  game.scene.pause('game');
  $('pauseLevel').textContent = currentLevel ? `${currentLevel.name} · ${currentLevel.subtitle}` : '';
  showScreen('pause');
}

function resume() {
  if (!game) return;
  paused = false;
  (game.scene.getScene('game') as GameScene).resetClock();
  game.scene.resume('game');
  showScreen(null);
}

// ------------------------------------------------------------------ HUD
let lastEggs = -1;
function updateHud(h: HudState) {
  $('eggTxt').textContent = `${h.eggs}/${h.total}`;
  if (h.eggs !== lastEggs) {
    const chip = $('hudEggs');
    chip.classList.remove('bump');
    void chip.offsetWidth;
    if (lastEggs >= 0) chip.classList.add('bump');
    lastEggs = h.eggs;
  }
  $('hudTime').textContent = fmtTime(h.time);
  const lives = $('hudLives');
  if (currentLevel?.theme === 'lab') {
    lives.style.display = 'none';
  } else {
    lives.style.display = '';
    const total = currentLevel?.lives ?? 3;
    let html = '';
    for (let i = 0; i < total; i++) html += `<span class="life${i < h.lives ? '' : ' off'}"></span>`;
    lives.innerHTML = html;
  }
}

// ------------------------------------------------------------------ results
function onWin(r: WinResult) {
  const level = levelById(r.levelId)!;
  const idx = CAMPAIGN.findIndex((l) => l.id === r.levelId);
  const next = CAMPAIGN[idx + 1];
  const res = save.completeLevel(r.levelId, r.eggs, r.total, r.time, next?.id);
  $('vicLevel').textContent = `${level.name} · ${level.subtitle}`;
  $('vicEggs').textContent = `${r.eggs.length}/${r.total}`;
  $('vicTime').textContent = fmtTime(r.time);
  const medals = $('vicMedals').children;
  medals[0].classList.toggle('on', true);
  medals[1].classList.toggle('on', r.eggs.length === r.total);
  medals[2].classList.toggle('on', r.time <= level.parTime);
  const notes: string[] = [];
  if (res.newBestTime && res.record.bestTime !== null) notes.push('¡Nuevo mejor tiempo!');
  if (res.newBestEggs) notes.push('¡Récord de huevos!');
  $('vicRec').textContent = notes.join(' ');
  ($('nextBtn') as HTMLButtonElement).textContent = next ? 'Siguiente ▶' : 'Más niveles pronto';
  ($('nextBtn') as HTMLButtonElement).disabled = !next;
  audio.stopMusic();
  showScreen('victory');
}

function onGameOver() {
  audio.stopMusic();
  showScreen('defeat');
}

// ------------------------------------------------------------------ menus
function renderLevels() {
  const list = $('levelList');
  list.innerHTML = '';
  CAMPAIGN.forEach((l, i) => {
    const unlocked = save.isUnlocked(l.id);
    const rec = save.record(l.id);
    const best = save.data.eggsCollected[l.id]?.length ?? 0;
    const b = document.createElement('button');
    b.className = `lvl${unlocked ? '' : ' locked'}`;
    b.innerHTML = `<span class="n">${l.subtitle}</span><span class="t">${l.name}</span>
      <span class="s">${unlocked ? (rec.completed ? `✓ ${best}/${l.eggs.length} huevos · ${rec.bestTime !== null ? fmtTime(rec.bestTime) : ''}` : 'Nuevo') : '🔒 Bloqueado'}</span>`;
    b.dataset.level = l.id;
    b.disabled = !unlocked;
    void i;
    list.appendChild(b);
  });
  for (const u of UPCOMING) {
    const b = document.createElement('button');
    b.className = 'lvl locked';
    b.disabled = true;
    b.innerHTML = `<span class="n">${u.subtitle}</span><span class="t">${u.name}</span><span class="s">Próximamente</span>`;
    list.appendChild(b);
  }
  const labBtn = document.createElement('button');
  labBtn.className = 'lvl lab';
  labBtn.dataset.level = lab.id;
  labBtn.innerHTML = `<span class="n">Herramienta</span><span class="t">Laboratorio de físicas</span><span class="s">Ajusta la sensación</span>`;
  list.appendChild(labBtn);
}

function openSettings(from: ScreenId) {
  settingsReturn = from;
  const s = save.data.settings;
  ($('setMusic') as HTMLInputElement).value = String(s.music);
  ($('setSfx') as HTMLInputElement).value = String(s.sfx);
  ($('setQuality') as HTMLSelectElement).value = s.quality;
  ($('setFps') as HTMLInputElement).checked = s.showFps;
  ($('setCustom') as HTMLInputElement).checked = !!s.customPhysics;
  ($('setCustom') as HTMLInputElement).disabled = !s.customPhysics;
  $('storageNote').textContent = save.persistent ? '' : 'Aviso: este navegador no permite guardar; el progreso se perderá al cerrar.';
  showScreen('settings');
}

function nextLevel(): LevelData {
  const firstUnfinished = CAMPAIGN.find((l) => save.isUnlocked(l.id) && !save.record(l.id).completed);
  return firstUnfinished ?? CAMPAIGN[0];
}

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest('[data-act],[data-level]') as HTMLElement | null;
  if (!el) return;
  audio.unlock();
  const lvl = el.dataset.level;
  if (lvl && !el.hasAttribute('disabled')) {
    audio.play('click');
    const level = levelById(lvl);
    if (level) startLevel(level);
    return;
  }
  const act = el.dataset.act;
  if (!act || act.startsWith('lab-')) return;
  audio.play('click');
  switch (act) {
    case 'play': startLevel(nextLevel()); break;
    case 'levels': renderLevels(); showScreen('levels'); break;
    case 'lab': startLevel(lab); break;
    case 'settings': openSettings(screen); break;
    case 'back':
      if (screen === 'settings' && settingsReturn === 'pause') showScreen('pause');
      else showScreen('title');
      break;
    case 'resume': resume(); break;
    case 'restart': if (currentLevel) startLevel(currentLevel); break;
    case 'menu': stopLevel(); audio.stopMusic(); showScreen('title'); break;
    case 'next': {
      const idx = CAMPAIGN.findIndex((l) => l.id === currentLevel?.id);
      const n = CAMPAIGN[idx + 1];
      if (n) startLevel(n);
      break;
    }
    case 'reset-progress':
      if (window.confirm('¿Borrar todo el progreso guardado?')) { save.resetProgress(); toast('Progreso borrado'); }
      break;
  }
});

$('pauseBtn').addEventListener('click', (e) => { e.stopPropagation(); audio.unlock(); pause(); });
$('pauseBtn').addEventListener('pointerdown', (e) => e.stopPropagation());
input.onPause = () => {
  if (screen === 'pause') resume();
  else pause();
};
input.onRestart = () => { if (playing && screen === null && currentLevel) startLevel(currentLevel); };
input.onAnyInput = () => audio.unlock();

$('setMusic').addEventListener('input', (e) => {
  const v = parseFloat((e.target as HTMLInputElement).value);
  save.updateSettings({ music: v });
  audio.setVolumes(v, save.data.settings.sfx);
});
$('setSfx').addEventListener('input', (e) => {
  const v = parseFloat((e.target as HTMLInputElement).value);
  save.updateSettings({ sfx: v });
  audio.setVolumes(save.data.settings.music, v);
  audio.play('egg');
});
$('setQuality').addEventListener('change', (e) => {
  save.updateSettings({ quality: (e.target as HTMLSelectElement).value as 'auto' | 'high' | 'saver' });
  resizeGame();
});
$('setFps').addEventListener('change', (e) => {
  save.updateSettings({ showFps: (e.target as HTMLInputElement).checked });
  $('fps').style.display = save.data.settings.showFps ? 'block' : 'none';
});
$('setCustom').addEventListener('change', (e) => {
  if (!(e.target as HTMLInputElement).checked) {
    save.updateSettings({ customPhysics: null });
    toast('Usando las físicas por defecto');
  }
});
labPanel.onUse = (p) => save.updateSettings({ customPhysics: p });
labPanel.onToast = toast;

// ------------------------------------------------------------------ lifecycle
window.addEventListener('resize', resizeGame);
window.visualViewport?.addEventListener('resize', resizeGame);
window.addEventListener('orientationchange', () => window.setTimeout(resizeGame, 250));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    audio.suspend();
  } else {
    audio.resume();
  }
});
// iOS: block pinch-zoom gestures and double-tap zoom.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 350 && !(e.target as HTMLElement).closest('input,select')) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });

// FPS meter
let fpsFrames = 0;
let fpsT = performance.now();
function fpsLoop(now: number) {
  fpsFrames++;
  if (now - fpsT > 500) {
    if (save.data.settings.showFps) $('fps').textContent = `${Math.round((fpsFrames * 1000) / (now - fpsT))} fps`;
    fpsFrames = 0;
    fpsT = now;
  }
  requestAnimationFrame(fpsLoop);
}
requestAnimationFrame(fpsLoop);
$('fps').style.display = save.data.settings.showFps ? 'block' : 'none';

audio.setVolumes(save.data.settings.music, save.data.settings.sfx);
$('version').textContent = `v${__APP_VERSION__}`;
$('version').title = __BUILD_TIME__;

// ------------------------------------------------------------------ test / debug hooks
const debugApi = {
  version: __APP_VERSION__,
  state: () => (currentSim ? { ...currentSim.state, ball: { ...currentSim.state.ball } } : null),
  screen: () => screen,
  level: () => currentLevel?.id ?? null,
  save: () => JSON.parse(JSON.stringify(save.data)),
  start: (id: string) => { inputOverride = null; const l = levelById(id); if (l) startLevel(l); },
  /** Restarts a level and feeds a solver action list from step 0 (deterministic replay). */
  replay: (id: string, actions: Action[]) => {
    const l = levelById(id);
    if (!l) return;
    inputOverride = (step: number) => {
      const ai = Math.floor(step / STEPS_PER_ACTION);
      if (ai >= actions.length) return { left: false, right: false, jumpHeld: false, jumpPressed: false };
      return actionInput(actions[ai], ai > 0 ? actions[ai - 1] : null, step % STEPS_PER_ACTION);
    };
    startLevel(l);
  },
  teleport: (x: number, y: number) => {
    if (!currentSim) return;
    const b = currentSim.state.ball;
    b.x = x; b.y = y; b.vx = 0; b.vy = 0;
  },
  /** Plays a solver action list deterministically (one action = STEPS_PER_ACTION sim steps). */
  playActions: (actions: Action[]) => {
    const start = currentSim ? currentSim.state.steps : 0;
    inputOverride = (step: number) => {
      const k = step - start;
      const ai = Math.floor(k / STEPS_PER_ACTION);
      if (ai < 0 || ai >= actions.length) return { left: false, right: false, jumpHeld: false, jumpPressed: false };
      return actionInput(actions[ai], ai > 0 ? actions[ai - 1] : null, k % STEPS_PER_ACTION);
    };
  },
  solve: (id: string) => {
    const l = levelById(id);
    return l ? solveLevel(l, gameParams(), { beam: 90, maxSeconds: 150 }) : null;
  },
  clearOverride: () => { inputOverride = null; },
};
(window as unknown as { __BOUNCE: typeof debugApi }).__BOUNCE = debugApi;

// ------------------------------------------------------------------ boot
if (matchMedia('(pointer: coarse)').matches) { input.touchMode = true; document.body.classList.add('touch'); }
showScreen('title');
const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve();
Promise.race([fontsReady, new Promise((r) => setTimeout(r, 1500))]).then(() => createGame());
