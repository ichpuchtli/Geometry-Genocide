import { Vec2 } from '../core/vector';
import { gameSettings } from '../settings';

// Each line can be commented out individually to disable that enemy type
export type EnemyType =
  | 'rhombus'
  | 'pinwheel'
  | 'square'
  | 'blackhole'
  // --- Child types (spawned by parents, not in pools) ---
  | 'circle'   // spawned only by BlackHole overload explosion
  | 'shard'    // spawned by Sierpinski on death
  // --- Boss types (spawned by encounter system, not in pools) ---
  | 'sierpinski'  // one-off boss at ~120s
  | 'mandelbrot'
  | 'minimandel'
  ;

// Pools are weighted by repetition. More copies = higher spawn chance.
// Comment out any line to remove that enemy from that phase.

export const TUTORIAL_POOL: EnemyType[] = [
  'rhombus', 'rhombus', 'rhombus', 'rhombus', 'rhombus',
  'pinwheel', 'pinwheel', 'pinwheel',
  'blackhole',  // rare early terrain hazard
];

export const RAMPUP_POOL: EnemyType[] = [
  'rhombus', 'rhombus', 'rhombus', 'rhombus', 'rhombus',
  'pinwheel', 'pinwheel', 'pinwheel', 'pinwheel',
  'square', 'square',
  'blackhole',
];

export const MIDGAME_POOL: EnemyType[] = [
  'rhombus', 'rhombus', 'rhombus', 'rhombus',
  'pinwheel', 'pinwheel', 'pinwheel',
  'square', 'square', 'square',
  'blackhole',
];

export const INTENSE_POOL: EnemyType[] = [
  'rhombus', 'rhombus', 'rhombus', 'rhombus',
  'pinwheel', 'pinwheel', 'pinwheel',
  'square', 'square', 'square',
  'blackhole', 'blackhole',
];

export const CHAOS_POOL: EnemyType[] = [
  'rhombus', 'rhombus', 'rhombus',
  'pinwheel', 'pinwheel',
  'square', 'square', 'square',
  'blackhole', 'blackhole',
];

// Only simple enemies for mass swarm events
export const SWARM_POOL: EnemyType[] = [
  'rhombus', 'rhombus', 'rhombus',
  'pinwheel', 'pinwheel',
];

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---- Spawn formation types ----

export type SpawnFormation = 'random_edge' | 'swarm' | 'surround' | 'wall' | 'pincer' | 'ambush' | 'cascade';

export interface FormationSpawn {
  type: EnemyType;
  position: Vec2;
  delay: number;       // ms delay before spawn (for cascade/stagger)
  isAmbush?: boolean;  // if true, use longer spawn animation
  formationId?: number; // links spawn to its formation group
}

/** Formation-level metadata returned alongside spawns */
export interface FormationMeta {
  formation: SpawnFormation;
  formationId: number;  // unique ID for linking spawns to their group sound
  count: number;        // number of enemies in this formation
  side?: number;    // 0=top, 1=bottom, 2=left, 3=right (for edge formations)
  center?: Vec2;    // center of formation (for surround/ambush)
}

let nextFormationId = 0;

export interface FormationResult {
  spawns: FormationSpawn[];
  meta: FormationMeta;
}

/** Swarm: 15-30 enemies from a single edge point — separation steering spreads them */
export function generateSwarm(pool: EnemyType[], count: number): FormationResult {
  const fid = nextFormationId++;
  const hw = gameSettings.arenaWidth / 2;
  const hh = gameSettings.arenaHeight / 2;
  const type = pickRandom(pool);
  const side = Math.floor(Math.random() * 4);
  // Single spawn point on the chosen edge
  const edgeOffset = (Math.random() - 0.5) * 0.6;
  let x: number, y: number;
  switch (side) {
    case 0: x = edgeOffset * gameSettings.arenaWidth; y = hh - 10; break;
    case 1: x = edgeOffset * gameSettings.arenaWidth; y = -hh + 10; break;
    case 2: x = -hw + 10; y = edgeOffset * gameSettings.arenaHeight; break;
    default: x = hw - 10; y = edgeOffset * gameSettings.arenaHeight; break;
  }
  const spawns: FormationSpawn[] = [];
  for (let i = 0; i < count; i++) {
    spawns.push({ type, position: new Vec2(x, y), delay: i * 40, formationId: fid });
  }
  return { spawns, meta: { formation: 'swarm', formationId: fid, count, side } };
}

/** Surround: enemies spawn in a tight cluster around the player — separation blooms into a ring */
export function generateSurround(pool: EnemyType[], count: number, playerPos: Vec2, radius = 300): FormationResult {
  const fid = nextFormationId++;
  const hw = gameSettings.arenaWidth / 2;
  const hh = gameSettings.arenaHeight / 2;
  const spawns: FormationSpawn[] = [];
  // Spawn on a tight ring (just outside collision overlap) so separation expands them
  const tightRadius = 40;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.max(-hw + 20, Math.min(hw - 20, playerPos.x + Math.cos(angle) * tightRadius));
    const y = Math.max(-hh + 20, Math.min(hh - 20, playerPos.y + Math.sin(angle) * tightRadius));
    spawns.push({ type: pickRandom(pool), position: new Vec2(x, y), delay: i * 20, formationId: fid });
  }
  return { spawns, meta: { formation: 'surround', formationId: fid, count, center: playerPos.clone() } };
}

