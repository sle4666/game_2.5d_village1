import { Pause, Play, FastForward, Plus } from 'lucide-react';

interface TimeControlsProps {
  speed: number;
  onSpeedChange: (s: number) => void;
}

export default function TimeControls({ speed, onSpeedChange }: TimeControlsProps) {
  return (
    <div className="wood-panel rounded-xl px-2 py-1.5 flex items-center gap-1">
      <SpeedBtn active={speed === 0} onClick={() => onSpeedChange(0)} icon={Pause} label="Пауза" />
      <SpeedBtn active={speed === 1} onClick={() => onSpeedChange(1)} icon={Play} label="Обычно" />
      <SpeedBtn active={speed === 2} onClick={() => onSpeedChange(2)} icon={FastForward} label="Быстро" />
      <SpeedBtn active={speed === 3} onClick={() => onSpeedChange(3)} icon={Plus} label="Очень быстро" />
    </div>
  );
}

function SpeedBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Play;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`p-2 rounded-md transition-all ${
        active
          ? 'bg-amber-700/50 text-amber-100 ring-1 ring-amber-400/40'
          : 'bg-black/30 text-stone-400 hover:bg-amber-900/25'
      }`}
    >
      <Icon size={15} />
    </button>
  );
}
