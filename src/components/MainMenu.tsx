import { useState, useEffect } from 'react';
import { Trees, Scroll, Settings, LogOut, Flame, Swords, Shield, Mountain, Waves, Play, ArrowLeft } from 'lucide-react';
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
  const [rivers, setRivers] = useState(2);

  useEffect(() => {
    setCanLoad(hasSave());
  }, []);

  const handleStart = () => {
    if (!selected) return;
    onStart(selected, {
      hills: hills / 100,
      rivers,
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
        {/* ---- Landing screen ---- */}
        {!showDifficulty ? (
          <div className="animate-float-in">
            {/* Title block */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 text-amber-500/70 mb-3">
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

            {/* Menu buttons */}
            <div className="wood-panel rounded-xl p-6">
              <div className="flex flex-col gap-3">
                <MenuButton icon={Play} label="Новая игра" onClick={() => { initAudio(); setShowDifficulty(true); }} primary />
                <MenuButton icon={Scroll} label="Загрузить игру" onClick={onLoad} disabled={!canLoad} />
                <MenuButton icon={Settings} label="Настройки" onClick={() => { initAudio(); setShowSettings(true); }} />
                <MenuButton icon={LogOut} label="Выйти" onClick={() => window.close()} />
              </div>
            </div>

            <p className="text-center text-stone-600 text-xs mt-6 pb-4">
              Управление: WASD — камера, колесо — зум
            </p>
          </div>
        ) : (
          /* ---- Difficulty selection screen ---- */
          <div className="wood-panel rounded-xl p-6 animate-float-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-1">
                <button
                  className="text-stone-400 hover:text-amber-100 transition-colors"
                  onClick={() => { setShowDifficulty(false); setSelected(null); }}
                >
                  <ArrowLeft size={22} />
                </button>
                <h3 className="font-display text-2xl text-amber-100">Выберите судьбу</h3>
              </div>

              <div className="flex flex-col gap-3">
                {(Object.keys(DIFFICULTIES) as DifficultyId[]).map((id) => {
                  const d = DIFFICULTIES[id];
                  const Icon = DIFFICULTY_ICONS[id];
                  const isSelected = selected === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelected(id)}
                      className={`btn-rune rounded-lg p-4 text-left flex items-start gap-4 transition-all ${
                        isSelected ? 'ring-2 ring-amber-400/60 bg-amber-900/20' : ''
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

              <button
                className={`w-full rounded-lg py-4 px-4 text-lg font-semibold transition-all border ${
                  selected
                    ? 'bg-amber-800/70 hover:bg-amber-700/70 border-amber-500/60 text-amber-100 hover:border-amber-400/80'
                    : 'bg-stone-800/40 border-stone-700/40 text-stone-500 cursor-not-allowed'
                }`}
                disabled={!selected}
                onClick={handleStart}
              >
                Начать игру
              </button>
            </div>
          </div>
        )}
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
      className={`btn-rune rounded-lg py-3 px-5 flex items-center gap-3 text-left transition-all ${
        primary ? 'text-amber-100 ring-1 ring-amber-500/40 hover:ring-amber-400/70' : 'text-stone-300'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <Icon size={20} className="text-amber-400/70" />
      <span className="font-display text-lg">{label}</span>
    </button>
  );
}
