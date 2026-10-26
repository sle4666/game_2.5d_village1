import { ScrollText } from 'lucide-react';

interface EventLogProps {
  log: string[];
}

export default function EventLog({ log }: EventLogProps) {
  return (
    <div className="wood-panel rounded-xl p-3 w-64 max-h-48 overflow-hidden">
      <div className="flex items-center gap-1.5 text-amber-400/80 text-xs uppercase tracking-wider mb-2">
        <ScrollText size={12} />
        Летопись
      </div>
      <div className="flex flex-col gap-1 thin-scroll overflow-y-auto max-h-36">
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
  );
}
