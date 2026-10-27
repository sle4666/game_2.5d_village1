import { GRID_W, GRID_D, TILE_W, TILE_H } from './constants';

export interface CameraView {
  x: number;
  y: number;
  zoom: number;
}

export function tileToScreen(tileX: number, tileY: number, view: CameraView) {
  const sx = (tileX - tileY) * (TILE_W / 2);
  const sy = (tileX + tileY) * (TILE_H / 2);
  return {
    x: sx * view.zoom + view.x,
    y: sy * view.zoom + view.y,
  };
}

export function screenToTile(
  screenX: number,
  screenY: number,
  view: CameraView
): { tileX: number; tileY: number } {
  const lx = (screenX - view.x) / view.zoom;
  const ly = (screenY - view.y) / view.zoom;
  const tileX = (lx / (TILE_W / 2) + ly / (TILE_H / 2)) / 2;
  const tileY = (ly / (TILE_H / 2) - lx / (TILE_W / 2)) / 2;
  return { tileX: Math.floor(tileX), tileY: Math.floor(tileY) };
}

export function inBounds(tileX: number, tileY: number): boolean {
  return tileX >= 0 && tileY >= 0 && tileX < GRID_W && tileY < GRID_D;
}

// --- Seeded procedural terrain ---
// All terrain functions use mapSeed as an offset so each new game
// produces a different river, hills, and tree layout.

let mapSeed = 0;

export function setMapSeed(seed: number): void {
  mapSeed = seed;
}

export function getMapSeed(): number {
  return mapSeed;
}

// Deterministic integer hash PRNG. Stable across frames — no floating-point
// precision drift like Math.sin-based hashes. Returns 0..1.
export function hashRand(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695040) | 0;
  h = ((h ^ (h >>> 13)) * 1274126177) | 0;
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

// Convenience: uses the current module-level mapSeed.
function seededRand(x: number, y: number): number {
  return hashRand(x, y, mapSeed);
}

// Superposition of sinusoids: rolling hills + a central ridge + lowlands.
// All sinusoids are offset by mapSeed so terrain varies per game.
export function tileHeight(tileX: number, tileY: number): number {
  const nx = tileX / GRID_W - 0.5;
  const ny = tileY / GRID_D - 0.5;
  const s = mapSeed * 0.1;
  const h =
    Math.sin((tileX + s) * 0.42) * 0.6 +
    Math.cos((tileY + s * 1.3) * 0.37) * 0.5 +
    Math.sin((tileX + tileY + s) * 0.25) * 0.8 +
    Math.sin((tileX + s * 2) * 0.13) * 1.4 +
    Math.cos((tileY + s * 0.7) * 0.19) * 1.2 +
    (1 - Math.sqrt(nx * nx + ny * ny) * 2) * 1.6;
  return Math.max(0, h * 7);
}

// A winding river: a sine-displaced vertical band crossing the map.
// The river base position and waviness are offset by mapSeed.
const RIVER_WIDTH = 4.5;

export function riverCenterX(tileY: number): number {
  const base = GRID_W * 0.3 + (mapSeed % (GRID_W * 0.4));
  return (
    base +
    Math.sin((tileY + mapSeed * 0.3) * 0.18) * 10 +
    Math.cos((tileY + mapSeed * 0.15) * 0.07) * 6
  );
}

export function isWater(tileX: number, tileY: number): boolean {
  const cx = riverCenterX(tileY);
  const dist = Math.abs(tileX - cx);
  return dist < RIVER_WIDTH / 2;
}

// Trees and rocks: seeded random, clustered near the river and in lowlands.
export function tileDecoration(tileX: number, tileY: number): 'tree' | 'rock' | null {
  if (tileX < 1 || tileY < 1 || tileX > GRID_W - 2 || tileY > GRID_D - 2) return null;
  if (isWater(tileX, tileY)) return null;
  const v = seededRand(tileX, tileY);
  const distFromCenter = Math.abs(tileX - GRID_W / 2) + Math.abs(tileY - GRID_D / 2);
  if (distFromCenter < 6) return null;

  const h = tileHeight(tileX, tileY);
  const riverDist = Math.abs(tileX - riverCenterX(tileY));

  // Trees favor lowlands (low height) and proximity to river.
  const lowlandBonus = h < 8 ? 0.06 : 0;
  const riverBonus = riverDist < 9 ? 0.05 : 0;
  const treeThreshold = 0.9 - lowlandBonus - riverBonus;

  if (v > treeThreshold) return 'tree';
  if (v > 0.93 && h > 14) return 'rock';
  return null;
}

// --- Pathfinding (A* on grid) ---
export function isPassable(
  tileX: number,
  tileY: number,
  bridgeTiles: Set<string>
): boolean {
  if (!inBounds(tileX, tileY)) return false;
  if (isWater(tileX, tileY)) {
    return bridgeTiles.has(`${tileX},${tileY}`);
  }
  return true;
}

interface PathNode {
  x: number;
  y: number;
  g: number;
  f: number;
  parent: PathNode | null;
}

export function findPath(
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
  bridgeTiles: Set<string>,
  occupied: boolean[][]
): { x: number; y: number }[] | null {
  if (!inBounds(startX, startY) || !inBounds(goalX, goalY)) return null;
  const key = (x: number, y: number) => `${x},${y}`;
  const open: PathNode[] = [];
  const closed = new Set<string>();
  const startNode: PathNode = { x: startX, y: startY, g: 0, f: 0, parent: null };
  open.push(startNode);

  let iterations = 0;
  const MAX_ITER = 2000;

  while (open.length > 0 && iterations < MAX_ITER) {
    iterations++;
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    const ck = key(current.x, current.y);
    if (closed.has(ck)) continue;
    closed.add(ck);

    if (current.x === goalX && current.y === goalY) {
      const path: { x: number; y: number }[] = [];
      let n: PathNode | null = current;
      while (n && n.parent) {
        path.unshift({ x: n.x, y: n.y });
        n = n.parent;
      }
      return path;
    }

    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const isGoal = nx === goalX && ny === goalY;
      if (!isPassable(nx, ny, bridgeTiles)) continue;
      if (!isGoal && occupied[nx] && occupied[nx][ny]) continue;
      const g = current.g + 1;
      const h = Math.abs(nx - goalX) + Math.abs(ny - goalY);
      const f = g + h;
      open.push({ x: nx, y: ny, g, f, parent: current });
    }
  }
  return null;
}

export function collectBridgeTiles(
  bridges: { tileX: number; tileY: number; built: boolean }[]
): Set<string> {
  const set = new Set<string>();
  for (const b of bridges) {
    if (b.built) set.add(`${b.tileX},${b.tileY}`);
  }
  return set;
}
