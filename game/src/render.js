// Solmarina — everything the player sees: the city, the cars, the people, the
// HUD, the minimap and the menus. One camera follows the player; the world is
// drawn in layers (ground, roads, buildings, entities, effects, HUD).

import { CONFIG, PALETTE } from './config.js';
import { clamp, dist } from './random.js';
import { groundAt } from './world.js';
import { MISSIONS, missionObjective } from './missions.js';
import { drawEffects } from './effects.js';

// Draw one frame of the game into the canvas context.
export function render(game) {
  const ctx = game.ctx;
  const canvas = game.canvas;
  const player = game.player;
  const camera = game.camera;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#79b264';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawGround(ctx, game);
  drawRoads(ctx, game);
  drawLandmarks(ctx, game);
  drawBuildings(ctx, game);
  drawTrees(ctx, game);
  drawPickups(ctx, game);
  drawMissionMarker(ctx, game);
  drawCars(ctx, game);
  drawPeds(ctx, game);
  drawEffects(ctx, game.effects);
  drawPlayer(ctx, game);
  ctx.restore();

  drawHud(ctx, game);
  if (game.screen === 'title') drawTitleScreen(ctx, game);
  if (game.screen === 'paused') drawPauseScreen(ctx, game);
  if (game.screen === 'wasted' || game.screen === 'busted') drawEndScreen(ctx, game);
  if (player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255, 40, 40, ${player.hurtFlash * 0.45})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// --- World layers -----------------------------------------------------------

function drawGround(ctx, game) {
  const city = game.city;
  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, CONFIG.WORLD_W, CONFIG.BEACH_Y);
  // Park lawn.
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
  // Beach sand and the sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, CONFIG.BEACH_Y, CONFIG.WORLD_W, CONFIG.WATER_Y - CONFIG.BEACH_Y);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, CONFIG.WATER_Y, CONFIG.WORLD_W, CONFIG.WORLD_H - CONFIG.WATER_Y);
  // Gentle wave lines at the water's edge.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  const wavePhase = game.time * 0.7;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    for (let x = 0; x <= CONFIG.WORLD_W; x += 80) {
      const y = CONFIG.WATER_Y + 8 + i * 26 + Math.sin(x * 0.01 + wavePhase + i) * 4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawRoads(ctx, game) {
  const half = CONFIG.ROAD_W / 2;
  ctx.fillStyle = PALETTE.road;
  for (const rx of CONFIG.ROADS_X) ctx.fillRect(rx - half, 0, CONFIG.ROAD_W, CONFIG.BEACH_Y);
  for (const ry of CONFIG.ROADS_Y) ctx.fillRect(0, ry - half, CONFIG.WORLD_W, CONFIG.ROAD_W);
  // Sidewalks: pale strips along each road.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of CONFIG.ROADS_X) {
    ctx.fillRect(rx - half - 12, 0, 12, CONFIG.BEACH_Y);
    ctx.fillRect(rx + half, 0, 12, CONFIG.BEACH_Y);
  }
  for (const ry of CONFIG.ROADS_Y) {
    ctx.fillRect(0, ry - half - 12, CONFIG.WORLD_W, 12);
    ctx.fillRect(0, ry + half, CONFIG.WORLD_W, 12);
  }
  // Centre dashes.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.beginPath();
  for (const rx of CONFIG.ROADS_X) {
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx, CONFIG.BEACH_Y);
  }
  for (const ry of CONFIG.ROADS_Y) {
    ctx.moveTo(0, ry);
    ctx.lineTo(CONFIG.WORLD_W, ry);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLandmarks(ctx, game) {
  const city = game.city;
  // Marina water basin and docks.
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(city.marina.x, city.marina.y, city.marina.w, city.marina.h);
  ctx.fillStyle = '#a9835b';
  for (const dock of city.docks) ctx.fillRect(dock.x, dock.y, dock.w, dock.h);
  // Marina office, motel, garage, warehouse, safehouse: labelled blocks.
  drawLabelledBlock(ctx, city.marina.x - 40, city.marina.y - 60, 120, 44, '#e8e0cc', 'MARINA OFFICE');
  drawLabelledBlock(ctx, city.motel.x, city.motel.y, city.motel.w, city.motel.h, '#d9a441', 'PALM MOTEL');
  drawLabelledBlock(ctx, city.garage.x, city.garage.y, city.garage.w, city.garage.h, '#5b8fb0', 'KADE GARAGE');
  drawLabelledBlock(ctx, city.warehouse.x, city.warehouse.y, city.warehouse.w, city.warehouse.h, '#8a7a6a', 'VENN WAREHOUSE');
  drawLabelledBlock(ctx, city.safehouse.x, city.safehouse.y, city.safehouse.w, city.safehouse.h, '#7a9a5b', 'SAFEHOUSE');
  // Pier jutting into the sea.
  ctx.fillStyle = '#a9835b';
  ctx.fillRect(city.pier.x, city.pier.y, city.pier.w, city.pier.h);
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(city.pier.x, city.pier.y + city.pier.h, 12, 60);
  ctx.fillRect(city.pier.x + city.pier.w - 12, city.pier.y + city.pier.h, 12, 60);
  // North bridge.
  ctx.fillStyle = '#6a6f7a';
  ctx.fillRect(city.bridge.x, city.bridge.y, city.bridge.w, city.bridge.h);
  ctx.fillStyle = '#e8d27a';
  ctx.fillRect(city.bridge.x, city.bridge.y + city.bridge.h / 2 - 2, city.bridge.w, 4);
}

function drawLabelledBlock(ctx, x, y, w, h, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 4, y + 5, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2b2b2b';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 4);
}

function drawBuildings(ctx, game) {
  for (const b of game.city.buildings) {
    // Soft shadow, then walls, then a coloured roof with windows.
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = PALETTE.buildingWall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        ctx.fillRect(b.x + 10 + c * 26, b.y + 10 + r * 26, 10, 12);
      }
    }
  }
}

