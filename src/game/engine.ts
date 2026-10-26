import type {
  BuildingType,
  BuildingTypeId,
  DifficultyConfig,
  PlacedBuilding,
  ResourceId,
  Season,
} from './types';
import {
  BUILDINGS,
  DAYS_PER_SEASON,
  DIFFICULTIES,
  GRID_D,
  GRID_W,
  RESOURCE_ORDER,
  SEASON_INFO,
  SEASON_ORDER,
  TICKS_PER_DAY,
  isWinter,
} from './constants';
import { inBounds } from './iso';

export interface GameState {
  difficulty: DifficultyConfig;
  resources: Record<ResourceId, number>;
  buildings: PlacedBuilding[];
  occupied: boolean[][]; // grid of occupied tiles
  decorations: ('tree' | 'rock' | null)[][];
  season: Season;
  day: number; // day within season (0-based)
  tick: number; // tick within day (0-based)
  totalDays: number;
  speed: number; // 0 paused, 1 normal, 2 fast
  nextUid: number;
  log: string[];
  gameOver: boolean;
  gameOverReason: string;
  housingUsed: number;
  population: number;
}

function emptyGrid<T>(value: T): T[][] {
  const g: T[][] = [];
  for (let x = 0; x < GRID_W; x++) {
    const col: T[] = [];
    for (let y = 0; y < GRID_D; y++) col.push(value);
    g.push(col);
  }
  return g;
}

export function createGame(difficultyId: string): GameState {
  const difficulty = DIFFICULTIES[difficultyId as keyof typeof DIFFICULTIES] ?? DIFFICULTIES.normal;
  const resources: Record<ResourceId, number> = {
    wood: 0,
    stone: 0,
    ore: 0,
    food: 0,
    skins: 0,
    faith: 0,
    gold: 0,
    workers: 0,
  };
  for (const id of RESOURCE_ORDER) {
    const v = difficulty.startResources[id];
    if (v) resources[id] = v;
  }
  // decorations imported lazily to avoid cycle in SSR
  const decorations: ('tree' | 'rock' | null)[][] = emptyGrid(null);
  for (let x = 0; x < GRID_W; x++) {
    for (let y = 0; y < GRID_D; y++) {
      decorations[x][y] = decorationFor(x, y);
    }
  }
  return {
    difficulty,
    resources,
    buildings: [],
    occupied: emptyGrid(false),
    decorations,
    season: 'spring',
    day: 0,
    tick: 0,
    totalDays: 0,
    speed: 1,
    nextUid: 1,
    log: ['Поселение основано. Да хранят нас духи леса.'],
    gameOver: false,
    gameOverReason: '',
    housingUsed: 0,
    population: resources.workers,
  };
}

function decorationFor(x: number, y: number): 'tree' | 'rock' | null {
  if (x < 1 || y < 1 || x > GRID_W - 2 || y > GRID_D - 2) return null;
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  const v = n - Math.floor(n);
  const distFromCenter = Math.abs(x - GRID_W / 2) + Math.abs(y - GRID_D / 2);
  if (distFromCenter < 5) return null;
  if (v > 0.86) return 'tree';
  if (v > 0.82) return 'rock';
  return null;
}

export function canPlace(
  state: GameState,
  type: BuildingType,
  tileX: number,
  tileY: number
): boolean {
  for (let dx = 0; dx < type.size.w; dx++) {
    for (let dy = 0; dy < type.size.d; dy++) {
      const x = tileX + dx;
      const y = tileY + dy;
      if (!inBounds(x, y)) return false;
      if (state.occupied[x][y]) return false;
    }
  }
  return true;
}

export function placeBuilding(
  state: GameState,
  typeId: BuildingTypeId,
  tileX: number,
  tileY: number
): PlacedBuilding | null {
  const type = BUILDINGS[typeId];
  if (!canPlace(state, type, tileX, tileY)) return null;
  // check cost
  for (const [id, amount] of Object.entries(type.cost)) {
    if (state.resources[id as ResourceId] < (amount ?? 0)) return null;
  }
  // pay
  for (const [id, amount] of Object.entries(type.cost)) {
    state.resources[id as ResourceId] -= amount ?? 0;
  }
  const b: PlacedBuilding = {
    uid: state.nextUid++,
    typeId,
    tileX,
    tileY,
    progress: 0,
    built: false,
  };
  for (let dx = 0; dx < type.size.w; dx++) {
    for (let dy = 0; dy < type.size.d; dy++) {
      state.occupied[tileX + dx][tileY + dy] = true;
    }
  }
  state.buildings.push(b);
  state.log.unshift(`Начато строительство: ${type.name}.`);
  if (state.log.length > 8) state.log.pop();
  return b;
}

function buildingFootprint(b: PlacedBuilding) {
  return BUILDINGS[b.typeId];
}

export function recomputeHousing(state: GameState) {
  let housing = 0;
  for (const b of state.buildings) {
    if (!b.built) continue;
    const t = BUILDINGS[b.typeId];
    if (t.housing) housing += t.housing;
  }
  state.housingUsed = housing;
}

