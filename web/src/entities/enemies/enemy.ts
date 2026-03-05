import { Entity } from '../entity';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import { WORLD_WIDTH, WORLD_HEIGHT, ENEMY_COLLISION_RADIUS } from '../../config';

export type EnemyDeathResult = {
  spawnEnemies?: { type: string; position: Vec2 }[];
};

export abstract class Enemy extends Entity {
  speed = 0.1;
  scoreValue = 0;
  color: [number, number, number] = [1, 1, 1];
  color2: [number, number, number] = [0.5, 0.5, 0.5];
  /** Base shape vertices (unrotated, unscaled) */
  shapePoints: number[][] = [];
  rotationSpeed = 0;
  trailId = -1; // assigned by TrailSystem
  displacer = new Vec2(
    (Math.random() - 0.5) * 64,
    (Math.random() - 0.5) * 64,
  );

  constructor() {
    super();
    this.collisionRadius = ENEMY_COLLISION_RADIUS;
  }

  /** Place at a random position along the world edges */
  spawnAtEdge(): void {
    const hw = WORLD_WIDTH / 2;
    const hh = WORLD_HEIGHT / 2;
    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0: // top
        this.position.set((Math.random() - 0.5) * WORLD_WIDTH, hh - 10);
        break;
      case 1: // bottom
        this.position.set((Math.random() - 0.5) * WORLD_WIDTH, -hh + 10);
        break;
      case 2: // left
        this.position.set(-hw + 10, (Math.random() - 0.5) * WORLD_HEIGHT);
        break;
      case 3: // right
        this.position.set(hw - 10, (Math.random() - 0.5) * WORLD_HEIGHT);
        break;
    }
  }

  /** Move toward a target position */
  protected follow(target: Vec2): void {
    const dir = target.add(this.displacer).sub(this.position);
    const m = dir.magnitude();
    if (m > 0) {
      this.velocity.set(dir.x / m * this.speed, dir.y / m * this.speed);
    }
  }

  /** Move toward where the target will be (predictive) */
  protected attack(target: Vec2, targetVel: Vec2): void {
    const predicted = target.add(targetVel.scale(100)).add(this.displacer);
    const dir = predicted.sub(this.position);
    const m = dir.magnitude();
    if (m > 0) {
      this.velocity.set(dir.x / m * this.speed, dir.y / m * this.speed);
    }
  }

  /** Bounce off world edges */
  protected bounce(): void {
    const hw = WORLD_WIDTH / 2;
    const hh = WORLD_HEIGHT / 2;
    if (Math.abs(this.position.x) >= hw) {
      this.velocity.x *= -1;
      this.position.x *= 0.99;
    }
    if (Math.abs(this.position.y) >= hh) {
      this.velocity.y *= -1;
      this.position.y *= 0.99;
    }
  }

  /** Get the rotated shape points at world position */
  getWorldPoints(): number[][] {
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    return this.shapePoints.map(([x, y]) => [
      this.position.x + x * cos - y * sin,
      this.position.y + x * sin + y * cos,
    ]);
  }

  /** Default rendering: draw the shape as a colored line loop */
  render(renderer: Renderer): void {
    if (!this.active) return;
    const points = this.getWorldPoints();
    // Outer line (color2)
    renderer.drawLineLoop(points.map(([x, y]) => [x - 1, y]), this.color2);
    // Main line (color)
    renderer.drawLineLoop(points, this.color);
  }

  /** Override to spawn children on death */
  onDeath(): EnemyDeathResult {
    return {};
  }
}
