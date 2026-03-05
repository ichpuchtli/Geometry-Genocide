export type EnemyType = 'rhombus' | 'pinwheel' | 'square' | 'triangle' | 'octagon' | 'circle';

export const TUTORIAL_POOL: EnemyType[] = ['rhombus', 'pinwheel'];
export const RAMPUP_POOL: EnemyType[] = ['rhombus', 'pinwheel', 'square', 'rhombus'];
export const MIDGAME_POOL: EnemyType[] = ['rhombus', 'pinwheel', 'square', 'triangle', 'octagon'];
export const INTENSE_POOL: EnemyType[] = ['square', 'triangle', 'octagon', 'circle', 'rhombus', 'pinwheel'];
export const CHAOS_POOL: EnemyType[] = ['square', 'triangle', 'octagon', 'circle', 'circle'];

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
