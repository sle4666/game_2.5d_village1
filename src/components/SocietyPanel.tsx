import { Users, GraduationCap, UserPlus, AlertTriangle } from 'lucide-react';
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
  return (
    <div className="h-full overflow-y-auto thin-scroll px-4 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-amber-300/90 text-xs uppercase tracking-wider border-b border-amber-900/30 pb-2">
        <Users size={14} />
        Общество
      </div>

      <div className="flex flex-col gap-2">
        {CLASS_ORDER.map((id) => {
          const info = CLASSES[id];
          const count = classCounts[id] ?? 0;
          const freeMasters = masterPool.filter((m) => m.classId === id).length;
          return (
            <div
              key={id}
              className="flex items-center gap-2 bg-stone-800/40 rounded-lg px-3 py-2 border border-stone-700/40"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: info.color }}
              />
              <div className="flex-1">
                <div className="text-stone-200 text-sm">{info.name}</div>
                <div className="text-stone-500 text-[10px] leading-tight">{info.description}</div>
              </div>
              <span className="text-amber-100 tabular-nums text-base font-medium">{count}</span>
              {freeMasters > 0 && (
                <span className="text-emerald-400/70 text-[10px]" title="Свободный мастер">
                  +{freeMasters}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-1 pt-2 border-t border-stone-700/40">
        <div className="flex items-center gap-1.5 text-stone-400 text-xs mb-2">
          <GraduationCap size={12} />
          Училище
        </div>
        {trainingCount > 0 && (
          <div className="text-stone-500 text-xs mb-2">
            В обучении: {trainingCount} смердов
          </div>
        )}
        <button
          onClick={onTrain}
          disabled={!canTrain}
          className={`rounded-lg py-2 px-2 text-xs flex items-center justify-center gap-1.5 w-full border transition-all ${
            canTrain
              ? 'bg-stone-800/60 hover:bg-stone-700/50 border-stone-700/50 text-amber-100'
              : 'bg-stone-800/30 border-stone-800/30 text-stone-500 cursor-not-allowed'
          }`}
        >
          <UserPlus size={12} />
          Обучить ремеслу
        </button>
        {!canTrain && (
          <div className="text-stone-600 text-[10px] mt-1.5 flex items-center gap-1">
            <AlertTriangle size={9} /> Нужен смерд и 16 пищи
          </div>
        )}
      </div>
    </div>
  );
}
