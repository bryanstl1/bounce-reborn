import type { BallInput } from '../physics/ball';

/**
 * Unified input: keyboard + multi-touch on-screen buttons.
 * Touch uses pointer events with zones, so a thumb can slide between ◀ and ▶
 * without lifting, and several fingers are tracked independently.
 */
export class InputController {
  private keys = new Set<string>();
  private pointers = new Map<number, 'left' | 'right' | 'jump' | null>();
  private jumpLatch = false;
  enabled = true;
  onPause: (() => void) | null = null;
  onRestart: (() => void) | null = null;
  onAnyInput: (() => void) | null = null;
  /** true once a touch has been seen */
  touchMode = false;

  private leftBtn: HTMLElement;
  private rightBtn: HTMLElement;
  private jumpBtn: HTMLElement;
  private layer: HTMLElement;

  constructor(layer: HTMLElement) {
    this.layer = layer;
    this.leftBtn = layer.querySelector('[data-btn=left]')!;
    this.rightBtn = layer.querySelector('[data-btn=right]')!;
    this.jumpBtn = layer.querySelector('[data-btn=jump]')!;

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.clear());

    const opts = { passive: false } as AddEventListenerOptions;
    layer.addEventListener('pointerdown', (e) => this.onPointer(e, 'down'), opts);
    layer.addEventListener('pointermove', (e) => this.onPointer(e, 'move'), opts);
    layer.addEventListener('pointerup', (e) => this.onPointer(e, 'up'), opts);
    layer.addEventListener('pointercancel', (e) => this.onPointer(e, 'up'), opts);
    layer.addEventListener('lostpointercapture', (e) => this.onPointer(e as PointerEvent, 'up'), opts);
    // Stop iOS scrolling / zoom / callouts on the play surface.
    for (const ev of ['touchstart', 'touchmove', 'touchend']) {
      layer.addEventListener(ev, (e) => e.preventDefault(), opts);
    }
    window.addEventListener('touchstart', () => { this.touchMode = true; document.body.classList.add('touch'); }, { passive: true });
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const k = e.code;
    const game = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'Space', 'KeyZ', 'KeyX'];
    if (game.includes(k)) e.preventDefault();
    if (down) {
      this.onAnyInput?.();
      if (!e.repeat && this.isJumpKey(k) && this.enabled) this.jumpLatch = true;
      if (!e.repeat && (k === 'Escape' || k === 'KeyP')) this.onPause?.();
      if (!e.repeat && k === 'KeyR') this.onRestart?.();
      this.keys.add(k);
    } else {
      this.keys.delete(k);
    }
  }

  private isJumpKey(k: string) {
    return k === 'ArrowUp' || k === 'KeyW' || k === 'Space' || k === 'KeyZ' || k === 'KeyX';
  }

  /** Which control a screen point maps to (thumb zones, bigger than the drawn buttons). */
  private zoneAt(x: number, y: number): 'left' | 'right' | 'jump' | null {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (y < h * 0.22) return null; // top strip reserved for HUD / pause
    if (x >= w * 0.5) return 'jump';
    const l = this.leftBtn.getBoundingClientRect();
    const r = this.rightBtn.getBoundingClientRect();
    const split = (l.right + r.left) / 2;
    return x < split ? 'left' : 'right';
  }

  private onPointer(e: PointerEvent, phase: 'down' | 'move' | 'up') {
    if (e.pointerType === 'mouse' && phase !== 'up' && e.buttons === 0) return;
    e.preventDefault();
    this.touchMode = this.touchMode || e.pointerType === 'touch';
    if (phase === 'down') {
      this.onAnyInput?.();
      try { this.layer.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const z = this.zoneAt(e.clientX, e.clientY);
      this.pointers.set(e.pointerId, z);
      if (z === 'jump' && this.enabled) this.jumpLatch = true;
    } else if (phase === 'move') {
      if (!this.pointers.has(e.pointerId)) return;
      const prev = this.pointers.get(e.pointerId);
      let z = this.zoneAt(e.clientX, e.clientY);
      // a finger that started on the d-pad stays a d-pad finger; one on jump stays jump
      if (prev === 'jump') z = 'jump';
      else if (z === 'jump') z = prev ?? null;
      this.pointers.set(e.pointerId, z);
    } else {
      this.pointers.delete(e.pointerId);
    }
    this.renderButtons();
  }

  private renderButtons() {
    const s = this.touchState();
    this.leftBtn.classList.toggle('on', s.left);
    this.rightBtn.classList.toggle('on', s.right);
    this.jumpBtn.classList.toggle('on', s.jump);
  }

  private touchState() {
    let left = false, right = false, jump = false;
    for (const z of this.pointers.values()) {
      if (z === 'left') left = true;
      else if (z === 'right') right = true;
      else if (z === 'jump') jump = true;
    }
    return { left, right, jump };
  }

  clear() {
    this.keys.clear();
    this.pointers.clear();
    this.jumpLatch = false;
    this.renderButtons();
  }

  /** Called once per fixed simulation step. */
  sample(): BallInput {
    if (!this.enabled) return { left: false, right: false, jumpHeld: false, jumpPressed: false };
    const t = this.touchState();
    const k = this.keys;
    const left = t.left || k.has('ArrowLeft') || k.has('KeyA');
    const right = t.right || k.has('ArrowRight') || k.has('KeyD');
    const jumpHeld = t.jump || k.has('ArrowUp') || k.has('KeyW') || k.has('Space') || k.has('KeyZ') || k.has('KeyX');
    const jumpPressed = this.jumpLatch;
    this.jumpLatch = false;
    return { left, right, jumpHeld: jumpHeld || jumpPressed, jumpPressed };
  }
}
