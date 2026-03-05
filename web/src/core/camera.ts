import { Vec2 } from './vector';
import { CAMERA_LERP_SPEED, WORLD_WIDTH, WORLD_HEIGHT } from '../config';

export class Camera {
  position = new Vec2(0, 0);

  constructor(public viewportWidth: number, public viewportHeight: number) {}

  follow(target: Vec2, lerpFactor: number = CAMERA_LERP_SPEED): void {
    this.position.x += (target.x - this.position.x) * lerpFactor;
    this.position.y += (target.y - this.position.y) * lerpFactor;
    this.clamp();
  }

  snapTo(target: Vec2): void {
    this.position.copyFrom(target);
    this.clamp();
  }

  private clamp(): void {
    const halfW = this.viewportWidth / 2;
    const halfH = this.viewportHeight / 2;
    const hw = WORLD_WIDTH / 2;
    const hh = WORLD_HEIGHT / 2;

    if (this.position.x - halfW < -hw) this.position.x = -hw + halfW;
    if (this.position.x + halfW > hw) this.position.x = hw - halfW;
    if (this.position.y - halfH < -hh) this.position.y = -hh + halfH;
    if (this.position.y + halfH > hh) this.position.y = hh - halfH;
  }

  resize(w: number, h: number): void {
    this.viewportWidth = w;
    this.viewportHeight = h;
  }

  /** Convert screen pixel coordinates to world coordinates */
  screenToWorld(sx: number, sy: number): Vec2 {
    return new Vec2(
      sx - this.viewportWidth / 2 + this.position.x,
      -(sy - this.viewportHeight / 2) + this.position.y,
    );
  }

  /** Check if a world position is visible on screen (with padding) */
  isVisible(wx: number, wy: number, padding: number = 100): boolean {
    const halfW = this.viewportWidth / 2 + padding;
    const halfH = this.viewportHeight / 2 + padding;
    return (
      Math.abs(wx - this.position.x) < halfW &&
      Math.abs(wy - this.position.y) < halfH
    );
  }
}
