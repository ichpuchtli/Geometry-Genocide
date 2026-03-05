import {
  DIFFICULTY_PHASES,
  SPAWN_INTERVALS,
  CLUSTER_BASE_SIZE,
  SPAWN_DELAY_BETWEEN,
} from '../config';
import {
  EnemyType,
  TUTORIAL_POOL,
  RAMPUP_POOL,
  MIDGAME_POOL,
  INTENSE_POOL,
  CHAOS_POOL,
  pickRandom,
} from './spawn-patterns';

export type SpawnRequest = {
  type: EnemyType | 'deathstar';
};

export class WaveManager {
  elapsedTime = 0; // seconds
  private baseTimer = 0;
  private squadTimer = 0;
  private clusterTimer = 0;
  private bossTimer = 0;
  private clusterSize = CLUSTER_BASE_SIZE;
  private spawnQueue: SpawnRequest[] = [];
  private queueTimer = 0;

  reset(): void {
    this.elapsedTime = 0;
    this.baseTimer = 0;
    this.squadTimer = 0;
    this.clusterTimer = 0;
    this.bossTimer = 0;
    this.clusterSize = CLUSTER_BASE_SIZE;
    this.spawnQueue = [];
    this.queueTimer = 0;
  }

  get currentPhase(): string {
    for (const [name, phase] of Object.entries(DIFFICULTY_PHASES)) {
      if (this.elapsedTime >= phase.start && this.elapsedTime < phase.end) return name;
    }
    return 'chaos';
  }

  private getPool(): EnemyType[] {
    switch (this.currentPhase) {
      case 'tutorial': return TUTORIAL_POOL;
      case 'rampUp': return RAMPUP_POOL;
      case 'midGame': return MIDGAME_POOL;
      case 'intense': return INTENSE_POOL;
      default: return CHAOS_POOL;
    }
  }

  private getIntervals() {
    const phase = this.currentPhase as keyof typeof SPAWN_INTERVALS;
    return SPAWN_INTERVALS[phase] || SPAWN_INTERVALS.chaos;
  }

  private addToQueue(type: EnemyType): void {
    this.spawnQueue.push({ type });
  }

  private addCluster(count: number): void {
    const pool = this.getPool();
    const type = pickRandom(pool);
    for (let i = 0; i < count; i++) {
      this.addToQueue(type);
    }
  }

  update(dt: number): SpawnRequest[] {
    const dtSec = dt / 1000;
    this.elapsedTime += dtSec;
    this.baseTimer += dtSec;
    this.squadTimer += dtSec;
    this.clusterTimer += dtSec;
    this.bossTimer += dtSec;

    const intervals = this.getIntervals();
    const pool = this.getPool();

    // Base wave
    if (this.baseTimer >= intervals.base) {
      this.baseTimer = 0;
      this.addToQueue(pickRandom(pool));
      this.addToQueue(pickRandom(pool));
    }

    // Squad
    if (this.squadTimer >= intervals.squad) {
      this.squadTimer = 0;
      this.addToQueue(pickRandom(pool));
      this.addToQueue(pickRandom(pool));
      this.addToQueue('square');
    }

    // Cluster
    if (this.clusterTimer >= intervals.cluster) {
      this.clusterTimer = 0;
      this.addCluster(this.clusterSize);
      this.clusterSize++;
    }

    // Boss
    if (this.bossTimer >= intervals.boss) {
      this.bossTimer = 0;
      this.spawnQueue.push({ type: 'deathstar' });
    }

    // Drain spawn queue with delay
    const spawned: SpawnRequest[] = [];
    this.queueTimer += dt;
    while (this.spawnQueue.length > 0 && this.queueTimer >= SPAWN_DELAY_BETWEEN) {
      this.queueTimer -= SPAWN_DELAY_BETWEEN;
      spawned.push(this.spawnQueue.shift()!);
    }

    return spawned;
  }
}
