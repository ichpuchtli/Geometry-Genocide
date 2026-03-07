import { Vec2 } from '../core/vector';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../config';

// Each line can be commented out individually to disable that enemy type
export type EnemyType =
  | 'rhombus'
  | 'pinwheel'
  | 'square'
  | 'blackhole'
  | 'sierpinski'
  // --- Child types (spawned by parents, not in pools) ---
  | 'circle'   // spawned only by BlackHole overload explosion
  | 'shard'
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
  'sierpinski',
  'blackhole',
];

export const INTENSE_POOL: EnemyType[] = [
  'rhombus', 'rhombus', 'rhombus', 'rhombus',
  'pinwheel', 'pinwheel', 'pinwheel',
  'square', 'square', 'square',
  'sierpinski', 'sierpinski',
  'blackhole', 'blackhole',
];

export const CHAOS_POOL: EnemyType[] = [
  'rhombus', 'rhombus', 'rhombus',
  'pinwheel', 'pinwheel',
  'square', 'square', 'square',
  'sierpinski', 'sierpinski',
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

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ---- Spawn formation types ----

export type SpawnFormation = 'random_edge' | 'swarm' | 'surround' | 'wall' | 'pincer' | 'ambush' | 'cascade';

export interface FormationSpawn {
  type: EnemyType;
  position: Vec2;
  delay: number;       // ms delay before spawn (for cascade/stagger)
  isAmbush?: boolean;  // if true, use longer spawn animation
}

const hw = WORLD_WIDTH / 2;
const hh = WORLD_HEIGHT / 2;

/** Swarm: 15-30 enemies from a single edge quadrant, tightly packed */
export function generateSwarm(pool: EnemyType[], count: number): FormationSpawn[] {
  const type = pickRandom(pool);
  const side = Math.floor(Math.random() * 4);
  const spawns: FormationSpawn[] = [];
  for (let i = 0; i < count; i++) {
    let x: number, y: number;
    const spread = 200; // how tightly packed along the edge
    const center = (Math.random() - 0.5) * spread;
    switch (side) {
      case 0: x = center; y = hh - 10; break;   // top
      case 1: x = center; y = -hh + 10; break;  // bottom
      case 2: x = -hw + 10; y = center; break;  // left
      default: x = hw - 10; y = center; break;   // right
    }
    spawns.push({ type, position: new Vec2(x, y), delay: i * 40 });
  }
  return spawns;
}

/** Surround: enemies in a ring around the player */
export function generateSurround(pool: EnemyType[], count: number, playerPos: Vec2, radius = 300): FormationSpawn[] {
  const spawns: FormationSpawn[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.max(-hw + 20, Math.min(hw - 20, playerPos.x + Math.cos(angle) * radius));
    const y = Math.max(-hh + 20, Math.min(hh - 20, playerPos.y + Math.sin(angle) * radius));
    spawns.push({ type: pickRandom(pool), position: new Vec2(x, y), delay: i * 20 });
  }
  return spawns;
}

/** Wall: line of enemies spanning one full world edge */
export function generateWall(pool: EnemyType[], count: number): FormationSpawn[] {
  const type = pickRandom(pool);
  const side = Math.floor(Math.random() * 4);
  const spawns: FormationSpawn[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) - 0.5; // -0.5 to 0.5
    let x: number, y: number;
    switch (side) {
      case 0: x = t * WORLD_WIDTH; y = hh - 10; break;
      case 1: x = t * WORLD_WIDTH; y = -hh + 10; break;
      case 2: x = -hw + 10; y = t * WORLD_HEIGHT; break;
      default: x = hw - 10; y = t * WORLD_HEIGHT; break;
    }
    spawns.push({ type, position: new Vec2(x, y), delay: 0 });
  }
  return spawns;
}

/** Pincer: two groups from opposite sides */
export function generatePincer(pool: EnemyType[], count: number, playerPos: Vec2): FormationSpawn[] {
  const type = pickRandom(pool);
  const spawns: FormationSpawn[] = [];
  // Determine which axis player is more centered on, attack from that axis
  const useVertical = Math.abs(playerPos.x) < Math.abs(playerPos.y);
  const half = Math.floor(count / 2);
  for (let i = 0; i < count; i++) {
    const group = i < half ? -1 : 1;
    const jitter = (Math.random() - 0.5) * 100;
    let x: number, y: number;
    if (useVertical) {
      x = playerPos.x + jitter;
      y = group * (hh - 10);
    } else {
      x = group * (hw - 10);
      y = playerPos.y + jitter;
    }
    x = Math.max(-hw + 20, Math.min(hw - 20, x));
    y = Math.max(-hh + 20, Math.min(hh - 20, y));
    spawns.push({ type, position: new Vec2(x, y), delay: i * 30 });
  }
  return spawns;
}

/** Ambush: enemies spawn 300-500px from player (NOT at edges) */
export function generateAmbush(pool: EnemyType[], count: number, playerPos: Vec2): FormationSpawn[] {
  const spawns: FormationSpawn[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = randRange(250, 400);
    const x = Math.max(-hw + 20, Math.min(hw - 20, playerPos.x + Math.cos(angle) * dist));
    const y = Math.max(-hh + 20, Math.min(hh - 20, playerPos.y + Math.sin(angle) * dist));
    spawns.push({ type: pickRandom(pool), position: new Vec2(x, y), delay: i * 50, isAmbush: true });
  }
  return spawns;
}

/** Cascade: rapid-fire from a single edge point with accelerating rate */
export function generateCascade(pool: EnemyType[], count: number): FormationSpawn[] {
  const type = pickRandom(pool);
  const side = Math.floor(Math.random() * 4);
  const edgePos = (Math.random() - 0.5) * 0.6; // position along edge (-0.3 to 0.3)
  let x: number, y: number;
  switch (side) {
    case 0: x = edgePos * WORLD_WIDTH; y = hh - 10; break;
    case 1: x = edgePos * WORLD_WIDTH; y = -hh + 10; break;
    case 2: x = -hw + 10; y = edgePos * WORLD_HEIGHT; break;
    default: x = hw - 10; y = edgePos * WORLD_HEIGHT; break;
  }
  const spawns: FormationSpawn[] = [];
  let totalDelay = 0;
  for (let i = 0; i < count; i++) {
    const jitterX = (Math.random() - 0.5) * 30;
    const jitterY = (Math.random() - 0.5) * 30;
    spawns.push({ type, position: new Vec2(x + jitterX, y + jitterY), delay: totalDelay });
    totalDelay += Math.max(20, 80 - i * 4); // accelerating: 80ms → 20ms gap
  }
  return spawns;
}
