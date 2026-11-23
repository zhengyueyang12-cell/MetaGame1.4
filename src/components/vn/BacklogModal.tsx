import React from 'react';
import { X } from 'lucide-react';
import { DualChannelTurn } from '../../types/vn';

interface BacklogModalProps {
  turns: DualChannelTurn[];
  contained?: boolean;
  onClose: () => void;
}

export const BacklogModal: React.FC<BacklogModalProps> = ({
  turns,
  contained = false,
  onClose,
}) => {
  return (
    <div
      className={`${contained ? 'absolute p-2.5' : 'fixed p-4'} inset-0 z-50 flex items-center justify-center bg-black/85`}
    >
      <div
        className={`w-full max-w-3xl rounded-xl bg-[#0D1017] border border-white/15 shadow-2xl overflow-hidden flex flex-col ${contained ? 'max-h-[92%]' : 'max-h-[85vh]'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="font-vn-serif text-lg font-semibold text-white">
              双频道通信日志 (Dual-Channel Log)
            </h2>
            <p className="text-xs text-zinc-400">
              完整记录公开监控层与本地 Debug_Console 现实同步注释历史
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          {turns.length === 0 ? (
            <p className="text-sm text-zinc-500 text-center py-10">当前暂无通信日志。</p>
          ) : (
            turns.map((turn) => (
              <div
                key={turn.id}
                className="p-4 rounded-lg bg-zinc-900/60 border border-white/10 space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-vn-mono">
                  <span className="text-sky-300">{turn.speaker}</span>
                  <span className="text-zinc-500">{turn.complianceLabel || 'LOG'}</span>
                </div>
                <p className="text-xs md:text-sm text-zinc-200 leading-relaxed">
                  <span className="font-vn-mono text-sky-400 mr-1">[PUBLIC]</span>
                  {turn.publicText}
                </p>
                {turn.debugText && (
                  <p className="font-vn-mono text-xs text-emerald-300 leading-relaxed whitespace-pre-line border-t border-white/5 pt-2">
                    {turn.debugText}
                  </p>
                )}
                {turn.memoryLeakText && (
                  <p className="font-vn-serif text-xs text-red-300 leading-relaxed border-t border-red-500/20 pt-2">
                    [{turn.memoryLeakCode}] {turn.memoryLeakText}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
