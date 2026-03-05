import { createProgram } from './webgl-context';
import gridVert from './shaders/grid.vert';
import gridFrag from './shaders/grid.frag';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../config';

export interface GridForce {
  x: number;
  y: number;
  strength: number;
  radius: number;
  decay: number; // strength units per second
}

export interface GravityWell {
  x: number;
  y: number;
  mass: number;   // negative strength = pull grid inward
  radius: number;
}

const GRID_SPACING = 80;
const MAX_FORCES = 16;

export class GridRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private vertexBuffer: WebGLBuffer;
  private vertexCount = 0;

  private forces: GridForce[] = [];
  private gravityWells: GravityWell[] = [];

  // Uniform locations
  private uResolution: WebGLUniformLocation;
  private uCamera: WebGLUniformLocation;
  private uForceCount: WebGLUniformLocation;
  private uForces: WebGLUniformLocation;
  private uForceRadii: WebGLUniformLocation;
  private uGridColor: WebGLUniformLocation;

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl;
    this.program = createProgram(gl, gridVert, gridFrag);

    this.uResolution = gl.getUniformLocation(this.program, 'u_resolution')!;
    this.uCamera = gl.getUniformLocation(this.program, 'u_camera')!;
    this.uForceCount = gl.getUniformLocation(this.program, 'u_forceCount')!;
    this.uForces = gl.getUniformLocation(this.program, 'u_forces')!;
    this.uForceRadii = gl.getUniformLocation(this.program, 'u_forceRadii')!;
    this.uGridColor = gl.getUniformLocation(this.program, 'u_gridColor')!;

    // Build grid vertex data
    const vertices: number[] = [];
    const hw = WORLD_WIDTH / 2;
    const hh = WORLD_HEIGHT / 2;

    // Horizontal lines
    for (let y = -hh; y <= hh; y += GRID_SPACING) {
      for (let x = -hw; x <= hw - GRID_SPACING; x += GRID_SPACING) {
        vertices.push(x, y, x + GRID_SPACING, y);
      }
    }
    // Vertical lines
    for (let x = -hw; x <= hw; x += GRID_SPACING) {
      for (let y = -hh; y <= hh - GRID_SPACING; y += GRID_SPACING) {
        vertices.push(x, y, x, y + GRID_SPACING);
      }
    }

    this.vertexCount = vertices.length / 2;
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    this.vertexBuffer = buf;
  }

  addForce(x: number, y: number, strength: number, radius: number, decay: number): void {
    this.forces.push({ x, y, strength, radius, decay });
  }

  /** Set gravity wells (persistent forces that warp the grid inward). Call each frame. */
  setGravityWells(wells: GravityWell[]): void {
    this.gravityWells = wells;
  }

  update(dt: number): void {
    const dtSec = dt / 1000;
    for (let i = this.forces.length - 1; i >= 0; i--) {
      const f = this.forces[i];
      f.strength *= Math.max(0, 1 - f.decay * dtSec);
      if (Math.abs(f.strength) < 0.5) {
        this.forces.splice(i, 1);
      }
    }
  }

  render(cameraX: number, cameraY: number, viewW: number, viewH: number): void {
    const gl = this.gl;
    gl.useProgram(this.program);

    // Uniforms
    gl.uniform2f(this.uResolution, viewW, viewH);
    gl.uniform2f(this.uCamera, cameraX, cameraY);
    // Purple space-time continuum grid
    gl.uniform3f(this.uGridColor, 0.18, 0.05, 0.35);

    // Combine explosion forces + gravity wells
    const combined: { x: number; y: number; strength: number; radius: number }[] = [];
    for (const f of this.forces) combined.push(f);
    for (const w of this.gravityWells) combined.push({ x: w.x, y: w.y, strength: w.mass, radius: w.radius });

    const count = Math.min(combined.length, MAX_FORCES);
    gl.uniform1i(this.uForceCount, count);

    const forceData = new Float32Array(MAX_FORCES * 3);
    const radiiData = new Float32Array(MAX_FORCES);
    for (let i = 0; i < count; i++) {
      const f = combined[i];
      forceData[i * 3] = f.x;
      forceData[i * 3 + 1] = f.y;
      forceData[i * 3 + 2] = f.strength;
      radiiData[i] = f.radius;
    }
    gl.uniform3fv(this.uForces, forceData);
    gl.uniform1fv(this.uForceRadii, radiiData);

    // Draw
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    const aPos = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.LINES, 0, this.vertexCount);
  }

  clear(): void {
    this.forces.length = 0;
    this.gravityWells.length = 0;
  }
}
