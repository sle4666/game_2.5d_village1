import { useState } from 'react';
import { Trees, Scroll, Settings, LogOut, Flame, Swords, Shield } from 'lucide-react';
import type { DifficultyId } from '@/game/types';
import { DIFFICULTIES } from '@/game/constants';

interface MainMenuProps {
  onStart: (difficulty: DifficultyId) => void;
}

const DIFFICULTY_ICONS: Record<DifficultyId, typeof Trees> = {
  easy: Shield,
  normal: Flame,
  hard: Swords,
};

export default function MainMenu({ onStart }: MainMenuProps) {
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [selected, setSelected] = useState<DifficultyId | null>(null);

  return (
    <div className="parchment-bg min-h-screen w-full flex items-center justify-center relative overflow-hidden">
      {/* Decorative ambient embers */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-amber-400/20 animate-flicker"
            style={{
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              left: `${(i * 53) % 100}%`,
              top: `${(i * 37) % 100}%`,
              animationDelay: `${(i % 5) * 0.6}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-2xl px-6">
        {/* Title */}
        <div className="text-center mb-10 animate-float-in">
          <div className="flex items-center justify-center gap-3 text-amber-500/70 mb-2">
            <Trees size={28} />
            <span className="tracking-[0.4em] text-xs uppercase">Стратегия выживания</span>
            <Trees size={28} />
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-bold text-amber-100 leading-tight drop-shadow-lg">
            Хроники
          </h1>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-amber-200/80 leading-tight">
            Первозданного Леса
          </h2>
          <p className="mt-4 text-stone-400 text-sm max-w-md mx-auto leading-relaxed">
            Построй деревню в суровом лесу, переживи ледяные зимы и веди
            дипломатию с племенами и древними духами.
          </p>
        </div>

        {/* Panel */}
        <div className="wood-panel rounded-xl p-6 animate-float-in" style={{ animationDelay: '0.1s' }}>
          {!showDifficulty ? (
            <div className="flex flex-col gap-3">
              <MenuButton icon={Flame} label="Начать игру" onClick={() => setShowDifficulty(true)} primary />
              <MenuButton icon={Scroll} label="Загрузить игру" onClick={() => {}} disabled />
              <MenuButton icon={Settings} label="Настройки" onClick={() => {}} disabled />
              <MenuButton icon={LogOut} label="Выйти" onClick={() => window.close()} />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <h3 className="font-display text-2xl text-amber-100 text-center">Выберите судьбу</h3>
              <div className="flex flex-col gap-3">
                {(Object.keys(DIFFICULTIES) as DifficultyId[]).map((id) => {
                  const d = DIFFICULTIES[id];
                  const Icon = DIFFICULTY_ICONS[id];
                  const isSelected = selected === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelected(id)}
                      className={`btn-rune rounded-lg p-4 text-left flex items-start gap-4 ${
                        isSelected ? 'ring-2 ring-amber-400/60' : ''
                      }`}
                    >
                      <Icon size={24} className="mt-0.5 text-amber-400/80 shrink-0" />
                      <div className="flex-1">
                        <div className="font-display text-xl text-amber-100">{d.name}</div>
                        <div className="text-stone-400 text-sm mt-1">{d.description}</div>
                        <div className="text-stone-500 text-xs mt-2 flex gap-4">
                          <span>Старт: {d.startResources.workers} жит.</span>
                          <span>Дерево: {d.startResources.wood}</span>
                          <span>Пища: {d.startResources.food}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-2">
                <button
                  className="btn-rune rounded-lg py-2 px-4 text-stone-300 flex-1"
                  onClick={() => { setShowDifficulty(false); setSelected(null); }}
                >
                  Назад
                </button>
                <button
                  className="btn-rune rounded-lg py-2 px-4 text-amber-100 flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={!selected}
                  onClick={() => selected && onStart(selected)}
                >
                  Основать деревню
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-stone-600 text-xs mt-6">
          Прототип · Управление: WASD — камера, колесо — зум
        </p>
      </div>
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  primary,
  disabled,
}: {
  icon: typeof Trees;
  label: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn-rune rounded-lg py-3 px-5 flex items-center gap-3 text-left ${
        primary ? 'text-amber-100' : 'text-stone-300'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <Icon size={20} className="text-amber-400/70" />
      <span className="font-display text-lg">{label}</span>
    </button>
  );
}
