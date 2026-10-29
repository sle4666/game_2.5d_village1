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
  TerrainConfig,
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
import { inBounds, isWater, isPassable, findPath, collectBridgeTiles, setMapSeed, setTerrainConfig, findNearestDecoration, hashRand, ROAD_STEP_COST } from './iso';

// Sound event callback — set by GameView to bridge engine -> AudioSystem.
export type SoundCallback = (event: 'placeBuilding' | 'buildingFinished' | 'winterComes' | 'guestArrives' | 'starvation' | 'trainingComplete') => void;
let soundCb: SoundCallback | null = null;
export function setSoundCallback(cb: SoundCallback | null): void { soundCb = cb; }
function emitSound(event: Parameters<SoundCallback>[0]): void {
  if (soundCb) soundCb(event);
}

export const AGENT_SPEED = 0.5;
const AGENT_SPEED_WINTER = 0.35;
const ROAD_SPEED_MULTIPLIER = 2;
const WAGON_LOAD = 5;
const BASE_LOAD = 1;
const GUEST_COOLDOWN_DAYS = 12;
const ARRIVAL_RADIUS = 0.5;

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
  classCounts: Record<CitizenClass, number>;
  training: { daysLeft: number }[];
  masterPool: { classId: CitizenClass }[];
  guestCooldown: number;
  mapSeed: number;
  terrain: TerrainConfig;
  roads: Set<string>; // tile keys 'x,y'
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

function decorationFor(x: number, y: number, seed: number): 'tree' | 'rock' | null {
  if (x < 1 || y < 1 || x > GRID_W - 2 || y > GRID_D - 2) return null;
  const v = hashRand(x, y, seed);
  const distFromCenter = Math.abs(x - GRID_W / 2) + Math.abs(y - GRID_D / 2);
  if (distFromCenter < 5) return null;
  if (v > 0.86) return 'tree';
  if (v > 0.82) return 'rock';
  return null;
}

export function createGame(
  difficultyId: string,
  terrain?: TerrainConfig
): GameState {
  const difficulty = DIFFICULTIES[difficultyId as keyof typeof DIFFICULTIES] ?? DIFFICULTIES.normal;
  const terrainCfg: TerrainConfig = terrain ?? { hills: 0.5, rivers: 2 };
  const resources: Record<ResourceId, number> = {
    wood: 0, stone: 0, ore: 0, food: 0, skins: 0, faith: 0, gold: 0, workers: 0,
  };
  for (const id of RESOURCE_ORDER) {
    const v = difficulty.startResources[id];
    if (v) resources[id] = v;
  }
  // Random map seed — generated exactly once, before any terrain call.
  const mapSeed = Math.floor(Math.random() * 10000);
  setMapSeed(mapSeed);
  setTerrainConfig(terrainCfg);

  const decorations: ('tree' | 'rock' | null)[][] = emptyGrid(null);
  for (let x = 0; x < GRID_W; x++) {
    for (let y = 0; y < GRID_D; y++) decorations[x][y] = decorationFor(x, y, mapSeed);
  }
  const classCounts: Record<CitizenClass, number> = { smerd: 0, craftsman: 0, otrok: 0, volkhv: 0 };
  classCounts.smerd = resources.workers;
  const state: GameState = {
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
    guestCooldown: 0,
    mapSeed,
    terrain: terrainCfg,
    roads: new Set<string>(),
  };

  return state;
}

