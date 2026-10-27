import { RESOURCE_ORDER, RESOURCES } from '@/game/constants';
import type { ResourceId } from '@/game/types';

interface ResourceBarProps {
  resources: Record<ResourceId, number>;
}

export default function ResourceBar({ resources }: ResourceBarProps) {
  return (
    <div className="wood-panel rounded-xl px-3 py-2 flex items-center gap-2 flex-row flex-wrap justify-center max-w-[90vw]">
      {RESOURCE_ORDER.map((id) => {
        const info = RESOURCES[id];
        const v = Math.floor(resources[id] ?? 0);
        const low = (id === 'food' || id === 'wood') && v < 15;
        return (
          <div
            key={id}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
              low ? 'bg-red-900/40 ring-1 ring-red-500/40' : 'bg-black/30'
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
            <span className="text-stone-500 text-xs hidden md:inline">{info.name}</span>
          </div>
        );
      })}
    </div>
  );
}
