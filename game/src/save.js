// Solmarina — save and load through localStorage.
// The save holds the player's position, cash, health, ammo, mission progress and
// wanted level. Cars and traffic are rebuilt fresh on load; the story is what
// persists.

import { CONFIG } from './config.js';

// Serialize the game state into a plain object that JSON can hold.
export function serializeGame(game) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    player: {
      x: Math.round(game.player.x),
      y: Math.round(game.player.y),
      angle: game.player.angle,
      health: game.player.health,
      cash: game.player.cash,
      ammo: game.player.ammo,
    },
    missions: {
      index: game.missions.index,
    },
    wanted: {
      level: 0, // a loaded game always starts clean
    },
    seed: game.seed,
  };
}

// Write the current game to localStorage. Returns true on success.
export function saveGameToStorage(game) {
  try {
    const data = serializeGame(game);
    window.localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// Read the save back, or null when there is none or it is unreadable.
export function loadGameFromStorage() {
  try {
    const raw = window.localStorage.getItem(CONFIG.SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !data.player || !data.missions) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSaveInStorage() {
  return loadGameFromStorage() !== null;
}

// Apply a loaded save to a live game: restore the player and the mission,
// rebuild the street, and restart the current mission from its beginning.
export function applySave(game, data) {
  const player = game.player;
  player.x = data.player.x;
  player.y = data.player.y;
  player.angle = data.player.angle;
  player.health = data.player.health;
  player.cash = data.player.cash;
  player.ammo = data.player.ammo;
  player.driving = null;
  game.missions.index = Math.min(data.missions.index, 7);
  game.missions.done = game.missions.index >= 7;
  game.wanted.level = 0;
  game.wanted.heat = 0;
  game.wanted.decayTimer = 0;
  game.wanted.bustedTimer = 0;
  game.cars = game.cars.filter((c) => c.kind !== 'police');
}
