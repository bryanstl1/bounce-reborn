import { expect, test, type Page } from 'playwright/test';

type Ball = { x: number; y: number; vx: number; vy: number; grounded: boolean };
type State = { ball: Ball; status: string; lives: number; checkpoint: number; time: number; steps: number };

const errors: string[] = [];

async function boot(page: Page) {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // fonts.googleapis may be unreachable in CI sandboxes; that is not a game error
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto('/');
  await expect(page.locator('#title')).toBeVisible();
  await page.waitForFunction(() => (window as any).__game?.isBooted === true);
}

async function startLevel(page: Page, id = 'forest-01') {
  await page.evaluate((id) => (window as any).__BOUNCE.start(id), id);
  await page.waitForFunction(() => (window as any).__BOUNCE.state()?.steps > 30);
}

const state = (page: Page) => page.evaluate(() => (window as any).__BOUNCE.state() as State);

/** Waits for simulated game time (robust on slow headless renderers). */
async function simWait(page: Page, seconds: number) {
  const t0 = (await state(page)).time;
  await page.waitForFunction((t) => (window as any).__BOUNCE.state().time >= t, t0 + seconds, { timeout: 60_000 });
}

test.afterEach(() => {
  expect(errors, 'no JavaScript errors').toEqual([]);
});

test('boots to the title screen and opens the first level', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: /Jugar/ }).click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#eggTxt')).toHaveText(/^0\/\d+$/);
  await expect(page.locator('canvas')).toBeVisible();
  const s = await state(page);
  expect(s.status).toBe('playing');
});

test('ball rests on the ground, rolls with inertia and jumps', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await startLevel(page);
  await simWait(page, 0.4);
  const s0 = await state(page);
  expect(s0.ball.grounded).toBe(true);

  await page.keyboard.down('ArrowRight');
  await simWait(page, 0.7);
  const s1 = await state(page);
  expect(s1.ball.x).toBeGreaterThan(s0.ball.x + 60);
  expect(s1.ball.vx).toBeGreaterThan(100);
  await page.keyboard.up('ArrowRight');
  await simWait(page, 0.15);
  expect((await state(page)).ball.vx).toBeGreaterThan(20); // inertia: still rolling

  await simWait(page, 1.5);
  const before = await state(page);
  await page.keyboard.down('Space');
  await simWait(page, 0.35);
  const mid = await state(page);
  await page.keyboard.up('Space');
  expect(mid.ball.y).toBeLessThan(before.ball.y - 50);
});

test('walls block the ball (collisions)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test');
  await boot(page);
  await startLevel(page);
  await page.keyboard.down('ArrowLeft');
  await simWait(page, 1.5);
  await page.keyboard.up('ArrowLeft');
  const s = await state(page);
  expect(s.ball.x).toBeGreaterThanOrEqual(23);
  expect(s.ball.x).toBeLessThan(40);
});

test('touch controls move and jump (multi-touch zones)', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch test');
  await boot(page);
  await expect(page.locator('body')).toHaveClass(/touch/);
  await startLevel(page);
  await expect(page.locator('[data-btn=right]')).toBeVisible();
  const vp = page.viewportSize()!;
  const right = await page.locator('[data-btn=right]').boundingBox();
  const s0 = await state(page);
  const fire = (type: string, id: number, x: number, y: number) =>
    page.locator('#touch').dispatchEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1, buttons: 1 });
  await fire('pointerdown', 1, right!.x + right!.width / 2, right!.y + right!.height / 2);
  await simWait(page, 0.6);
  // second finger on the jump side while the first keeps rolling
  await fire('pointerdown', 2, vp.width - 60, vp.height - 70);
  await simWait(page, 0.25);
  const mid = await state(page);
  await fire('pointerup', 2, vp.width - 60, vp.height - 70);
  await fire('pointerup', 1, right!.x, right!.y);
  expect(mid.ball.x).toBeGreaterThan(s0.ball.x + 40);
  expect(mid.ball.grounded).toBe(false);
});

test('spikes kill the ball, a life is lost and it respawns at the checkpoint', async ({ page }) => {
  await boot(page);
  await startLevel(page);
  // reach the first checkpoint, then drop onto the spike field
  await page.evaluate(() => (window as any).__BOUNCE.teleport(2700, 500));
  await page.waitForFunction(() => (window as any).__BOUNCE.state().checkpoint === 0);
  await page.evaluate(() => (window as any).__BOUNCE.teleport(2250, 740));
  await page.waitForFunction(() => (window as any).__BOUNCE.state().status === 'dying');
  await page.waitForFunction(() => (window as any).__BOUNCE.state().status === 'playing');
  const s = await state(page);
  expect(s.lives).toBe(2);
  expect(Math.abs(s.ball.x - 2700)).toBeLessThan(5);
});

test('the level can be completed end to end and progress is saved', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => localStorage.clear());
  await startLevel(page);
  // Solve with the same deterministic simulation and play the inputs into the real game loop.
  const res = await page.evaluate(() => (window as any).__BOUNCE.solve('forest-01'));
  expect(res.ok).toBe(true);
  await page.evaluate((a) => (window as any).__BOUNCE.replay('forest-01', a), res.actions);
  await expect(page.locator('#victory')).toBeVisible({ timeout: 90_000 });
  const vic = await page.locator('#vicEggs').textContent();
  expect(vic).toMatch(/^\d+\/\d+$/);
  const saved = await page.evaluate(() => (window as any).__BOUNCE.save());
  expect(saved.levels['forest-01'].completed).toBe(true);
  await page.reload();
  await page.waitForFunction(() => (window as any).__BOUNCE?.save().levels['forest-01']?.completed === true);
  await page.getByRole('button', { name: 'Niveles' }).click();
  await expect(page.locator('.lvl').first()).toContainText('✓');
});

test('pause stops the game and resume continues', async ({ page }) => {
  await boot(page);
  await startLevel(page);
  await page.locator('#pauseBtn').click();
  await expect(page.locator('#pause')).toBeVisible();
  const t1 = (await state(page)).time;
  await page.waitForTimeout(500);
  expect((await state(page)).time).toBe(t1);
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.waitForTimeout(400);
  expect((await state(page)).time).toBeGreaterThan(t1);
});

test('physics lab opens with live sliders', async ({ page }) => {
  await boot(page);
  await page.getByRole('button', { name: 'Laboratorio' }).click();
  await expect(page.locator('#lab')).toBeVisible();
  const slider = page.locator('#lab-gravity');
  await expect(slider).toBeVisible();
  await slider.fill('900');
  await expect(page.locator('#lab-gravity-o')).toHaveText('900');
});

test('layout fits the screen without page scroll', async ({ page }) => {
  await boot(page);
  await startLevel(page);
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight,
    canvas: (() => { const r = document.querySelector('canvas')!.getBoundingClientRect(); return [r.width, r.height]; })(),
  }));
  expect(m.sw).toBeLessThanOrEqual(m.cw);
  expect(m.sh).toBeLessThanOrEqual(m.ch);
  expect(Math.abs(m.canvas[0] - m.cw)).toBeLessThan(2);
  expect(Math.abs(m.canvas[1] - m.ch)).toBeLessThan(2);
});
