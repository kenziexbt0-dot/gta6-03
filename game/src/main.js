// Solmarina — boot, game loop and the screen state machine.
// main.js owns the single `game` object every system shares: it builds the city,
// steps the simulation, draws each frame, and moves between the title screen,
// play, pause, wasted and busted. ?shot=... staging lives in shots.js.

import { CONFIG } from './config.js';
import { makeRng, clamp, dist } from './random.js';
import { createInput, attachInput, endFrameInput, readAction } from './input.js';
import {
  createAudio, unlockAudio, setMuted, updateEngineSound,
  playShoot, playPunch, playCrash, playPickup, playMissionComplete,
  playWantedUp, playBusted, playSiren,
} from './audio.js';
import { buildCity } from './world.js';
import { createPlayer, updatePlayer, tryEnterCar, exitCar, hurtPlayer } from './player.js';
import { spawnStreetLife, updateStreetLife, bumpTrafficCar } from './traffic.js';
import { createWanted, updatePolice, clearPolice } from './police.js';
import { createMissions, startMission, updateMissions, currentMission } from './missions.js';
import { tryPunch, tryShoot, updateThugs, updatePickups, createAmmoPickups } from './combat.js';
import { createEffects, bindEffects, updateEffects } from './effects.js';
import { render } from './render.js';
import { readShotParams, stageShot } from './shots.js';
import { saveGameToStorage, loadGameFromStorage, applySave, hasSaveInStorage } from './save.js';
import * as worldModule from './world.js';
import * as trafficModule from './traffic.js';
import * as combatModule from './combat.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');

// Resize the canvas to the window; the game renders at the window's pixels.
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- The game object ---------------------------------------------------------

const audioState = createAudio();
const audio = {
  crash: () => playCrash(audioState),
  pickup: () => playPickup(audioState),
  missionComplete: () => playMissionComplete(audioState),
  wantedUp: () => playWantedUp(audioState),
  busted: () => playBusted(audioState),
  siren: (high) => playSiren(audioState, high),
  shoot: () => playShoot(audioState),
  punch: () => playPunch(audioState),
};

const game = {
  canvas,
  ctx,
  input: createInput(),
  audio,
  audioState,
  seed: CONFIG.SHOT_SEED,
  rng: makeRng(CONFIG.SHOT_SEED),
  city: null,
  player: null,
  cars: [],
  peds: [],
  pickups: [],
  wanted: createWanted(),
  missions: createMissions(),
  effects: createEffects(),
  messages: [],
  screen: 'title',
  time: 0,
  camera: { x: 0, y: 0 },
  aimAngle: 0,
  hasSave: hasSaveInStorage(),
  // Module handles shots.js uses to rebuild the world for a staged screenshot.
  modules: { world: worldModule, traffic: trafficModule, combat: combatModule },
};

bindEffects(game.effects);
attachInput(game.input, canvas);

// A debug handle for automated play-testing (used by the headless test script).
// It exposes the live game object and nothing else.
window.__solmarina = game;

// --- Helpers the systems call back into --------------------------------------

game.message = (text) => {
  game.messages.push({ text, life: 5 });
  if (game.messages.length > 5) game.messages.shift();
  if (statusLine) statusLine.textContent = text;
};

game.saveGame = () => {
  if (saveGameToStorage(game)) {
    game.message('Game saved.');
    game.hasSave = true;
  } else {
    game.message('Could not save — storage is unavailable.');
  }
};

game.wasted = () => {
  if (game.screen !== 'playing') return;
  game.screen = 'wasted';
  game.input.auto = null;
};

game.busted = () => {
  if (game.screen !== 'playing') return;
  game.player.cash = Math.max(0, game.player.cash - 50);
  clearPolice(game);
  game.screen = 'busted';
  game.input.auto = null;
};

// Put Mara back on her feet at the safehouse after wasted / busted.
game.respawn = () => {
  const safe = game.city.safehouse;
  game.player.x = safe.x + safe.w / 2;
  game.player.y = safe.y + safe.h + 30;
  game.player.health = CONFIG.PLAYER_HEALTH;
  game.player.driving = null;
  game.player.speed = 0;
  game.wanted.level = 0;
  game.wanted.bustedTimer = 0;
  game.screen = 'playing';
  game.message('Back on your feet. The story continues.');
};

// Centre the camera on the player, clamped to the world.
game.updateCamera = () => {
  const targetX = clamp(game.player.x - canvas.width / 2, 0, Math.max(0, CONFIG.WORLD_W - canvas.width));
  const targetY = clamp(game.player.y - canvas.height / 2, 0, Math.max(0, CONFIG.WORLD_H - canvas.height));
  game.camera.x += (targetX - game.camera.x) * 0.2;
  game.camera.y += (targetY - game.camera.y) * 0.2;
  // Snap exactly when staging a screenshot so the frame is deterministic.
  if (game.staging) {
    game.camera.x = targetX;
    game.camera.y = targetY;
  }
};

game.renderFrame = () => {
  render(game);
};

// --- Simulation step ----------------------------------------------------------

