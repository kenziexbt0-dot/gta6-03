// Solmarina — traffic cars and pedestrians, the life of the streets.
// Traffic cars drive the road grid and turn at intersections; pedestrians walk the
// sidewalks and scatter when something loud or violent happens near them.

import { CONFIG, PALETTE } from './config.js';
import { makeRng, range, rangeInt, pick, clamp, dist } from './random.js';
import { randomRoadPoint, randomSidewalkPoint, nearestRoad, hitsBuilding } from './world.js';
import { createCar } from './player.js';

// Spawn the starting traffic and pedestrians for a fresh game.
export function spawnStreetLife(game, seed) {
  const rng = makeRng(seed + 77);
  game.cars = [];
  game.peds = [];
  for (let i = 0; i < CONFIG.TRAFFIC_CARS; i += 1) {
    game.cars.push(spawnTrafficCar(game, rng));
  }
  // A few parked cars the player can steal, near the marina and the motel.
  const parkedSpots = [
    { x: game.city.marina.x + 40, y: game.city.marina.y + game.city.marina.h + 90, angle: 0 },
    { x: game.city.motel.x - 60, y: game.city.motel.y + game.city.motel.h + 40, angle: Math.PI / 2 },
    { x: 1020, y: 560 + 70, angle: 0 },
    { x: 1820, y: 900 + 70, angle: Math.PI },
    { x: 620, y: 1240 + 70, angle: 0 },
  ];
  for (const spot of parkedSpots) {
    const car = createCar(spot.x, spot.y, spot.angle, pick(rng, PALETTE.carColors), 'sedan');
    car.wasPlayerOwned = false;
    game.cars.push(car);
  }
  for (let i = 0; i < CONFIG.PEDESTRIANS; i += 1) {
    game.peds.push(spawnPedestrian(game, rng));
  }
}

// One traffic car, driving along a road with a target speed.
export function spawnTrafficCar(game, rng) {
  const p = randomRoadPoint(rng);
  const road = nearestRoad(p.x, p.y);
  const angle = road.axis === 'x' ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
  const car = createCar(p.x, p.y, angle, pick(rng, PALETTE.carColors), rng() < 0.12 ? 'taxi' : 'sedan');
  car.speed = range(rng, CONFIG.TRAFFIC_SPEED_MIN, CONFIG.TRAFFIC_SPEED_MAX);
  car.traffic = {
    cruise: car.speed,
    turnCooldown: range(rng, 1, 4),
    lane: (rng() < 0.5 ? -1 : 1) * 26,
  };
  return car;
}

// One pedestrian, walking a sidewalk.
export function spawnPedestrian(game, rng) {
  const p = randomSidewalkPoint(rng);
  return {
    x: p.x,
    y: p.y,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, CONFIG.PED_SPEED_MIN, CONFIG.PED_SPEED_MAX),
    color: pick(rng, ['#e86a5a', '#5a8fe8', '#e8c85a', '#7ac98a', '#c98ad9', '#e8e8e8']),
    // 'walk' | 'flee' | 'down' | 'thug'
    state: 'walk',
    health: 40,
    fleeTimer: 0,
    turnTimer: range(rng, 1, 4),
    walkCycle: range(rng, 0, 6),
  };
}

// Move all traffic and pedestrians one frame.
export function updateStreetLife(game, dt) {
  for (const car of game.cars) {
    if (car.traffic) updateTrafficCar(game, car, dt);
  }
  for (const ped of game.peds) {
    updatePedestrian(game, ped, dt);
  }
  // Keep the streets full: replace cars and peds that wandered off the map.
  if (game.cars.filter((c) => c.traffic).length < CONFIG.TRAFFIC_CARS) {
    game.cars.push(spawnTrafficCar(game, game.rng));
  }
  if (game.peds.filter((p) => p.state !== 'down').length < CONFIG.PEDESTRIANS) {
    game.peds.push(spawnPedestrian(game, game.rng));
  }
}

