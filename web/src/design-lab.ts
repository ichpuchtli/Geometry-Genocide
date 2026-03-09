import { Renderer } from './renderer/sprite-batch';
import { BloomPass } from './renderer/bloom';
import { SpringMassGrid } from './renderer/grid';
import { TrailSystem } from './renderer/trails';
import { Camera } from './core/camera';
import { Input } from './core/input';
import { AudioManager } from './core/audio';
import { HUD } from './ui/hud';
import { Starfield } from './renderer/starfield';
import { ExplosionPool } from './entities/explosion';
import { Enemy } from './entities/enemies/enemy';
import { BlackHole, BlackHoleVisualMode } from './entities/enemies/blackhole';
import { Rhombus } from './entities/enemies/rhombus';
import { Pinwheel } from './entities/enemies/pinwheel';
import { Square } from './entities/enemies/square';
import { Sierpinski } from './entities/enemies/sierpinski';
import { Vec2 } from './core/vector';
import { COLORS, TRAIL_LENGTH_ENEMY, EXPLOSION_DURATION_DEFAULT } from './config';
import { gameSettings } from './settings';

type SpawnableType = 'rhombus' | 'pinwheel' | 'square' | 'sierpinski' | 'blackhole';

const SPAWNABLE_TYPES: SpawnableType[] = ['rhombus', 'pinwheel', 'square', 'sierpinski', 'blackhole'];

const SPAWNABLE_COLORS: Record<SpawnableType, string> = {
  rhombus: '#00c8ff',
  pinwheel: '#c840ff',
  square: '#ff20ff',
  sierpinski: '#ffd700',
  blackhole: '#66b3ff',
};

interface LabBlackHole {
  bh: BlackHole;
  label: string;
  sublabel: string;
  mode: BlackHoleVisualMode;
  worldX: number;
  worldY: number;
}

/** Design Lab: visual sandbox for comparing BlackHole render variants */
export class DesignLab {
  private renderer: Renderer;
  private bloom: BloomPass;
  private grid: SpringMassGrid;
  private trails: TrailSystem;
  private camera: Camera;
  private input: Input;
  private audio: AudioManager;
  private hud: HUD;
  private starfield: Starfield;
  private explosions: ExplosionPool;

  private labHoles: LabBlackHole[] = [];
  private enemies: Enemy[] = [];
  private totalTime = 0;
  private selectedTypeIdx = 0;

  constructor(
    renderer: Renderer,
    bloom: BloomPass,
    grid: SpringMassGrid,
    trails: TrailSystem,
    camera: Camera,
    input: Input,
    audio: AudioManager,
    hud: HUD,
    starfield: Starfield,
  ) {
    this.renderer = renderer;
    this.bloom = bloom;
    this.grid = grid;
    this.trails = trails;
    this.camera = camera;
    this.input = input;
    this.audio = audio;
    this.hud = hud;
    this.starfield = starfield;
    this.explosions = new ExplosionPool();
  }

  get selectedType(): SpawnableType {
    return SPAWNABLE_TYPES[this.selectedTypeIdx];
  }

  enter(): void {
    // Clear any existing state
    this.exit();
    this.totalTime = 0;

    // Rebuild grid with current arena settings
    this.grid.rebuild(gameSettings.arenaWidth, gameSettings.arenaHeight, gameSettings.gridSpacing);

    // Create 4 BlackHoles in 2x2 layout
    const positions: { x: number; y: number; mode: BlackHoleVisualMode; label: string }[] = [
      { x: -300, y: 180, mode: 'current', label: 'Current' },
      { x: 300, y: 180, mode: 'violent_breather', label: 'Violent Breather' },
      { x: -300, y: -180, mode: 'convulsive', label: 'Convulsive' },
      { x: 300, y: -180, mode: 'absorption_spike', label: 'Absorption Spike' },
    ];

    for (const p of positions) {
      const bh = new BlackHole();
      bh.position.x = p.x;
      bh.position.y = p.y;
      bh.visualMode = p.mode;
      bh.active = true;
      // Skip spawn animation
      bh.spawnTimer = 0;
      bh.trailId = this.trails.register(bh.color, TRAIL_LENGTH_ENEMY);
      this.enemies.push(bh);

      this.labHoles.push({
        bh,
        label: p.label,
        sublabel: 'Mass: 0/12',
        mode: p.mode,
        worldX: p.x,
        worldY: p.y,
      });
    }

    // Center camera
    this.camera.snapTo(new Vec2(0, 0));
  }

