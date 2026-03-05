import { Entity } from '../entity';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import { WORLD_WIDTH, WORLD_HEIGHT, ENEMY_COLLISION_RADIUS } from '../../config';

export type EnemyDeathResult = {
  spawnEnemies?: { type: string; position: Vec2 }[];
  /** If true, children spawn with a staggered theatrical delay */
  staggeredSpawn?: boolean;
};

export abstract class Enemy extends Entity {
  speed = 0.1;
  scoreValue = 0;
  hp = 1;
  maxHp = 1;
  color: [number, number, number] = [1, 1, 1];
  color2: [number, number, number] = [0.5, 0.5, 0.5];
  /** Base shape vertices (unrotated, unscaled) */
  shapePoints: number[][] = [];
  rotationSpeed = 0;
  trailId = -1; // assigned by TrailSystem
  spawnTimer = 0.3; // seconds remaining in spawn warp-in animation
  get isSpawning(): boolean { return this.spawnTimer > 0; }
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

  /** Render spawn warp-in effect — cranked to 11 */
  renderSpawn(renderer: Renderer): void {
    const progress = 1 - this.spawnTimer / 0.3;
    const cx = this.position.x;
    const cy = this.position.y;

    // Outer shockwave ring — expands and fades
    const shockR = 60 * progress;
    const shockAlpha = 0.7 * (1 - progress);
    renderer.drawCircle(cx, cy, shockR, [1, 1, 1], 32, shockAlpha);

    // Multiple converging rings — shrink inward with staggered timing
    for (let i = 0; i < 3; i++) {
      const delay = i * 0.12;
      const rp = Math.max(0, Math.min(1, (progress - delay) / (1 - delay)));
      const ringR = 50 * (1 - rp) + 5;
      const ringAlpha = 0.5 * (1 - rp) * rp;
      const hue = i * 0.3;
      renderer.drawCircle(cx, cy, ringR, [
        this.color[0] * (1 - hue) + hue,
        this.color[1] * (1 - hue) + hue * 0.5,
        this.color[2] * (1 - hue) + hue * 0.8,
      ], 24, ringAlpha);
    }

    // Bright center flash at peak
    if (progress > 0.7) {
      const flashProgress = (progress - 0.7) / 0.3;
      const flashR = 8 + flashProgress * 15;
      const flashAlpha = flashProgress * 0.9;
      renderer.drawFilledCircle(cx, cy, flashR, [1, 1, 1], 16, flashAlpha);
    }

    // Radial spokes — rotating energy lines converging to center
    const spokeCount = 6;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (i / spokeCount) * Math.PI * 2 + progress * Math.PI;
      const outerR = 45 * (1 - progress);
      const innerR = 5;
      const sx1 = cx + Math.cos(angle) * outerR;
      const sy1 = cy + Math.sin(angle) * outerR;
      const sx2 = cx + Math.cos(angle) * innerR;
      const sy2 = cy + Math.sin(angle) * innerR;
      renderer.drawLine(sx1, sy1, sx2, sy2,
        this.color[0], this.color[1], this.color[2], 0.4 * progress);
    }

    // Render shape fading in with scale pulse
    const scale = 1 + (1 - progress) * 0.5;
    const points = this.getWorldPoints();
    const scaledPoints = points.map(([x, y]) => [
      cx + (x - cx) * scale,
      cy + (y - cy) * scale,
    ]);
    renderer.drawLineLoop(scaledPoints.map(([x, y]) => [x - 1, y]), this.color2, progress * 0.5);
    renderer.drawLineLoop(scaledPoints, this.color, progress);
  }

  /** Default rendering: draw the shape as a colored line loop */
  render(renderer: Renderer): void {
    if (!this.active) return;
    if (this.isSpawning) { this.renderSpawn(renderer); return; }
    const points = this.getWorldPoints();
    // Outer line (color2)
    renderer.drawLineLoop(points.map(([x, y]) => [x - 1, y]), this.color2);
    // Main line (color)
    renderer.drawLineLoop(points, this.color);
  }

  /** Render with unique glow effect for game over screen. Override per enemy type. */
  renderGlow(renderer: Renderer, time: number): void {
    if (!this.active) return;
    // Default: render normally + pulsing glow ring
    this.render(renderer);
    const pulse = 0.5 + Math.sin(time * 3) * 0.3;
    const glowR = this.collisionRadius + 8;
    renderer.drawCircle(this.position.x, this.position.y, glowR,
      [this.color[0] * pulse, this.color[1] * pulse, this.color[2] * pulse], 24);
  }

  /** Returns true if the enemy is now dead */
  hit(): boolean {
    this.hp--;
    if (this.hp <= 0) {
      this.active = false;
      return true;
    }
    return false;
  }

  /** Override to spawn children on death */
  onDeath(): EnemyDeathResult {
    return {};
  }
}
