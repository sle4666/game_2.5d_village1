import { useState, useEffect } from 'react';
import { Trees, Scroll, Settings, LogOut, Flame, Swords, Shield, Mountain, Waves } from 'lucide-react';
import type { DifficultyId, TerrainConfig } from '@/game/types';
import { DIFFICULTIES } from '@/game/constants';
import SettingsPanel from './SettingsPanel';
import { initAudio } from '@/game/AudioSystem';
import { hasSave } from '@/game/storage';

interface MainMenuProps {
  onStart: (difficulty: DifficultyId, terrain: TerrainConfig) => void;
  onLoad: () => void;
}

const DIFFICULTY_ICONS: Record<DifficultyId, typeof Trees> = {
  easy: Shield,
  normal: Flame,
  hard: Swords,
};

export default function MainMenu({ onStart, onLoad }: MainMenuProps) {
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [selected, setSelected] = useState<DifficultyId | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [canLoad, setCanLoad] = useState(false);
  const [hills, setHills] = useState(50);
  // rivers: integer 0–5
  const [rivers, setRivers] = useState(2);

  useEffect(() => {
    setCanLoad(hasSave());
  }, []);

  const handleStart = () => {
    if (!selected) return;
    onStart(selected, {
      hills: hills / 100,
      rivers: rivers / 5,  // normalize 0–5 → 0–1
    });
  };

  return (
    <div className="parchment-bg min-h-screen w-full flex items-center justify-center relative overflow-y-auto py-8">
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
        <div className="text-center mb-8 animate-float-in">
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
          <p className="mt-3 text-stone-400 text-sm max-w-md mx-auto leading-relaxed">
            Построй деревню в суровом лесу, переживи ледяные зимы и веди
            дипломатию с племенами и древними духами.
          </p>
        </div>

        <div className="wood-panel rounded-xl p-6 animate-float-in" style={{ animationDelay: '0.1s' }}>
          {!showDifficulty ? (
            <div className="flex flex-col gap-3">
              <MenuButton icon={Flame} label="Начать игру" onClick={() => setShowDifficulty(true)} primary />
              <MenuButton icon={Scroll} label="Загрузить игру" onClick={onLoad} disabled={!canLoad} />
              <MenuButton icon={Settings} label="Настройки" onClick={() => { initAudio(); setShowSettings(true); }} />
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

              {/* Terrain sliders */}
              <div className="flex flex-col gap-3 bg-black/20 rounded-lg p-4 border border-amber-900/20">
                <div className="text-amber-300/80 text-xs uppercase tracking-wider mb-1">
                  Настройка рельефа
                </div>
                <SliderRow
                  icon={Mountain}
                  label="Гористость"
                  value={hills}
                  min={0}
                  max={100}
                  step={1}
                  onChange={setHills}
                  leftLabel="Равнина"
                  rightLabel="Горы"
                  displayValue={String(hills)}
                />
                <SliderRow
                  icon={Waves}
                  label="Количество рек"
                  value={rivers}
                  min={0}
                  max={5}
                  step={1}
                  onChange={setRivers}
                  leftLabel="0"
                  rightLabel="5"
                  displayValue={String(rivers)}
                />
              </div>

              {/* Action buttons — always visible at the bottom */}
              <div className="flex gap-3 pt-1">
                <button
                  className="btn-rune rounded-lg py-3 px-4 text-stone-300 flex-1 text-base"
                  onClick={() => { setShowDifficulty(false); setSelected(null); }}
                >
                  Назад
                </button>
                <button
                  className={`rounded-lg py-3 px-4 flex-1 text-base font-semibold transition-all border ${
                    selected
                      ? 'bg-amber-800/70 hover:bg-amber-700/70 border-amber-500/60 text-amber-100 hover:border-amber-400/80'
                      : 'bg-stone-800/40 border-stone-700/40 text-stone-500 cursor-not-allowed'
                  }`}
                  disabled={!selected}
                  onClick={handleStart}
                >
                  Основать деревню
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-stone-600 text-xs mt-6 pb-4">
          Прототип · Управление: WASD — камера, колесо — зум
        </p>
      </div>

      {showSettings && (
        <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

function SliderRow({
  icon: Icon,
  label,
  value,
  min,
  max,
  step,
  onChange,
  leftLabel,
  rightLabel,
  displayValue,
}: {
  icon: typeof Mountain;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
  displayValue: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-stone-300 text-sm">
        <Icon size={14} className="text-amber-400/70" />
        <span className="flex-1">{label}</span>
        <span className="text-amber-200/80 tabular-nums text-sm font-medium w-6 text-right">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-600 h-1.5"
      />
      <div className="flex justify-between text-stone-600 text-[10px]">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
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