  exit(): void {
    // Unregister all trails
    for (const e of this.enemies) {
      if (e.trailId >= 0) this.trails.unregister(e.trailId);
    }
    this.enemies = [];
    this.labHoles = [];
    this.explosions.clear();
    this.trails.clear();
  }

  update(dt: number): void {
    this.totalTime += dt / 1000;

    // Update all enemies (BHs + spawned enemies)
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e.isSpawning) {
        e.spawnTimer = Math.max(0, e.spawnTimer - dt / 1000);
        if (e.trailId >= 0) this.trails.update(e.trailId, e.position.x, e.position.y);
        continue;
      }

      if (e instanceof BlackHole) {
        e.update(dt);
        // Sync grid pulses from visual modes
        if (e.needsGridPulse) {
          this.grid.applyImpulse(e.position.x, e.position.y, e.gridPulseStrength, 150);
          e.needsGridPulse = false;
        }
      } else {
        // Non-BH enemies: find nearest BH and follow it
        let nearestBH: BlackHole | null = null;
        let nearestDist = Infinity;
        for (const lh of this.labHoles) {
          const dx = lh.bh.position.x - e.position.x;
          const dy = lh.bh.position.y - e.position.y;
          const d = dx * dx + dy * dy;
          if (d < nearestDist) {
            nearestDist = d;
            nearestBH = lh.bh;
          }
        }
        if (nearestBH) {
          (e as { update(dt: number, playerPos?: Vec2): void }).update(dt, nearestBH.position);
        }
      }

