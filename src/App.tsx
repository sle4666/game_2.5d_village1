import { useState } from 'react';
import MainMenu from '@/components/MainMenu';
import GameView from '@/components/GameView';
import type { DifficultyId, GameScreen } from '@/game/types';

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('menu');
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');

  const handleStart = (d: DifficultyId) => {
    setDifficulty(d);
    setScreen('game');
  };

  const handleExit = () => {
    setScreen('menu');
  };

  if (screen === 'game') {
    return <GameView difficulty={difficulty} onExit={handleExit} />;
  }

  return <MainMenu onStart={handleStart} />;
}
