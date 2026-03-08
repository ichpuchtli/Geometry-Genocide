import { DIFFICULTY_PHASES, SPAWN_DELAY_BETWEEN } from '../config';
import { Vec2 } from '../core/vector';
import {
  EnemyType,
  FormationSpawn,
  FormationMeta,
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
  type: EnemyType;
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
  spawnRateMultiplier = 1.0;
  private events: SpawnEvent[] = [];
  private spawnQueue: SpawnRequest[] = [];
  private queueTimer = 0;
  private currentPhaseName = 'tutorial';

  // Phase change callback
  onPhaseChange?: (newPhase: string, oldPhase: string) => void;

  // Formation events fired this frame (read by game.ts for telegraphs)
  formationEvents: FormationMeta[] = [];

  // Cadence variation
  private burstMode = false;
  private burstTimer = 0;
  private breatherTimer = 0;
  private nextBurstIn = 0; // seconds until next burst window

  constructor() {
    this.setupPhase('tutorial');
    this.nextBurstIn = 20; // first burst possibility at 20s
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
    this.nextBurstIn = 20;
    this.spawnRateMultiplier = 1.0;
    this.setupPhase('tutorial');
  }

  jumpToPhase(phase: string): void {
    const p = DIFFICULTY_PHASES[phase as keyof typeof DIFFICULTY_PHASES];
    if (p) {
      this.elapsedTime = p.start;
      this.setupPhase(phase);
    }
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
        // One-shot swarm at 15s handled in update
        break;

      case 'rampUp':
        this.addEvent('trickle', 2.0, 0.4, 1, 3, (_count) => {
          return this.spawnFromPool(pickCount(1, 3));
        });
        this.addEvent('swarm', 14, 3, 12, 20, (count) => {
          return this.formationToRequests(generateSwarm(SWARM_POOL, count));
        });
        this.addEvent('wall', 22, 4, 8, 14, (count) => {
          return this.formationToRequests(generateWall(SWARM_POOL, count));
        });
        this.addEvent('squad', 12, 2, 3, 5, (_count) => {
          return this.spawnFromPool(pickCount(3, 5));
        });
        break;

      case 'midGame':
        this.addEvent('trickle', 1.5, 0.3, 2, 4, () => {
          return this.spawnFromPool(pickCount(2, 4));
        });
        this.addEvent('swarm', 12, 2, 18, 28, (count) => {
          return this.formationToRequests(generateSwarm(SWARM_POOL, count));
        });
        this.addEvent('surround', 18, 3, 8, 14, (count, pp) => {
          return this.formationToRequests(generateSurround(this.getPool(), count, pp));
        });
        this.addEvent('pincer', 16, 3, 10, 16, (count, pp) => {
          return this.formationToRequests(generatePincer(this.getPool(), count, pp));
        });
        this.addEvent('wall', 18, 3, 12, 20, (count) => {
          return this.formationToRequests(generateWall(SWARM_POOL, count));
        });
        this.addEvent('squad', 8, 1.5, 4, 6, () => {
          return this.spawnFromPool(pickCount(4, 6));
        });
        break;

      case 'intense':
        this.addEvent('trickle', 0.8, 0.2, 4, 6, () => {
          return this.spawnFromPool(pickCount(4, 6));
        });
        this.addEvent('swarm', 8, 2, 30, 40, (count) => {
          return this.formationToRequests(generateSwarm(SWARM_POOL, count));
        });
        this.addEvent('surround', 12, 2, 14, 20, (count, pp) => {
          return this.formationToRequests(generateSurround(this.getPool(), count, pp));
        });
        this.addEvent('pincer', 10, 2, 16, 24, (count, pp) => {
          return this.formationToRequests(generatePincer(this.getPool(), count, pp));
        });
        this.addEvent('ambush', 14, 3, 6, 10, (count, pp) => {
          return this.formationToRequests(generateAmbush(this.getPool(), count, pp));
        });
        this.addEvent('cascade', 8, 2, 15, 20, (count) => {
          return this.formationToRequests(generateCascade(this.getPool(), count));
        });
        break;

      default: // chaos
        this.addEvent('trickle', 0.5, 0.1, 5, 8, () => {
          return this.spawnFromPool(pickCount(5, 8));
        });
        this.addEvent('swarm', 6, 1.5, 35, 50, (count) => {
          return this.formationToRequests(generateSwarm(SWARM_POOL, count));
        });
        this.addEvent('surround', 8, 2, 16, 24, (count, pp) => {
          return this.formationToRequests(generateSurround(this.getPool(), count, pp));
        });
        this.addEvent('pincer', 7, 1.5, 20, 30, (count, pp) => {
          return this.formationToRequests(generatePincer(this.getPool(), count, pp));
        });
        this.addEvent('ambush', 10, 2, 8, 12, (count, pp) => {
          return this.formationToRequests(generateAmbush(this.getPool(), count, pp));
        });
        this.addEvent('cascade', 5, 1.5, 20, 30, (count) => {
          return this.formationToRequests(generateCascade(this.getPool(), count));
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

  /** Convert FormationResult to SpawnRequests + record formation event for telegraphs */
  private formationToRequests(result: { spawns: FormationSpawn[]; meta: FormationMeta }): SpawnRequest[] {
    this.formationEvents.push(result.meta);
    return result.spawns.map(f => ({
      type: f.type,
      position: f.position,
      delay: f.delay,
      isAmbush: f.isAmbush,
    }));
  }

  private tutorialSwarmFired = false;

  update(dt: number, playerPos: Vec2): SpawnRequest[] {
    const dtSec = dt / 1000;
    this.elapsedTime += dtSec;

    // Phase transitions
    const newPhase = this.currentPhase;
    if (newPhase !== this.currentPhaseName) {
      const oldPhase = this.currentPhaseName;
      this.setupPhase(newPhase);
      if (this.onPhaseChange) this.onPhaseChange(newPhase, oldPhase);
    }

    // Clear formation events from previous frame
    this.formationEvents = [];

    // Tutorial one-shot swarm at 20s
    if (!this.tutorialSwarmFired && this.elapsedTime >= 15) {
      this.tutorialSwarmFired = true;
      const result = generateSwarm(TUTORIAL_POOL, 8);
      this.formationEvents.push(result.meta);
      for (const s of result.spawns) {
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

      const effectiveInterval = event.interval * intervalMultiplier * this.spawnRateMultiplier;
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
        this.nextBurstIn = 12 + Math.random() * 13;
      }
      return;
    }

    if (this.burstMode) {
      this.burstTimer -= dtSec;
      if (this.burstTimer <= 0) {
        this.burstMode = false;
        this.burstTimer = 0;
        // Start breather
        this.breatherTimer = 2 + Math.random() * 2;
      }
      return;
    }

    // Count down to next burst
    this.nextBurstIn -= dtSec;
    if (this.nextBurstIn <= 0) {
      this.burstMode = true;
      this.burstTimer = 6 + Math.random() * 6;
    }
  }
}

function pickCount(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// removed — replaced by WaveManager.formationToRequests instance method
