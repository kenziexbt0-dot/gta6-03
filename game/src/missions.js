// Solmarina — the story: seven missions, played in order.
// Mara Voss arrives in Solmarina owing money to Dario Venn. Lena Kade, who runs the
// marina garage, gives her work — and each job pulls her deeper into Venn's world.
// Every mission has an objective line on the HUD, a marker on the minimap, and a
// cash reward. Finishing all seven completes the story.

import { CONFIG } from './config.js';
import { clamp, dist } from './random.js';
import { landmarkCenter } from './world.js';
import { createCar } from './player.js';
import { raiseWanted, clearPolice } from './police.js';

// The mission list. `title` and `brief` are shown to the player; `objective`
// is the short line that stays on the HUD while the mission runs.
export const MISSIONS = [
  {
    id: 1,
    title: 'Welcome to Solmarina',
    brief: 'Lena Kade runs the marina garage. Walk to her office and say hello — she has work for you.',
    objective: 'Meet Lena at the Marina office',
  },
  {
    id: 2,
    title: 'Wheels',
    brief: 'Lena needs a car, any car, brought to Kade Garage. Borrow one from the street — press E next to it.',
    objective: 'Steal a car and bring it to Kade Garage',
  },
  {
    id: 3,
    title: 'Hot Cargo',
    brief: 'Pick up the package at the Old Pier, then deliver it to the Palm Motel. No questions, no stops.',
    objective: 'Collect the package at the Old Pier',
  },
  {
    id: 4,
    title: 'Heat',
    brief: 'Venn’s men tipped off the cops. You are wanted — lose the heat before you can work again.',
    objective: 'Lose your wanted level',
  },
  {
    id: 5,
    title: 'The Courier',
    brief: 'A courier is carrying Venn’s ledger across town. Ram his car until it stops, then grab the briefcase.',
    objective: 'Stop the courier’s car',
  },
  {
    id: 6,
    title: 'Stash Defense',
    brief: 'Venn’s crew is hitting the warehouse. Hold the yard and drive them off — three waves.',
    objective: 'Defend the warehouse — wave 1 of 3',
  },
  {
    id: 7,
    title: 'The Long Way Home',
    brief: 'You have the ledger. The whole city is after you now. Reach the North Bridge safehouse and disappear.',
    objective: 'Reach the North Bridge safehouse',
  },
];

// Fresh mission state.
export function createMissions() {
  return {
    index: 0, // which mission is active (0-based); 7 means the story is done
    stage: 0, // per-mission progress step
    marker: null, // { x, y } the HUD arrow and minimap point at, or null
    packageHeld: false,
    courier: null, // the courier car during mission 5
    courierStopped: false,
    wave: 0, // current defense wave during mission 6
    waveLeft: 0, // thugs still standing in this wave
    thugs: [], // enemy pedestrians during mission 6
    timer: 0,
    done: false,
  };
}

export function currentMission(missions) {
  return missions.index < MISSIONS.length ? MISSIONS[missions.index] : null;
}

export function missionObjective(missions) {
  const mission = currentMission(missions);
  if (!mission) return 'Story complete — Solmarina is yours.';
  if (missions.index === 5) {
    return `Defend the warehouse — wave ${missions.wave + 1} of 3 (${missions.waveLeft} left)`;
  }
  return mission.objective;
}

// Start (or restart) the current mission: place its marker and spawn what it needs.
export function startMission(game) {
  const missions = game.missions;
  const mission = currentMission(missions);
  missions.stage = 0;
  missions.timer = 0;
  if (!mission) {
    missions.marker = null;
    missions.done = true;
    return;
  }
  const city = game.city;
  if (missions.index === 0) {
    missions.marker = landmarkCenter(city.marina);
  } else if (missions.index === 1) {
    missions.marker = landmarkCenter(city.garage);
  } else if (missions.index === 2) {
    missions.marker = landmarkCenter(city.pier);
  } else if (missions.index === 3) {
    missions.marker = null; // the marker is the player: lose the heat wherever you are
  } else if (missions.index === 4) {
    missions.courier = spawnCourierCar(game);
    missions.marker = { x: missions.courier.x, y: missions.courier.y };
    missions.courierStopped = false;
  } else if (missions.index === 5) {
    missions.marker = landmarkCenter(city.warehouse);
    missions.wave = 0;
    missions.waveLeft = 0;
    missions.thugs = [];
    spawnWave(game);
  } else if (missions.index === 6) {
    missions.marker = landmarkCenter(city.bridge);
  }
  game.message(`${mission.title} — ${mission.brief}`);
}

// The courier's car for mission 5: a fast black sedan looping the avenues.
function spawnCourierCar(game) {
  const car = createCar(1420, 900, 0, '#2b2f38', 'sedan');
  car.speed = 260;
  car.traffic = { cruise: 260, turnCooldown: 1, lane: -26 };
  car.courier = true;
  game.cars.push(car);
  return car;
}

