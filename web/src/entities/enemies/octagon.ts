import { Enemy, EnemyDeathResult } from './enemy';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import { COLORS, ENEMY_SPEED, ENEMY_SCORES } from '../../config';

export class Octagon extends Enemy {
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
  }

  update(dt: number, playerPos?: Vec2, playerVel?: Vec2): void {
    if (!this.active || !playerPos) return;
    if (playerVel) {
      this.attack(playerPos, playerVel);
    } else {
      this.follow(playerPos);
    }
    this.rotation += dt * 0.003;
    this.move(dt);
  }

  render(renderer: Renderer): void {
    if (!this.active) return;
    const points = this.getWorldPoints();
    renderer.drawLineLoop(points.map(([x, y]) => [x - 1, y]), this.color2);
    renderer.drawLineLoop(points, this.color);
    // Fusion circles at vertices
    for (const [x, y] of points) {
      renderer.drawCircle(x, y, 7, this.color, 12);
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
      spawnEnemies: this.getWorldPoints().map(([x, y]) => ({
        type: 'circle',
        position: new Vec2(x, y),
      })),
    };
  }
}
