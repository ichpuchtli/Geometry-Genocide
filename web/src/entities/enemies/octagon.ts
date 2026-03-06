import { Enemy, EnemyDeathResult } from './enemy';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import { COLORS, ENEMY_SPEED, ENEMY_SCORES, OCTAGON_HP } from '../../config';

export class Octagon extends Enemy {
  private hitFlash = 0; // flash timer on taking damage

  constructor() {
    super();
    const s = 25;
    this.shapePoints = [
      [1.207 * s, 0.5 * s], [0.5 * s, 1.207 * s],
      [-0.5 * s, 1.207 * s], [-1.207 * s, 0.5 * s],
      [-1.207 * s, -0.5 * s], [-0.5 * s, -1.207 * s],
      [0.5 * s, -1.207 * s], [1.207 * s, -0.5 * s],
    ];
    this.color = COLORS.octagon.color;
    this.color2 = COLORS.octagon.color2;
    this.speed = ENEMY_SPEED.octagon;
    this.scoreValue = ENEMY_SCORES.octagon;
    this.hp = OCTAGON_HP;
    this.maxHp = OCTAGON_HP;
  }

  hit(): boolean {
    this.hitFlash = 0.15; // 150ms white flash
    return super.hit();
  }

  update(dt: number, playerPos?: Vec2, playerVel?: Vec2): void {
    if (!this.active || !playerPos) return;
    if (this.hitFlash > 0) this.hitFlash -= dt / 1000;
    if (playerVel) {
      this.attack(playerPos, playerVel);
    } else {
      this.follow(playerPos);
    }
    this.rotation += dt * 0.003;
    this.move(dt);
  }

  override renderSpawn(renderer: Renderer): void {
    this.renderSpawnGravity(renderer);
  }

  render(renderer: Renderer): void {
    if (!this.active) return;
    if (this.isSpawning) { this.renderSpawn(renderer); return; }
    const points = this.getWorldPoints();
    // Flash white when hit
    const drawColor: [number, number, number] = this.hitFlash > 0
      ? [1, 1, 1] : this.color;
    const drawColor2: [number, number, number] = this.hitFlash > 0
      ? [0.8, 0.8, 0.8] : this.color2;
    renderer.drawLineLoop(points.map(([x, y]) => [x - 1, y]), drawColor2);
    renderer.drawLineLoop(points, drawColor);
    // Fusion circles at vertices
    for (const [x, y] of points) {
      renderer.drawCircle(x, y, 7, drawColor, 12);
    }
    // HP indicator: dots around the octagon
    if (this.hp < this.maxHp) {
      for (let i = 0; i < this.hp; i++) {
        const a = (i / this.maxHp) * Math.PI * 2;
        const dx = this.position.x + Math.cos(a) * 42;
        const dy = this.position.y + Math.sin(a) * 42;
        renderer.drawCircle(dx, dy, 3, this.color, 8);
      }
    }
  }

  /** Massive gravity glow with concentric warping rings */
  renderGlow(renderer: Renderer, time: number): void {
    if (!this.active) return;
    this.render(renderer);
    // Concentric gravity rings that pulse outward
    for (let i = 0; i < 3; i++) {
      const phase = (time * 1.5 + i * 0.33) % 1.0;
      const ringR = 35 + phase * 40;
      const alpha = (1 - phase) * 0.3;
      renderer.drawCircle(this.position.x, this.position.y, ringR,
        [this.color[0] * alpha, this.color[1] * alpha, this.color[2] * alpha], 28);
    }
    // Bright core glow
    const core = 0.3 + Math.sin(time * 2) * 0.15;
    renderer.drawCircle(this.position.x, this.position.y, 20,
      [this.color[0] * core, this.color[1] * core, this.color[2] * core], 20);
  }

  onDeath(): EnemyDeathResult {
    return {
      staggeredSpawn: true,
      spawnEnemies: this.getWorldPoints().map(([x, y]) => ({
        type: 'circle',
        position: new Vec2(x, y),
      })),
    };
  }
}
