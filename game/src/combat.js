// Solmarina — combat: punches, gunfire, and the enemies who fight back.
// Shooting is hitscan toward the mouse; thugs shoot back with poor aim. Car
// collisions are handled in player.js and traffic.js, not here.

import { CONFIG } from './config.js';
import { clamp, dist } from './random.js';
import { raiseWanted } from './police.js';
import { hurtPlayer } from './player.js';
import { scarePeds } from './traffic.js';

// A punch: damages the nearest person in front of the player.
export function tryPunch(game) {
  const player = game.player;
  if (player.punchCooldown > 0 || player.driving) return;
  player.punchCooldown = CONFIG.PUNCH_COOLDOWN;
  game.audio.punch();
  const reach = CONFIG.PUNCH_RANGE;
  let victim = null;
  let best = reach;
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    const d = dist(player.x, player.y, ped.x, ped.y);
    if (d > reach) continue;
    // Must be roughly in front of the player.
    const facing = Math.atan2(ped.y - player.y, ped.x - player.x);
    let diff = Math.abs(facing - player.angle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff > 1.2) continue;
    if (d < best) {
      victim = ped;
      best = d;
    }
  }
  if (victim) {
    damagePed(game, victim, CONFIG.PUNCH_DAMAGE, player.x, player.y);
    game.effects.impactStars(victim.x, victim.y);
  }
}

// A gunshot: hitscan from the player toward the mouse cursor (or facing when
// the mouse is unavailable). Hits the first ped, thug or car in the line.
export function tryShoot(game) {
  const player = game.player;
  if (player.gunCooldown > 0 || player.driving) return;
  if (player.ammo <= 0) {
    game.audio.punch();
    game.message('Out of ammo — find a pickup (green crate) or punch instead.');
    player.gunCooldown = 0.4;
    return;
  }
  player.gunCooldown = CONFIG.GUN_COOLDOWN;
  player.ammo -= 1;
  game.audio.shoot();

  const aim = game.aimAngle;
  const ox = player.x;
  const oy = player.y;
  const dx = Math.cos(aim);
  const dy = Math.sin(aim);
  let hitDist = CONFIG.GUN_RANGE;
  let hitPed = null;
  let hitCar = null;

  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    const along = (ped.x - ox) * dx + (ped.y - oy) * dy;
    if (along < 0 || along > hitDist) continue;
    const side = Math.abs((ped.x - ox) * -dy + (ped.y - oy) * dx);
    if (side < 16) {
      hitDist = along;
      hitPed = ped;
      hitCar = null;
    }
  }
  for (const car of game.cars) {
    if (car === player.driving) continue;
    const along = (car.x - ox) * dx + (car.y - oy) * dy;
    if (along < 0 || along > hitDist) continue;
    const side = Math.abs((car.x - ox) * -dy + (car.y - oy) * dx);
    if (side < 26) {
      hitDist = along;
      hitCar = car;
      hitPed = null;
    }
  }

  const endX = ox + dx * hitDist;
  const endY = oy + dy * hitDist;
  game.effects.muzzleFlash(ox + dx * 22, oy + dy * 22);
  game.effects.tracer(ox + dx * 22, oy + dy * 22, endX, endY);

  if (hitPed) damagePed(game, hitPed, CONFIG.GUN_DAMAGE, ox, oy);
  if (hitCar) {
    hitCar.damage = clamp(hitCar.damage + 0.2, 0, 1);
    game.effects.crashSparks(endX, endY, 5);
  }
  scarePeds(game, player.x, player.y, 260);
  // Gunfire in the open draws the law.
  if (game.wanted.level < 2) raiseWanted(game, 1, 'shots fired');
}

// Damage a pedestrian or thug. Knocks them down at 0 health.
export function damagePed(game, ped, amount, fromX, fromY) {
  const wasThug = ped.state === 'thug';
  ped.health -= amount;
  game.effects.impactStars(ped.x, ped.y);
  if (ped.health <= 0) {
    ped.state = 'down';
    ped.health = 0;
    game.effects.impactStars(ped.x, ped.y);
    if (!wasThug) {
      // Harming a civilian is a crime the city remembers.
      if (game.wanted.level < 3) raiseWanted(game, 1, 'assault');
    }
    return;
  }
  // The hurt ped flees — unless it is a thug, who fights back.
  if (ped.state === 'thug') {
    ped.angle = Math.atan2(game.player.y - ped.y, game.player.x - ped.x);
  } else {
    ped.state = 'flee';
    ped.fleeTimer = 3;
    ped.angle = Math.atan2(ped.y - fromY, ped.x - fromX);
  }
}

// Thugs shoot back: poor aim, a visible tracer, and real damage when it lands.
export function updateThugs(game, dt) {
  const player = game.player;
  for (const thug of game.missions.thugs) {
    if (thug.health <= 0 || thug.state === 'down') continue;
    const d = dist(thug.x, thug.y, player.x, player.y);
    // Close in until in range, then stand and shoot.
    if (d > 260) {
      thug.angle = Math.atan2(player.y - thug.y, player.x - thug.x);
      thug.x += Math.cos(thug.angle) * thug.speed * dt;
      thug.y += Math.sin(thug.angle) * thug.speed * dt;
      thug.walkCycle += dt * 6;
    } else {
      thug.shootCooldown -= dt;
      if (thug.shootCooldown <= 0) {
        thug.shootCooldown = 1.6 + game.rng() * 1.2;
        const aim = Math.atan2(player.y - thug.y, player.x - thug.x) + (game.rng() - 0.5) * 0.5;
        game.effects.tracer(thug.x, thug.y, player.x, player.y);
        game.audio.shoot();
        // Roughly one shot in three connects.
        if (game.rng() < 0.35) {
          if (hurtPlayer(game, 9)) game.wasted();
        }
      }
    }
  }
}

// Ammo pickups scattered around the city: green crates that refill the gun.
export function createAmmoPickups(game) {
  const spots = [
    { x: 620, y: 220 + 80 },
    { x: 1420, y: 1240 + 80 },
    { x: 220, y: 900 + 80 },
    { x: 2220, y: 560 + 80 },
    { x: 1020, y: 1580 + 80 },
  ];
  game.pickups = spots.map((s) => ({ x: s.x, y: s.y, taken: false }));
}

// Pick up ammo by walking over a crate.
export function updatePickups(game) {
  const player = game.player;
  for (const pickup of game.pickups) {
    if (pickup.taken) continue;
    if (dist(player.x, player.y, pickup.x, pickup.y) < 30) {
      pickup.taken = true;
      player.ammo += CONFIG.AMMO_PICKUP;
      game.audio.pickup();
      game.message(`Picked up ammo (+${CONFIG.AMMO_PICKUP}).`);
    }
  }
}
