import { createProgram } from './webgl-context';
import gridVert from './shaders/grid.vert';
import gridFrag from './shaders/grid.frag';
import {
  WORLD_WIDTH, WORLD_HEIGHT,
  GRID_SPACING, GRID_SPRING_STIFFNESS, GRID_SPRING_DAMPING,
  GRID_ANCHOR_STIFFNESS, GRID_MAX_DISPLACEMENT, GRID_SUBSTEPS,
  GRID_MOBILE_SUBSTEPS, GRID_COLOR_BASE, GRID_COLOR_STRETCH, GRID_COLOR_COMPRESS,
} from '../config';

const cols = Math.floor(WORLD_WIDTH / GRID_SPACING) + 1;
const rows = Math.floor(WORLD_HEIGHT / GRID_SPACING) + 1;
const totalPoints = cols * rows;

export class SpringMassGrid {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;

  // SoA physics data
  private restX: Float32Array;
  private restY: Float32Array;
  private posX: Float32Array;
  private posY: Float32Array;
  private velX: Float32Array;
  private velY: Float32Array;
  private accX: Float32Array;
  private accY: Float32Array;
  private anchored: Uint8Array;

  // Rendering
  private vertexData: Float32Array;
  private vertexBuffer: WebGLBuffer;
  private indexBuffer: WebGLBuffer;
  private indexCount: number;

  private substeps: number;

  // Gravity wells accumulated per frame
  private wellX: number[] = [];
  private wellY: number[] = [];
  private wellStr: number[] = [];
  private wellRad: number[] = [];

  // Uniform locations
  private uResolution: WebGLUniformLocation;
  private uCamera: WebGLUniformLocation;
  private uColorBase: WebGLUniformLocation;
  private uColorStretch: WebGLUniformLocation;
  private uColorCompress: WebGLUniformLocation;

