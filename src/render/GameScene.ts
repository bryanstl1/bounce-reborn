import * as Phaser from 'phaser';
import type { LevelData } from '../level/types';
import type { BallInput } from '../physics/ball';
import type { BallForm, PhysicsParams } from '../physics/params';
import { EGG_RADIUS, FIXED_DT, LevelSim, SimEvent, SPIKE_HEIGHT } from '../sim/LevelSim';
import type { AudioEngine, Sfx } from '../audio/audio';
import { TEX_SCALE, createTextures } from './textures';
import { Cullable, buildBackground, buildTerrain, rng } from './terrain';

export const VIEW_H = 480;

export interface HudState {
  eggs: number;
  total: number;
  time: number;
  lives: number;
  form: BallForm;
}

export interface WinResult {
  levelId: string;
  eggs: number[];
  total: number;
  time: number;
  lives: number;
}

export interface LabStats {
  vx: number;
  vy: number;
  grounded: boolean;
  lastApex: number | null;
  lastAirTime: number | null;
  form: BallForm;
}

export interface GameBridge {
  sampleInput(): BallInput;
  audio: AudioEngine;
  isTouch(): boolean;
  onHud(h: HudState): void;
  onWin(r: WinResult): void;
  onGameOver(): void;
  onSim(sim: LevelSim): void;
  onLabStats?(s: LabStats): void;
  /** optional deterministic input source (replays / tests), indexed by sim step */
  inputOverride: ((step: number) => BallInput | null) | null;
}

export interface SceneData {
  level: LevelData;
  params: PhysicsParams;
  bridge: GameBridge;
}

const D = {
  bgFar: -30,
  deco: 5,
  terrain: 10,
  decoFront2: 11,
  items: 20,
  enemies: 22,
  ball: 30,
  fx: 40,
  front: 50,
  hints: 60,
};

export class GameScene extends Phaser.Scene {
  private level!: LevelData;
  private bridge!: GameBridge;
  sim!: LevelSim;
  private acc = 0;
  private lastNow = 0;
  private cull: Cullable[] = [];

  // ball visuals
  private ballC!: Phaser.GameObjects.Container;
  private ballBody!: Phaser.GameObjects.Image;
  private ballBand!: Phaser.GameObjects.Image;
  private eyes: Phaser.GameObjects.Image[] = [];
  private pupils: Phaser.GameObjects.Image[] = [];
  private mouth!: Phaser.GameObjects.Image;
  private squash = 0;
  private squashV = 0;
  private blinkT = 2;
  private lookX = 0;

  // entities
  private eggSprites: { egg: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }[] = [];
  private enemySprites: Phaser.GameObjects.Image[] = [];
  private springCaps: Phaser.GameObjects.Image[] = [];
  private checkpointSprites: Phaser.GameObjects.Image[] = [];
  private platformObjs: Phaser.GameObjects.Container[] = [];
  private portalSwirl!: Phaser.GameObjects.Image;
  private clouds: Phaser.GameObjects.Image[] = [];
  private hintObjs: Phaser.GameObjects.Text[] = [];

  // fx
  private fxStars!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fxDust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private fxShards!: Phaser.GameObjects.Particles.ParticleEmitter;
  private trail?: Phaser.GameObjects.Graphics;
  private trailPts: { x: number; y: number }[] = [];

  // camera
  private camX = 0;
  private camY = 0;
  private camLook = 0;
  private winHandled = false;
  private hudT = 0;
  private lastHudKey = '';

  // lab measurements
  private jumpStartY: number | null = null;
  private jumpMinY = 0;
  private jumpStartT = 0;
  private lastApex: number | null = null;
  private lastAirTime: number | null = null;

  constructor() {
    super('game');
  }

