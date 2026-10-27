import { useState } from 'react';
import { ScrollText, User } from 'lucide-react';

interface EventLogProps {
  log: string[];
}

export default function EventLog({ log }: EventLogProps) {
  const [hovered, setHovered] = useState(false);
  const lastEntry = log[0] ?? 'Тишина в лесу...';

  return (
    <div
      className="wood-panel rounded-xl overflow-hidden w-64 transition-all duration-300"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Collapsed state: advisor portrait + last message */}
      <div className="flex items-center gap-2.5 p-2.5">
        <div className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-b from-amber-700/60 to-stone-800 flex items-center justify-center ring-1 ring-amber-500/30">
          <User size={18} className="text-amber-200/90" />
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

      {/* Expanded state: full log on hover */}
      {hovered && (
        <div className="px-3 pb-3 pt-1 border-t border-amber-900/30 animate-float-in">
          <div className="flex flex-col gap-1 thin-scroll overflow-y-auto max-h-48 mt-2">
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
