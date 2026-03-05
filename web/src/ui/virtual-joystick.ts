import { Input } from '../core/input';
import {
  JOYSTICK_BASE_RADIUS,
  JOYSTICK_KNOB_RADIUS,
  JOYSTICK_MAX_RADIUS,
  JOYSTICK_OPACITY,
  JOYSTICK_ACTIVE_OPACITY,
} from '../config';

export class VirtualJoystickRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context for joystick');
    this.ctx = ctx;
  }

  render(input: Input): void {
    if (input.mode !== 'touch') return;

    const left = input.leftStickState;
    const right = input.rightStickState;

    if (left.active) {
      this.drawStick(left.origin.x, left.origin.y, left.current.x, left.current.y, '#20ff20');
    }
    if (right.active) {
      this.drawStick(right.origin.x, right.origin.y, right.current.x, right.current.y, '#ff3030');
    }
  }

  private drawStick(ox: number, oy: number, cx: number, cy: number, color: string): void {
    const ctx = this.ctx;
    const maxR = JOYSTICK_MAX_RADIUS;

    // Clamp knob position
    let dx = cx - ox;
    let dy = cy - oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    const active = dist > 5;
    const alpha = active ? JOYSTICK_ACTIVE_OPACITY : JOYSTICK_OPACITY;

    // Outer ring
    ctx.beginPath();
    ctx.arc(ox, oy, JOYSTICK_BASE_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = alpha * 0.6;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Knob
    ctx.beginPath();
    ctx.arc(ox + dx, oy + dy, JOYSTICK_KNOB_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 1;
  }
}