/** Wall: enemies spawn at a single edge point — separation stretches them into a line */
export function generateWall(pool: EnemyType[], count: number): FormationResult {
  const fid = nextFormationId++;
  const hw = gameSettings.arenaWidth / 2;
  const hh = gameSettings.arenaHeight / 2;
  const type = pickRandom(pool);
  const side = Math.floor(Math.random() * 4);
  const edgeOffset = (Math.random() - 0.5) * 0.4;
  let x: number, y: number;
  switch (side) {
    case 0: x = edgeOffset * gameSettings.arenaWidth; y = hh - 10; break;
    case 1: x = edgeOffset * gameSettings.arenaWidth; y = -hh + 10; break;
    case 2: x = -hw + 10; y = edgeOffset * gameSettings.arenaHeight; break;
    default: x = hw - 10; y = edgeOffset * gameSettings.arenaHeight; break;
  }
  const spawns: FormationSpawn[] = [];
  for (let i = 0; i < count; i++) {
    spawns.push({ type, position: new Vec2(x, y), delay: 0, formationId: fid });
  }
  return { spawns, meta: { formation: 'wall', formationId: fid, count, side } };
}

/** Pincer: two groups from opposite sides — each group spawns at a single point */
export function generatePincer(pool: EnemyType[], count: number, playerPos: Vec2): FormationResult {
  const fid = nextFormationId++;
  const hw = gameSettings.arenaWidth / 2;
  const hh = gameSettings.arenaHeight / 2;
  const type = pickRandom(pool);
  const spawns: FormationSpawn[] = [];
  const useVertical = Math.abs(playerPos.x) < Math.abs(playerPos.y);
  const half = Math.floor(count / 2);
  // Two spawn points on opposite sides, aligned with player
  const px = Math.max(-hw + 20, Math.min(hw - 20, playerPos.x));
  const py = Math.max(-hh + 20, Math.min(hh - 20, playerPos.y));
  for (let i = 0; i < count; i++) {
    const group = i < half ? -1 : 1;
    let x: number, y: number;
    if (useVertical) {
      x = px; y = group * (hh - 10);
    } else {
      x = group * (hw - 10); y = py;
    }
    spawns.push({ type, position: new Vec2(x, y), delay: i * 30, formationId: fid });
  }
  const side = useVertical ? 0 : 2;
  return { spawns, meta: { formation: 'pincer', formationId: fid, count, side } };
}

/** Ambush: enemies spawn at a single point ~300px from player — separation blooms them out */
export function generateAmbush(pool: EnemyType[], count: number, playerPos: Vec2): FormationResult {
  const fid = nextFormationId++;
  const hw = gameSettings.arenaWidth / 2;
  const hh = gameSettings.arenaHeight / 2;
  // Single spawn point in a random direction from player
  const angle = Math.random() * Math.PI * 2;
  const dist = 310;
  const x = Math.max(-hw + 20, Math.min(hw - 20, playerPos.x + Math.cos(angle) * dist));
  const y = Math.max(-hh + 20, Math.min(hh - 20, playerPos.y + Math.sin(angle) * dist));
  const spawns: FormationSpawn[] = [];
  for (let i = 0; i < count; i++) {
    spawns.push({ type: pickRandom(pool), position: new Vec2(x, y), delay: i * 50, isAmbush: true, formationId: fid });
  }
  return { spawns, meta: { formation: 'ambush', formationId: fid, count, center: playerPos.clone() } };
}

/** Cascade: rapid-fire from a single edge point with accelerating rate */
export function generateCascade(pool: EnemyType[], count: number): FormationResult {
  const fid = nextFormationId++;
  const hw = gameSettings.arenaWidth / 2;
  const hh = gameSettings.arenaHeight / 2;
  const type = pickRandom(pool);
  const side = Math.floor(Math.random() * 4);
  const edgePos = (Math.random() - 0.5) * 0.6;
  let x: number, y: number;
  switch (side) {
    case 0: x = edgePos * gameSettings.arenaWidth; y = hh - 10; break;
    case 1: x = edgePos * gameSettings.arenaWidth; y = -hh + 10; break;
    case 2: x = -hw + 10; y = edgePos * gameSettings.arenaHeight; break;
    default: x = hw - 10; y = edgePos * gameSettings.arenaHeight; break;
  }
  const spawns: FormationSpawn[] = [];
  let totalDelay = 0;
  for (let i = 0; i < count; i++) {
    spawns.push({ type, position: new Vec2(x, y), delay: totalDelay, formationId: fid });
    totalDelay += Math.max(20, 80 - i * 4);
  }
  return { spawns, meta: { formation: 'cascade', formationId: fid, count, side } };
}
