import { Pause, Play, FastForward, Snowflake, Leaf, Sun, CloudRain } from 'lucide-react';
import type { Season } from '@/game/types';
import { DAYS_PER_SEASON, SEASON_INFO } from '@/game/constants';

interface TopBarProps {
  season: Season;
  day: number;
  totalDays: number;
  speed: number;
  population: number;
  housingUsed: number;
  onSpeedChange: (s: number) => void;
  onMenu: () => void;
}

const SEASON_ICONS: Record<Season, typeof Sun> = {
  spring: Leaf,
  summer: Sun,
  autumn: CloudRain,
  winter: Snowflake,
};

export default function TopBar({
  season,
  day,
  totalDays,
  speed,
  population,
  housingUsed,
  onSpeedChange,
  onMenu,
}: TopBarProps) {
  const Icon = SEASON_ICONS[season];
  const sinfo = SEASON_INFO[season];
  const dayN = day + 1;
  const seasonProgress = Math.round((day / DAYS_PER_SEASON) * 100);

  return (
    <div className="wood-panel rounded-xl px-4 py-2 flex items-center gap-4 flex-wrap">
      {/* Season + date */}
      <div className="flex items-center gap-2.5">
        <Icon size={20} style={{ color: sinfo.accent }} />
        <div>
          <div className="text-amber-100 text-sm font-medium leading-tight">
            {sinfo.name} · День {dayN}
          </div>
          <div className="text-stone-500 text-[10px] leading-tight">
            Всего: {totalDays} · {seasonProgress}% сезона
          </div>
        </div>
      </div>

      <div className="h-8 w-px bg-amber-900/30" />

      {/* Population */}
      <div className="flex items-center gap-2">
        <div className="text-stone-400 text-xs">
          <div className="text-amber-100 text-sm font-medium leading-tight tabular-nums">
            {population}/{housingUsed}
          </div>
          <div className="leading-tight">Жители</div>
        </div>
      </div>

      <div className="h-8 w-px bg-amber-900/30" />

      {/* Speed controls */}
      <div className="flex items-center gap-1">
        <SpeedBtn active={speed === 0} onClick={() => onSpeedChange(0)} icon={Pause} label="Пауза" />
        <SpeedBtn active={speed === 1} onClick={() => onSpeedChange(1)} icon={Play} label="Обычно" />
        <SpeedBtn active={speed === 2} onClick={() => onSpeedChange(2)} icon={FastForward} label="Быстро" />
      </div>

      <div className="flex-1" />

      <button
        onClick={onMenu}
        className="btn-rune rounded-md px-3 py-1.5 text-sm text-stone-300"
      >
        В меню
      </button>
    </div>
  );
}

function SpeedBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Play;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-2 rounded-md transition-all ${
        active
          ? 'bg-amber-700/50 text-amber-100 ring-1 ring-amber-400/40'
          : 'bg-black/30 text-stone-400 hover:bg-amber-900/25'
      }`}
    >
      <Icon size={15} />
    </button>
  );
}
