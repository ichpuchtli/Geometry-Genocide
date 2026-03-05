import { Renderer } from './sprite-batch';

export class Starfield {
  private stars: { x: number; y: number; brightness: number; size: number }[] = [];
  private parallax = 0.3;

  constructor(count: number, worldW: number, worldH: number) {
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * worldW * 1.5,
        y: (Math.random() - 0.5) * worldH * 1.5,
        brightness: 0.15 + Math.random() * 0.35,
        size: 2 + Math.random() * 4,
      });
    }
  }

  render(renderer: Renderer, cameraX: number, cameraY: number): void {
    for (const s of this.stars) {
      const sx = s.x - cameraX * this.parallax;
      const sy = s.y - cameraY * this.parallax;
      const b = s.brightness;
      const sz = s.size;
      // Draw as a small cross for visibility on all devices
      renderer.drawLine(sx - sz, sy, sx + sz, sy, b, b, b * 1.3, 0.8);
      renderer.drawLine(sx, sy - sz, sx, sy + sz, b, b, b * 1.3, 0.8);
    }
  }
}
