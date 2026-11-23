import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { GameSettings } from '../../types/vn';

interface SettingsModalProps {
  settings: GameSettings;
  contained?: boolean;
  onChange: (next: GameSettings) => void;
  onResetMeta: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  contained = false,
  onChange,
  onResetMeta,
  onClose,
}) => {
  return (
    <div
      className={`${contained ? 'absolute p-2.5' : 'fixed p-4'} inset-0 z-50 flex items-center justify-center bg-black/85`}
    >
      <div
        className={`w-full max-w-lg rounded-xl bg-[#0D1017] border border-white/15 shadow-2xl overflow-hidden flex flex-col ${contained ? 'max-h-[92%] overflow-y-auto' : ''}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="font-vn-serif text-lg font-semibold text-white">终端与声效设置</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-6 text-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-zinc-200">
              <span>背景音轨音量 (BGM)</span>
              <span className="font-vn-mono text-xs text-zinc-400 tabular-nums">
                {Math.round(settings.bgmVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.bgmVolume}
              onChange={(e) => onChange({ ...settings, bgmVolume: Number(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-zinc-200">
              <span>终端交互与警报音量 (SFX)</span>
              <span className="font-vn-mono text-xs text-zinc-400 tabular-nums">
                {Math.round(settings.sfxVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              onChange={(e) => onChange({ ...settings, sfxVolume: Number(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <span className="block text-zinc-200">故障与闪烁演出强度</span>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-zinc-900 border border-white/10">
              {[
                { id: 'full', label: '完整演出（含故障与抖动）' },
                { id: 'mild', label: '柔和模式（减弱强闪烁）' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() =>
                    onChange({ ...settings, metaIntensity: opt.id as 'full' | 'mild' })
                  }
                  className={`px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    settings.metaIntensity === opt.id
                      ? 'bg-emerald-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
            <button
              onClick={() => {
                onResetMeta();
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-red-950/60 border border-red-500/30 text-red-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重置沙盒、零件与存档
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
