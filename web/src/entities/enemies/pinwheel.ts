import { Enemy } from './enemy';
import { Vec2 } from '../../core/vector';
import { COLORS, ENEMY_SPEED, ENEMY_SCORES } from '../../config';

export class Pinwheel extends Enemy {
  constructor() {
    super();
    const s = 20;
    this.shapePoints = [
      [0, 0], [0, s], [s * 0.5, s * 0.5], [-s * 0.5, -s * 0.5],
      [0, -s], [0, 0], [s, 0], [s * 0.5, -s * 0.5],
      [-s * 0.5, s * 0.5], [-s, 0],
    ];
    this.color = COLORS.pinwheel.color;
    this.color2 = COLORS.pinwheel.color2;
    this.speed = ENEMY_SPEED.pinwheel;
    this.scoreValue = ENEMY_SCORES.pinwheel;
    this.velocity = Vec2.random().scale(this.speed);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.bounce();
    this.rotation -= dt * 0.003; // counter-clockwise
    this.move(dt);
  }
}
