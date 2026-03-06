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
import { DeathStar } from './entities/enemies/deathstar';
import { ExplosionPool } from './entities/explosion';
// Crosshair removed — desktop uses pointer-lock rotational aim
import { HUD } from './ui/hud';
import { VirtualJoystickRenderer } from './ui/virtual-joystick';
import { renderOffscreenIndicators } from './ui/offscreen-indicators';
import { WaveManager } from './spawner/wave-manager';
import { Starfield } from './renderer/starfield';
import { checkCollisions, applyDeathStarAttraction } from './core/collision';
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
  HYPERBOLICDISC_WARP_RADIUS,
  HYPERBOLICDISC_WARP_FORCE,
  ARENA_BORDER_COLOR,
  ARENA_BORDER_CORNER_COLOR,
  ARENA_BORDER_ALPHA,
  DEATH_SLOWMO_DURATION,
  DEATH_SLOWMO_TIME_SCALE,
  DEATH_SLOWMO_SHOCKWAVE_SPEED,
} from './config';

// Enemy factory imports
import { Rhombus } from './entities/enemies/rhombus';
import { Pinwheel } from './entities/enemies/pinwheel';
import { Square, Square2 } from './entities/enemies/square';
import { CircleEnemy } from './entities/enemies/circle';
import { Triangle } from './entities/enemies/triangle';
import { Octagon } from './entities/enemies/octagon';
import { BlackHole } from './entities/enemies/blackhole';
// --- New fractal/topology enemies ---
import { FibSpiral } from './entities/enemies/fibspiral';
import { Mobius } from './entities/enemies/mobius';
import { Koch } from './entities/enemies/koch';
import { Penrose } from './entities/enemies/penrose';
import { Shard } from './entities/enemies/shard';
import { Sierpinski } from './entities/enemies/sierpinski';
import { MengerDust } from './entities/enemies/mengerdust';
import { HyperbolicDisc } from './entities/enemies/hyperbolicdisc';
import { Tesseract } from './entities/enemies/tesseract';
import { Mandelbrot } from './entities/enemies/mandelbrot';
import { MiniMandel } from './entities/enemies/minimandel';
import { Klein } from './entities/enemies/klein';

