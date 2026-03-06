import { Renderer } from '../renderer/sprite-batch';
import {
  AIM_CHEVRON_RADIUS,
  AIM_CHEVRON_SIZE,
  AIM_CHEVRON_COLOR,
  AIM_CHEVRON_ALPHA,
} from '../config';

// Chevron local vertices (unit scale, facing right)
const CHEV_VERTS: [number, number][] = [
  [-0.5,  0.5],  // back-top
  [ 0.5,  0.0],  // tip
  [-0.5, -0.5],  // back-bottom
];

export class AimIndicator {
  render(renderer: Renderer, playerX: number, playerY: number, aimAngle: number): void {
    const cx = playerX + Math.cos(aimAngle) * AIM_CHEVRON_RADIUS;
    const cy = playerY + Math.sin(aimAngle) * AIM_CHEVRON_RADIUS;
    const s = AIM_CHEVRON_SIZE;
    const cos = Math.cos(aimAngle);
    const sin = Math.sin(aimAngle);

    // Transform chevron vertices
    const wx: number[] = [];
    const wy: number[] = [];
    for (const [lx, ly] of CHEV_VERTS) {
      wx.push(cx + (lx * cos - ly * sin) * s);
      wy.push(cy + (lx * sin + ly * cos) * s);
    }

    // Two line segments: back-top → tip, tip → back-bottom
    const [r, g, b] = AIM_CHEVRON_COLOR;
    renderer.drawLine(wx[0], wy[0], wx[1], wy[1], r, g, b, AIM_CHEVRON_ALPHA);
    renderer.drawLine(wx[1], wy[1], wx[2], wy[2], r, g, b, AIM_CHEVRON_ALPHA);
  }
}
