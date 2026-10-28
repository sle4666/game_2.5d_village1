import {
  GRID_D,
  GRID_W,
  SEASON_INFO,
  TILE_H,
  TILE_W,
  BUILDINGS,
  CLASSES,
} from './constants';
import { tileDecoration, tileHeight, tileToScreen, isWater, hashRand, type CameraView } from './iso';
import type { GameState } from './engine';
import type { Agent, BuildingType, PlacedBuilding, ResourceId, Season } from './types';

export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  view: CameraView;
  hoverTile: { x: number; y: number } | null;
  ghostType: BuildingType | null;
  ghostValid: boolean;
}

function darken(hex: string, factor: number): string {
  const c = hex.replace('#', '');
  const r = Math.round(parseInt(c.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(c.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(c.slice(4, 6), 16) * factor);
  return `rgb(${r},${g},${b})`;
}

function lighten(hex: string, factor: number): string {
  const c = hex.replace('#', '');
  const r = Math.min(255, Math.round(parseInt(c.slice(0, 2), 16) * factor));
  const g = Math.min(255, Math.round(parseInt(c.slice(2, 4), 16) * factor));
  const b = Math.min(255, Math.round(parseInt(c.slice(4, 6), 16) * factor));
  return `rgb(${r},${g},${b})`;
}

function tileDiamondPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number
) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - TILE_H / 2);
  ctx.lineTo(cx + TILE_W / 2, cy);
  ctx.lineTo(cx, cy + TILE_H / 2);
  ctx.lineTo(cx - TILE_W / 2, cy);
  ctx.closePath();
}

export function render(rc: RenderContext, state: GameState) {
  const { ctx, width, height, view } = rc;
  const season: Season = state.season;
  const sinfo = SEASON_INFO[season];

  // sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, sinfo.sky);
  sky.addColorStop(1, '#e8eef0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // Draw tiles back-to-front (painter's algorithm). tileX+tileY = depth.
  for (let depth = 0; depth < GRID_W + GRID_D - 2; depth++) {
    for (let x = 0; x < GRID_W; x++) {
      const y = depth - x;
      if (y < 0 || y >= GRID_D) continue;
      drawTile(rc, state, x, y);
    }
  }

  // Draw buildings and agents sorted by depth.
  const sorted = [...state.buildings].sort(
    (a, b) => a.tileX + a.tileY - (b.tileX + b.tileY)
  );
  for (const b of sorted) drawBuilding(rc, b, state);

  // Draw agents sorted by depth (tileX+tileY).
  const sortedAgents = [...state.agents].sort(
    (a, b) => a.tileX + a.tileY - (b.tileX + b.tileY)
  );
  for (const a of sortedAgents) drawAgent(rc, a, state);

  // Ghost placement preview:
  if (rc.hoverTile && rc.ghostType) {
    drawGhost(rc, state, rc.ghostType, rc.hoverTile.x, rc.hoverTile.y, rc.ghostValid);
  }
}

