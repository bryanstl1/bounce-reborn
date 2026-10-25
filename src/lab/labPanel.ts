import { DEFAULT_PARAMS, PARAM_META, PhysicsParams, derived } from '../physics/params';
import type { LabStats } from '../render/GameScene';
import type { LevelSim } from '../sim/LevelSim';

/** DOM panel with live sliders for every physics parameter. */
export class LabPanel {
  private root = document.getElementById('lab')!;
  private sliders = document.getElementById('labSliders')!;
  private read = document.getElementById('labRead')!;
  private forms = document.getElementById('labForms')!;
  private sim: LevelSim | null = null;
  params: PhysicsParams;
  onUse: ((p: PhysicsParams) => void) | null = null;
  onToast: ((msg: string) => void) | null = null;

  constructor(initial: PhysicsParams) {
    this.params = { ...initial };
    this.buildSliders();
    for (const [form, label] of [['normal', 'Normal'], ['heavy', 'Pesada'], ['light', 'Ligera']] as const) {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.form = form;
      b.addEventListener('click', () => {
        this.sim?.setForm(form);
        this.markForm(form);
      });
      this.forms.appendChild(b);
    }
    this.markForm('normal');
    this.root.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
      if (act === 'lab-toggle') this.root.classList.toggle('collapsed');
      if (act === 'lab-default') { this.params = { ...DEFAULT_PARAMS }; this.buildSliders(); this.apply(); this.onToast?.('Valores por defecto restaurados'); }
      if (act === 'lab-copy') this.copy();
      if (act === 'lab-use') { this.onUse?.({ ...this.params }); this.onToast?.('Estas físicas se usarán en todos los niveles'); }
    });
    // keep slider drags from reaching the game
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) this.root.addEventListener(ev, (e) => e.stopPropagation());
  }

  private markForm(form: string) {
    this.forms.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.form === form));
  }

  attach(sim: LevelSim) {
    this.sim = sim;
    sim.setParams(this.params);
    this.markForm(sim.state.form);
  }

  show(on: boolean) {
    this.root.classList.toggle('show', on);
  }

  private buildSliders() {
    this.sliders.innerHTML = '';
    for (const m of PARAM_META) {
      const row = document.createElement('div');
      row.className = 'lab-row';
      const id = `lab-${m.key}`;
      const v = this.params[m.key] as number;
      row.innerHTML = `<label for="${id}">${m.label}</label><output id="${id}-o">${fmt(v)}</output>
        <input type="range" id="${id}" min="${m.min}" max="${m.max}" step="${m.step}" value="${v}">`;
      const input = row.querySelector('input')!;
      const out = row.querySelector('output')!;
      input.addEventListener('input', () => {
        (this.params as unknown as Record<string, number>)[m.key] = parseFloat(input.value);
        out.textContent = fmt(parseFloat(input.value));
        this.apply();
      });
      this.sliders.appendChild(row);
    }
  }

  private apply() {
    this.sim?.setParams(this.params);
  }

  private copy() {
    const text = JSON.stringify(this.params, null, 2);
    const done = () => this.onToast?.('Valores copiados al portapapeles');
    try {
      navigator.clipboard.writeText(text).then(done, () => this.fallbackCopy(text, done));
    } catch {
      this.fallbackCopy(text, done);
    }
  }

  private fallbackCopy(text: string, done: () => void) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch { /* ignore */ }
    ta.remove();
  }

  update(s: LabStats) {
    const D = this.params.radius * 2;
    const d = derived(this.params);
    this.read.innerHTML = [
      `vx ${s.vx.toFixed(0)}`, `vy ${s.vy.toFixed(0)}`,
      `vel ${(Math.abs(s.vx) / D).toFixed(1)} D/s`, s.grounded ? 'en suelo' : 'en el aire',
      `salto ${s.lastApex !== null ? (s.lastApex / D).toFixed(2) + ' D' : '—'}`, `aire ${s.lastAirTime !== null ? s.lastAirTime.toFixed(2) + ' s' : '—'}`,
      `teórico ${d.jumpHeightD.toFixed(2)} D`, `alcance ${(d.jumpDistance / D).toFixed(1)} D`,
    ].map((t) => `<span>${t}</span>`).join('');
  }
}

function fmt(v: number) {
  return Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2);
}
