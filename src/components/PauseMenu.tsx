import { Menu, X, Play, Settings, Save, Home } from 'lucide-react';

interface PauseMenuProps {
  open: boolean;
  onClose: () => void;
  onSettings: () => void;
  onSave: () => void;
  onExit: () => void;
}

export default function PauseMenu({ open, onClose, onSettings, onSave, onExit }: PauseMenuProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="wood-panel rounded-xl p-6 w-72 animate-float-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-amber-100">Меню</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-amber-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <MenuBtn icon={Play} label="Продолжить" onClick={onClose} />
          <MenuBtn icon={Settings} label="Настройки" onClick={onSettings} />
          <MenuBtn icon={Save} label="Сохранить игру" onClick={onSave} />
          <MenuBtn icon={Home} label="В главное меню" onClick={onExit} />
        </div>
      </div>
    </div>
  );
}

function MenuBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="btn-rune rounded-lg py-2.5 px-4 flex items-center gap-3 text-left text-stone-300 hover:text-amber-100 transition-colors"
    >
      <Icon size={18} className="text-amber-400/70" />
      <span className="font-display text-base">{label}</span>
    </button>
  );
}
