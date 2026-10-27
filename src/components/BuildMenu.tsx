import { useState } from 'react';
import { Home, Pickaxe, Hammer, Warehouse, Sparkles, Shield, X, TreePine, ChevronDown, ChevronUp } from 'lucide-react';
import { BUILDINGS, BUILD_CATEGORIES } from '@/game/constants';
import type { BuildingType, BuildingTypeId } from '@/game/types';
import type { ResourceId } from '@/game/types';

interface BuildMenuProps {
  resources: Record<ResourceId, number>;
  selected: BuildingTypeId | null;
  onSelect: (id: BuildingTypeId | null) => void;
}

const CAT_ICONS: Record<string, typeof Home> = {
  housing: Home,
  production: Pickaxe,
  storage: Warehouse,
  faith: Sparkles,
  defense: Shield,
};

export default function BuildMenu({ resources, selected, onSelect }: BuildMenuProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="wood-panel rounded-xl overflow-hidden w-64">
      <button
        className="w-full px-4 py-2.5 flex items-center justify-between text-amber-100 hover:bg-amber-900/20"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-display text-lg flex items-center gap-2">
          <Hammer size={18} className="text-amber-400/80" />
          Строительство
        </span>
        <span className="text-stone-400">
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 flex flex-col gap-3 max-h-[60vh] overflow-y-auto thin-scroll">
          {BUILD_CATEGORIES.map((cat) => {
            const Icon = CAT_ICONS[cat.id] ?? TreePine;
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-1.5 text-stone-400 text-xs uppercase tracking-wider mb-1.5 mt-1">
                  <Icon size={12} />
                  {cat.name}
                </div>
                <div className="flex flex-col gap-1.5">
                  {cat.types.map((id) => {
                    const b = BUILDINGS[id];
                    const canAfford = canPay(b, resources);
                    const isActive = selected === id;
                    return (
                      <button
                        key={id}
                        onClick={() => onSelect(isActive ? null : id)}
                        disabled={!canAfford}
                        className={`text-left rounded-lg px-2.5 py-2 transition-all ${
                          isActive
                            ? 'bg-amber-800/40 ring-1 ring-amber-400/50'
                            : canAfford
                            ? 'bg-black/30 hover:bg-amber-900/25'
                            : 'bg-black/20 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-amber-100 text-sm font-medium">{b.name}</span>
                          <span
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ background: b.color }}
                          />
                        </div>
                        <div className="text-stone-500 text-[11px] mt-0.5 leading-snug">
                          {b.description}
                        </div>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {Object.entries(b.cost).map(([rid, amt]) => (
                            <span
                              key={rid}
                              className={`text-[10px] ${
                                (resources[rid as ResourceId] ?? 0) >= (amt ?? 0)
                                  ? 'text-stone-400'
                                  : 'text-red-400'
                              }`}
                            >
                              {RES_LABEL[rid as ResourceId]} {amt}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {selected && (
            <button
              onClick={() => onSelect(null)}
              className="btn-rune rounded-lg py-1.5 text-sm text-stone-300 flex items-center justify-center gap-1.5 mt-1"
            >
              <X size={14} /> Отменить
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const RES_LABEL: Record<ResourceId, string> = {
  wood: 'Дерево',
  stone: 'Камень',
  ore: 'Руда',
  food: 'Пища',
  skins: 'Шкуры',
  faith: 'Вера',
  gold: 'Золото',
  workers: 'Жит.',
};

function canPay(b: BuildingType, resources: Record<ResourceId, number>): boolean {
  for (const [id, amt] of Object.entries(b.cost)) {
    if ((resources[id as ResourceId] ?? 0) < (amt ?? 0)) return false;
  }
  return true;
}
