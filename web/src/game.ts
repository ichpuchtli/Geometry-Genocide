import { Renderer } from './renderer/sprite-batch';
import { Camera } from './core/camera';
import { Input } from './core/input';
import { Player } from './entities/player';
import { BulletPool } from './entities/bullet';
import { Enemy } from './entities/enemies/enemy';
import { DeathStar } from './entities/enemies/deathstar';
import { ExplosionPool } from './entities/explosion';
import { HUD } from './ui/hud';
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

export class Game {
  private renderer: Renderer;
  private camera: Camera;
  private input: Input;
  private player: Player;
  private bullets: BulletPool;
  private enemies: Enemy[] = [];
  private deathstars: DeathStar[] = [];
  private explosions: ExplosionPool;
  private hud: HUD;
  private waveManager: WaveManager;

  private state: GameState = 'menu';
  private gameTime = 0; // seconds survived

  constructor(gameCanvas: HTMLCanvasElement, hudCanvas: HTMLCanvasElement) {
    this.renderer = new Renderer(gameCanvas);
    this.camera = new Camera(this.renderer.width, this.renderer.height);
    this.input = new Input(gameCanvas);
    this.input.setCamera(this.camera);
    this.player = new Player(this.input);
    this.bullets = new BulletPool();
    this.explosions = new ExplosionPool();
    this.hud = new HUD(hudCanvas);
    this.waveManager = new WaveManager();

    // Handle clicks for menu/gameover
    gameCanvas.addEventListener('click', () => this.onClick());

    // Handle resize
    window.addEventListener('resize', () => this.resize());
    this.resize();

    // Show menu
    this.hud.drawMenu();
  }

  private resize(): void {
    this.renderer.resize();
    this.camera.resize(this.renderer.width, this.renderer.height);
    this.hud.resize();
    if (this.state === 'menu') this.hud.drawMenu();
  }

  private onClick(): void {
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
    this.waveManager.reset();
    this.gameTime = 0;
    this.camera.snapTo(this.player.position);
    this.hud.clear();
  }

  update(dt: number): void {
    if (this.state !== 'playing') return;

    // Check ESC
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
        this.bullets.spawn(this.player.position.x, this.player.position.y, angle);
      }
    }

    // Bullets
    this.bullets.update(dt);

    // DeathStar attraction redirects enemies
    const activeDeathstars = this.deathstars.filter(d => d.active);
    if (activeDeathstars.length > 0) {
      applyDeathStarAttraction(this.enemies, activeDeathstars);
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.active) continue;
      // Most enemies have different update signatures, but we pass player info
      if (e instanceof Octagon) {
        (e as Octagon).update(dt, this.player.position, this.player.velocity);
      } else if ('update' in e) {
        // Enemies that follow player
        (e as { update(dt: number, playerPos?: Vec2): void }).update(dt, this.player.position);
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
      } else {
        this.enemies.push(createEnemy(req.type));
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
        EXPLOSION_PARTICLE_COUNT_SMALL,
        EXPLOSION_DURATION_DEFAULT,
      );

      // Spawn children
      const deathResult = kill.enemy.onDeath();
      if (deathResult.spawnEnemies) {
        for (const child of deathResult.spawnEnemies) {
          this.enemies.push(createEnemy(child.type, child.position));
        }
      }
    }

    // Process deathstar kills
    for (const kill of result.killedDeathStars) {
      this.explosions.spawn(
        kill.position.x, kill.position.y,
        [0.92, 0.38, 0.24],
        EXPLOSION_PARTICLE_COUNT_LARGE,
        EXPLOSION_DURATION_LARGE,
      );
      // Spawn circles
      for (let i = 0; i < kill.circleSpawnCount; i++) {
        const offset = Vec2.random().scale(100);
        this.enemies.push(createEnemy('circle', kill.position.add(offset)));
      }
    }

    // Process absorbed enemies
    for (const { enemy, deathstar } of result.absorbedEnemies) {
      deathstar.absorbEnemy();
      this.explosions.spawn(
        enemy.position.x, enemy.position.y, enemy.color,
        8, 0.5,
      );
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

    // Clean up inactive
    this.enemies = this.enemies.filter(e => e.active);
    this.deathstars = this.deathstars.filter(d => d.active);

    // Explosions
    this.explosions.update(dt);

    // Camera
    this.camera.follow(this.player.position);
  }

  private onPlayerDeath(): void {
    this.explosions.spawn(
      this.player.position.x, this.player.position.y,
      [1, 1, 0.78],
      EXPLOSION_PARTICLE_COUNT_DEATH,
      EXPLOSION_DURATION_DEATH,
      0.2,
    );
    this.player.active = false;
    this.state = 'gameover';
    this.enemies = [];
    this.deathstars = [];
    this.hud.drawGameOver(this.player.score, this.player.enemiesKilled, this.gameTime);
  }

  private onPlayerRespawn(): void {
    this.explosions.spawn(
      this.player.position.x, this.player.position.y,
      [1, 1, 0.78],
      EXPLOSION_PARTICLE_COUNT_LARGE,
      EXPLOSION_DURATION_DEFAULT,
    );
    this.enemies = [];
    this.deathstars = [];
    this.player.respawn();
  }

  render(): void {
    this.renderer.cameraX = this.camera.position.x;
    this.renderer.cameraY = this.camera.position.y;
    this.renderer.begin();

    if (this.state === 'playing') {
      // Render all game entities
      for (const e of this.enemies) e.render(this.renderer);
      for (const ds of this.deathstars) ds.render(this.renderer);
      this.bullets.render(this.renderer);
      this.player.render(this.renderer);
      this.explosions.render(this.renderer);

      // HUD
      this.hud.drawPlaying(this.player.score, this.player.lives);
    } else {
      // Render lingering explosions (game over / menu)
      this.explosions.render(this.renderer);
    }

    this.renderer.end();
  }
}
