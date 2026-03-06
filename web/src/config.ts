// ============================================================
// Geometry Genocide Web — Central Configuration
// All tunable game constants live here. Nothing is hardcoded elsewhere.
// ============================================================

// --- World ---
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1000;

// --- Player ---
export const PLAYER_SPEED = 0.35; // px/ms
export const PLAYER_COLLISION_RADIUS = 24;
export const PLAYER_STARTING_LIVES = 5;
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
  // --- New fractal/topology enemies ---
  sierpinski:     { color: [1.0, 0.843, 0.0] as [number, number, number], color2: [0.722, 0.525, 0.043] as [number, number, number] },
  mobius:         { color: [0.0, 1.0, 0.784] as [number, number, number], color2: [0.0, 0.533, 0.4] as [number, number, number] },
  koch:           { color: [0.533, 0.867, 1.0] as [number, number, number], color2: [1.0, 1.0, 1.0] as [number, number, number] },
  penrose:        { color: [1.0, 0.078, 0.576] as [number, number, number], color2: [0.58, 0.0, 0.827] as [number, number, number] },
  mengerdust:     { color: [1.0, 0.4, 0.0] as [number, number, number], color2: [0.6, 0.2, 0.0] as [number, number, number] },
  hyperbolicdisc: { color: [0.0, 0.267, 1.0] as [number, number, number], color2: [0.102, 0.0, 0.4] as [number, number, number] },
  fibspiral:      { color: [0.667, 1.0, 0.0] as [number, number, number], color2: [0.333, 0.533, 0.0] as [number, number, number] },
  tesseract:      { color: [0.667, 0.0, 1.0] as [number, number, number], color2: [1.0, 0.0, 0.667] as [number, number, number] },
  mandelbrot:     { color: [0.8, 0.0, 0.0] as [number, number, number], color2: [0.267, 0.0, 0.0] as [number, number, number] },
  klein:          { color: [0.0, 1.0, 0.667] as [number, number, number], color2: [0.0, 0.4, 0.267] as [number, number, number] },
  shard:          { color: [1.0, 0.9, 0.3] as [number, number, number], color2: [0.8, 0.7, 0.1] as [number, number, number] },
  minimandel:     { color: [1.0, 0.2, 0.2] as [number, number, number], color2: [0.5, 0.0, 0.0] as [number, number, number] },
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
  // --- New enemies ---
  sierpinski: 0.08,
  mobius: 0.18,
  koch: 0.12,
  penrose: 0.14,
  mengerdust: 0.06,
  hyperbolicdisc: 0.10,
  fibspiral: 0.22,
  tesseract: 0.09,
  mandelbrot: 0.04,
  klein: 0.13,
  shard: 0.3,
  minimandel: 0.25,
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
  // --- New enemies ---
  sierpinski: 2400,
  mobius: 900,
  koch: 1200,
  penrose: 1500,
  mengerdust: 3200,
  hyperbolicdisc: 2000,
  fibspiral: 600,
  tesseract: 2800,
  mandelbrot: 4000,
  klein: 1800,
  shard: 100,
  minimandel: 150,
};

// --- Enemy HP ---
export const OCTAGON_HP = 3;
export const SIERPINSKI_HP = 3;
export const MOBIUS_HP = 2;
export const KOCH_HP = 2;
export const PENROSE_HP = 2;
export const MENGERDUST_HP = 5;
export const HYPERBOLICDISC_HP = 3;
export const TESSERACT_HP = 4;
export const MANDELBROT_HP = 6;
export const KLEIN_HP = 3;

// --- MengerDust ---
export const MENGERDUST_ABSORB_COUNT = 3;
export const MENGERDUST_OVERLOAD_DURATION = 1.0; // seconds

// --- Mandelbrot ---
export const MANDELBROT_MAX_MINIONS = 4;
export const MANDELBROT_SPAWN_INTERVAL = 5.0; // seconds
export const MANDELBROT_BUD_REGROW_TIME = 3.0; // seconds

// --- HyperbolicDisc ---
export const HYPERBOLICDISC_WARP_RADIUS = 150; // px — bullet curving range
export const HYPERBOLICDISC_WARP_FORCE = 0.0004; // bullet bend strength

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
  tutorial:  { start: 0,   end: 45 },
  rampUp:    { start: 45,  end: 150 },
  midGame:   { start: 150, end: 300 },
  intense:   { start: 300, end: 480 },
  chaos:     { start: 480, end: Infinity },
};

export const SPAWN_DELAY_BETWEEN = 10; // ms between each enemy in a cluster

// --- Mouse aim (desktop) ---
export const MOUSE_AIM_SENSITIVITY = 0.004; // radians per pixel of mouse delta

// --- Camera ---
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

// --- Spring-mass grid ---
export const GRID_SPACING = 40;
export const GRID_SPRING_STIFFNESS = 800;
export const GRID_SPRING_DAMPING = 12;
export const GRID_ANCHOR_STIFFNESS = 50;
export const GRID_MAX_DISPLACEMENT = 60;
export const GRID_SUBSTEPS = 3;
export const GRID_MOBILE_SUBSTEPS = 2;
export const GRID_COLOR_BASE: [number, number, number] = [0.38, 0.14, 0.72];
export const GRID_COLOR_STRETCH: [number, number, number] = [0.0, 0.8, 1.0];
export const GRID_COLOR_COMPRESS: [number, number, number] = [1.0, 0.2, 0.8];

// --- Trails ---
export const TRAIL_LENGTH_ENEMY = 18;
export const TRAIL_LENGTH_BULLET = 10;

// --- Mobile ---
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

// --- Arena border ---
export const ARENA_BORDER_COLOR: [number, number, number] = [0.0, 0.6, 1.0]; // Geometry Wars-style blue
export const ARENA_BORDER_CORNER_COLOR: [number, number, number] = [0.0, 1.0, 1.0]; // brighter corners
export const ARENA_BORDER_ALPHA = 0.9;

// --- Death slowmo ---
export const DEATH_SLOWMO_DURATION = 4800; // ms of real time
export const DEATH_SLOWMO_TIME_SCALE = 0.12; // how slow game runs during slowmo
export const DEATH_SLOWMO_SHOCKWAVE_SPEED = 0.8; // px/ms expansion speed of kill shockwave

// --- Audio ---
export const SFX_NAMES = [
  'start', 'die', 'die1', 'crash', 'square', 'rhombus',
  'triangle2', 'octagon', 'pinwheel', 'deathstar', 'deathstar2',
] as const;
export type SFXName = typeof SFX_NAMES[number];
export const MASTER_VOLUME = 0.5;
export const SFX_VOLUME = 0.6;
export const MUSIC_VOLUME = 0.35;
