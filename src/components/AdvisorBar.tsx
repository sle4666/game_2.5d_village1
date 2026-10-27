import { Snowflake, Leaf, Sun, CloudRain, User, ScrollText } from 'lucide-react';
import { useState } from 'react';
import type { Season } from '@/game/types';
import { DAYS_PER_SEASON, SEASON_INFO } from '@/game/constants';

interface AdvisorBarProps {
  season: Season;
  day: number;
  totalDays: number;
  log: string[];
}

const SEASON_ICONS: Record<Season, typeof Sun> = {
  spring: Leaf,
  summer: Sun,
  autumn: CloudRain,
  winter: Snowflake,
};

export default function AdvisorBar({ season, day, totalDays, log }: AdvisorBarProps) {
  const [hovered, setHovered] = useState(false);
  const Icon = SEASON_ICONS[season];
  const sinfo = SEASON_INFO[season];
  const dayN = day + 1;
  const seasonProgress = Math.round((day / DAYS_PER_SEASON) * 100);
  const lastEntry = log[0] ?? 'Тишина в лесу...';

  return (
    <div
      className="wood-panel rounded-xl overflow-hidden w-72 transition-all duration-300"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top row: season + date */}
      <div className="flex items-center gap-2.5 px-3 pt-2.5 pb-1.5">
        <Icon size={18} style={{ color: sinfo.accent }} />
        <div className="flex-1">
          <div className="text-amber-100 text-sm font-medium leading-tight">
            {sinfo.name} · День {dayN}
          </div>
          <div className="text-stone-500 text-[10px] leading-tight">
            Всего: {totalDays} · {seasonProgress}% сезона
          </div>
        </div>
      </div>

      {/* Advisor portrait + speech */}
      <div className="flex items-center gap-2.5 px-3 pb-2.5 border-t border-amber-900/20 pt-2">
        <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-b from-amber-700/60 to-stone-800 flex items-center justify-center ring-1 ring-amber-500/30">
          <User size={20} className="text-amber-200/90" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-amber-400/70 text-[10px] uppercase tracking-wider leading-tight">
            <ScrollText size={9} />
            Советник
          </div>
          <div className="text-amber-100/80 text-xs leading-snug truncate">
            {lastEntry}
          </div>
        </div>
      </div>

      {/* Expanded log on hover */}
      {hovered && (
        <div className="px-3 pb-3 pt-1 border-t border-amber-900/30">
          <div className="flex flex-col gap-1 thin-scroll overflow-y-auto max-h-40 mt-2">
            {log.length === 0 && (
              <div className="text-stone-600 text-xs italic">Тишина в лесу...</div>
            )}
            {log.map((entry, i) => (
              <div
                key={i}
                className={`text-xs leading-snug ${
                  i === 0 ? 'text-amber-100/90' : 'text-stone-500'
                }`}
              >
                {entry}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
