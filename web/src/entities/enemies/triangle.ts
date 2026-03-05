import { Enemy, EnemyDeathResult } from './enemy';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import { COLORS, ENEMY_SPEED, ENEMY_SCORES } from '../../config';

export class Triangle extends Enemy {
  constructor() {
    super();
    const s = 30;
    const h = (Math.sqrt(3) / 4) * s;
    this.shapePoints = [
      [-0.5 * s, -h], [0.5 * s, -h], [0, h],
    ];
    this.color = COLORS.triangle.color;
    this.color2 = COLORS.triangle.color2;
    this.speed = ENEMY_SPEED.triangle;
    this.scoreValue = ENEMY_SCORES.triangle;
    this.velocity = Vec2.random().scale(this.speed);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.bounce();
    this.rotation += dt * 0.002;
    this.move(dt);
  }

  render(renderer: Renderer): void {
    if (!this.active) return;
    const points = this.getWorldPoints();
    // Double-line rendering
    renderer.drawLineLoop(points.map(([x, y]) => [x - 1, y]), this.color2);
    renderer.drawLineLoop(points, this.color);
    // Fusion circles at vertices
    for (const [x, y] of points) {
      renderer.drawCircle(x, y, 8, this.color, 12);
    }
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