game.tick = (dt, staging) => {
  game.staging = !!staging;
  const input = game.input;
  const player = game.player;

  // Aim: from the player toward the mouse, in world space.
  const playerScreenX = player.x - game.camera.x;
  const playerScreenY = player.y - game.camera.y;
  game.aimAngle = Math.atan2(input.mouseY - playerScreenY, input.mouseX - playerScreenX);
  if (!input.mouseDown && !staging) {
    // Keyboard-only players aim where they face.
    if (player.driving) game.aimAngle = player.angle;
  }

  // The screenshot autopilot writes its keys into the live input flags.
  if (input.auto) {
    for (const key of ['up', 'down', 'left', 'right', 'run']) {
      input[key] = !!input.auto[key];
    }
  }

  if (!staging) {
    if (input.enterCarPressed) {
      if (player.driving) exitCar(game);
      else tryEnterCar(game);
    }
    if (input.punch) tryPunch(game);
    if (input.shoot || input.mouseClicked) tryShoot(game);
    if (input.pausePressed) {
      if (game.screen === 'playing') game.screen = 'paused';
      else if (game.screen === 'paused') game.screen = 'playing';
    }
    if (input.savePressed) game.saveGame();
    if (input.loadPressed) game.loadSavedGame();
    if (input.mutePressed) {
      setMuted(audioState, !audioState.muted);
      game.message(audioState.muted ? 'Sound muted.' : 'Sound on.');
    }
  }

  if (game.screen !== 'playing') return;

  updatePlayer(game, dt);
  updateStreetLife(game, dt);
  updatePolice(game, dt);
  updateMissions(game, dt);
  updateThugs(game, dt);
  updatePickups(game);
  updateEffects(game.effects, dt);
  collideCars(game);
  collidePlayerWithTraffic(game, dt);

  // Message lifetimes.
  for (const message of game.messages) message.life -= dt;
  game.messages = game.messages.filter((m) => m.life > 0);

  // Engine hum follows the player's car.
  const driving = !!player.driving;
  const speedRatio = driving ? Math.abs(player.driving.speed) / CONFIG.CAR_MAX_SPEED : 0;
  updateEngineSound(audioState, speedRatio, driving);

  game.updateCamera();
};

// The player's car shoving traffic cars, and vice versa.
function collideCars(game) {
  const playerCar = game.player.driving;
  if (!playerCar) return;
  for (const car of game.cars) {
    if (car === playerCar) continue;
    const d = dist(playerCar.x, playerCar.y, car.x, car.y);
    if (d < 44 && d > 0.01) {
      const impact = Math.abs(playerCar.speed - car.speed);
      if (impact > 90) bumpTrafficCar(game, car, impact);
      // Push the cars apart so they do not stick together.
      const push = (44 - d) / 2;
      const nx = (car.x - playerCar.x) / d;
      const ny = (car.y - playerCar.y) / d;
      car.x += nx * push;
      car.y += ny * push;
      playerCar.x -= nx * push;
      playerCar.y -= ny * push;
      playerCar.speed *= 0.92;
    }
  }
}

// A traffic car running over a player on foot.
function collidePlayerWithTraffic(game, dt) {
  const player = game.player;
  if (player.driving || game.screen !== 'playing') return;
  for (const car of game.cars) {
    if (!car.traffic && car.kind !== 'police') continue;
    if (Math.abs(car.speed) < 40) continue;
    if (dist(player.x, player.y, car.x, car.y) < 34) {
      if (hurtPlayerOnce(game, dt)) return;
    }
  }
}

let lastRunOverAt = -10;
function hurtPlayerOnce(game, dt) {
  if (game.time - lastRunOverAt < 1) return false;
  lastRunOverAt = game.time;
  if (hurtPlayer(game, 12)) game.wasted();
  game.audio.crash();
  return true;
}

// Load a saved game and resume it.
game.loadSavedGame = () => {
  const data = loadGameFromStorage();
  if (!data) {
    game.message('No save found yet — press Q to save first.');
    return;
  }
  applySave(game, data);
  startMission(game);
  game.screen = 'playing';
  game.message(`Save loaded — ${data.savedAt.slice(0, 10)}. Mission ${Math.min(game.missions.index + 1, 7)}/7.`);
};

// --- Boot ---------------------------------------------------------------------

function newGame(seed) {
  game.seed = seed;
  game.rng = makeRng(seed);
  game.city = buildCity(seed);
  game.player = createPlayer(game.city);
  game.wanted = createWanted();
  game.missions = createMissions();
  game.effects = createEffects();
  bindEffects(game.effects);
  game.messages = [];
  game.time = 0;
  game.screen = 'title';
  spawnStreetLife(game, seed);
  createAmmoPickups(game);
  startMission(game);
  game.updateCamera();
}

newGame(CONFIG.SHOT_SEED);

// Audio unlocks on the first gesture; screenshots unlock it silently.
window.addEventListener('keydown', () => unlockAudio(audioState), { once: false });
window.addEventListener('mousedown', () => unlockAudio(audioState), { once: false });

// Enter starts the game, resumes from pause, or continues after wasted/busted.
window.addEventListener('keydown', (event) => {
  if (event.code !== 'Enter' && event.code !== 'NumpadEnter') return;
  unlockAudio(audioState);
  if (game.screen === 'title') {
    game.screen = 'playing';
    game.message('Welcome to Solmarina. Follow the yellow marker.');
  } else if (game.screen === 'wasted' || game.screen === 'busted') {
    game.respawn();
  }
});

// L on the title screen continues a save.
window.addEventListener('keydown', (event) => {
  if (event.code !== 'KeyL') return;
  if (game.screen === 'title' && game.hasSave) game.loadSavedGame();
});

// --- Screenshot staging -------------------------------------------------------

const shotParams = readShotParams();
if (shotParams.shot) {
  unlockAudio(audioState);
  stageShot(game, shotParams.shot, shotParams.seed);
} else {
  // --- Main loop --------------------------------------------------------------
  let last = performance.now();
  function frame(now) {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    try {
      if (game.screen === 'playing' || game.screen === 'paused') {
        game.time += dt;
        game.tick(dt, false);
      } else {
        // Menus still animate: the city idles behind them.
        game.time += dt;
        updateEffects(game.effects, dt);
        game.updateCamera();
      }
    } catch (error) {
      // One bad frame must never freeze the game: report it and keep going.
      console.error('Solmarina frame error:', error);
    }
    game.renderFrame();
    endFrameInput(game.input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
