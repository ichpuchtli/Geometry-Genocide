import { Entity } from '../entity';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import {
  COLORS,
  DEATHSTAR_HP,
  DEATHSTAR_COLLISION_RADIUS,
  DEATHSTAR_CIRCLE_SPAWN,
  DEATHSTAR_ATTRACT_RADIUS,
} from '../../config';

export class DeathStar extends Entity {
  hp = DEATHSTAR_HP;
  circleSpawnCount = DEATHSTAR_CIRCLE_SPAWN;
  color = COLORS.deathstar.color;
  color2 = COLORS.deathstar.color2;
  pulseTimer = 0;

  constructor(playerPos: Vec2) {
    super();
    this.collisionRadius = DEATHSTAR_COLLISION_RADIUS;
    // Spawn opposite to player
    this.position = playerPos.negate();
    // If too close to player, push away
    if (this.position.distanceTo(playerPos) < 200) {
      this.position.addMut(new Vec2(200, 200));
    }
  }

  get attractRadius(): number {
    return DEATHSTAR_ATTRACT_RADIUS;
  }

  hit(): void {
    this.hp--;
    if (this.hp <= 0) {
      this.active = false;
    }
  }

  /** Called when an enemy is absorbed by this DeathStar */
  absorbEnemy(): void {
    this.circleSpawnCount++;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.pulseTimer += dt;
  }

  render(renderer: Renderer): void {
    if (!this.active) return;
    const px = this.position.x;
    const py = this.position.y;
    const pulse = 1 + Math.sin(this.pulseTimer * 0.003) * 0.1;

    // Concentric circles
    renderer.drawCircle(px, py, 40 * pulse, this.color2, 32);
    renderer.drawCircle(px, py, 30 * pulse, this.color, 24);
    renderer.drawCircle(px, py, 20 * pulse, this.color2, 20);
    renderer.drawCircle(px, py, 10 * pulse, this.color, 16);

    // HP indicator: small dots around the edge
    const hpFraction = this.hp / DEATHSTAR_HP;
    const segments = Math.ceil(hpFraction * 12);
    for (let i = 0; i < segments; i++) {
      const a = (i / 12) * Math.PI * 2;
      const cx = px + Math.cos(a) * 48 * pulse;
      const cy = py + Math.sin(a) * 48 * pulse;
      renderer.drawCircle(cx, cy, 3, this.color, 8);
    }
  }
}