type GameState = 'menu' | 'playing' | 'death_slowmo' | 'gameover';

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
    case 'blackhole': e = new BlackHole(); break;
    // --- New fractal/topology enemies ---
    case 'fibspiral': e = new FibSpiral(); break;
    case 'mobius': e = new Mobius(); break;
    case 'koch': e = new Koch(); break;
    case 'penrose': e = new Penrose(); break;
    case 'shard': e = new Shard(pos); return e;
    case 'sierpinski': e = new Sierpinski(); break;
    case 'mengerdust': e = new MengerDust(); break;
    case 'hyperbolicdisc': e = new HyperbolicDisc(); break;
    case 'tesseract': e = new Tesseract(); break;
    case 'mandelbrot': e = new Mandelbrot(); break;
    case 'minimandel': { const m = new MiniMandel(pos); return m; }
    case 'klein': e = new Klein(); break;
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
  private grid: SpringMassGrid;
  private trails: TrailSystem;
  private camera: Camera;
  private input: Input;
  private audio: AudioManager;
  private player: Player;
  private bullets: BulletPool;
  private enemies: Enemy[] = [];
  private deathstars: DeathStar[] = [];
  private explosions: ExplosionPool;
  // crosshair removed — desktop uses pointer-lock rotational aim
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

  // Staggered spawn queue for theatrical enemy deaths (e.g. Octagon)
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
    this.input = new Input(gameCanvas);
    this.input.setCamera(this.camera);
    this.audio = new AudioManager();
    this.player = new Player(this.input);
    this.bullets = new BulletPool();
    this.explosions = new ExplosionPool();
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
    this.player.reset();
    this.bullets.clear();
    this.enemies = [];
    this.deathstars = [];
    this.pendingSpawns = [];
    this.explosions.clear();
    this.trails.clear();
    this.grid.clear();
    this.bulletTrailIds.clear();
    this.waveManager.reset();
    this.gameTime = 0;
    this.camera.snapTo(this.player.position);
    this.hud.clear();

    // Reset aim angle and request pointer lock on desktop
    this.input.setAimAngle(0);
    if (!this.mobile) {
      this.input.requestPointerLock();
    }

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

  /** Apply gravity wells on the grid from large enemies (Octagon, DeathStar) */
  private updateGravityWells(): void {
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e instanceof Octagon) {
        this.grid.applyGravityWell(e.position.x, e.position.y, -30, 280);
      } else if (e instanceof BlackHole) {
        const mass = -(45 + e.absorbedCount * 10);
        this.grid.applyGravityWell(e.position.x, e.position.y, mass, BlackHole.ATTRACT_RADIUS * 1.3);
      } else if (e instanceof HyperbolicDisc) {
        this.grid.applyGravityWell(e.position.x, e.position.y, -24, HYPERBOLICDISC_WARP_RADIUS);
      }
    }
    for (const ds of this.deathstars) {
      if (!ds.active) continue;
      this.grid.applyGravityWell(ds.position.x, ds.position.y, -55, 400);
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
      // Pulled by Octagons and BlackHoles
      for (const o of this.enemies) {
        if (o === e || !o.active || (!(o instanceof Octagon) && !(o instanceof BlackHole))) continue;
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
    const spawns = this.waveManager.update(dt, this.player.position);
    for (const req of spawns) {
      if (req.type === 'deathstar') {
        this.deathstars.push(new DeathStar(this.player.position));
        this.audio.playSFX('deathstar');
        this.haptics.bossSpawn();
      } else {
        const enemy = createEnemy(req.type, req.position);
        // If ambush spawn, use longer spawn animation
        if (req.isAmbush) enemy.spawnTimer = 0.8;
        // Register trail for enemy
        enemy.trailId = this.trails.register(enemy.color, this.trailLenEnemy);
        this.enemies.push(enemy);
        // Grid ripple on spawn
        this.grid.applyImpulse(enemy.position.x, enemy.position.y, 80, 120);
        // Play spawn SFX for specific enemy types
        this.playEnemySpawnSFX(req.type);
        this.haptics.medium();
      }
    }

    // HyperbolicDisc bullet warping — bend bullets toward disc centers
    const warpR2 = HYPERBOLICDISC_WARP_RADIUS * HYPERBOLICDISC_WARP_RADIUS;
    for (const b of this.bullets.bullets) {
      if (!b.active) continue;
      for (const e of this.enemies) {
        if (!e.active || e.isSpawning || !(e instanceof HyperbolicDisc)) continue;
        const dx = e.position.x - b.position.x;
        const dy = e.position.y - b.position.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < warpR2 && dist2 > 1) {
          const dist = Math.sqrt(dist2);
          const force = HYPERBOLICDISC_WARP_FORCE * dt / dist;
          b.velocity.x += dx / dist * force;
          b.velocity.y += dy / dist * force;
        }
      }
    }

    // Koch ice trail — slow player when touching
    for (const e of this.enemies) {
      if (!e.active || !(e instanceof Koch)) continue;
      const koch = e as Koch;
      for (const seg of koch.iceTrail) {
        const dx = this.player.position.x - seg.x;
        const dy = this.player.position.y - seg.y;
        if (dx * dx + dy * dy < Koch.SLOW_RADIUS * Koch.SLOW_RADIUS) {
          this.player.applySlow(Koch.SLOW_FACTOR, Koch.SLOW_DURATION);
          break; // only need to trigger once per frame
        }
      }
    }

    // Mandelbrot minion spawning
    for (const e of this.enemies) {
      if (!e.active || !(e instanceof Mandelbrot)) continue;
      const mb = e as Mandelbrot;
      while (mb.pendingMinions.length > 0) {
        const pos = mb.pendingMinions.shift()!;
        const minion = createEnemy('minimandel', pos) as MiniMandel;
        minion.parent = mb;
        minion.trailId = this.trails.register(minion.color, this.trailLenEnemy);
        this.enemies.push(minion);
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
      this.grid.applyImpulse(kill.position.x, kill.position.y, 400, 200);

      // Screen shake on enemy kill
      this.camera.shake(SCREEN_SHAKE_SMALL);

      this.audio.playSFX('crash');
      this.haptics.light();

      // Unregister trail
      if (kill.enemy.trailId >= 0) {
        this.trails.unregister(kill.enemy.trailId);
      }

      // Notify Mandelbrot parent if a MiniMandel died
      if (kill.enemy instanceof MiniMandel && (kill.enemy as MiniMandel).parent) {
        (kill.enemy as MiniMandel).parent!.onMinionDeath();
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

    // Process deathstar kills
    for (const kill of result.killedDeathStars) {
      this.explosions.spawn(
        kill.position.x, kill.position.y,
        [0.92, 0.38, 0.24],
        this.mobile ? Math.floor(EXPLOSION_PARTICLE_COUNT_LARGE * 0.5) : EXPLOSION_PARTICLE_COUNT_LARGE,
        EXPLOSION_DURATION_LARGE,
      );
      this.grid.applyImpulse(kill.position.x, kill.position.y, 800, 350);
      this.camera.shake(SCREEN_SHAKE_LARGE);
      this.audio.playSFX('deathstar2');
      this.haptics.heavy();
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
      this.haptics.absorb();
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

    // Process staggered spawn queue (theatrical Octagon death etc.)
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
    this.deathstars = this.deathstars.filter(d => d.active);

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
      case 'octagon': this.audio.playSFX('octagon'); break;
      case 'blackhole': this.audio.playSFX('deathstar'); break;
      // New enemies — reuse existing SFX
      case 'sierpinski': case 'koch': case 'mengerdust':
        this.audio.playSFX('octagon'); break;
      case 'mobius': case 'fibspiral': case 'penrose': case 'klein':
        this.audio.playSFX('rhombus'); break;
      case 'tesseract': case 'hyperbolicdisc': case 'mandelbrot':
        this.audio.playSFX('deathstar'); break;
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
    if (!this.mobile) this.input.releasePointerLock();
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

    // Kill deathstars caught by shockwave
    for (const ds of this.deathstars) {
      if (!ds.active) continue;
      const dx = ds.position.x - this.slowmoOrigin.x;
      const dy = ds.position.y - this.slowmoOrigin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.slowmoShockwaveRadius) {
        ds.active = false;
        this.explosions.spawn(
          ds.position.x, ds.position.y,
          [0.92, 0.38, 0.24],
          this.mobile ? 60 : 120,
          EXPLOSION_DURATION_LARGE,
        );
        this.grid.applyImpulse(ds.position.x, ds.position.y, 800, 350);
        this.camera.shake(SCREEN_SHAKE_LARGE, 0.2);
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
    this.deathstars = this.deathstars.filter(d => d.active);

    // End slowmo
    if (this.slowmoTimer >= DEATH_SLOWMO_DURATION) {
      if (this.slowmoIsFinal) {
        // Transition to game over screen
        this.state = 'gameover';
        this.gameOverTime = 0;
        this.hud.drawGameOver(this.player.score, this.player.enemiesKilled, this.gameTime);
      } else {
        // Respawn and continue playing
        this.state = 'playing';
        for (const e of this.enemies) {
          if (e.trailId >= 0) this.trails.unregister(e.trailId);
        }
        this.enemies = [];
        this.deathstars = [];
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
      for (const ds of this.deathstars) ds.render(this.renderer);
      if (this.state === 'playing') {
        this.bullets.render(this.renderer);
        this.player.render(this.renderer);
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
  }
}
