import { useState } from 'react';
import MainMenu from '@/components/MainMenu';
import GameView from '@/components/GameView';
import type { DifficultyId, GameScreen, TerrainConfig } from '@/game/types';
import type { GameState } from '@/game/engine';
import { loadGame } from '@/game/storage';

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('menu');
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [terrain, setTerrain] = useState<TerrainConfig>({ hills: 0.5, rivers: 0.5 });
  const [loadedState, setLoadedState] = useState<GameState | null>(null);

  const handleStart = (d: DifficultyId, t: TerrainConfig) => {
    setDifficulty(d);
    setTerrain(t);
    setLoadedState(null);
    setScreen('game');
  };

  const handleLoad = () => {
    const state = loadGame();
    if (state) {
      setLoadedState(state);
      setScreen('game');
    }
  };

  const handleExit = () => {
    setScreen('menu');
    setLoadedState(null);
  };

  if (screen === 'game') {
    return (
      <GameView
        difficulty={difficulty}
        terrain={terrain}
        onExit={handleExit}
        loadedState={loadedState}
      />
    );
  }

  return <MainMenu onStart={handleStart} onLoad={handleLoad} />;
}
