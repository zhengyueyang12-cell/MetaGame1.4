import React from 'react';
import { ArrowLeft, Gamepad2, Monitor, Zap } from 'lucide-react';
import type { PcScreenRect } from '../../game/ApartmentEngine';
import { BlurredMechanicalKeyboard } from './BlurredMechanicalKeyboard';

interface MonitorPiPFrameProps {
  rect: PcScreenRect | null;
  visible: boolean;
  isFocusing: boolean;
  focusMode?: 'pc' | 'arcade';
  anomalyTone?: boolean;
  realityAlert: string | null;
  onDismissRealityAlert: () => void;
  onLeaveDesk: () => void;
  children: React.ReactNode;
}

export const MonitorPiPFrame: React.FC<MonitorPiPFrameProps> = ({
  rect,
  visible,
  isFocusing,
  focusMode = 'pc',
  anomalyTone = false,
  realityAlert,
  onDismissRealityAlert,
  onLeaveDesk,
  children,
}) => {
  // Fallback geometry centered in viewport while waiting for projection
  const boxStyle: React.CSSProperties = rect
    ? {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      }
    : {
        left: '14%',
        top: '13%',
        width: '72%',
        height: '72%',
      };

  const isArcade = focusMode === 'arcade';

  return (
    <>
      {/* Focusing cue while 3D camera dollies toward the monitor / arcade screen */}
      {isFocusing && !visible && (
        <div className="pointer-events-none fixed inset-x-0 bottom-7 z-30 flex justify-center">
          <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-[#161024]/88 px-3.5 py-1.5 text-xs text-[#f5eefc] shadow-lg">
            {isArcade ? (
              <Gamepad2 className="h-3.5 w-3.5 text-[#7bf5dc] animate-pulse" />
            ) : (
              <Monitor className="h-3.5 w-3.5 text-[#ffb88c] animate-pulse" />
            )}
            <span>
              {isArcade ? '正在走近地下室街机前……' : '正在坐到卧室电脑前……'}
            </span>
          </div>
        </div>
      )}

      {/* Picture-in-Picture Live Monitor Viewport aligned to the 3D CRT screen opening */}
      {visible && (
        <div
          style={boxStyle}
          className="fixed z-30 overflow-hidden rounded-[3px] border border-black/90 bg-[#07090e] shadow-[0_0_0_2px_rgba(24,20,34,0.85),inset_0_0_22px_rgba(0,0,0,0.75)] transition-opacity duration-200"
        >
          {/* Relative PiP Stage Root — all OS, Galgame, Terminal, Arcade & Modals stay strictly inside the 3D bezel! */}
          <div className="relative h-full w-full overflow-hidden bg-[#0a0812]">
            {/* Stylized CRT optical softening & color-grading layer so crisp HTML blends with the 3D monitor */}
            <div
              className="relative h-full w-full overflow-hidden"
              style={{
                filter: isArcade
                  ? 'contrast(0.96) saturate(0.95) brightness(0.97)'
                  : 'blur(0.75px) contrast(0.91) saturate(0.84) brightness(0.94)',
                transform: 'scale(1.004)',
              }}
            >
              {children}
            </div>

            {/* Subtle RGB phosphor shadow-mask subpixel grille */}
            <div
              className="pointer-events-none absolute inset-0 z-[74] opacity-[0.35]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to right, rgba(255, 90, 120, 0.05) 0px, rgba(90, 255, 160, 0.05) 1px, rgba(110, 160, 255, 0.05) 2px, transparent 3px)',
              }}
            />

            {/* Retro CRT horizontal scanlines */}
            <div
              className="pointer-events-none absolute inset-0 z-[75] opacity-[0.26]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to bottom, rgba(10, 6, 18, 0.42) 0px, rgba(10, 6, 18, 0.42) 1px, rgba(255, 232, 245, 0.03) 1px, transparent 3px)',
              }}
            />

            {/* Curved CRT tube twilight glass glare & phosphor edge vignette */}
            <div
              className="pointer-events-none absolute inset-0 z-[76]"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(255, 224, 240, 0.02) 48%, rgba(12, 8, 20, 0.42) 88%, rgba(6, 4, 12, 0.72) 100%)',
                boxShadow:
                  'inset 0 0 32px rgba(0, 0, 0, 0.68), inset 16px 14px 36px rgba(255, 210, 195, 0.06)',
              }}
            />
          </div>
        </div>
      )}

      {/* Out-of-focus foreground mechanical keyboard only shown when seated at the bedroom PC desk */}
      <BlurredMechanicalKeyboard
        visible={visible && focusMode === 'pc'}
        anomalyTone={anomalyTone}
      />

      {/* Floating External Desk Bar BELOW the 3D monitor bezel so the player can always leave or see reality shifts */}
      {visible && (
        <div className="pointer-events-none fixed inset-x-0 bottom-2.5 z-40 flex flex-col items-center gap-1.5 px-4">
          {realityAlert && (
            <div className="pointer-events-auto flex max-w-xl items-center gap-2.5 rounded-lg border border-rose-400/50 bg-[#221024]/94 px-3.5 py-1.5 text-xs text-rose-100 shadow-xl">
              <Zap className="h-3.5 w-3.5 shrink-0 text-[#ff85a3]" />
              <span className="truncate">
                <strong className="mr-1 text-[#ff85a3]">[环境异变]</strong>
                {realityAlert}
              </span>
              <button
                type="button"
                onClick={onDismissRealityAlert}
                className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-rose-200/80 hover:bg-white/10 hover:text-white cursor-pointer"
              >
                已知晓
              </button>
            </div>
          )}

          <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-white/15 bg-[#161024]/92 px-3 py-1 text-xs text-[#e5daf2] shadow-lg">
            <span className="hidden sm:inline text-[#a895bd]">
              {isArcade
                ? '地下室 CRT 街机 · WASD / 方向键移动 · 空格 / J 开火 · P 暂停'
                : '画面运行于卧室古董主机 · 留意屏幕外房间光影变化'}
            </span>
            <button
              type="button"
              onClick={onLeaveDesk}
              className="flex items-center gap-1 rounded bg-[#ffb085]/18 px-2.5 py-0.5 text-[11px] font-medium text-[#ffc49e] hover:bg-[#ffb085]/30 hover:text-white cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>{isArcade ? '[ESC] 离开街机' : '[ESC] 起身离开电脑'}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
