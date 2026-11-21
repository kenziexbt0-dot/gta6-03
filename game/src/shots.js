// Solmarina — deterministic screenshot staging for ?shot=...&seed=N.
// Each named shot rebuilds the world from a fixed seed, plays it forward a fixed
// number of steps with a simple autopilot, and then raises window.__shotReady so
// a headless browser knows the frame is final. Nothing here is random at run
// time: the same URL always renders the same picture.

import { CONFIG } from './config.js';
import { makeRng } from './random.js';
import { raiseWanted } from './police.js';
import { startMission } from './missions.js';

// The four shots the entry ships. `name` is the query value, `file` the name
// the screenshot script saves it under.
export const SHOTS = [
  { name: 'start', file: '1-start.jpg', label: 'Title screen over the city' },
  { name: 'play', file: '2-play.jpg', label: 'Driving through Solmarina with HUD and minimap' },
  { name: 'chase', file: '3-chase.jpg', label: 'Police chase at wanted level 3' },
  { name: 'mission', file: '4-mission.jpg', label: 'Mission in progress with the objective on the HUD' },
];

// Read the ?shot= and ?seed= query parameters.
export function readShotParams() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = Number(params.get('seed') || CONFIG.SHOT_SEED);
  return { shot, seed: Number.isFinite(seed) ? seed : CONFIG.SHOT_SEED };
}

// Stage one shot, then step the world forward. Called once by main.js before
// the first rendered frame when ?shot= is present.
export function stageShot(game, shotName, seed) {
  game.seed = seed;
  game.rng = makeRng(seed + 1000);
  // Rebuild the city and the street from the shot seed.
  const { buildCity } = game.modules.world;
  game.city = buildCity(seed);
  game.modules.traffic.spawnStreetLife(game, seed);
  game.modules.combat.createAmmoPickups(game);
  game.missions.index = 0;
  game.missions.done = false;
  game.player.health = CONFIG.PLAYER_HEALTH;
  game.player.cash = 120;
  game.player.ammo = CONFIG.START_AMMO;
  game.messages = []; // drop the boot mission's message so the shot shows one line

  if (shotName === 'start') {
    // Title screen: Mara on foot by the marina, city behind her.
    game.screen = 'title';
    game.player.x = game.city.marina.x + 110;
    game.player.y = game.city.marina.y + game.city.marina.h + 60;
    game.player.angle = -Math.PI / 2;
    stepWorld(game, 90);
  } else if (shotName === 'play') {
    // Driving down the main avenue, mission 1 active, traffic around.
    game.screen = 'playing';
    game.missions.index = 0;
    startMission(game);
    const car = game.cars.find((c) => c.traffic);
    game.player.driving = car;
    car.traffic = null;
    car.x = 1020;
    car.y = 1240;
    car.angle = -Math.PI / 2;
    car.speed = 260;
    game.player.x = car.x;
    game.player.y = car.y;
    game.input.auto = { up: true, left: false, right: false, down: false };
    stepWorld(game, 150);
    game.input.auto = null;
  } else if (shotName === 'chase') {
    // Wanted 3, three police cars closing in on a speeding Mara.
    game.screen = 'playing';
    game.missions.index = 6;
    startMission(game);
    // Undo the mission's own heat raise, then set exactly 3 stars, and mark
    // the mission's heat step done so the tick does not raise it again.
    game.wanted.level = 0;
    game.missions.stage = 1;
    raiseWanted(game, 3, 'stolen ledger');
    const car = game.cars.find((c) => c.traffic);
    game.player.driving = car;
    car.traffic = null;
    car.x = 1020;
    car.y = 900;
    car.angle = 0;
    car.speed = 330;
    game.player.x = car.x;
    game.player.y = car.y;
    // Stage the pursuit: line the police cars up behind the player on the
    // same avenue so the chase is in frame from the first step.
    const policeCars = game.cars.filter((c) => c.kind === 'police');
    policeCars.forEach((cop, i) => {
      cop.x = car.x - 260 - i * 110;
      cop.y = 900 + (i % 2 === 0 ? 28 : -28);
      cop.angle = 0;
      cop.speed = 380;
      cop.chasing = true;
    });
    game.input.auto = { up: true, left: false, right: false, down: false };
    stepWorld(game, 130);
    game.input.auto = null;
  } else if (shotName === 'mission') {
    // Mission 3 in progress: the package waits at the Old Pier, Mara on foot.
    game.screen = 'playing';
    game.missions.index = 2;
    startMission(game);
    game.player.x = game.city.pier.x + 40;
    game.player.y = game.city.pier.y - 120;
    game.player.angle = Math.PI / 2;
    game.player.driving = null;
    stepWorld(game, 60);
  } else {
    // Unknown shot: play normally from the title screen.
    game.screen = 'title';
    stepWorld(game, 30);
  }

  // Centre the camera on the player and render twice, then signal readiness.
  game.updateCamera(0);
  game.renderFrame();
  game.renderFrame();
  window.__shotReady = true;
}

// Advance the simulation a fixed number of 1/60s steps with the autopilot's
// input applied. Deterministic: the same seed always lands in the same place.
function stepWorld(game, steps) {
  const dt = 1 / 60;
  for (let i = 0; i < steps; i += 1) {
    game.tick(dt, true);
    game.time += dt;
  }
}
