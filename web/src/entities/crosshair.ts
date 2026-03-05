import { Renderer } from '../renderer/sprite-batch';
import { Vec2 } from '../core/vector';

const CROSSHAIR_SIZE = 12;
const GAP = 4;

export class Crosshair {
  position = new Vec2(0, 0);

  render(renderer: Renderer): void {
    const x = this.position.x;
    const y = this.position.y;
    const s = CROSSHAIR_SIZE;
    const g = GAP;

    // Four lines with a gap in the center
    renderer.drawLine(x - s, y, x - g, y, 0.1, 1.0, 0.1, 0.8);
    renderer.drawLine(x + g, y, x + s, y, 0.1, 1.0, 0.1, 0.8);
    renderer.drawLine(x, y - s, x, y - g, 0.1, 1.0, 0.1, 0.8);
    renderer.drawLine(x, y + g, x, y + s, 0.1, 1.0, 0.1, 0.8);

    // Small center dot
    renderer.drawCircle(x, y, 2, [0.1, 1.0, 0.1], 8, 0.5);
  }
}
