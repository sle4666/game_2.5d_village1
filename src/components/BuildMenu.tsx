import { Home, Pickaxe, Hammer, Warehouse, Sparkles, Shield, X, TreePine, Route } from 'lucide-react';
import { BUILDINGS, BUILD_CATEGORIES } from '@/game/constants';
import type { BuildMode } from '@/game/types';
import type { ResourceId } from '@/game/types';

interface BuildMenuProps {
  resources: Record<ResourceId, number>;
  selected: BuildMode | null;
  onSelect: (mode: BuildMode | null) => void;
}

const CAT_ICONS: Record<string, typeof Home> = {
  housing: Home,
  production: Pickaxe,
  storage: Warehouse,
  faith: Sparkles,
  defense: Shield,
};

const ROAD_LABEL = 'Грунтовая дорога';
const ROAD_DESCRIPTION = 'Вытоптанный тракт. Пешие Смерды ходят по нему быстрее и выбирают его для пути.';

export default function BuildMenu({ resources, selected, onSelect }: BuildMenuProps) {
  const roadActive = selected === 'road';
  const roadAffordable = resources.stone >= 1 || resources.wood >= 1;

  return (
    <div className="h-full overflow-y-auto thin-scroll px-4 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-amber-300/90 text-xs uppercase tracking-wider border-b border-amber-900/30 pb-2">
        <Hammer size={14} />
        Строительство
      </div>

      <div>
        <div className="flex items-center gap-1.5 text-stone-400 text-xs uppercase tracking-wider mb-1.5">
          <Route size={12} />
          Инфраструктура
        </div>
        <button
          onClick={() => onSelect(roadActive ? null : 'road')}
          disabled={!roadAffordable}
          className={`w-full text-left rounded-lg px-2.5 py-2 transition-all border ${
            roadActive
              ? 'bg-amber-800/40 ring-1 ring-amber-400/50 border-amber-500/40'
              : roadAffordable
              ? 'bg-stone-800/60 hover:bg-stone-700/50 border-stone-700/50'
              : 'bg-stone-800/30 opacity-50 cursor-not-allowed border-stone-800/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-amber-100 text-sm font-medium">{ROAD_LABEL}</span>
            <span className="w-3 h-3 rounded-sm shrink-0 bg-[rgb(120,104,88)]" />
          </div>
          <div className="text-stone-500 text-[11px] mt-0.5 leading-snug">{ROAD_DESCRIPTION}</div>
          <div className="flex gap-2 mt-1 flex-wrap">
            <span
              className={`text-[10px] ${roadAffordable ? 'text-stone-400' : 'text-red-400'}`}
            >
              {RES_LABEL.stone} 1 или {RES_LABEL.wood} 1 за клетку
            </span>
          </div>
        </button>
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
                const canAfford = canPay(b.cost, resources);
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
                      {Object.entries(b.cost).length === 0 && (
                        <span className="text-[10px] text-stone-400">Бесплатно</span>
                      )}
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

function canPay(cost: Partial<Record<ResourceId, number>>, resources: Record<ResourceId, number>): boolean {
  for (const [id, amt] of Object.entries(cost)) {
    if ((resources[id as ResourceId] ?? 0) < (amt ?? 0)) return false;
  }
  return true;
}
