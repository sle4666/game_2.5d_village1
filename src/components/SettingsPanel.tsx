import { useState } from 'react';
import { X, Music, Volume2 } from 'lucide-react';
import {
  getMusicVolume,
  getAmbientVolume,
  setMusicVolume,
  setAmbientVolume,
} from '@/game/AudioSystem';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const [music, setMusic] = useState(getMusicVolume());
  const [ambient, setAmbient] = useState(getAmbientVolume());

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
          {/* Music volume */}
          <div>
            <div className="flex items-center gap-2 text-amber-100 text-sm mb-2">
              <Music size={15} className="text-amber-400/70" />
              Громкость музыки
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={music}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setMusic(v);
                setMusicVolume(v);
              }}
              className="w-full accent-amber-500"
            />
            <div className="text-stone-500 text-[10px] mt-1">
              {Math.round(music * 100)}%
            </div>
          </div>

          {/* Ambient/SFX volume */}
          <div>
            <div className="flex items-center gap-2 text-amber-100 text-sm mb-2">
              <Volume2 size={15} className="text-amber-400/70" />
              Громкость звуков и эмбиента
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={ambient}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setAmbient(v);
                setAmbientVolume(v);
              }}
              className="w-full accent-amber-500"
            />
            <div className="text-stone-500 text-[10px] mt-1">
              {Math.round(ambient * 100)}%
            </div>
          </div>
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
