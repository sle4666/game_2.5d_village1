import type {
  BuildingType,
  BuildingTypeId,
  DifficultyConfig,
  DifficultyId,
  ResourceId,
  ResourceInfo,
  Season,
} from './types';

export const GRID_W = 28;
export const GRID_D = 28;
export const TILE_W = 64;
export const TILE_H = 32;

export const TICK_MS = 1000;
export const TICKS_PER_DAY = 10;
export const DAYS_PER_SEASON = 12;

export const RESOURCES: Record<ResourceId, ResourceInfo> = {
  wood: { id: 'wood', name: 'Дерево', icon: 'wood', color: '#a9743b' },
  stone: { id: 'stone', name: 'Камень', icon: 'stone', color: '#8a8f99' },
  ore: { id: 'ore', name: 'Руда', icon: 'ore', color: '#c47a5a' },
  food: { id: 'food', name: 'Пища', icon: 'food', color: '#7fae5a' },
  skins: { id: 'skins', name: 'Шкуры', icon: 'skins', color: '#b08a55' },
  faith: { id: 'faith', name: 'Вера', icon: 'faith', color: '#d8c06a' },
  gold: { id: 'gold', name: 'Золото', icon: 'gold', color: '#e3c34a' },
  workers: { id: 'workers', name: 'Жители', icon: 'workers', color: '#6aa6c4' },
};

export const RESOURCE_ORDER: ResourceId[] = [
  'wood',
  'stone',
  'ore',
  'food',
  'skins',
  'faith',
  'gold',
  'workers',
];

export const DIFFICULTIES: Record<DifficultyId, DifficultyConfig> = {
  easy: {
    id: 'easy',
    name: 'Лёгкое',
    description: 'Тёплые зимы, богатые земли. Для знакомства с игрой.',
    startResources: {
      wood: 200,
      stone: 120,
      ore: 40,
      food: 180,
      skins: 30,
      faith: 20,
      gold: 50,
      workers: 6,
    },
    winterSeverity: 0.5,
    woodGatherRate: 1.2,
    foodGatherRate: 1.2,
  },
  normal: {
    id: 'normal',
    name: 'Нормальное',
    description: 'Суровые зимы. Баланс выживания и развития.',
    startResources: {
      wood: 150,
      stone: 80,
      ore: 20,
      food: 120,
      skins: 15,
      faith: 10,
      gold: 30,
      workers: 4,
    },
    winterSeverity: 1,
    woodGatherRate: 1,
    foodGatherRate: 1,
  },
  hard: {
    id: 'hard',
    name: 'Суровое',
    description: 'Ледяные зимы, скудные припасы. Только для опытных ярлов.',
    startResources: {
      wood: 100,
      stone: 50,
      ore: 10,
      food: 80,
      skins: 8,
      faith: 5,
      gold: 15,
      workers: 3,
    },
    winterSeverity: 1.6,
    woodGatherRate: 0.8,
    foodGatherRate: 0.8,
  },
};

