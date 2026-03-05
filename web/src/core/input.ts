import { Vec2 } from './vector';
import { Camera } from './camera';
import { JOYSTICK_MAX_RADIUS, JOYSTICK_DEAD_ZONE } from '../config';

export type InputMode = 'keyboard' | 'touch';

interface TouchStick {
  active: boolean;
  touchId: number;
  origin: Vec2;   // where touch started
  current: Vec2;  // where finger is now
}

export class Input {
  private keys = new Map<string, boolean>();
  private mouseScreenPos = new Vec2(0, 0);
  private mouseDown = false;
  private camera: Camera | null = null;

  // Touch state
  mode: InputMode = 'keyboard';
  private leftStick: TouchStick = { active: false, touchId: -1, origin: new Vec2(), current: new Vec2() };
  private rightStick: TouchStick = { active: false, touchId: -1, origin: new Vec2(), current: new Vec2() };
  private canvasWidth = 0;

  // Expose stick positions for joystick rendering
  get leftStickState() { return this.leftStick; }
  get rightStickState() { return this.rightStick; }

  constructor(private canvas: HTMLCanvasElement) {
    this.canvasWidth = canvas.clientWidth;

    // Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys.set(e.code, true);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      this.mode = 'keyboard';
    });
    window.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false);
    });

    // Mouse
    canvas.addEventListener('mousemove', (e) => {
      this.mouseScreenPos.set(e.clientX, e.clientY);
      this.mode = 'keyboard';
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
      this.mode = 'keyboard';
    });
    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch
    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
    canvas.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    this.mode = 'touch';
    const half = this.canvasWidth / 2;

    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const stick = t.clientX < half ? this.leftStick : this.rightStick;
      if (!stick.active) {
        stick.active = true;
        stick.touchId = t.identifier;
        stick.origin.set(t.clientX, t.clientY);
        stick.current.set(t.clientX, t.clientY);
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (this.leftStick.active && this.leftStick.touchId === t.identifier) {
        this.leftStick.current.set(t.clientX, t.clientY);
      }
      if (this.rightStick.active && this.rightStick.touchId === t.identifier) {
        this.rightStick.current.set(t.clientX, t.clientY);
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (this.leftStick.active && this.leftStick.touchId === t.identifier) {
        this.leftStick.active = false;
        this.leftStick.touchId = -1;
      }
      if (this.rightStick.active && this.rightStick.touchId === t.identifier) {
        this.rightStick.active = false;
        this.rightStick.touchId = -1;
      }
    }
  }

  /** Get normalized joystick vector with dead zone applied */
  private getStickVector(stick: TouchStick): Vec2 {
    if (!stick.active) return new Vec2(0, 0);
    const dx = stick.current.x - stick.origin.x;
    const dy = stick.current.y - stick.origin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxR = JOYSTICK_MAX_RADIUS;
    if (dist < maxR * JOYSTICK_DEAD_ZONE) return new Vec2(0, 0);
    const clamped = Math.min(dist, maxR);
    const mag = (clamped - maxR * JOYSTICK_DEAD_ZONE) / (maxR * (1 - JOYSTICK_DEAD_ZONE));
    return new Vec2(dx / dist * mag, dy / dist * mag);
  }

  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  updateCanvasSize(w: number): void {
    this.canvasWidth = w;
  }

  isKeyDown(code: string): boolean {
    return this.keys.get(code) === true;
  }

  isMouseDown(): boolean {
    if (this.mode === 'touch') {
      const rv = this.getStickVector(this.rightStick);
      return rv.magnitudeSq() > 0;
    }
    return this.mouseDown;
  }

  isTouchActive(): boolean {
    return this.mode === 'touch';
  }

  getMouseScreenPos(): Vec2 {
    return this.mouseScreenPos;
  }

  getMouseWorldPos(): Vec2 {
    if (this.mode === 'touch') {
      // Right stick direction determines aim
      return this.getRightStickAimWorld();
    }
    if (!this.camera) return this.mouseScreenPos.clone();
    return this.camera.screenToWorld(this.mouseScreenPos.x, this.mouseScreenPos.y);
  }

  private getRightStickAimWorld(): Vec2 {
    // If right stick is deflected, aim in that direction from player
    // We return a world position far in the stick direction
    const rv = this.getStickVector(this.rightStick);
    if (rv.magnitudeSq() === 0 || !this.camera) {
      // Default: aim straight ahead (right)
      return this.camera ? this.camera.screenToWorld(this.canvasWidth, this.canvas.clientHeight / 2) : new Vec2(1000, 0);
    }
    // Return a point far in the direction of the stick relative to camera center
    const camPos = this.camera.position;
    // Note: screen Y is inverted (down=positive) but our world Y is up=positive
    return new Vec2(camPos.x + rv.x * 1000, camPos.y - rv.y * 1000);
  }

  /** Get movement direction from WASD / arrow keys / left joystick */
  getMovementDir(): Vec2 {
    if (this.mode === 'touch') {
      const v = this.getStickVector(this.leftStick);
      // Invert Y because screen Y is down but world Y is up
      return new Vec2(v.x, -v.y);
    }
    const dir = new Vec2(0, 0);
    if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')) dir.y = 1;
    if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')) dir.y = -1;
    if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')) dir.x = -1;
    if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) dir.x = 1;
    if (dir.x !== 0 && dir.y !== 0) dir.normalizeMut();
    return dir;
  }

  /** Check if any touch is active (for starting game on mobile) */
  hasTouchTap(): boolean {
    return this.leftStick.active || this.rightStick.active;
  }
}
