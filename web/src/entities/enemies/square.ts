import { Enemy, EnemyDeathResult } from './enemy';
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

  onDeath(): EnemyDeathResult {
    return {
      spawnEnemies: [
        { type: 'square2', position: this.position.add(new Vec2(10, 5)) },
        { type: 'square2', position: this.position.add(new Vec2(-10, -5)) },
      ],
    };
  }
}

export class Square2 extends Enemy {
  constructor(pos?: Vec2) {
    super();
    this.shapePoints = [
      [10, 10], [-10, 10], [-10, -10], [10, -10],
    ];
    this.color = COLORS.square.color;
    this.color2 = COLORS.square.color2;
    this.speed = ENEMY_SPEED.square2;
    this.scoreValue = ENEMY_SCORES.square2;
    if (pos) this.position.copyFrom(pos);
    this.velocity = Vec2.random().scale(this.speed);
  }

  update(dt: number): void {
    if (!this.active) return;
    this.bounce();
    this.rotation += dt * 0.005;
    this.move(dt);
  }

  /** Flickering magenta sparks */
  renderGlow(renderer: Renderer, time: number): void {
    if (!this.active) return;
    this.render(renderer);
    const flicker = 0.4 + Math.sin(time * 8) * 0.3;
    renderer.drawCircle(this.position.x, this.position.y, 16,
      [this.color[0] * flicker, this.color[1] * flicker, this.color[2] * flicker], 16);
  }
}
