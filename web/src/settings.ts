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
  // BlackHole gravity tuning
  bhAttractRadius: number;        // 50–600 (px, how far gravity reaches)
  bhEnemyPull: number;            // 0.01–0.5 (px/ms², enemy pull strength)
  bhPlayerPull: number;           // 0.0–1.0 (px/ms², player pull strength)
  bhGridMassBase: number;         // 0–300 (grid well depth at 0 absorbed)
  bhGridMassPerAbsorb: number;    // 0–60 (additional grid depth per absorbed enemy)
  bhGridRadiusMultiplier: number; // 0.5–4.0 (grid well radius as multiple of attract radius)
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
  bhAttractRadius: 300,
  bhEnemyPull: 0.18,
  bhPlayerPull: 0.4,
  bhGridMassBase: 80,
  bhGridMassPerAbsorb: 18,
  bhGridRadiusMultiplier: 2.0,
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
