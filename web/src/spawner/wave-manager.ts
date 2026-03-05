import { DIFFICULTY_PHASES, SPAWN_DELAY_BETWEEN } from '../config';
import { Vec2 } from '../core/vector';
import {
  EnemyType,
  FormationSpawn,
  TUTORIAL_POOL,
  RAMPUP_POOL,
  MIDGAME_POOL,
  INTENSE_POOL,
  CHAOS_POOL,
  SWARM_POOL,
  pickRandom,
  generateSwarm,
  generateSurround,
  generateWall,
  generatePincer,
  generateAmbush,
  generateCascade,
} from './spawn-patterns';

export type SpawnRequest = {
  type: EnemyType | 'deathstar';
  position?: Vec2;
  delay?: number;      // ms delay before actually spawning
  isAmbush?: boolean;  // longer spawn animation
};

interface SpawnEvent {
  id: string;
  timer: number;
  interval: number;          // seconds between triggers
  intervalVariance: number;  // random +/- seconds
  minCount: number;
  maxCount: number;
  enabled: boolean;
  handler: (count: number, playerPos: Vec2) => SpawnRequest[];
}

export class WaveManager {
  elapsedTime = 0; // seconds
  private events: SpawnEvent[] = [];
  private spawnQueue: SpawnRequest[] = [];
  private queueTimer = 0;
  private currentPhaseName = 'tutorial';

  // Cadence variation
  private burstMode = false;
  private burstTimer = 0;
  private breatherTimer = 0;
  private nextBurstIn = 0; // seconds until next burst window

  constructor() {
    this.setupPhase('tutorial');
    this.nextBurstIn = 30; // first burst possibility at 30s
  }

  reset(): void {
    this.elapsedTime = 0;
    this.events = [];
    this.spawnQueue = [];
    this.queueTimer = 0;
    this.currentPhaseName = 'tutorial';
    this.burstMode = false;
    this.burstTimer = 0;
    this.breatherTimer = 0;
    this.nextBurstIn = 30;
    this.setupPhase('tutorial');
  }

  get currentPhase(): string {
    for (const [name, phase] of Object.entries(DIFFICULTY_PHASES)) {
      if (this.elapsedTime >= phase.start && this.elapsedTime < phase.end) return name;
    }
    return 'chaos';
  }

  private getPool(): EnemyType[] {
    switch (this.currentPhaseName) {
      case 'tutorial': return TUTORIAL_POOL;
      case 'rampUp': return RAMPUP_POOL;
      case 'midGame': return MIDGAME_POOL;
      case 'intense': return INTENSE_POOL;
      default: return CHAOS_POOL;
    }
  }

  private setupPhase(phase: string): void {
    this.events = [];
    this.currentPhaseName = phase;

    switch (phase) {
      case 'tutorial':
        this.addEvent('trickle', 2.5, 0.5, 1, 2, (_count, _pp) => {
          return this.spawnFromPool(pickCount(1, 2));
        });
        // One-shot swarm at 20s handled in update
        break;

      case 'rampUp':
        this.addEvent('trickle', 2.0, 0.3, 2, 3, (_count) => {
          return this.spawnFromPool(pickCount(2, 3));
        });
        this.addEvent('swarm', 15, 3, 15, 25, (count) => {
          return formationToRequests(generateSwarm(SWARM_POOL, count));
        });
        this.addEvent('wall', 25, 4, 10, 15, (count) => {
          return formationToRequests(generateWall(SWARM_POOL, count));
        });
        this.addEvent('squad', 12, 2, 3, 4, (_count) => {
          return this.spawnFromPool(pickCount(3, 4));
        });
        break;

      case 'midGame':
        this.addEvent('trickle', 1.5, 0.3, 2, 4, () => {
          return this.spawnFromPool(pickCount(2, 4));
        });
        this.addEvent('swarm', 12, 2, 20, 30, (count) => {
          return formationToRequests(generateSwarm(SWARM_POOL, count));
        });
        this.addEvent('surround', 20, 3, 8, 12, (count, pp) => {
          return formationToRequests(generateSurround(this.getPool(), count, pp));
        });
        this.addEvent('pincer', 18, 3, 10, 16, (count, pp) => {
          return formationToRequests(generatePincer(this.getPool(), count, pp));
        });
        this.addEvent('wall', 20, 3, 12, 20, (count) => {
          return formationToRequests(generateWall(SWARM_POOL, count));
        });
        this.addEvent('squad', 8, 1.5, 4, 6, () => {
          return this.spawnFromPool(pickCount(4, 6));
        });
        this.addEvent('boss', 45, 5, 1, 1, () => {
          return [{ type: 'deathstar' as const }];
        });
        break;

      case 'intense':
        this.addEvent('trickle', 1.0, 0.2, 3, 5, () => {
          return this.spawnFromPool(pickCount(3, 5));
        });
        this.addEvent('swarm', 10, 2, 25, 35, (count) => {
          return formationToRequests(generateSwarm(SWARM_POOL, count));
        });
        this.addEvent('surround', 15, 2, 10, 16, (count, pp) => {
          return formationToRequests(generateSurround(this.getPool(), count, pp));
        });
        this.addEvent('pincer', 14, 2, 12, 20, (count, pp) => {
          return formationToRequests(generatePincer(this.getPool(), count, pp));
        });
        this.addEvent('ambush', 20, 3, 4, 6, (count, pp) => {
          return formationToRequests(generateAmbush(this.getPool(), count, pp));
        });
        this.addEvent('cascade', 12, 2, 10, 15, (count) => {
          return formationToRequests(generateCascade(this.getPool(), count));
        });
        this.addEvent('boss', 35, 5, 1, 1, () => {
          return [{ type: 'deathstar' as const }];
        });
        break;

      default: // chaos
        this.addEvent('trickle', 0.7, 0.1, 4, 6, () => {
          return this.spawnFromPool(pickCount(4, 6));
        });
        this.addEvent('swarm', 8, 1.5, 30, 40, (count) => {
          return formationToRequests(generateSwarm(SWARM_POOL, count));
        });
        this.addEvent('surround', 12, 2, 12, 20, (count, pp) => {
          return formationToRequests(generateSurround(this.getPool(), count, pp));
        });
        this.addEvent('pincer', 10, 1.5, 15, 25, (count, pp) => {
          return formationToRequests(generatePincer(this.getPool(), count, pp));
        });
        this.addEvent('ambush', 15, 2, 5, 8, (count, pp) => {
          return formationToRequests(generateAmbush(this.getPool(), count, pp));
        });
        this.addEvent('cascade', 8, 1.5, 15, 20, (count) => {
          return formationToRequests(generateCascade(this.getPool(), count));
        });
        this.addEvent('boss', 25, 3, 1, 1, () => {
          return [{ type: 'deathstar' as const }];
        });
        break;
    }
  }