function drawAgent(rc: RenderContext, a: Agent, state: GameState) {
  const { ctx, view } = rc;
  const p = tileToScreen(a.tileX, a.tileY, view);
  const z = view.zoom;
  const info = CLASSES[a.classId];
  const bob = Math.sin(a.phase * Math.PI * 2) * 2 * z;
  const cx = p.x;
  const cy = p.y - 4 * z + bob;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, p.y, 5 * z, 2.5 * z, 0, 0, Math.PI * 2);
  ctx.fill();

  // body (small capsule)
  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 4 * z, 4 * z, 6 * z, 0, 0, Math.PI * 2);
  ctx.fill();

  // head
  ctx.fillStyle = '#e0c8a0';
  ctx.beginPath();
  ctx.arc(cx, cy - 11 * z, 3 * z, 0, Math.PI * 2);
  ctx.fill();

  // carrying indicator — colored square showing which resource is being hauled
  const carryTotal = Object.values(a.carrying).reduce((s, v) => s + (v ?? 0), 0);
  if (carryTotal > 0 || (a.inventory && a.inventory.amount > 0)) {
    const resType: ResourceId | null = a.inventory ? a.inventory.type : null;
    const carryColor = resType ? resourceCarryColor(resType) : '#a9743b';
    ctx.fillStyle = carryColor;
    ctx.fillRect(cx - 3 * z, cy - 17 * z, 6 * z, 4 * z);
    // small outline
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 3 * z, cy - 17 * z, 6 * z, 4 * z);
  }

  // class ring for non-smerd
  if (a.classId !== 'smerd') {
    ctx.strokeStyle = info.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy - 11 * z, 4.5 * z, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawTile(
  rc: RenderContext,
  state: GameState,
  x: number,
  y: number
) {
  const { ctx, view } = rc;
  const sinfo = SEASON_INFO[state.season];
  const water = isWater(x, y);
  const h = water ? 0 : tileHeight(x, y);
  const p = tileToScreen(x, y, view);
  const cx = p.x;
  const cy = p.y - h * view.zoom;

  // --- Water tiles: flat, blue, with ripple ---
  if (water) {
    const ripple = (Math.sin(x * 1.3 + y * 0.7 + state.tick * 0.15) + 1) * 0.5;
    const iceR = state.season === 'winter' ? 235 : 90 + ripple * 30;
    const iceG = state.season === 'winter' ? 240 : 140 + ripple * 30;
    const iceB = state.season === 'winter' ? 245 : 190 + ripple * 25;
    ctx.fillStyle = `rgb(${iceR},${iceG},${iceB})`;
    tileDiamondPath(ctx, cx, cy);
    ctx.fill();
    // subtle ripple lines
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    tileDiamondPath(ctx, cx, cy);
    ctx.stroke();
    // hover highlight
    if (rc.hoverTile && rc.hoverTile.x === x && rc.hoverTile.y === y && !rc.ghostType) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      tileDiamondPath(ctx, cx, cy);
      ctx.fill();
    }
    return;
  }

  // base ground color with slight per-tile variation (seeded, stable)
  const variance = hashRand(x, y, state.mapSeed);
  let base = sinfo.ground;
  if (state.season === 'winter') {
    base = `rgb(${200 + variance * 20},${210 + variance * 18},${220 + variance * 16})`;
  } else if (state.season === 'autumn') {
    base = `rgb(${130 + variance * 30},${110 + variance * 24},${60 + variance * 20})`;
  } else if (state.season === 'summer') {
    base = `rgb(${100 + variance * 30},${140 + variance * 30},${70 + variance * 22})`;
  } else {
    base = `rgb(${100 + variance * 28},${120 + variance * 30},${70 + variance * 22})`;
  }

  // tile left/right walls (for height)
  if (h > 0.5) {
    ctx.fillStyle = `rgba(60,50,40,0.5)`;
    ctx.beginPath();
    ctx.moveTo(cx - TILE_W / 2, cy);
    ctx.lineTo(cx, cy + TILE_H / 2);
    ctx.lineTo(cx, cy + TILE_H / 2 + h * view.zoom);
    ctx.lineTo(cx - TILE_W / 2, cy + h * view.zoom);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(40,32,24,0.55)`;
    ctx.beginPath();
    ctx.moveTo(cx + TILE_W / 2, cy);
    ctx.lineTo(cx, cy + TILE_H / 2);
    ctx.lineTo(cx, cy + TILE_H / 2 + h * view.zoom);
    ctx.lineTo(cx + TILE_W / 2, cy + h * view.zoom);
    ctx.closePath();
    ctx.fill();
  }

  // top face
  ctx.fillStyle = base;
  tileDiamondPath(ctx, cx, cy);
  ctx.fill();

  // grid lines
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  tileDiamondPath(ctx, cx, cy);
  ctx.stroke();

  // hover highlight
  if (rc.hoverTile && rc.hoverTile.x === x && rc.hoverTile.y === y && !rc.ghostType) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    tileDiamondPath(ctx, cx, cy);
    ctx.fill();
  }

  // decoration
  const deco = state.decorations[x][y] ?? tileDecoration(x, y);
  if (deco) drawDecoration(rc, cx, cy, deco, state.season);
}

function drawDecoration(
  rc: RenderContext,
  cx: number,
  cy: number,
  deco: 'tree' | 'rock',
  season: Season
) {
  const { ctx, view } = rc;
  const z = view.zoom;
  if (deco === 'tree') {
    // trunk
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(cx - 2 * z, cy - 4 * z, 4 * z, 8 * z);
    // foliage
    const green = season === 'winter' ? '#5a6f55' : season === 'autumn' ? '#b07a3a' : '#3f6a3a';
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 22 * z);
    ctx.lineTo(cx + 12 * z, cy - 6 * z);
    ctx.lineTo(cx + 8 * z, cy - 4 * z);
    ctx.lineTo(cx + 11 * z, cy);
    ctx.lineTo(cx - 11 * z, cy);
    ctx.lineTo(cx - 8 * z, cy - 4 * z);
    ctx.lineTo(cx - 12 * z, cy - 6 * z);
    ctx.closePath();
    ctx.fill();
    // snow cap
    if (season === 'winter') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - 22 * z);
      ctx.lineTo(cx + 7 * z, cy - 10 * z);
      ctx.lineTo(cx - 7 * z, cy - 10 * z);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // rock
    ctx.fillStyle = season === 'winter' ? '#c7ccd2' : '#8a8f99';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 3 * z, 10 * z, 6 * z, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx + 2 * z, cy - 1 * z, 7 * z, 3 * z, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBuilding(
  rc: RenderContext,
  b: PlacedBuilding,
  state: GameState
) {
  const { ctx, view } = rc;
  const type = BUILDINGS[b.typeId];
  const z = view.zoom;

  // --- Bridge: flat wooden deck on water ---
  if (type.isBridge) {
    const p = tileToScreen(b.tileX, b.tileY, view);
    const cx = p.x;
    const cy = p.y;
    const bw = TILE_W * 0.42 * z;
    const bd = TILE_H * 0.42 * z;
    const built = b.built;

    // deck planks (two slopes of the diamond)
    ctx.fillStyle = built ? '#7a5a34' : '#5a4226';
    ctx.beginPath();
    ctx.moveTo(cx - bw, cy);
    ctx.lineTo(cx, cy + bd);
    ctx.lineTo(cx, cy - bd);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = built ? '#6a4a2a' : '#4a3216';
    ctx.beginPath();
    ctx.moveTo(cx + bw, cy);
    ctx.lineTo(cx, cy + bd);
    ctx.lineTo(cx, cy - bd);
    ctx.closePath();
    ctx.fill();

    // plank lines
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * bw * 0.3, cy - bd);
      ctx.lineTo(cx + i * bw * 0.3, cy + bd);
      ctx.stroke();
    }

    // support posts at corners
    ctx.fillStyle = '#4a3216';
    ctx.fillRect(cx - bw, cy - 3 * z, 2 * z, 6 * z);
    ctx.fillRect(cx + bw - 2 * z, cy - 3 * z, 2 * z, 6 * z);

    // construction progress bar
    if (!built) {
      const barW = bw * 1.4;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(cx - barW / 2, cy - 14 * z, barW, 4 * z);
      ctx.fillStyle = '#7fd06a';
      ctx.fillRect(cx - barW / 2, cy - 14 * z, barW * b.progress, 4 * z);
    }
    return;
  }

  const h = tileHeight(b.tileX, b.tileY);
  const p = tileToScreen(b.tileX, b.tileY, view);
  const cx = p.x + ((type.size.w - type.size.d) * TILE_W) / 4 * view.zoom;
  const cy = p.y - h * view.zoom + ((type.size.w + type.size.d) * TILE_H) / 4 * view.zoom;

  const bw = type.size.w * TILE_W * 0.42 * z;
  const bd = type.size.d * TILE_H * 0.42 * z;
  const wallH = 22 * z * Math.max(1, (type.size.w + type.size.d) / 3);
  const built = b.built;

  // footprint shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, bw, bd, 0, 0, Math.PI * 2);
  ctx.fill();

  // walls (a box drawn as 3 visible faces)
  const bodyColor = built ? type.color : '#9a9a9a';
  const roofColor = built ? type.roof : '#7a7a7a';

  // left wall
  ctx.fillStyle = darken(bodyColor.startsWith('#') ? bodyColor : '#999', 0.75);
  ctx.fillStyle = built ? shade(bodyColor, 0.7) : '#7a7a7a';
  ctx.beginPath();
  ctx.moveTo(cx - bw, cy);
  ctx.lineTo(cx, cy + bd);
  ctx.lineTo(cx, cy + bd - wallH);
  ctx.lineTo(cx - bw, cy - wallH);
  ctx.closePath();
  ctx.fill();

  // right wall
  ctx.fillStyle = built ? shade(bodyColor, 0.55) : '#6a6a6a';
  ctx.beginPath();
  ctx.moveTo(cx + bw, cy);
  ctx.lineTo(cx, cy + bd);
  ctx.lineTo(cx, cy + bd - wallH);
  ctx.lineTo(cx + bw, cy - wallH);
  ctx.closePath();
  ctx.fill();

  // roof (two slopes)
  const roofPeak = cy - wallH - 14 * z * Math.max(1, type.size.w);
  ctx.fillStyle = built ? roofColor : '#888';
  ctx.beginPath();
  ctx.moveTo(cx - bw, cy - wallH);
  ctx.lineTo(cx, cy + bd - wallH);
  ctx.lineTo(cx, roofPeak);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = built ? shade(roofColor.startsWith('#') ? roofColor : '#555', 0.8) : '#777';
  ctx.fillStyle = built ? shade(roofColor, 0.75) : '#777';
  ctx.beginPath();
  ctx.moveTo(cx + bw, cy - wallH);
  ctx.lineTo(cx, cy + bd - wallH);
  ctx.lineTo(cx, roofPeak);
  ctx.closePath();
  ctx.fill();

  // snow on roof in winter
  if (state.season === 'winter' && built) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(cx - bw, cy - wallH);
    ctx.lineTo(cx, cy + bd - wallH);
    ctx.lineTo(cx, roofPeak + 6 * z);
    ctx.lineTo(cx - bw + 4 * z, cy - wallH - 4 * z);
    ctx.closePath();
    ctx.fill();
  }

  // construction progress
  if (!built) {
    // scaffolding bars
    ctx.strokeStyle = 'rgba(200,160,80,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - bw, cy - wallH);
    ctx.lineTo(cx - bw, cy);
    ctx.moveTo(cx + bw, cy - wallH);
    ctx.lineTo(cx + bw, cy);
    ctx.stroke();
    // progress bar
    const barW = bw * 1.6;
    const barX = cx - barW / 2;
    const barY = roofPeak - 12 * z;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, 5 * z);
    ctx.fillStyle = '#7fd06a';
    ctx.fillRect(barX, barY, barW * b.progress, 5 * z);
  }

  // category marker icon (tiny dot)
  if (built) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy - wallH - 2 * z, 2.5 * z, 0, Math.PI * 2);
    ctx.fill();
  }
}

function shade(color: string, factor: number): string {
  if (color.startsWith('#')) {
    return darken(color, factor);
  }
  if (color.startsWith('rgb')) {
    return color;
  }
  return color;
}

function drawGhost(
  rc: RenderContext,
  state: GameState,
  type: BuildingType,
  tileX: number,
  tileY: number,
  valid: boolean
) {
  const { ctx, view } = rc;
  for (let dx = 0; dx < type.size.w; dx++) {
    for (let dy = 0; dy < type.size.d; dy++) {
      const x = tileX + dx;
      const y = tileY + dy;
      if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_D) continue;
      const h = tileHeight(x, y);
      const p = tileToScreen(x, y, view);
      ctx.fillStyle = valid ? 'rgba(110,200,120,0.4)' : 'rgba(210,90,80,0.45)';
      tileDiamondPath(ctx, p.x, p.y - h * view.zoom);
      ctx.fill();
      ctx.strokeStyle = valid ? 'rgba(110,200,120,0.9)' : 'rgba(210,90,80,0.9)';
      ctx.lineWidth = 2;
      tileDiamondPath(ctx, p.x, p.y - h * view.zoom);
      ctx.stroke();
    }
  }
}

function resourceCarryColor(res: ResourceId): string {
  switch (res) {
    case 'wood': return '#a9743b';
    case 'stone': return '#8a8f99';
    case 'ore': return '#c47a5a';
    case 'food': return '#7fae5a';
    case 'skins': return '#b08a55';
    case 'gold': return '#e3c34a';
    case 'faith': return '#d8c06a';
    default: return '#a9743b';
  }
}
