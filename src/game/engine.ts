import type {
  Agent,
  AgentState,
  BuildingType,
  BuildingTypeId,
  CitizenClass,
  DifficultyConfig,
  Guest,
  PlacedBuilding,
  ResourceId,
  Season,
} from './types';
import {
  BUILDINGS,
  CLASSES,
  DAYS_PER_SEASON,
  DIFFICULTIES,
  GRID_D,
  GRID_W,
  GUEST_NAMES,
  GUEST_ORIGINS,
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
  occupied: boolean[][];
  decorations: ('tree' | 'rock' | null)[][];
  agents: Agent[];
  guests: Guest[];
  season: Season;
  day: number;
  tick: number;
  totalDays: number;
  speed: number;
  nextUid: number;
  log: string[];
  gameOver: boolean;
  gameOverReason: string;
  housingUsed: number;
  population: number;
  // class counts
  classCounts: Record<CitizenClass, number>;
  // training queue: days remaining per trainee
  training: { daysLeft: number }[];
  masterPool: { classId: CitizenClass }[]; // unassigned masters available
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

export function createGame(difficultyId: string): GameState {
  const difficulty = DIFFICULTIES[difficultyId as keyof typeof DIFFICULTIES] ?? DIFFICULTIES.normal;
  const resources: Record<ResourceId, number> = {
    wood: 0, stone: 0, ore: 0, food: 0, skins: 0, faith: 0, gold: 0, workers: 0,
  };
  for (const id of RESOURCE_ORDER) {
    const v = difficulty.startResources[id];
    if (v) resources[id] = v;
  }
  const decorations: ('tree' | 'rock' | null)[][] = emptyGrid(null);
  for (let x = 0; x < GRID_W; x++) {
    for (let y = 0; y < GRID_D; y++) decorations[x][y] = decorationFor(x, y);
  }
  const classCounts: Record<CitizenClass, number> = { smerd: 0, craftsman: 0, otrok: 0, volkhv: 0 };
  classCounts.smerd = resources.workers;
  return {
    difficulty,
    resources,
    buildings: [],
    occupied: emptyGrid(false),
    decorations,
    agents: [],
    guests: [],
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
    classCounts,
    training: [],
    masterPool: [],
  };
}

// --- Placement ---
export function canPlace(state: GameState, type: BuildingType, tileX: number, tileY: number): boolean {
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
  const neededMaterials: Partial<Record<ResourceId, number>> = {};
  // construction materials are a fraction of cost, delivered by agents
  for (const [id, amount] of Object.entries(type.cost)) {
    const mat = id as ResourceId;
    if (mat === 'workers') continue;
    neededMaterials[mat] = Math.ceil((amount ?? 0) * 0.6);
  }
  const b: PlacedBuilding = {
    uid: state.nextUid++,
    typeId,
    tileX,
    tileY,
    progress: 0,
    built: false,
    hasMaster: false,
    storedMaterials: {},
    neededMaterials,
  };
  for (let dx = 0; dx < type.size.w; dx++) {
    for (let dy = 0; dy < type.size.d; dy++) {
      state.occupied[tileX + dx][tileY + dy] = true;
    }
  }
  state.buildings.push(b);
  state.log.unshift(`Начато строительство: ${type.name}.`);
  if (state.log.length > 10) state.log.pop();
  return b;
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

// Find nearest warehouse (source of materials) to a given tile.
function findNearestWarehouse(state: GameState, tileX: number, tileY: number): PlacedBuilding | null {
  let best: PlacedBuilding | null = null;
  let bestDist = Infinity;
  for (const b of state.buildings) {
    if (!b.built) continue;
    const t = BUILDINGS[b.typeId];
    if (!t.storesResources) continue;
    const d = Math.abs(b.tileX - tileX) + Math.abs(b.tileY - tileY);
    if (d < bestDist) { bestDist = d; best = b; }
  }
  return best;
}

// Assign free smerds as builders to construction sites.
function assignBuilders(state: GameState) {
  const freeBuilders = state.agents.filter(
    (a) => a.classId === 'smerd' && a.state === 'idle' && a.jobType === 'builder'
  );
  const sites = state.buildings.filter((b) => !b.built);
  for (const site of sites) {
    const needsMaterials = hasUnmetMaterials(site);
    const warehouse = needsMaterials ? findNearestWarehouse(state, site.tileX, site.tileY) : null;
    // assign up to 2 builders per site
    const assigned = state.agents.filter(
      (a) => a.targetUid === site.uid && a.state !== 'idle'
    ).length;
    if (assigned >= 2) continue;
    const free = freeBuilders.find(
      (a) => a.state === 'idle' && !state.agents.some((o) => o.uid !== a.uid && o.targetUid === site.uid && o.state !== 'idle' && o.state !== 'returning')
    );
    if (!free) continue;
    if (needsMaterials && warehouse) {
      free.state = 'toSite';
      free.targetUid = warehouse.uid; // go to warehouse first
      free.carrying = {};
    } else {
      free.state = 'toSite';
      free.targetUid = site.uid;
      free.carrying = {};
    }
  }
}

function hasUnmetMaterials(b: PlacedBuilding): boolean {
  for (const [id, needed] of Object.entries(b.neededMaterials)) {
    const have = b.storedMaterials[id as ResourceId] ?? 0;
    if (have < (needed ?? 0)) return true;
  }
  return false;
}

// Move agents toward their target building tile.
function moveAgents(state: GameState) {
  for (const a of state.agents) {
    if (a.state === 'idle' || a.state === 'working') continue;
    const target = state.buildings.find((b) => b.uid === a.targetUid);
    if (!target) { a.state = 'idle'; a.targetUid = -1; continue; }
    const tType = BUILDINGS[target.typeId];
    const tx = target.tileX + tType.size.w / 2;
    const ty = target.tileY + tType.size.d / 2;
    const dx = tx - a.tileX;
    const dy = ty - a.tileY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const winter = isWinter(state.season);
    const speed = winter ? 0.06 : 0.1;
    a.phase = (a.phase + speed) % 1;
    if (dist < 0.3) {
      // arrived — handle based on what target is
      onAgentArrive(state, a, target);
    } else {
      a.tileX += (dx / dist) * speed;
      a.tileY += (dy / dist) * speed;
    }
  }
}

function onAgentArrive(state: GameState, a: Agent, target: PlacedBuilding) {
  const tType = BUILDINGS[target.typeId];
  // If target is warehouse: pick up materials for the site
  if (tType.storesResources) {
    // find a site that needs materials
    const sites = state.buildings.filter((b) => !b.built && hasUnmetMaterials(b));
    if (sites.length === 0) {
      a.state = 'returning';
      a.targetUid = a.homeUid > 0 ? a.homeUid : -1;
      return;
    }
    // pick nearest site
    let site = sites[0];
    let bestD = Infinity;
    for (const s of sites) {
      const d = Math.abs(s.tileX - target.tileX) + Math.abs(s.tileY - target.tileY);
      if (d < bestD) { bestD = d; site = s; }
    }
    // load one material type
    const carrying: Partial<Record<ResourceId, number>> = {};
    for (const [id, needed] of Object.entries(site.neededMaterials)) {
      const have = site.storedMaterials[id as ResourceId] ?? 0;
      const short = (needed ?? 0) - have;
      if (short > 0 && state.resources[id as ResourceId] > 0) {
        const take = Math.min(short, state.resources[id as ResourceId], 3);
        state.resources[id as ResourceId] -= take;
        carrying[id as ResourceId] = take;
        break;
      }
    }
    a.carrying = carrying;
    a.targetUid = site.uid;
    a.state = 'toSite';
    return;
  }
  // If target is a construction site: deliver materials / build
  if (!target.built) {
    // deliver carried materials
    if (a.carrying) {
      for (const [id, amt] of Object.entries(a.carrying)) {
        target.storedMaterials[id as ResourceId] = (target.storedMaterials[id as ResourceId] ?? 0) + (amt ?? 0);
      }
      a.carrying = {};
    }
    // if still needs materials, go back to warehouse
    if (hasUnmetMaterials(target)) {
      const wh = findNearestWarehouse(state, target.tileX, target.tileY);
      if (wh) {
        a.targetUid = wh.uid;
        a.state = 'toSite';
      } else {
        // no warehouse yet — work in place slowly
        a.state = 'working';
      }
    } else {
      // all materials delivered — build
      a.state = 'working';
    }
    return;
  }
  // arrived home
  a.state = 'idle';
  a.targetUid = -1;
}

// Progress construction for agents in "working" state at sites with all materials.
function advanceConstruction(state: GameState) {
  for (const b of state.buildings) {
    if (b.built) continue;
    const t = BUILDINGS[b.typeId];
    const workers = state.agents.filter(
      (a) => a.targetUid === b.uid && a.state === 'working'
    );
    if (workers.length === 0) continue;
    if (hasUnmetMaterials(b)) continue;
    b.progress += workers.length / t.buildTicks;
    if (b.progress >= 1) {
      b.progress = 1;
      b.built = true;
      state.log.unshift(`${t.name} построена.`);
      if (state.log.length > 10) state.log.pop();
      recomputeHousing(state);
      // release workers
      for (const w of workers) {
        w.state = 'returning';
        w.targetUid = w.homeUid > 0 ? w.homeUid : -1;
      }
      // assign master if needed
      if (t.requiresMaster && t.masterClass) {
        const master = state.masterPool.find((m) => m.classId === t.masterClass);
        if (master) {
          b.hasMaster = true;
          state.masterPool.splice(state.masterPool.indexOf(master), 1);
        }
      }
    }
  }
}

// Assign worker-agents to production buildings.
function assignWorkers(state: GameState) {
  const freeWorkers = state.agents.filter(
    (a) => a.classId === 'smerd' && a.state === 'idle' && a.jobType === 'worker'
  );
  if (freeWorkers.length === 0) return;
  for (const b of state.buildings) {
    if (!b.built) continue;
    const t = BUILDINGS[b.typeId];
    if (!t.consumes || !t.consumes.workers) continue;
    if (t.requiresMaster && !b.hasMaster) continue;
    const assigned = state.agents.filter(
      (a) => a.assignedBuildingUid === b.uid && a.state !== 'idle'
    ).length;
    const need = t.consumes.workers;
    if (assigned >= need) continue;
    const free = freeWorkers.find((a) => a.state === 'idle');
    if (!free) break;
    free.assignedBuildingUid = b.uid;
    free.targetUid = b.uid;
    free.state = 'toSite';
  }
}

// --- Tick ---
export function tick(state: GameState): GameState {
  if (state.gameOver || state.speed === 0) return state;
  state.tick += 1;

  // agent logic every tick
  assignBuilders(state);
  assignWorkers(state);
  moveAgents(state);
  advanceConstruction(state);

  if (state.tick % TICKS_PER_DAY === 0) {
    applyDailyProduction(state);
    advanceTraining(state);
    maybeSpawnGuest(state);
    updateGuests(state);
    state.day += 1;
    state.totalDays += 1;
    if (state.day >= DAYS_PER_SEASON) {
      state.day = 0;
      const idx = SEASON_ORDER.indexOf(state.season);
      state.season = SEASON_ORDER[(idx + 1) % SEASON_ORDER.length];
      state.log.unshift(`Наступила ${SEASON_INFO[state.season].name.toLowerCase()}.`);
      if (state.log.length > 10) state.log.pop();
      onSeasonChange(state);
    }
    survivalCheck(state);
    growPopulation(state);
  }
  return state;
}

function applyDailyProduction(state: GameState) {
  const winter = isWinter(state.season);
  const cfg = state.difficulty;
  let workerDemand = 0;
  const gains: Partial<Record<ResourceId, number>> = {};
  const costs: Partial<Record<ResourceId, number>> = {};

  for (const b of state.buildings) {
    if (!b.built) continue;
    const t = BUILDINGS[b.typeId];
    if (t.requiresMaster && !b.hasMaster) continue;
    if (t.produces) {
      for (const [id, amt] of Object.entries(t.produces)) {
        let v = amt ?? 0;
        if (t.id === 'farm' && winter) v = 0;
        if (t.id === 'huntersHut' && winter) v *= 0.5;
        if (id === 'wood') v *= cfg.woodGatherRate;
        if (id === 'food') v *= cfg.foodGatherRate;
        gains[id as ResourceId] = (gains[id as ResourceId] ?? 0) + v;
      }
    }
    if (t.consumes) {
      for (const [id, amt] of Object.entries(t.consumes)) {
        if (id === 'workers') workerDemand += amt ?? 0;
        else costs[id as ResourceId] = (costs[id as ResourceId] ?? 0) + (amt ?? 0);
      }
    }
  }
  const availableWorkers = state.agents.filter(
    (a) => a.assignedBuildingUid > 0 && a.state !== 'idle'
  ).length;
  const workerRatio = workerDemand === 0 ? 1 : Math.min(1, availableWorkers / workerDemand);
  for (const id of RESOURCE_ORDER) {
    if (gains[id]) state.resources[id] += (gains[id] ?? 0) * workerRatio;
  }
  for (const id of Object.keys(costs) as ResourceId[]) {
    state.resources[id] = Math.max(0, state.resources[id] - (costs[id] ?? 0) * workerRatio);
  }
}

function advanceTraining(state: GameState) {
  if (state.training.length === 0) return;
  const foodCost = 2;
  if (state.resources.food < foodCost) {
    state.log.unshift('Обучение приостановлено: не хватает пищи.');
    if (state.log.length > 10) state.log.pop();
    return;
  }
  state.resources.food -= foodCost;
  for (let i = state.training.length - 1; i >= 0; i--) {
    state.training[i].daysLeft -= 1;
    if (state.training[i].daysLeft <= 0) {
      state.training.splice(i, 1);
      state.masterPool.push({ classId: 'craftsman' });
      state.classCounts.craftsman += 1;
      state.log.unshift('Смерд обучен и стал Ремесленником!');
      if (state.log.length > 10) state.log.pop();
    }
  }
}

export function startTraining(state: GameState): boolean {
  if (state.classCounts.smerd <= 0) return false;
  if (state.resources.food < 16) return false;
  state.classCounts.smerd -= 1;
  state.training.push({ daysLeft: 8 });
  state.log.unshift('Смерд отправлен в училище.');
  if (state.log.length > 10) state.log.pop();
  return true;
}

function maybeSpawnGuest(state: GameState) {
  // ~10% chance per day in non-winter, less in winter
  const chance = isWinter(state.season) ? 0.04 : 0.1;
  if (Math.random() > chance) return;
  const ni = Math.floor(Math.random() * GUEST_NAMES.length);
  const oi = Math.floor(Math.random() * GUEST_ORIGINS.length);
  const kinds: Guest['kind'][] = ['envoy', 'merchant', 'refugee'];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const g: Guest = {
    uid: state.nextUid++,
    name: GUEST_NAMES[ni],
    kind,
    origin: GUEST_ORIGINS[oi],
    arrivesInDays: 2,
    stayingDays: 5,
    housed: false,
    threatOnDeath: kind === 'envoy' ? 'Война с племенем!' : 'Потеря доверия соседей.',
  };
  state.guests.push(g);
  state.log.unshift(`${g.name} из ${g.origin} прибывает в деревню.`);
  if (state.log.length > 10) state.log.pop();
}

function updateGuests(state: GameState) {
  const taverns = state.buildings.filter((b) => b.built && BUILDINGS[b.typeId].guestCapacity);
  let capacity = 0;
  for (const t of taverns) capacity += BUILDINGS[t.typeId].guestCapacity ?? 0;
  const housedCount = state.guests.filter((g) => g.housed).length;
  for (const g of state.guests) {
    if (g.arrivesInDays > 0) {
      g.arrivesInDays -= 1;
      continue;
    }
    // arrived — try to house
    if (!g.housed && housedCount < capacity) {
      g.housed = true;
    }
    if (g.housed) {
      g.stayingDays -= 1;
      // guest consumes food & wood (heating)
      if (state.resources.food > 0) state.resources.food -= 1;
      if (isWinter(state.season)) {
        if (state.resources.wood > 0) state.resources.wood -= 2;
        else {
          // guest freezes to death!
          state.log.unshift(`${g.name} замёрз в корчме! ${g.threatOnDeath}`);
          if (state.log.length > 10) state.log.pop();
          state.guests.splice(state.guests.indexOf(g), 1);
          continue;
        }
      }
      if (g.stayingDays <= 0) {
        state.log.unshift(`${g.name} отбыл с дарами и добрыми вестями.`);
        if (state.log.length > 10) state.log.pop();
        // reward
        if (g.kind === 'merchant') state.resources.gold += 15;
        else if (g.kind === 'envoy') state.resources.faith += 5;
        else state.resources.food += 8;
        state.guests.splice(state.guests.indexOf(g), 1);
      }
    }
  }
}

function onSeasonChange(state: GameState) {
  if (isWinter(state.season)) {
    const sev = state.difficulty.winterSeverity;
    state.log.unshift('Зима пришла. Расход дров утроен. Берегите припасы!');
    if (state.log.length > 10) state.log.pop();
    const heat = Math.ceil(state.population * 1.5 * sev);
    state.resources.wood = Math.max(0, state.resources.wood - heat);
  }
}

function survivalCheck(state: GameState) {
  if (state.gameOver) return;
  if (state.resources.food <= 0) {
    state.resources.workers = Math.max(0, state.resources.workers - 1);
    state.population = Math.max(0, state.population - 1);
    state.classCounts.smerd = Math.max(0, state.classCounts.smerd - 1);
    state.log.unshift('Голод! Житель погиб от истощения.');
    if (state.log.length > 10) state.log.pop();
  }
  if (isWinter(state.season) && state.resources.wood <= 0) {
    state.resources.workers = Math.max(0, state.resources.workers - 1);
    state.population = Math.max(0, state.population - 1);
    state.classCounts.smerd = Math.max(0, state.classCounts.smerd - 1);
    state.log.unshift('Мороз! Житель замёрз без дров.');
    if (state.log.length > 10) state.log.pop();
  }
  if (state.population <= 0) {
    state.gameOver = true;
    state.gameOverReason = 'Деревня вымерла. Последний житель покинул эти земли.';
  }
}

function growPopulation(state: GameState) {
  recomputeHousing(state);
  const housingSpace = state.housingUsed - state.population;
  if (
    !isWinter(state.season) &&
    state.resources.food > 20 &&
    housingSpace > 0 &&
    state.population < 60
  ) {
    if (Math.random() < 0.18) {
      state.resources.workers += 1;
      state.population += 1;
      state.classCounts.smerd += 1;
      state.log.unshift('В деревне родился новый житель.');
      if (state.log.length > 10) state.log.pop();
      // spawn agent
      const home = findHousingWithSpace(state);
      if (home) {
        state.agents.push(makeAgent(state, 'smerd', home.uid, home.tileX, home.tileY));
      }
    }
  }
}

function findHousingWithSpace(state: GameState): PlacedBuilding | null {
  for (const b of state.buildings) {
    if (!b.built) continue;
    const t = BUILDINGS[b.typeId];
    if (!t.housing) continue;
    const residents = state.agents.filter((a) => a.homeUid === b.uid).length;
    if (residents < t.housing) return b;
  }
  return null;
}

function makeAgent(
  state: GameState,
  classId: CitizenClass,
  homeUid: number,
  tileX: number,
  tileY: number
): Agent {
  return {
    uid: state.nextUid++,
    homeUid,
    state: 'idle',
    tileX,
    tileY,
    targetUid: -1,
    carrying: {},
    classId,
    phase: 0,
    jobType: classId === 'otrok' ? 'worker' : 'builder',
    assignedBuildingUid: 0,
  };
}

// Call after placing first house to seed initial agents.
export function seedAgents(state: GameState) {
  const homes = state.buildings.filter((b) => b.built && BUILDINGS[b.typeId].housing);
  if (homes.length === 0) return;
  const home = homes[0];
  const count = state.classCounts.smerd;
  for (let i = 0; i < count; i++) {
    state.agents.push(makeAgent(state, 'smerd', home.uid, home.tileX + 1, home.tileY + 1));
  }
}

export function seasonName(s: Season): string {
  return SEASON_INFO[s].name;
}

// Recompute class counts from agents (for UI).
export function recomputeClasses(state: GameState) {
  state.classCounts = { smerd: 0, craftsman: 0, otrok: 0, volkhv: 0 };
  for (const a of state.agents) {
    state.classCounts[a.classId]++;
  }
  state.classCounts.smerd += state.resources.workers - state.agents.filter((a) => a.classId === 'smerd').length;
  if (state.classCounts.smerd < 0) state.classCounts.smerd = 0;
}