      if (e.trailId >= 0) {
        this.trails.update(e.trailId, e.position.x, e.position.y);
      }
    }

    // BlackHole attraction: pull non-BH enemies toward nearest BH
    for (const lh of this.labHoles) {
      const bh = lh.bh;
      if (!bh.active) continue;

      const attractR2 = BlackHole.ATTRACT_RADIUS * BlackHole.ATTRACT_RADIUS;
      const absorbR2 = (bh.collisionRadius + 10) * (bh.collisionRadius + 10);

      for (const e of this.enemies) {
        if (!e.active || e.isSpawning || e === bh || e instanceof BlackHole) continue;

        const dx = bh.position.x - e.position.x;
        const dy = bh.position.y - e.position.y;
        const dist2 = dx * dx + dy * dy;

        // Absorb on contact
        if (dist2 < absorbR2 && bh.absorbedCount < BlackHole.MAX_ABSORB) {
          e.active = false;
          bh.absorbEnemy();
          if (e.trailId >= 0) this.trails.unregister(e.trailId);
          this.explosions.spawn(e.position.x, e.position.y, e.color, 15, 0.6);
          this.grid.applyImpulse(e.position.x, e.position.y, -20, 120);

          // In design lab: no overload explosion. Reset and keep going.
          if (bh.overloaded) {
            bh.overloaded = false;
            bh.absorbedCount = 0;
            bh.collisionRadius = 30;
          }
          continue;
        }

        // Attract within radius
        if (dist2 < attractR2 && dist2 > 1) {
          const dist = Math.sqrt(dist2);
          const force = BlackHole.GRAVITY_STRENGTH * dt / dist;
          e.position.x += dx / dist * force;
          e.position.y += dy / dist * force;
        }
      }

      // Update label
      lh.sublabel = `Mass: ${bh.absorbedCount}/${BlackHole.MAX_ABSORB}`;
    }

    // Gravity wells for grid warping
    for (const lh of this.labHoles) {
      const bh = lh.bh;
      if (!bh.active) continue;
      const mass = -(gameSettings.bhGridMassBase + bh.absorbedCount * gameSettings.bhGridMassPerAbsorb);
      this.grid.applyGravityWell(bh.position.x, bh.position.y, mass, BlackHole.ATTRACT_RADIUS * gameSettings.bhGridRadiusMultiplier);
    }

    // Enemy micro-forces on grid
    for (const e of this.enemies) {
      if (!e.active || e.isSpawning || e instanceof BlackHole) continue;
      const speed = e.velocity.magnitude();
      if (speed > 0.01) {
        this.grid.applyImpulse(e.position.x, e.position.y, speed * 2, 80);
      }
    }

    // Update grid physics
    this.grid.update(dt);

    // Update explosions
    this.explosions.update(dt);

    // Clean up inactive enemies (non-BH only)
    this.enemies = this.enemies.filter(e => {
      if (!e.active && e.trailId >= 0) {
        this.trails.unregister(e.trailId);
      }
      return e.active;
    });
  }

  render(): void {
    const cameraX = this.camera.renderX;
    const cameraY = this.camera.renderY;
    this.renderer.cameraX = cameraX;
    this.renderer.cameraY = cameraY;

    this.bloom.shakeIntensity = this.camera.shakeNormalized;
    this.bloom.time = this.totalTime;

    // --- Render to bloom scene FBO ---
    this.bloom.bindSceneFBO();

    // 1. Grid
    this.grid.render(cameraX, cameraY, this.renderer.width, this.renderer.height);

    // 2. Starfield
    this.renderer.begin(false);
    this.starfield.render(this.renderer, cameraX, cameraY);
    this.renderer.end();

    // 3. Arena border + Entities — NORMAL blend
    this.renderer.begin(false);
    this.renderArenaBorder();

    for (const e of this.enemies) {
      e.render(this.renderer);
    }

    // 4. Switch to additive blend for trails, explosions
    this.renderer.setBlendMode('additive');
    this.trails.render(this.renderer);
    this.explosions.render(this.renderer);
    this.renderer.setBlendMode('normal');
    this.renderer.end();

    // --- Bloom post-process ---
    this.bloom.apply(this.renderer.canvasWidth, this.renderer.canvasHeight);

    // --- HUD overlay ---
    this.hud.clear();

    // Labels for each BH variant
    const labels: { text: string; subtext: string; screenX: number; screenY: number }[] = [];
    for (const lh of this.labHoles) {
      // Convert world to screen coordinates
      const screenX = (lh.worldX - cameraX) * this.renderer.zoom + this.renderer.canvasWidth / (window.devicePixelRatio || 1) / 2;
      const screenY = -(lh.worldY - cameraY) * this.renderer.zoom + this.renderer.canvasHeight / (window.devicePixelRatio || 1) / 2;
      labels.push({
        text: lh.label,
        subtext: lh.sublabel,
        screenX,
        screenY: screenY - 70, // Above the BH
      });
    }
    this.hud.drawDesignLabLabels(labels);
    this.hud.drawDesignLabOverlay(this.selectedType, SPAWNABLE_COLORS[this.selectedType]);
  }

  onClick(): void {
    // Spawn selected enemy type at cursor world position
    const mouseWorld = this.input.getMouseWorldPos();
    const type = this.selectedType;

    let enemy: Enemy;
    switch (type) {
      case 'rhombus': enemy = new Rhombus(); break;
      case 'pinwheel': enemy = new Pinwheel(); break;
      case 'square': enemy = new Square(); break;
      case 'sierpinski': enemy = new Sierpinski(); break;
      case 'blackhole': {
        // Spawn a new regular BH (not a lab variant)
        const bh = new BlackHole();
        bh.position.x = mouseWorld.x;
        bh.position.y = mouseWorld.y;
        bh.active = true;
        bh.spawnTimer = 0;
        bh.trailId = this.trails.register(bh.color, TRAIL_LENGTH_ENEMY);
        this.enemies.push(bh);
        this.grid.applyImpulse(mouseWorld.x, mouseWorld.y, 80, 120);
        return;
      }
      default: enemy = new Rhombus(); break;
    }

    enemy.position.x = mouseWorld.x;
    enemy.position.y = mouseWorld.y;
    enemy.active = true;
    enemy.spawnTimer = 0;
    enemy.speed *= gameSettings.enemySpeedMultiplier;
    enemy.trailId = this.trails.register(enemy.color, TRAIL_LENGTH_ENEMY);
    this.enemies.push(enemy);
    this.grid.applyImpulse(mouseWorld.x, mouseWorld.y, 80, 120);
  }

  onKeyDown(code: string): void {
    switch (code) {
      case 'Digit1': this.selectedTypeIdx = 0; break;
      case 'Digit2': this.selectedTypeIdx = 1; break;
      case 'Digit3': this.selectedTypeIdx = 2; break;
      case 'Digit4': this.selectedTypeIdx = 3; break;
      case 'Digit5': this.selectedTypeIdx = 4; break;
    }
  }

  private renderArenaBorder(): void {
    const hw = gameSettings.arenaWidth / 2;
    const hh = gameSettings.arenaHeight / 2;
    const a = 0.6;
    // Dim blue border
    this.renderer.drawLine(-hw, -hh, hw, -hh, 0, 0.4, 0.8, a);
    this.renderer.drawLine(hw, -hh, hw, hh, 0, 0.4, 0.8, a);
    this.renderer.drawLine(hw, hh, -hw, hh, 0, 0.4, 0.8, a);
    this.renderer.drawLine(-hw, hh, -hw, -hh, 0, 0.4, 0.8, a);
  }
}
