/**
 * Procedural, original artwork drawn with Canvas 2D at TEX_SCALE pixels per world unit,
 * then registered as Phaser textures. No external image files.
 */
import type * as Phaser from 'phaser';

export const TEX_SCALE = 3;
const S = TEX_SCALE;

type Draw = (g: CanvasRenderingContext2D) => void;

function canvas(w: number, h: number, draw: Draw): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * S);
  c.height = Math.ceil(h * S);
  const g = c.getContext('2d')!;
  g.scale(S, S);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  return c;
}

function add(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw) {
  if (scene.textures.exists(key)) return;
  scene.textures.addCanvas(key, canvas(w, h, draw));
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
}

function ellipse(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

const OUTLINE = '#2a1633';

// ------------------------------------------------------------------ ball
function ballBody(g: CanvasRenderingContext2D, r: number, c0: string, c1: string, c2: string) {
  const cx = r + 2, cy = r + 2;
  const grad = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  grad.addColorStop(0, c0);
  grad.addColorStop(0.55, c1);
  grad.addColorStop(1, c2);
  circle(g, cx, cy, r);
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = 1.6;
  g.strokeStyle = OUTLINE;
  g.stroke();
}

export function createTextures(scene: Phaser.Scene, radius: number) {
  const r = radius;
  const bw = r * 2 + 4;
  add(scene, 'ball-normal', bw, bw, (g) => ballBody(g, r, '#ff8a6b', '#ef2b2b', '#a3101f'));
  add(scene, 'ball-heavy', bw, bw, (g) => {
    ballBody(g, r, '#c9c6c0', '#8d8a86', '#4f4c4b');
    const cx = r + 2, cy = r + 2;
    g.strokeStyle = 'rgba(40,30,40,0.55)';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(cx - r * 0.6, cy - r * 0.1); g.lineTo(cx - r * 0.25, cy + r * 0.05); g.lineTo(cx - r * 0.05, cy + r * 0.45);
    g.moveTo(cx + r * 0.25, cy - r * 0.7); g.lineTo(cx + r * 0.35, cy - r * 0.35); g.lineTo(cx + r * 0.65, cy - r * 0.2);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (const [dx, dy, rr] of [[-0.4, 0.4, 0.12], [0.45, 0.35, 0.09], [0.1, -0.2, 0.07]]) { circle(g, cx + dx * r, cy + dy * r, rr * r); g.fill(); }
  });
  add(scene, 'ball-light', bw, bw, (g) => {
    const cx = r + 2, cy = r + 2;
    const grad = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    grad.addColorStop(0, 'rgba(230,255,255,0.95)');
    grad.addColorStop(0.6, 'rgba(120,220,255,0.75)');
    grad.addColorStop(1, 'rgba(60,140,230,0.9)');
    circle(g, cx, cy, r); g.fillStyle = grad; g.fill();
    g.lineWidth = 1.6; g.strokeStyle = '#1d4f8f'; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy, r * 0.78, Math.PI * 0.1, Math.PI * 0.55); g.stroke();
  });
  // rolling band (rotates with the ball to show spin)
  add(scene, 'ball-band', bw, bw, (g) => {
    const cx = r + 2, cy = r + 2;
    g.save();
    circle(g, cx, cy, r - 1); g.clip();
    g.strokeStyle = 'rgba(80,0,20,0.18)';
    g.lineWidth = r * 0.28;
    g.beginPath(); g.ellipse(cx, cy, r * 0.35, r * 1.1, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  });
  add(scene, 'ball-shine', bw, bw, (g) => {
    const cx = r + 2, cy = r + 2;
    ellipse(g, cx - r * 0.38, cy - r * 0.5, r * 0.32, r * 0.18, -0.6);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
    circle(g, cx - r * 0.02, cy - r * 0.72, r * 0.07); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill();
  });
  // face parts (original design: big round eyes, little smile)
  add(scene, 'eye', 10, 12, (g) => {
    ellipse(g, 5, 6, 4.2, 5.2); g.fillStyle = '#fff'; g.fill();
    g.lineWidth = 1.2; g.strokeStyle = OUTLINE; g.stroke();
  });
  add(scene, 'pupil', 6, 6, (g) => {
    circle(g, 3, 3, 2.3); g.fillStyle = '#1b0d24'; g.fill();
    circle(g, 2.2, 2.1, 0.8); g.fillStyle = '#fff'; g.fill();
  });
  add(scene, 'mouth-smile', 14, 8, (g) => {
    g.beginPath(); g.moveTo(2, 2.5); g.quadraticCurveTo(7, 8, 12, 2.5);
    g.strokeStyle = OUTLINE; g.lineWidth = 1.6; g.stroke();
  });
  add(scene, 'mouth-o', 10, 10, (g) => {
    ellipse(g, 5, 5, 2.6, 3.2); g.fillStyle = '#5a0b1c'; g.fill(); g.strokeStyle = OUTLINE; g.lineWidth = 1.2; g.stroke();
  });

  // ------------------------------------------------------------------ collectibles & hazards
  add(scene, 'egg', 30, 36, (g) => {
    const grad = g.createRadialGradient(11, 12, 2, 15, 19, 17);
    grad.addColorStop(0, '#fff6c2'); grad.addColorStop(0.45, '#ffcc33'); grad.addColorStop(1, '#d4800f');
    g.beginPath();
    g.moveTo(15, 3);
    g.bezierCurveTo(25, 3, 28, 20, 27, 25);
    g.bezierCurveTo(26, 31, 21, 34, 15, 34);
    g.bezierCurveTo(9, 34, 4, 31, 3, 25);
    g.bezierCurveTo(2, 20, 5, 3, 15, 3);
    g.fillStyle = grad; g.fill();
    g.lineWidth = 1.4; g.strokeStyle = '#7a3e05'; g.stroke();
    ellipse(g, 10.5, 12, 3, 5, 0.3); g.fillStyle = 'rgba(255,255,255,0.75)'; g.fill();
  });
  add(scene, 'glow', 64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,240,170,0.75)'); grad.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  });
  add(scene, 'spike', 24, 26, (g) => {
    g.beginPath(); g.moveTo(1, 25); g.lineTo(12, 1.5); g.lineTo(23, 25); g.closePath();
    const grad = g.createLinearGradient(0, 0, 24, 0);
    grad.addColorStop(0, '#eef3ff'); grad.addColorStop(0.5, '#a7b4d6'); grad.addColorStop(1, '#5a6489');
    g.fillStyle = grad; g.fill();
    g.lineWidth = 1.4; g.strokeStyle = '#222443'; g.stroke();
    g.beginPath(); g.moveTo(12, 4); g.lineTo(8, 22); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; g.stroke();
  });

  // beetle enemy: two walk frames + squashed
  const beetle = (frame: number, flat = false) => (g: CanvasRenderingContext2D) => {
    const W = 56, H = 40;
    const by = flat ? H - 8 : H - 6;
    // legs
    if (!flat) {
      g.strokeStyle = OUTLINE; g.lineWidth = 2.2;
      const off = frame ? 3 : -3;
      for (const lx of [16, 28, 40]) {
        g.beginPath(); g.moveTo(lx, by - 6); g.lineTo(lx + (lx === 28 ? -off : off), H - 1); g.stroke();
      }
    }
    // shell
    const sy = flat ? 0.45 : 1;
    g.save();
    g.translate(W / 2, by);
    g.scale(1, sy);
    g.beginPath(); g.ellipse(0, -12, 22, 18, 0, Math.PI, 0); g.lineTo(22, -4); g.quadraticCurveTo(0, 2, -22, -4); g.closePath();
    const grad = g.createLinearGradient(0, -30, 0, 0);
    grad.addColorStop(0, '#b56cff'); grad.addColorStop(1, '#5a1f9c');
    g.fillStyle = grad; g.fill(); g.lineWidth = 2 / sy; g.strokeStyle = OUTLINE; g.stroke();
    g.beginPath(); g.moveTo(0, -29); g.lineTo(0, -2); g.strokeStyle = 'rgba(40,10,60,0.6)'; g.lineWidth = 1.6; g.stroke();
    for (const [dx, dy] of [[-10, -18], [9, -20], [-6, -9], [12, -9]]) { circle(g, dx, dy, 2.6); g.fillStyle = '#ffd84a'; g.fill(); }
    g.restore();
    // head with angry eyes (faces left in texture; flipped by code)
    if (!flat) {
      circle(g, 8, by - 12, 8); g.fillStyle = '#3b1460'; g.fill(); g.strokeStyle = OUTLINE; g.lineWidth = 1.6; g.stroke();
      circle(g, 6, by - 14, 3.2); g.fillStyle = '#fff'; g.fill();
      circle(g, 5.2, by - 13.4, 1.6); g.fillStyle = '#111'; g.fill();
      g.beginPath(); g.moveTo(2, by - 19); g.lineTo(10, by - 16); g.strokeStyle = '#ffd84a'; g.lineWidth = 1.6; g.stroke();
      g.beginPath(); g.moveTo(6, by - 20); g.quadraticCurveTo(2, by - 30, -1, by - 27); g.strokeStyle = OUTLINE; g.lineWidth = 1.4; g.stroke();
    } else {
      g.strokeStyle = OUTLINE; g.lineWidth = 1.5;
      for (const x of [12, 18]) { g.beginPath(); g.moveTo(x - 2, by - 6); g.lineTo(x + 2, by - 2); g.moveTo(x + 2, by - 6); g.lineTo(x - 2, by - 2); g.stroke(); }
    }
  };
  add(scene, 'beetle-0', 56, 40, beetle(0));
  add(scene, 'beetle-1', 56, 40, beetle(1));
  add(scene, 'beetle-flat', 56, 40, beetle(0, true));

  // spring mushroom
  add(scene, 'spring-cap', 64, 30, (g) => {
    g.beginPath(); g.moveTo(3, 26); g.quadraticCurveTo(4, 2, 32, 2); g.quadraticCurveTo(60, 2, 61, 26); g.quadraticCurveTo(32, 30, 3, 26); g.closePath();
    const grad = g.createLinearGradient(0, 0, 0, 30);
    grad.addColorStop(0, '#ff7ac8'); grad.addColorStop(1, '#c42f86');
    g.fillStyle = grad; g.fill(); g.lineWidth = 2; g.strokeStyle = OUTLINE; g.stroke();
    for (const [x, y, rr] of [[18, 12, 4.5], [34, 8, 3.5], [47, 15, 4], [27, 21, 3]]) { circle(g, x, y, rr); g.fillStyle = '#fff3fb'; g.fill(); }
  });
  add(scene, 'spring-stem', 26, 24, (g) => {
    g.beginPath(); g.moveTo(6, 0); g.quadraticCurveTo(3, 14, 4, 23); g.lineTo(22, 23); g.quadraticCurveTo(23, 14, 20, 0); g.closePath();
    g.fillStyle = '#fff1d6'; g.fill(); g.lineWidth = 2; g.strokeStyle = OUTLINE; g.stroke();
  });

  // checkpoint: wooden post with a lantern flower
  const cp = (on: boolean) => (g: CanvasRenderingContext2D) => {
    g.fillStyle = '#8a5a33'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
    g.beginPath(); g.roundRect(15, 18, 8, 80, 3); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(23, 22); g.lineTo(52, 30); g.lineTo(23, 42); g.closePath();
    g.fillStyle = on ? '#4ee07a' : '#9aa0aa'; g.fill(); g.stroke();
    circle(g, 19, 14, 9);
    g.fillStyle = on ? '#fff36b' : '#c7c7c7'; g.fill(); g.stroke();
    if (on) { circle(g, 19, 14, 4); g.fillStyle = '#fffbe0'; g.fill(); }
  };
  add(scene, 'checkpoint-off', 56, 100, cp(false));
  add(scene, 'checkpoint-on', 56, 100, cp(true));

  // goal portal
  add(scene, 'portal-frame', 120, 150, (g) => {
    g.lineWidth = 14; g.strokeStyle = '#5b3a21';
    g.beginPath(); g.moveTo(20, 150); g.lineTo(20, 60); g.arc(60, 60, 40, Math.PI, 0); g.lineTo(100, 150); g.stroke();
    g.lineWidth = 8; g.strokeStyle = '#8f5d34';
    g.beginPath(); g.moveTo(20, 150); g.lineTo(20, 60); g.arc(60, 60, 40, Math.PI, 0); g.lineTo(100, 150); g.stroke();
    // vines & leaves
    g.lineWidth = 3; g.strokeStyle = '#3e9a37';
    g.beginPath(); g.moveTo(14, 140); g.bezierCurveTo(30, 110, 8, 90, 24, 60); g.bezierCurveTo(40, 20, 80, 20, 96, 60); g.bezierCurveTo(110, 90, 90, 110, 106, 140); g.stroke();
    for (const [x, y, a] of [[18, 112, -0.6], [26, 74, 0.6], [44, 30, -0.2], [78, 30, 0.3], [98, 78, -0.5], [100, 118, 0.6], [60, 18, 0]]) {
      g.save(); g.translate(x, y); g.rotate(a); ellipse(g, 0, 0, 8, 4.5); g.fillStyle = '#6fd14a'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#245f1f'; g.stroke(); g.restore();
    }
    for (const [x, y] of [[34, 40], [88, 48], [16, 92]]) { circle(g, x, y, 4); g.fillStyle = '#ffde59'; g.fill(); }
  });
  add(scene, 'portal-swirl', 80, 80, (g) => {
    const grad = g.createRadialGradient(40, 40, 2, 40, 40, 40);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(140,240,255,0.9)'); grad.addColorStop(1, 'rgba(90,120,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 80, 80);
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2.5;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      for (let t = 0; t < 1; t += 0.02) {
        const a = t * Math.PI * 3 + (k * Math.PI * 2) / 3;
        const rr = 4 + t * 30;
        const x = 40 + Math.cos(a) * rr, y = 40 + Math.sin(a) * rr;
        if (t === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  });

  // form pads
  const pad = (c1: string, c2: string, icon: Draw) => (g: CanvasRenderingContext2D) => {
    g.beginPath(); g.ellipse(30, 20, 26, 10, 0, 0, Math.PI * 2);
    const grad = g.createLinearGradient(0, 10, 0, 30); grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    g.fillStyle = grad; g.fill(); g.lineWidth = 2; g.strokeStyle = OUTLINE; g.stroke();
    icon(g);
  };
  add(scene, 'pad-heavy', 60, 34, pad('#d6d1c8', '#7a756d', (g) => { circle(g, 30, 16, 6); g.fillStyle = '#5f5b57'; g.fill(); }));
  add(scene, 'pad-light', 60, 34, pad('#b8f2ff', '#4aa7e0', (g) => { circle(g, 30, 16, 6); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fill(); }));
  add(scene, 'pad-normal', 60, 34, pad('#ffb3a3', '#d62a2a', (g) => { circle(g, 30, 16, 6); g.fillStyle = '#ff4b4b'; g.fill(); }));

  // ------------------------------------------------------------------ particles
  add(scene, 'p-star', 16, 16, (g) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? 3 : 7.5;
      const x = 8 + Math.cos(a) * rr, y = 8 + Math.sin(a) * rr;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.fillStyle = '#fff6a8'; g.fill(); g.lineWidth = 1; g.strokeStyle = '#d18a00'; g.stroke();
  });
  add(scene, 'p-dot', 10, 10, (g) => { circle(g, 5, 5, 4.5); g.fillStyle = '#ffffff'; g.fill(); });
  add(scene, 'p-shard', 10, 10, (g) => { g.beginPath(); g.moveTo(1, 9); g.lineTo(5, 1); g.lineTo(9, 7); g.closePath(); g.fillStyle = '#ffffff'; g.fill(); });
  add(scene, 'p-leaf', 12, 8, (g) => { ellipse(g, 6, 4, 5.5, 3); g.fillStyle = '#ffffff'; g.fill(); });

  // ------------------------------------------------------------------ scenery
  add(scene, 'cloud', 160, 70, (g) => {
    g.fillStyle = 'rgba(255,255,255,0.95)';
    for (const [x, y, rr] of [[40, 45, 24], [72, 32, 30], [108, 42, 24], [130, 50, 16], [22, 52, 14]]) { circle(g, x, y, rr); g.fill(); }
    g.fillRect(22, 45, 112, 22);
    g.fillStyle = 'rgba(190,225,255,0.5)'; g.fillRect(22, 60, 112, 7);
  });

  const treePal = [
    ['#5ccf6d', '#2f9a52', '#1d6b3f'],
    ['#9be35a', '#56b532', '#2f7d22'],
    ['#4fd4b0', '#239c86', '#146a5f'],
  ];
  treePal.forEach((p, i) => add(scene, `tree-${i}`, 150, 230, (g) => {
    // trunk
    g.beginPath(); g.moveTo(66, 230); g.bezierCurveTo(70, 180, 62, 140, 72, 100); g.lineTo(84, 100); g.bezierCurveTo(90, 140, 82, 180, 88, 230); g.closePath();
    g.fillStyle = '#7a4b2e'; g.fill(); g.lineWidth = 2; g.strokeStyle = OUTLINE; g.stroke();
    g.beginPath(); g.moveTo(76, 150); g.quadraticCurveTo(98, 140, 108, 118); g.lineWidth = 6; g.strokeStyle = '#7a4b2e'; g.stroke();
    // canopy blobs
    const blobs: [number, number, number][] = [[75, 70, 52], [40, 95, 32], [112, 92, 32], [60, 40, 30], [96, 46, 30]];
    for (const [x, y, rr] of blobs) { circle(g, x, y, rr + 2); g.fillStyle = OUTLINE; g.fill(); }
    for (const [x, y, rr] of blobs) { circle(g, x, y, rr); g.fillStyle = p[1]; g.fill(); }
    for (const [x, y, rr] of blobs) { circle(g, x - rr * 0.2, y - rr * 0.25, rr * 0.62); g.fillStyle = p[0]; g.fill(); }
    for (const [x, y] of [[50, 104], [96, 108], [74, 96]]) { circle(g, x, y, 9); g.fillStyle = p[2]; g.fill(); }
  }));
  add(scene, 'pine', 100, 200, (g) => {
    g.fillStyle = '#6b3f26'; g.fillRect(44, 150, 12, 50);
    for (let k = 0; k < 4; k++) {
      const y = 30 + k * 32, w = 26 + k * 12;
      g.beginPath(); g.moveTo(50, y - 28); g.lineTo(50 + w, y + 26); g.lineTo(50 - w, y + 26); g.closePath();
      g.fillStyle = k % 2 ? '#2a8a5c' : '#36a86e'; g.fill(); g.lineWidth = 2; g.strokeStyle = OUTLINE; g.stroke();
    }
  });
  const flowerCols = [['#ff5a7a', '#ffd84a'], ['#ffffff', '#ffb02e'], ['#6aa8ff', '#fff07a']];
  flowerCols.forEach((c, i) => add(scene, `flower-${i}`, 40, 60, (g) => {
    g.beginPath(); g.moveTo(20, 60); g.quadraticCurveTo(16, 40, 20, 22); g.lineWidth = 3; g.strokeStyle = '#2f8a3a'; g.stroke();
    ellipse(g, 12, 44, 7, 3.5, -0.5); g.fillStyle = '#4fbf4a'; g.fill();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      ellipse(g, 20 + Math.cos(a) * 8, 18 + Math.sin(a) * 8, 6.5, 4.5, a);
      g.fillStyle = c[0]; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUTLINE; g.stroke();
    }
    circle(g, 20, 18, 5); g.fillStyle = c[1]; g.fill(); g.stroke();
  }));
  const mushCols = [['#ff6b4a', '#fff2e0'], ['#ffb02e', '#fff2e0']];
  mushCols.forEach((c, i) => add(scene, `mushroom-${i}`, 60, 60, (g) => {
    g.beginPath(); g.moveTo(24, 60); g.quadraticCurveTo(22, 40, 26, 28); g.lineTo(36, 28); g.quadraticCurveTo(40, 40, 38, 60); g.closePath();
    g.fillStyle = c[1]; g.fill(); g.lineWidth = 2; g.strokeStyle = OUTLINE; g.stroke();
    g.beginPath(); g.moveTo(4, 32); g.quadraticCurveTo(8, 4, 31, 4); g.quadraticCurveTo(54, 4, 58, 32); g.quadraticCurveTo(31, 38, 4, 32); g.closePath();
    g.fillStyle = c[0]; g.fill(); g.stroke();
    for (const [x, y, rr] of [[18, 18, 4], [34, 12, 3], [44, 22, 3.5]]) { circle(g, x, y, rr); g.fillStyle = '#fff'; g.fill(); }
  }));
  const bushCols = [['#58c95a', '#2f8f3e'], ['#4fcfa0', '#22806a']];
  bushCols.forEach((c, i) => add(scene, `bush-${i}`, 110, 56, (g) => {
    const b: [number, number, number][] = [[25, 38, 20], [52, 28, 26], [82, 36, 22], [100, 44, 12]];
    for (const [x, y, rr] of b) { circle(g, x, y, rr + 2); g.fillStyle = OUTLINE; g.fill(); }
    for (const [x, y, rr] of b) { circle(g, x, y, rr); g.fillStyle = c[1]; g.fill(); }
    for (const [x, y, rr] of b) { circle(g, x - 4, y - 6, rr * 0.6); g.fillStyle = c[0]; g.fill(); }
    g.fillStyle = c[1]; g.fillRect(6, 44, 100, 12);
  }));
  add(scene, 'rock', 70, 44, (g) => {
    g.beginPath(); g.moveTo(4, 44); g.quadraticCurveTo(2, 18, 22, 10); g.quadraticCurveTo(40, 0, 56, 14); g.quadraticCurveTo(70, 26, 66, 44); g.closePath();
    const grad = g.createLinearGradient(0, 0, 0, 44); grad.addColorStop(0, '#b9b4c9'); grad.addColorStop(1, '#6d6784');
    g.fillStyle = grad; g.fill(); g.lineWidth = 2; g.strokeStyle = OUTLINE; g.stroke();
    ellipse(g, 26, 16, 9, 4, -0.3); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();
  });
  add(scene, 'grass', 50, 26, (g) => {
    g.fillStyle = '#5fc94a'; g.strokeStyle = '#2d7a2a'; g.lineWidth = 1.4;
    for (const [x, h, lean] of [[8, 16, -4], [16, 24, -2], [24, 20, 3], [32, 25, 1], [40, 15, 5]]) {
      g.beginPath(); g.moveTo(x - 4, 26); g.quadraticCurveTo(x, 26 - h * 0.5, x + lean, 26 - h); g.quadraticCurveTo(x + 1, 26 - h * 0.5, x + 4, 26); g.closePath(); g.fill(); g.stroke();
    }
  });
  add(scene, 'fern', 70, 50, (g) => {
    g.strokeStyle = '#2b7a35'; g.lineWidth = 2.4;
    for (const [a, len] of [[-2.4, 40], [-1.9, 46], [-1.4, 44], [-1.0, 38], [-0.6, 30]]) {
      g.beginPath(); g.moveTo(35, 50);
      const ex = 35 + Math.cos(a) * len, ey = 50 + Math.sin(a) * len;
      g.quadraticCurveTo(35 + Math.cos(a) * len * 0.4, 50 + Math.sin(a) * len * 0.8, ex, ey); g.stroke();
      for (let t = 0.3; t < 1; t += 0.15) {
        const px = 35 + (ex - 35) * t, py = 50 + (ey - 50) * t;
        ellipse(g, px, py, 5, 2.4, a + 1.2); g.fillStyle = '#58c45a'; g.fill();
      }
    }
  });
  add(scene, 'crystal', 50, 60, (g) => {
    const shards: [number, number, number, number][] = [[25, 2, 10, 58], [12, 20, 8, 58], [38, 16, 8, 58]];
    for (const [x, top, w, bot] of shards) {
      g.beginPath(); g.moveTo(x, top); g.lineTo(x + w, top + 14); g.lineTo(x + w * 0.7, bot); g.lineTo(x - w * 0.7, bot); g.lineTo(x - w, top + 14); g.closePath();
      const grad = g.createLinearGradient(x - w, 0, x + w, 0); grad.addColorStop(0, '#ffd0f4'); grad.addColorStop(1, '#c14fd0');
      g.fillStyle = grad; g.fill(); g.lineWidth = 1.8; g.strokeStyle = OUTLINE; g.stroke();
      g.beginPath(); g.moveTo(x, top + 4); g.lineTo(x - 2, bot - 6); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.2; g.stroke();
    }
  });
  for (const [key, text] of [['sign-!', '!'], ['sign-→', '→']] as const) {
    add(scene, key, 60, 70, (g) => {
      g.fillStyle = '#8a5a33'; g.strokeStyle = OUTLINE; g.lineWidth = 2;
      g.beginPath(); g.roundRect(26, 30, 8, 40, 2); g.fill(); g.stroke();
      if (text === '!') {
        g.beginPath(); g.moveTo(30, 2); g.lineTo(56, 44); g.lineTo(4, 44); g.closePath();
        g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 2.5; g.stroke();
        g.fillStyle = OUTLINE; g.fillRect(28, 16, 4, 14); circle(g, 30, 36, 2.6); g.fill();
      } else {
        g.beginPath(); g.roundRect(6, 8, 48, 28, 5); g.fillStyle = '#c98a4e'; g.fill(); g.stroke();
        g.beginPath(); g.moveTo(16, 22); g.lineTo(42, 22); g.moveTo(34, 14); g.lineTo(43, 22); g.lineTo(34, 30);
        g.strokeStyle = '#fff4dc'; g.lineWidth = 4; g.stroke();
      }
    });
  }
}