  private addEvent(
    id: string, interval: number, variance: number,
    minCount: number, maxCount: number,
    handler: (count: number, playerPos: Vec2) => SpawnRequest[],
  ): void {
    this.events.push({
      id, timer: 0, interval, intervalVariance: variance,
      minCount, maxCount, enabled: true, handler,
    });
  }

  private spawnFromPool(count: number): SpawnRequest[] {
    const pool = this.getPool();
    const reqs: SpawnRequest[] = [];
    for (let i = 0; i < count; i++) {
      reqs.push({ type: pickRandom(pool) });
    }
    return reqs;
  }

  private tutorialSwarmFired = false;

  update(dt: number, playerPos: Vec2): SpawnRequest[] {
    const dtSec = dt / 1000;
    this.elapsedTime += dtSec;

    // Phase transitions
    const newPhase = this.currentPhase;
    if (newPhase !== this.currentPhaseName) {
      this.setupPhase(newPhase);
    }

    // Tutorial one-shot swarm at 20s
    if (!this.tutorialSwarmFired && this.elapsedTime >= 20) {
      this.tutorialSwarmFired = true;
      const swarm = generateSwarm(TUTORIAL_POOL, 8);
      for (const s of swarm) {
        this.spawnQueue.push({ type: s.type, position: s.position, delay: s.delay });
      }
    }

    // Cadence variation (only after tutorial)
    if (this.currentPhaseName !== 'tutorial') {
      this.updateCadence(dtSec);
    }

    // Update spawn events
    const intervalMultiplier = this.burstMode ? 0.5 : 1.0;
    const isBreather = this.breatherTimer > 0;

    for (const event of this.events) {
      if (!event.enabled) continue;
      event.timer += dtSec;

      const effectiveInterval = event.interval * intervalMultiplier;
      if (event.timer >= effectiveInterval) {
        event.timer -= effectiveInterval;
        // Add some variance to next fire
        event.timer -= (Math.random() - 0.5) * event.intervalVariance;

        // During breather, only trickle fires
        if (isBreather && event.id !== 'trickle') continue;

        const count = pickCount(event.minCount, event.maxCount);
        const spawns = event.handler(count, playerPos);
        for (const s of spawns) {
          this.spawnQueue.push(s);
        }
      }
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

  private updateCadence(dtSec: number): void {
    if (this.breatherTimer > 0) {
      this.breatherTimer -= dtSec;
      if (this.breatherTimer <= 0) {
        this.breatherTimer = 0;
        // Schedule next burst
        this.nextBurstIn = 15 + Math.random() * 20;
      }
      return;
    }

    if (this.burstMode) {
      this.burstTimer -= dtSec;
      if (this.burstTimer <= 0) {
        this.burstMode = false;
        this.burstTimer = 0;
        // Start breather
        this.breatherTimer = 3 + Math.random() * 2;
      }
      return;
    }

    // Count down to next burst
    this.nextBurstIn -= dtSec;
    if (this.nextBurstIn <= 0) {
      this.burstMode = true;
      this.burstTimer = 5 + Math.random() * 5;
    }
  }
}

function pickCount(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function formationToRequests(formation: FormationSpawn[]): SpawnRequest[] {
  return formation.map(f => ({
    type: f.type,
    position: f.position,
    delay: f.delay,
    isAmbush: f.isAmbush,
  }));
}