function drawTrees(ctx, game) {
  for (const tree of game.city.trees) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.arc(tree.x + 3, tree.y + 4, tree.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4d8a3f';
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6ab054';
    ctx.beginPath();
    ctx.arc(tree.x - 3, tree.y - 3, tree.size * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPickups(ctx, game) {
  for (const pickup of game.pickups) {
    if (pickup.taken) continue;
    const bob = Math.sin(game.time * 3 + pickup.x) * 2;
    ctx.fillStyle = '#2fae5f';
    ctx.fillRect(pickup.x - 12, pickup.y - 12 + bob, 24, 24);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AMMO', pickup.x, pickup.y + 4 + bob);
  }
}

// The mission marker: a pulsing beacon and a ground ring at the target.
function drawMissionMarker(ctx, game) {
  const marker = game.missions.marker;
  if (!marker || game.screen !== 'playing') return;
  const pulse = 1 + Math.sin(game.time * 4) * 0.15;
  ctx.strokeStyle = '#ffd23c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 210, 60, 0.25)';
  ctx.beginPath();
  ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
  ctx.fill();
  // A tall beam so the target is visible from across the city.
  const gradient = ctx.createLinearGradient(marker.x, marker.y - 260, marker.x, marker.y);
  gradient.addColorStop(0, 'rgba(255, 210, 60, 0)');
  gradient.addColorStop(1, 'rgba(255, 210, 60, 0.35)');
  ctx.fillStyle = gradient;
  ctx.fillRect(marker.x - 8, marker.y - 260, 16, 260);
}

// --- Entities ----------------------------------------------------------------

function drawCars(ctx, game) {
  for (const car of game.cars) {
    drawCar(ctx, car, game.time);
  }
  if (game.player.driving) drawCar(ctx, game.player.driving, game.time);
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const halfL = CONFIG.CAR_LENGTH / 2;
  const halfW = CONFIG.CAR_WIDTH / 2;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-halfL + 3, -halfW + 4, CONFIG.CAR_LENGTH, CONFIG.CAR_WIDTH);
  // Wheels.
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(-halfL + 4, -halfW - 3, 10, 6);
  ctx.fillRect(-halfL + 4, halfW - 3, 10, 6);
  ctx.fillRect(halfL - 14, -halfW - 3, 10, 6);
  ctx.fillRect(halfL - 14, halfW - 3, 10, 6);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -halfL, -halfW, CONFIG.CAR_LENGTH, CONFIG.CAR_WIDTH, 7);
  ctx.fill();
  // Taxi checker stripe.
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(-halfL + 6, -halfW, CONFIG.CAR_LENGTH - 12, 7);
    ctx.fillStyle = '#222';
    for (let i = 0; i < 5; i += 1) ctx.fillRect(-halfL + 8 + i * 7, -halfW, 3, 7);
  }
  // Windshield and rear window.
  ctx.fillStyle = '#bfe3ee';
  ctx.fillRect(halfL - 18, -halfW + 4, 8, CONFIG.CAR_WIDTH - 8);
  ctx.fillRect(-halfL + 6, -halfW + 4, 7, CONFIG.CAR_WIDTH - 8);
  // Police livery: white doors, light bar.
  if (car.kind === 'police') {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-6, -halfW + 2, 14, CONFIG.CAR_WIDTH - 4);
    ctx.fillStyle = car.sirenHigh ? '#ff3b30' : '#2f6bff';
    ctx.fillRect(-2, -halfW - 1, 5, 5);
    ctx.fillStyle = car.sirenHigh ? '#2f6bff' : '#ff3b30';
    ctx.fillRect(-2, halfW - 4, 5, 5);
  }
  // Damage smoke.
  if (car.damage > 0.55) {
    ctx.fillStyle = 'rgba(120,120,120,0.6)';
    ctx.beginPath();
    ctx.arc(-halfL + 4 + Math.sin(time * 9) * 2, 0, 6 + car.damage * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPeds(ctx, game) {
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      // Lying flat.
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 13, 7, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const bob = Math.sin(ped.walkCycle) * 2;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body and head.
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
    // Thugs wear a dark band so the player can tell them apart.
    if (ped.state === 'thug') {
      ctx.strokeStyle = '#ff3b30';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    void bob;
  }
}

function drawPlayer(ctx, game) {
  const player = game.player;
  if (player.driving) return; // the car drawing shows the player
  const bob = player.moving ? Math.sin(player.walkCycle) * 2 : 0;
  ctx.save();
  ctx.translate(player.x, player.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Red jacket, dark jeans, facing the movement direction.
  ctx.fillStyle = PALETTE.playerShirt;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b3a55';
  ctx.beginPath();
  ctx.arc(Math.cos(player.angle) * 4, Math.sin(player.angle) * 4, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(Math.cos(player.angle) * 7, Math.sin(player.angle) * 7, 5, 0, Math.PI * 2);
  ctx.fill();
  // Aim line while shooting.
  if (!player.driving && (game.input.mouseDown || game.input.shoot)) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(game.aimAngle) * 40, Math.sin(game.aimAngle) * 40);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// --- HUD ----------------------------------------------------------------------

function drawHud(ctx, game) {
  const canvas = game.canvas;
  const player = game.player;
  if (game.screen === 'title') return;
  const pad = 14;

  // Top-left: cash, health bar, ammo.
  ctx.textAlign = 'left';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(pad - 6, pad - 6, 220, 118);
  ctx.fillStyle = '#7dff8a';
  ctx.fillText(`$${player.cash}`, pad, pad + 24);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('HEALTH', pad, pad + 46);
  ctx.fillStyle = '#333';
  ctx.fillRect(pad + 62, pad + 35, 140, 12);
  ctx.fillStyle = player.health > 30 ? '#4dd35a' : '#ff3b30';
  ctx.fillRect(pad + 62, pad + 35, 140 * (player.health / 100), 12);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText(`AMMO ${player.ammo}`, pad, pad + 68);
  if (player.driving) {
    const speed = Math.round(Math.abs(player.driving.speed) * 0.36);
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${speed} km/h`, pad, pad + 92);
  }

  // Top-right: wanted stars.
  ctx.textAlign = 'right';
  ctx.font = 'bold 26px sans-serif';
  let stars = '';
  for (let i = 0; i < CONFIG.WANTED_MAX; i += 1) stars += i < game.wanted.level ? '★' : '☆';
  ctx.fillStyle = game.wanted.level > 0 ? '#ffcf4d' : 'rgba(255,255,255,0.75)';
  ctx.fillText(stars, canvas.width - pad - 10, pad + 26);

  // Minimap, under the stars.
  drawMinimap(ctx, game, canvas.width - 214, pad + 40, 200, 154);

  // Bottom: current mission objective.
  const objective = missionObjective(game.missions);
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px sans-serif';
  const mission = game.missions.index < MISSIONS.length ? MISSIONS[game.missions.index] : null;
  const missionLabel = mission ? `MISSION ${mission.id}/7 — ${mission.title}` : 'STORY COMPLETE';
  const text = `${missionLabel}: ${objective}`;
  const textW = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(canvas.width / 2 - textW / 2 - 14, canvas.height - 52, textW + 28, 34);
  ctx.fillStyle = '#ffd23c';
  ctx.fillText(text, canvas.width / 2, canvas.height - 29);

  // Controls hint, bottom-left.
  ctx.textAlign = 'left';
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const hint = player.driving
    ? 'W/S drive · A/D steer · E exit car · P pause · Q save'
    : 'WASD move · Shift run · E enter car · F punch · Click/Space shoot · P pause · Q save';
  ctx.fillText(hint, pad, canvas.height - 12);

  // Message feed, above the objective bar.
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px sans-serif';
  game.messages.slice(-3).forEach((message, i) => {
    const alpha = clamp(message.life / 1.5, 0, 1);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillText(message.text, canvas.width / 2, canvas.height - 66 - (2 - i) * 22);
  });

  // Off-screen mission marker arrow at the screen edge.
  drawMarkerArrow(ctx, game);
}

// The minimap: the whole city shrunk into a corner box.
function drawMinimap(ctx, game, x, y, w, h) {
  const sx = w / CONFIG.WORLD_W;
  const sy = h / CONFIG.WORLD_H;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x, y + CONFIG.WATER_Y * sy, w, h - CONFIG.WATER_Y * sy);
  ctx.fillStyle = PALETTE.road;
  for (const rx of CONFIG.ROADS_X) ctx.fillRect(x + rx * sx - 1, y, 2, h);
  for (const ry of CONFIG.ROADS_Y) ctx.fillRect(x, y + ry * sy - 1, w, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (const b of game.city.buildings) ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  // Mission marker: pulsing yellow diamond.
  const marker = game.missions.marker;
  if (marker) {
    const pulse = 5 + Math.sin(game.time * 5) * 2;
    ctx.fillStyle = '#ffd23c';
    ctx.beginPath();
    ctx.arc(x + marker.x * sx, y + marker.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police: blue dots. Player: white triangle.
  ctx.fillStyle = '#2f6bff';
  for (const car of game.cars) {
    if (car.kind !== 'police') continue;
    ctx.beginPath();
    ctx.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const player = game.player;
  ctx.save();
  ctx.translate(x + player.x * sx, y + player.y * sy);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North arrow and border.
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', x + 2, y + 10);
}

// Arrow at the screen edge pointing toward an off-screen mission marker.
function drawMarkerArrow(ctx, game) {
  const marker = game.missions.marker;
  if (!marker || game.screen !== 'playing') return;
  const camera = game.camera;
  const canvas = game.canvas;
  const screenX = marker.x - camera.x;
  const screenY = marker.y - camera.y;
  if (screenX > 40 && screenX < canvas.width - 40 && screenY > 40 && screenY < canvas.height - 40) return;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const angle = Math.atan2(screenY - cy, screenX - cx);
  const ax = cx + Math.cos(angle) * (Math.min(canvas.width, canvas.height) / 2 - 70);
  const ay = cy + Math.sin(angle) * (Math.min(canvas.width, canvas.height) / 2 - 70);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffd23c';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  const d = Math.round(dist(game.player.x, game.player.y, marker.x, marker.y));
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${d}m`, ax, ay + 26);
}

// --- Screens ------------------------------------------------------------------

function panel(ctx, canvas, w, h) {
  ctx.fillStyle = 'rgba(8, 18, 32, 0.82)';
  ctx.fillRect(canvas.width / 2 - w / 2, canvas.height / 2 - h / 2, w, h);
  ctx.strokeStyle = '#ffd23c';
  ctx.lineWidth = 2;
  ctx.strokeRect(canvas.width / 2 - w / 2, canvas.height / 2 - h / 2, w, h);
}

function drawTitleScreen(ctx, game) {
  const canvas = game.canvas;
  // Warm sunset wash over the city behind the panel.
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, 'rgba(255, 150, 60, 0.18)');
  gradient.addColorStop(1, 'rgba(20, 40, 90, 0.35)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  panel(ctx, canvas, 620, 430);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMARINA', cx, cy - 120);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('A sun-soaked open-world crime story', cx, cy - 88);
  ctx.fillStyle = '#cfe8ff';
  ctx.font = '15px sans-serif';
  ctx.fillText('Mara Voss owes Dario Venn money. Lena Kade has work.', cx, cy - 58);
  ctx.fillText('Steal cars, lose the cops, run seven missions — and get out clean.', cx, cy - 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('WASD move / drive · E enter car · F punch · Click shoot · P pause · Q save', cx, cy + 8);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 20px sans-serif';
  const blink = Math.sin(game.time * 3) > -0.2;
  if (blink) ctx.fillText(game.hasSave ? 'Press ENTER to play — or L to continue your save' : 'Press ENTER to play', cx, cy + 52);
  ctx.fillStyle = '#9fb6cc';
  ctx.font = '13px sans-serif';
  ctx.fillText('An original game. No real city, person or brand appears in it.', cx, cy + 92);
  ctx.fillText('Sound is synthesized live — no audio files.', cx, cy + 114);
}

function drawPauseScreen(ctx, game) {
  const canvas = game.canvas;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  panel(ctx, canvas, 460, 260);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('PAUSED', cx, cy - 60);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#cfe8ff';
  ctx.fillText('P or Esc — resume', cx, cy - 20);
  ctx.fillText('Q — save game   ·   L — load save', cx, cy + 6);
  ctx.fillText('M — mute sound', cx, cy + 32);
  ctx.fillStyle = '#ffd23c';
  ctx.fillText(`Mission ${Math.min(game.missions.index + 1, 7)}/7 · $${game.player.cash} · ${'★'.repeat(game.wanted.level)}${'☆'.repeat(5 - game.wanted.level)}`, cx, cy + 66);
}

function drawEndScreen(ctx, game) {
  const canvas = game.canvas;
  ctx.fillStyle = game.screen === 'wasted' ? 'rgba(60,0,0,0.6)' : 'rgba(0,0,60,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  panel(ctx, canvas, 520, 300);
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = game.screen === 'wasted' ? '#ff6b5e' : '#7db8ff';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText(game.screen === 'wasted' ? 'WASTED' : 'BUSTED', cx, cy - 70);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText(game.screen === 'wasted'
    ? 'Mara went down. The city keeps moving without her.'
    : 'The Solmarina PD caught up with Mara. She posts bail — and starts over.', cx, cy - 30);
  ctx.fillStyle = '#ffd23c';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`You kept $${game.player.cash} and your mission progress.`, cx, cy + 6);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 20px sans-serif';
  const blink = Math.sin(game.time * 3) > -0.2;
  if (blink) ctx.fillText('Press ENTER to continue', cx, cy + 48);
  ctx.fillStyle = '#9fb6cc';
  ctx.font = '13px sans-serif';
  ctx.fillText('Tip: lose the stars by breaking line of sight and staying hidden.', cx, cy + 84);
}
