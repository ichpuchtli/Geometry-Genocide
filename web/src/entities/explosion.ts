import { Vec2 } from '../core/vector';
import { Renderer } from '../renderer/sprite-batch';
import { EXPLOSION_POOL_SIZE } from '../config';

interface Particle {
  dir: Vec2;
}

export class Explosion {
  active = false;
  position = new Vec2(0, 0);
  color: [number, number, number] = [1, 1, 1];
  particles: Particle[] = [];
  elapsed = 0;
  duration = 1; // seconds
  speed = 1;

  init(x: number, y: number, color: [number, number, number], count: number, duration: number, speed: number = 1): void {
    this.position.set(x, y);
    this.color = color;
    this.duration = duration;
    this.speed = speed;
    this.elapsed = 0;
    this.active = true;

    // Reuse or create particles
    while (this.particles.length < count) {
      this.particles.push({ dir: Vec2.random() });
    }
    // Reinitialize directions
    for (let i = 0; i < count; i++) {
      const r = Vec2.random();
      // Add some variance
      this.particles[i].dir.set(
        (r.x + (Math.random() - 0.5)) * (0.5 + Math.random()),
        (r.y + (Math.random() - 0.5)) * (0.5 + Math.random()),
      );
    }
    this.particles.length = count;
  }

  update(dt: number): void {
    if (!this.active) return;
    this.elapsed += dt / 1000;
    if (this.elapsed >= this.duration) {
      this.active = false;
    }
  }

  render(renderer: Renderer): void {
    if (!this.active) return;
    const t = this.elapsed * this.speed * 100;
    const alpha = Math.max(0, 1 - this.elapsed / this.duration);
    const [r, g, b] = this.color;

    for (const p of this.particles) {
      const x1 = this.position.x + p.dir.x * t;
      const y1 = this.position.y + p.dir.y * t;
      // Motion stretching: longer streak based on distance from center
      const stretch = 1.15 + t * 0.001;
      const x2 = this.position.x + p.dir.x * t * stretch;
      const y2 = this.position.y + p.dir.y * t * stretch;
      // White-hot center: particles with small direction magnitude are inner (whiter)
      const dist = Math.sqrt(p.dir.x * p.dir.x + p.dir.y * p.dir.y);
      const whiteness = Math.max(0, 1 - dist * 2.5);
      const pr = r + (1 - r) * whiteness;
      const pg = g + (1 - g) * whiteness;
      const pb = b + (1 - b) * whiteness;
      renderer.drawLine(x1, y1, x2, y2, pr, pg, pb, alpha);
    }
  }
}

export class ExplosionPool {
  explosions: Explosion[] = [];

  constructor() {
    for (let i = 0; i < EXPLOSION_POOL_SIZE; i++) {
      this.explosions.push(new Explosion());
    }
  }

  spawn(x: number, y: number, color: [number, number, number], count: number, duration: number, speed: number = 1): void {
    for (const e of this.explosions) {
      if (!e.active) {
        e.init(x, y, color, count, duration, speed);
        return;
      }
    }
  }

  update(dt: number): void {
    for (const e of this.explosions) {
      if (e.active) e.update(dt);
    }
  }

  render(renderer: Renderer): void {
    for (const e of this.explosions) {
      if (e.active) e.render(renderer);
    }
  }

  clear(): void {
    for (const e of this.explosions) e.active = false;
  }
}
