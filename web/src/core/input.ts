import { Vec2 } from './vector';
import { Camera } from './camera';

export class Input {
  private keys = new Map<string, boolean>();
  private mouseScreenPos = new Vec2(0, 0);
  private mouseDown = false;
  private camera: Camera | null = null;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      this.keys.set(e.code, true);
      // Prevent arrow keys and space from scrolling
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false);
    });
    canvas.addEventListener('mousemove', (e) => {
      this.mouseScreenPos.set(e.clientX, e.clientY);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
    });
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  isKeyDown(code: string): boolean {
    return this.keys.get(code) === true;
  }

  isMouseDown(): boolean {
    return this.mouseDown;
  }

  getMouseScreenPos(): Vec2 {
    return this.mouseScreenPos;
  }

  getMouseWorldPos(): Vec2 {
    if (!this.camera) return this.mouseScreenPos.clone();
    return this.camera.screenToWorld(this.mouseScreenPos.x, this.mouseScreenPos.y);
  }

  /** Get movement direction from WASD / arrow keys */
  getMovementDir(): Vec2 {
    const dir = new Vec2(0, 0);
    if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')) dir.y = 1;
    if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')) dir.y = -1;
    if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')) dir.x = -1;
    if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) dir.x = 1;
    // Normalize diagonal movement
    if (dir.x !== 0 && dir.y !== 0) dir.normalizeMut();
    return dir;
  }
}
