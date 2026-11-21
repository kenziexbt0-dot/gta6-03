// Solmarina — the player: on foot, and behind the wheel.
// The player is either walking or driving one car; entering and leaving a car is
// the hinge the whole open world turns on.

import { CONFIG } from './config.js';
import { clamp, dist } from './random.js';
import { hitsBuilding } from './world.js';
import { raiseWanted } from './police.js';

// Fresh player state. Mara starts on foot outside the marina office.
export function createPlayer(city) {
  return {
    name: 'Mara Voss',
    x: city.marina.x + city.marina.w / 2,
    y: city.marina.y + city.marina.h + 40,
    angle: -Math.PI / 2,
    speed: 0,
    health: CONFIG.PLAYER_HEALTH,
    cash: 120,
    ammo: CONFIG.START_AMMO,
    driving: null, // the car object when behind the wheel, else null
    punchCooldown: 0,
    gunCooldown: 0,
    hurtFlash: 0,
    walkCycle: 0,
    moving: false,
  };
}

// A car the player or traffic can drive. `kind` is 'sedan' | 'taxi' | 'police' | 'van'.
export function createCar(x, y, angle, color, kind) {
  return {
    x, y, angle,
    speed: 0,
    color,
    kind: kind || 'sedan',
    // Traffic cars follow a road; player-driven ones do not.
    traffic: null,
    // Damage 0..1; smoke starts past 0.55, the car stalls at 1.
    damage: 0,
    // Skid marks the renderer draws while this car slides.
    skidding: false,
    // True while a police car is actively chasing.
    chasing: false,
    sirenHigh: false,
    sirenTimer: 0,
  };
}

// Update the player for one frame. `input` is the live input state, `game` the
// whole game state (city, cars, particles, audio live there).
export function updatePlayer(game, dt) {
  const player = game.player;
  const input = game.input;
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.gunCooldown = Math.max(0, player.gunCooldown - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);

  if (player.driving) {
    updateDriving(game, dt);
  } else {
    updateWalking(game, dt);
  }

  // Keep the player inside the world, out of the water.
  player.x = clamp(player.x, 20, CONFIG.WORLD_W - 20);
  player.y = clamp(player.y, 20, CONFIG.WATER_Y - 24);
}

// Walking: WASD moves, Shift runs, the facing follows the movement direction.
function updateWalking(game, dt) {
  const player = game.player;
  const input = game.input;
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const moving = dx !== 0 || dy !== 0;
  player.moving = moving;
  if (!moving) {
    player.speed = 0;
    return;
  }
  const len = Math.sqrt(dx * dx + dy * dy);
  dx /= len;
  dy /= len;
  const speed = input.run ? CONFIG.RUN_SPEED : CONFIG.WALK_SPEED;
  const nx = player.x + dx * speed * dt;
  const ny = player.y + dy * speed * dt;
  // Buildings block walking; slide along them instead of stopping dead.
  if (!hitsBuilding(game.city, nx, player.y, CONFIG.PLAYER_RADIUS)) player.x = nx;
  if (!hitsBuilding(game.city, player.x, ny, CONFIG.PLAYER_RADIUS)) player.y = ny;
  player.angle = Math.atan2(dy, dx);
  player.speed = speed;
  player.walkCycle += dt * speed * 0.06;
}

// Driving: arcade handling — throttle, steering that scales with speed, drag,
// and a handbrake skid when reversing hard at speed.
function updateDriving(game, dt) {
  const player = game.player;
  const car = player.driving;
  const input = game.input;
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);

  if (input.up) car.speed += CONFIG.CAR_ACCEL * dt;
  if (input.down) {
    if (car.speed > 30) car.speed -= CONFIG.CAR_BRAKE * dt;
    else car.speed -= CONFIG.CAR_ACCEL * 0.55 * dt;
  }
  // Drag and rolling resistance.
  car.speed -= car.speed * CONFIG.CAR_DRAG * dt;
  car.speed = clamp(car.speed, -CONFIG.CAR_REVERSE_MAX, CONFIG.CAR_MAX_SPEED);

  const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const steerAuthority = clamp(Math.abs(car.speed) / 120, 0, 1);
  const direction = car.speed >= 0 ? 1 : -1;
  car.angle += steerInput * CONFIG.CAR_STEER * steerAuthority * direction * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const blocked = hitsBuilding(game.city, nx, ny, 20);
  if (blocked) {
    // A building stop: kill most of the speed, spark and shake.
    if (Math.abs(car.speed) > 120) {
      game.effects.crashSparks(car.x, car.y, 10);
      game.audio.crash();
      car.damage = clamp(car.damage + 0.08, 0, 1);
    }
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.y = ny;
  }

  // Skid when steering hard at speed.
  car.skidding = Math.abs(steerInput) > 0 && Math.abs(car.speed) > 240;
  if (car.skidding && Math.random() < 0.5) {
    game.effects.skidSmoke(car.x - forward * 18, car.y - right * 0);
  }

  // The player rides with the car.
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = car.speed;

  // Water is a hard edge: cars cannot swim.
  if (car.y > CONFIG.WATER_Y - 30) {
    car.y = CONFIG.WATER_Y - 30;
    car.speed *= 0.4;
  }
}

// Try to enter the nearest car within reach. Returns true when it worked.
export function tryEnterCar(game) {
  const player = game.player;
  if (player.driving) return false;
  let best = null;
  let bestDist = 70;
  for (const car of game.cars) {
    if (car.kind === 'police' && game.wanted.level > 0) continue; // no stealing a cop car mid-chase
    const d = dist(player.x, player.y, car.x, car.y);
    if (d < bestDist) {
      best = car;
      bestDist = d;
    }
  }
  if (!best) return false;
  player.driving = best;
  best.traffic = null; // it is the player's car now, not traffic
  game.audio.pickup();
  game.message('You took the car. Drive with W A S D.');
  // Stealing a parked car in view of the law draws heat.
  if (!best.wasPlayerOwned && game.wanted.level < 1) {
    raiseWanted(game, 1, 'car theft');
  }
  best.wasPlayerOwned = true;
  return true;
}

// Step out of the car, onto the roadside.
export function exitCar(game) {
  const player = game.player;
  if (!player.driving) return;
  const car = player.driving;
  const side = Math.cos(car.angle + Math.PI / 2);
  const sideY = Math.sin(car.angle + Math.PI / 2);
  player.x = car.x + side * 30;
  player.y = car.y + sideY * 30;
  player.driving = null;
  player.speed = 0;
}

// Damage the player. Returns true when the player just died.
export function hurtPlayer(game, amount) {
  const player = game.player;
  if (player.health <= 0) return true;
  player.health = Math.max(0, player.health - amount);
  player.hurtFlash = 0.35;
  if (player.health <= 0) {
    game.audio.busted();
    return true;
  }
  return false;
}

// Heal the player, capped at full health.
export function healPlayer(game, amount) {
  game.player.health = Math.min(CONFIG.PLAYER_HEALTH, game.player.health + amount);
}
