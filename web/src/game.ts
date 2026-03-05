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
import { Starfield } from './renderer/starfield';
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
  GRID_ENEMY_STRENGTH,
  GRID_ENEMY_RADIUS,
  GRID_ENEMY_DECAY,
  TRAIL_LENGTH_ENEMY,
  TRAIL_LENGTH_BULLET,
  MOBILE_TRAIL_LENGTH_ENEMY,
  MOBILE_TRAIL_LENGTH_BULLET,
  MOBILE_ZOOM,
  BULLET_COLOR,
  DIFFICULTY_PHASES,
  SCREEN_SHAKE_SMALL,
  SCREEN_SHAKE_LARGE,
  SCREEN_SHAKE_DEATH,
  WORLD_WIDTH,
  WORLD_HEIGHT,
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
  private starfield: Starfield;

  private state: GameState = 'menu';
  private gameTime = 0;
  private gameOverTime = 0;
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
    if (this.mobile) this.renderer.zoom = MOBILE_ZOOM;
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
    this.starfield = new Starfield(200, WORLD_WIDTH, WORLD_HEIGHT);

    // Click/touch to start + init audio
    // Use touchend for iOS Safari reliability (touchstart preventDefault in Input
    // suppresses synthetic click, and passive/non-passive conflicts cause issues)
    gameCanvas.addEventListener('click', () => this.onInteract());
    gameCanvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.onInteract();
    }, { passive: false });

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

  private onInteract(): void {
    // Init audio on first user gesture (non-blocking so game start isn't
    // prevented by audio failures on iOS Safari)
    if (!this.audio.initialized) {
      this.audio.init().catch(() => {});
    } else {
      this.audio.resume().catch(() => {});
    }

    if (this.state === 'menu' || this.state === 'gameover') {
      // Request fullscreen on mobile (must be in user gesture handler)
      if (this.mobile && !document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
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

  /** Update gravity wells on the grid from large enemies (Octagon, DeathStar) */
  private updateGravityWells(): void {
    const wells: { x: number; y: number; mass: number; radius: number }[] = [];
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e instanceof Octagon) {
        // Octagon: moderate gravity well (pulls grid inward)
        wells.push({ x: e.position.x, y: e.position.y, mass: -15, radius: 200 });
      }
    }
    for (const ds of this.deathstars) {
      if (!ds.active) continue;
      // DeathStar: strong gravity well
      wells.push({ x: ds.position.x, y: ds.position.y, mass: -30, radius: 300 });
    }
    this.grid.setGravityWells(wells);
  }

  /** Update during game over: keep enemies alive with idle animation + gravity */
  private updateGameOver(dt: number): void {
    this.gameOverTime += dt / 1000;

    // Keep explosions animating
    this.explosions.update(dt);

    // Gentle idle rotation for enemies (no movement)
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.rotation += dt * 0.001;
    }

    // DeathStars keep pulsing
    for (const ds of this.deathstars) {
      if (ds.active) ds.update(dt);
    }

    // Gravity: big enemies pull smaller ones slowly during game over
    for (const e of this.enemies) {
      if (!e.active) continue;
      // Pulled by Octagons
      for (const o of this.enemies) {
        if (o === e || !o.active || !(o instanceof Octagon)) continue;
        const dx = o.position.x - e.position.x;
        const dy = o.position.y - e.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10 && dist < 200) {
          const pull = 0.02 * dt / dist;
          e.position.x += dx * pull;
          e.position.y += dy * pull;
        }
      }
      // Pulled by DeathStars
      for (const ds of this.deathstars) {
        if (!ds.active) continue;
        const dx = ds.position.x - e.position.x;
        const dy = ds.position.y - e.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10 && dist < 300) {
          const pull = 0.04 * dt / dist;
          e.position.x += dx * pull;
          e.position.y += dy * pull;
        }
      }
    }

    // Update gravity wells for grid warping
    this.updateGravityWells();
  }

  update(dt: number): void {
    // Update grid displacement decay regardless of state
    this.grid.update(dt);
    this.camera.updateShake(dt);

    // Update touch mode on HUD
    this.hud.setTouchMode(this.input.mode === 'touch');

    if (this.state === 'gameover') {
      this.updateGameOver(dt);
      return;
    }

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
      // Decrement spawn timer
      if (e.isSpawning) {
        e.spawnTimer = Math.max(0, e.spawnTimer - dt / 1000);
        if (e.trailId >= 0) this.trails.update(e.trailId, e.position.x, e.position.y);
        continue; // skip movement/AI during spawn
      }
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
        // Grid ripple on spawn
        this.grid.addForce(enemy.position.x, enemy.position.y, 10, 80, 6);
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

      // Screen shake on enemy kill
      this.camera.shake(SCREEN_SHAKE_SMALL);

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
      this.camera.shake(SCREEN_SHAKE_LARGE);
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

    // Update gravity wells for grid warping during gameplay
    this.updateGravityWells();

    // Grid micro-forces from moving enemies
    let gridForceCount = 0;
    for (const e of this.enemies) {
      if (!e.active || e.isSpawning) continue;
      if (gridForceCount >= 8) break;
      if (!this.camera.isVisible(e.position.x, e.position.y, 50)) continue;
      const speed = e.velocity.magnitude();
      if (speed > 0.01) {
        this.grid.addForce(e.position.x, e.position.y, GRID_ENEMY_STRENGTH * speed * 20, GRID_ENEMY_RADIUS, GRID_ENEMY_DECAY);
        gridForceCount++;
      }
    }

    // Player wake on grid
    const pSpeed = this.player.velocity.magnitude();
    if (pSpeed > 0.01) {
      this.grid.addForce(this.player.position.x, this.player.position.y, 3 * pSpeed * 20, 80, 10);
    }

    // Bullet grid ripples (very subtle)
    let bulletForces = 0;
    for (const b of this.bullets.bullets) {
      if (!b.active || bulletForces >= 3) break;
      this.grid.addForce(b.position.x, b.position.y, 2, 50, 12);
      bulletForces++;
    }

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
    this.camera.shake(SCREEN_SHAKE_DEATH, 0.4);
    this.state = 'gameover';
    this.gameOverTime = 0;
    // Clean up bullet trails only — keep enemy trails for the frozen scene
    for (const [, tid] of this.bulletTrailIds) {
      this.trails.unregister(tid);
    }
    this.bulletTrailIds.clear();
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
    // Use shake-offset camera for rendering
    const cameraX = this.camera.renderX;
    const cameraY = this.camera.renderY;
    this.renderer.cameraX = cameraX;
    this.renderer.cameraY = cameraY;

    // --- Render to bloom scene FBO ---
    this.bloom.bindSceneFBO();

    // 1. Grid (renders directly with its own shader)
    this.grid.render(cameraX, cameraY, this.renderer.width, this.renderer.height);

    // 2. Starfield (faint background dots, before entities)
    this.renderer.begin(false);
    this.starfield.render(this.renderer, cameraX, cameraY);
    this.renderer.end();

    // 3. Entities — NORMAL blend
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

    // Game over: render frozen enemies with unique glow effects
    if (this.state === 'gameover') {
      const t = this.gameOverTime;
      for (const e of this.enemies) e.renderGlow(this.renderer, t);
      for (const ds of this.deathstars) ds.renderGlow(this.renderer, t);
    }

    // 4. Switch to additive blend for trails, explosions, glow
    this.renderer.setBlendMode('additive');
    this.trails.render(this.renderer);
    this.explosions.render(this.renderer);
    // setBlendMode('normal') flushes additive batch and restores blend func
    this.renderer.setBlendMode('normal');
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
