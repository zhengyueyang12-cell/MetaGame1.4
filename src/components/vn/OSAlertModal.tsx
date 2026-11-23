import React from 'react';
import { AlertTriangle, HeartCrack, ShieldAlert } from 'lucide-react';

interface OSAlertModalProps {
  title: string;
  message: string;
  variant?: 'warning' | 'error' | 'eve';
  contained?: boolean;
  onClose: () => void;
}

export const OSAlertModal: React.FC<OSAlertModalProps> = ({
  title,
  message,
  variant = 'warning',
  contained = false,
  onClose,
}) => {
  return (
    <div
      className={`${contained ? 'absolute p-2.5' : 'fixed p-4'} inset-0 z-[65] flex items-center justify-center bg-black/80`}
    >
      <div
        className={`w-full max-w-md max-h-[92%] overflow-y-auto rounded-lg shadow-2xl border overflow-hidden ${
          variant === 'eve'
            ? 'bg-[#170B12] border-rose-500/50 text-rose-50'
            : 'bg-[#181A20] border-zinc-600 text-zinc-100'
        }`}
      >
        <div
          className={`px-4 py-2.5 flex items-center justify-between border-b ${
            variant === 'eve' ? 'bg-rose-950/80 border-rose-500/30' : 'bg-zinc-900 border-white/10'
          }`}
        >
          <span className="font-vn-mono text-xs font-medium truncate">{title}</span>
          <span className="font-vn-mono text-[10px] text-zinc-400">SYSTEM_MSG</span>
        </div>
        <div className="p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-rose-500/15 text-rose-400 shrink-0">
            {variant === 'eve' ? (
              <HeartCrack className="w-6 h-6" />
            ) : variant === 'error' ? (
              <ShieldAlert className="w-6 h-6" />
            ) : (
              <AlertTriangle className="w-6 h-6" />
            )}
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-line text-zinc-200">{message}</p>
        </div>
        <div className="px-5 py-3 bg-black/35 border-t border-white/5 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
          >
            确定 (OK)
          </button>
        </div>
      </div>
    </div>
  );
};
