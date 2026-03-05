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

  onDeath(): EnemyDeathResult {
    return {
      spawnEnemies: this.getWorldPoints().map(([x, y]) => ({
        type: 'circle',
        position: new Vec2(x, y),
      })),
    };
  }
}
