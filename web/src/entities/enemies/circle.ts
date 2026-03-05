import { Enemy } from './enemy';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import { COLORS, ENEMY_SPEED, ENEMY_SCORES } from '../../config';

export class CircleEnemy extends Enemy {
  radius = 10;

  constructor(pos?: Vec2, radius: number = 10) {
    super();
    this.radius = radius;
    this.color = COLORS.circle.color;
    this.color2 = COLORS.circle.color2;
    this.speed = ENEMY_SPEED.circle;
    this.scoreValue = ENEMY_SCORES.circle;
    this.collisionRadius = radius + 5;
    if (pos) this.position.copyFrom(pos);
    this.displacer = Vec2.random().scale(25);
  }

  update(dt: number, playerPos?: Vec2): void {
    if (!this.active || !playerPos) return;
    this.follow(playerPos);
    this.move(dt);
  }

  render(renderer: Renderer): void {
    if (!this.active) return;
    // Inner circle
    renderer.drawCircle(this.position.x, this.position.y, this.radius - 1, this.color2, 20);
    // Outer circle
    renderer.drawCircle(this.position.x, this.position.y, this.radius, this.color, 20);
    // Outer ring
    renderer.drawCircle(this.position.x, this.position.y, this.radius + 1, this.color2, 20);
  }

  /** Expanding ripple rings */
  renderGlow(renderer: Renderer, time: number): void {
    if (!this.active) return;
    this.render(renderer);
    // Two ripple rings at different phases
    for (let i = 0; i < 2; i++) {
      const phase = (time * 2 + i * 0.5) % 1.0;
      const rippleR = this.radius + phase * 18;
      const alpha = (1 - phase) * 0.4;
      renderer.drawCircle(this.position.x, this.position.y, rippleR,
        [this.color[0] * alpha, this.color[1] * alpha, this.color[2] * alpha], 20);
    }
  }
}
