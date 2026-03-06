import { Enemy, EnemyDeathResult } from './enemy';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import { COLORS, ENEMY_SPEED, ENEMY_SCORES, MANDELBROT_HP, MANDELBROT_MAX_MINIONS, MANDELBROT_SPAWN_INTERVAL, MANDELBROT_BUD_REGROW_TIME } from '../../config';

/** Mandelbrot cardioid — stationary boss-tier fractal spawner */
export class Mandelbrot extends Enemy {
  activeMinions = 0;
  private minionSpawnTimer = MANDELBROT_SPAWN_INTERVAL;
  private budTimers: number[] = [0, 0, 0, 0]; // 4 buds, 0 = ready
  private hitFlash = 0;
  private tendrilPhase = 0;
  /** Pending minion spawns for game.ts to process */
  pendingMinions: Vec2[] = [];

  constructor() {
    super();
    this.color = COLORS.mandelbrot.color;
    this.color2 = COLORS.mandelbrot.color2;
    this.speed = ENEMY_SPEED.mandelbrot;
    this.scoreValue = ENEMY_SCORES.mandelbrot;
    this.hp = MANDELBROT_HP;
    this.maxHp = MANDELBROT_HP;
    this.collisionRadius = 55;

    // Cardioid shape: r = 1 - cos(theta)
    this.shapePoints = [];
    for (let i = 0; i < 30; i++) {
      const theta = (i / 30) * Math.PI * 2;
      const r = (1 - Math.cos(theta)) * 25;
      this.shapePoints.push([Math.cos(theta) * r, Math.sin(theta) * r]);
    }
  }

  hit(): boolean {
    this.hitFlash = 0.15;
    return super.hit();
  }

  /** Called by game.ts when a MiniMandel child dies */
  onMinionDeath(): void {
    this.activeMinions = Math.max(0, this.activeMinions - 1);
    // Regrow a bud
    for (let i = 0; i < this.budTimers.length; i++) {
      if (this.budTimers[i] > 0) continue; // already ready
      // Find first non-ready bud that isn't regrowing
      // Actually, set a bud to regrow
    }
    // Find a "used" bud slot and start regrowing it
    for (let i = 0; i < this.budTimers.length; i++) {
      if (this.budTimers[i] < 0) { // -1 = used
        this.budTimers[i] = MANDELBROT_BUD_REGROW_TIME;
        break;
      }
    }
  }

  update(dt: number, playerPos?: Vec2): void {
    if (!this.active) return;
    if (this.hitFlash > 0) this.hitFlash -= dt / 1000;
    this.tendrilPhase += dt * 0.002;

    // Very slow drift
    if (playerPos) {
      this.follow(playerPos);
    }
    this.move(dt);
    this.bounce();

    // Tick bud regrow timers
    for (let i = 0; i < this.budTimers.length; i++) {
      if (this.budTimers[i] > 0) {
        this.budTimers[i] -= dt / 1000;
        if (this.budTimers[i] <= 0) this.budTimers[i] = 0; // ready
      }
    }

    // Spawn minions
    this.minionSpawnTimer -= dt / 1000;
    if (this.minionSpawnTimer <= 0 && this.activeMinions < MANDELBROT_MAX_MINIONS) {
      this.minionSpawnTimer = MANDELBROT_SPAWN_INTERVAL;

      // Find a ready bud
      for (let i = 0; i < this.budTimers.length; i++) {
        if (this.budTimers[i] === 0) {
          this.budTimers[i] = -1; // mark as used
          this.activeMinions++;
          // Calculate bud position
          const angle = (i / this.budTimers.length) * Math.PI * 2;
          const budDist = this.collisionRadius + 15;
          const budPos = new Vec2(
            this.position.x + Math.cos(angle) * budDist,
            this.position.y + Math.sin(angle) * budDist,
          );
          this.pendingMinions.push(budPos);
          break;
        }
      }
    }
  }

  override renderSpawn(renderer: Renderer): void {
    this.renderSpawnGravity(renderer);
  }

  render(renderer: Renderer): void {
    if (!this.active) return;
    if (this.isSpawning) { this.renderSpawn(renderer); return; }

    const px = this.position.x;
    const py = this.position.y;
    const drawColor: [number, number, number] = this.hitFlash > 0 ? [1, 1, 1] : this.color;

    // Draw cardioid
    const points = this.getWorldPoints();
    renderer.drawLineLoop(points.map(([x, y]) => [x - 1, y]), this.color2);
    renderer.drawLineLoop(points, drawColor);

    // Period-2 bulb (small circle)
    const bulbX = px - 30;
    const bulbY = py;
    renderer.drawCircle(bulbX, bulbY, 10, drawColor, 12, 0.7);

    // Fractal tendrils that grow/retract
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const tendrilLen = 15 + Math.sin(this.tendrilPhase + i * 1.2) * 10;
      const tx = px + Math.cos(angle) * (this.collisionRadius + tendrilLen);
      const ty = py + Math.sin(angle) * (this.collisionRadius + tendrilLen);
      const bx = px + Math.cos(angle) * this.collisionRadius;
      const by = py + Math.sin(angle) * this.collisionRadius;
      renderer.drawLine(bx, by, tx, ty,
        this.color[0], this.color[1], this.color[2], 0.4);
    }

    // Bud indicators
    for (let i = 0; i < this.budTimers.length; i++) {
      const angle = (i / this.budTimers.length) * Math.PI * 2;
      const bx = px + Math.cos(angle) * (this.collisionRadius + 15);
      const by = py + Math.sin(angle) * (this.collisionRadius + 15);

      if (this.budTimers[i] === 0) {
        // Ready — glow bright
        renderer.drawCircle(bx, by, 5, this.color, 8, 0.8);
      } else if (this.budTimers[i] > 0) {
        // Regrowing — dim with progress
        const progress = 1 - this.budTimers[i] / MANDELBROT_BUD_REGROW_TIME;
        renderer.drawCircle(bx, by, 5 * progress, this.color2, 8, 0.4);
      }
      // budTimers[i] === -1 means used, no visual
    }

    // Interior pulse
    const pulse = 0.2 + Math.sin(this.tendrilPhase * 1.5) * 0.1;
    renderer.drawFilledCircle(px, py, 20, [this.color[0] * pulse, this.color[1] * pulse, this.color[2] * pulse], 16, 0.5);

    // HP indicator
    if (this.hp < this.maxHp) {
      for (let i = 0; i < this.hp; i++) {
        const a = (i / this.maxHp) * Math.PI * 2;
        renderer.drawCircle(px + Math.cos(a) * 65, py + Math.sin(a) * 65, 3, this.color, 8);
      }
    }
  }

  renderGlow(renderer: Renderer, time: number): void {
    if (!this.active) return;
    this.render(renderer);
    const pulse = 0.2 + Math.sin(time * 1.5) * 0.1;
    renderer.drawCircle(this.position.x, this.position.y, this.collisionRadius + 12,
      [this.color[0] * pulse, this.color[1] * pulse, this.color[2] * pulse], 24);
  }

  onDeath(): EnemyDeathResult {
    return {};
  }
}