  init(data: SceneData) {
    this.level = data.level;
    this.bridge = data.bridge;
    this.sim = new LevelSim(data.level, data.params);
    this.sim.invincible = data.level.theme === 'lab';
    this.acc = 0;
    this.lastNow = 0;
    this.cull = [];
    this.eggSprites = [];
    this.enemySprites = [];
    this.springCaps = [];
    this.checkpointSprites = [];
    this.platformObjs = [];
    this.clouds = [];
    this.hintObjs = [];
    this.eyes = [];
    this.pupils = [];
    this.trailPts = [];
    this.winHandled = false;
    this.squash = 0;
    this.squashV = 0;
    this.lastApex = null;
    this.lastAirTime = null;
    this.jumpStartY = null;
    this.bridge.onSim(this.sim);
  }

  create() {
    const L = this.level;
    createTextures(this, this.sim.params.radius);
    const inv = 1 / TEX_SCALE;

    // clouds (far parallax)
    if (L.theme !== 'lab') {
      const r = rng(7);
      for (let i = 0; i < 9; i++) {
        const c = this.add.image(-400 + i * 420 + r() * 200, 60 + r() * 160, 'cloud')
          .setScale(inv * (0.7 + r() * 0.6)).setScrollFactor(0.06, 0.06).setDepth(D.bgFar - 5).setAlpha(0.9);
        this.clouds.push(c);
      }
    }
    buildBackground(this, L);
    const terr = buildTerrain(this, L, D.terrain);
    this.cull.push(...terr.cull);

    // auto-scattered grass and small flowers on surfaces
    const r = rng(31);
    for (const s of terr.spots) {
      const k = r();
      if (k < 0.3) {
        const g = this.add.image(s.x, s.y + 3, 'grass').setOrigin(0.5, 1).setScale(inv * (0.55 + r() * 0.4)).setRotation(s.a).setDepth(D.terrain + 0.3);
        if (r() < 0.5) g.setFlipX(true);
        this.addCull(g, s.x, s.y, 30);
      } else if (k < 0.36) {
        const f = this.add.image(s.x, s.y + 4, `flower-${Math.floor(r() * 3)}`).setOrigin(0.5, 1).setScale(inv * 0.45).setDepth(D.deco);
        this.addCull(f, s.x, s.y, 30);
      }
    }

    // placed decorations
    for (const d of L.deco) {
      const key = this.decoKey(d.type, d.v ?? 0, d.text);
      const base = { tree: 1, pine: 1, flower: 0.7, mushroom: 0.8, bush: 0.9, rock: 0.9, grass: 0.9, sign: 0.85, crystal: 0.9, fern: 0.9 }[d.type];
      const img = this.add.image(d.x, d.y + (d.type === 'tree' || d.type === 'pine' ? 6 : 3), key)
        .setOrigin(0.5, 1).setScale(inv * base * (d.scale ?? 1)).setFlipX(!!d.flip)
        .setDepth(d.front ? D.front : D.deco);
      this.addCull(img, d.x, d.y - 100, 240);
      if (d.type === 'flower' || d.type === 'fern' || d.type === 'grass') {
        this.tweens.add({ targets: img, angle: { from: -3, to: 3 }, duration: 1400 + (d.x % 600), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
    }

    // spikes
    for (const sp of L.spikes) {
      const n = Math.max(1, Math.round(sp.length / 24));
      const step = sp.length / n;
      for (let i = 0; i < n; i++) {
        const o = i * step + step / 2;
        let x = sp.x + o, y = sp.y, rot = 0;
        if (sp.dir === 'down') rot = Math.PI;
        if (sp.dir === 'left') { x = sp.x; y = sp.y + o; rot = -Math.PI / 2; }
        if (sp.dir === 'right') { x = sp.x; y = sp.y + o; rot = Math.PI / 2; }
        const img = this.add.image(x, y, 'spike').setOrigin(0.5, 1).setRotation(rot).setScale(inv * (step / 24), inv * (SPIKE_HEIGHT / 26) * 1.0).setDepth(D.items);
        this.addCull(img, x, y, 40);
      }
    }

    // eggs
    L.eggs.forEach(([x, y], i) => {
      const glow = this.add.image(x, y, 'glow').setScale(inv * 1.1).setDepth(D.items - 1).setAlpha(0.55);
      const egg = this.add.image(x, y, 'egg').setScale(inv * (EGG_RADIUS * 2.1) / 30).setDepth(D.items);
      this.tweens.add({ targets: [egg, glow], y: y - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: (i * 137) % 900 });
      this.tweens.add({ targets: glow, scale: inv * 1.35, alpha: 0.3, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: (i * 211) % 1100 });
      this.eggSprites.push({ egg, glow });
    });

    // springs
    for (const s of L.springs) {
      this.add.image(s.x, s.y + 2, 'spring-stem').setOrigin(0.5, 1).setScale(inv * 0.8).setDepth(D.items);
      const cap = this.add.image(s.x, s.y - 11, 'spring-cap').setOrigin(0.5, 1).setScale(inv * 0.95, inv * 0.65).setDepth(D.items + 0.1);
      this.springCaps.push(cap);
    }

    // form pads
    for (const fp of L.formPads ?? []) {
      this.add.image(fp.x, fp.y + 4, `pad-${fp.form}`).setOrigin(0.5, 1).setScale(inv).setDepth(D.items);
    }

    // checkpoints
    for (const [x, y] of L.checkpoints) {
      const img = this.add.image(x, y + 4, 'checkpoint-off').setOrigin(19 / 56, 1).setScale(inv * 0.85).setDepth(D.items);
      this.checkpointSprites.push(img);
    }

    // goal
    const [gx, gy] = L.goal;
    if (gx < L.width) {
      this.add.image(gx, gy - 70, 'glow').setScale(inv * 2.6).setDepth(D.items - 2).setAlpha(0.7);
      this.portalSwirl = this.add.image(gx, gy - 62, 'portal-swirl').setScale(inv * 0.95).setDepth(D.items - 1);
      this.add.image(gx, gy + 4, 'portal-frame').setOrigin(0.5, 1).setScale(inv * 0.85).setDepth(D.items);
    }

    // moving platforms
    L.platforms.forEach((p, i) => {
      const flat: number[] = [];
      for (const [x, y] of p.shape) flat.push(x, y);
      const body = this.add.polygon(0, 0, flat, 0xb7783f).setOrigin(0, 0);
      body.setStrokeStyle(2.5, 0x3b2112);
      let minX = Infinity, maxX = -Infinity, minY = Infinity;
      for (const [x, y] of p.shape) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); }
      const top = this.add.rectangle(minX + 8, minY + 3, maxX - minX - 16, 5, 0xe0a76a).setOrigin(0, 0);
      const bolts = [this.add.circle(minX + 14, minY + 14, 3, 0x6b3f1f), this.add.circle(maxX - 14, minY + 14, 3, 0x6b3f1f)];
      const c = this.add.container(this.sim.platforms[i].x, this.sim.platforms[i].y, [body, top, ...bolts]).setDepth(D.terrain + 1);
      this.platformObjs.push(c);
    });

    // enemies
    L.enemies.forEach((e) => {
      const img = this.add.image(e.x, e.y + 2, 'beetle-0').setOrigin(0.5, 1).setScale(inv * 0.95).setDepth(D.enemies);
      this.enemySprites.push(img);
    });

    // hints
    const touch = this.bridge.isTouch();
    for (const h of L.hints) {
      if (h.only === 'touch' && !touch) continue;
      if (h.only === 'keys' && touch) continue;
      const t = this.add.text(h.x, h.y, h.text, {
        fontFamily: '"Baloo 2", "Arial Rounded MT Bold", system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: '700',
        color: '#ffffff',
        stroke: '#1d2b4a',
        strokeThickness: 6,
        align: 'center',
        resolution: 3,
      }).setOrigin(0.5, 1).setDepth(D.hints);
      this.hintObjs.push(t);
    }

    // lab rulers
    if (L.theme === 'lab') this.drawLabRulers();

    // ball
    this.buildBall();

    // particles
    this.fxStars = this.add.particles(0, 0, 'p-star', {
      speed: { min: 90, max: 260 }, lifespan: 650, scale: { start: inv * 1.6, end: 0 }, rotate: { start: 0, end: 360 },
      gravityY: 400, emitting: false,
    }).setDepth(D.fx);
    this.fxDust = this.add.particles(0, 0, 'p-dot', {
      speed: { min: 25, max: 95 }, angle: { min: 200, max: 340 }, lifespan: 420, scale: { start: inv * 1.4, end: inv * 0.2 },
      alpha: { start: 0.75, end: 0 }, tint: 0xf3ffe4, gravityY: -40, emitting: false,
    }).setDepth(D.fx);
    this.fxShards = this.add.particles(0, 0, 'p-shard', {
      speed: { min: 160, max: 420 }, lifespan: 900, scale: { start: inv * 2.2, end: inv * 0.4 }, rotate: { start: 0, end: 540 },
      gravityY: 900, tint: [0xff3b3b, 0xffb3a3, 0xb3101f], emitting: false,
    }).setDepth(D.fx);

    // camera
    const cam = this.cameras.main;
    cam.setRoundPixels(false);
    this.scale.on('resize', this.onResize, this);
    this.onResize();
    const b = this.sim.state.ball;
    this.camX = b.x;
    this.camY = b.y - 40;
    this.applyCamera(0, true);

    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
    this.emitHud(true);
  }

  private decoKey(type: string, v: number, text?: string) {
    switch (type) {
      case 'tree': return `tree-${v % 3}`;
      case 'flower': return `flower-${v % 3}`;
      case 'mushroom': return `mushroom-${v % 2}`;
      case 'bush': return `bush-${v % 2}`;
      case 'sign': return text === '!' ? 'sign-!' : 'sign-→';
      default: return type;
    }
  }

  private addCull(obj: Cullable['obj'], x: number, y: number, r: number) {
    this.cull.push({ obj, minX: x - r, maxX: x + r, minY: y - r * 2, maxY: y + r });
  }

  private buildBall() {
    const inv = 1 / TEX_SCALE;
    this.ballBody = this.add.image(0, 0, 'ball-normal').setScale(inv);
    this.ballBand = this.add.image(0, 0, 'ball-band').setScale(inv);
    const shine = this.add.image(0, 0, 'ball-shine').setScale(inv);
    const parts: Phaser.GameObjects.GameObject[] = [this.ballBody, this.ballBand, shine];
    for (const ex of [-7, 7]) {
      const eye = this.add.image(ex, -5, 'eye').setScale(inv);
      const pupil = this.add.image(ex, -4, 'pupil').setScale(inv);
      this.eyes.push(eye);
      this.pupils.push(pupil);
      parts.push(eye, pupil);
    }
    this.mouth = this.add.image(0, 7, 'mouth-smile').setScale(inv);
    parts.push(this.mouth);
    this.ballC = this.add.container(0, 0, parts).setDepth(D.ball);
    this.syncBall(0);
  }

  private drawLabRulers() {
    const g = this.add.graphics().setDepth(D.terrain + 2);
    const Dm = this.sim.params.radius * 2;
    g.lineStyle(2, 0xffffff, 0.35);
    for (let i = 0; i <= 18; i++) {
      const x = 100 + i * Dm;
      g.lineBetween(x, 800, x, 800 - (i % 5 === 0 ? 30 : 12));
      if (i % 5 === 0 && i > 0) this.add.text(x, 760, `${i}D`, { fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#ffffff', resolution: 3 }).setOrigin(0.5, 1).setDepth(D.hints);
    }
    // height ruler at the start
    for (let i = 1; i <= 6; i++) {
      const y = 800 - i * Dm;
      g.lineBetween(40, y, 70, y);
      this.add.text(76, y, `${i}D`, { fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#ffffff', resolution: 3 }).setOrigin(0, 0.5).setDepth(D.hints);
    }
    this.trail = this.add.graphics().setDepth(D.ball - 1);
  }

  private onResize() {
    const cam = this.cameras.main;
    const w = this.scale.width, h = this.scale.height;
    cam.setSize(w, h);
    // keep ~10 ball diameters of height visible; on narrow screens keep enough width
    const zoom = Math.min(h / VIEW_H, w / (VIEW_H * 1.25));
    cam.setZoom(zoom);
    this.applyCamera(0, true);
  }

  // ------------------------------------------------------------------ loop
  resetClock() {
    this.lastNow = 0;
    this.acc = 0;
  }

  override update() {
    // Own wall clock: Phaser's smoothed delta can lag behind real time on slow frames.
    const now = performance.now();
    const dt = this.lastNow === 0 ? 1 / 60 : Math.min((now - this.lastNow) / 1000, 0.25);
    this.lastNow = now;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= FIXED_DT && steps < 30) {
      this.acc -= FIXED_DT;
      steps++;
      const step = this.sim.state.steps;
      const override = this.bridge.inputOverride ? this.bridge.inputOverride(step) : null;
      const input = override ?? this.bridge.sampleInput();
      this.sim.step(input);
      this.handleEvents();
      this.labTrack();
    }
    if (steps >= 30) this.acc = 0;
    this.syncVisuals(dt);
    this.applyCamera(dt, false);
    this.doCull();
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      this.emitHud(false);
    }
  }

  private sfx(name: Sfx, k = 1) {
    this.bridge.audio.play(name, k);
  }

  private handleEvents() {
    const ev = this.sim.events;
    for (const e of ev) this.onEvent(e);
    ev.length = 0;
  }

  private onEvent(e: SimEvent) {
    const r = this.sim.params.radius;
    switch (e.type) {
      case 'jump':
        this.squashV -= 2.2;
        this.sfx('jump');
        this.fxDust.explode(5, e.x, e.y + r);
        break;
      case 'land': {
        const k = Math.min(1, e.impact / 900);
        this.squashV += 1 + k * 3.2;
        if (e.impact > 150) {
          this.sfx('land', k);
          this.fxDust.explode(3 + Math.round(k * 6), e.x, e.y);
        }
        break;
      }
      case 'bounce': {
        const k = Math.min(1, e.impact / 900);
        this.squashV += 1.2 + k * 3.4;
        this.sfx('bounce', k);
        if (e.ny < -0.5) this.fxDust.explode(2 + Math.round(k * 5), e.x, e.y);
        break;
      }
      case 'egg': {
        const s = this.eggSprites[e.index];
        this.tweens.killTweensOf([s.egg, s.glow]);
        this.tweens.add({ targets: s.egg, scale: s.egg.scale * 1.8, alpha: 0, y: s.egg.y - 30, duration: 260, ease: 'Quad.out', onComplete: () => s.egg.setVisible(false) });
        this.tweens.add({ targets: s.glow, alpha: 0, scale: s.glow.scale * 2, duration: 260, onComplete: () => s.glow.setVisible(false) });
        this.fxStars.explode(7, e.x, e.y);
        this.sfx('egg');
        this.emitHud(true);
        break;
      }
      case 'checkpoint': {
        const img = this.checkpointSprites[e.index];
        img.setTexture('checkpoint-on');
        this.tweens.add({ targets: img, scaleY: img.scaleY * 1.15, duration: 140, yoyo: true, ease: 'Quad.out' });
        this.fxStars.explode(10, e.x, e.y - 80);
        this.sfx('checkpoint');
        break;
      }
      case 'spring': {
        const cap = this.springCaps[e.index];
        const sy = (1 / TEX_SCALE) * 0.65;
        this.tweens.killTweensOf(cap);
        cap.setScale(cap.scaleX, sy * 0.45);
        this.tweens.add({ targets: cap, scaleY: sy, duration: 420, ease: 'Back.out' });
        this.squashV -= 3;
        this.sfx('spring');
        break;
      }
      case 'stomp': {
        const img = this.enemySprites[e.index];
        img.setTexture('beetle-flat');
        this.tweens.add({ targets: img, alpha: 0, delay: 500, duration: 300 });
        this.fxStars.explode(6, e.x, e.y);
        this.sfx('stomp');
        this.cameras.main.shake(90, 0.004);
        break;
      }
      case 'death':
        this.ballC.setVisible(false);
        this.fxShards.explode(18, e.x, e.y);
        this.fxStars.explode(10, e.x, e.y);
        this.sfx('death');
        this.cameras.main.shake(200, 0.008);
        this.emitHud(true);
        break;
      case 'respawn':
        this.ballC.setVisible(true);
        this.ballC.setScale(0.2);
        this.tweens.add({ targets: this.ballC, scale: 1, duration: 300, ease: 'Back.out' });
        this.fxStars.explode(8, e.x, e.y);
        this.sfx('respawn');
        this.camX = e.x;
        this.camY = e.y - 40;
        this.emitHud(true);
        break;
      case 'form':
        this.fxStars.explode(14, this.sim.state.ball.x, this.sim.state.ball.y);
        this.sfx('form');
        break;
      case 'win':
        this.sfx('win');
        this.handleWin();
        break;
      case 'gameover':
        this.sfx('gameover');
        this.time.delayedCall(500, () => this.bridge.onGameOver());
        break;
      case 'crushed':
        break;
    }
  }

  private handleWin() {
    if (this.winHandled) return;
    this.winHandled = true;
    const [gx, gy] = this.level.goal;
    this.tweens.add({ targets: this.ballC, x: gx, y: gy - 62, scale: 0, angle: 360, duration: 700, ease: 'Quad.in' });
    this.fxStars.explode(20, gx, gy - 62);
    const s = this.sim.state;
    const eggs: number[] = [];
    s.eggs.forEach((v, i) => v && eggs.push(i));
    const result: WinResult = { levelId: this.level.id, eggs, total: this.level.eggs.length, time: s.time, lives: s.lives };
    this.emitHud(true);
    this.time.delayedCall(900, () => this.bridge.onWin(result));
  }

  // ------------------------------------------------------------------ visuals
  private syncBall(dt: number) {
    const b = this.sim.state.ball;
    const r = this.sim.params.radius;
    // squash & stretch spring
    this.squashV += (-this.squash * 220 - this.squashV * 16) * dt;
    this.squash += this.squashV * dt;
    if (this.squash > 0.24) { this.squash = 0.24; this.squashV = 0; }
    if (this.squash < -0.18) { this.squash = -0.18; this.squashV = 0; }
    const sq = this.squash;
    if (!this.winHandled) {
      this.ballC.setPosition(b.x, b.y + sq * r * 0.6);
      if (this.ballC.visible && this.tweens.getTweensOf(this.ballC).length === 0) this.ballC.setScale(1 + sq * 0.55, 1 - sq * 0.75);
    }
    this.ballBand.setRotation(b.angle);
    // face: looks where it moves, blinks, gasps when falling fast
    const targetLook = Math.max(-1, Math.min(1, b.vx / 300));
    this.lookX += (targetLook - this.lookX) * Math.min(1, dt * 8);
    const fx = this.lookX * 5;
    const fy = Math.max(-2, Math.min(3, b.vy / 400));
    this.blinkT -= dt;
    let blink = 1;
    if (this.blinkT < 0) {
      blink = 0.15;
      if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;
    }
    const inv = 1 / TEX_SCALE;
    this.eyes.forEach((e, i) => {
      e.setPosition((i ? 7 : -7) + fx, -5 + fy * 0.5).setScale(inv, inv * blink);
      this.pupils[i].setPosition((i ? 7 : -7) + fx * 1.35, -4 + fy).setScale(inv, inv * blink);
    });
    const scared = b.vy > 650 || this.sim.state.status === 'dying';
    this.mouth.setTexture(scared ? 'mouth-o' : 'mouth-smile').setPosition(fx * 0.9, 7 + fy * 0.4);
    const key = `ball-${this.sim.state.form}`;
    if (this.ballBody.texture.key !== key) this.ballBody.setTexture(key);
    this.ballBand.setVisible(this.sim.state.form === 'normal');
  }

  private syncVisuals(dt: number) {
    const s = this.sim.state;
    this.syncBall(dt);
    this.sim.platforms.forEach((p, i) => this.platformObjs[i].setPosition(p.x, p.y));
    this.level.enemies.forEach((def, i) => {
      const e = s.enemies[i];
      const img = this.enemySprites[i];
      img.x = e.x;
      if (e.alive) {
        img.setTexture(Math.floor(s.time / 0.16) % 2 ? 'beetle-1' : 'beetle-0');
        img.setFlipX(e.dir > 0);
      }
      void def;
    });
    if (this.portalSwirl) this.portalSwirl.rotation += dt * 2.2;
    for (const c of this.clouds) {
      c.x += dt * 6;
      if (c.x > this.level.width * 0.06 + 2600) c.x -= 3800;
    }
    if (this.trail) {
      const b = s.ball;
      this.trailPts.push({ x: b.x, y: b.y });
      if (this.trailPts.length > 240) this.trailPts.shift();
      this.trail.clear();
      this.trail.fillStyle(0xffffff, 0.5);
      for (let i = 0; i < this.trailPts.length; i += 3) this.trail.fillCircle(this.trailPts[i].x, this.trailPts[i].y, 2);
    }
  }

  private applyCamera(dt: number, snap: boolean) {
    const cam = this.cameras.main;
    const b = this.sim.state.ball;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const L = this.level;
    const lookTarget = Math.max(-1, Math.min(1, b.vx / 300)) * viewW * 0.12;
    this.camLook += (lookTarget - this.camLook) * (snap ? 1 : Math.min(1, dt * 2.2));
    const tx = b.x + this.camLook;
    // vertical dead zone: ball may move within a band before the camera follows
    const band = viewH * 0.14;
    let ty = this.camY;
    const want = b.y - viewH * 0.06;
    if (want < this.camY - band) ty = want + band;
    else if (want > this.camY + band * 0.6) ty = want - band * 0.6;
    if (snap) {
      this.camX = tx;
      this.camY = want;
    } else {
      this.camX += (tx - this.camX) * Math.min(1, dt * 7);
      this.camY += (ty - this.camY) * Math.min(1, dt * 5);
    }
    const halfW = viewW / 2, halfH = viewH / 2;
    const cx = L.width > viewW ? Math.max(halfW, Math.min(L.width - halfW, this.camX)) : L.width / 2;
    const cy = Math.max(-200 + halfH, Math.min(L.height - halfH, this.camY));
    cam.centerOn(cx, cy);
  }

  private doCull() {
    const v = this.cameras.main.worldView;
    const m = 120;
    const x0 = v.x - m, x1 = v.right + m, y0 = v.y - m, y1 = v.bottom + m;
    for (const c of this.cull) {
      c.obj.setVisible(!(c.maxX < x0 || c.minX > x1 || c.maxY < y0 || c.minY > y1));
    }
  }

  private emitHud(force: boolean) {
    const s = this.sim.state;
    const h: HudState = { eggs: this.sim.eggsCollected, total: this.level.eggs.length, time: s.time, lives: s.lives, form: s.form };
    const key = `${h.eggs}|${Math.floor(h.time)}|${h.lives}|${h.form}`;
    if (!force && key === this.lastHudKey) return;
    this.lastHudKey = key;
    this.bridge.onHud(h);
  }

  private labTrack() {
    if (this.level.theme !== 'lab') return;
    const b = this.sim.state.ball;
    if (!b.grounded) {
      if (this.jumpStartY === null) {
        this.jumpStartY = b.y;
        this.jumpMinY = b.y;
        this.jumpStartT = this.sim.state.time;
      }
      this.jumpMinY = Math.min(this.jumpMinY, b.y);
    } else if (this.jumpStartY !== null) {
      const h = this.jumpStartY - this.jumpMinY;
      if (h > 4) {
        this.lastApex = h;
        this.lastAirTime = this.sim.state.time - this.jumpStartT;
      }
      this.jumpStartY = null;
    }
    if (this.bridge.onLabStats && this.sim.state.steps % 6 === 0) {
      this.bridge.onLabStats({ vx: b.vx, vy: b.vy, grounded: b.grounded, lastApex: this.lastApex, lastAirTime: this.lastAirTime, form: this.sim.state.form });
    }
  }
}