// --- Placement ---
export function canPlace(state: GameState, type: BuildingType, tileX: number, tileY: number): boolean {
  for (let dx = 0; dx < type.size.w; dx++) {
    for (let dy = 0; dy < type.size.d; dy++) {
      const x = tileX + dx;
      const y = tileY + dy;
      if (!inBounds(x, y)) return false;
      if (state.occupied[x][y]) return false;
      const water = isWater(x, y);
      if (type.waterOnly && !water) return false;
      if (!type.waterOnly && water) return false;
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
  return placeBuildingInternal(state, typeId, tileX, tileY, true);
}

export function buildRoad(state: GameState, tileX: number, tileY: number): boolean {
  if (!inBounds(tileX, tileY)) return false;
  const key = `${tileX},${tileY}`;
  if (state.roads.has(key) || state.occupied[tileX][tileY]) return false;
  const bridgeTiles = collectBridgeTiles(state.buildings.filter((b) => BUILDINGS[b.typeId].isBridge));
  if (!isPassable(tileX, tileY, bridgeTiles)) return false;
  const material: ResourceId | null = state.resources.stone >= 1 ? 'stone' : state.resources.wood >= 1 ? 'wood' : null;
  if (!material) return false;
  state.resources[material] -= 1;
  state.roads.add(key);
  emitSound('placeBuilding');
  return true;
}

function placeBuildingInternal(
  state: GameState,
  typeId: BuildingTypeId,
  tileX: number,
  tileY: number,
  chargeCost = false
): PlacedBuilding | null {
  const type = BUILDINGS[typeId];
  if (!canPlace(state, type, tileX, tileY)) return null;
  if (chargeCost) {
    for (const [id, amount] of Object.entries(type.cost)) {
      if (state.resources[id as ResourceId] < (amount ?? 0)) return null;
    }
    for (const [id, amount] of Object.entries(type.cost)) {
      state.resources[id as ResourceId] -= amount ?? 0;
    }
  }
  const neededMaterials: Partial<Record<ResourceId, number>> = {};
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
    level: type.level ?? 1,
  };
  for (let dx = 0; dx < type.size.w; dx++) {
    for (let dy = 0; dy < type.size.d; dy++) {
      state.occupied[tileX + dx][tileY + dy] = true;
    }
  }
  state.buildings.push(b);
  if (chargeCost) {
    state.log.unshift(`Начато строительство: ${type.name}.`);
    if (state.log.length > 10) state.log.pop();
    emitSound('placeBuilding');
  }
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

function assignBuilders(state: GameState) {
  const freeBuilders = state.agents.filter(
    (a) => a.classId === 'smerd' && a.state === 'idle' && a.jobType === 'builder'
  );
  const sites = state.buildings.filter((b) => !b.built);
  for (const site of sites) {
    const needsMaterials = hasUnmetMaterials(site);
    const warehouse = needsMaterials ? findNearestWarehouse(state, site.tileX, site.tileY) : null;
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
      free.targetUid = warehouse.uid;
      free.carrying = {};
      free.path = [];
    } else {
      free.state = 'toSite';
      free.targetUid = site.uid;
      free.carrying = {};
      free.path = [];
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

// --- Resource gathering: production buildings spawn agents to gather ---

const GATHER_RADIUS = 15;
const GATHER_TICKS = 5;
const GATHER_ARRIVAL = 0.2;
const WORK_GATHER_TICKS = 20; // ticks for physical resource gathering
const TOWN_HALL_DELIVER_RADIUS = 0.5;

// Map building type to which decoration it gathers from.
function buildingGatherType(typeId: BuildingTypeId): 'tree' | 'rock' | null {
  if (typeId === 'woodcutter' || typeId === 'huntersHut') return 'tree';
  if (typeId === 'quarry' || typeId === 'mine') return 'rock';
  return null;
}

function buildingProduces(typeId: BuildingTypeId): ResourceId | null {
  const t = BUILDINGS[typeId];
  if (!t.produces) return null;
  for (const [id] of Object.entries(t.produces)) {
    return id as ResourceId;
  }
  return null;
}

// Find the Town Hall — the central resource drop-off point.
function findTownHall(state: GameState): PlacedBuilding | null {
  return state.buildings.find((b) => b.typeId === 'town_hall' && b.built) ?? null;
}

function hasWagonWorkshop(state: GameState): boolean {
  return state.buildings.some((b) => b.typeId === 'wagon_workshop' && b.built);
}

function townHallCenter(state: GameState): { x: number; y: number } | null {
  const th = findTownHall(state);
  if (!th) return null;
  const t = BUILDINGS.town_hall;
  return {
    x: th.tileX + t.size.w / 2,
    y: th.tileY + t.size.d / 2,
  };
}

function assignGatherers(state: GameState) {
  for (const b of state.buildings) {
    if (!b.built) continue;
    const gatherType = buildingGatherType(b.typeId);
    if (!gatherType) continue;
    // Check if we already have a gatherer assigned to this building.
    const existing = state.agents.filter(
      (a) => a.assignedBuildingUid === b.uid && (a.state === 'goingToGather' || a.state === 'going_to_work')
    );
    if (existing.length >= 1) continue;
    // Find an idle worker assigned to this building.
    const worker = state.agents.find(
      (a) => a.assignedBuildingUid === b.uid && a.state === 'working' && a.classId === 'smerd'
    );
    if (!worker) continue;
    // Find nearest decoration tile.
    const target = findNearestDecoration(
      b.tileX, b.tileY, gatherType, GATHER_RADIUS, state.mapSeed, state.decorations
    );
    if (!target) continue;
    worker.state = 'going_to_work';
    worker.gatherTargetX = target.x;
    worker.gatherTargetY = target.y;
    worker.gatherResource = buildingProduces(b.typeId);
    worker.timer = 0;
    worker.path = [];
  }
}

function moveAlongPath(a: Agent, speed: number) {
  if (a.path.length === 0) return;
  const wp = a.path[0];
  const wdx = wp.x - a.tileX;
  const wdy = wp.y - a.tileY;
  const wdist = Math.sqrt(wdx * wdx + wdy * wdy);
  if (wdist < speed * 1.5) {
    a.tileX = wp.x;
    a.tileY = wp.y;
    a.path.shift();
  } else {
    a.tileX += (wdx / wdist) * speed;
    a.tileY += (wdy / wdist) * speed;
  }
}

// Move agents toward their target building tile or gather site using A*.
function moveAgents(state: GameState) {
  const bridgeTiles = collectBridgeTiles(
    state.buildings.filter((b) => BUILDINGS[b.typeId].isBridge)
  );
  for (let i = state.agents.length - 1; i >= 0; i--) {
    const a = state.agents[i];
    if (a.state === 'idle') continue;

    const winter = isWinter(state.season);
    const baseSpeed = winter ? AGENT_SPEED_WINTER : AGENT_SPEED;
    const onRoad = state.roads.has(`${Math.round(a.tileX)},${Math.round(a.tileY)}`);
    const speed = onRoad ? baseSpeed * ROAD_SPEED_MULTIPLIER : baseSpeed;

    // --- New physical gather loop: going_to_work → working → delivering → returning ---
    if (a.state === 'going_to_work') {
      const tx = a.gatherTargetX;
      const ty = a.gatherTargetY;
      const dx = tx - a.tileX;
      const dy = ty - a.tileY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      a.phase = (a.phase + speed) % 1;
      if (dist < GATHER_ARRIVAL) {
        a.state = 'working';
        a.timer = WORK_GATHER_TICKS;
        a.path = [];
        continue;
      }
      if (a.path.length === 0) {
        const path = findPath(
          Math.round(a.tileX), Math.round(a.tileY),
          tx, ty,
          bridgeTiles, state.occupied, state.roads
        );
        a.path = path && path.length > 0 ? path : [{ x: tx, y: ty }];
      }
      moveAlongPath(a, speed);
      continue;
    }

    if (a.state === 'working') {
      // If this is a gatherer with a gatherResource and no timer, it's a
      // construction worker sitting at a site — skip the gather logic.
      if (a.gatherResource && a.assignedBuildingUid > 0 && a.timer !== undefined) {
        a.timer -= 1;
        if (a.timer <= 0) {
          // Finished gathering — put resource in inventory, head to Town Hall.
          const load = hasWagonWorkshop(state) ? WAGON_LOAD : BASE_LOAD;
          a.inventory = { type: a.gatherResource, amount: load };
          a.carrying = { [a.gatherResource]: load };
          a.state = 'delivering';
          a.path = [];
          a.timer = undefined;
        }
      }
      continue;
    }

    if (a.state === 'delivering') {
      // Deliver to Town Hall using distance check.
      const thCenter = townHallCenter(state);
      if (!thCenter) continue;
      const dx = thCenter.x - a.tileX;
      const dy = thCenter.y - a.tileY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      a.phase = (a.phase + speed) % 1;
      if (dist < TOWN_HALL_DELIVER_RADIUS) {
        // Drop off resources at Town Hall.
        if (a.inventory) {
          state.resources[a.inventory.type] += a.inventory.amount;
        }
        if (a.carrying && a.gatherResource) {
          const amt = a.carrying[a.gatherResource] ?? 0;
          if (amt > 0) {
            state.resources[a.gatherResource] += amt;
          }
        }
        a.inventory = undefined;
        a.carrying = {};
        a.timer = undefined;
        // Head back to assigned building for next gather cycle.
        const b = state.buildings.find((bl) => bl.uid === a.assignedBuildingUid);
        if (b) {
          a.state = 'returning_to_hall';
          a.targetUid = b.uid;
          a.path = [];
        } else {
          a.state = 'returning';
          a.targetUid = a.homeUid > 0 ? a.homeUid : -1;
          a.path = [];
        }
        continue;
      }
      if (a.path.length === 0) {
        const path = findPath(
          Math.round(a.tileX), Math.round(a.tileY),
          Math.round(thCenter.x), Math.round(thCenter.y),
          bridgeTiles, state.occupied, state.roads
        );
        a.path = path && path.length > 0 ? path : [{ x: thCenter.x, y: thCenter.y }];
      }
      moveAlongPath(a, speed);
      continue;
    }

    if (a.state === 'returning_to_hall') {
      // Walk back to assigned building, then go to going_to_work for next cycle.
      const b = state.buildings.find((bl) => bl.uid === a.targetUid);
      if (!b) {
        a.state = 'working';
        a.path = [];
        continue;
      }
      const tType = BUILDINGS[b.typeId];
      const tx = b.tileX + tType.size.w / 2;
      const ty = b.tileY + tType.size.d / 2;
      const dx = tx - a.tileX;
      const dy = ty - a.tileY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      a.phase = (a.phase + speed) % 1;
      if (dist < ARRIVAL_RADIUS) {
        a.state = 'working';
        a.path = [];
        a.timer = 0;
        // Will be reassigned to going_to_work by assignGatherers next tick.
        continue;
      }
      if (a.path.length === 0) {
        const path = findPath(
          Math.round(a.tileX), Math.round(a.tileY),
          Math.round(tx), Math.round(ty),
          bridgeTiles, state.occupied, state.roads
        );
        a.path = path && path.length > 0 ? path : [{ x: tx, y: ty }];
      }
      moveAlongPath(a, speed);
      continue;
    }

    // --- Legacy gathering states (kept for backwards compat) ---
    if (a.state === 'goingToGather') {
      const tx = a.gatherTargetX;
      const ty = a.gatherTargetY;
      const dx = tx - a.tileX;
      const dy = ty - a.tileY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      a.phase = (a.phase + speed) % 1;
      if (dist < GATHER_ARRIVAL) {
        a.state = 'gathering';
        a.gatherTimer = GATHER_TICKS;
        continue;
      }
      if (a.path.length === 0) {
        const path = findPath(
          Math.round(a.tileX), Math.round(a.tileY),
          tx, ty,
          bridgeTiles, state.occupied, state.roads
        );
        a.path = path && path.length > 0 ? path : [{ x: tx, y: ty }];
      }
      moveAlongPath(a, speed);
      continue;
    }

    if (a.state === 'gathering') {
      a.gatherTimer -= 1;
      if (a.gatherTimer <= 0) {
        // Done gathering — head back to building to deliver.
        const b = state.buildings.find((bl) => bl.uid === a.assignedBuildingUid);
        if (b) {
          a.state = 'delivering';
          a.targetUid = b.uid;
          a.path = [];
          if (a.gatherResource) {
            a.carrying = { [a.gatherResource]: 1 };
          }
        } else {
          a.state = 'returning';
          a.targetUid = a.homeUid > 0 ? a.homeUid : -1;
          a.path = [];
        }
      }
      continue;
    }

    // Returning agents head to village center; despawn on arrival.
    if (a.state === 'returning') {
      // If no home, go to village center and despawn.
      if (a.homeUid <= 0) {
        const cx = GRID_W / 2;
        const cy = GRID_D / 2;
        const dx = cx - a.tileX;
        const dy = cy - a.tileY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        a.phase = (a.phase + speed) % 1;
        if (dist < ARRIVAL_RADIUS) {
          state.agents.splice(i, 1);
          continue;
        }
        a.tileX += (dx / dist) * speed;
        a.tileY += (dy / dist) * speed;
        continue;
      }
      // Has home — walk home via A*.
      const home = state.buildings.find((b) => b.uid === a.homeUid);
      if (!home) {
        // Home gone — despawn.
        state.agents.splice(i, 1);
        continue;
      }
      const tType = BUILDINGS[home.typeId];
      const tx = home.tileX + tType.size.w / 2;
      const ty = home.tileY + tType.size.d / 2;
      const dx = tx - a.tileX;
      const dy = ty - a.tileY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      a.phase = (a.phase + speed) % 1;
      if (dist < ARRIVAL_RADIUS) {
        // Arrived home — go idle, ready for next assignment.
        a.state = 'idle';
        a.targetUid = -1;
        a.path = [];
        a.assignedBuildingUid = 0;
        continue;
      }
      if (a.path.length === 0) {
        const path = findPath(
          Math.round(a.tileX), Math.round(a.tileY),
          Math.round(tx), Math.round(ty),
          bridgeTiles, state.occupied, state.roads
        );
        a.path = path && path.length > 0 ? path : [{ x: tx, y: ty }];
      }
      const wp = a.path[0];
      const wdx = wp.x - a.tileX;
      const wdy = wp.y - a.tileY;
      const wdist = Math.sqrt(wdx * wdx + wdy * wdy);
      if (wdist < speed * 1.5) {
        a.tileX = wp.x;
        a.tileY = wp.y;
        a.path.shift();
      } else {
        a.tileX += (wdx / wdist) * speed;
        a.tileY += (wdy / wdist) * speed;
      }
      continue;
    }

    // toSite: head to target building.
    const target = state.buildings.find((b) => b.uid === a.targetUid);
    if (!target) { a.state = 'idle'; a.targetUid = -1; a.path = []; continue; }
    const tType = BUILDINGS[target.typeId];
    const tx = target.tileX + tType.size.w / 2;
    const ty = target.tileY + tType.size.d / 2;

    // Distance-based arrival check (not exact coordinate match).
    const dx = tx - a.tileX;
    const dy = ty - a.tileY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (a.path.length === 0) {
      const path = findPath(
        Math.round(a.tileX), Math.round(a.tileY),
        Math.round(tx), Math.round(ty),
        bridgeTiles, state.occupied, state.roads
      );
      a.path = path && path.length > 0 ? path : [{ x: tx, y: ty }];
    }

    a.phase = (a.phase + speed) % 1;

    if (dist < ARRIVAL_RADIUS) {
      onAgentArrive(state, a, target);
    } else {
      moveAlongPath(a, speed);
      if (a.path.length === 0 && dist < ARRIVAL_RADIUS * 2) {
        onAgentArrive(state, a, target);
      }
    }
  }
}

function onAgentArrive(state: GameState, a: Agent, target: PlacedBuilding) {
  const tType = BUILDINGS[target.typeId];
  // If target is warehouse: pick up materials for the site
  if (tType.storesResources) {
    const sites = state.buildings.filter((b) => !b.built && hasUnmetMaterials(b));
    if (sites.length === 0) {
      a.state = 'returning';
      a.targetUid = a.homeUid > 0 ? a.homeUid : -1;
      a.path = [];
      return;
    }
    let site = sites[0];
    let bestD = Infinity;
    for (const s of sites) {
      const d = Math.abs(s.tileX - target.tileX) + Math.abs(s.tileY - target.tileY);
      if (d < bestD) { bestD = d; site = s; }
    }
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
    a.path = [];
    return;
  }
  // If target is a construction site: deliver materials / build
  if (!target.built) {
    if (a.carrying) {
      for (const [id, amt] of Object.entries(a.carrying)) {
        target.storedMaterials[id as ResourceId] = (target.storedMaterials[id as ResourceId] ?? 0) + (amt ?? 0);
      }
      a.carrying = {};
    }
    if (hasUnmetMaterials(target)) {
      const wh = findNearestWarehouse(state, target.tileX, target.tileY);
      if (wh) {
        a.targetUid = wh.uid;
        a.state = 'toSite';
        a.path = [];
      } else {
        a.state = 'working';
      }
    } else {
      a.state = 'working';
    }
    return;
  }
  // Arrived at a built building (e.g. worker assigned to production).
  a.state = 'working';
}

function advanceConstruction(state: GameState) {
  for (const b of state.buildings) {
    if (b.built) continue;
    const t = BUILDINGS[b.typeId];
    const workers = state.agents.filter(
      (a) => a.targetUid === b.uid && a.state === 'working'
    );
    const workerBoost = 1 + workers.length;
    const matPenalty = hasUnmetMaterials(b) ? 0.4 : 1;
    b.progress += (workerBoost * matPenalty) / t.buildTicks;
    if (b.progress >= 1) {
      b.progress = 1;
      b.built = true;
      state.log.unshift(`${t.name} построена.`);
      if (state.log.length > 10) state.log.pop();
      emitSound('buildingFinished');
      recomputeHousing(state);
      // Release workers — send them home or to village center.
      for (const w of workers) {
        w.state = 'returning';
        w.targetUid = w.homeUid > 0 ? w.homeUid : -1;
        w.path = [];
      }
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
    free.path = [];
  }
}

// --- Tick ---
export function tick(state: GameState): GameState {
  if (state.gameOver || state.speed === 0) return state;
  state.tick += 1;

  assignBuilders(state);
  assignWorkers(state);
  assignGatherers(state);
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
    (a) => a.assignedBuildingUid > 0 && (a.state === 'working' || a.state === 'goingToGather' || a.state === 'gathering' || a.state === 'delivering' || a.state === 'going_to_work' || a.state === 'returning_to_hall')
  ).length;
  const workerRatio = workerDemand === 0 ? 1 : Math.min(1, availableWorkers / workerDemand);
  // Buildings with gatherers produce less abstractly — agents deliver resources physically.
  const gatheringBuildings = new Set(
    state.agents
      .filter((a) => a.state === 'goingToGather' || a.state === 'gathering' || a.state === 'delivering' || a.state === 'going_to_work' || a.state === 'returning_to_hall')
      .map((a) => a.assignedBuildingUid)
  );
  for (const id of RESOURCE_ORDER) {
    let totalGain = (gains[id] ?? 0) * workerRatio;
    // Reduce abstract production for buildings that have active gatherers.
    for (const b of state.buildings) {
      if (!b.built || !gatheringBuildings.has(b.uid)) continue;
      const t = BUILDINGS[b.typeId];
      if (t.produces && t.produces[id]) {
        totalGain -= (t.produces[id] ?? 0) * workerRatio * 0.5;
      }
    }
    if (totalGain > 0) state.resources[id] += totalGain;
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
      emitSound('trainingComplete');
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
  if (state.guestCooldown > 0) {
    state.guestCooldown -= 1;
    return;
  }
  const chance = isWinter(state.season) ? 0.01 : 0.025;
  if (Math.random() > chance) return;
  state.guestCooldown = GUEST_COOLDOWN_DAYS;
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
  emitSound('guestArrives');
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
    if (!g.housed && housedCount < capacity) {
      g.housed = true;
    }
    if (g.housed) {
      g.stayingDays -= 1;
      if (state.resources.food > 0) state.resources.food -= 1;
      if (isWinter(state.season)) {
        if (state.resources.wood > 0) state.resources.wood -= 2;
        else {
          state.log.unshift(`${g.name} замёрз в корчме! ${g.threatOnDeath}`);
          if (state.log.length > 10) state.log.pop();
          state.guests.splice(state.guests.indexOf(g), 1);
          continue;
        }
      }
      if (g.stayingDays <= 0) {
        state.log.unshift(`${g.name} отбыл с дарами и добрыми вестями.`);
        if (state.log.length > 10) state.log.pop();
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
    emitSound('winterComes');
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
    emitSound('starvation');
  }
  if (isWinter(state.season) && state.resources.wood <= 0) {
    state.resources.workers = Math.max(0, state.resources.workers - 1);
    state.population = Math.max(0, state.population - 1);
    state.classCounts.smerd = Math.max(0, state.classCounts.smerd - 1);
    state.log.unshift('Мороз! Житель замёрз без дров.');
    if (state.log.length > 10) state.log.pop();
    emitSound('starvation');
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
    path: [],
    gatherTargetX: 0,
    gatherTargetY: 0,
    gatherTimer: 0,
    gatherResource: null,
  };
}

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

export function recomputeClasses(state: GameState) {
  state.classCounts = { smerd: 0, craftsman: 0, otrok: 0, volkhv: 0 };
  for (const a of state.agents) {
    state.classCounts[a.classId]++;
  }
  state.classCounts.smerd += state.resources.workers - state.agents.filter((a) => a.classId === 'smerd').length;
  if (state.classCounts.smerd < 0) state.classCounts.smerd = 0;
}
