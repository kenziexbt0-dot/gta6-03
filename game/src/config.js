// Solmarina — shared tuning constants for the whole game.
// Every number the systems agree on lives here so a balance change is one edit.
export const CONFIG = {
  // World size in world pixels. The camera shows a 1280x720 window of it.
  WORLD_W: 2600,
  WORLD_H: 2000,
  // Roads: centre lines of the avenue grid. Roads are 116 px wide.
  ROAD_W: 116,
  ROADS_X: [220, 620, 1020, 1420, 1820, 2220],
  ROADS_Y: [220, 560, 900, 1240, 1580],
  // Beach strip along the south edge, then open water.
  BEACH_Y: 1760,
  WATER_Y: 1900,
  // Marina docks on the east edge.
  MARINA_X: 2380,
  // Player on foot.
  WALK_SPEED: 190,
  RUN_SPEED: 300,
  PLAYER_RADIUS: 14,
  PLAYER_HEALTH: 100,
  // Driving.
  CAR_ACCEL: 520,
  CAR_BRAKE: 900,
  CAR_MAX_SPEED: 460,
  CAR_REVERSE_MAX: 160,
  CAR_STEER: 2.6,
  CAR_DRAG: 0.55,
  CAR_LENGTH: 46,
  CAR_WIDTH: 22,
  // Traffic.
  TRAFFIC_CARS: 14,
  TRAFFIC_SPEED_MIN: 110,
  TRAFFIC_SPEED_MAX: 190,
  PEDESTRIANS: 26,
  PED_SPEED_MIN: 28,
  PED_SPEED_MAX: 62,
  // Wanted level.
  WANTED_MAX: 5,
  WANTED_DECAY_SECONDS: 26,
  // Police.
  POLICE_CAR_SPEED: 430,
  POLICE_RAM_DAMAGE: 6,
  BUSTED_HOLD_SECONDS: 2.2,
  // Combat.
  PUNCH_RANGE: 34,
  PUNCH_DAMAGE: 18,
  PUNCH_COOLDOWN: 0.38,
  GUN_DAMAGE: 34,
  GUN_RANGE: 520,
  GUN_COOLDOWN: 0.28,
  START_AMMO: 24,
  AMMO_PICKUP: 12,
  // Missions.
  MISSION_REWARDS: [150, 250, 400, 500, 650, 900, 1500],
  // Save slot.
  SAVE_KEY: 'solmarina-save-v1',
  // Screenshot staging uses this fixed seed so every shot is reproducible.
  SHOT_SEED: 1,
};

// Sun-soaked coastal palette. Everything is drawn flat with a warm light.
export const PALETTE = {
  grass: '#79b264',
  grassDark: '#6aa457',
  sand: '#e9cd8f',
  sandWet: '#d9b878',
  water: '#2fa3c8',
  waterDeep: '#1d7ea6',
  road: '#3c414d',
  roadLine: '#e8d27a',
  sidewalk: '#b7b0a0',
  curb: '#8f887a',
  park: '#5f9e52',
  buildingRoofs: ['#c96f4a', '#d9a441', '#5b8fb0', '#b05b7a', '#7a9a5b', '#a983c9', '#4a7a6f'],
  buildingWall: '#e6ddcb',
  carColors: ['#d94f3d', '#3d7ad9', '#e8c832', '#3da66b', '#8a5fd0', '#e8e8e8', '#2b2f38', '#e08a3c'],
  playerShirt: '#ff5a3c',
  policeBlue: '#2244cc',
  policeWhite: '#f2f2f2',
};

// Key bindings. Mouse aim is used for shooting; everything else is keyboard.
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enterCar: ['KeyE'],
  punch: ['KeyF'],
  shoot: ['Space'],
  pause: ['KeyP', 'Escape'],
  save: ['KeyQ'],
  load: ['KeyL'],
  mute: ['KeyM'],
};