// One defense wave for mission 6: thugs arrive on foot at the warehouse yard.
function spawnWave(game) {
  const missions = game.missions;
  const yard = landmarkCenter(game.city.warehouse);
  const count = 3 + missions.wave;
  missions.waveLeft = count;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const thug = {
      x: yard.x + Math.cos(angle) * 260,
      y: yard.y + Math.sin(angle) * 260,
      angle: 0,
      speed: 95 + missions.wave * 12,
      color: '#3a3a3a',
      state: 'thug',
      health: 50 + missions.wave * 20,
      fleeTimer: 0,
      turnTimer: 0,
      walkCycle: 0,
      shootCooldown: 2 + game.rng() * 2,
    };
    missions.thugs.push(thug);
    game.peds.push(thug);
  }
  game.message(`Wave ${missions.wave + 1} of 3 — ${count} of Venn's crew incoming!`);
}

// Complete the current mission: pay out, advance, save, and start the next one.
// The save happens after the index advances, so a loaded game never replays
// the mission that was just finished.
function completeMission(game) {
  const missions = game.missions;
  const mission = currentMission(missions);
  const reward = CONFIG.MISSION_REWARDS[missions.index] || 0;
  game.player.cash += reward;
  game.audio.missionComplete();
  game.message(`${mission.title} complete! +$${reward}`);
  missions.index += 1;
  missions.packageHeld = false;
  missions.courier = null;
  game.saveGame();
  if (missions.index >= MISSIONS.length) {
    missions.done = true;
    missions.marker = null;
    game.message('STORY COMPLETE — Mara owns Solmarina now. Keep playing, or start over.');
    game.audio.missionComplete();
    return;
  }
  startMission(game);
}

// Update the active mission for one frame. Checks objectives and advances stages.
export function updateMissions(game, dt) {
  const missions = game.missions;
  const mission = currentMission(missions);
  if (!mission) return;
  const player = game.player;
  missions.timer += dt;

  if (missions.index === 0) {
    // Reach the marina office on foot or by car.
    if (dist(player.x, player.y, missions.marker.x, missions.marker.y) < 70) completeMission(game);
  } else if (missions.index === 1) {
    // Deliver a stolen car to the garage: drive into the garage yard.
    const garage = landmarkCenter(game.city.garage);
    if (player.driving && dist(player.x, player.y, garage.x, garage.y) < 110) {
      game.message('Lena: "That will do nicely. Keep the change."');
      completeMission(game);
    }
  } else if (missions.index === 2) {
    if (missions.stage === 0) {
      const pier = landmarkCenter(game.city.pier);
      if (dist(player.x, player.y, pier.x, pier.y) < 70) {
        missions.packageHeld = true;
        missions.stage = 1;
        missions.marker = landmarkCenter(game.city.motel);
        game.audio.pickup();
        game.message('Package collected. Deliver it to the Palm Motel.');
      }
    } else if (dist(player.x, player.y, missions.marker.x, missions.marker.y) < 80) {
      completeMission(game);
    }
  } else if (missions.index === 3) {
    // Scripted heat at the start, then the player must lose it.
    if (missions.stage === 0) {
      raiseWanted(game, 2, 'tipped off by Venn’s men');
      missions.stage = 1;
      game.message('The cops are on you. Break line of sight and stay hidden until the stars fade.');
    } else if (game.wanted.level === 0) {
      completeMission(game);
    }
  } else if (missions.index === 4) {
    const courier = missions.courier;
    if (!courier) return;
    missions.marker = { x: courier.x, y: courier.y };
    if (missions.stage === 0) {
      // Ram the courier until its damage stalls it.
      if (courier.damage >= 0.85 || Math.abs(courier.speed) < 5 && courier.damage > 0.5) {
        missions.courierStopped = true;
        missions.stage = 1;
        courier.traffic = null;
        courier.speed = 0;
        game.message('The courier is stopped. Grab the briefcase on foot!');
      }
    } else if (!player.driving && dist(player.x, player.y, courier.x, courier.y) < 50) {
      game.audio.pickup();
      completeMission(game);
    }
  } else if (missions.index === 5) {
    // Count thugs still standing; advance waves until all three are cleared.
    missions.thugs = missions.thugs.filter((t) => t.health > 0 && t.state !== 'down');
    missions.waveLeft = missions.thugs.length;
    if (missions.waveLeft === 0) {
      missions.wave += 1;
      if (missions.wave >= 3) {
        completeMission(game);
      } else {
        spawnWave(game);
      }
    }
  } else if (missions.index === 6) {
    // Final escape: reach the bridge with the heat on.
    if (missions.stage === 0) {
      raiseWanted(game, 3, 'the whole city is after the ledger');
      missions.stage = 1;
    }
    const bridge = landmarkCenter(game.city.bridge);
    if (dist(player.x, player.y, bridge.x, bridge.y) < 90) {
      clearPolice(game);
      completeMission(game);
    }
  }
}
