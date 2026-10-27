import { ScrollText, Swords, ShoppingBag, Footprints } from 'lucide-react';
import type { Guest } from '@/game/types';

interface GuestsPanelProps {
  guests: Guest[];
}

const KIND_ICON = {
  envoy: Swords,
  merchant: ShoppingBag,
  refugee: Footprints,
};

const KIND_LABEL = {
  envoy: 'Посол',
  merchant: 'Купец',
  refugee: 'Беженец',
};

export default function GuestsPanel({ guests }: GuestsPanelProps) {
  if (guests.length === 0) return null;
  return (
    <div className="wood-panel rounded-xl p-3 w-64">
      <div className="flex items-center gap-1.5 text-amber-400/80 text-xs uppercase tracking-wider mb-2">
        <ScrollText size={12} />
        Гости
      </div>
      <div className="flex flex-col gap-1.5">
        {guests.map((g) => {
          const Icon = KIND_ICON[g.kind];
          return (
            <div key={g.uid} className="flex items-start gap-2 text-xs">
              <Icon size={14} className="mt-0.5 text-amber-400/70 shrink-0" />
              <div className="flex-1">
                <div className="text-amber-100/90">{g.name}</div>
                <div className="text-stone-500 text-[10px]">
                  {KIND_LABEL[g.kind]} · {g.origin}
                </div>
                {g.arrivesInDays > 0 ? (
                  <div className="text-stone-600 text-[10px]">
                    В пути: {g.arrivesInDays} дн.
                  </div>
                ) : g.housed ? (
                  <div className="text-emerald-500/70 text-[10px]">
                    Размещён · убытие через {g.stayingDays} дн.
                  </div>
                ) : (
                  <div className="text-red-400/70 text-[10px]">
                    Нужна корчма!
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
