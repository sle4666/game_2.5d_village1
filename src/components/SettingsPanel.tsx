import { useState } from 'react';
import { X, Music, Volume2, Zap } from 'lucide-react';
import {
  getMusicVolume,
  getAmbientVolume,
  getSfxVolume,
  setMusicVolume,
  setAmbientVolume,
  setSfxVolume,
} from '@/game/AudioSystem';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [music, setMusic] = useState(getMusicVolume());
  const [ambient, setAmbient] = useState(getAmbientVolume());
  const [sfx, setSfx] = useState(getSfxVolume());

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="wood-panel rounded-xl p-6 w-80 animate-float-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-amber-100">Настройки</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-amber-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <Slider
            icon={Music}
            label="Громкость музыки"
            value={music}
            onChange={(v) => { setMusic(v); setMusicVolume(v); }}
          />
          <Slider
            icon={Volume2}
            label="Громкость эмбиента"
            value={ambient}
            onChange={(v) => { setAmbient(v); setAmbientVolume(v); }}
          />
          <Slider
            icon={Zap}
            label="Громкость звуков"
            value={sfx}
            onChange={(v) => { setSfx(v); setSfxVolume(v); }}
          />
        </div>

        <button
          onClick={onClose}
          className="btn-rune rounded-lg py-2 px-4 text-amber-100 w-full mt-6"
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}

function Slider({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: typeof Music;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-amber-100 text-sm mb-2">
        <Icon size={15} className="text-amber-400/70" />
        {label}
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-amber-500"
      />
      <div className="text-stone-500 text-[10px] mt-1">
        {Math.round(value * 100)}%
      </div>
    </div>
  );
}
