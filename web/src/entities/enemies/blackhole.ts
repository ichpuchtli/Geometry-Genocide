import { Enemy, EnemyDeathResult } from './enemy';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import { COLORS, ENEMY_SPEED, ENEMY_SCORES, BLACKHOLE_HP, BLACKHOLE_ORANGE } from '../../config';
import { gameSettings } from '../../settings';

export type BlackHoleVisualMode = 'current' | 'violent_breather' | 'convulsive' | 'absorption_spike';

interface AccretionParticle {
  angle: number;
  radius: number;  // multiplier of baseR
  speed: number;   // radians per ms
  brightness: number;
}

/** Gravity/Black Hole enemy — bright electric blue-white plasma sphere */
export class BlackHole extends Enemy {
  /** How many enemies this black hole has absorbed */
  absorbedCount = 0;
  /** Set true when absorbedCount reaches MAX_ABSORB — game.ts checks for auto-explode */
  overloaded = false;

  override hp = BLACKHOLE_HP;
  override maxHp = BLACKHOLE_HP;

  /** Visual rendering mode — 'current' = original cyan, others = orange-white variants */
  visualMode: BlackHoleVisualMode = 'current';

  private wobbleTime = 0;
  private hitFlash = 0;

  // Per-diamond orbit data (current mode)
  private orbitAngles: number[] = [];
  private orbitRadii: number[] = [];
  private orbitSpeeds: number[] = [];

  // Accretion disc particles (orange-white variants)
  private accretionParticles: AccretionParticle[] = [];

  // Absorption spike timer (absorption_spike mode)
  absorptionSpikeTimer = 0;
  // Running base radius growth for absorption_spike (visual mass growth)
  private spikeBaseGrowth = 0;

  // Convulsive jolt state
  private convulsiveJoltX = 0;
  private convulsiveJoltY = 0;
  private convulsiveJoltDecay = 0;
  private convulsiveNextJolt = 200 + Math.random() * 300;
  private convulsiveJoltTimer = 0;

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

