import { Entity } from './entity';
import { Vec2 } from '../core/vector';
import { Input } from '../core/input';
import { Renderer } from '../renderer/sprite-batch';
import {
  PLAYER_SPEED,
  PLAYER_COLLISION_RADIUS,
  PLAYER_STARTING_LIVES,
  PLAYER_INVULN_DURATION,
  PLAYER_SHIP_SCALE,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WEAPON_STAGES,
} from '../config';
import { gameSettings } from '../settings';

export class Player extends Entity {
  lives = PLAYER_STARTING_LIVES;
  score = 0;
  enemiesKilled = 0;
  shooting = false;
  shotTimer = 0;
  invulnTimer = 0;
  aimAngle = 0;
  private slowTimer = 0;
  private slowFactor = 1;

  constructor(private input: Input) {
    super();
    this.collisionRadius = PLAYER_COLLISION_RADIUS;
  }

  get isInvulnerable(): boolean {
    return this.invulnTimer > 0;
  }

  getWeaponStage(): typeof WEAPON_STAGES[number] {
    let stage = WEAPON_STAGES[0];
    for (const s of WEAPON_STAGES) {
      if (this.score >= s.score) stage = s;
    }
    return stage;
  }

  reset(): void {
    this.position.set(0, 0);
    this.velocity.set(0, 0);
    this.lives = PLAYER_STARTING_LIVES;
    this.score = 0;
    this.enemiesKilled = 0;
    this.shooting = false;
    this.shotTimer = 0;
    this.invulnTimer = PLAYER_INVULN_DURATION;
    this.active = true;
  }

  respawn(): void {
    this.position.set(0, 0);
    this.velocity.set(0, 0);
    this.invulnTimer = PLAYER_INVULN_DURATION;
    this.shooting = false;
    this.shotTimer = 0;
  }

  update(dt: number): void {
    if (!this.active) return;

    // Invulnerability countdown
    if (this.invulnTimer > 0) this.invulnTimer -= dt;

    // Slow timer countdown
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowFactor = 1;
    }

    // Movement
    const dir = this.input.getMovementDir();
    const speed = PLAYER_SPEED * gameSettings.playerSpeedMultiplier * this.slowFactor;
    this.velocity.set(dir.x * speed, dir.y * speed);
    this.move(dt);

    // Clamp to world bounds
    const hw = WORLD_WIDTH / 2;
    const hh = WORLD_HEIGHT / 2;
    if (this.position.x < -hw) this.position.x = -hw;
    if (this.position.x > hw) this.position.x = hw;
    if (this.position.y < -hh) this.position.y = -hh;
    if (this.position.y > hh) this.position.y = hh;

    // Aim angle from input (mouse deltas on desktop, right stick on touch)
    this.aimAngle = this.input.getAimAngle();

    // Shooting
    this.shooting = this.input.isMouseDown();
    if (this.shotTimer > 0) this.shotTimer -= dt;
  }

  /** Check if ready to fire, and reset shot timer. Returns aim angles to fire at. */
  tryShoot(): number[] | null {
    if (!this.shooting || this.shotTimer > 0) return null;
    const stage = this.getWeaponStage();
    this.shotTimer = stage.shotDelay / gameSettings.fireRateMultiplier;
    return stage.angleOffsets.map(offset => this.aimAngle + (offset * Math.PI) / 180);
  }

  applySlow(factor: number, duration: number): void {
    this.slowFactor = factor;
    this.slowTimer = duration * 1000; // convert seconds to ms
  }

  render(renderer: Renderer): void {
    if (!this.active) return;

    // Blink when invulnerable
    if (this.isInvulnerable && Math.floor(this.invulnTimer / 100) % 2 === 0) return;

    const s = PLAYER_SHIP_SCALE;
    const cos = Math.cos(this.aimAngle);
    const sin = Math.sin(this.aimAngle);
    const px = this.position.x;
    const py = this.position.y;

    // Ship shape: pointed arrow
    // Tip (forward)
    const tipX = px + cos * s * 1.5;
    const tipY = py + sin * s * 1.5;
    // Left wing
    const lwX = px + (-cos * s - sin * s);
    const lwY = py + (-sin * s + cos * s);
    // Right wing
    const rwX = px + (-cos * s + sin * s);
    const rwY = py + (-sin * s - cos * s);
    // Rear notch
    const rrX = px + (-cos * s * 0.5);
    const rrY = py + (-sin * s * 0.5);

    // Fill
    renderer.drawTriangle(tipX, tipY, lwX, lwY, rrX, rrY, 0.2, 0.9, 0.2, 0.8);
    renderer.drawTriangle(tipX, tipY, rrX, rrY, rwX, rwY, 0.2, 0.9, 0.2, 0.8);
    // Outline
    renderer.drawLine(tipX, tipY, lwX, lwY, 0.1, 1, 0.1);
    renderer.drawLine(lwX, lwY, rrX, rrY, 0.1, 1, 0.1);
    renderer.drawLine(rrX, rrY, rwX, rwY, 0.1, 1, 0.1);
    renderer.drawLine(rwX, rwY, tipX, tipY, 0.1, 1, 0.1);
  }
}