export const BUILDINGS: Record<BuildingTypeId, BuildingType> = {
  house: {
    id: 'house',
    name: 'Изба',
    description: 'Жилище для 4 жителей. Увеличивает население деревни.',
    cost: { wood: 20, stone: 5 },
    size: { w: 2, d: 2 },
    color: '#9c6b3f',
    roof: '#6b4226',
    category: 'housing',
    housing: 4,
    buildTicks: 8,
  },
  woodcutter: {
    id: 'woodcutter',
    name: 'Лесопилка',
    description: 'Рабочие рубят лес. Производит дерево.',
    cost: { wood: 15, stone: 3 },
    size: { w: 2, d: 2 },
    color: '#7a5a34',
    roof: '#4a3520',
    category: 'production',
    produces: { wood: 0.9 },
    consumes: { workers: 1 },
    buildTicks: 6,
  },
  quarry: {
    id: 'quarry',
    name: 'Каменоломня',
    description: 'Добыча камня из скальных пород.',
    cost: { wood: 18 },
    size: { w: 2, d: 2 },
    color: '#7d7f87',
    roof: '#56585f',
    category: 'production',
    produces: { stone: 0.7 },
    consumes: { workers: 1 },
    buildTicks: 7,
  },
  mine: {
    id: 'mine',
    name: 'Шахта',
    description: 'Добыча железной руды из глубин.',
    cost: { wood: 25, stone: 10 },
    size: { w: 2, d: 2 },
    color: '#5a4636',
    roof: '#3a2c20',
    category: 'production',
    produces: { ore: 0.5 },
    consumes: { workers: 1 },
    buildTicks: 9,
  },
  huntersHut: {
    id: 'huntersHut',
    name: 'Охотничья избушка',
    description: 'Добыча дичи и шкур из окрестных лесов.',
    cost: { wood: 12 },
    size: { w: 1, d: 1 },
    color: '#6b5238',
    roof: '#3f2f1d',
    category: 'production',
    produces: { food: 0.8, skins: 0.2 },
    consumes: { workers: 1 },
    buildTicks: 5,
  },
  farm: {
    id: 'farm',
    name: 'Огород',
    description: 'Выращивание пищи. Не работает зимой.',
    cost: { wood: 10, stone: 2 },
    size: { w: 2, d: 2 },
    color: '#6f8a4a',
    roof: '#4f6a30',
    category: 'production',
    produces: { food: 1.1 },
    consumes: { workers: 1 },
    buildTicks: 5,
  },
  smithy: {
    id: 'smithy',
    name: 'Кузня',
    description: 'Переработка руды в инструменты. Требует руду.',
    cost: { wood: 30, stone: 15, ore: 10 },
    size: { w: 2, d: 2 },
    color: '#4a4a52',
    roof: '#2c2c32',
    category: 'production',
    produces: { gold: 0.4 },
    consumes: { ore: 0.3, workers: 1 },
    buildTicks: 12,
  },
  warehouse: {
    id: 'warehouse',
    name: 'Амбар',
    description: 'Хранилище. Увеличивает запас ресурсов и защищает еду зимой.',
    cost: { wood: 22, stone: 5 },
    size: { w: 2, d: 2 },
    color: '#8a6a42',
    roof: '#5a4326',
    category: 'storage',
    buildTicks: 7,
  },
  sanctuary: {
    id: 'sanctuary',
    name: 'Капище',
    description: 'Святилище с идолами. Генерирует веру для задабривания духов.',
    cost: { wood: 25, stone: 12 },
    size: { w: 2, d: 2 },
    color: '#6a5a44',
    roof: '#43382a',
    category: 'faith',
    produces: { faith: 0.5 },
    consumes: { workers: 1 },
    buildTicks: 10,
  },
  palisade: {
    id: 'palisade',
    name: 'Частокол',
    description: 'Оборонительная стена из брёвен. Защита от набегов.',
    cost: { wood: 14 },
    size: { w: 1, d: 1 },
    color: '#6b4f30',
    roof: '#6b4f30',
    category: 'defense',
    buildTicks: 3,
  },
};

export const BUILD_CATEGORIES: {
  id: BuildingType['category'];
  name: string;
  types: BuildingTypeId[];
}[] = [
  { id: 'housing', name: 'Жильё', types: ['house'] },
  {
    id: 'production',
    name: 'Производство',
    types: ['woodcutter', 'quarry', 'mine', 'huntersHut', 'farm', 'smithy'],
  },
  { id: 'storage', name: 'Логистика', types: ['warehouse'] },
  { id: 'faith', name: 'Религия', types: ['sanctuary'] },
  { id: 'defense', name: 'Защита', types: ['palisade'] },
];

export const SEASON_INFO: Record<
  Season,
  { name: string; sky: string; ground: string; accent: string; snow: number }
> = {
  spring: {
    name: 'Весна',
    sky: '#b9d4c4',
    ground: '#6f8a4a',
    accent: '#a8d08a',
    snow: 0,
  },
  summer: {
    name: 'Лето',
    sky: '#a9d6e8',
    ground: '#7fa05a',
    accent: '#cfe39a',
    snow: 0,
  },
  autumn: {
    name: 'Осень',
    sky: '#d8c79a',
    ground: '#8a7a4a',
    accent: '#d6a55a',
    snow: 0.15,
  },
  winter: {
    name: 'Зима',
    sky: '#cfd8e0',
    ground: '#cdd6dc',
    accent: '#e8eef2',
    snow: 1,
  },
};

export const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export function isWinter(season: Season): boolean {
  return season === 'winter';
}
