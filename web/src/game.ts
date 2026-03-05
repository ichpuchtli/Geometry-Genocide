import { Renderer } from './renderer/sprite-batch';
import { BloomPass } from './renderer/bloom';
import { GridRenderer } from './renderer/grid';
import { TrailSystem } from './renderer/trails';
import { Camera } from './core/camera';
import { Input } from './core/input';
import { AudioManager } from './core/audio';
import { Player } from './entities/player';
import { BulletPool, Bullet } from './entities/bullet';
import { Enemy } from './entities/enemies/enemy';
import { DeathStar } from './entities/enemies/deathstar';
import { ExplosionPool } from './entities/explosion';
import { Crosshair } from './entities/crosshair';
import { HUD } from './ui/hud';
import { VirtualJoystickRenderer } from './ui/virtual-joystick';
import { renderOffscreenIndicators } from './ui/offscreen-indicators';
import { WaveManager } from './spawner/wave-manager';
import { checkCollisions, applyDeathStarAttraction } from './core/collision';
import { Vec2 } from './core/vector';
import {
  EXPLOSION_PARTICLE_COUNT_SMALL,
  EXPLOSION_PARTICLE_COUNT_LARGE,
  EXPLOSION_PARTICLE_COUNT_DEATH,
  EXPLOSION_DURATION_DEFAULT,
  EXPLOSION_DURATION_LARGE,
  EXPLOSION_DURATION_DEATH,
  BLOOM_THRESHOLD,
  BLOOM_INTENSITY,
  BLOOM_BLUR_PASSES,
  BLOOM_BLUR_RADIUS,
  GRID_EXPLOSION_STRENGTH,
  GRID_EXPLOSION_RADIUS,
  GRID_EXPLOSION_DECAY,
  TRAIL_LENGTH_ENEMY,
  TRAIL_LENGTH_BULLET,
  MOBILE_TRAIL_LENGTH_ENEMY,
  MOBILE_TRAIL_LENGTH_BULLET,
  BULLET_COLOR,
  DIFFICULTY_PHASES,
} from './config';

// Enemy factory imports
import { Rhombus } from './entities/enemies/rhombus';
import { Pinwheel } from './entities/enemies/pinwheel';
import { Square, Square2 } from './entities/enemies/square';
import { CircleEnemy } from './entities/enemies/circle';
import { Triangle } from './entities/enemies/triangle';
import { Octagon } from './entities/enemies/octagon';

type GameState = 'menu' | 'playing' | 'gameover';

function createEnemy(type: string, pos?: Vec2): Enemy {
  let e: Enemy;
  switch (type) {
    case 'rhombus': e = new Rhombus(); break;
    case 'pinwheel': e = new Pinwheel(); break;
    case 'square': e = new Square(); break;
    case 'square2': e = new Square2(pos); return e;
    case 'circle': e = new CircleEnemy(pos); return e;
    case 'triangle': e = new Triangle(); break;
    case 'octagon': e = new Octagon(); break;
    default: e = new Rhombus(); break;
  }
  if (!pos) {
    e.spawnAtEdge();
  } else {
    e.position.copyFrom(pos);
  }
  return e;
}

