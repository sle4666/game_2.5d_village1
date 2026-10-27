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

// Superposition of sinusoids: rolling hills + a central ridge + lowlands.
export function tileHeight(tileX: number, tileY: number): number {
  const nx = tileX / GRID_W - 0.5;
  const ny = tileY / GRID_D - 0.5;
  const h =
    Math.sin(tileX * 0.42) * 0.6 +
    Math.cos(tileY * 0.37) * 0.5 +
    Math.sin((tileX + tileY) * 0.25) * 0.8 +
    Math.sin(tileX * 0.13) * 1.4 +
    Math.cos(tileY * 0.19) * 1.2 +
    (1 - Math.sqrt(nx * nx + ny * ny) * 2) * 1.6;
  return Math.max(0, h * 7);
}

// A winding river: a sine-displaced vertical band crossing the map.
// The river centerline follows x = riverCenter(y) with some width.
const RIVER_BASE_X = GRID_W * 0.45;
const RIVER_WIDTH = 4.5;

export function riverCenterX(tileY: number): number {
  return (
    RIVER_BASE_X +
    Math.sin(tileY * 0.18) * 10 +
    Math.cos(tileY * 0.07) * 6
  );
}

export function isWater(tileX: number, tileY: number): boolean {
  const cx = riverCenterX(tileY);
  const dist = Math.abs(tileX - cx);
  return dist < RIVER_WIDTH / 2;
}

// Trees are scarce: low probability, clustered near the river and in lowlands.
export function tileDecoration(tileX: number, tileY: number): 'tree' | 'rock' | null {
  if (tileX < 1 || tileY < 1 || tileX > GRID_W - 2 || tileY > GRID_D - 2) return null;
  if (isWater(tileX, tileY)) return null;
  const n = Math.sin(tileX * 12.9898 + tileY * 78.233) * 43758.5453;
  const v = n - Math.floor(n);
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
// A tile is passable if it's in bounds, not water (unless a bridge occupies it),
// and not occupied by a building. Bridges are passed in as a set of "x,y" keys.
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

// A* pathfinding. Returns array of {x,y} tiles from start (exclusive) to goal
// (inclusive), or null if no path. Uses Manhattan distance heuristic.
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
    // pick lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    const ck = key(current.x, current.y);
    if (closed.has(ck)) continue;
    closed.add(ck);

    if (current.x === goalX && current.y === goalY) {
      // reconstruct path
      const path: { x: number; y: number }[] = [];
      let n: PathNode | null = current;
      while (n && n.parent) {
        path.unshift({ x: n.x, y: n.y });
        n = n.parent;
      }
      return path;
    }

    // 4-directional neighbors
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      // goal is always reachable even if occupied (the target building)
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

// Helper: collect all built bridge tiles from the game's buildings.
export function collectBridgeTiles(
  bridges: { tileX: number; tileY: number; built: boolean }[]
): Set<string> {
  const set = new Set<string>();
  for (const b of bridges) {
    if (b.built) set.add(`${b.tileX},${b.tileY}`);
  }
  return set;
}
