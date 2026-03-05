// ============================================================
// Geometry Genocide Web — Central Configuration
// All tunable game constants live here. Nothing is hardcoded elsewhere.
// ============================================================

// --- World ---
export const WORLD_WIDTH = 4800;
export const WORLD_HEIGHT = 3600;

// --- Player ---
export const PLAYER_SPEED = 0.35; // px/ms
export const PLAYER_COLLISION_RADIUS = 24;
export const PLAYER_STARTING_LIVES = 3;
export const PLAYER_INVULN_DURATION = 2000; // ms of invulnerability after respawn
export const PLAYER_SHIP_SCALE = 18;

// --- Bullets ---
export const BULLET_SPEED = 1.0; // px/ms
export const BULLET_COLLISION_RADIUS_ENEMY = 38;
export const BULLET_COLLISION_RADIUS_DEATHSTAR = 64;
export const BULLET_SCALE = 5;
export const BULLET_COLOR: [number, number, number] = [1.0, 0.0, 0.0];
export const BULLET_COLOR2: [number, number, number] = [1.0, 0.78, 0.78];
export const BULLET_POOL_SIZE = 200;

// --- Weapon progression (score thresholds) ---
export const WEAPON_STAGES = [
  { score: 0,      shotDelay: 150, bulletCount: 1, angleOffsets: [0] },
  { score: 10000,  shotDelay: 120, bulletCount: 1, angleOffsets: [0] },
  { score: 25000,  shotDelay: 120, bulletCount: 2, angleOffsets: [-3, 3] },
  { score: 50000,  shotDelay: 90,  bulletCount: 2, angleOffsets: [-3, 3] },
  { score: 150000, shotDelay: 90,  bulletCount: 3, angleOffsets: [-3, 0, 3] },
];

// --- Enemy colors [r, g, b] normalized 0-1 ---
export const COLORS = {
  rhombus:  { color: [0, 0.784, 1.0] as [number, number, number], color2: [0, 0.549, 0.784] as [number, number, number] },
  pinwheel: { color: [0.784, 0.251, 1.0] as [number, number, number], color2: [0.298, 0, 0.722] as [number, number, number] },
  square:   { color: [1.0, 0.125, 1.0] as [number, number, number], color2: [1.0, 0.125, 1.0] as [number, number, number] },
  circle:   { color: [0.125, 0.251, 1.0] as [number, number, number], color2: [0.196, 0.784, 1.0] as [number, number, number] },
  triangle: { color: [0.682, 0.796, 0.0] as [number, number, number], color2: [0, 0.502, 0] as [number, number, number] },
  octagon:  { color: [1.0, 0.502, 0.125] as [number, number, number], color2: [1.0, 0.502, 0.251] as [number, number, number] },
  deathstar:{ color: [0.6, 0.2, 0.2] as [number, number, number], color2: [0.9, 0.4, 0.25] as [number, number, number] },
  blackhole:{ color: [0.5, 0.1, 0.8] as [number, number, number], color2: [0.3, 0.0, 0.6] as [number, number, number] },
};

// --- Enemy speeds (px/ms) ---
export const ENEMY_SPEED = {
  rhombus: 0.15,
  pinwheel: 0.05,
  square: 0.15,
  square2: 0.2,
  circle: 0.35,
  triangle: 0.2,
  octagon: 0.15,
  blackhole: 0.04,
};

// --- Enemy scores ---
export const ENEMY_SCORES = {
  rhombus: 100,
  pinwheel: 50,
  square: 450,
  square2: 150,
  circle: 300,
  triangle: 550,
  octagon: 1650,
  blackhole: 2000,
};

// --- Octagon ---
export const OCTAGON_HP = 3;

// --- Enemy collision radii ---
export const ENEMY_COLLISION_RADIUS = 28;
export const DEATHSTAR_COLLISION_RADIUS = 50;
export const DEATHSTAR_BULLET_RADIUS = 64;
export const DEATHSTAR_HP = 20;
export const DEATHSTAR_CIRCLE_SPAWN = 5;
export const DEATHSTAR_ATTRACT_RADIUS = 50;