    // Start with 4 orbiting diamonds / accretion particles
    for (let i = 0; i < 4; i++) {
      this.pushOrbitShape();
      this.pushAccretionParticle();
    }
  }

  private pushOrbitShape(): void {
    this.orbitAngles.push(Math.random() * Math.PI * 2);
    this.orbitRadii.push(0.8 + Math.random() * 0.5);
    this.orbitSpeeds.push((0.002 + Math.random() * 0.003) * (Math.random() < 0.5 ? 1 : -1));
  }

  private pushAccretionParticle(): void {
    this.accretionParticles.push({
      angle: Math.random() * Math.PI * 2,
      radius: 0.7 + Math.random() * 0.8,
      speed: (0.001 + Math.random() * 0.004) * (Math.random() < 0.5 ? 1 : -1),
      brightness: 0.4 + Math.random() * 0.6,
    });
  }

  absorbEnemy(): void {
    this.absorbedCount++;
    this.collisionRadius = 30 + this.absorbedCount * 2.5;
    this.pushOrbitShape();
    // Add 2 accretion particles per absorption
    this.pushAccretionParticle();
    this.pushAccretionParticle();
    if (this.visualMode === 'absorption_spike') {
      this.absorptionSpikeTimer = 400;
      this.spikeBaseGrowth += 1.5;
    }
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
      if (this.accretionParticles.length > 4) {
        this.accretionParticles.pop();
        this.accretionParticles.pop();
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
    // Update accretion particle angles
    for (const p of this.accretionParticles) {
      p.angle += dt * p.speed;
    }
    // Absorption spike decay
    if (this.absorptionSpikeTimer > 0) {
      this.absorptionSpikeTimer = Math.max(0, this.absorptionSpikeTimer - dt);
    }
    // Convulsive jolt timer
    if (this.visualMode === 'convulsive') {
      this.convulsiveJoltTimer += dt;
      if (this.convulsiveJoltTimer >= this.convulsiveNextJolt) {
        this.convulsiveJoltTimer = 0;
        this.convulsiveNextJolt = 200 + Math.random() * 300;
        const angle = Math.random() * Math.PI * 2;
        const strength = 3 + Math.random() * 5;
        this.convulsiveJoltX = Math.cos(angle) * strength;
        this.convulsiveJoltY = Math.sin(angle) * strength;
        this.convulsiveJoltDecay = 1;
      }
      if (this.convulsiveJoltDecay > 0) {
        this.convulsiveJoltDecay = Math.max(0, this.convulsiveJoltDecay - dt * 0.01);
      }
    }
  }

  override renderSpawn(renderer: Renderer): void {
    this.renderSpawnGravity(renderer);
  }

  render(renderer: Renderer): void {
    if (!this.active) return;
    if (this.isSpawning) { this.renderSpawn(renderer); return; }

    switch (this.visualMode) {
      case 'current':
        this.renderCurrent(renderer);
        break;
      case 'violent_breather':
        this.renderViolentBreather(renderer);
        break;
      case 'convulsive':
        this.renderConvulsive(renderer);
        break;
      case 'absorption_spike':
        this.renderAbsorptionSpike(renderer);
        break;
    }
  }

  /** Whether this BH needs a grid impulse this frame (for design lab sync) */
  needsGridPulse = false;
  gridPulseStrength = 0;

  // ============================================================
  // Original cyan rendering
  // ============================================================
  private renderCurrent(renderer: Renderer): void {
    const instability = this.absorbedCount / BlackHole.MAX_ABSORB;
    const t = this.wobbleTime;
    const baseR = this.collisionRadius;
    const px = this.position.x;
    const py = this.position.y;

    // Layer 1: Outer glow rings
    for (let i = 0; i < 3; i++) {
      const glowR = (baseR + 20 + i * 15) * (1 + Math.sin(t * 0.002 + i) * 0.05);
      const glowAlpha = 0.08 - i * 0.02;
      renderer.drawCircle(px, py, glowR, [0.1, 0.5, 1.0], 28, glowAlpha);
    }

    // Layer 2: Wobbly filled sphere
    const segs = 32;
    const cr = 0.4 + instability * 0.3;
    const cg = 0.7 + instability * 0.15;
    const cb = 1.0;
    const wobbleScale = 1 + instability * 2;
    const verts: { x: number; y: number }[] = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const noise = (Math.sin(a * 3 + t * 0.004) * 4
                    + Math.sin(a * 5 - t * 0.006) * 2
                    + Math.sin(a * 7 + t * 0.009) * 1.5) * wobbleScale;
      const r = baseR + noise;
      verts.push({ x: px + Math.cos(a) * r, y: py + Math.sin(a) * r });
    }
    for (let i = 0; i < segs; i++) {
      const next = (i + 1) % segs;
      renderer.drawTriangle(px, py, verts[i].x, verts[i].y, verts[next].x, verts[next].y, cr, cg, cb, 0.85);
    }

    // Layer 3: White inner core
    const coreR = baseR * 0.4;
    const coreSegs = 20;
    const coreVerts: { x: number; y: number }[] = [];
    for (let i = 0; i < coreSegs; i++) {
      const a = (i / coreSegs) * Math.PI * 2;
      const noise = (Math.sin(a * 3 + t * 0.005) * 1.5 + Math.sin(a * 5 - t * 0.007) * 1) * wobbleScale;
      const r = coreR + noise;
      coreVerts.push({ x: px + Math.cos(a) * r, y: py + Math.sin(a) * r });
    }
    for (let i = 0; i < coreSegs; i++) {
      const next = (i + 1) % coreSegs;
      renderer.drawTriangle(px, py, coreVerts[i].x, coreVerts[i].y, coreVerts[next].x, coreVerts[next].y, 1.0, 1.0, 1.0, 0.9);
    }

    // Layer 4: Cyan edge outline
    for (let i = 0; i < segs; i++) {
      const next = (i + 1) % segs;
      renderer.drawLine(verts[i].x, verts[i].y, verts[next].x, verts[next].y, 0.1, 0.9, 1.0, 0.9);
    }

    // Layer 5: Orbiting diamonds
    const diamondSize = 3.5;
    for (let i = 0; i < this.orbitAngles.length; i++) {
      const oa = this.orbitAngles[i];
      const orbitR = (baseR + 8) * this.orbitRadii[i];
      const dx = px + Math.cos(oa) * orbitR;
      const dy = py + Math.sin(oa) * orbitR;
      const ds = diamondSize;
      renderer.drawTriangle(dx, dy - ds * 1.5, dx - ds, dy, dx + ds, dy, 0.1, 0.9, 1.0, 0.85);
      renderer.drawTriangle(dx, dy + ds * 1.5, dx - ds, dy, dx + ds, dy, 0.1, 0.9, 1.0, 0.85);
    }

    // Layer 6: Hit flash
    if (this.hitFlash > 0) {
      const flashAlpha = Math.min(this.hitFlash * 3, 1);
      renderer.drawFilledCircle(px, py, baseR * 1.2, [1, 1, 1], 24, flashAlpha * 0.6);
    }

    // Layer 7: Danger ring when instability > 0.6
    if (instability > 0.6) {
      const dangerAlpha = (instability - 0.6) * 2.5;
      const dangerPulse = 1 + Math.sin(t * 0.008) * 0.15;
      const dangerR = (baseR + 25) * dangerPulse;
      const flash = 0.5 + 0.5 * Math.sin(t * 0.012);
      renderer.drawCircle(px, py, dangerR, [0.2 + flash * 0.8, 0.7 + flash * 0.3, 1.0], 28, dangerAlpha * 0.5);
    }
  }

  // ============================================================
  // Shared orange-white rendering helpers
  // ============================================================

  /** Render dark void core (near-black filled circle) */
  private renderVoidCore(renderer: Renderer, px: number, py: number, radius: number, alpha: number): void {
    const [cr, cg, cb] = BLACKHOLE_ORANGE.core;
    renderer.drawFilledCircle(px, py, radius, [cr, cg, cb], 20, alpha);
  }

  /** Render bright corona ring around the core */
  private renderCorona(renderer: Renderer, px: number, py: number, radius: number, alpha: number, segs = 32): void {
    const [cr, cg, cb] = BLACKHOLE_ORANGE.corona;
    renderer.drawCircle(px, py, radius, [cr, cg, cb], segs, alpha);
    // Inner bright line
    renderer.drawCircle(px, py, radius * 0.95, [1, 0.9, 0.6], segs, alpha * 0.4);
  }

  /** Render radiating rays from center */
  private renderRays(renderer: Renderer, px: number, py: number, baseAngle: number, rayCount: number, rayLen: number, alpha: number): void {
    const [rr, rg, rb] = BLACKHOLE_ORANGE.ray;
    for (let i = 0; i < rayCount; i++) {
      const angle = baseAngle + (i / rayCount) * Math.PI * 2;
      const x1 = px + Math.cos(angle) * 6;
      const y1 = py + Math.sin(angle) * 6;
      const x2 = px + Math.cos(angle) * rayLen * 0.5;
      const y2 = py + Math.sin(angle) * rayLen * 0.5;
      const x3 = px + Math.cos(angle) * rayLen;
      const y3 = py + Math.sin(angle) * rayLen;
      // White at center, orange at tips
      renderer.drawLine(x1, y1, x2, y2, 1, 1, 0.9, alpha * 0.7);
      renderer.drawLine(x2, y2, x3, y3, rr, rg, rb, alpha * 0.4);
    }
  }

  /** Render accretion disc particles */
  private renderAccretionDisc(renderer: Renderer, px: number, py: number, baseR: number, brightnessScale: number): void {
    const [dr, dg, db] = BLACKHOLE_ORANGE.disc;
    for (const p of this.accretionParticles) {
      const orbitR = baseR * p.radius;
      const dx = px + Math.cos(p.angle) * orbitR;
      const dy = py + Math.sin(p.angle) * orbitR * 0.6; // elliptical for 3D tilt
      const alpha = p.brightness * brightnessScale;
      // Small filled diamond shape
      const s = 2.5;
      renderer.drawTriangle(dx, dy - s * 1.2, dx - s, dy, dx + s, dy, dr, dg, db, alpha);
      renderer.drawTriangle(dx, dy + s * 1.2, dx - s, dy, dx + s, dy, dr, dg, db, alpha);
    }
  }

  /** Render orange-white wobbly body */
  private renderOrangeBody(renderer: Renderer, px: number, py: number, baseR: number, wobbleScale: number, t: number): void {
    const segs = 32;
    const [br, bg, bb] = BLACKHOLE_ORANGE.body;
    const instability = this.absorbedCount / BlackHole.MAX_ABSORB;
    const verts: { x: number; y: number }[] = [];
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const noise = (Math.sin(a * 3 + t * 0.004) * 4
                    + Math.sin(a * 5 - t * 0.006) * 2
                    + Math.sin(a * 7 + t * 0.009) * 1.5) * wobbleScale;
      const r = baseR + noise;
      verts.push({ x: px + Math.cos(a) * r, y: py + Math.sin(a) * r });
    }

    // Filled body
    for (let i = 0; i < segs; i++) {
      const next = (i + 1) % segs;
      renderer.drawTriangle(px, py, verts[i].x, verts[i].y, verts[next].x, verts[next].y,
        br * 0.6, bg * 0.4, bb * 0.3, 0.85);
    }

    // Orange edge outline
    for (let i = 0; i < segs; i++) {
      const next = (i + 1) % segs;
      renderer.drawLine(verts[i].x, verts[i].y, verts[next].x, verts[next].y, br, bg, bb, 0.9);
    }

    // Orange-white outer glow rings
    const [gr, gg, gb] = BLACKHOLE_ORANGE.glow;
    for (let i = 0; i < 3; i++) {
      const glowR = (baseR + 15 + i * 12) * (1 + Math.sin(t * 0.002 + i) * 0.05);
      const glowAlpha = 0.1 - i * 0.025;
      renderer.drawCircle(px, py, glowR, [gr, gg, gb], 28, glowAlpha);
    }

    // Danger ring at high instability
    if (instability > 0.6) {
      const dangerAlpha = (instability - 0.6) * 2.5;
      const dangerPulse = 1 + Math.sin(t * 0.008) * 0.15;
      const dangerR = (baseR + 25) * dangerPulse;
      renderer.drawCircle(px, py, dangerR, [1, 0.4, 0.1], 28, dangerAlpha * 0.5);
    }
  }

  // ============================================================
  // Variant A — "Violent Breather"
  // ============================================================
  private renderViolentBreather(renderer: Renderer): void {
    const instability = this.absorbedCount / BlackHole.MAX_ABSORB;
    const t = this.wobbleTime;
    const baseR = this.collisionRadius;
    const px = this.position.x;
    const py = this.position.y;

    // Cardiac heartbeat pulse: sharp peaks with pow(abs(sin), 10)
    const pulseSpeed = 0.0015 + instability * 0.0035; // 2s cycle empty → 0.4s cycle full
    const rawPulse = Math.pow(Math.abs(Math.sin(t * pulseSpeed)), 10);
    const pulse = rawPulse;

    // Radius surges +30% on pulse peak, contracts to 85% between
    const radiusMult = 0.85 + pulse * 0.45;
    const effectiveR = baseR * radiusMult;
    const wobbleScale = 1 + instability * 1.5;

    // Outer glow + body
    this.renderOrangeBody(renderer, px, py, effectiveR, wobbleScale, t);

    // Dark void core
    this.renderVoidCore(renderer, px, py, effectiveR * 0.4, 0.95);

    // Corona rim
    this.renderCorona(renderer, px, py, effectiveR * 0.45, 0.6 + pulse * 0.3);

    // Rays: extend on pulse, retract between
    const rayLen = 20 + pulse * 60 + instability * 30;
    const rayAlpha = 0.2 + pulse * 0.6;
    this.renderRays(renderer, px, py, this.rotation, 8, rayLen, rayAlpha);

    // Accretion disc: brighten on pulse
    this.renderAccretionDisc(renderer, px, py, effectiveR + 8, 0.3 + pulse * 0.7);

    // Grid pulse on heartbeat peaks
    this.needsGridPulse = pulse > 0.7;
    this.gridPulseStrength = pulse * 80 * (1 + instability);

    // Hit flash
    if (this.hitFlash > 0) {
      const flashAlpha = Math.min(this.hitFlash * 3, 1);
      renderer.drawFilledCircle(px, py, effectiveR * 1.2, [1, 0.8, 0.3], 24, flashAlpha * 0.6);
    }
  }

  // ============================================================
  // Variant B — "Convulsive"
  // ============================================================
  private renderConvulsive(renderer: Renderer): void {
    const instability = this.absorbedCount / BlackHole.MAX_ABSORB;
    const t = this.wobbleTime;
    const baseR = this.collisionRadius;

    // Multi-frequency chaos: 3 irrational-ratio sines
    const wave1 = Math.sin(t * 0.0037) * 0.15;
    const wave2 = Math.sin(t * 0.0071) * 0.10;
    const wave3 = Math.sin(t * 0.0113) * 0.08;
    const radiusMult = 1 + (wave1 + wave2 + wave3) * (1 + instability);

    // Jolt offset (decaying random displacement)
    const joltX = this.convulsiveJoltX * this.convulsiveJoltDecay;
    const joltY = this.convulsiveJoltY * this.convulsiveJoltDecay;

    const effectiveR = baseR * radiusMult;
    const px = this.position.x + joltX;
    const py = this.position.y + joltY;
    const wobbleScale = 1.5 + instability * 2.5;

    // Body (extra wobbly)
    this.renderOrangeBody(renderer, px, py, effectiveR, wobbleScale, t);

    // Dark void core
    this.renderVoidCore(renderer, px, py, effectiveR * 0.38, 0.95);

    // Corona
    this.renderCorona(renderer, px, py, effectiveR * 0.43, 0.7);

    // Rays with per-ray angle jitter
    const [rr, rg, rb] = BLACKHOLE_ORANGE.ray;
    for (let i = 0; i < 8; i++) {
      const baseAngle = this.rotation + (i / 8) * Math.PI * 2;
      const jitter = Math.sin(t * 0.02 + i * 1.7) * 0.15;
      const angle = baseAngle + jitter;
      const rayLen = 30 + Math.abs(Math.sin(t * 0.005 + i * 2.3)) * 40 + instability * 20;
      const x1 = px + Math.cos(angle) * 6;
      const y1 = py + Math.sin(angle) * 6;
      const x2 = px + Math.cos(angle) * rayLen * 0.5;
      const y2 = py + Math.sin(angle) * rayLen * 0.5;
      const x3 = px + Math.cos(angle) * rayLen;
      const y3 = py + Math.sin(angle) * rayLen;
      renderer.drawLine(x1, y1, x2, y2, 1, 1, 0.9, 0.55);
      renderer.drawLine(x2, y2, x3, y3, rr, rg, rb, 0.3);
    }

    // Accretion disc
    this.renderAccretionDisc(renderer, px, py, effectiveR + 8, 0.5 + instability * 0.3);

    // Constant micro grid impulses
    this.needsGridPulse = true;
    this.gridPulseStrength = 15 + instability * 25 + Math.abs(wave1) * 40;

    // Hit flash
    if (this.hitFlash > 0) {
      const flashAlpha = Math.min(this.hitFlash * 3, 1);
      renderer.drawFilledCircle(px, py, effectiveR * 1.2, [1, 0.8, 0.3], 24, flashAlpha * 0.6);
    }
  }

  // ============================================================
  // Variant C — "Absorption Spike"
  // ============================================================
  private renderAbsorptionSpike(renderer: Renderer): void {
    const instability = this.absorbedCount / BlackHole.MAX_ABSORB;
    const t = this.wobbleTime;
    const baseR = this.collisionRadius + this.spikeBaseGrowth;
    const px = this.position.x;
    const py = this.position.y;

    // Spike state: 0 = idle, >0 = surging
    const spikeT = this.absorptionSpikeTimer / 400; // 1 at spike start, 0 when expired
    // Springy overshoot: spike up fast, overshoot, settle
    const springy = spikeT > 0
      ? spikeT * 1.5 * Math.exp(-spikeT * 2) * (1 + Math.sin(spikeT * 30) * 0.3 * spikeT)
      : 0;

    // Idle: gentle sine wobble
    const idleWobble = Math.sin(t * 0.002) * 0.03;
    const radiusMult = 1 + idleWobble + springy * 0.5;
    const effectiveR = baseR * radiusMult;
    const wobbleScale = 0.8 + instability + spikeT * 2;

    // Body
    this.renderOrangeBody(renderer, px, py, effectiveR, wobbleScale, t);

    // Dark void core
    this.renderVoidCore(renderer, px, py, effectiveR * 0.4, 0.95);

    // Corona (brighter during spike)
    this.renderCorona(renderer, px, py, effectiveR * 0.45, 0.5 + spikeT * 0.4);

    // Rays: faint idle, dramatic during spike
    const rayLen = 20 + spikeT * 120 + instability * 20;
    const rayAlpha = 0.15 + spikeT * 0.7;
    this.renderRays(renderer, px, py, this.rotation, 8, rayLen, rayAlpha);

    // Accretion disc: scatter outward during spike, then return
    const discRadiusMult = 1 + spikeT * 0.6;
    const discPx = px;
    const discPy = py;
    const [dr, dg, db] = BLACKHOLE_ORANGE.disc;
    for (const p of this.accretionParticles) {
      const orbitR = (effectiveR + 8) * p.radius * discRadiusMult;
      const dx = discPx + Math.cos(p.angle) * orbitR;
      const dy = discPy + Math.sin(p.angle) * orbitR * 0.6;
      const alpha = p.brightness * (0.4 + spikeT * 0.6);
      const s = 2.5;
      renderer.drawTriangle(dx, dy - s * 1.2, dx - s, dy, dx + s, dy, dr, dg, db, alpha);
      renderer.drawTriangle(dx, dy + s * 1.2, dx - s, dy, dx + s, dy, dr, dg, db, alpha);
    }

    // White flash overlay during spike
    if (spikeT > 0.5) {
      const flashAlpha = (spikeT - 0.5) * 2 * 0.3;
      renderer.drawFilledCircle(px, py, effectiveR * 1.3, [1, 0.9, 0.7], 24, flashAlpha);
    }

    // Grid impulse on spike
    this.needsGridPulse = spikeT > 0.3;
    this.gridPulseStrength = spikeT * 120 * (1 + instability);

    // Hit flash
    if (this.hitFlash > 0) {
      const flashAlpha = Math.min(this.hitFlash * 3, 1);
      renderer.drawFilledCircle(px, py, effectiveR * 1.2, [1, 0.8, 0.3], 24, flashAlpha * 0.6);
    }
  }

  renderGlow(renderer: Renderer, time: number): void {
    if (!this.active) return;
    this.render(renderer);
    // Pulsing gravity waves (color matches mode)
    const isOrange = this.visualMode !== 'current';
    for (let i = 0; i < 4; i++) {
      const phase = (time * 0.6 + i * 0.25) % 1.0;
      const ringR = this.collisionRadius + phase * 60;
      const alpha = (1 - phase) * 0.2;
      if (isOrange) {
        renderer.drawCircle(this.position.x, this.position.y, ringR, [alpha * 2, alpha * 0.7, alpha * 0.1], 28);
      } else {
        renderer.drawCircle(this.position.x, this.position.y, ringR, [alpha * 0.3, alpha * 0.7, alpha], 28);
      }
    }
  }

  onDeath(): EnemyDeathResult {
    // No circle spawns on bullet-kill (evaporation)
    // Circles only spawn on overload explosion (handled in game.ts)
    return {};
  }
}
