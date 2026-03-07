import { Enemy, EnemyDeathResult } from './enemy';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import { COLORS, ENEMY_SPEED, ENEMY_SCORES, BLACKHOLE_HP } from '../../config';
import { gameSettings } from '../../settings';

/** Gravity/Black Hole enemy — bright electric blue-white plasma sphere */
export class BlackHole extends Enemy {
  /** How many enemies this black hole has absorbed */
  absorbedCount = 0;
  /** Set true when absorbedCount reaches MAX_ABSORB — game.ts checks for auto-explode */
  overloaded = false;

  override hp = BLACKHOLE_HP;
  override maxHp = BLACKHOLE_HP;

  private wobbleTime = 0;
  private hitFlash = 0;

  // Per-diamond orbit data
  private orbitAngles: number[] = [];
  private orbitRadii: number[] = [];
  private orbitSpeeds: number[] = [];

  /** Max enemies before it becomes unstable and auto-explodes */
  static readonly MAX_ABSORB = 12;
  static get ATTRACT_RADIUS(): number { return gameSettings.bhAttractRadius; }
  static get GRAVITY_STRENGTH(): number { return gameSettings.bhEnemyPull; }

  constructor() {
    super();
    this.color = COLORS.blackhole.color;
    this.color2 = COLORS.blackhole.color2;
    this.speed = ENEMY_SPEED.blackhole;
    this.scoreValue = ENEMY_SCORES.blackhole;
    this.collisionRadius = 30;

    // No geometric shape — rendered procedurally
    this.shapePoints = [];

    // Start with 4 orbiting diamonds
    for (let i = 0; i < 4; i++) {
      this.pushOrbitShape();
    }
  }

  private pushOrbitShape(): void {
    this.orbitAngles.push(Math.random() * Math.PI * 2);
    this.orbitRadii.push(0.8 + Math.random() * 0.5);
    this.orbitSpeeds.push((0.002 + Math.random() * 0.003) * (Math.random() < 0.5 ? 1 : -1));
  }

  absorbEnemy(): void {
    this.absorbedCount++;
    this.collisionRadius = 30 + this.absorbedCount * 2.5;
    this.pushOrbitShape();
    if (this.absorbedCount >= BlackHole.MAX_ABSORB) {
      this.overloaded = true;
    }
  }

  override onBulletHit(_bulletAngle: number): 'damage' | 'absorb' | 'reflect' {
    this.hitFlash = 1;
    if (this.absorbedCount > 0) {
      // Shrink: remove one absorbed unit, no HP damage
      this.absorbedCount--;
      this.collisionRadius = 30 + this.absorbedCount * 2.5;
      // Pop one orbit shape (keep minimum 4)
      if (this.orbitAngles.length > 4) {
        this.orbitAngles.pop();
        this.orbitRadii.pop();
        this.orbitSpeeds.pop();
      }
      return 'absorb';
    }
    // Empty of absorbed enemies — take HP damage
    return 'damage';
  }