  constructor(gl: WebGLRenderingContext, mobile: boolean) {
    this.gl = gl;
    this.substeps = mobile ? GRID_MOBILE_SUBSTEPS : GRID_SUBSTEPS;
    this.program = createProgram(gl, gridVert, gridFrag);

    this.uResolution = gl.getUniformLocation(this.program, 'u_resolution')!;
    this.uCamera = gl.getUniformLocation(this.program, 'u_camera')!;
    this.uColorBase = gl.getUniformLocation(this.program, 'u_colorBase')!;
    this.uColorStretch = gl.getUniformLocation(this.program, 'u_colorStretch')!;
    this.uColorCompress = gl.getUniformLocation(this.program, 'u_colorCompress')!;

    // Allocate SoA arrays
    this.restX = new Float32Array(totalPoints);
    this.restY = new Float32Array(totalPoints);
    this.posX = new Float32Array(totalPoints);
    this.posY = new Float32Array(totalPoints);
    this.velX = new Float32Array(totalPoints);
    this.velY = new Float32Array(totalPoints);
    this.accX = new Float32Array(totalPoints);
    this.accY = new Float32Array(totalPoints);
    this.anchored = new Uint8Array(totalPoints);

    // Compute rest positions centered at origin
    const hw = WORLD_WIDTH / 2;
    const hh = WORLD_HEIGHT / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const x = -hw + c * GRID_SPACING;
        const y = -hh + r * GRID_SPACING;
        this.restX[idx] = x;
        this.restY[idx] = y;
        this.posX[idx] = x;
        this.posY[idx] = y;
        // Border points are anchored
        if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
          this.anchored[idx] = 1;
        }
      }
    }

    // Build static index buffer for GL_LINES
    const indices: number[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        // Right neighbor
        if (c < cols - 1) {
          indices.push(idx, idx + 1);
        }
        // Up neighbor
        if (r < rows - 1) {
          indices.push(idx, idx + cols);
        }
      }
    }
    this.indexCount = indices.length;

    this.indexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // Vertex data: [posX, posY, displacement, velocityMag] per point
    this.vertexData = new Float32Array(totalPoints * 4);
    this.vertexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertexData.byteLength, gl.DYNAMIC_DRAW);
  }

  /** One-shot radial impulse — directly modifies velocities */
  applyImpulse(x: number, y: number, strength: number, radius: number): void {
    const r2 = radius * radius;
    for (let i = 0; i < totalPoints; i++) {
      if (this.anchored[i]) continue;
      const dx = this.posX[i] - x;
      const dy = this.posY[i] - y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 < r2 && dist2 > 0.01) {
        const dist = Math.sqrt(dist2);
        const falloff = 1 - dist / radius;
        const f = strength * falloff * falloff;
        this.velX[i] += (dx / dist) * f;
        this.velY[i] += (dy / dist) * f;
      }
    }
  }

  /** Continuous inward pull — queued for physics step */
  applyGravityWell(x: number, y: number, strength: number, radius: number): void {
    this.wellX.push(x);
    this.wellY.push(y);
    this.wellStr.push(strength);
    this.wellRad.push(radius);
  }

  /** Run spring-mass physics */
  update(dt: number): void {
    const substeps = this.substeps;
    const subDt = dt / 1000 / substeps;
    const k = GRID_SPRING_STIFFNESS;
    const anchorK = GRID_ANCHOR_STIFFNESS;
    const damping = GRID_SPRING_DAMPING;
    const maxDisp = GRID_MAX_DISPLACEMENT;
    const spacing = GRID_SPACING;

    for (let s = 0; s < substeps; s++) {
      // Zero accelerations
      this.accX.fill(0);
      this.accY.fill(0);

      // Spring forces from 4 neighbors
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          if (this.anchored[i]) continue;

          let ax = 0, ay = 0;

          // Right neighbor
          if (c < cols - 1) {
            const j = i + 1;
            const dx = this.posX[j] - this.posX[i];
            const dy = this.posY[j] - this.posY[i];
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0.001) {
              const stretch = dist - spacing;
              const f = k * stretch / dist;
              ax += f * dx;
              ay += f * dy;
            }
          }
          // Left neighbor
          if (c > 0) {
            const j = i - 1;
            const dx = this.posX[j] - this.posX[i];
            const dy = this.posY[j] - this.posY[i];
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0.001) {
              const stretch = dist - spacing;
              const f = k * stretch / dist;
              ax += f * dx;
              ay += f * dy;
            }
          }
          // Up neighbor
          if (r < rows - 1) {
            const j = i + cols;
            const dx = this.posX[j] - this.posX[i];
            const dy = this.posY[j] - this.posY[i];
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0.001) {
              const stretch = dist - spacing;
              const f = k * stretch / dist;
              ax += f * dx;
              ay += f * dy;
            }
          }
          // Down neighbor
          if (r > 0) {
            const j = i - cols;
            const dx = this.posX[j] - this.posX[i];
            const dy = this.posY[j] - this.posY[i];
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0.001) {
              const stretch = dist - spacing;
              const f = k * stretch / dist;
              ax += f * dx;
              ay += f * dy;
            }
          }

          // Anchor spring (return to rest)
          ax += anchorK * (this.restX[i] - this.posX[i]);
          ay += anchorK * (this.restY[i] - this.posY[i]);

          // Damping
          ax -= damping * this.velX[i];
          ay -= damping * this.velY[i];

          this.accX[i] = ax;
          this.accY[i] = ay;
        }
      }

      // Apply gravity wells into accelerations
      for (let w = 0; w < this.wellX.length; w++) {
        const wx = this.wellX[w];
        const wy = this.wellY[w];
        const wStr = this.wellStr[w];
        const wRad = this.wellRad[w];
        const wR2 = wRad * wRad;
        for (let i = 0; i < totalPoints; i++) {
          if (this.anchored[i]) continue;
          const dx = wx - this.posX[i];
          const dy = wy - this.posY[i];
          const dist2 = dx * dx + dy * dy;
          if (dist2 < wR2 && dist2 > 0.01) {
            const dist = Math.sqrt(dist2);
            const falloff = 1 - dist / wRad;
            const f = wStr * falloff;
            this.accX[i] += (dx / dist) * f;
            this.accY[i] += (dy / dist) * f;
          }
        }
      }

      // Symplectic Euler integration + displacement clamping
      for (let i = 0; i < totalPoints; i++) {
        if (this.anchored[i]) continue;
        this.velX[i] += this.accX[i] * subDt;
        this.velY[i] += this.accY[i] * subDt;
        this.posX[i] += this.velX[i] * subDt;
        this.posY[i] += this.velY[i] * subDt;

        // Clamp displacement
        const dx = this.posX[i] - this.restX[i];
        const dy = this.posY[i] - this.restY[i];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDisp) {
          const scale = maxDisp / dist;
          this.posX[i] = this.restX[i] + dx * scale;
          this.posY[i] = this.restY[i] + dy * scale;
          // Also reduce velocity component along displacement
          const nx = dx / dist;
          const ny = dy / dist;
          const dot = this.velX[i] * nx + this.velY[i] * ny;
          if (dot > 0) {
            this.velX[i] -= dot * nx;
            this.velY[i] -= dot * ny;
          }
        }
      }
    }

    // Clear gravity wells for next frame
    this.wellX.length = 0;
    this.wellY.length = 0;
    this.wellStr.length = 0;
    this.wellRad.length = 0;
  }

  render(cameraX: number, cameraY: number, viewW: number, viewH: number): void {
    const gl = this.gl;

    // Fill vertex data
    const vd = this.vertexData;
    for (let i = 0; i < totalPoints; i++) {
      const off = i * 4;
      vd[off] = this.posX[i];
      vd[off + 1] = this.posY[i];
      // displacement magnitude
      const dx = this.posX[i] - this.restX[i];
      const dy = this.posY[i] - this.restY[i];
      vd[off + 2] = Math.sqrt(dx * dx + dy * dy);
      // velocity magnitude
      vd[off + 3] = Math.sqrt(this.velX[i] * this.velX[i] + this.velY[i] * this.velY[i]);
    }

    // Upload
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.vertexData);

    gl.useProgram(this.program);

    // Uniforms
    gl.uniform2f(this.uResolution, viewW, viewH);
    gl.uniform2f(this.uCamera, cameraX, cameraY);
    gl.uniform3f(this.uColorBase, GRID_COLOR_BASE[0], GRID_COLOR_BASE[1], GRID_COLOR_BASE[2]);
    gl.uniform3f(this.uColorStretch, GRID_COLOR_STRETCH[0], GRID_COLOR_STRETCH[1], GRID_COLOR_STRETCH[2]);
    gl.uniform3f(this.uColorCompress, GRID_COLOR_COMPRESS[0], GRID_COLOR_COMPRESS[1], GRID_COLOR_COMPRESS[2]);

    // Vertex attribs (stride = 16 bytes: 4 floats)
    const aPos = gl.getAttribLocation(this.program, 'a_position');
    const aDisp = gl.getAttribLocation(this.program, 'a_displacement');
    const aVel = gl.getAttribLocation(this.program, 'a_velocity');

    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    if (aDisp >= 0) {
      gl.enableVertexAttribArray(aDisp);
      gl.vertexAttribPointer(aDisp, 1, gl.FLOAT, false, 16, 8);
    }
    if (aVel >= 0) {
      gl.enableVertexAttribArray(aVel);
      gl.vertexAttribPointer(aVel, 1, gl.FLOAT, false, 16, 12);
    }

    // Draw
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.drawElements(gl.LINES, this.indexCount, gl.UNSIGNED_SHORT, 0);

    // Clean up
    gl.disableVertexAttribArray(aPos);
    if (aDisp >= 0) gl.disableVertexAttribArray(aDisp);
    if (aVel >= 0) gl.disableVertexAttribArray(aVel);
  }

  clear(): void {
    for (let i = 0; i < totalPoints; i++) {
      this.posX[i] = this.restX[i];
      this.posY[i] = this.restY[i];
      this.velX[i] = 0;
      this.velY[i] = 0;
    }
    this.wellX.length = 0;
    this.wellY.length = 0;
    this.wellStr.length = 0;
    this.wellRad.length = 0;
  }
}
