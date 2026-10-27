import { useState } from 'react';
import MainMenu from '@/components/MainMenu';
import GameView from '@/components/GameView';
import type { DifficultyId, GameScreen } from '@/game/types';
import type { GameState } from '@/game/engine';
import { loadGame, hasSave } from '@/game/storage';

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('menu');
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [loadedState, setLoadedState] = useState<GameState | null>(null);

  const handleStart = (d: DifficultyId) => {
    setDifficulty(d);
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
    return <GameView difficulty={difficulty} onExit={handleExit} loadedState={loadedState} />;
  }

  return <MainMenu onStart={handleStart} onLoad={handleLoad} />;
}
