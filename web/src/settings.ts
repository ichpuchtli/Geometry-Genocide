import {
  PLAYER_STARTING_LIVES,
  BLOOM_INTENSITY,
  TRAIL_LENGTH_ENEMY,
  MOBILE_MAX_ENEMIES,
} from './config';

export interface GameSettings {
  spawnRateMultiplier: number;    // 0.5–2.0 (scales spawn intervals; lower = more enemies)
  startingLives: number;          // 1–10
  playerSpeedMultiplier: number;  // 0.5–2.0
  fireRateMultiplier: number;     // 0.5–3.0 (divides shot delay; higher = faster fire)
  startingPhase: string;          // 'tutorial'|'rampUp'|'midGame'|'intense'|'chaos'
  enemySpeedMultiplier: number;   // 0.5–2.0
  maxEnemies: number;             // 20–150
  bloomIntensity: number;         // 0.5–4.0
  trailLength: number;            // 2–30
}

export const DEFAULTS: GameSettings = {
  spawnRateMultiplier: 1.0,
  startingLives: PLAYER_STARTING_LIVES,
  playerSpeedMultiplier: 1.0,
  fireRateMultiplier: 1.0,
  startingPhase: 'tutorial',
  enemySpeedMultiplier: 1.0,
  maxEnemies: MOBILE_MAX_ENEMIES,
  bloomIntensity: BLOOM_INTENSITY,
  trailLength: TRAIL_LENGTH_ENEMY,
};

const STORAGE_KEY = 'gg_settings';

export const gameSettings: GameSettings = { ...DEFAULTS };

export function loadSettings(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const key of Object.keys(DEFAULTS) as (keyof GameSettings)[]) {
        if (key in parsed) {
          (gameSettings as unknown as Record<string, unknown>)[key] = parsed[key];
        }
      }
    }
  } catch {
    // corrupt data — use defaults
  }
}

export function saveSettings(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameSettings));
  } catch {
    // storage full or unavailable
  }
}

export function resetSettings(): void {
  Object.assign(gameSettings, DEFAULTS);
  saveSettings();
}
