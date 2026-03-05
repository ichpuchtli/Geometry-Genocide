import { Enemy, EnemyDeathResult } from './enemy';
import { Vec2 } from '../../core/vector';
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
}
