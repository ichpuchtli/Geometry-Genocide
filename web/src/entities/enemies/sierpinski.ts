import { Enemy, EnemyDeathResult } from './enemy';
import { Vec2 } from '../../core/vector';
import { Renderer } from '../../renderer/sprite-batch';
import { COLORS, ENEMY_SPEED, ENEMY_SCORES, SIERPINSKI_HP } from '../../config';

/** Sierpinski fractal triangle — each hit strips a recursion depth, spawns Shards on death */
export class Sierpinski extends Enemy {
  private depth = 3;
  private hitFlash = 0;
  private depthShapes: number[][][] = []; // precomputed vertices per depth

  static readonly COLLISION_RADII = [25, 30, 38, 45]; // depth 0,1,2,3

  constructor() {
    super();
    this.color = COLORS.sierpinski.color;
    this.color2 = COLORS.sierpinski.color2;
    this.speed = ENEMY_SPEED.sierpinski;
    this.scoreValue = ENEMY_SCORES.sierpinski;
    this.hp = SIERPINSKI_HP;
    this.maxHp = SIERPINSKI_HP;
    this.collisionRadius = Sierpinski.COLLISION_RADII[3];

    // Precompute shape for each depth
    for (let d = 0; d <= 3; d++) {
      this.depthShapes[d] = generateSierpinskiOutline(d, Sierpinski.COLLISION_RADII[d]);
    }
    this.shapePoints = this.depthShapes[3];
  }

  hit(): boolean {
    this.hitFlash = 0.15;
    this.depth--;
    if (this.depth >= 0) {
      this.shapePoints = this.depthShapes[this.depth];
      this.collisionRadius = Sierpinski.COLLISION_RADII[this.depth];
    }
    return super.hit();
  }

  update(dt: number, playerPos?: Vec2): void {
    if (!this.active || !playerPos) return;
    if (this.hitFlash > 0) this.hitFlash -= dt / 1000;
    this.follow(playerPos);
    this.rotation += dt * 0.001;
    this.move(dt);
    this.bounce();
  }

  render(renderer: Renderer): void {
    if (!this.active) return;
    if (this.isSpawning) { this.renderSpawn(renderer); return; }

    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const px = this.position.x;
    const py = this.position.y;
    const drawColor: [number, number, number] = this.hitFlash > 0 ? [1, 1, 1] : this.color;

    // Draw all triangles of the Sierpinski at current depth
    const triangles = generateSierpinskiTriangles(this.depth, this.collisionRadius);
    const time = Date.now() * 0.001;

    for (let t = 0; t < triangles.length; t++) {
      const tri = triangles[t];
      // Bioluminescence pulse: ripple outward from center
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
      const cy = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      const dist = Math.sqrt(cx * cx + cy * cy);
      const pulse = 0.7 + Math.sin(time * 3 - dist * 0.1) * 0.3;

      const points: number[][] = [];
      for (const [x, y] of tri) {
        points.push([
          px + x * cos - y * sin,
          py + x * sin + y * cos,
        ]);
      }

      const col: [number, number, number] = [
        drawColor[0] * pulse,
        drawColor[1] * pulse,
        drawColor[2] * pulse,
      ];
      renderer.drawLineLoop(points, col);
    }
  }

  renderGlow(renderer: Renderer, time: number): void {
    if (!this.active) return;
    this.render(renderer);
    const pulse = 0.3 + Math.sin(time * 2) * 0.15;
    renderer.drawCircle(this.position.x, this.position.y, this.collisionRadius + 8,
      [this.color[0] * pulse, this.color[1] * pulse, this.color[2] * pulse], 20);
  }

  onDeath(): EnemyDeathResult {
    // Spawn 4 Shards scattered from position
    const spawns: { type: string; position: Vec2 }[] = [];
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 20 + Math.random() * 20;
      spawns.push({
        type: 'shard',
        position: new Vec2(
          this.position.x + Math.cos(angle) * dist,
          this.position.y + Math.sin(angle) * dist,
        ),
      });
    }
    return { spawnEnemies: spawns };
  }
}

/** Generate filled triangles for rendering at given depth */
function generateSierpinskiTriangles(depth: number, size: number): [number, number][][] {
  const h = size * Math.sqrt(3) / 2;
  const top: [number, number] = [0, h * 0.67];
  const bl: [number, number] = [-size / 2, -h * 0.33];
  const br: [number, number] = [size / 2, -h * 0.33];

  if (depth <= 0) return [[top, bl, br]];

  return subdivide(top, bl, br, depth);
}

function subdivide(
  a: [number, number], b: [number, number], c: [number, number], depth: number,
): [number, number][][] {
  if (depth <= 0) return [[a, b, c]];

  const ab: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const bc: [number, number] = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
  const ca: [number, number] = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];

  // 3 sub-triangles (center removed)
  return [
    ...subdivide(a, ab, ca, depth - 1),
    ...subdivide(ab, b, bc, depth - 1),
    ...subdivide(ca, bc, c, depth - 1),
  ];
}

/** Generate outline points for the Sierpinski at given depth */
function generateSierpinskiOutline(depth: number, size: number): number[][] {
  const triangles = generateSierpinskiTriangles(depth, size);
  // Use outer triangle vertices as shape outline
  const h = size * Math.sqrt(3) / 2;
  return [[0, h * 0.67], [-size / 2, -h * 0.33], [size / 2, -h * 0.33]];
}