  update(dt: number, _playerPos?: Vec2): void {
    if (!this.active) return;
    // No movement — stationary gravity well
    this.rotation += dt * (0.004 + this.absorbedCount * 0.001);
    this.wobbleTime += dt;
    // Decay hit flash
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt * 0.004);
    }
    // Update orbit angles
    for (let i = 0; i < this.orbitAngles.length; i++) {
      this.orbitAngles[i] += dt * this.orbitSpeeds[i];
    }
  }

  override renderSpawn(renderer: Renderer): void {
    this.renderSpawnGravity(renderer);
  }

  render(renderer: Renderer): void {
    if (!this.active) return;
    if (this.isSpawning) { this.renderSpawn(renderer); return; }

    const instability = this.absorbedCount / BlackHole.MAX_ABSORB; // 0 to 1
    const t = this.wobbleTime;
    const baseR = this.collisionRadius;
    const px = this.position.x;
    const py = this.position.y;

    // --- Layer 1: Outer glow rings ---
    for (let i = 0; i < 3; i++) {
      const glowR = (baseR + 20 + i * 15) * (1 + Math.sin(t * 0.002 + i) * 0.05);
      const glowAlpha = 0.08 - i * 0.02;
      renderer.drawCircle(px, py, glowR, [0.1, 0.5, 1.0], 28, glowAlpha);
    }

    // --- Layer 2: Wobbly filled sphere (main visual) ---
    const segs = 32;
    const cr = 0.4 + instability * 0.3;
    const cg = 0.7 + instability * 0.15;
    const cb = 1.0;
    const wobbleScale = 1 + instability * 2;
    // Build wobbly vertices
    const verts: { x: number; y: number }[] = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const noise = (Math.sin(a * 3 + t * 0.004) * 4
                    + Math.sin(a * 5 - t * 0.006) * 2
                    + Math.sin(a * 7 + t * 0.009) * 1.5) * wobbleScale;
      const r = baseR + noise;
      verts.push({ x: px + Math.cos(a) * r, y: py + Math.sin(a) * r });
    }

    // Draw filled sphere as triangle fan
    for (let i = 0; i < segs; i++) {
      const next = (i + 1) % segs;
      renderer.drawTriangle(
        px, py,
        verts[i].x, verts[i].y,
        verts[next].x, verts[next].y,
        cr, cg, cb, 0.85,
      );
    }

    // --- Layer 3: White inner core ---
    const coreR = baseR * 0.4;
    const coreSegs = 20;
    const coreVerts: { x: number; y: number }[] = [];
    for (let i = 0; i < coreSegs; i++) {
      const a = (i / coreSegs) * Math.PI * 2;
      const noise = (Math.sin(a * 3 + t * 0.005) * 1.5
                    + Math.sin(a * 5 - t * 0.007) * 1) * wobbleScale;
      const r = coreR + noise;
      coreVerts.push({ x: px + Math.cos(a) * r, y: py + Math.sin(a) * r });
    }
    for (let i = 0; i < coreSegs; i++) {
      const next = (i + 1) % coreSegs;
      renderer.drawTriangle(
        px, py,
        coreVerts[i].x, coreVerts[i].y,
        coreVerts[next].x, coreVerts[next].y,
        1.0, 1.0, 1.0, 0.9,
      );
    }

    // --- Layer 4: Cyan edge outline ---
    for (let i = 0; i < segs; i++) {
      const next = (i + 1) % segs;
      renderer.drawLine(
        verts[i].x, verts[i].y,
        verts[next].x, verts[next].y,
        0.1, 0.9, 1.0, 0.9,
      );
    }

    // --- Layer 5: Orbiting diamonds ---
    const diamondSize = 3.5;
    for (let i = 0; i < this.orbitAngles.length; i++) {
      const oa = this.orbitAngles[i];
      const orbitR = (baseR + 8) * this.orbitRadii[i];
      const dx = px + Math.cos(oa) * orbitR;
      const dy = py + Math.sin(oa) * orbitR;
      // Diamond = 2 triangles
      const ds = diamondSize;
      renderer.drawTriangle(
        dx, dy - ds * 1.5,
        dx - ds, dy,
        dx + ds, dy,
        0.1, 0.9, 1.0, 0.85,
      );
      renderer.drawTriangle(
        dx, dy + ds * 1.5,
        dx - ds, dy,
        dx + ds, dy,
        0.1, 0.9, 1.0, 0.85,
      );
    }

    // --- Layer 6: Hit flash ---
    if (this.hitFlash > 0) {
      const flashAlpha = Math.min(this.hitFlash * 3, 1);
      renderer.drawFilledCircle(px, py, baseR * 1.2, [1, 1, 1], 24, flashAlpha * 0.6);
    }

    // --- Layer 7: Danger ring when instability > 0.6 ---
    if (instability > 0.6) {
      const dangerAlpha = (instability - 0.6) * 2.5; // 0-1 over the last 0.4
      const dangerPulse = 1 + Math.sin(t * 0.008) * 0.15;
      const dangerR = (baseR + 25) * dangerPulse;
      const flash = 0.5 + 0.5 * Math.sin(t * 0.012);
      renderer.drawCircle(px, py, dangerR,
        [0.2 + flash * 0.8, 0.7 + flash * 0.3, 1.0], 28, dangerAlpha * 0.5);
    }
  }

  renderGlow(renderer: Renderer, time: number): void {
    if (!this.active) return;
    this.render(renderer);
    // Pulsing gravity waves (blue-white)
    for (let i = 0; i < 4; i++) {
      const phase = (time * 0.6 + i * 0.25) % 1.0;
      const ringR = this.collisionRadius + phase * 60;
      const alpha = (1 - phase) * 0.2;
      renderer.drawCircle(this.position.x, this.position.y, ringR,
        [alpha * 0.3, alpha * 0.7, alpha], 28);
    }
  }

  onDeath(): EnemyDeathResult {
    // No circle spawns on bullet-kill (evaporation)
    // Circles only spawn on overload explosion (handled in game.ts)
    return {};
  }
}
