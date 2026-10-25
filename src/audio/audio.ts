/**
 * Original synthesized audio (Web Audio API). No sample files.
 * Safari/iOS: the AudioContext is created/resumed inside a user gesture (unlock()).
 */
export type Sfx =
  | 'jump' | 'land' | 'bounce' | 'egg' | 'checkpoint' | 'spring' | 'stomp'
  | 'death' | 'respawn' | 'win' | 'gameover' | 'click' | 'form';

type Ctx = AudioContext;

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  private ctx: Ctx | null = null;
  private master!: GainNode;
  private sfxGain!: GainNode;
  private musicGain!: GainNode;
  private noise!: AudioBuffer;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private nextNoteTime = 0;
  private musicOn = false;
  private lastPlay: Partial<Record<Sfx, number>> = {};
  musicVolume = 0.55;
  sfxVolume = 0.8;

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture (touchend/click/keydown). */
  unlock() {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        this.master.connect(comp).connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain();
        this.musicGain = this.ctx.createGain();
        this.sfxGain.connect(this.master);
        this.musicGain.connect(this.master);
        this.applyVolumes();
        const len = this.ctx.sampleRate * 1;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        // iOS unlock: play a silent buffer inside the gesture.
        const silent = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = silent;
        src.connect(this.ctx.destination);
        src.start(0);
      }
      if (this.ctx.state !== 'running') void this.ctx.resume();
    } catch {
      /* audio unavailable: game keeps working silently */
    }
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxGain.gain.setTargetAtTime(this.sfxVolume * 0.9, t, 0.02);
    this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.32, t, 0.05);
  }

  // ---------- primitives ----------
  private tone(type: OscillatorType, f0: number, f1: number, t0: number, dur: number, vol: number, out: AudioNode, attack = 0.005) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noiseBurst(t0: number, dur: number, vol: number, freq: number, out: AudioNode, q = 1) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t0, Math.random() * 0.5);
    s.stop(t0 + dur + 0.02);
  }

  play(name: Sfx, intensity = 1) {
    if (!this.ctx || this.ctx.state !== 'running' || this.sfxVolume <= 0) return;
    const now = this.ctx.currentTime;
    const last = this.lastPlay[name] ?? -1;
    if (now - last < 0.035) return; // avoid stacking the same sound
    this.lastPlay[name] = now;
    const o = this.sfxGain;
    const k = Math.max(0.15, Math.min(1, intensity));
    switch (name) {
      case 'jump':
        this.tone('square', 300, 620, now, 0.13, 0.12, o);
        this.tone('sine', 600, 1100, now, 0.1, 0.08, o);
        break;
      case 'land':
        this.tone('sine', 140, 60, now, 0.12, 0.35 * k, o);
        this.noiseBurst(now, 0.06, 0.08 * k, 900, o);
        break;
      case 'bounce':
        this.tone('sine', 220 + 120 * k, 110, now, 0.14, 0.3 * k, o);
        this.tone('triangle', 520, 300, now, 0.08, 0.06 * k, o);
        break;
      case 'egg': {
        const base = 76 + Math.floor(Math.random() * 3) * 2;
        this.tone('triangle', NOTE(base), NOTE(base), now, 0.09, 0.16, o);
        this.tone('triangle', NOTE(base + 7), NOTE(base + 7), now + 0.06, 0.16, 0.15, o);
        this.tone('sine', NOTE(base + 19), NOTE(base + 19), now + 0.06, 0.2, 0.05, o);
        break;
      }
      case 'checkpoint':
        [72, 76, 79, 84].forEach((n, i) => this.tone('triangle', NOTE(n), NOTE(n), now + i * 0.07, 0.22, 0.14, o));
        break;
      case 'spring':
        this.tone('sine', 180, 900, now, 0.28, 0.28, o, 0.01);
        this.tone('square', 90, 400, now, 0.2, 0.05, o);
        break;
      case 'stomp':
        this.tone('square', 420, 90, now, 0.16, 0.14, o);
        this.noiseBurst(now, 0.1, 0.18, 600, o);
        break;
      case 'death':
        this.noiseBurst(now, 0.35, 0.35, 1400, o, 0.6);
        this.tone('square', 520, 70, now, 0.5, 0.12, o);
        break;
      case 'respawn':
        [67, 71, 74].forEach((n, i) => this.tone('sine', NOTE(n), NOTE(n), now + i * 0.06, 0.16, 0.12, o));
        break;
      case 'form':
        this.tone('sine', 300, 1200, now, 0.3, 0.14, o);
        this.noiseBurst(now, 0.25, 0.08, 3000, o, 2);
        break;
      case 'win':
        [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => {
          this.tone('square', NOTE(n), NOTE(n), now + i * 0.11, 0.2, 0.07, o);
          this.tone('triangle', NOTE(n - 12), NOTE(n - 12), now + i * 0.11, 0.22, 0.14, o);
        });
        break;
      case 'gameover':
        [67, 63, 60, 55].forEach((n, i) => this.tone('triangle', NOTE(n), NOTE(n), now + i * 0.22, 0.3, 0.16, o));
        break;
      case 'click':
        this.tone('sine', 880, 660, now, 0.05, 0.08, o);
        break;
    }
  }

  // ---------- music: original looping tune, scheduled ahead ----------
  // 16th-note grid at 112 BPM. Two 8-bar sections (A/B), C major / A minor.
  private readonly bpm = 112;
  private readonly bass = [
    [36, 36, 43, 36], [41, 41, 48, 41], [45, 45, 52, 45], [43, 43, 50, 43],
    [36, 36, 43, 36], [41, 41, 48, 41], [43, 43, 50, 43], [43, 47, 50, 55],
    [45, 45, 52, 45], [41, 41, 48, 41], [36, 36, 43, 36], [43, 43, 50, 43],
    [45, 45, 52, 45], [41, 41, 48, 41], [43, 43, 50, 43], [36, 43, 48, 36],
  ];
  // melody: [step(0..15), midi, length in 16ths] per bar
  private readonly melody: [number, number, number][][] = [
    [[0, 72, 2], [2, 76, 2], [4, 79, 3], [8, 77, 2], [10, 76, 2], [12, 74, 4]],
    [[0, 72, 2], [2, 74, 2], [4, 76, 2], [6, 77, 2], [8, 76, 4], [12, 72, 4]],
    [[0, 76, 2], [2, 79, 2], [4, 81, 4], [8, 79, 2], [10, 77, 2], [12, 76, 4]],
    [[0, 74, 2], [2, 76, 2], [4, 77, 2], [6, 79, 2], [8, 74, 6]],
    [[0, 72, 2], [2, 76, 2], [4, 79, 3], [8, 84, 2], [10, 83, 2], [12, 81, 4]],
    [[0, 77, 2], [2, 81, 2], [4, 84, 4], [8, 81, 2], [10, 79, 2], [12, 77, 4]],
    [[0, 76, 2], [2, 74, 2], [4, 72, 2], [6, 74, 2], [8, 76, 2], [10, 79, 2], [12, 74, 4]],
    [[0, 72, 6], [8, 79, 2], [10, 81, 2], [12, 83, 4]],
    [[0, 84, 3], [4, 83, 2], [6, 81, 2], [8, 79, 4], [12, 76, 4]],
    [[0, 77, 2], [2, 79, 2], [4, 81, 4], [8, 77, 2], [10, 76, 2], [12, 74, 4]],
    [[0, 76, 2], [2, 77, 2], [4, 79, 4], [8, 84, 4], [12, 79, 4]],
    [[0, 74, 2], [2, 76, 2], [4, 77, 2], [6, 76, 2], [8, 74, 4], [12, 71, 4]],
    [[0, 72, 2], [2, 76, 2], [4, 81, 4], [8, 79, 2], [10, 76, 2], [12, 72, 4]],
    [[0, 77, 2], [2, 76, 2], [4, 74, 2], [6, 72, 2], [8, 69, 4], [12, 72, 4]],
    [[0, 74, 3], [4, 76, 3], [8, 77, 2], [10, 79, 2], [12, 83, 4]],
    [[0, 84, 8], [8, 79, 2], [10, 76, 2], [12, 72, 4]],
  ];

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    const tick = () => {
      if (!this.ctx || !this.musicOn) return;
      const sixteenth = 60 / this.bpm / 4;
      while (this.nextNoteTime < this.ctx.currentTime + 0.15) {
        this.scheduleStep(this.musicStep, this.nextNoteTime, sixteenth);
        this.nextNoteTime += sixteenth;
        this.musicStep = (this.musicStep + 1) % (16 * 16);
      }
    };
    tick();
    this.musicTimer = window.setInterval(tick, 40);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleStep(step: number, t: number, s16: number) {
    if (this.musicVolume <= 0) return;
    const bar = Math.floor(step / 16);
    const pos = step % 16;
    const out = this.musicGain;
    // bass on quarter notes
    if (pos % 4 === 0) {
      const n = this.bass[bar][pos / 4];
      this.tone('triangle', NOTE(n), NOTE(n), t, s16 * 3.2, 0.5, out, 0.01);
    }
    // off-beat chord pluck
    if (pos % 4 === 2) {
      const root = this.bass[bar][0] + 24;
      const third = [45, 52].includes(this.bass[bar][0]) ? 3 : 4;
      for (const iv of [0, third, 7]) this.tone('sine', NOTE(root + iv), NOTE(root + iv), t, s16 * 1.6, 0.07, out, 0.004);
    }
    // melody
    for (const [st, n, len] of this.melody[bar]) {
      if (st === pos) {
        this.tone('square', NOTE(n), NOTE(n), t, s16 * len * 0.92, 0.075, out, 0.01);
        this.tone('triangle', NOTE(n + 12), NOTE(n + 12), t, s16 * len * 0.6, 0.03, out, 0.01);
      }
    }
    // light percussion
    if (pos % 4 === 0) this.noiseBurst(t, 0.05, pos % 8 === 0 ? 0.12 : 0.06, 120, out, 0.7);
    if (pos % 2 === 1) this.noiseBurst(t, 0.03, 0.035, 8000, out, 1.5);
    if (pos === 4 || pos === 12) this.noiseBurst(t, 0.09, 0.08, 1800, out, 0.8);
  }
}
