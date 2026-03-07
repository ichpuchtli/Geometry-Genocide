import { Renderer } from './renderer/sprite-batch';
import { BloomPass } from './renderer/bloom';
import { SpringMassGrid } from './renderer/grid';
import { TrailSystem } from './renderer/trails';
import { Camera } from './core/camera';
import { Input } from './core/input';
import { AudioManager } from './core/audio';
import { Player } from './entities/player';
import { BulletPool, Bullet } from './entities/bullet';
import { Enemy } from './entities/enemies/enemy';
import { ExplosionPool } from './entities/explosion';
import { AimIndicator } from './entities/crosshair';
import { HUD } from './ui/hud';
import { VirtualJoystickRenderer } from './ui/virtual-joystick';
import { renderOffscreenIndicators } from './ui/offscreen-indicators';
import { WaveManager } from './spawner/wave-manager';
import { Starfield } from './renderer/starfield';
import { checkCollisions } from './core/collision';
import { Vec2 } from './core/vector';
import { HapticsManager } from './core/haptics';
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
  TRAIL_LENGTH_ENEMY,
  TRAIL_LENGTH_BULLET,
  MOBILE_TRAIL_LENGTH_ENEMY,
  MOBILE_TRAIL_LENGTH_BULLET,
  BULLET_COLOR,
  DIFFICULTY_PHASES,
  SCREEN_SHAKE_SMALL,
  SCREEN_SHAKE_LARGE,
  SCREEN_SHAKE_DEATH,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  ARENA_BORDER_COLOR,
  ARENA_BORDER_CORNER_COLOR,
  ARENA_BORDER_ALPHA,
  DEATH_SLOWMO_DURATION,
  DEATH_SLOWMO_TIME_SCALE,
  DEATH_SLOWMO_SHOCKWAVE_SPEED,
  MIN_SPAWN_DISTANCE,
  SPAWN_DURATION_AMBUSH,
} from './config';

// Enemy factory imports
import { Rhombus } from './entities/enemies/rhombus';
import { Pinwheel } from './entities/enemies/pinwheel';
import { Square, Square2 } from './entities/enemies/square';
import { CircleEnemy } from './entities/enemies/circle';
import { Triangle } from './entities/enemies/triangle';
import { BlackHole } from './entities/enemies/blackhole';
import { Shard } from './entities/enemies/shard';
import { Sierpinski } from './entities/enemies/sierpinski';
import { gameSettings } from './settings';
import { showDesktopSettings, hideDesktopSettings } from './ui/settings-panel';

type GameState = 'menu' | 'playing' | 'death_slowmo' | 'gameover';

function createEnemy(type: string, pos?: Vec2): Enemy {
  let e: Enemy;
  switch (type) {
    case 'rhombus': e = new Rhombus(); break;
    case 'pinwheel': e = new Pinwheel(); break;
    case 'square': e = new Square(); break;
    case 'square2': e = new Square2(pos); e.speed *= gameSettings.enemySpeedMultiplier; return e;
    case 'circle': e = new CircleEnemy(pos); e.speed *= gameSettings.enemySpeedMultiplier; return e;
    case 'triangle': e = new Triangle(); break;
    case 'blackhole': e = new BlackHole(); break;
    case 'shard': e = new Shard(pos); e.speed *= gameSettings.enemySpeedMultiplier; return e;
    case 'sierpinski': e = new Sierpinski(); break;
    default: e = new Rhombus(); break;
  }
  if (!pos) {
    e.spawnAtEdge();
  } else {
    e.position.copyFrom(pos);
  }
  e.speed *= gameSettings.enemySpeedMultiplier;
  return e;
}

