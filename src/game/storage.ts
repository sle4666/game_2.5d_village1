import type { GameState } from './engine';
import { setMapSeed, getMapSeed } from './iso';

const SAVE_KEY = 'slavic-village-save-v1';

export function saveGame(state: GameState): boolean {
  try {
    const data = {
      state: JSON.stringify(state),
      mapSeed: getMapSeed(),
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.state) return null;
    const state = JSON.parse(data.state) as GameState;
    if (typeof state.mapSeed === 'number') {
      setMapSeed(state.mapSeed);
    } else if (typeof data.mapSeed === 'number') {
      setMapSeed(data.mapSeed);
    }
    return state;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function deleteSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
