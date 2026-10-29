import { setMapSeed, setTerrainConfig } from './iso';
import type { GameState } from './engine';
import type { TerrainConfig } from './types';

const SAVE_KEY = 'village-save-v2';

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, roads: [...state.roads] }));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Omit<GameState, 'roads'> & { roads?: string[] };
    const state: GameState = { ...saved, roads: new Set(saved.roads ?? []) };
    if (typeof state.mapSeed === 'number') {
      setMapSeed(state.mapSeed);
    }
    if (state.terrain) {
      setTerrainConfig(state.terrain as TerrainConfig);
    } else {
      setTerrainConfig({ hills: 0.5, rivers: 2 });
    }
    return state;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}
