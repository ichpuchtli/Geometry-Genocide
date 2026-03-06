import { Enemy, EnemyDeathResult } from './enemy';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import { COLORS, ENEMY_SPEED, ENEMY_SCORES, ENEMY_COLLISION_RADIUS } from '../../config';

/** Gravity/Black Hole enemy — warps the grid, attracts nearby enemies and bullets */
export class BlackHole extends Enemy {
  /** How many enemies this black hole has absorbed */
  absorbedCount = 0;
  private pulseTimer = 0;
  private ringRotation = 0;

  /** Max enemies before it becomes unstable and can be killed more easily */
  static readonly MAX_ABSORB = 12;
  static readonly ATTRACT_RADIUS = 300;
  static readonly GRAVITY_STRENGTH = 0.18; // px/ms^2

  constructor() {
    super();
    // Dark purple / violet
    this.color = COLORS.blackhole.color;
    this.color2 = COLORS.blackhole.color2;
    this.speed = ENEMY_SPEED.blackhole;
    this.scoreValue = ENEMY_SCORES.blackhole;
    this.collisionRadius = 35;

    // Shape: hexagon (inner core visual)
    const s = 15;
    this.shapePoints = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      this.shapePoints.push([Math.cos(a) * s, Math.sin(a) * s]);
    }
  }

  absorbEnemy(): void {
    this.absorbedCount++;
    // Grow slightly with each absorption
    this.collisionRadius = 35 + this.absorbedCount * 2;
  }

  update(dt: number, _playerPos?: Vec2): void {
    if (!this.active) return;
    // No movement — stationary gravity well
    const spinRate = 0.004 + this.absorbedCount * 0.001;
    this.rotation += dt * spinRate;
    this.ringRotation += dt * 0.002;
    this.pulseTimer += dt;
  }

  override renderSpawn(renderer: Renderer): void {
    this.renderSpawnGravity(renderer);
  }

  render(renderer: Renderer): void {
    if (!this.active) return;
    if (this.isSpawning) { this.renderSpawn(renderer); return; }

    const instability = this.absorbedCount / BlackHole.MAX_ABSORB; // 0 to 1
    const pulseAmp = 0.08 + instability * 0.15;
    // Position jitter when unstable
    const jitter = instability * 3;
    const px = this.position.x + (jitter > 0 ? (Math.random() - 0.5) * 2 * jitter : 0);
    const py = this.position.y + (jitter > 0 ? (Math.random() - 0.5) * 2 * jitter : 0);
    const pulse = 1 + Math.sin(this.pulseTimer * 0.003) * pulseAmp;
    const baseR = this.collisionRadius;

    // Color shift toward white-violet as instability grows
    const coreColor: [number, number, number] = [
      this.color[0] + (1 - this.color[0]) * instability * 0.6,
      this.color[1] + (0.8 - this.color[1]) * instability * 0.6,
      this.color[2] + (1 - this.color[2]) * instability * 0.6,
    ];

    // Outer gravitational rings (rotating)
    for (let i = 0; i < 3; i++) {
      const ringR = (baseR + 15 + i * 14) * pulse;
      const angle = this.ringRotation * (i % 2 === 0 ? 1 : -1) + i * 0.7;
      const alpha = 0.25 - i * 0.06;
      this.drawRotatedRing(renderer, px, py, ringR, angle, 20, this.color2, alpha);
    }

    // Event horizon (dark filled circle)
    const horizonR = (baseR - 8) * pulse;
    renderer.drawFilledCircle(px, py, horizonR, [0.02, 0.0, 0.04], 20, 0.8);

    // Inner accretion disk
    const diskR = baseR * pulse;
    renderer.drawCircle(px, py, diskR, coreColor, 24, 0.9);
    renderer.drawCircle(px, py, diskR * 0.7, this.color2, 20, 0.7);

    // Core shape (hexagon)
    const points = this.getWorldPoints();
    renderer.drawLineLoop(points, coreColor, 0.9);

    // Bright core dot
    const coreB = 0.6 + Math.sin(this.pulseTimer * 0.005) * 0.3;
    renderer.drawCircle(px, py, 4, [coreB, coreB * 0.5, coreB], 8, 0.9);

    // Danger ring when instability > 0.5
    if (instability > 0.5) {
      const dangerAlpha = (instability - 0.5) * 2; // 0-1 over the last half
      const dangerPulse = 1 + Math.sin(this.pulseTimer * 0.008) * 0.15;
      const dangerR = (baseR + 30) * dangerPulse;
      renderer.drawCircle(px, py, dangerR, [1, 0.4, 0.4], 28, dangerAlpha * 0.5);
    }

    // Absorption count indicator (small dots orbiting)
    for (let i = 0; i < this.absorbedCount; i++) {
      const a = (i / BlackHole.MAX_ABSORB) * Math.PI * 2 + this.ringRotation * 3;
      const orbitR = baseR + 8;
      const dx = px + Math.cos(a) * orbitR;
      const dy = py + Math.sin(a) * orbitR;
      renderer.drawCircle(dx, dy, 2, [1, 1, 1], 6, 0.7);
    }
  }

  private drawRotatedRing(
    renderer: Renderer, cx: number, cy: number, radius: number,
    rotation: number, segments: number, color: [number, number, number], alpha: number,
  ): void {
    const step = (Math.PI * 2) / segments;
    // Draw a partial ring (arc) for a vortex look
    const arcLength = Math.PI * 1.5; // 3/4 of circle
    const arcSegs = Math.ceil(segments * (arcLength / (Math.PI * 2)));
    for (let i = 0; i < arcSegs; i++) {
      const a1 = rotation + i * step;
      const a2 = rotation + (i + 1) * step;
      const fadeIn = i / arcSegs;
      const a = alpha * fadeIn;
      renderer.drawLine(
        cx + Math.cos(a1) * radius, cy + Math.sin(a1) * radius,
        cx + Math.cos(a2) * radius, cy + Math.sin(a2) * radius,
        color[0], color[1], color[2], a,
      );
    }
  }

  renderGlow(renderer: Renderer, time: number): void {
    if (!this.active) return;
    this.render(renderer);
    // Pulsing gravity waves
    for (let i = 0; i < 4; i++) {
      const phase = (time * 0.6 + i * 0.25) % 1.0;
      const ringR = this.collisionRadius + phase * 60;
      const alpha = (1 - phase) * 0.2;
      renderer.drawCircle(this.position.x, this.position.y, ringR,
        [this.color[0] * alpha, this.color[1] * alpha, this.color[2] * alpha], 28);
    }
  }

  onDeath(): EnemyDeathResult {
    // Release absorbed enemies as circles
    if (this.absorbedCount <= 0) return {};
    const spawns: { type: string; position: Vec2 }[] = [];
    for (let i = 0; i < this.absorbedCount; i++) {
      const angle = (i / this.absorbedCount) * Math.PI * 2;
      const dist = 40 + Math.random() * 30;
      spawns.push({
        type: 'circle',
        position: new Vec2(
          this.position.x + Math.cos(angle) * dist,
          this.position.y + Math.sin(angle) * dist,
        ),
      });
    }
    return { spawnEnemies: spawns };
  }
}
