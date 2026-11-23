import React from 'react';
import { Lock, Save, Trash2, Upload, X } from 'lucide-react';
import { BUREAU_ASSETS } from '../../data/bureauScript';
import { MetaState, SaveSlot } from '../../types/vn';

interface SaveLoadModalProps {
  mode: 'save' | 'load';
  saves: SaveSlot[];
  metaState: MetaState;
  contained?: boolean;
  onClose: () => void;
  onSaveSlot: (slotId: number) => void;
  onLoadSlot: (slotId: number) => void;
  onDeleteSlot: (slotId: number) => void;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  mode,
  saves,
  metaState,
  contained = false,
  onClose,
  onSaveSlot,
  onLoadSlot,
  onDeleteSlot,
}) => {
  return (
    <div
      className={`${contained ? 'absolute p-2.5' : 'fixed p-4'} inset-0 z-50 flex items-center justify-center bg-black/85`}
    >
      <div
        className={`w-full max-w-4xl rounded-xl bg-[#0D1017] border border-white/15 shadow-2xl overflow-hidden flex flex-col ${contained ? 'max-h-[92%]' : 'max-h-[88vh]'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h2 className="font-vn-serif text-lg font-semibold text-white">
              {mode === 'save' ? '保存当前进度' : '读取历史存档'}
            </h2>
            {metaState.savesLocked && (
              <span className="text-xs text-rose-400 font-vn-mono flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" />
                所有退路已被 DeepSeek 封锁 · 无法回溯至校园节点
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          {saves.map((slot) => {
            const thumb =
              slot.bg && slot.bg !== 'black'
                ? BUREAU_ASSETS.backgrounds[slot.bg]
                : BUREAU_ASSETS.backgrounds.bureau;
            return (
              <div
                key={slot.slotId}
                className={`rounded-lg border overflow-hidden flex flex-col justify-between ${
                  slot.hijacked
                    ? 'bg-rose-950/30 border-rose-500/40'
                    : 'bg-zinc-900/80 border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex gap-4 p-4">
                  <div className="relative w-28 h-20 rounded-md overflow-hidden bg-black shrink-0 border border-white/10">
                    {!slot.empty ? (
                      <img
                        src={thumb}
                        alt={`Slot ${slot.slotId}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-600 font-vn-mono">
                        EMPTY
                      </div>
                    )}
                    <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-vn-mono text-zinc-300 tabular-nums">
                      #{slot.slotId.toString().padStart(2, '0')}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    {slot.empty ? (
                      <>
                        <p className="text-sm font-medium text-zinc-400">空白归档槽位</p>
                        <p className="text-xs text-zinc-600">点击保存当前夜班节点</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-zinc-100 truncate">
                            {slot.dayTitle}
                          </p>
                          <span className="text-[11px] text-zinc-500 font-vn-mono shrink-0 tabular-nums">
                            {slot.savedAt}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                          {slot.previewText}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="px-4 py-2.5 bg-black/40 border-t border-white/5 flex items-center justify-between gap-2">
                  <span className="text-xs font-vn-mono text-zinc-500 tabular-nums">
                    {!slot.empty ? `DAY 0${slot.day || 1} · TURN ${slot.turnCount || 0}` : 'NO DATA'}
                  </span>
                  <div className="flex items-center gap-2">
                    {mode === 'save' ? (
                      <button
                        onClick={() => onSaveSlot(slot.slotId)}
                        className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <Save className="w-3.5 h-3.5" />
                        保存
                      </button>
                    ) : (
                      !slot.empty &&
                      (slot.hijacked ? (
                        <span className="px-2.5 py-1 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[11px] font-vn-mono flex items-center gap-1 whitespace-nowrap">
                          <Lock className="w-3 h-3" />
                          OVERWRITTEN
                        </span>
                      ) : (
                        <button
                          onClick={() => onLoadSlot(slot.slotId)}
                          className="px-3 py-1.5 rounded-md bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          读取
                        </button>
                      ))
                    )}
                    {!slot.empty && !slot.hijacked && (
                      <button
                        onClick={() => onDeleteSlot(slot.slotId)}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-white/5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
