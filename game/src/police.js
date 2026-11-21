// Solmarina — wanted level and the police response.
// Crimes raise the star level; police cars spawn at the map edge, chase the player,
// ram their car, and bust them on foot. Hide long enough and the heat fades.

import { CONFIG, PALETTE } from './config.js';
import { clamp, dist, angleDiff } from './random.js';
import { nearestRoad } from './world.js';
import { createCar, hurtPlayer } from './player.js';

// Fresh wanted state.
export function createWanted() {
  return {
    level: 0,
    heat: 0, // 0..1 progress toward the next star while committing crimes
    decayTimer: 0, // seconds the player has stayed out of sight
    bustedTimer: 0, // seconds a cop has held the player on foot
    sirenTimer: 0,
    sirenHigh: false,
    lastCrime: '',
  };
}

// Raise the wanted level by `stars`, with a message explaining why.
export function raiseWanted(game, stars, reason) {
  const wanted = game.wanted;
  const before = wanted.level;
  wanted.level = clamp(wanted.level + stars, 0, CONFIG.WANTED_MAX);
  wanted.decayTimer = 0;
  wanted.lastCrime = reason;
  if (wanted.level > before) {
    game.audio.wantedUp();
    game.message(`WANTED ${'★'.repeat(wanted.level)} — ${reason}`);
    spawnPoliceForLevel(game);
  }
}

// How many police units the current level calls for.
export function policeQuota(level) {
  if (level <= 0) return 0;
  if (level === 1) return 1;
  if (level === 2) return 2;
  if (level === 3) return 3;
  if (level === 4) return 4;
  return 5;
}

// Spawn police cars until the quota for the current level is met.
export function spawnPoliceForLevel(game) {
  const quota = policeQuota(game.wanted.level);
  const current = game.cars.filter((c) => c.kind === 'police').length;
  for (let i = current; i < quota; i += 1) {
    game.cars.push(spawnPoliceCar(game));
  }
}

// One police car, entering from the map edge nearest the player.
function spawnPoliceCar(game) {
  const player = game.player;
  const edge = Math.floor(game.rng() * 4);
  let x = player.x;
  let y = player.y;
  if (edge === 0) { x = 120; y = player.y; }
  if (edge === 1) { x = CONFIG.WORLD_W - 120; y = player.y; }
  if (edge === 2) { x = player.x; y = 120; }
  if (edge === 3) { x = player.x; y = CONFIG.BEACH_Y - 120; }
  const road = nearestRoad(x, y);
  if (road.axis === 'x') y = road.line;
  else x = road.line;
  const car = createCar(x, y, Math.atan2(player.y - y, player.x - x), PALETTE.policeBlue, 'police');
  car.chasing = true;
  car.speed = 200;
  return car;
}

// Update the wanted level and every police unit for one frame.
export function updatePolice(game, dt) {
  const wanted = game.wanted;
  const player = game.player;

  // Decay: staying alive and out of trouble lowers the heat.
  if (wanted.level > 0) {
    const policeNear = game.cars.some((c) => c.kind === 'police' && dist(c.x, c.y, player.x, player.y) < 420);
    if (!policeNear) {
      wanted.decayTimer += dt;
      if (wanted.decayTimer > CONFIG.WANTED_DECAY_SECONDS) {
        wanted.level -= 1;
        wanted.decayTimer = 0;
        game.message(wanted.level > 0 ? `Heat dropping… ${'★'.repeat(wanted.level)} left.` : 'You lost the cops. Clean — for now.');
      }
    } else {
      wanted.decayTimer = 0;
    }
  }

  // Siren wail while any police car is near.
  const anyNear = game.cars.some((c) => c.kind === 'police' && dist(c.x, c.y, player.x, player.y) < 500);
  if (anyNear) {
    wanted.sirenTimer -= dt;
    if (wanted.sirenTimer <= 0) {
      wanted.sirenTimer = 0.55;
      wanted.sirenHigh = !wanted.sirenHigh;
      game.audio.siren(wanted.sirenHigh);
    }
  }

  // Move each police car.
  for (const car of game.cars) {
    if (car.kind !== 'police') continue;
    updatePoliceCar(game, car, dt);
  }

  // On foot, a police car parked on top of the player busts them.
  if (!player.driving && wanted.level > 0) {
    const copOnTop = game.cars.some(
      (c) => c.kind === 'police' && dist(c.x, c.y, player.x, player.y) < 46 && Math.abs(c.speed) < 60,
    );
    if (copOnTop) {
      wanted.bustedTimer += dt;
      if (wanted.bustedTimer > CONFIG.BUSTED_HOLD_SECONDS) {
        wanted.bustedTimer = 0;
        game.busted();
      }
    } else {
      wanted.bustedTimer = Math.max(0, wanted.bustedTimer - dt * 2);
    }
  } else {
    wanted.bustedTimer = 0;
  }

  // Wanted over: police cars give up and drive off.
  if (wanted.level === 0) {
    for (const car of game.cars) {
      if (car.kind === 'police' && car.chasing) {
        car.chasing = false;
        car.traffic = { cruise: 170, turnCooldown: 2, lane: 26 };
      }
    }
  }
}

// A police car steers toward the player, rams, and slows when it hits.
function updatePoliceCar(game, car, dt) {
  const player = game.player;
  if (!car.chasing) return;
  const targetAngle = Math.atan2(player.y - car.y, player.x - car.x);
  car.angle += clamp(angleDiff(car.angle, targetAngle), -3.2 * dt, 3.2 * dt);
  const want = CONFIG.POLICE_CAR_SPEED;
  car.speed += clamp(want - car.speed, -500 * dt, 320 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 40, CONFIG.WORLD_W - 40);
  car.y = clamp(car.y, 40, CONFIG.BEACH_Y - 20);

  const d = dist(car.x, car.y, player.x, player.y);
  car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
  if (d < 44 && car.ramCooldown <= 0) {
    // Ram: shove the player's car, spark, and hurt the player on foot.
    // One damaging ram per police car every 0.9 s, so three cops cannot
    // drain a full health bar in a single pile-up.
    car.ramCooldown = 0.9;
    car.speed *= 0.55; // the cop bounces off after the hit
    if (player.driving) {
      player.driving.speed *= 0.6;
      player.driving.damage = clamp(player.driving.damage + 0.05, 0, 1);
      game.effects.crashSparks(player.x, player.y, 8);
      game.audio.crash();
      if (hurtPlayer(game, CONFIG.POLICE_RAM_DAMAGE)) game.wasted();
    } else {
      car.speed *= 0.2;
    }
  }

  // Siren lights flip on a timer.
  car.sirenTimer -= dt;
  if (car.sirenTimer <= 0) {
    car.sirenTimer = 0.4;
    car.sirenHigh = !car.sirenHigh;
  }
}

// Remove all police from the map (used when a mission resets the heat).
export function clearPolice(game) {
  game.cars = game.cars.filter((c) => c.kind !== 'police');
  game.wanted.level = 0;
  game.wanted.heat = 0;
  game.wanted.decayTimer = 0;
  game.wanted.bustedTimer = 0;
}
