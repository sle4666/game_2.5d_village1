import { Home, Pickaxe, Hammer, Warehouse, Sparkles, Shield, X, TreePine } from 'lucide-react';
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
  return (
    <div className="h-full overflow-y-auto thin-scroll px-4 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-amber-300/90 text-xs uppercase tracking-wider border-b border-amber-900/30 pb-2">
        <Hammer size={14} />
        Строительство
      </div>
      {BUILD_CATEGORIES.map((cat) => {
        const Icon = CAT_ICONS[cat.id] ?? TreePine;
        return (
          <div key={cat.id}>
            <div className="flex items-center gap-1.5 text-stone-400 text-xs uppercase tracking-wider mb-1.5">
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
                    className={`text-left rounded-lg px-2.5 py-2 transition-all border ${
                      isActive
                        ? 'bg-amber-800/40 ring-1 ring-amber-400/50 border-amber-500/40'
                        : canAfford
                        ? 'bg-stone-800/60 hover:bg-stone-700/50 border-stone-700/50'
                        : 'bg-stone-800/30 opacity-50 cursor-not-allowed border-stone-800/30'
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
          className="rounded-lg py-1.5 text-sm text-stone-300 flex items-center justify-center gap-1.5 mt-1 bg-stone-800/60 hover:bg-stone-700/50 border border-stone-700/50 transition-all"
        >
          <X size={14} /> Отменить
        </button>
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