// A traffic car drives its road, turns at intersections, and slows for the car ahead.
function updateTrafficCar(game, car, dt) {
  const t = car.traffic;
  t.turnCooldown -= dt;
  const road = nearestRoad(car.x, car.y);
  const onAxis = road.axis === 'x' ? Math.abs(car.y - road.line) < 8 : Math.abs(car.x - road.line) < 8;

  // At an intersection, sometimes turn onto the crossing road.
  if (onAxis && t.turnCooldown <= 0 && game.rng() < 0.35) {
    const turn = game.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    car.angle += turn;
    t.turnCooldown = range(game.rng, 2, 5);
  }

  // Stay in the right-hand lane of the road being driven.
  const targetLane = road.axis === 'x' ? road.line + t.lane : road.line + t.lane;
  if (road.axis === 'x') {
    car.y += clamp(targetLane - car.y, -1, 1) * 60 * dt;
    car.angle = steerToward(car.angle, Math.abs(angleDiffTo(car.angle, 0)) < Math.PI / 2 ? 0 : Math.PI, 1.2 * dt);
  } else {
    car.x += clamp(targetLane - car.x, -1, 1) * 60 * dt;
    car.angle = steerToward(car.angle, Math.abs(angleDiffTo(car.angle, Math.PI / 2)) < Math.PI / 2 ? Math.PI / 2 : -Math.PI / 2, 1.2 * dt);
  }

  // Slow down for a car stopped ahead.
  let desired = t.cruise;
  for (const other of game.cars) {
    if (other === car) continue;
    const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
    const side = Math.abs((other.x - car.x) * -Math.sin(car.angle) + (other.y - car.y) * Math.cos(car.angle));
    if (ahead > 0 && ahead < 70 && side < 30) desired = Math.min(desired, other.speed * 0.9);
  }
  car.speed += clamp(desired - car.speed, -260 * dt, 180 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  // A car that leaves the city is respawned on a random road, so traffic
  // never ends up driving across grass, buildings or the beach.
  if (car.x < -60 || car.x > CONFIG.WORLD_W + 60 || car.y < -60 || car.y > CONFIG.BEACH_Y + 60) {
    respawnTrafficCar(game, car);
    return;
  }

  // A traffic car the player hits hard becomes a brief hazard, then keeps going.
  if (car.damage >= 1) {
    car.damage = 0.6;
    car.speed *= 0.5;
  }
}

// Put a traffic car back on a random road, heading along it.
function respawnTrafficCar(game, car) {
  const p = randomRoadPoint(game.rng);
  const road = nearestRoad(p.x, p.y);
  car.x = p.x;
  car.y = p.y;
  car.angle = road.axis === 'x'
    ? (game.rng() < 0.5 ? 0 : Math.PI)
    : (game.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
  car.speed = car.traffic.cruise;
  car.damage = 0;
}

// Steer `angle` toward `target` by at most `maxStep` radians.
function steerToward(angle, target, maxStep) {
  let d = target - angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return angle + clamp(d, -maxStep, maxStep);
}

function angleDiffTo(angle, target) {
  let d = target - angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// A pedestrian walks, flees from danger, or lies down when hurt badly.
// Thugs are driven by combat.js (updateThugs), not by this walk logic.
function updatePedestrian(game, ped, dt) {
  if (ped.state === 'down' || ped.state === 'thug') return;
  if (ped.state === 'flee') {
    ped.fleeTimer -= dt;
    if (ped.fleeTimer <= 0) ped.state = 'walk';
  }
  // Turn occasionally; fleeing peds run away from the player.
  ped.turnTimer -= dt;
  if (ped.turnTimer <= 0) {
    ped.turnTimer = range(game.rng, 1.5, 4);
    if (ped.state === 'flee') {
      ped.angle = Math.atan2(ped.y - game.player.y, ped.x - game.player.x) + range(game.rng, -0.5, 0.5);
    } else {
      ped.angle += range(game.rng, -1.2, 1.2);
    }
  }
  const speed = ped.state === 'flee' ? ped.speed * 2.4 : ped.speed;
  const nx = ped.x + Math.cos(ped.angle) * speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * speed * dt;
  if (!hitsBuilding(game.city, nx, ny, 10) && ny < CONFIG.WATER_Y - 14) {
    ped.x = nx;
    ped.y = ny;
  } else {
    ped.angle += Math.PI / 2;
  }
  ped.walkCycle += dt * speed * 0.08;
}

// Scare every pedestrian within `radius` of a point: they flee.
export function scarePeds(game, x, y, radius) {
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.fleeTimer = range(game.rng, 2, 4);
      ped.angle = Math.atan2(ped.y - y, ped.x - x);
    }
  }
}

// A traffic car hit by the player: damage, sparks, and its driver may panic.
export function bumpTrafficCar(game, car, impactSpeed) {
  car.damage = clamp(car.damage + impactSpeed / 900, 0, 1);
  car.speed *= 0.55;
  game.effects.crashSparks(car.x, car.y, 6);
  game.audio.crash();
  scarePeds(game, car.x, car.y, 160);
}
