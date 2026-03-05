import { Enemy } from './enemy';
import { Vec2 } from '../../core/vector';
import { COLORS, ENEMY_SPEED, ENEMY_SCORES } from '../../config';

export class Rhombus extends Enemy {
  constructor() {
    super();
    this.shapePoints = [[-15, 0], [0, 25], [15, 0], [0, -25]];
    this.color = COLORS.rhombus.color;
    this.color2 = COLORS.rhombus.color2;
    this.speed = ENEMY_SPEED.rhombus;
    this.scoreValue = ENEMY_SCORES.rhombus;
  }

  update(dt: number, playerPos?: Vec2): void {
    if (!this.active || !playerPos) return;
    this.follow(playerPos);
    this.move(dt);
  }
}
