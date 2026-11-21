// Solmarina — the city itself: roads, blocks, buildings, beach, marina and park.
// buildCity is pure: given a seed it returns the same city every time.

import { CONFIG, PALETTE } from './config.js';
import { makeRng, range, rangeInt, pick } from './random.js';

// Build the whole city from a seed. Returns the city object the game keeps.
export function buildCity(seed) {
  const rng = makeRng(seed);
  const city = {
    seed,
    buildings: [],
    trees: [],
    lamps: [],
    docks: [],
    park: null,
    garage: null,
    motel: null,
    pier: null,
    warehouse: null,
    safehouse: null,
    bridge: null,
  };

  // Landmark rectangles, placed on the grid so missions can point at them.
  city.marina = { x: 2260, y: 1240, w: 220, h: 300, label: 'Solmarina Marina' };
  city.pier = { x: 1080, y: 1820, w: 180, h: 60, label: 'Old Pier' };
  city.warehouse = { x: 1420, y: 560, w: 200, h: 130, label: 'Venn Warehouse' };
  city.motel = { x: 620, y: 900, w: 150, h: 110, label: 'Palm Motel' };
  city.garage = { x: 1820, y: 220, w: 170, h: 120, label: 'Kade Garage' };
  city.safehouse = { x: 220, y: 220, w: 140, h: 110, label: 'Safehouse' };
  city.bridge = { x: 220, y: 60, w: 120, h: 90, label: 'North Bridge' };
  city.park = { x: 1020, y: 1240, w: 380, h: 300, label: 'Palm Park' };

  const landmarks = [city.marina, city.pier, city.warehouse, city.motel, city.garage, city.safehouse, city.bridge, city.park];

  // Fill every block between roads with buildings, skipping landmark plots.
  const xs = [0, ...CONFIG.ROADS_X, CONFIG.WORLD_W];
  const ys = [0, ...CONFIG.ROADS_Y, CONFIG.BEACH_Y];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const blockX0 = xs[bi] + CONFIG.ROAD_W / 2 + 14;
      const blockX1 = xs[bi + 1] - CONFIG.ROAD_W / 2 - 14;
      const blockY0 = ys[bj] + CONFIG.ROAD_W / 2 + 14;
      const blockY1 = ys[bj + 1] - CONFIG.ROAD_W / 2 - 14;
      if (blockX1 - blockX0 < 90 || blockY1 - blockY0 < 80) continue;
      // One or two buildings per block, placed on a jittered sub-grid.
      const cols = rangeInt(rng, 1, 2);
      const rows = rangeInt(rng, 1, 2);
      const cellW = (blockX1 - blockX0) / cols;
      const cellH = (blockY1 - blockY0) / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const w = range(rng, cellW * 0.55, cellW * 0.82);
          const h = range(rng, cellH * 0.55, cellH * 0.82);
          const x = blockX0 + c * cellW + (cellW - w) / 2 + range(rng, -8, 8);
          const y = blockY0 + r * cellH + (cellH - h) / 2 + range(rng, -8, 8);
          const rect = { x, y, w, h };
          if (landmarks.some((mark) => rectsOverlap(rect, mark))) continue;
          city.buildings.push({
            x, y, w, h,
            roof: pick(rng, PALETTE.buildingRoofs),
            floors: rangeInt(rng, 1, 4),
            windows: rangeInt(rng, 2, 5),
          });
        }
      }
    }
  }

  // Palm trees along the beach and in the park.
  for (let i = 0; i < 46; i += 1) {
    city.trees.push({
      x: range(rng, 40, CONFIG.WORLD_W - 40),
      y: range(rng, CONFIG.BEACH_Y + 12, CONFIG.WATER_Y - 30),
      size: range(rng, 7, 12),
    });
  }
  for (let i = 0; i < 18; i += 1) {
    city.trees.push({
      x: range(rng, city.park.x + 16, city.park.x + city.park.w - 16),
      y: range(rng, city.park.y + 16, city.park.y + city.park.h - 16),
      size: range(rng, 8, 13),
    });
  }

  // Street lamps at road intersections.
  for (const rx of CONFIG.ROADS_X) {
    for (const ry of CONFIG.ROADS_Y) {
      city.lamps.push({ x: rx + CONFIG.ROAD_W / 2 + 6, y: ry - CONFIG.ROAD_W / 2 - 6 });
      city.lamps.push({ x: rx - CONFIG.ROAD_W / 2 - 6, y: ry + CONFIG.ROAD_W / 2 + 6 });
    }
  }

  // Marina docks jutting east into the water-side strip.
  for (let i = 0; i < 4; i += 1) {
    city.docks.push({ x: 2400, y: 1300 + i * 70, w: 130, h: 16 });
  }

  return city;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Is this world point on a road (including the intersection squares)?
export function isOnRoad(x, y) {
  const half = CONFIG.ROAD_W / 2;
  if (CONFIG.ROADS_X.some((rx) => Math.abs(x - rx) <= half)) return true;
  if (CONFIG.ROADS_Y.some((ry) => Math.abs(y - ry) <= half)) return true;
  return false;
}

// Is this point on the beach sand or in the water?
export function groundAt(x, y) {
  if (y >= CONFIG.WATER_Y) return 'water';
  if (y >= CONFIG.BEACH_Y) return 'sand';
  if (isOnRoad(x, y)) return 'road';
  return 'grass';
}

// The nearest road centre line to a point, and which way it runs: axis 'x'
// is a road that runs east-west (its line is a y coordinate), axis 'y' a road
// that runs north-south (its line is an x coordinate).
export function nearestRoad(x, y) {
  let bestX = CONFIG.ROADS_X[0];
  for (const rx of CONFIG.ROADS_X) if (Math.abs(x - rx) < Math.abs(x - bestX)) bestX = rx;
  let bestY = CONFIG.ROADS_Y[0];
  for (const ry of CONFIG.ROADS_Y) if (Math.abs(y - ry) < Math.abs(y - bestY)) bestY = ry;
  if (Math.abs(x - bestX) < Math.abs(y - bestY)) return { axis: 'y', line: bestX };
  return { axis: 'x', line: bestY };
}

// A point on the nearest road, snapped to its centre line.
export function snapToRoad(x, y) {
  const road = nearestRoad(x, y);
  if (road.axis === 'x') return { x, y: road.line };
  return { x: road.line, y };
}

// Does a circle at (x, y) with radius r hit any building?
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Random point on a road, for spawning traffic and parked cars.
export function randomRoadPoint(rng) {
  if (rng() < 0.5) {
    return { x: pick(rng, CONFIG.ROADS_X) + range(rng, -24, 24), y: range(rng, 120, CONFIG.BEACH_Y - 120) };
  }
  return { x: range(rng, 120, CONFIG.WORLD_W - 120), y: pick(rng, CONFIG.ROADS_Y) + range(rng, -24, 24) };
}

// Random point on a sidewalk (just off a road), for spawning pedestrians.
export function randomSidewalkPoint(rng) {
  const p = randomRoadPoint(rng);
  const road = nearestRoad(p.x, p.y);
  if (road.axis === 'x') return { x: p.x + (rng() < 0.5 ? -1 : 1) * (CONFIG.ROAD_W / 2 + 12), y: p.y };
  return { x: p.x, y: p.y + (rng() < 0.5 ? -1 : 1) * (CONFIG.ROAD_W / 2 + 12) };
}

// Centre of a named landmark rectangle.
export function landmarkCenter(mark) {
  return { x: mark.x + mark.w / 2, y: mark.y + mark.h / 2 };
}