// --- Explosion particles ---
export const EXPLOSION_PARTICLE_COUNT_SMALL = 50;
export const EXPLOSION_PARTICLE_COUNT_LARGE = 180;
export const EXPLOSION_PARTICLE_COUNT_DEATH = 350;
export const EXPLOSION_DURATION_DEFAULT = 1.2; // seconds
export const EXPLOSION_DURATION_LARGE = 2.5;
export const EXPLOSION_DURATION_DEATH = 5.0;
export const EXPLOSION_POOL_SIZE = 60;

// --- Spawner / difficulty ---
// Phase boundaries in seconds
export const DIFFICULTY_PHASES = {
  tutorial:  { start: 0,   end: 30 },
  rampUp:    { start: 30,  end: 120 },
  midGame:   { start: 120, end: 240 },
  intense:   { start: 240, end: 420 },
  chaos:     { start: 420, end: Infinity },
};

// Spawn intervals per phase (seconds)
export const SPAWN_INTERVALS = {
  tutorial: {
    base: 3.0,
    squad: Infinity,
    cluster: Infinity,
    boss: Infinity,
  },
  rampUp: {
    base: 3.0,
    squad: 11.0,
    cluster: 17.0,
    boss: 45.0,
  },
  midGame: {
    base: 2.5,
    squad: 9.0,
    cluster: 15.0,
    boss: 35.0,
  },
  intense: {
    base: 2.0,
    squad: 7.0,
    cluster: 12.0,
    boss: 30.0,
  },
  chaos: {
    base: 1.5,
    squad: 5.0,
    cluster: 10.0,
    boss: 20.0,
  },
};

export const CLUSTER_BASE_SIZE = 8;
export const SPAWN_DELAY_BETWEEN = 10; // ms between each enemy in a cluster

// --- Camera ---
export const DESKTOP_ZOOM = 0.75; // zoom out on desktop to show more environment
export const CAMERA_LERP_SPEED = 0.08;
export const SCREEN_SHAKE_SMALL = 5;
export const SCREEN_SHAKE_LARGE = 10;
export const SCREEN_SHAKE_DEATH = 20;

// --- HUD ---
export const HUD_FONT = '24px monospace';
export const HUD_COLOR = '#20ff20';

// --- Offscreen indicator ---
export const OFFSCREEN_INDICATOR_RANGE = 800;

// --- Bloom ---
export const BLOOM_THRESHOLD = 0.06;
export const BLOOM_INTENSITY = 2.2;
export const BLOOM_BLUR_PASSES = 6;
export const BLOOM_BLUR_RADIUS = 2.5;

// --- Grid ---
export const GRID_EXPLOSION_STRENGTH = 90;
export const GRID_EXPLOSION_RADIUS = 380;
export const GRID_EXPLOSION_DECAY = 1.5;
export const GRID_ENEMY_STRENGTH = 8;
export const GRID_ENEMY_RADIUS = 140;
export const GRID_ENEMY_DECAY = 6.0;

// --- Trails ---
export const TRAIL_LENGTH_ENEMY = 18;
export const TRAIL_LENGTH_BULLET = 10;

// --- Mobile ---
export const MOBILE_ZOOM = 0.45; // zoom out on mobile to see more of the world
export const MOBILE_BLOOM_SCALE = 0.25; // bloom FBO at quarter-res on mobile
export const MOBILE_MAX_ENEMIES = 80;
export const MOBILE_MAX_PARTICLES = 30;
export const MOBILE_TRAIL_LENGTH_ENEMY = 8;
export const MOBILE_TRAIL_LENGTH_BULLET = 5;

// --- Virtual Joystick ---
export const JOYSTICK_MAX_RADIUS = 60; // max knob displacement from center
export const JOYSTICK_DEAD_ZONE = 0.15; // fraction of radius before registering input
export const JOYSTICK_BASE_RADIUS = 60; // visual radius of outer circle
export const JOYSTICK_KNOB_RADIUS = 22; // visual radius of inner knob
export const JOYSTICK_OPACITY = 0.3;
export const JOYSTICK_ACTIVE_OPACITY = 0.55;

// --- Audio ---
export const SFX_NAMES = [
  'start', 'die', 'die1', 'crash', 'square', 'rhombus',
  'triangle2', 'octagon', 'pinwheel', 'deathstar', 'deathstar2',
] as const;
export type SFXName = typeof SFX_NAMES[number];
export const MASTER_VOLUME = 0.5;
export const SFX_VOLUME = 0.6;
export const MUSIC_VOLUME = 0.35;
