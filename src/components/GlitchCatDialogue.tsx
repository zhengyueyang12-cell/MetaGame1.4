import { useCallback, useEffect, useState } from 'react';
import type { CatDialogueLine } from '../game/types';

interface GlitchCatDialogueProps {
  lines: CatDialogueLine[];
  onClose: () => void;
}

export function GlitchCatDialogue({ lines, onClose }: GlitchCatDialogueProps) {
  const [lineIdx, setLineIdx] = useState(0);
  const [charCount, setCharCount] = useState(0);

  const current = lines[lineIdx];
  const fullText = current?.text ?? '';
  const isComplete = charCount >= fullText.length;
  const isLast = lineIdx >= lines.length - 1;

  useEffect(() => {
    setCharCount(0);
  }, [lineIdx, lines]);

  useEffect(() => {
    if (isComplete) return;
    const timer = window.setTimeout(() => {
      setCharCount((c) => Math.min(fullText.length, c + 1));
    }, 22);
    return () => window.clearTimeout(timer);
  }, [charCount, fullText.length, isComplete]);

  const advanceOrClose = useCallback(() => {
    if (!isComplete) {
      setCharCount(fullText.length);
      return;
    }
    if (!isLast) {
      setLineIdx((i) => i + 1);
    } else {
      onClose();
    }
  }, [fullText.length, isComplete, isLast, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE' || e.code === 'KeyF') {
        e.preventDefault();
        advanceOrClose();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advanceOrClose, onClose]);

  if (!current) return null;

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-32 sm:bottom-36 z-30 flex justify-center px-4">
      <div
        role="dialog"
        aria-label="游荡的残影猫对话"
        onClick={advanceOrClose}
        className="w-full max-w-2xl cursor-pointer select-none rounded-xl border border-[#7be8ff]/45 bg-[#120b20]/96 p-5 shadow-[0_0_32px_rgba(123,232,255,0.16)]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1" aria-hidden="true">
              <span className="h-2.5 w-1.5 rounded-full bg-[#6bf7ff]" />
              <span className="h-2.5 w-1.5 rounded-full bg-[#ff5a9c]" />
            </span>
            <span className="text-sm font-semibold tracking-wide text-[#e7f9ff]">
              {current.speaker}
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#ff87b7]/85">
            {current.hexTag}
          </span>
        </div>

        <p className="mt-3 min-h-[3.5rem] text-sm leading-relaxed tracking-wide text-[#f1e9fa]">
          {fullText.slice(0, charCount)}
          {!isComplete && (
            <span className="ml-0.5 inline-block h-3.5 w-1.5 bg-[#7be8ff] align-middle" />
          )}
        </p>

        <div className="mt-3 flex items-center justify-between text-xs text-[#a594bd]">
          <span className="font-mono tabular-nums">
            FRAGMENT {lineIdx + 1} / {lines.length}
          </span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[#8d7da6]">
              [Space / Enter / 点击]
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                advanceOrClose();
              }}
              className="rounded-md bg-[#7be8ff]/18 px-3 py-1 font-medium text-[#9ff0ff] transition-colors hover:bg-[#7be8ff]/30 cursor-pointer"
            >
              {!isComplete ? '显示全文' : isLast ? '目送它消散' : '继续 ▸'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