function isMobile(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export class Game {
  private renderer: Renderer;
  private bloom: BloomPass;
  private grid: SpringMassGrid;
  private trails: TrailSystem;
  private camera: Camera;
  private input: Input;
  private audio: AudioManager;
  private player: Player;
  private bullets: BulletPool;
  private enemies: Enemy[] = [];
  private explosions: ExplosionPool;
  private aimIndicator: AimIndicator;
  private hud: HUD;
  private joystickRenderer: VirtualJoystickRenderer;
  private waveManager: WaveManager;
  private starfield: Starfield;
  private haptics: HapticsManager;

  private state: GameState = 'menu';
  private gameTime = 0;
  private gameOverTime = 0;
  private totalTime = 0; // monotonic time for shader effects
  private mobile: boolean;

  // Trail IDs for bullets (keyed by bullet index)
  private bulletTrailIds = new Map<Bullet, number>();

  // Track trail lengths (adjusted for mobile)
  private trailLenEnemy: number;
  private trailLenBullet: number;

  // Staggered spawn queue for theatrical enemy deaths (e.g. Sierpinski)
  private pendingSpawns: { type: string; position: Vec2; delay: number; origin: Vec2 }[] = [];

  // Death slowmo state
  private slowmoTimer = 0;
  private slowmoShockwaveRadius = 0;
  private slowmoOrigin = new Vec2(0, 0);
  private slowmoIsFinal = false; // true = game over after slowmo, false = respawn

  constructor(private gameCanvas: HTMLCanvasElement, hudCanvas: HTMLCanvasElement) {
    this.mobile = isMobile();
    this.trailLenEnemy = this.mobile ? MOBILE_TRAIL_LENGTH_ENEMY : TRAIL_LENGTH_ENEMY;
    this.trailLenBullet = this.mobile ? MOBILE_TRAIL_LENGTH_BULLET : TRAIL_LENGTH_BULLET;

    this.renderer = new Renderer(gameCanvas);
    {
      const cssW = gameCanvas.clientWidth;
      const cssH = gameCanvas.clientHeight;
      // Desktop: fit entire arena on screen (Math.min). Mobile: fill viewport edge-to-edge (Math.max).
      this.renderer.zoom = this.mobile
        ? Math.max(cssW / WORLD_WIDTH, cssH / WORLD_HEIGHT)
        : Math.min(cssW / WORLD_WIDTH, cssH / WORLD_HEIGHT);
    }
    const gl = this.renderer.getGL();

    this.bloom = new BloomPass(gl);
    this.bloom.threshold = BLOOM_THRESHOLD;
    this.bloom.intensity = BLOOM_INTENSITY;
    this.bloom.blurPasses = this.mobile ? 2 : BLOOM_BLUR_PASSES;
    this.bloom.blurRadius = BLOOM_BLUR_RADIUS;

    this.grid = new SpringMassGrid(gl, this.mobile);
    this.trails = new TrailSystem();
    this.camera = new Camera(this.renderer.width, this.renderer.height);
    this.camera.fixedView = !this.mobile;
    this.camera.clampToArena = !this.mobile;
    this.input = new Input(gameCanvas);
    this.input.setCamera(this.camera);
    this.input.setZoom(this.renderer.zoom);
    this.audio = new AudioManager();
    this.player = new Player(this.input);
    this.bullets = new BulletPool();
    this.explosions = new ExplosionPool();
    this.aimIndicator = new AimIndicator();
    this.hud = new HUD(hudCanvas);
    this.joystickRenderer = new VirtualJoystickRenderer(hudCanvas);
    this.waveManager = new WaveManager();
    this.starfield = new Starfield(80, WORLD_WIDTH, WORLD_HEIGHT);
    this.haptics = new HapticsManager();

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
    if (!this.mobile) showDesktopSettings();
  }

  private resize(): void {
    {
      const cssW = this.gameCanvas.clientWidth;
      const cssH = this.gameCanvas.clientHeight;
      this.renderer.zoom = this.mobile
        ? Math.max(cssW / WORLD_WIDTH, cssH / WORLD_HEIGHT)
        : Math.min(cssW / WORLD_WIDTH, cssH / WORLD_HEIGHT);
    }
    this.renderer.resize();
    this.camera.resize(this.renderer.width, this.renderer.height);
    this.bloom.resize(this.renderer.canvasWidth, this.renderer.canvasHeight);
    this.hud.resize();
    this.input.updateCanvasSize(this.gameCanvas.clientWidth);
    this.input.setZoom(this.renderer.zoom);
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

    if (this.state === 'menu') {
      if (this.mobile && !document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
      this.startGame();
    } else if (this.state === 'gameover' && this.gameOverTime >= 1) {
      if (this.mobile && !document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
      this.startGame();
    }
    // death_slowmo: ignore interactions
  }

  private startGame(): void {
    this.state = 'playing';
    if (!this.mobile) hideDesktopSettings();
    this.player.reset();
    this.bullets.clear();
    this.enemies = [];
    this.pendingSpawns = [];
    this.explosions.clear();
    this.trails.clear();
    this.grid.clear();
    this.bulletTrailIds.clear();
    this.waveManager.reset();
    this.player.lives = gameSettings.startingLives;
    this.waveManager.spawnRateMultiplier = gameSettings.spawnRateMultiplier;
    if (gameSettings.startingPhase !== 'tutorial') {
      this.waveManager.jumpToPhase(gameSettings.startingPhase);
      this.gameTime = (DIFFICULTY_PHASES as Record<string, { start: number; end: number }>)[gameSettings.startingPhase]?.start ?? 0;
    } else {
      this.gameTime = 0;
    }
    this.applyVisualSettings();
    this.camera.snapTo(this.player.position);
    this.hud.clear();

    // Reset aim angle
    this.input.setAimAngle(0);

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

    // Boost for enemy count
    const enemyBoost = Math.min(this.enemies.length / 40, 0.3);
    return Math.min(base + enemyBoost, 1);
  }

  private updateGravityWells(): void {
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e instanceof BlackHole) {
        const mass = -(gameSettings.bhGridMassBase + e.absorbedCount * gameSettings.bhGridMassPerAbsorb);
        this.grid.applyGravityWell(e.position.x, e.position.y, mass, BlackHole.ATTRACT_RADIUS * gameSettings.bhGridRadiusMultiplier);
      }
    }
  }

  /** Apply BlackHole gravitational attraction to nearby enemies + absorb on contact */
  private applyBlackHoleAttraction(dt: number): void {
    const blackholes: BlackHole[] = [];
    for (const e of this.enemies) {
      if (e.active && !e.isSpawning && e instanceof BlackHole) {
        blackholes.push(e);
      }
    }
    if (blackholes.length === 0) return;

    for (const bh of blackholes) {
      const attractR2 = BlackHole.ATTRACT_RADIUS * BlackHole.ATTRACT_RADIUS;
      const absorbR2 = (bh.collisionRadius + 10) * (bh.collisionRadius + 10);

      for (const e of this.enemies) {
        if (!e.active || e.isSpawning || e === bh || e instanceof BlackHole) continue;

        const dx = bh.position.x - e.position.x;
        const dy = bh.position.y - e.position.y;
        const dist2 = dx * dx + dy * dy;

        // Absorb enemies that get too close
        if (dist2 < absorbR2 && bh.absorbedCount < BlackHole.MAX_ABSORB) {
          e.active = false;
          bh.absorbEnemy();
          if (e.trailId >= 0) this.trails.unregister(e.trailId);
          this.explosions.spawn(e.position.x, e.position.y, e.color, 15, 0.6);
          this.grid.applyImpulse(e.position.x, e.position.y, -20, 120);
          this.haptics.absorb();

          // Auto-explode on overload
          if (bh.overloaded) {
            bh.active = false;
            const absorbed = bh.absorbedCount;
            // Spawn circles radially
            for (let ci = 0; ci < absorbed; ci++) {
              const angle = (ci / absorbed) * Math.PI * 2;
              const dist = 50 + Math.random() * 40;
              const cPos = new Vec2(
                bh.position.x + Math.cos(angle) * dist,
                bh.position.y + Math.sin(angle) * dist,
              );
              const ce = createEnemy('circle', cPos);
              ce.trailId = this.trails.register(ce.color, this.trailLenEnemy);
              this.enemies.push(ce);
            }
            // Massive explosion
            this.explosions.spawn(
              bh.position.x, bh.position.y, bh.color,
              this.mobile ? 100 : 200,
              EXPLOSION_DURATION_LARGE,
            );
            // White flash particles
            this.explosions.spawn(
              bh.position.x, bh.position.y, [1, 1, 1],
              this.mobile ? 40 : 80,
              EXPLOSION_DURATION_LARGE * 0.6,
            );
            this.grid.applyImpulse(bh.position.x, bh.position.y, 1200, 400);
            this.camera.shake(SCREEN_SHAKE_DEATH);
            this.audio.playBlackHoleDeath(absorbed);
            this.player.score += bh.scoreValue;
            this.player.enemiesKilled++;
            if (bh.trailId >= 0) this.trails.unregister(bh.trailId);
            this.haptics.heavy();
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
    }
  }

  /** Pull player toward active BlackHoles */
  private applyBlackHolePlayerPull(dt: number): void {
    const hw = WORLD_WIDTH / 2;
    const hh = WORLD_HEIGHT / 2;
    for (const e of this.enemies) {
      if (!e.active || e.isSpawning || !(e instanceof BlackHole)) continue;
      const dx = e.position.x - this.player.position.x;
      const dy = e.position.y - this.player.position.y;
      const dist2 = dx * dx + dy * dy;
      const attractR = BlackHole.ATTRACT_RADIUS;
      if (dist2 < attractR * attractR && dist2 > 1) {
        const dist = Math.sqrt(dist2);
        const force = gameSettings.bhPlayerPull * (1 + e.absorbedCount * 0.08) * dt / dist;
        this.player.position.x += dx / dist * force;
        this.player.position.y += dy / dist * force;
      }
    }
    // Re-clamp player to world bounds
    if (this.player.position.x < -hw) this.player.position.x = -hw;
    if (this.player.position.x > hw) this.player.position.x = hw;
    if (this.player.position.y < -hh) this.player.position.y = -hh;
    if (this.player.position.y > hh) this.player.position.y = hh;
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

    // Gravity: big enemies pull smaller ones slowly during game over
    for (const e of this.enemies) {
      if (!e.active) continue;
      for (const o of this.enemies) {
        if (o === e || !o.active || !(o instanceof BlackHole)) continue;
        const dx = o.position.x - e.position.x;
        const dy = o.position.y - e.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10 && dist < 200) {
          const pull = 0.02 * dt / dist;
          e.position.x += dx * pull;
          e.position.y += dy * pull;
        }
      }
    }

    // Update gravity wells for grid warping
    this.updateGravityWells();
  }

  update(dt: number): void {
    this.totalTime += dt / 1000;
    this.hud.updateFps(dt);

    this.camera.updateShake(dt);

    // Update touch mode on HUD
    this.hud.setTouchMode(this.input.mode === 'touch');

    if (this.state === 'gameover') {
      this.grid.update(dt);
      this.updateGameOver(dt);
      return;
    }

    if (this.state === 'death_slowmo') {
      this.updateDeathSlowmo(dt);
      return;
    }

    if (this.state !== 'playing') {
      this.grid.update(dt);
      return;
    }

    if (this.input.isKeyDown('Escape')) {
      this.player.lives = 0;
      this.onPlayerDeath();
      return;
    }

    this.gameTime += dt / 1000;

    // Player
    this.player.update(dt);
    this.applyBlackHolePlayerPull(dt);

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

    // BlackHole attraction — pull nearby non-blackhole enemies toward black holes
    this.applyBlackHoleAttraction(dt);

    // Enemies
    for (const e of this.enemies) {
      if (!e.active) continue;
      // Decrement spawn timer
      if (e.isSpawning) {
        e.spawnTimer = Math.max(0, e.spawnTimer - dt / 1000);
        if (e.trailId >= 0) this.trails.update(e.trailId, e.position.x, e.position.y);
        continue; // skip movement/AI during spawn
      }
      (e as { update(dt: number, playerPos?: Vec2): void }).update(dt, this.player.position);
      // Update enemy trails
      if (e.trailId >= 0) {
        this.trails.update(e.trailId, e.position.x, e.position.y);
      }
    }

    // Spawn
    const spawns = this.waveManager.update(dt, this.player.position);
    for (const req of spawns) {
      if (this.enemies.length >= gameSettings.maxEnemies) continue;
      const enemy = createEnemy(req.type, req.position);
      // If ambush spawn, use longer spawn animation
      if (req.isAmbush) { enemy.spawnDuration = enemy.spawnTimer = SPAWN_DURATION_AMBUSH; }
      // Push enemies that spawn too close to the player to the edge
      const dx = enemy.position.x - this.player.position.x;
      const dy = enemy.position.y - this.player.position.y;
      if (dx * dx + dy * dy < MIN_SPAWN_DISTANCE * MIN_SPAWN_DISTANCE) {
        enemy.spawnAtEdge();
      }
      // Register trail for enemy
      enemy.trailId = this.trails.register(enemy.color, this.trailLenEnemy);
      this.enemies.push(enemy);
      // Grid ripple on spawn
      this.grid.applyImpulse(enemy.position.x, enemy.position.y, 80, 120);
      // Play spawn SFX for specific enemy types
      this.playEnemySpawnSFX(req.type);
      this.haptics.medium();
    }

    // Collision
    const result = checkCollisions(
      this.player,
      this.bullets.bullets,
      this.enemies,
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
      this.grid.applyImpulse(kill.position.x, kill.position.y, 400, 200);

      // Screen shake on enemy kill
      this.camera.shake(SCREEN_SHAKE_SMALL);

      // BlackHole death: scaled explosion + dramatic procedural SFX
      if (kill.enemy instanceof BlackHole) {
        const absorbed = (kill.enemy as BlackHole).absorbedCount;
        this.audio.playBlackHoleDeath(absorbed);
        if (absorbed > 0) {
          this.explosions.spawn(
            kill.position.x, kill.position.y, kill.color,
            this.mobile ? Math.floor(absorbed * 8) : absorbed * 15,
            EXPLOSION_DURATION_LARGE * 0.8,
          );
          this.grid.applyImpulse(kill.position.x, kill.position.y, 600 + absorbed * 50, 300);
          this.camera.shake(SCREEN_SHAKE_LARGE);
        }
        this.haptics.heavy();
      } else {
        this.audio.playSFX('crash');
        this.haptics.light();
      }

      // Unregister trail
      if (kill.enemy.trailId >= 0) {
        this.trails.unregister(kill.enemy.trailId);
      }

      // Spawn children
      const deathResult = kill.enemy.onDeath();
      if (deathResult.spawnEnemies) {
        if (deathResult.staggeredSpawn) {
          // Theatrical staggered spawn — buildup shockwave then release one by one
          const origin = kill.position.clone();
          // Initial implosion flash
          this.explosions.spawn(
            origin.x, origin.y, kill.color,
            this.mobile ? 30 : 60, 0.6,
          );
          this.camera.shake(SCREEN_SHAKE_LARGE);
          // Queue each child with increasing delay
          for (let i = 0; i < deathResult.spawnEnemies.length; i++) {
            const child = deathResult.spawnEnemies[i];
            this.pendingSpawns.push({
              type: child.type,
              position: child.position.clone(),
              delay: 300 + i * 120, // stagger: 300ms pause then 120ms between each
              origin,
            });
          }
        } else {
          for (const child of deathResult.spawnEnemies) {
            const ce = createEnemy(child.type, child.position);
            ce.trailId = this.trails.register(ce.color, this.trailLenEnemy);
            this.enemies.push(ce);
          }
        }
      }
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

    // Process staggered spawn queue (theatrical enemy deaths)
    for (const ps of this.pendingSpawns) {
      ps.delay -= dt;
      if (ps.delay <= 0) {
        const ce = createEnemy(ps.type, ps.position);
        ce.trailId = this.trails.register(ce.color, this.trailLenEnemy);
        this.enemies.push(ce);
        // Mini flash per spawn
        this.explosions.spawn(ps.position.x, ps.position.y, [1, 0.6, 0.2], 12, 0.3);
        this.grid.applyImpulse(ps.position.x, ps.position.y, 200, 150);
        this.haptics.light();
      }
    }
    // Emit a pulsing warning ring at the origin while spawns are pending
    if (this.pendingSpawns.length > 0) {
      const origin = this.pendingSpawns[0].origin;
      this.grid.applyImpulse(origin.x, origin.y, 120, 200);
    }
    this.pendingSpawns = this.pendingSpawns.filter(ps => ps.delay > 0);

    // Clean up inactive enemies
    this.enemies = this.enemies.filter(e => {
      if (!e.active && e.trailId >= 0) {
        this.trails.unregister(e.trailId);
      }
      return e.active;
    });

    // Explosions
    this.explosions.update(dt);

    // Update gravity wells for grid warping during gameplay
    this.updateGravityWells();

    // Grid micro-forces from moving enemies
    for (const e of this.enemies) {
      if (!e.active || e.isSpawning) continue;
      const speed = e.velocity.magnitude();
      if (speed > 0.01) {
        this.grid.applyImpulse(e.position.x, e.position.y, speed * 2, 80);
      }
    }

    // Player wake on grid
    const pSpeed = this.player.velocity.magnitude();
    if (pSpeed > 0.01) {
      this.grid.applyImpulse(this.player.position.x, this.player.position.y, pSpeed * 3, 60);
    }

    // Bullet grid ripples (very subtle)
    for (const b of this.bullets.bullets) {
      if (!b.active) continue;
      this.grid.applyImpulse(b.position.x, b.position.y, 0.5, 40);
    }

    // Run spring-mass physics
    this.grid.update(dt);

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
      case 'blackhole': this.audio.playSFX('deathstar'); break;
      case 'sierpinski': this.audio.playSFX('octagon'); break;
    }
  }

  private onPlayerDeath(): void {
    // Reuse the death slowmo shockwave animation for game over
    this.state = 'death_slowmo';
    this.slowmoTimer = 0;
    this.slowmoShockwaveRadius = 0;
    this.slowmoOrigin = this.player.position.clone();
    this.slowmoIsFinal = true; // flag: transitions to gameover, not respawn
    this.player.active = false;

    const px = this.player.position.x;
    const py = this.player.position.y;

    // Primary death explosion — massive
    this.explosions.spawn(
      px, py,
      [1, 1, 0.78],
      this.mobile ? Math.floor(EXPLOSION_PARTICLE_COUNT_DEATH * 0.5) : EXPLOSION_PARTICLE_COUNT_DEATH,
      EXPLOSION_DURATION_DEATH,
      0.2,
    );
    // Secondary colored explosion ring
    this.explosions.spawn(
      px, py,
      [1, 0.4, 0.1],
      this.mobile ? 30 : 60,
      EXPLOSION_DURATION_DEATH * 0.7,
      0.35,
    );

    // Massive grid shockwave
    this.grid.applyImpulse(px, py, 1600, 500);
    this.camera.shake(SCREEN_SHAKE_DEATH, 0.8);

    // Clean up bullet trails
    for (const [, tid] of this.bulletTrailIds) {
      this.trails.unregister(tid);
    }
    this.bulletTrailIds.clear();
    this.bullets.clear();

    this.audio.playSFX('die');
    this.audio.stopMusic();
    this.haptics.death();
  }

  private onPlayerRespawn(): void {
    // Enter death slowmo — time slows, shockwave expands, enemies explode on contact
    this.state = 'death_slowmo';
    this.slowmoTimer = 0;
    this.slowmoShockwaveRadius = 0;
    this.slowmoOrigin = this.player.position.clone();
    this.slowmoIsFinal = false;
    this.player.active = false;

    // Initial hit explosion
    this.explosions.spawn(
      this.player.position.x, this.player.position.y,
      [1, 1, 0.78],
      EXPLOSION_PARTICLE_COUNT_LARGE,
      EXPLOSION_DURATION_DEFAULT,
    );
    this.grid.applyImpulse(this.player.position.x, this.player.position.y, 1200, 400);
    this.camera.shake(SCREEN_SHAKE_LARGE, 0.5);

    // Clean up bullet trails
    for (const [, tid] of this.bulletTrailIds) {
      this.trails.unregister(tid);
    }
    this.bulletTrailIds.clear();
    this.bullets.clear();

    this.audio.playSFX('die1');
    this.haptics.respawn();
    if (this.player.lives === 1) this.haptics.warning();
  }

  private updateDeathSlowmo(dt: number): void {
    this.slowmoTimer += dt;

    // Scale game time very slowly during slowmo
    const gameDt = dt * DEATH_SLOWMO_TIME_SCALE;

    // Expand shockwave
    this.slowmoShockwaveRadius += DEATH_SLOWMO_SHOCKWAVE_SPEED * dt;

    // Kill enemies caught by shockwave with spectacular explosions
    for (const e of this.enemies) {
      if (!e.active) continue;
      const dx = e.position.x - this.slowmoOrigin.x;
      const dy = e.position.y - this.slowmoOrigin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.slowmoShockwaveRadius) {
        e.active = false;
        // Spectacular explosion per enemy
        this.explosions.spawn(
          e.position.x, e.position.y, e.color,
          this.mobile ? 40 : 80,
          EXPLOSION_DURATION_LARGE * 0.6,
        );
        this.grid.applyImpulse(e.position.x, e.position.y, 400, 200);
        this.camera.shake(SCREEN_SHAKE_SMALL * 0.5, 0.1);
        this.audio.playSFX('crash');
        if (e.trailId >= 0) this.trails.unregister(e.trailId);
      }
    }

    // Update explosions (at slowed rate)
    this.explosions.update(gameDt);
    this.grid.update(gameDt);
    this.camera.updateShake(gameDt);

    // Gentle enemy movement during slowmo
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.rotation += gameDt * 0.002;
    }

    // Pulsing shockwave ring on grid
    this.grid.applyImpulse(
      this.slowmoOrigin.x, this.slowmoOrigin.y,
      120, this.slowmoShockwaveRadius,
    );

    // Clean up dead enemies
    this.enemies = this.enemies.filter(e => {
      if (!e.active && e.trailId >= 0) {
        this.trails.unregister(e.trailId);
      }
      return e.active;
    });

    // End slowmo
    if (this.slowmoTimer >= DEATH_SLOWMO_DURATION) {
      if (this.slowmoIsFinal) {
        // Transition to game over screen
        this.state = 'gameover';
        this.gameOverTime = 0;
        this.hud.drawGameOver(this.player.score, this.player.enemiesKilled, this.gameTime);
        if (!this.mobile) showDesktopSettings();
      } else {
        // Respawn and continue playing
        this.state = 'playing';
        for (const e of this.enemies) {
          if (e.trailId >= 0) this.trails.unregister(e.trailId);
        }
        this.enemies = [];
        this.pendingSpawns = [];
        this.player.respawn();
        this.player.active = true;
        this.camera.snapTo(this.player.position);
      }
    }
  }

  render(): void {
    // Use shake-offset camera for rendering
    const cameraX = this.camera.renderX;
    const cameraY = this.camera.renderY;
    this.renderer.cameraX = cameraX;
    this.renderer.cameraY = cameraY;

    // Feed shake + time into bloom composite for chromatic aberration + warp
    this.bloom.shakeIntensity = this.camera.shakeNormalized;
    this.bloom.time = this.totalTime;

    // --- Render to bloom scene FBO ---
    this.bloom.bindSceneFBO();

    // 1. Grid (renders directly with its own shader)
    this.grid.render(cameraX, cameraY, this.renderer.width, this.renderer.height);

    // 2. Starfield (faint background dots, before entities)
    this.renderer.begin(false);
    this.starfield.render(this.renderer, cameraX, cameraY);
    this.renderer.end();

    // 3. Arena border + Entities — NORMAL blend
    this.renderer.begin(false);
    this.renderArenaBorder();

    if (this.state === 'playing' || this.state === 'death_slowmo') {
      for (const e of this.enemies) e.render(this.renderer);
      if (this.state === 'playing') {
        this.bullets.render(this.renderer);
        this.player.render(this.renderer);
        // Aim chevron orbiting player (desktop + mobile)
        this.aimIndicator.render(
          this.renderer,
          this.player.position.x,
          this.player.position.y,
          this.player.aimAngle,
        );
      }

      // Shockwave ring during death slowmo
      if (this.state === 'death_slowmo') {
        const pulse = 0.7 + 0.3 * Math.sin(this.slowmoTimer * 0.01);
        this.renderer.drawCircle(
          this.slowmoOrigin.x, this.slowmoOrigin.y,
          this.slowmoShockwaveRadius,
          [1.0 * pulse, 0.8 * pulse, 0.3 * pulse],
          48,
          0.6 * (1 - this.slowmoTimer / DEATH_SLOWMO_DURATION),
        );
      }

      // Off-screen indicators
      renderOffscreenIndicators(this.renderer, this.camera, this.enemies);
    }

    // Game over: render frozen enemies with unique glow effects
    if (this.state === 'gameover') {
      const t = this.gameOverTime;
      for (const e of this.enemies) e.renderGlow(this.renderer, t);
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
    if (this.state === 'playing' || this.state === 'death_slowmo') {
      this.hud.drawPlaying(this.player.score, this.player.lives, this.audio.muted, this.enemies.length);

      // Virtual joysticks (drawn on HUD canvas, not during slowmo)
      if (this.state === 'playing') {
        this.joystickRenderer.render(this.input);
      }
    }
  }

  /** Render the arena border — solid neon lines at world edges */
  private renderArenaBorder(): void {
    const hw = WORLD_WIDTH / 2;
    const hh = WORLD_HEIGHT / 2;
    const [br, bg, bb] = ARENA_BORDER_COLOR;
    const [cr, cg, cb] = ARENA_BORDER_CORNER_COLOR;
    const a = ARENA_BORDER_ALPHA;

    // Main border lines
    this.renderer.drawLine(-hw, -hh, hw, -hh, br, bg, bb, a); // bottom
    this.renderer.drawLine(hw, -hh, hw, hh, br, bg, bb, a);   // right
    this.renderer.drawLine(hw, hh, -hw, hh, br, bg, bb, a);   // top
    this.renderer.drawLine(-hw, hh, -hw, -hh, br, bg, bb, a); // left

    // Inner glow line (slightly inset, dimmer)
    const inset = 3;
    const ga = a * 0.4;
    this.renderer.drawLine(-hw + inset, -hh + inset, hw - inset, -hh + inset, br, bg, bb, ga);
    this.renderer.drawLine(hw - inset, -hh + inset, hw - inset, hh - inset, br, bg, bb, ga);
    this.renderer.drawLine(hw - inset, hh - inset, -hw + inset, hh - inset, br, bg, bb, ga);
    this.renderer.drawLine(-hw + inset, hh - inset, -hw + inset, -hh + inset, br, bg, bb, ga);

    // Corner accents — brighter L-shapes at each corner
    const cornerLen = 80;
    const ca = a * 1.0;
    // Bottom-left
    this.renderer.drawLine(-hw, -hh, -hw + cornerLen, -hh, cr, cg, cb, ca);
    this.renderer.drawLine(-hw, -hh, -hw, -hh + cornerLen, cr, cg, cb, ca);
    // Bottom-right
    this.renderer.drawLine(hw, -hh, hw - cornerLen, -hh, cr, cg, cb, ca);
    this.renderer.drawLine(hw, -hh, hw, -hh + cornerLen, cr, cg, cb, ca);
    // Top-right
    this.renderer.drawLine(hw, hh, hw - cornerLen, hh, cr, cg, cb, ca);
    this.renderer.drawLine(hw, hh, hw, hh - cornerLen, cr, cg, cb, ca);
    // Top-left
    this.renderer.drawLine(-hw, hh, -hw + cornerLen, hh, cr, cg, cb, ca);
    this.renderer.drawLine(-hw, hh, -hw, hh - cornerLen, cr, cg, cb, ca);
  }

  /** Called when tab is hidden */
  onPause(): void {
    // Nothing special needed — game loop already stops
  }

  /** Called when tab is visible again */
  onResume(): void {
    this.audio.resume();
  }

  /** Called when device rotates to portrait */
  onOrientationPause(): void {
    // Game loop stops via index.ts — game state stays intact
  }

  /** Called when device rotates back to landscape */
  onOrientationResume(): void {
    this.audio.resume().catch(() => {});
    this.resize();
    this.applyVisualSettings();
  }

  private applyVisualSettings(): void {
    this.bloom.intensity = gameSettings.bloomIntensity;
    this.trailLenEnemy = this.mobile
      ? Math.min(gameSettings.trailLength, MOBILE_TRAIL_LENGTH_ENEMY)
      : gameSettings.trailLength;
    this.trailLenBullet = this.mobile
      ? MOBILE_TRAIL_LENGTH_BULLET
      : Math.min(gameSettings.trailLength, TRAIL_LENGTH_BULLET);
  }
}
