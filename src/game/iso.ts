import { GRID_W, GRID_D, TILE_W, TILE_H } from './constants';

export interface CameraView {
  x: number; // world center offset
  y: number;
  zoom: number;
}

// Tile grid coords -> screen pixel coords (before camera/zoom).
// Origin (0,0) is placed at the top of the diamond. X grows toward
// bottom-right, Y grows toward bottom-left — a standard isometric layout.
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

// A simple deterministic heightmap so the terrain has gentle hills.
export function tileHeight(tileX: number, tileY: number): number {
  const nx = tileX / GRID_W - 0.5;
  const ny = tileY / GRID_D - 0.5;
  const h =
    Math.sin(tileX * 0.42) * 0.5 +
    Math.cos(tileY * 0.37) * 0.5 +
    Math.sin((tileX + tileY) * 0.25) * 0.7 +
    (1 - Math.sqrt(nx * nx + ny * ny) * 2) * 1.2;
  return Math.max(0, h * 6);
}

// Deterministic per-tile decoration seed (trees / rocks).
export function tileDecoration(tileX: number, tileY: number): 'tree' | 'rock' | null {
  if (tileX < 1 || tileY < 1 || tileX > GRID_W - 2 || tileY > GRID_D - 2) return null;
  const n = Math.sin(tileX * 12.9898 + tileY * 78.233) * 43758.5453;
  const v = n - Math.floor(n);
  // Keep the central starting area clear.
  const distFromCenter = Math.abs(tileX - GRID_W / 2) + Math.abs(tileY - GRID_D / 2);
  if (distFromCenter < 5) return null;
  if (v > 0.86) return 'tree';
  if (v > 0.82) return 'rock';
  return null;
}
