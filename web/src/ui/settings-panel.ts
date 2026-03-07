import { gameSettings, saveSettings, resetSettings, DEFAULTS, type GameSettings } from '../settings';

const PHASES = ['tutorial', 'rampUp', 'midGame', 'intense', 'chaos'];
const PHASE_LABELS: Record<string, string> = {
  tutorial: 'Tutorial',
  rampUp: 'Ramp Up',
  midGame: 'Mid Game',
  intense: 'Intense',
  chaos: 'Chaos',
};

interface SliderDef {
  key: keyof GameSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}

const SLIDERS: SliderDef[] = [
  { key: 'spawnRateMultiplier', label: 'Spawn Rate', min: 0.5, max: 2.0, step: 0.1, format: v => `${v.toFixed(1)}x` },
  { key: 'startingLives', label: 'Starting Lives', min: 1, max: 10, step: 1, format: v => `${v}` },
  { key: 'playerSpeedMultiplier', label: 'Player Speed', min: 0.5, max: 2.0, step: 0.1, format: v => `${v.toFixed(1)}x` },
  { key: 'fireRateMultiplier', label: 'Fire Rate', min: 0.5, max: 3.0, step: 0.1, format: v => `${v.toFixed(1)}x` },
  { key: 'enemySpeedMultiplier', label: 'Enemy Speed', min: 0.5, max: 2.0, step: 0.1, format: v => `${v.toFixed(1)}x` },
  { key: 'maxEnemies', label: 'Max Enemies', min: 20, max: 150, step: 10, format: v => `${v}` },
  { key: 'bloomIntensity', label: 'Bloom', min: 0.5, max: 4.0, step: 0.1, format: v => `${v.toFixed(1)}` },
  { key: 'trailLength', label: 'Trail Length', min: 2, max: 30, step: 1, format: v => `${v}` },
  // BlackHole gravity
  { key: 'bhAttractRadius', label: 'BH Pull Radius', min: 50, max: 600, step: 10, format: v => `${v}px` },
  { key: 'bhEnemyPull', label: 'BH Enemy Pull', min: 0.1, max: 5.0, step: 0.1, format: v => v.toFixed(1) },
  { key: 'bhPlayerPull', label: 'BH Player Pull', min: 0.0, max: 5.0, step: 0.1, format: v => v.toFixed(1) },
  { key: 'bhGridMassBase', label: 'BH Grid Depth', min: 0, max: 500, step: 10, format: v => `${v}` },
  { key: 'bhGridMassPerAbsorb', label: 'BH Grid/Absorb', min: 0, max: 100, step: 5, format: v => `${v}` },
  { key: 'bhGridRadiusMultiplier', label: 'BH Grid Radius', min: 0.5, max: 5.0, step: 0.1, format: v => `${v.toFixed(1)}x` },
  // Grid physics
  { key: 'gridAnchorStiffness', label: 'Grid Anchor', min: 1, max: 100, step: 1, format: v => `${v}` },
  { key: 'gridDamping', label: 'Grid Damping', min: 1, max: 20, step: 1, format: v => `${v}` },
  { key: 'gridMaxDisplacement', label: 'Grid Max Disp', min: 20, max: 200, step: 5, format: v => `${v}px` },
];

// Track all panel instances so Reset Defaults can sync them all
const panelInstances: { panel: HTMLDivElement; valueDisplays: Record<string, HTMLSpanElement> }[] = [];

function buildSettingsPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.className = 'settings-panel';
  panel.innerHTML = '<h2>Settings</h2>';

  const valueDisplays: Record<string, HTMLSpanElement> = {};

  // Phase select
  {
    const row = document.createElement('div');
    row.className = 'sp-row';
    const header = document.createElement('div');
    header.className = 'sp-header';
    header.innerHTML = '<span class="sp-label">Starting Phase</span>';
    row.appendChild(header);

    const sel = document.createElement('select');
    for (const p of PHASES) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = PHASE_LABELS[p];
      if (p === gameSettings.startingPhase) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener('change', () => {
      gameSettings.startingPhase = sel.value;
      saveSettings();
      syncAllPanels();
    });
    row.appendChild(sel);
    panel.appendChild(row);
  }

  // Sliders
  for (const def of SLIDERS) {
    const row = document.createElement('div');
    row.className = 'sp-row';

    const header = document.createElement('div');
    header.className = 'sp-header';
    const label = document.createElement('span');
    label.className = 'sp-label';
    label.textContent = def.label;
    const val = document.createElement('span');
    val.className = 'sp-value';
    const fmt = def.format ?? (v => `${v}`);
    val.textContent = fmt(gameSettings[def.key] as number);
    valueDisplays[def.key] = val;
    header.appendChild(label);
    header.appendChild(val);
    row.appendChild(header);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = `${def.min}`;
    input.max = `${def.max}`;
    input.step = `${def.step}`;
    input.value = `${gameSettings[def.key]}`;
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      (gameSettings as unknown as Record<string, unknown>)[def.key] = v;
      val.textContent = fmt(v);
      saveSettings();
      syncAllPanels();
    });
    row.appendChild(input);
    panel.appendChild(row);
  }

  // Reset button
  const resetBtn = document.createElement('button');
  resetBtn.className = 'sp-reset';
  resetBtn.textContent = 'Reset Defaults';
  resetBtn.addEventListener('click', () => {
    resetSettings();
    syncAllPanels();
  });
  panel.appendChild(resetBtn);

  panelInstances.push({ panel, valueDisplays });
  return panel;
}

/** Sync all panel instances to current gameSettings values */
function syncAllPanels(): void {
  for (const inst of panelInstances) {
    // Update selects
    const selects = inst.panel.querySelectorAll('select');
    selects.forEach(sel => {
      (sel as HTMLSelectElement).value = gameSettings.startingPhase;
    });
    // Update sliders + value displays
    const inputs = inst.panel.querySelectorAll('input[type="range"]');
    for (let i = 0; i < SLIDERS.length; i++) {
      const def = SLIDERS[i];
      if (inputs[i]) {
        (inputs[i] as HTMLInputElement).value = `${gameSettings[def.key]}`;
      }
      const fmt = def.format ?? (v => `${v}`);
      if (inst.valueDisplays[def.key]) {
        inst.valueDisplays[def.key].textContent = fmt(gameSettings[def.key] as number);
      }
    }
  }
}

let styleAppended = false;
let desktopContainer: HTMLElement | null = null;

export function initSettingsPanel(desktopMount?: HTMLElement | null): void {
  if (!styleAppended) {
    const style = document.createElement('style');
    style.textContent = `
      .settings-panel {
        width: 100%;
        max-width: 320px;
        font-family: monospace;
        color: #20ff20;
        font-size: 13px;
        padding: 0 16px;
      }
      .settings-panel h2 {
        font-size: 14px;
        margin: 0 0 10px;
        text-transform: uppercase;
        letter-spacing: 2px;
        opacity: 0.7;
      }
      .sp-row {
        margin-bottom: 8px;
      }
      .sp-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 2px;
      }
      .sp-label { opacity: 0.8; }
      .sp-value { color: #60ff60; font-weight: bold; }
      .sp-row input[type="range"] {
        width: 100%;
        height: 20px;
        accent-color: #20ff20;
        background: transparent;
        cursor: pointer;
      }
      .sp-row select {
        width: 100%;
        background: #111;
        color: #20ff20;
        border: 1px solid #20ff2040;
        font-family: monospace;
        font-size: 13px;
        padding: 4px;
        cursor: pointer;
      }
      .sp-reset {
        margin-top: 12px;
        background: transparent;
        color: #20ff20;
        border: 1px solid #20ff2060;
        font-family: monospace;
        font-size: 12px;
        padding: 6px 16px;
        cursor: pointer;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .sp-reset:active { background: #20ff2020; }
    `;
    document.head.appendChild(style);
    styleAppended = true;
  }

  // Mobile mount (inside #rotate-prompt)
  const mobileMount = document.getElementById('settings-mount');
  if (mobileMount) {
    mobileMount.appendChild(buildSettingsPanel());
  }

  // Desktop mount
  if (desktopMount) {
    desktopContainer = desktopMount;
    desktopMount.appendChild(buildSettingsPanel());
  }
}

export function showDesktopSettings(): void {
  if (desktopContainer) desktopContainer.style.display = 'block';
}

export function hideDesktopSettings(): void {
  if (desktopContainer) desktopContainer.style.display = 'none';
}
