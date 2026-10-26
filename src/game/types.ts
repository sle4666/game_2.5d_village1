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
  icon: string; // emoji-free glyph name
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
  | 'palisade';

export interface BuildingType {
  id: BuildingTypeId;
  name: string;
  description: string;
  cost: Partial<Record<ResourceId, number>>;
  size: { w: number; d: number };
  color: string;
  roof: string;
  category: 'housing' | 'production' | 'storage' | 'faith' | 'defense';
  produces?: Partial<Record<ResourceId, number>>; // per game-tick
  consumes?: Partial<Record<ResourceId, number>>;
  housing?: number;
  faith?: number;
  buildTicks: number;
}

export interface PlacedBuilding {
  uid: number;
  typeId: BuildingTypeId;
  tileX: number;
  tileY: number;
  progress: number; // 0..1
  built: boolean;
}

export type GameScreen = 'menu' | 'game';

export interface GameSettings {
  difficulty: DifficultyId;
}
