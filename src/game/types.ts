export type ResourceId =
  | 'wood'
  | 'stone'
  | 'ore'
  | 'food'
  | 'skins'
  | 'faith'
  | 'gold'
  | 'workers';

export interface ResourceInfo {
  id: ResourceId;
  name: string;
  icon: string;
  color: string;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type DifficultyId = 'easy' | 'normal' | 'hard';

export interface DifficultyConfig {
  id: DifficultyId;
  name: string;
  startResources: Partial<Record<ResourceId, number>>;
  winterSeverity: number;
  woodGatherRate: number;
  foodGatherRate: number;
  description: string;
}

// --- Terrain config (set at game creation) ---
export interface TerrainConfig {
  hills: number; // 0..1
  rivers: number; // number of rivers on the map, 0..5
}

// --- Society: citizen classes ---
export type CitizenClass = 'smerd' | 'craftsman' | 'otrok' | 'volkhv';

export interface ClassInfo {
  id: CitizenClass;
  name: string;
  pluralName: string;
  color: string;
  canBuild: boolean; // can do basic construction/logistics
  canFight: boolean;
  canRitual: boolean;
  canCraft: boolean; // can work advanced production
  description: string;
}

// --- Buildings ---
export type BuildingTypeId =
  | 'house'
  | 'woodcutter'
  | 'quarry'
  | 'mine'
  | 'huntersHut'
  | 'farm'
  | 'smithy'
  | 'warehouse'
  | 'sanctuary'
  | 'palisade'
  | 'school'
  | 'tavern'
  | 'bridge'
  | 'town_hall'
  | 'wagon_workshop';

// Build mode: placing a building, or laying roads.
export type BuildMode = BuildingTypeId | 'road';

export interface BuildingType {
  id: BuildingTypeId;
  name: string;
  description: string;
  cost: Partial<Record<ResourceId, number>>;
  size: { w: number; d: number };
  color: string;
  roof: string;
  category: 'housing' | 'production' | 'storage' | 'faith' | 'defense' | 'civic';
  produces?: Partial<Record<ResourceId, number>>;
  consumes?: Partial<Record<ResourceId, number>>;
  housing?: number;
  faith?: number;
  buildTicks: number;
  requiresMaster?: boolean; // needs a craftsman/volkhv to operate
  masterClass?: CitizenClass; // which class masters it
  storesResources?: boolean; // warehouse — source for construction materials
  guestCapacity?: number; // tavern — houses guests
  waterOnly?: boolean; // bridge — can only be placed on water tiles
  isBridge?: boolean; // render hint
  level?: number; // upgrade level (future use)
}

export interface PlacedBuilding {
  uid: number;
  typeId: BuildingTypeId;
  tileX: number;
  tileY: number;
  progress: number; // 0..1
  built: boolean;
  hasMaster: boolean; // a master is assigned (for requiresMaster buildings)
  storedMaterials: Partial<Record<ResourceId, number>>; // materials delivered to site
  neededMaterials: Partial<Record<ResourceId, number>>; // what's still needed
  level?: number; // upgrade level
}

// --- Physical builder agents ---
export type AgentState = 'idle' | 'toSite' | 'working' | 'returning' | 'goingToGather' | 'gathering' | 'delivering' | 'going_to_work' | 'returning_to_hall';

export interface AgentInventory {
  type: ResourceId;
  amount: number;
}

export interface Agent {
  uid: number;
  homeUid: number; // building the agent lives in
  state: AgentState;
  // pixel-space interpolated position (in tile coords for logic)
  tileX: number;
  tileY: number;
  // target
  targetUid: number; // building heading to
  // carrying
  carrying: Partial<Record<ResourceId, number>>;
  classId: CitizenClass;
  // animation
  phase: number; // 0..1 walk cycle
  jobType: 'builder' | 'worker' | 'hauler';
  assignedBuildingUid: number; // production building worked at (for workers)
  path: { x: number; y: number }[]; // A* path waypoints
  // resource gathering
  gatherTargetX: number; // tile coords of resource node
  gatherTargetY: number;
  gatherTimer: number; // ticks remaining at gather site
  gatherResource: ResourceId | null; // which resource this agent is gathering
  inventory?: AgentInventory; // currently held resource being hauled
  timer?: number; // generic timer for working/delivering phases
}

// --- Guests (envoys, merchants, refugees) ---
export interface Guest {
  uid: number;
  name: string;
  kind: 'envoy' | 'merchant' | 'refugee';
  origin: string; // faction name
  arrivesInDays: number;
  stayingDays: number;
  housed: boolean;
  threatOnDeath: string; // consequence if they die
}

export type GameScreen = 'menu' | 'game';

export interface GameSettings {
  difficulty: DifficultyId;
}
