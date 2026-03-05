import { Player } from '../entities/player';
import { Bullet } from '../entities/bullet';
import { Enemy } from '../entities/enemies/enemy';
import { DeathStar } from '../entities/enemies/deathstar';
import { Vec2 } from './vector';
import {
  BULLET_COLLISION_RADIUS_ENEMY,
  BULLET_COLLISION_RADIUS_DEATHSTAR,
  DEATHSTAR_ATTRACT_RADIUS,
} from '../config';

export interface CollisionResult {
  killedEnemies: { enemy: Enemy; position: Vec2; color: [number, number, number]; scoreValue: number }[];
  killedDeathStars: { deathstar: DeathStar; position: Vec2; circleSpawnCount: number }[];
  playerHit: boolean;
  absorbedEnemies: { enemy: Enemy; deathstar: DeathStar }[];
}

export function checkCollisions(
  player: Player,
  bullets: Bullet[],
  enemies: Enemy[],
  deathstars: DeathStar[],
): CollisionResult {
  const result: CollisionResult = {
    killedEnemies: [],
    killedDeathStars: [],
    playerHit: false,
    absorbedEnemies: [],
  };

  // Bullet vs Enemy
  for (const b of bullets) {
    if (!b.active) continue;
    for (const e of enemies) {
      if (!e.active || e.isSpawning) continue;
      if (b.position.distanceToSq(e.position) < BULLET_COLLISION_RADIUS_ENEMY * BULLET_COLLISION_RADIUS_ENEMY) {
        b.active = false;
        const killed = e.hit();
        if (killed) {
          result.killedEnemies.push({
            enemy: e,
            position: e.position.clone(),
            color: e.color,
            scoreValue: e.scoreValue,
          });
        }
        break;
      }
    }
  }

  // Bullet vs DeathStar
  for (const b of bullets) {
    if (!b.active) continue;
    for (const ds of deathstars) {
      if (!ds.active) continue;
      if (b.position.distanceToSq(ds.position) < BULLET_COLLISION_RADIUS_DEATHSTAR * BULLET_COLLISION_RADIUS_DEATHSTAR) {
        b.active = false;
        ds.hit();
        if (!ds.active) {
          result.killedDeathStars.push({
            deathstar: ds,
            position: ds.position.clone(),
            circleSpawnCount: ds.circleSpawnCount,
          });
        }
        break;
      }
    }
  }

  // Player vs Enemy
  if (!player.isInvulnerable && player.active) {
    for (const e of enemies) {
      if (!e.active || e.isSpawning) continue;
      const dist = player.position.distanceToSq(e.position);
      const minDist = player.collisionRadius + e.collisionRadius;
      if (dist < minDist * minDist) {
        result.playerHit = true;
        e.active = false;
        result.killedEnemies.push({
          enemy: e,
          position: e.position.clone(),
          color: e.color,
          scoreValue: 0, // no score for enemies that kill you
        });
        break;
      }
    }
    // Player vs DeathStar
    for (const ds of deathstars) {
      if (!ds.active) continue;
      const dist = player.position.distanceToSq(ds.position);
      const minDist = player.collisionRadius + ds.collisionRadius;
      if (dist < minDist * minDist) {
        result.playerHit = true;
        break;
      }
    }
  }

  // DeathStar attracts enemies — enemies close to deathstar get absorbed
  for (const ds of deathstars) {
    if (!ds.active) continue;
    for (const e of enemies) {
      if (!e.active) continue;
      if (e.position.distanceToSq(ds.position) < DEATHSTAR_ATTRACT_RADIUS * DEATHSTAR_ATTRACT_RADIUS) {
        result.absorbedEnemies.push({ enemy: e, deathstar: ds });
        e.active = false;
      }
    }
  }

  return result;
}

/** Redirect enemy movement toward nearest deathstar */
export function applyDeathStarAttraction(enemies: Enemy[], deathstars: DeathStar[]): void {
  if (deathstars.length === 0) return;
  for (const e of enemies) {
    if (!e.active) continue;
    let closest: DeathStar | null = null;
    let closestDist = Infinity;
    for (const ds of deathstars) {
      if (!ds.active) continue;
      const d = e.position.distanceToSq(ds.position);
      if (d < closestDist) {
        closestDist = d;
        closest = ds;
      }
    }
    if (closest) {
      const dir = closest.position.add(e.displacer).sub(e.position).normalize();
      e.velocity.set(dir.x * e.speed, dir.y * e.speed);
    }
  }
}