function isMobile(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export class Game {
  private renderer: Renderer;
  private bloom: BloomPass;
  private grid: GridRenderer;
  private trails: TrailSystem;
  private camera: Camera;
  private input: Input;
  private audio: AudioManager;
  private player: Player;
  private bullets: BulletPool;
  private enemies: Enemy[] = [];
  private deathstars: DeathStar[] = [];
  private explosions: ExplosionPool;
  private crosshair: Crosshair;
  private hud: HUD;
  private joystickRenderer: VirtualJoystickRenderer;
  private waveManager: WaveManager;

  private state: GameState = 'menu';
  private gameTime = 0;
  private mobile: boolean;

  // Trail IDs for bullets (keyed by bullet index)
  private bulletTrailIds = new Map<Bullet, number>();

  // Track trail lengths (adjusted for mobile)
  private trailLenEnemy: number;
  private trailLenBullet: number;

  constructor(private gameCanvas: HTMLCanvasElement, hudCanvas: HTMLCanvasElement) {
    this.mobile = isMobile();
    this.trailLenEnemy = this.mobile ? MOBILE_TRAIL_LENGTH_ENEMY : TRAIL_LENGTH_ENEMY;
    this.trailLenBullet = this.mobile ? MOBILE_TRAIL_LENGTH_BULLET : TRAIL_LENGTH_BULLET;

    this.renderer = new Renderer(gameCanvas);
    const gl = this.renderer.getGL();

    this.bloom = new BloomPass(gl);
    this.bloom.threshold = BLOOM_THRESHOLD;
    this.bloom.intensity = BLOOM_INTENSITY;
    this.bloom.blurPasses = this.mobile ? 2 : BLOOM_BLUR_PASSES;
    this.bloom.blurRadius = BLOOM_BLUR_RADIUS;

    this.grid = new GridRenderer(gl);
    this.trails = new TrailSystem();
    this.camera = new Camera(this.renderer.width, this.renderer.height);
    this.input = new Input(gameCanvas);
    this.input.setCamera(this.camera);
    this.audio = new AudioManager();
    this.player = new Player(this.input);
    this.bullets = new BulletPool();
    this.explosions = new ExplosionPool();
    this.crosshair = new Crosshair();
    this.hud = new HUD(hudCanvas);
    this.joystickRenderer = new VirtualJoystickRenderer(hudCanvas);
    this.waveManager = new WaveManager();

    // Click/touch to start + init audio
    gameCanvas.addEventListener('click', () => this.onInteract());
    gameCanvas.addEventListener('touchstart', () => this.onInteract(), { passive: true });

    // Mute toggle (M key)
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        this.audio.toggleMute();
      }
    });

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resize(), 100);
    });
    this.resize();
    this.hud.setTouchMode(this.mobile);
    this.hud.drawMenu();
  }

  private resize(): void {
    this.renderer.resize();
    this.camera.resize(this.renderer.width, this.renderer.height);
    this.bloom.resize(this.renderer.canvasWidth, this.renderer.canvasHeight);
    this.hud.resize();
    this.input.updateCanvasSize(this.gameCanvas.clientWidth);
    if (this.state === 'menu') this.hud.drawMenu();
  }

  private async onInteract(): Promise<void> {
    // Init audio on first user gesture
    if (!this.audio.initialized) {
      await this.audio.init();
    }
    await this.audio.resume();

    if (this.state === 'menu' || this.state === 'gameover') {
      this.startGame();
    }
  }

  private startGame(): void {
    this.state = 'playing';
    this.player.reset();
    this.bullets.clear();
    this.enemies = [];
    this.deathstars = [];
    this.explosions.clear();
    this.trails.clear();
    this.grid.clear();
    this.bulletTrailIds.clear();
    this.waveManager.reset();
    this.gameTime = 0;
    this.camera.snapTo(this.player.position);
    this.hud.clear();

    this.audio.playSFX('start');
    this.audio.startMusic();
    this.audio.setMusicIntensity(0);
  }

  /** Compute a 0-1 intensity value from current game state for adaptive music */
  private computeIntensity(): number {
    // Base intensity from time phase
    let base = 0;
    if (this.gameTime < DIFFICULTY_PHASES.tutorial.end) base = 0.05;
    else if (this.gameTime < DIFFICULTY_PHASES.rampUp.end) base = 0.25;
    else if (this.gameTime < DIFFICULTY_PHASES.midGame.end) base = 0.5;
    else if (this.gameTime < DIFFICULTY_PHASES.intense.end) base = 0.75;
    else base = 0.9;

    // Boost for boss presence
    const hasBoss = this.deathstars.some(d => d.active);
    if (hasBoss) base = Math.max(base, 0.8);

    // Boost for enemy count
    const enemyBoost = Math.min(this.enemies.length / 40, 0.3);
    return Math.min(base + enemyBoost, 1);
  }

  update(dt: number): void {
    // Update grid displacement decay regardless of state
    this.grid.update(dt);

    // Update touch mode on HUD
    this.hud.setTouchMode(this.input.mode === 'touch');

    if (this.state !== 'playing') return;

    if (this.input.isKeyDown('Escape')) {
      this.player.lives = 0;
      this.onPlayerDeath();
      return;
    }

    this.gameTime += dt / 1000;

    // Player
    this.player.update(dt);

    // Crosshair follows mouse (only in keyboard mode)
    if (this.input.mode === 'keyboard') {
      this.crosshair.position.copyFrom(this.input.getMouseWorldPos());
    }

    // Shooting
    const shots = this.player.tryShoot();
    if (shots) {
      for (const angle of shots) {
        const b = this.bullets.spawn(this.player.position.x, this.player.position.y, angle);
        if (b) {
          const tid = this.trails.register(BULLET_COLOR, this.trailLenBullet);
          this.bulletTrailIds.set(b, tid);
        }
      }
    }

    // Bullets
    this.bullets.update(dt);

    // Update bullet trails + clean up inactive
    for (const b of this.bullets.bullets) {
      const tid = this.bulletTrailIds.get(b);
      if (tid !== undefined) {
        if (b.active) {
          this.trails.update(tid, b.position.x, b.position.y);
        } else {
          this.trails.unregister(tid);
          this.bulletTrailIds.delete(b);
        }
      }
    }

    // DeathStar attraction
    const activeDeathstars = this.deathstars.filter(d => d.active);
    if (activeDeathstars.length > 0) {
      applyDeathStarAttraction(this.enemies, activeDeathstars);
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e instanceof Octagon) {
        (e as Octagon).update(dt, this.player.position, this.player.velocity);
      } else {
        (e as { update(dt: number, playerPos?: Vec2): void }).update(dt, this.player.position);
      }
      // Update enemy trails
      if (e.trailId >= 0) {
        this.trails.update(e.trailId, e.position.x, e.position.y);
      }
    }

    // DeathStars
    for (const ds of this.deathstars) {
      if (ds.active) ds.update(dt);
    }

    // Spawn
    const spawns = this.waveManager.update(dt);
    for (const req of spawns) {
      if (req.type === 'deathstar') {
        this.deathstars.push(new DeathStar(this.player.position));
        this.audio.playSFX('deathstar');
      } else {
        const enemy = createEnemy(req.type);
        // Register trail for enemy
        enemy.trailId = this.trails.register(enemy.color, this.trailLenEnemy);
        this.enemies.push(enemy);
        // Play spawn SFX for specific enemy types
        this.playEnemySpawnSFX(req.type);
      }
    }

    // Collision
    const result = checkCollisions(
      this.player,
      this.bullets.bullets,
      this.enemies,
      this.deathstars,
    );

    // Process kills
    for (const kill of result.killedEnemies) {
      this.player.score += kill.scoreValue;
      if (kill.scoreValue > 0) this.player.enemiesKilled++;
      this.explosions.spawn(
        kill.position.x, kill.position.y, kill.color,
        this.mobile ? Math.floor(EXPLOSION_PARTICLE_COUNT_SMALL * 0.6) : EXPLOSION_PARTICLE_COUNT_SMALL,
        EXPLOSION_DURATION_DEFAULT,
      );

      // Grid displacement from explosion
      this.grid.addForce(
        kill.position.x, kill.position.y,
        GRID_EXPLOSION_STRENGTH,
        GRID_EXPLOSION_RADIUS,
        GRID_EXPLOSION_DECAY,
      );

      this.audio.playSFX('crash');

      // Unregister trail
      if (kill.enemy.trailId >= 0) {
        this.trails.unregister(kill.enemy.trailId);
      }

      // Spawn children
      const deathResult = kill.enemy.onDeath();
      if (deathResult.spawnEnemies) {
        for (const child of deathResult.spawnEnemies) {
          const ce = createEnemy(child.type, child.position);
          ce.trailId = this.trails.register(ce.color, this.trailLenEnemy);
          this.enemies.push(ce);
        }
      }
    }

    // Process deathstar kills
    for (const kill of result.killedDeathStars) {
      this.explosions.spawn(
        kill.position.x, kill.position.y,
        [0.92, 0.38, 0.24],
        this.mobile ? Math.floor(EXPLOSION_PARTICLE_COUNT_LARGE * 0.5) : EXPLOSION_PARTICLE_COUNT_LARGE,
        EXPLOSION_DURATION_LARGE,
      );
      this.grid.addForce(
        kill.position.x, kill.position.y,
        GRID_EXPLOSION_STRENGTH * 2,
        GRID_EXPLOSION_RADIUS * 1.5,
        GRID_EXPLOSION_DECAY * 0.5,
      );
      this.audio.playSFX('deathstar2');
      for (let i = 0; i < kill.circleSpawnCount; i++) {
        const offset = Vec2.random().scale(100);
        const ce = createEnemy('circle', kill.position.add(offset));
        ce.trailId = this.trails.register(ce.color, this.trailLenEnemy);
        this.enemies.push(ce);
      }
    }

    // Process absorbed enemies
    for (const { enemy, deathstar } of result.absorbedEnemies) {
      deathstar.absorbEnemy();
      if (enemy.trailId >= 0) this.trails.unregister(enemy.trailId);
      this.explosions.spawn(enemy.position.x, enemy.position.y, enemy.color, 8, 0.5);
    }

    // Player hit
    if (result.playerHit) {
      this.player.lives--;
      if (this.player.lives <= 0) {
        this.onPlayerDeath();
        return;
      } else {
        this.onPlayerRespawn();
      }
    }

    // Clean up inactive enemies
    this.enemies = this.enemies.filter(e => {
      if (!e.active && e.trailId >= 0) {
        this.trails.unregister(e.trailId);
      }
      return e.active;
    });
    this.deathstars = this.deathstars.filter(d => d.active);

    // Explosions
    this.explosions.update(dt);

    // Camera
    this.camera.follow(this.player.position);

    // Music intensity
    this.audio.setMusicIntensity(this.computeIntensity());
  }

  private playEnemySpawnSFX(type: string): void {
    switch (type) {
      case 'rhombus': this.audio.playSFX('rhombus'); break;
      case 'square': this.audio.playSFX('square'); break;
      case 'pinwheel': this.audio.playSFX('pinwheel'); break;
      case 'triangle': this.audio.playSFX('triangle2'); break;
      case 'octagon': this.audio.playSFX('octagon'); break;
    }
  }

  private onPlayerDeath(): void {
    this.explosions.spawn(
      this.player.position.x, this.player.position.y,
      [1, 1, 0.78],
      this.mobile ? Math.floor(EXPLOSION_PARTICLE_COUNT_DEATH * 0.4) : EXPLOSION_PARTICLE_COUNT_DEATH,
      EXPLOSION_DURATION_DEATH,
      0.2,
    );
    this.grid.addForce(
      this.player.position.x, this.player.position.y,
      GRID_EXPLOSION_STRENGTH * 3,
      GRID_EXPLOSION_RADIUS * 2,
      GRID_EXPLOSION_DECAY * 0.3,
    );
    this.player.active = false;
    this.state = 'gameover';
    // Clean up trails
    for (const e of this.enemies) {
      if (e.trailId >= 0) this.trails.unregister(e.trailId);
    }
    for (const [, tid] of this.bulletTrailIds) {
      this.trails.unregister(tid);
    }
    this.bulletTrailIds.clear();
    this.enemies = [];
    this.deathstars = [];
    this.audio.playSFX('die');
    this.audio.stopMusic();
    this.hud.drawGameOver(this.player.score, this.player.enemiesKilled, this.gameTime);
  }

  private onPlayerRespawn(): void {
    this.explosions.spawn(
      this.player.position.x, this.player.position.y,
      [1, 1, 0.78],
      EXPLOSION_PARTICLE_COUNT_LARGE,
      EXPLOSION_DURATION_DEFAULT,
    );
    this.grid.addForce(
      this.player.position.x, this.player.position.y,
      GRID_EXPLOSION_STRENGTH * 2,
      GRID_EXPLOSION_RADIUS * 1.5,
      GRID_EXPLOSION_DECAY,
    );
    // Clean up trails
    for (const e of this.enemies) {
      if (e.trailId >= 0) this.trails.unregister(e.trailId);
    }
    for (const [, tid] of this.bulletTrailIds) {
      this.trails.unregister(tid);
    }
    this.bulletTrailIds.clear();
    this.enemies = [];
    this.deathstars = [];
    this.player.respawn();
    this.audio.playSFX('die1');
  }

  render(): void {
    const gl = this.renderer.getGL();
    const cameraX = this.camera.position.x;
    const cameraY = this.camera.position.y;
    this.renderer.cameraX = cameraX;
    this.renderer.cameraY = cameraY;

    // --- Render to bloom scene FBO ---
    this.bloom.bindSceneFBO();

    // 1. Grid (renders directly with its own shader)
    this.grid.render(cameraX, cameraY, this.renderer.width, this.renderer.height);

    // 2. Trails (via sprite batch)
    this.renderer.begin(false); // don't clear — grid already rendered
    this.trails.render(this.renderer);
    this.renderer.end();

    // 3. Entities (via sprite batch)
    this.renderer.begin(false);

    if (this.state === 'playing') {
      for (const e of this.enemies) e.render(this.renderer);
      for (const ds of this.deathstars) ds.render(this.renderer);
      this.bullets.render(this.renderer);
      this.player.render(this.renderer);

      // Only show crosshair in keyboard mode
      if (this.input.mode === 'keyboard') {
        this.crosshair.render(this.renderer);
      }

      // Off-screen indicators
      renderOffscreenIndicators(this.renderer, this.camera, this.enemies, this.deathstars);
    }

    // Explosions render in all states (lingering after death)
    this.explosions.render(this.renderer);

    this.renderer.end();

    // --- Bloom post-process: scene FBO -> screen ---
    this.bloom.apply(this.renderer.canvasWidth, this.renderer.canvasHeight);

    // --- HUD (drawn on separate 2D canvas, unaffected by bloom) ---
    if (this.state === 'playing') {
      this.hud.drawPlaying(this.player.score, this.player.lives, this.audio.muted);

      // Virtual joysticks (drawn on HUD canvas)
      this.joystickRenderer.render(this.input);
    }
  }

  /** Called when tab is hidden */
  onPause(): void {
    // Nothing special needed — game loop already stops
  }

  /** Called when tab is visible again */
  onResume(): void {
    this.audio.resume();
  }
}
