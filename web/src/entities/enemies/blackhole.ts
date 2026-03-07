import { Enemy, EnemyDeathResult } from './enemy';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import { COLORS, ENEMY_SPEED, ENEMY_SCORES } from '../../config';

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
    this.color = COLORS.blackhole.color;
    this.color2 = COLORS.blackhole.color2;
    this.speed = ENEMY_SPEED.blackhole;
    this.scoreValue = ENEMY_SCORES.blackhole;
    this.collisionRadius = 35;

    // No geometric shape — blackhole is rendered procedurally
    this.shapePoints = [];
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
    const horizonR = (baseR - 5) * pulse;

    // 1. Outer gravitational influence glow (very faint expanding rings)
    for (let i = 0; i < 3; i++) {
      const glowR = (baseR + 30 + i * 20) * pulse;
      const glowAlpha = 0.08 - i * 0.02;
      renderer.drawCircle(px, py, glowR, [0.3, 0.15, 0.05], 28, glowAlpha);
    }

    // 2. Accretion disk — multiple partial arcs at varied tilts and speeds
    const diskArcs = [
      { rMul: 1.3, speed: 1.0,  arcLen: Math.PI * 1.4, color: [1, 0.4, 0.1] as [number, number, number], alpha: 0.6 },
      { rMul: 1.15, speed: -1.5, arcLen: Math.PI * 1.2, color: [1, 0.6, 0.2] as [number, number, number], alpha: 0.7 },
      { rMul: 1.05, speed: 2.0,  arcLen: Math.PI * 1.0, color: [1, 0.8, 0.4] as [number, number, number], alpha: 0.8 },
      { rMul: 0.95, speed: -2.5, arcLen: Math.PI * 0.8, color: [1, 0.9, 0.6] as [number, number, number], alpha: 0.85 },
      { rMul: 1.4, speed: 0.7,  arcLen: Math.PI * 1.6, color: [1, 0.3, 0.05] as [number, number, number], alpha: 0.35 },
    ];
    for (const arc of diskArcs) {
      const arcR = horizonR * arc.rMul;
      const rot = this.ringRotation * arc.speed + arc.rMul * 2.0;
      // Brighten with instability
      const a = arc.alpha + instability * 0.15;
      this.drawArc(renderer, px, py, arcR, rot, arc.arcLen, 24, arc.color, a);
    }

    // 3. Event horizon — solid black circle (true void)
    renderer.drawFilledCircle(px, py, horizonR, [0, 0, 0], 32, 1.0);

    // 4. Photon ring — thin bright ring at horizon edge
    renderer.drawCircle(px, py, horizonR + 1.5, [1, 0.85, 0.4], 32, 0.9);
    renderer.drawCircle(px, py, horizonR + 3, [1, 0.6, 0.15], 32, 0.45);

    // 5. Hot core glow (Hawking radiation point)
    const coreBrightness = 0.5 + Math.sin(this.pulseTimer * 0.005) * 0.3 + instability * 0.3;
    renderer.drawFilledCircle(px, py, 3, [1, 1, 1], 8, coreBrightness);

    // 6. Danger ring when instability > 0.5
    if (instability > 0.5) {
      const dangerAlpha = (instability - 0.5) * 2; // 0-1 over the last half
      const dangerPulse = 1 + Math.sin(this.pulseTimer * 0.008) * 0.15;
      const dangerR = (baseR + 30) * dangerPulse;
      renderer.drawCircle(px, py, dangerR, [1, 0.4, 0.1], 28, dangerAlpha * 0.5);
    }

    // 7. Absorption count indicator (small dots orbiting)
    for (let i = 0; i < this.absorbedCount; i++) {
      const a = (i / BlackHole.MAX_ABSORB) * Math.PI * 2 + this.ringRotation * 3;
      const orbitR = horizonR + 6;
      const dx = px + Math.cos(a) * orbitR;
      const dy = py + Math.sin(a) * orbitR;
      renderer.drawCircle(dx, dy, 2, [1, 0.9, 0.5], 6, 0.7);
    }
  }

  /** Draw a partial arc (like an accretion disk streak) */
  private drawArc(
    renderer: Renderer, cx: number, cy: number, radius: number,
    rotation: number, arcLength: number, segments: number,
    color: [number, number, number], alpha: number,
  ): void {
    const step = arcLength / segments;
    for (let i = 0; i < segments; i++) {
      const a1 = rotation + i * step;
      const a2 = rotation + (i + 1) * step;
      // Fade: bright in middle, dim at edges
      const t = i / segments;
      const fade = Math.sin(t * Math.PI); // 0 at edges, 1 at center
      const a = alpha * (0.3 + 0.7 * fade);
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
    // Pulsing gravity waves (warm colors)
    for (let i = 0; i < 4; i++) {
      const phase = (time * 0.6 + i * 0.25) % 1.0;
      const ringR = this.collisionRadius + phase * 60;
      const alpha = (1 - phase) * 0.2;
      renderer.drawCircle(this.position.x, this.position.y, ringR,
        [alpha, alpha * 0.5, alpha * 0.1], 28);
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
