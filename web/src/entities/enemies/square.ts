import { Enemy } from './enemy';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import { COLORS, ENEMY_SPEED, ENEMY_SCORES } from '../../config';

export class Square extends Enemy {
  constructor() {
    super();
    this.shapePoints = [
      [15, 15], [-15, 15], [-15, -15], [15, -15],
    ];
    this.color = COLORS.square.color;
    this.color2 = COLORS.square.color2;
    this.speed = ENEMY_SPEED.square;
    this.scoreValue = ENEMY_SCORES.square;
  }

  update(dt: number, playerPos?: Vec2): void {
    if (!this.active || !playerPos) return;
    this.follow(playerPos);
    this.rotation = this.velocity.angle();
    this.move(dt);
  }

  /** Pulsing magenta energy corners */
  renderGlow(renderer: Renderer, time: number): void {
    if (!this.active) return;
    this.render(renderer);
    const points = this.getWorldPoints();
    for (let i = 0; i < points.length; i++) {
      const pulse = 0.5 + Math.sin(time * 6 + i * 1.5) * 0.3;
      renderer.drawCircle(points[i][0], points[i][1], 6,
        [this.color[0] * pulse, this.color[1] * pulse, this.color[2] * pulse], 8);
    }
  }
}