// One game tick (called every TICK_MS / speed).
export function tick(state: GameState): GameState {
  if (state.gameOver || state.speed === 0) return state;

  const next = state;
  next.tick += 1;

  // advance construction
  for (const b of next.buildings) {
    if (b.built) continue;
    const t = BUILDINGS[b.typeId];
    b.progress += 1 / t.buildTicks;
    if (b.progress >= 1) {
      b.progress = 1;
      b.built = true;
      next.log.unshift(`${t.name} построена.`);
      if (next.log.length > 8) next.log.pop();
      recomputeHousing(next);
    }
  }

  // production / consumption per tick
  if (next.tick % TICKS_PER_DAY === 0) {
    // end of a day: apply daily production
    applyDailyProduction(next);
    next.day += 1;
    next.totalDays += 1;
    if (next.day >= DAYS_PER_SEASON) {
      next.day = 0;
      const idx = SEASON_ORDER.indexOf(next.season);
      next.season = SEASON_ORDER[(idx + 1) % SEASON_ORDER.length];
      next.log.unshift(`Наступила ${SEASON_INFO[next.season].name.toLowerCase()}.`);
      if (next.log.length > 8) next.log.pop();
      onSeasonChange(next);
    }
    // survival check
    survivalCheck(next);
  }

  return next;
}

function applyDailyProduction(state: GameState) {
  const winter = isWinter(state.season);
  const cfg = state.difficulty;

  // count assigned workers demand vs supply
  let workerDemand = 0;
  const gains: Partial<Record<ResourceId, number>> = {};
  const costs: Partial<Record<ResourceId, number>> = {};

  for (const b of state.buildings) {
    if (!b.built) continue;
    const t = BUILDINGS[b.typeId];
    if (t.produces) {
      for (const [id, amt] of Object.entries(t.produces)) {
        let v = amt ?? 0;
        // farms don't produce in winter
        if (t.id === 'farm' && winter) v = 0;
        // hunter hut reduced in winter
        if (t.id === 'huntersHut' && winter) v *= 0.5;
        // apply difficulty gather rate for raw resources
        if (id === 'wood') v *= cfg.woodGatherRate;
        if (id === 'food') v *= cfg.foodGatherRate;
        gains[id as ResourceId] = (gains[id as ResourceId] ?? 0) + v;
      }
    }
    if (t.consumes) {
      for (const [id, amt] of Object.entries(t.consumes)) {
        if (id === 'workers') {
          workerDemand += amt ?? 0;
        } else {
          costs[id as ResourceId] = (costs[id as ResourceId] ?? 0) + (amt ?? 0);
        }
      }
    }
  }

  // worker assignment: each consuming building wants workers; if not enough,
  // production scales down.
  const availableWorkers = state.resources.workers;
  const workerRatio =
    workerDemand === 0 ? 1 : Math.min(1, availableWorkers / workerDemand);

  for (const id of RESOURCE_ORDER) {
    if (gains[id]) state.resources[id] += (gains[id] ?? 0) * workerRatio;
  }
  for (const id of Object.keys(costs) as ResourceId[]) {
    state.resources[id] = Math.max(0, state.resources[id] - (costs[id] ?? 0) * workerRatio);
  }

  // population growth: if food surplus and housing available, slowly grow
  recomputeHousing(state);
  const housingSpace = state.housingUsed - state.population;
  if (
    !winter &&
    state.resources.food > 20 &&
    housingSpace > 0 &&
    state.population < 50
  ) {
    if (Math.random() < 0.15) {
      state.resources.workers += 1;
      state.population += 1;
      state.log.unshift('В деревне родился новый житель.');
      if (state.log.length > 8) state.log.pop();
    }
  }
}

function onSeasonChange(state: GameState) {
  if (isWinter(state.season)) {
    const sev = state.difficulty.winterSeverity;
    state.log.unshift(`Зима пришла. Расход дров утроен. Берегите припасы!`);
    if (state.log.length > 8) state.log.pop();
    // heating cost: 3x wood per day per population
    const heat = Math.ceil(state.population * 1.5 * sev);
    state.resources.wood = Math.max(0, state.resources.wood - heat);
    void heat;
  }
}

function survivalCheck(state: GameState) {
  if (state.gameOver) return;
  if (state.resources.food <= 0) {
    // starvation
    state.resources.workers = Math.max(0, state.resources.workers - 1);
    state.population = Math.max(0, state.population - 1);
    state.log.unshift('Голод! Житель погиб от истощения.');
    if (state.log.length > 8) state.log.pop();
  }
  if (isWinter(state.season) && state.resources.wood <= 0) {
    state.resources.workers = Math.max(0, state.resources.workers - 1);
    state.population = Math.max(0, state.population - 1);
    state.log.unshift('Мороз! Житель замёрз без дров.');
    if (state.log.length > 8) state.log.pop();
  }
  if (state.population <= 0) {
    state.gameOver = true;
    state.gameOverReason = 'Деревня вымерла. Последний житель покинул эти земли.';
  }
}

export function seasonName(s: Season): string {
  return SEASON_INFO[s].name;
}
