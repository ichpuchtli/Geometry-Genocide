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
  TRAIL_LENGTH_ENEMY,
  TRAIL_LENGTH_BULLET,
  MOBILE_TRAIL_LENGTH_ENEMY,
  MOBILE_TRAIL_LENGTH_BULLET,
  BULLET_COLOR,
  DIFFICULTY_PHASES,
  SCREEN_SHAKE_SMALL,
  SCREEN_SHAKE_LARGE,
  SCREEN_SHAKE_DEATH,
  ARENA_BORDER_COLOR,
  ARENA_BORDER_CORNER_COLOR,
  ARENA_BORDER_ALPHA,
  DEATH_SLOWMO_DURATION,
  DEATH_SLOWMO_TIME_SCALE,
  DEATH_SLOWMO_SHOCKWAVE_SPEED,
  MIN_SPAWN_DISTANCE,
  SPAWN_DURATION_AMBUSH,
  HITSTOP_SQUARE,
  HITSTOP_SIERPINSKI,
  HITSTOP_BLACKHOLE,
  HITSTOP_MULTI,
  KILL_SIG_DURATION,
  KILL_SIG_RAY_COUNT,
  KILL_SIG_RAY_LENGTH,
  PHASE_BANNER_DURATION,
  PHASE_BORDER_PULSE_DURATION,
  PHASE_DISPLAY_NAMES,
  TELEGRAPH_DURATION,
  TELEGRAPH_COLOR,
  ELITE_MODIFIERS,
  MAX_CONCURRENT_ELITES,
  HITSTOP_ELITE,
  HEAT_DECAY_RATE,
  HEAT_KILL_BASE,
  HEAT_KILL_ELITE,
  HEAT_KILL_BLACKHOLE,
  HEAT_DENSE_COMBAT_BONUS,
  HEAT_PHASE_BUMP,
  HEAT_SURVIVAL_RATE,
  HEAT_BORDER_BRIGHTNESS_MAX,
  HEAT_BLOOM_BOOST_MAX,
  HEAT_GRID_TURBULENCE_MAX,
  RECOVERY_DURATION,
  RECOVERY_FIRE_RATE_MULT,
  RECOVERY_SHIELD_COLOR,
  RECOVERY_SHIELD_RADIUS,
  MINIBOSS_SPAWN_TIME,
  MINIBOSS_WARNING_DURATION,
  MINIBOSS_HITSTOP_STAGE,
  MINIBOSS_HITSTOP_DEATH,
  MINIBOSS_RESPAWN_DELAY,
  MINIBOSS_DEFEATED_BANNER_DURATION,
  MINIBOSS_SPAWN_SUPPRESS_MULT,
  MINIBOSS_HEAT_ON_DEATH,
} from './config';
import { FormationMeta } from './spawner/spawn-patterns';

// Enemy factory imports
import { Rhombus } from './entities/enemies/rhombus';
import { Pinwheel } from './entities/enemies/pinwheel';
import { Square, Square2 } from './entities/enemies/square';
import { CircleEnemy } from './entities/enemies/circle';
import { BlackHole } from './entities/enemies/blackhole';
import { Shard } from './entities/enemies/shard';
import { Sierpinski } from './entities/enemies/sierpinski';
import { Mandelbrot } from './entities/enemies/mandelbrot';
import { MiniMandel } from './entities/enemies/minimandel';
import { gameSettings } from './settings';
import { showDesktopSettings, hideDesktopSettings } from './ui/settings-panel';

type GameState = 'menu' | 'playing' | 'death_slowmo' | 'gameover';

interface KillEffect {
  x: number;
  y: number;
  color: [number, number, number];
  family: string;
  elapsed: number;
  duration: number;
  angles: number[]; // ray/spiral angles, randomized per kill
}

interface Telegraph {
  formation: string;
  side?: number;      // 0=top, 1=bottom, 2=left, 3=right
  center?: Vec2;
  elapsed: number;
  duration: number;
}

