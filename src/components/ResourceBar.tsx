import { RESOURCE_ORDER, RESOURCES } from '@/game/constants';
import type { ResourceId } from '@/game/types';

interface ResourceBarProps {
  resources: Record<ResourceId, number>;
}

export default function ResourceBar({ resources }: ResourceBarProps) {
  return (
    <div className="flex items-center justify-around w-full h-full px-6">
      {RESOURCE_ORDER.map((id) => {
        const info = RESOURCES[id];
        const v = Math.floor(resources[id] ?? 0);
        const low = (id === 'food' || id === 'wood') && v < 15;
        return (
          <div
            key={id}
            className="flex items-center gap-1.5 transition-colors"
            title={info.name}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${low ? 'animate-pulse' : ''}`}
              style={{ background: info.color }}
            />
            <span
              className={`tabular-nums text-sm font-medium min-w-[2ch] text-right ${
                low ? 'text-red-400' : 'text-stone-200'
              }`}
            >
              {v}
            </span>
            <span className="text-stone-500 text-xs hidden md:inline">{info.name}</span>
          </div>
        );
      })}
    </div>
  );
}
