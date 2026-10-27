import { useState } from 'react';
import { Users, GraduationCap, UserPlus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { CitizenClass } from '@/game/types';
import { CLASSES, CLASS_ORDER } from '@/game/constants';

interface SocietyPanelProps {
  classCounts: Record<CitizenClass, number>;
  masterPool: { classId: CitizenClass }[];
  trainingCount: number;
  onTrain: () => void;
  canTrain: boolean;
}

export default function SocietyPanel({
  classCounts,
  masterPool,
  trainingCount,
  onTrain,
  canTrain,
}: SocietyPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="wood-panel rounded-xl overflow-hidden w-64">
      <button
        className="w-full px-4 py-2.5 flex items-center justify-between text-amber-100 hover:bg-amber-900/20"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-display text-lg flex items-center gap-2">
          <Users size={18} className="text-amber-400/80" />
          Общество
        </span>
        <span className="text-stone-400">
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3">
          <div className="flex flex-col gap-1.5">
            {CLASS_ORDER.map((id) => {
              const info = CLASSES[id];
              const count = classCounts[id] ?? 0;
              const freeMasters = masterPool.filter((m) => m.classId === id).length;
              return (
                <div key={id} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: info.color }}
                  />
                  <span className="text-stone-300 text-sm flex-1">{info.name}</span>
                  <span className="text-amber-100 tabular-nums text-sm font-medium">{count}</span>
                  {freeMasters > 0 && (
                    <span className="text-emerald-400/70 text-[10px]" title="Свободный мастер">
                      +{freeMasters}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-2 border-t border-amber-900/30">
            <div className="flex items-center gap-1.5 text-stone-400 text-xs mb-1.5">
              <GraduationCap size={12} />
              Училище
            </div>
            {trainingCount > 0 && (
              <div className="text-stone-500 text-xs mb-1.5">
                В обучении: {trainingCount} смердов
              </div>
            )}
            <button
              onClick={onTrain}
              disabled={!canTrain}
              className={`btn-rune rounded-lg py-1.5 px-2 text-xs flex items-center justify-center gap-1.5 w-full ${
                !canTrain ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              <UserPlus size={12} />
              Обучить ремеслу
            </button>
            {!canTrain && (
              <div className="text-stone-600 text-[10px] mt-1 flex items-center gap-1">
                <AlertTriangle size={9} /> Нужен смерд и 16 пищи
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