function createEnemy(type: string, pos?: Vec2, isElite = false): Enemy {
  let e: Enemy;
  switch (type) {
    case 'rhombus': e = new Rhombus(); break;
    case 'pinwheel': e = new Pinwheel(); break;
    case 'square': e = new Square(); break;
    case 'square2': e = new Square2(pos); e.speed *= gameSettings.enemySpeedMultiplier; return e;
    case 'circle': e = new CircleEnemy(pos); e.speed *= gameSettings.enemySpeedMultiplier; return e;
    case 'blackhole': e = new BlackHole(); break;
    case 'shard': e = new Shard(pos); e.speed *= gameSettings.enemySpeedMultiplier; return e;
    case 'sierpinski': e = new Sierpinski(); break;
    case 'mandelbrot': e = new Mandelbrot(); break;
    case 'minimandel': { const mm = new MiniMandel(pos); mm.speed *= gameSettings.enemySpeedMultiplier; return mm; }
    default: e = new Rhombus(); break;
  }
  e.baseType = type;
  if (!pos) {
    if (type === 'blackhole') {
      e.spawnAnywhere();
    } else {
      e.spawnAtEdge();
    }
  } else {
    e.position.copyFrom(pos);
  }
  e.speed *= gameSettings.enemySpeedMultiplier;

  // Apply elite modifiers
  if (isElite) {
    const mod = ELITE_MODIFIERS[type];
    if (mod) {
      e.isElite = true;
      e.speed *= mod.speedMult;
      e.scoreValue = Math.floor(e.scoreValue * mod.scoreMult);
      e.hp += mod.hpAdd;
      e.maxHp += mod.hpAdd;
      e.color = [
        Math.min(1, e.color[0] + mod.colorBright),
        Math.min(1, e.color[1] + mod.colorBright),
        Math.min(1, e.color[2] + mod.colorBright),
      ];
    }
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

  // Combat feedback: hitstop
  private hitstopTimer = 0;

  // Combat feedback: kill signature effects
  private killEffects: KillEffect[] = [];

  // Combat feedback: phase transition
  private phaseBannerTimer = 0;
  private phaseBannerName = '';
  private phaseBorderPulseTimer = 0;

  // Combat feedback: spawn telegraphs
  private telegraphs: Telegraph[] = [];

  // Heat system (0-1, presentation-first run intensity)
  private heat = 0;
  private timeSinceLastKill = 0; // seconds, for heat decay

  // Recovery window (post-respawn buff)
  private recoveryTimer = 0;     // ms remaining
  private recoveryActive = false;
  private recoveryExpirePlayed = false;

  // Miniboss encounter state
  private minibossActive = false;
  private minibossDefeated = false;
  private minibossWarningTimer = 0; // ms remaining in warning phase
  private minibossRef: Mandelbrot | null = null;
  private minibossDefeatedBannerTimer = 0;
  private minibossRespawnTimer = 0;   // ms until re-trigger after player death
  private savedSpawnRateMultiplier = 1.0;

  constructor(private gameCanvas: HTMLCanvasElement, hudCanvas: HTMLCanvasElement) {
    this.mobile = isMobile();
    this.trailLenEnemy = this.mobile ? MOBILE_TRAIL_LENGTH_ENEMY : TRAIL_LENGTH_ENEMY;
    this.trailLenBullet = this.mobile ? MOBILE_TRAIL_LENGTH_BULLET : TRAIL_LENGTH_BULLET;

    this.renderer = new Renderer(gameCanvas);
    {
      const cssW = gameCanvas.clientWidth;
      const cssH = gameCanvas.clientHeight;
      const aw = gameSettings.arenaWidth;
      const ah = gameSettings.arenaHeight;
      this.renderer.zoom = (this.mobile
        ? Math.max(cssW / aw, cssH / ah)
        : Math.min(cssW / aw, cssH / ah)) * gameSettings.zoomScale;
    }
    const gl = this.renderer.getGL();

    this.bloom = new BloomPass(gl);
    this.bloom.threshold = gameSettings.bloomThreshold;
    this.bloom.intensity = gameSettings.bloomIntensity;
    this.bloom.blurPasses = this.mobile ? 2 : gameSettings.bloomBlurPasses;
    this.bloom.blurRadius = gameSettings.bloomBlurRadius;

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
    this.waveManager.onPhaseChange = (newPhase: string) => {
      const displayName = PHASE_DISPLAY_NAMES[newPhase];
      if (displayName) {
        this.phaseBannerTimer = PHASE_BANNER_DURATION;
        this.phaseBannerName = displayName;
        this.phaseBorderPulseTimer = PHASE_BORDER_PULSE_DURATION;
        this.audio.playPhaseTransition();
        // Heat bump on phase transition
        this.heat = Math.min(1, this.heat + HEAT_PHASE_BUMP);
      }
    };
    this.starfield = new Starfield(80, gameSettings.arenaWidth, gameSettings.arenaHeight);
    this.haptics = new HapticsManager();

    // Click/touch to start + init audio
    // Use touchend for iOS Safari reliability (touchstart preventDefault in Input
    // suppresses synthetic click, and passive/non-passive conflicts cause issues)
    gameCanvas.addEventListener('click', () => this.onInteract());
    gameCanvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.onInteract();
    }, { passive: false });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        this.audio.toggleMute();
      }
      if (e.code === 'KeyF') {
        this.input.autoFire = !this.input.autoFire;
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
    // Show system cursor on menu
    gameCanvas.style.cursor = 'default';
  }

  private resize(): void {
    {
      const cssW = this.gameCanvas.clientWidth;
      const cssH = this.gameCanvas.clientHeight;
      const aw = gameSettings.arenaWidth;
      const ah = gameSettings.arenaHeight;
      this.renderer.zoom = (this.mobile
        ? Math.max(cssW / aw, cssH / ah)
        : Math.min(cssW / aw, cssH / ah)) * gameSettings.zoomScale;
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
    this.gameCanvas.style.cursor = 'none';
    if (!this.mobile) hideDesktopSettings();
    this.player.reset();
    this.bullets.clear();
    this.enemies = [];
    this.pendingSpawns = [];
    this.explosions.clear();
    this.trails.clear();
    this.bulletTrailIds.clear();
    this.waveManager.reset();
    this.hitstopTimer = 0;
    this.killEffects = [];
    this.phaseBannerTimer = 0;
    this.phaseBannerName = '';
    this.phaseBorderPulseTimer = 0;
    this.telegraphs = [];
    this.heat = 0;
    this.timeSinceLastKill = 0;
    this.recoveryTimer = 0;
    this.recoveryActive = false;
    this.recoveryExpirePlayed = false;
    this.minibossActive = false;
    this.minibossDefeated = false;
    this.minibossWarningTimer = 0;
    this.minibossRef = null;
    this.minibossDefeatedBannerTimer = 0;
    this.minibossRespawnTimer = 0;
    this.savedSpawnRateMultiplier = 1.0;
    this.player.lives = gameSettings.startingLives;
    this.waveManager.spawnRateMultiplier = gameSettings.spawnRateMultiplier;
    if (gameSettings.startingPhase !== 'tutorial') {
      this.waveManager.jumpToPhase(gameSettings.startingPhase);
      this.gameTime = (DIFFICULTY_PHASES as Record<string, { start: number; end: number }>)[gameSettings.startingPhase]?.start ?? 0;
    } else {
      this.gameTime = 0;
    }
    // Rebuild grid + starfield with current arena/grid settings
    this.grid.rebuild(gameSettings.arenaWidth, gameSettings.arenaHeight, gameSettings.gridSpacing);
    this.starfield = new Starfield(80, gameSettings.arenaWidth, gameSettings.arenaHeight);
    this.applyVisualSettings();
    // Recompute zoom and canvas resolution for new arena + resolution scale
    this.resize();
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

    // Temporary intensity bump during phase transition
    let phaseBump = 0;
    if (this.phaseBorderPulseTimer > 0) {
      phaseBump = 0.15 * (this.phaseBorderPulseTimer / PHASE_BORDER_PULSE_DURATION);
    }

    // Heat adds to music density
    const heatBoost = this.heat * 0.15;

    return Math.min(base + enemyBoost + phaseBump + heatBoost, 1);
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
    const hw = gameSettings.arenaWidth / 2;
    const hh = gameSettings.arenaHeight / 2;
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

    // Update combat feedback timers (always, even during hitstop)
    this.updateCombatFeedback(dt);

    // Hitstop: freeze gameplay, keep visuals alive
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      this.explosions.update(dt);
      this.updateGravityWells();
      this.grid.update(dt);
      this.audio.setMusicIntensity(this.computeIntensity());
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
      // Hard cap: max 4 BlackHoles active at once
      if (req.type === 'blackhole') {
        const bhCount = this.enemies.filter(e => e.active && e instanceof BlackHole).length;
        if (bhCount >= 4) continue;
      }
      // Enforce elite concurrent cap
      let elite = req.isElite ?? false;
      if (elite) {
        const eliteCount = this.enemies.filter(e => e.active && e.isElite).length;
        if (eliteCount >= MAX_CONCURRENT_ELITES) elite = false;
      }
      const enemy = createEnemy(req.type, req.position, elite);
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
      if (elite) this.audio.playEliteArrive();
      this.haptics.medium();
    }

    // Create telegraphs from formation events
    for (const fm of this.waveManager.formationEvents) {
      this.createTelegraph(fm);
    }

    // Collision
    const result = checkCollisions(
      this.player,
      this.bullets.bullets,
      this.enemies,
    );

    // Process kills with per-family kill signatures
    let frameKillCount = 0;
    let maxHitstop = 0;
    for (const kill of result.killedEnemies) {
      this.player.score += kill.scoreValue;
      if (kill.scoreValue > 0) this.player.enemiesKilled++;
      frameKillCount++;

      // Determine enemy family for kill signature
      const family = this.getEnemyFamily(kill.enemy);
      const isEliteKill = kill.enemy.isElite;

      // Heat: increase on kills
      if (family === 'mandelbrot') {
        this.heat = MINIBOSS_HEAT_ON_DEATH;
      } else if (family === 'blackhole') {
        this.heat = Math.min(1, this.heat + HEAT_KILL_BLACKHOLE);
      } else if (isEliteKill) {
        this.heat = Math.min(1, this.heat + HEAT_KILL_ELITE);
      } else {
        this.heat = Math.min(1, this.heat + HEAT_KILL_BASE);
      }
      this.timeSinceLastKill = 0;

      // Notify Mandelbrot parent when MiniMandel dies
      if (kill.enemy instanceof MiniMandel && kill.enemy.parent && kill.enemy.parent.active) {
        kill.enemy.parent.onMinionDeath();
      }

      // Per-family kill signature: VFX + SFX + hitstop
      this.spawnKillSignature(kill.position.x, kill.position.y, kill.color, family, isEliteKill);
      if (family === 'mandelbrot') {
        this.audio.playMinibossDeath();
      } else {
        this.audio.playKillSignature(family);
      }
      if (isEliteKill) {
        this.audio.playEliteKill();
        maxHitstop = Math.max(maxHitstop, HITSTOP_ELITE);
      }

      // Per-family explosion + grid + shake
      switch (family) {
        case 'mandelbrot': {
          // Massive boss death explosion
          this.explosions.spawn(
            kill.position.x, kill.position.y, [1, 0.4, 0.1],
            this.mobile ? 120 : 250, EXPLOSION_DURATION_LARGE,
          );
          // Secondary white flash
          this.explosions.spawn(
            kill.position.x, kill.position.y, [1, 1, 0.8],
            this.mobile ? 60 : 120, EXPLOSION_DURATION_DEFAULT,
          );
          // Third layer — red ember spread
          this.explosions.spawn(
            kill.position.x, kill.position.y, kill.color,
            this.mobile ? 40 : 80, EXPLOSION_DURATION_LARGE * 1.2, 0.3,
          );
          this.grid.applyImpulse(kill.position.x, kill.position.y, 1200, 500);
          this.camera.shake(SCREEN_SHAKE_DEATH);
          maxHitstop = Math.max(maxHitstop, MINIBOSS_HITSTOP_DEATH);
          this.haptics.death();
          // Kill all active MiniMandels
          for (const e of this.enemies) {
            if (e.active && e instanceof MiniMandel) {
              e.active = false;
              this.explosions.spawn(e.position.x, e.position.y, e.color,
                this.mobile ? 20 : 40, EXPLOSION_DURATION_DEFAULT * 0.6);
              this.grid.applyImpulse(e.position.x, e.position.y, 300, 150);
              if (e.trailId >= 0) this.trails.unregister(e.trailId);
            }
          }
          // End miniboss encounter
          this.onMinibossDefeated();
          break;
        }
        case 'blackhole': {
          const absorbed = kill.enemy instanceof BlackHole ? kill.enemy.absorbedCount : 0;
          this.audio.playBlackHoleDeath(absorbed);
          this.explosions.spawn(
            kill.position.x, kill.position.y, kill.color,
            this.mobile ? 60 : 120, EXPLOSION_DURATION_DEFAULT,
          );
          if (absorbed > 0) {
            this.explosions.spawn(
              kill.position.x, kill.position.y, kill.color,
              this.mobile ? Math.floor(absorbed * 8) : absorbed * 15,
              EXPLOSION_DURATION_LARGE * 0.8,
            );
            this.grid.applyImpulse(kill.position.x, kill.position.y, 600 + absorbed * 50, 300);
            this.camera.shake(SCREEN_SHAKE_LARGE);
          } else {
            this.grid.applyImpulse(kill.position.x, kill.position.y, 500, 250);
            this.camera.shake(SCREEN_SHAKE_LARGE);
          }
          maxHitstop = Math.max(maxHitstop, HITSTOP_BLACKHOLE);
          this.haptics.heavy();
          break;
        }
        case 'sierpinski':
          this.explosions.spawn(
            kill.position.x, kill.position.y, kill.color,
            this.mobile ? 40 : 80, EXPLOSION_DURATION_DEFAULT * 1.2,
          );
          // Secondary gold flash
          this.explosions.spawn(
            kill.position.x, kill.position.y, [1, 0.9, 0.3],
            this.mobile ? 20 : 40, EXPLOSION_DURATION_DEFAULT * 0.6,
          );
          this.grid.applyImpulse(kill.position.x, kill.position.y, 500, 220);
          maxHitstop = Math.max(maxHitstop, HITSTOP_SIERPINSKI);
          this.haptics.medium();
          break;
        case 'square':
          this.explosions.spawn(
            kill.position.x, kill.position.y, kill.color,
            this.mobile ? 35 : 70, EXPLOSION_DURATION_DEFAULT * 1.1, 0.8,
          );
          this.grid.applyImpulse(kill.position.x, kill.position.y, 450, 200);
          maxHitstop = Math.max(maxHitstop, HITSTOP_SQUARE);
          this.haptics.medium();
          break;
        case 'pinwheel':
          this.explosions.spawn(
            kill.position.x, kill.position.y, kill.color,
            this.mobile ? 30 : 60, EXPLOSION_DURATION_DEFAULT * 0.8, 1.3,
          );
          this.grid.applyImpulse(kill.position.x, kill.position.y, 350, 180);
          // No camera shake — grid impulse is enough for small enemies
          this.haptics.light();
          break;
        default: // rhombus, circle, shard, square2, minimandel, etc.
          this.explosions.spawn(
            kill.position.x, kill.position.y, kill.color,
            this.mobile ? Math.floor(EXPLOSION_PARTICLE_COUNT_SMALL * 0.6) : EXPLOSION_PARTICLE_COUNT_SMALL,
            EXPLOSION_DURATION_DEFAULT,
          );
          this.grid.applyImpulse(kill.position.x, kill.position.y, 400, 200);
          // No camera shake for basic kills
          this.haptics.light();
          break;
      }

      // Unregister trail
      if (kill.enemy.trailId >= 0) {
        this.trails.unregister(kill.enemy.trailId);
      }

      // Spawn children
      const deathResult = kill.enemy.onDeath();
      if (deathResult.spawnEnemies) {
        if (deathResult.staggeredSpawn) {
          const origin = kill.position.clone();
          this.explosions.spawn(
            origin.x, origin.y, kill.color,
            this.mobile ? 30 : 60, 0.6,
          );
          this.camera.shake(SCREEN_SHAKE_SMALL);
          for (let i = 0; i < deathResult.spawnEnemies.length; i++) {
            const child = deathResult.spawnEnemies[i];
            this.pendingSpawns.push({
              type: child.type,
              position: child.position.clone(),
              delay: 300 + i * 120,
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

    // Multi-kill hitstop bonus + dense combat heat bonus
    if (frameKillCount >= 3) {
      maxHitstop = Math.max(maxHitstop, HITSTOP_MULTI);
      this.heat = Math.min(1, this.heat + HEAT_DENSE_COMBAT_BONUS * frameKillCount);
    }
    if (maxHitstop > 0) {
      this.hitstopTimer = maxHitstop;
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

    // --- Heat system update ---
    this.updateHeat(dt);

    // --- Recovery window update ---
    this.updateRecovery(dt);

    // --- Miniboss encounter update ---
    this.updateMiniboss(dt);

    // Music intensity
    this.audio.setMusicIntensity(this.computeIntensity());
  }

  /** Get base enemy family name for kill signature lookup */
  private getEnemyFamily(enemy: Enemy): string {
    if (enemy instanceof Mandelbrot) return 'mandelbrot';
    if (enemy instanceof MiniMandel) return 'minimandel';
    if (enemy instanceof BlackHole) return 'blackhole';
    if (enemy instanceof Sierpinski) return 'sierpinski';
    if (enemy instanceof Square || enemy instanceof Square2) return 'square';
    if (enemy instanceof Pinwheel) return 'pinwheel';
    if (enemy instanceof Rhombus) return 'rhombus';
    if (enemy instanceof Shard) return 'sierpinski';
    if (enemy instanceof CircleEnemy) return 'circle';
    return 'rhombus'; // default
  }

  /** Spawn per-family kill signature visual effect */
  private spawnKillSignature(x: number, y: number, color: [number, number, number], family: string, isElite = false): void {
    // Only spawn for families with distinct signatures
    if (family === 'rhombus' || family === 'pinwheel' || family === 'square' || family === 'sierpinski' || family === 'mandelbrot') {
      const angles: number[] = [];
      const baseCount = family === 'pinwheel' ? 8 : KILL_SIG_RAY_COUNT;
      const count = isElite ? Math.floor(baseCount * 1.5) : baseCount;
      const baseAngle = Math.random() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        angles.push(baseAngle + (i / count) * Math.PI * 2);
      }
      this.killEffects.push({
        x, y,
        color: isElite ? [1, 1, 0.7] : color, // elite = bright golden-white
        family,
        elapsed: 0,
        duration: isElite ? KILL_SIG_DURATION * 1.3 : KILL_SIG_DURATION,
        angles,
      });
      // Elite kills get a second burst layer
      if (isElite) {
        const outerAngles: number[] = [];
        for (let i = 0; i < count; i++) {
          outerAngles.push(baseAngle + Math.PI / count + (i / count) * Math.PI * 2);
        }
        this.killEffects.push({
          x, y, color, family,
          elapsed: 0,
          duration: KILL_SIG_DURATION * 1.5,
          angles: outerAngles,
        });
      }
    }
  }

  /** Update combat feedback timers (kill effects, banners, telegraphs, border pulse) */
  private updateCombatFeedback(dt: number): void {
    const dtSec = dt / 1000;
    // Kill effects
    for (const ke of this.killEffects) {
      ke.elapsed += dtSec;
    }
    this.killEffects = this.killEffects.filter(ke => ke.elapsed < ke.duration);

    // Phase banner
    if (this.phaseBannerTimer > 0) this.phaseBannerTimer -= dt;
    // Border pulse
    if (this.phaseBorderPulseTimer > 0) this.phaseBorderPulseTimer -= dt;

    // Telegraphs
    for (const tg of this.telegraphs) {
      tg.elapsed += dtSec;
    }
    this.telegraphs = this.telegraphs.filter(tg => tg.elapsed < tg.duration);
  }

  /** Update heat: decay, survival trickle, visual hooks */
  private updateHeat(dt: number): void {
    const dtSec = dt / 1000;
    this.timeSinceLastKill += dtSec;

    // Passive heat decay during calm periods (>2s since last kill)
    if (this.timeSinceLastKill > 2) {
      this.heat = Math.max(0, this.heat - HEAT_DECAY_RATE * dtSec);
    }

    // Slow heat increase during intense+ phases from survival pressure
    if (this.gameTime >= DIFFICULTY_PHASES.intense.start) {
      this.heat = Math.min(1, this.heat + HEAT_SURVIVAL_RATE * dtSec);
    }

    // --- Visual hooks ---

    // Bloom intensity boost
    const baseBloom = gameSettings.bloomIntensity;
    this.bloom.intensity = baseBloom + this.heat * HEAT_BLOOM_BOOST_MAX;

    // Grid turbulence: random micro-impulses scaled by heat
    if (this.heat > 0.1) {
      const turbulence = (this.heat - 0.1) / 0.9 * HEAT_GRID_TURBULENCE_MAX;
      // Apply a few random impulses across the arena
      const count = Math.ceil(this.heat * 3);
      const hw = gameSettings.arenaWidth / 2;
      const hh = gameSettings.arenaHeight / 2;
      for (let i = 0; i < count; i++) {
        const rx = (Math.random() - 0.5) * hw * 2;
        const ry = (Math.random() - 0.5) * hh * 2;
        this.grid.applyImpulse(rx, ry, turbulence * (0.5 + Math.random() * 0.5), 100 + Math.random() * 100);
      }
    }
  }

  /** Update recovery window state */
  private updateRecovery(dt: number): void {
    if (!this.recoveryActive) return;

    this.recoveryTimer -= dt;

    // Keep player invulnerable during recovery
    if (this.recoveryTimer > 0) {
      this.player.invulnTimer = Math.max(this.player.invulnTimer, this.recoveryTimer);
    }

    // Expiry warning at 800ms remaining
    if (this.recoveryTimer <= 800 && !this.recoveryExpirePlayed) {
      this.audio.playRecoveryExpire();
      this.recoveryExpirePlayed = true;
    }

    // End recovery
    if (this.recoveryTimer <= 0) {
      this.recoveryActive = false;
      this.recoveryTimer = 0;
      this.player.fireRateOverride = 1;
    }
  }

  /** Miniboss encounter state machine */
  private updateMiniboss(dt: number): void {
    // Defeated banner timer
    if (this.minibossDefeatedBannerTimer > 0) {
      this.minibossDefeatedBannerTimer -= dt;
    }

    // Re-spawn timer (player died during boss fight)
    if (this.minibossRespawnTimer > 0) {
      this.minibossRespawnTimer -= dt;
      if (this.minibossRespawnTimer <= 0) {
        this.startMinibossWarning();
      }
    }

    // Check if it's time to trigger the miniboss
    if (!this.minibossDefeated && !this.minibossActive && this.minibossWarningTimer <= 0
        && this.minibossRespawnTimer <= 0
        && this.waveManager.elapsedTime >= MINIBOSS_SPAWN_TIME) {
      this.startMinibossWarning();
    }

    // Warning countdown
    if (this.minibossWarningTimer > 0) {
      this.minibossWarningTimer -= dt;
      if (this.minibossWarningTimer <= 0) {
        this.spawnMiniboss();
      }
      return;
    }

    // Active miniboss: process minion spawns + stage transitions
    if (this.minibossActive && this.minibossRef && this.minibossRef.active) {
      // Process pending minion spawns from the Mandelbrot
      while (this.minibossRef.pendingMinions.length > 0) {
        const minionPos = this.minibossRef.pendingMinions.shift()!;
        const mm = new MiniMandel(minionPos);
        mm.parent = this.minibossRef;
        mm.speed *= gameSettings.enemySpeedMultiplier;
        mm.trailId = this.trails.register(mm.color, this.trailLenEnemy);
        this.enemies.push(mm);
        this.grid.applyImpulse(minionPos.x, minionPos.y, 60, 80);
      }

      // Check for stage transitions
      if (this.minibossRef.checkStageTransition()) {
        this.audio.playMinibossStageBreak();
        this.hitstopTimer = Math.max(this.hitstopTimer, MINIBOSS_HITSTOP_STAGE);
        this.camera.shake(SCREEN_SHAKE_LARGE);
        this.grid.applyImpulse(
          this.minibossRef.position.x, this.minibossRef.position.y, 600, 300,
        );
        this.haptics.heavy();
      }
    }

    // Miniboss died outside of normal kill flow (e.g., player death shockwave)
    if (this.minibossActive && this.minibossRef && !this.minibossRef.active) {
      // Boss was destroyed by shockwave — allow re-spawn
      if (!this.minibossDefeated) {
        this.minibossActive = false;
        this.minibossRef = null;
        // Restore spawn rate
        this.waveManager.spawnRateMultiplier = this.savedSpawnRateMultiplier;
        this.minibossRespawnTimer = MINIBOSS_RESPAWN_DELAY;
      }
    }
  }

  private startMinibossWarning(): void {
    this.minibossWarningTimer = MINIBOSS_WARNING_DURATION;
    this.audio.playMinibossWarning();
    // Red border pulse for warning
    this.phaseBorderPulseTimer = MINIBOSS_WARNING_DURATION;
  }

  private spawnMiniboss(): void {
    this.minibossActive = true;
    // Find a spawn position away from the player
    const hw = gameSettings.arenaWidth / 2;
    const hh = gameSettings.arenaHeight / 2;
    const px = this.player.position.x;
    const py = this.player.position.y;
    // Spawn on the far side of the arena from the player
    const spawnX = px > 0 ? -hw * 0.4 : hw * 0.4;
    const spawnY = py > 0 ? -hh * 0.4 : hh * 0.4;

    const boss = createEnemy('mandelbrot', new Vec2(spawnX, spawnY)) as Mandelbrot;
    boss.trailId = this.trails.register(boss.color, this.trailLenEnemy);
    this.enemies.push(boss);
    this.minibossRef = boss;

    // Suppress normal spawning during fight
    this.savedSpawnRateMultiplier = this.waveManager.spawnRateMultiplier;
    this.waveManager.spawnRateMultiplier = MINIBOSS_SPAWN_SUPPRESS_MULT;

    this.audio.playMinibossArrive();
    this.grid.applyImpulse(spawnX, spawnY, 800, 400);
    this.camera.shake(SCREEN_SHAKE_LARGE);
    this.haptics.heavy();
  }

  private onMinibossDefeated(): void {
    this.minibossActive = false;
    this.minibossDefeated = true;
    this.minibossDefeatedBannerTimer = MINIBOSS_DEFEATED_BANNER_DURATION;
    this.minibossRef = null;
    // Restore spawn rate
    this.waveManager.spawnRateMultiplier = this.savedSpawnRateMultiplier;
  }

  /** Create a spawn telegraph from a formation event */
  private createTelegraph(fm: FormationMeta): void {
    this.telegraphs.push({
      formation: fm.formation,
      side: fm.side,
      center: fm.center,
      elapsed: 0,
      duration: TELEGRAPH_DURATION / 1000,
    });
    this.audio.playTelegraphWarning();
  }

  /** Render kill signature effects (called during additive blend pass) */
  private renderKillEffects(): void {
    for (const ke of this.killEffects) {
      const t = ke.elapsed / ke.duration;
      const alpha = Math.max(0, 1 - t);
      const [r, g, b] = ke.color;

      switch (ke.family) {
        case 'rhombus': {
          // Crystal burst: narrow rays emanating outward with bright tips
          for (const angle of ke.angles) {
            const len = t * KILL_SIG_RAY_LENGTH;
            const innerLen = len * 0.3;
            const x1 = ke.x + Math.cos(angle) * innerLen;
            const y1 = ke.y + Math.sin(angle) * innerLen;
            const x2 = ke.x + Math.cos(angle) * len;
            const y2 = ke.y + Math.sin(angle) * len;
            // Bright white tip
            this.renderer.drawLine(x1, y1, x2, y2, 1, 1, 1, alpha * 0.8);
            // Colored afterglow
            const x3 = ke.x + Math.cos(angle) * len * 1.2;
            const y3 = ke.y + Math.sin(angle) * len * 1.2;
            this.renderer.drawLine(x2, y2, x3, y3, r, g, b, alpha * 0.4);
          }
          break;
        }
        case 'square': {
          // Chunky fragments: rectangular shapes flying outward
          const fragSize = 8 + t * 4;
          for (const angle of ke.angles) {
            const dist = t * 60;
            const cx = ke.x + Math.cos(angle) * dist;
            const cy = ke.y + Math.sin(angle) * dist;
            const rot = angle + t * 2;
            // Draw a small rotated square
            for (let j = 0; j < 4; j++) {
              const a1 = rot + (j / 4) * Math.PI * 2;
              const a2 = rot + ((j + 1) / 4) * Math.PI * 2;
              this.renderer.drawLine(
                cx + Math.cos(a1) * fragSize, cy + Math.sin(a1) * fragSize,
                cx + Math.cos(a2) * fragSize, cy + Math.sin(a2) * fragSize,
                r, g, b, alpha * 0.7,
              );
            }
          }
          break;
        }
        case 'pinwheel': {
          // Spark spiral: particles in rotating spiral pattern
          const spiralRot = t * Math.PI * 3; // 1.5 full rotations
          for (let i = 0; i < ke.angles.length; i++) {
            const angle = ke.angles[i] + spiralRot;
            const dist = t * 70;
            const x1 = ke.x + Math.cos(angle) * dist;
            const y1 = ke.y + Math.sin(angle) * dist;
            const trail = 12;
            const x2 = ke.x + Math.cos(angle - 0.3) * (dist - trail);
            const y2 = ke.y + Math.sin(angle - 0.3) * (dist - trail);
            this.renderer.drawLine(x1, y1, x2, y2, r, g, b, alpha * 0.7);
            // Bright spark tip
            this.renderer.drawLine(x1, y1, x1 + Math.cos(angle) * 4, y1 + Math.sin(angle) * 4, 1, 1, 1, alpha * 0.5);
          }
          break;
        }
        case 'sierpinski': {
          // Layered fractal collapse: concentric triangles expanding then fading
          for (let layer = 0; layer < 3; layer++) {
            const layerT = Math.max(0, t - layer * 0.1);
            if (layerT <= 0) continue;
            const layerAlpha = alpha * (1 - layer * 0.25);
            const radius = layerT * 50 + layer * 15;
            const rot = t * 1.5 + layer * Math.PI / 6;
            // Draw triangle
            for (let j = 0; j < 3; j++) {
              const a1 = rot + (j / 3) * Math.PI * 2;
              const a2 = rot + ((j + 1) / 3) * Math.PI * 2;
              this.renderer.drawLine(
                ke.x + Math.cos(a1) * radius, ke.y + Math.sin(a1) * radius,
                ke.x + Math.cos(a2) * radius, ke.y + Math.sin(a2) * radius,
                r, g, b, layerAlpha * 0.6,
              );
            }
          }
          break;
        }
        case 'mandelbrot': {
          // Massive fractal overload burst — multiple expanding cardioid layers + rays
          for (let layer = 0; layer < 5; layer++) {
            const layerT = Math.max(0, t - layer * 0.06);
            if (layerT <= 0) continue;
            const layerAlpha = alpha * (1 - layer * 0.15);
            const radius = layerT * 120 + layer * 20;
            const rot = t * 2 + layer * Math.PI / 5;
            // Cardioid outlines expanding
            const segs = 20;
            for (let j = 0; j < segs; j++) {
              const theta1 = rot + (j / segs) * Math.PI * 2;
              const theta2 = rot + ((j + 1) / segs) * Math.PI * 2;
              const r1 = (1 - Math.cos(theta1)) * radius * 0.5;
              const r2 = (1 - Math.cos(theta2)) * radius * 0.5;
              this.renderer.drawLine(
                ke.x + Math.cos(theta1) * r1, ke.y + Math.sin(theta1) * r1,
                ke.x + Math.cos(theta2) * r2, ke.y + Math.sin(theta2) * r2,
                layer < 2 ? 1 : r, layer < 2 ? 0.8 : g, layer < 2 ? 0.3 : b, layerAlpha * 0.5,
              );
            }
          }
          // Bright white rays
          for (const angle of ke.angles) {
            const len = t * 150;
            const x1 = ke.x + Math.cos(angle) * 20;
            const y1 = ke.y + Math.sin(angle) * 20;
            const x2 = ke.x + Math.cos(angle) * len;
            const y2 = ke.y + Math.sin(angle) * len;
            this.renderer.drawLine(x1, y1, x2, y2, 1, 1, 1, alpha * 0.6);
          }
          break;
        }
      }
    }
  }

  /** Render spawn telegraph arcs on arena border */
  private renderTelegraphs(): void {
    const hw = gameSettings.arenaWidth / 2;
    const hh = gameSettings.arenaHeight / 2;
    const [tr, tg, tb] = TELEGRAPH_COLOR;

    for (const tel of this.telegraphs) {
      const t = tel.elapsed / tel.duration;
      const pulse = 0.5 + 0.5 * Math.sin(tel.elapsed * 12); // fast pulse
      const alpha = (1 - t) * 0.6 * pulse;

      if (tel.side !== undefined) {
        // Edge-based telegraph: glowing arc on the relevant border
        const segments = 20;
        let x1: number, y1: number, x2: number, y2: number;

        switch (tel.side) {
          case 0: // top
            for (let i = 0; i < segments; i++) {
              x1 = -hw + (i / segments) * hw * 2;
              x2 = -hw + ((i + 1) / segments) * hw * 2;
              y1 = y2 = hh;
              this.renderer.drawLine(x1, y1, x2, y2, tr, tg, tb, alpha);
              // Inner glow
              this.renderer.drawLine(x1, y1 - 6, x2, y2 - 6, tr, tg, tb, alpha * 0.4);
            }
            break;
          case 1: // bottom
            for (let i = 0; i < segments; i++) {
              x1 = -hw + (i / segments) * hw * 2;
              x2 = -hw + ((i + 1) / segments) * hw * 2;
              y1 = y2 = -hh;
              this.renderer.drawLine(x1, y1, x2, y2, tr, tg, tb, alpha);
              this.renderer.drawLine(x1, y1 + 6, x2, y2 + 6, tr, tg, tb, alpha * 0.4);
            }
            break;
          case 2: // left
            for (let i = 0; i < segments; i++) {
              y1 = -hh + (i / segments) * hh * 2;
              y2 = -hh + ((i + 1) / segments) * hh * 2;
              x1 = x2 = -hw;
              this.renderer.drawLine(x1, y1, x2, y2, tr, tg, tb, alpha);
              this.renderer.drawLine(x1 + 6, y1, x2 + 6, y2, tr, tg, tb, alpha * 0.4);
            }
            break;
          case 3: // right
            for (let i = 0; i < segments; i++) {
              y1 = -hh + (i / segments) * hh * 2;
              y2 = -hh + ((i + 1) / segments) * hh * 2;
              x1 = x2 = hw;
              this.renderer.drawLine(x1, y1, x2, y2, tr, tg, tb, alpha);
              this.renderer.drawLine(x1 - 6, y1, x2 - 6, y2, tr, tg, tb, alpha * 0.4);
            }
            break;
        }

        // Pincer: also show opposite side
        if (tel.formation === 'pincer' && tel.side !== undefined) {
          const oppSide = tel.side < 2 ? (tel.side === 0 ? 1 : 0) : (tel.side === 2 ? 3 : 2);
          switch (oppSide) {
            case 0:
              this.renderer.drawLine(-hw, hh, hw, hh, tr, tg, tb, alpha * 0.7);
              break;
            case 1:
              this.renderer.drawLine(-hw, -hh, hw, -hh, tr, tg, tb, alpha * 0.7);
              break;
            case 2:
              this.renderer.drawLine(-hw, -hh, -hw, hh, tr, tg, tb, alpha * 0.7);
              break;
            case 3:
              this.renderer.drawLine(hw, -hh, hw, hh, tr, tg, tb, alpha * 0.7);
              break;
          }
        }
      }

      if (tel.center) {
        // Position-based telegraph: warning ring (surround/ambush)
        const radius = tel.formation === 'ambush' ? 300 + t * 50 : 280 + t * 40;
        const ringSegments = 24;
        for (let i = 0; i < ringSegments; i++) {
          const a1 = (i / ringSegments) * Math.PI * 2;
          const a2 = ((i + 1) / ringSegments) * Math.PI * 2;
          // Dashed effect: skip every other segment
          if (i % 2 === 0) continue;
          this.renderer.drawLine(
            tel.center.x + Math.cos(a1) * radius,
            tel.center.y + Math.sin(a1) * radius,
            tel.center.x + Math.cos(a2) * radius,
            tel.center.y + Math.sin(a2) * radius,
            tr, tg, tb, alpha,
          );
        }
      }
    }
  }

  /** Render phase transition border pulse */
  private renderBorderPulse(): void {
    if (this.phaseBorderPulseTimer <= 0) return;
    const hw = gameSettings.arenaWidth / 2;
    const hh = gameSettings.arenaHeight / 2;
    const t = 1 - this.phaseBorderPulseTimer / PHASE_BORDER_PULSE_DURATION;
    const alpha = (1 - t) * 0.8;

    // White pulse over the border
    this.renderer.drawLine(-hw, -hh, hw, -hh, 1, 1, 1, alpha);
    this.renderer.drawLine(hw, -hh, hw, hh, 1, 1, 1, alpha);
    this.renderer.drawLine(hw, hh, -hw, hh, 1, 1, 1, alpha);
    this.renderer.drawLine(-hw, hh, -hw, -hh, 1, 1, 1, alpha);

    // Expanding inner pulse
    const inset = t * 20;
    this.renderer.drawLine(-hw + inset, -hh + inset, hw - inset, -hh + inset, 1, 0.6, 0.2, alpha * 0.5);
    this.renderer.drawLine(hw - inset, -hh + inset, hw - inset, hh - inset, 1, 0.6, 0.2, alpha * 0.5);
    this.renderer.drawLine(hw - inset, hh - inset, -hw + inset, hh - inset, 1, 0.6, 0.2, alpha * 0.5);
    this.renderer.drawLine(-hw + inset, hh - inset, -hw + inset, -hh + inset, 1, 0.6, 0.2, alpha * 0.5);
  }

  private playEnemySpawnSFX(type: string): void {
    switch (type) {
      case 'rhombus': this.audio.playSFX('rhombus'); break;
      case 'square': this.audio.playSFX('square'); break;
      case 'pinwheel': this.audio.playSFX('pinwheel'); break;
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
        this.gameCanvas.style.cursor = 'default';
        this.hud.drawGameOver(this.player.score, this.player.enemiesKilled, this.gameTime);
        if (!this.mobile) showDesktopSettings();
      } else {
        // Respawn and continue playing with recovery buff
        this.state = 'playing';
        for (const e of this.enemies) {
          if (e.trailId >= 0) this.trails.unregister(e.trailId);
        }
        this.enemies = [];
        this.pendingSpawns = [];
        this.player.respawn();
        this.player.active = true;
        this.camera.snapTo(this.player.position);

        // Activate recovery window
        this.recoveryActive = true;
        this.recoveryTimer = RECOVERY_DURATION;
        this.recoveryExpirePlayed = false;
        this.player.invulnTimer = RECOVERY_DURATION;
        this.player.fireRateOverride = RECOVERY_FIRE_RATE_MULT;
        this.audio.playRecoveryStart();
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
    this.renderBorderPulse();

    if (this.state === 'playing' || this.state === 'death_slowmo') {
      // Render spawn telegraphs (behind entities)
      this.renderTelegraphs();
      for (const e of this.enemies) e.render(this.renderer);
      if (this.state === 'playing') {
        this.bullets.render(this.renderer);
        this.player.render(this.renderer);
        // Recovery shield ring
        if (this.recoveryActive) {
          this.renderRecoveryShield();
        }
        // Crosshair: desktop = at mouse cursor world pos, touch = near player at aim angle
        if (this.input.isTouchActive()) {
          const aimAngle = this.player.aimAngle;
          const touchDist = 38;
          this.aimIndicator.render(
            this.renderer,
            this.player.position.x + Math.cos(aimAngle) * touchDist,
            this.player.position.y + Math.sin(aimAngle) * touchDist,
            this.totalTime * 1000,
          );
        } else {
          const mouseWorld = this.input.getMouseWorldPos();
          this.aimIndicator.render(
            this.renderer,
            mouseWorld.x,
            mouseWorld.y,
            this.totalTime * 1000,
          );
        }
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

    // 4. Switch to additive blend for trails, explosions, glow, kill signatures
    this.renderer.setBlendMode('additive');
    this.trails.render(this.renderer);
    this.explosions.render(this.renderer);
    this.renderKillEffects();
    // setBlendMode('normal') flushes additive batch and restores blend func
    this.renderer.setBlendMode('normal');
    this.renderer.end();

    // --- Bloom post-process: scene FBO -> screen ---
    this.bloom.apply(this.renderer.canvasWidth, this.renderer.canvasHeight);

    // --- HUD (drawn on separate 2D canvas, unaffected by bloom) ---
    if (this.state === 'playing' || this.state === 'death_slowmo') {
      this.hud.drawPlaying(this.player.score, this.player.lives, this.audio.muted, this.enemies.length, this.input.autoFire);

      // Recovery banner
      if (this.recoveryActive && this.state === 'playing') {
        this.hud.drawRecoveryBanner(this.recoveryTimer / RECOVERY_DURATION);
      }

      // Phase transition banner
      if (this.phaseBannerTimer > 0) {
        const progress = 1 - this.phaseBannerTimer / PHASE_BANNER_DURATION;
        this.hud.drawPhaseBanner(this.phaseBannerName, progress);
      }

      // Miniboss warning banner
      if (this.minibossWarningTimer > 0) {
        const progress = 1 - this.minibossWarningTimer / MINIBOSS_WARNING_DURATION;
        this.hud.drawMinibossWarning(progress);
      }

      // Miniboss HP bar
      if (this.minibossActive && this.minibossRef && this.minibossRef.active) {
        this.hud.drawMinibossHP('MANDELBROT', this.minibossRef.hp, this.minibossRef.maxHp, this.minibossRef.stage);
      }

      // Miniboss defeated banner
      if (this.minibossDefeatedBannerTimer > 0) {
        const progress = 1 - this.minibossDefeatedBannerTimer / MINIBOSS_DEFEATED_BANNER_DURATION;
        this.hud.drawMinibossDefeatedBanner(progress);
      }

      // Virtual joysticks (drawn on HUD canvas, not during slowmo)
      if (this.state === 'playing') {
        this.joystickRenderer.render(this.input);
      }
    }
  }

  /** Render recovery shield ring around player */
  private renderRecoveryShield(): void {
    if (!this.recoveryActive) return;
    const px = this.player.position.x;
    const py = this.player.position.y;
    const t = 1 - this.recoveryTimer / RECOVERY_DURATION;
    const [sr, sg, sb] = RECOVERY_SHIELD_COLOR;

    // Pulsing alpha (faster pulse as it expires)
    const pulseSpeed = 4 + t * 8;
    const pulse = 0.5 + 0.5 * Math.sin(this.totalTime * pulseSpeed);
    const alpha = (1 - t * 0.5) * (0.4 + pulse * 0.4);

    // Shield ring
    const radius = RECOVERY_SHIELD_RADIUS + pulse * 3;
    this.renderer.drawCircle(px, py, radius, [sr, sg, sb], 24, alpha);

    // Inner glow ring
    this.renderer.drawCircle(px, py, radius * 0.8, [sr * 0.8, sg * 0.8, sb * 0.8], 16, alpha * 0.3);

    // Expiry warning: fast blink when <800ms remaining
    if (this.recoveryTimer <= 800) {
      const blink = Math.sin(this.totalTime * 20) > 0 ? 0.7 : 0.2;
      this.renderer.drawCircle(px, py, radius * 1.2, [1, 0.5, 0.2], 16, blink * (1 - t));
    }
  }

  /** Render the arena border — solid neon lines at world edges, heat-influenced */
  private renderArenaBorder(): void {
    const hw = gameSettings.arenaWidth / 2;
    const hh = gameSettings.arenaHeight / 2;
    // Heat shifts border toward warm colors (orange/white) and increases brightness
    const heatMix = this.heat * HEAT_BORDER_BRIGHTNESS_MAX;
    const br = Math.min(1, ARENA_BORDER_COLOR[0] + heatMix * 2.0);  // push toward warm
    const bg = Math.min(1, ARENA_BORDER_COLOR[1] + heatMix * 0.6);
    const bb = Math.min(1, ARENA_BORDER_COLOR[2] - heatMix * 0.3);  // reduce blue at high heat
    const cr = Math.min(1, ARENA_BORDER_CORNER_COLOR[0] + heatMix);
    const cg = Math.min(1, ARENA_BORDER_CORNER_COLOR[1] + heatMix * 0.5);
    const cb = Math.min(1, ARENA_BORDER_CORNER_COLOR[2] - heatMix * 0.2);
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
    this.bloom.threshold = gameSettings.bloomThreshold;
    this.bloom.blurPasses = this.mobile ? Math.min(gameSettings.bloomBlurPasses, 2) : gameSettings.bloomBlurPasses;
    this.bloom.blurRadius = gameSettings.bloomBlurRadius;
    this.trailLenEnemy = this.mobile
      ? Math.min(gameSettings.trailLength, MOBILE_TRAIL_LENGTH_ENEMY)
      : gameSettings.trailLength;
    this.trailLenBullet = this.mobile
      ? MOBILE_TRAIL_LENGTH_BULLET
      : Math.min(gameSettings.trailLength, TRAIL_LENGTH_BULLET);
  }
}
