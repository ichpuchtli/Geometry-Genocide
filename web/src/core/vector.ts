export class Vec2 {
  constructor(public x: number = 0, public y: number = 0) {}

  static fromAngle(radians: number): Vec2 {
    return new Vec2(Math.cos(radians), Math.sin(radians));
  }

  static random(): Vec2 {
    const a = Math.random() * Math.PI * 2;
    return new Vec2(Math.cos(a), Math.sin(a));
  }

  static randomInRange(min: number, max: number): Vec2 {
    return new Vec2(
      min + Math.random() * (max - min),
      min + Math.random() * (max - min),
    );
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copyFrom(v: Vec2): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  add(v: Vec2): Vec2 {
    return new Vec2(this.x + v.x, this.y + v.y);
  }

  sub(v: Vec2): Vec2 {
    return new Vec2(this.x - v.x, this.y - v.y);
  }

  scale(s: number): Vec2 {
    return new Vec2(this.x * s, this.y * s);
  }

  addMut(v: Vec2): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  subMut(v: Vec2): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  scaleMut(s: number): this {
    this.x *= s;
    this.y *= s;
    return this;
  }

  addScaledMut(v: Vec2, s: number): this {
    this.x += v.x * s;
    this.y += v.y * s;
    return this;
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  magnitudeSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  normalize(): Vec2 {
    const m = this.magnitude();
    if (m === 0) return new Vec2(0, 0);
    return new Vec2(this.x / m, this.y / m);
  }

  normalizeMut(): this {
    const m = this.magnitude();
    if (m > 0) {
      this.x /= m;
      this.y /= m;
    }
    return this;
  }

  dot(v: Vec2): number {
    return this.x * v.x + this.y * v.y;
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  distanceTo(v: Vec2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  distanceToSq(v: Vec2): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  negate(): Vec2 {
    return new Vec2(-this.x, -this.y);
  }

  rotate(radians: number): Vec2 {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    return new Vec2(this.x * c - this.y * s, this.x * s + this.y * c);
  }
}
