import { RESOURCE_ORDER, RESOURCES } from '@/game/constants';
import type { ResourceId } from '@/game/types';

interface ResourceBarProps {
  resources: Record<ResourceId, number>;
}

const ICONS: Record<string, string> = {
  wood: '🪵',
  stone: '🪨',
  ore: '⛏',
  food: '🍞',
  skins: '🐾',
  faith: '✨',
  gold: '🪙',
  workers: '👤',
};

// We avoid emoji in user-facing text, but small resource glyphs in a HUD are
// acceptable as compact iconography. Use simple text labels instead.
export default function ResourceBar({ resources }: ResourceBarProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {RESOURCE_ORDER.map((id) => {
        const info = RESOURCES[id];
        const v = Math.floor(resources[id] ?? 0);
        const low = (id === 'food' || id === 'wood') && v < 15;
        return (
          <div
            key={id}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md ${
              low ? 'bg-red-900/40 ring-1 ring-red-500/40' : 'bg-black/40'
            }`}
            title={info.name}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: info.color }}
            />
            <span className="text-stone-200 tabular-nums text-sm font-medium min-w-[2ch] text-right">
              {v}
            </span>
            <span className="text-stone-500 text-xs hidden sm:inline">{info.name}</span>
          </div>
        );
      })}
    </div>
  );
}
