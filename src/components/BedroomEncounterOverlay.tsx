import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import type { EncounterChoice } from '../data/bedroomEncounterScript';
import type { SofaMenuOptionId } from '../game/ApartmentEngine';
import type {
  TvConsoleScreenMode,
  TvGameSelectionId,
} from '../game/tv/LivingTvGamesEngine';

export interface EncounterSpatialProjection {
  promptVisible: boolean;
  promptX: number;
  promptY: number;
  promptScale: number;
  continueVisible: boolean;
  continueX: number;
  continueY: number;
  continueScale: number;
  choicesVisible: boolean;
  choicesX: number;
  choicesY: number;
  choicesScale: number;
}

export interface BedroomEncounterOverlayHandle {
  updateProjection: (proj: EncounterSpatialProjection) => void;
}

export type EncounterOverlayMode =
  | 'hidden'
  | 'prompt'
  | 'walking'
  | 'speaking'
  | 'ready_continue'
  | 'choices';

interface DroppingChoiceGroup {
  id: number;
  x: number;
  y: number;
  scale: number;
  items: {
    id: string;
    label: string;
    chosen: boolean;
    tiltDeg: number;
    driftX: number;
    delayMs: number;
  }[];
}

export type HeroineFloatingPromptKind = 'bed' | 'chat' | 'sofa';

interface BedroomEncounterOverlayProps {
  mode: EncounterOverlayMode;
  promptKind?: HeroineFloatingPromptKind | null;
  choices: EncounterChoice[];
  sofaCoSeated?: boolean;
  livingTvOn?: boolean;
  coPlayPhase?: 'none' | 'fetching' | 'playing';
  tvScreenMode?: TvConsoleScreenMode;
  selectedTvGame?: TvGameSelectionId;
  activeSofaOption?: SofaMenuOptionId;
  onStartEncounter: () => void;
  onAdvanceLine: () => void;
  onSelectChoice: (choice: EncounterChoice) => void;
  onSofaChat?: () => void;
  onToggleLivingTv?: () => void;
  onSwitchLivingTvChannel?: () => void;
  onStandUpSofa?: () => void;
  onStartSofaCoPlay?: () => void;
  onStopSofaCoPlay?: () => void;
  onSelectTvGame?: (game: TvGameSelectionId) => void;
  onReturnTvLauncher?: () => void;
}

const CUTE_FONT_FAMILY =
  '"ZCOOL KuaiLe", "M PLUS Rounded 1c", "Noto Sans SC", "Hiragino Maru Gothic ProN", "PingFang SC", "Microsoft YaHei", sans-serif';

const PINK_PURPLE_OUTLINE_STYLE: React.CSSProperties = {
  fontFamily: CUTE_FONT_FAMILY,
  textShadow:
    '-1.5px -1.5px 0 rgba(71, 21, 94, 0.96), 1.5px -1.5px 0 rgba(71, 21, 94, 0.96), -1.5px 1.5px 0 rgba(71, 21, 94, 0.96), 1.5px 1.5px 0 rgba(71, 21, 94, 0.96), 0 2px 8px rgba(52, 12, 72, 0.92), 0 0 18px rgba(228, 134, 255, 0.65)',
};

const CHOICE_OUTLINE_STYLE: React.CSSProperties = {
  fontFamily: CUTE_FONT_FAMILY,
  textShadow:
    '-1.5px -1.5px 0 rgba(68, 18, 92, 0.96), 1.5px -1.5px 0 rgba(68, 18, 92, 0.96), -1.5px 1.5px 0 rgba(68, 18, 92, 0.96), 1.5px 1.5px 0 rgba(68, 18, 92, 0.96), 0 2px 10px rgba(46, 12, 68, 0.92), 0 0 16px rgba(255, 162, 224, 0.56)',
};

export const BedroomEncounterOverlay = forwardRef<
  BedroomEncounterOverlayHandle,
  BedroomEncounterOverlayProps
>(function BedroomEncounterOverlay(
  {
    mode,
    promptKind = 'bed',
    choices,
    sofaCoSeated = false,
    livingTvOn = false,
    coPlayPhase = 'none',
    tvScreenMode = 'launcher',
    selectedTvGame = 'snowball',
    activeSofaOption = 'play_game',
    onStartEncounter,
    onAdvanceLine,
    onSelectChoice,
    onSofaChat,
    onToggleLivingTv,
    onSwitchLivingTvChannel,
    onStandUpSofa,
    onStartSofaCoPlay,
    onStopSofaCoPlay,
    onSelectTvGame,
    onReturnTvLauncher,
  },
  ref
) {
  const promptElRef = useRef<HTMLDivElement | null>(null);
  const continueElRef = useRef<HTMLDivElement | null>(null);
  const choicesElRef = useRef<HTMLDivElement | null>(null);
  const latestChoicesPosRef = useRef<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 1,
  });

  const [droppingGroups, setDroppingGroups] = useState<DroppingChoiceGroup[]>([]);
  const dropSeqRef = useRef(0);

  useImperativeHandle(
    ref,
    () => ({
      updateProjection(proj: EncounterSpatialProjection) {
        if (promptElRef.current) {
          if (proj.promptVisible) {
            promptElRef.current.style.opacity = '1';
            promptElRef.current.style.pointerEvents = 'auto';
            promptElRef.current.style.transform = `translate3d(${proj.promptX.toFixed(1)}px, ${proj.promptY.toFixed(1)}px, 0) translate(-50%, -50%) scale(${proj.promptScale.toFixed(3)})`;
          } else {
            promptElRef.current.style.opacity = '0';
            promptElRef.current.style.pointerEvents = 'none';
          }
        }

        if (continueElRef.current) {
          if (proj.continueVisible) {
            continueElRef.current.style.opacity = '1';
            continueElRef.current.style.pointerEvents = 'auto';
            continueElRef.current.style.transform = `translate3d(${proj.continueX.toFixed(1)}px, ${proj.continueY.toFixed(1)}px, 0) translate(0, 0) scale(${proj.continueScale.toFixed(3)})`;
          } else {
            continueElRef.current.style.opacity = '0';
            continueElRef.current.style.pointerEvents = 'none';
          }
        }

        if (choicesElRef.current) {
          latestChoicesPosRef.current = {
            x: proj.choicesX,
            y: proj.choicesY,
            scale: proj.choicesScale,
          };
          if (proj.choicesVisible) {
            choicesElRef.current.style.opacity = '1';
            choicesElRef.current.style.pointerEvents = 'auto';
            choicesElRef.current.style.transform = `translate3d(${proj.choicesX.toFixed(1)}px, ${proj.choicesY.toFixed(1)}px, 0) translate(-100%, -50%) scale(${proj.choicesScale.toFixed(3)})`;
          } else {
            choicesElRef.current.style.opacity = '0';
            choicesElRef.current.style.pointerEvents = 'none';
          }
        }
      },
    }),
    []
  );

  // Trigger gravity-drop animation on floating choice options when one is chosen
  const triggerChoiceSelect = (choice: EncounterChoice) => {
    if (choices.length > 0) {
      dropSeqRef.current += 1;
      const dropId = dropSeqRef.current;
      const pos = latestChoicesPosRef.current;
      const group: DroppingChoiceGroup = {
        id: dropId,
        x: pos.x,
        y: pos.y,
        scale: pos.scale,
        items: choices.map((c, idx) => ({
          id: c.id,
          label: c.label,
          chosen: c.id === choice.id,
          tiltDeg: (idx % 2 === 0 ? -1 : 1) * (5 + Math.random() * 8),
          driftX: (Math.random() - 0.5) * 34,
          delayMs: c.id === choice.id ? 60 : idx * 35,
        })),
      };
      setDroppingGroups((prev) => [...prev, group]);
      window.setTimeout(() => {
        setDroppingGroups((prev) => prev.filter((g) => g.id !== dropId));
      }, 950);
    }
    onSelectChoice(choice);
  };

  // Keyboard shortcuts during active encounter (Space/Enter/F to continue, 1/2/3 to pick choice)
  // Player keeps full WASD movement & mouse camera control throughout dialogue!
  useEffect(() => {
    if (mode === 'hidden' || mode === 'prompt' || mode === 'walking') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (mode === 'choices' && choices.length > 0) {
        if (e.key === '1' && choices[0]) {
          e.preventDefault();
          triggerChoiceSelect(choices[0]);
        } else if (e.key === '2' && choices[1]) {
          e.preventDefault();
          triggerChoiceSelect(choices[1]);
        } else if (e.key === '3' && choices[2]) {
          e.preventDefault();
          triggerChoiceSelect(choices[2]);
        } else if (e.key === '4' && choices[3]) {
          e.preventDefault();
          triggerChoiceSelect(choices[3]);
        }
        return;
      }

      if (
        (mode === 'speaking' || mode === 'ready_continue') &&
        (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF')
      ) {
        e.preventDefault();
        onAdvanceLine();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, choices, onAdvanceLine]);

  return (
    <div className="fixed inset-0 z-30 pointer-events-none select-none overflow-hidden">
      <style>{`
        @keyframes floatingChoiceGravityDrop {
          0% {
            opacity: 1;
            transform: translate3d(0, 0, 0) rotate(0deg);
          }
          18% {
            opacity: 0.96;
            transform: translate3d(calc(var(--drift-x) * 0.25), -8px, 0) rotate(calc(var(--tilt-deg) * 0.25));
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--drift-x), 148px, 0) rotate(var(--tilt-deg));
          }
        }
        @keyframes floatingTextGentleReveal {
          0% {
            opacity: 0;
            transform: translate3d(0, 10px, 0);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }
      `}</style>

      {/* 1. Minimalist 3D World-Anchored Proximity Prompt beside seated heroine (zero box/bubble) */}
      {mode === 'prompt' && (
        <div
          ref={promptElRef}
          className="fixed top-0 left-0 will-change-transform transition-opacity duration-200"
          style={{ opacity: 0, pointerEvents: 'none' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartEncounter();
            }}
            className="group relative flex flex-col items-center gap-1 px-2 py-1 bg-transparent border-0 cursor-pointer pointer-events-auto outline-none focus-visible:ring-1 focus-visible:ring-fuchsia-200/70 transition-transform duration-200 hover:-translate-y-0.5"
          >
            <span
              className="text-[19px] tracking-[0.14em] text-[#ffdcf5] whitespace-nowrap transition-colors duration-200 group-hover:text-[#f0c4ff]"
              style={PINK_PURPLE_OUTLINE_STYLE}
            >
              {promptKind === 'sofa'
                ? '一起坐沙发'
                : promptKind === 'chat'
                  ? '和她聊聊'
                  : '轻声唤她'}
            </span>
            <span className="h-[1.5px] w-12 bg-gradient-to-r from-transparent via-[#f3a8ff]/90 to-transparent transition-all duration-200 group-hover:w-20 group-hover:via-[#ffd8f4]" />
            <span
              className="text-[12px] tracking-[0.14em] text-[#f5d0ff]/90 whitespace-nowrap"
              style={PINK_PURPLE_OUTLINE_STYLE}
            >
              点击 / 按 F
            </span>
          </button>
        </div>
      )}

      {/* 1b. Minimalist floating Sofa Co-Sitting action strip (wheel to select, F to confirm — zero scattered keys!) */}
      {sofaCoSeated && (
        <div className="fixed bottom-9 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 max-w-[92vw] pointer-events-auto">
          <div className="flex flex-wrap items-center justify-center gap-5">
            {coPlayPhase === 'none' && (
              <>
                {mode === 'hidden' && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartSofaCoPlay?.();
                      }}
                      className={`group relative flex items-center gap-1.5 bg-transparent border-0 px-1.5 py-1 cursor-pointer outline-none transition-transform duration-150 ${
                        activeSofaOption === 'play_game' ? '-translate-y-0.5 scale-105' : 'opacity-80 hover:-translate-y-0.5 hover:opacity-100'
                      }`}
                    >
                      <span
                        className={`text-[16px] tracking-[0.08em] ${
                          activeSofaOption === 'play_game' ? 'text-[#aef6ff]' : 'text-[#ffe0f7] group-hover:text-[#ffd8f8]'
                        }`}
                        style={PINK_PURPLE_OUTLINE_STYLE}
                      >
                        一起打游戏
                      </span>
                      {activeSofaOption === 'play_game' && (
                        <span className="text-[12px] text-[#aef6ff]" style={PINK_PURPLE_OUTLINE_STYLE}>
                          [F]
                        </span>
                      )}
                      {activeSofaOption === 'play_game' && (
                        <span className="pointer-events-none absolute left-0 right-0 -bottom-0.5 h-[2px] bg-gradient-to-r from-transparent via-[#8ceeff] to-transparent" />
                      )}
                    </button>
                    <span className="h-3.5 w-[1.5px] bg-gradient-to-b from-transparent via-[#f2b5ff]/75 to-transparent" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSofaChat?.();
                      }}
                      className={`group relative flex items-center gap-1.5 bg-transparent border-0 px-1.5 py-1 cursor-pointer outline-none transition-transform duration-150 ${
                        activeSofaOption === 'chat' ? '-translate-y-0.5 scale-105' : 'opacity-80 hover:-translate-y-0.5 hover:opacity-100'
                      }`}
                    >
                      <span
                        className={`text-[16px] tracking-[0.08em] ${
                          activeSofaOption === 'chat' ? 'text-[#ffd8fb]' : 'text-[#ffe0f7] group-hover:text-[#ecc4ff]'
                        }`}
                        style={PINK_PURPLE_OUTLINE_STYLE}
                      >
                        和她聊聊
                      </span>
                      {activeSofaOption === 'chat' && (
                        <span className="text-[12px] text-[#ffd8fb]" style={PINK_PURPLE_OUTLINE_STYLE}>
                          [F]
                        </span>
                      )}
                      {activeSofaOption === 'chat' && (
                        <span className="pointer-events-none absolute left-0 right-0 -bottom-0.5 h-[2px] bg-gradient-to-r from-transparent via-[#ffb8f5] to-transparent" />
                      )}
                    </button>
                    <span className="h-3.5 w-[1.5px] bg-gradient-to-b from-transparent via-[#f2b5ff]/75 to-transparent" />
                  </>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLivingTv?.();
                  }}
                  className={`group relative flex items-center gap-1.5 bg-transparent border-0 px-1.5 py-1 cursor-pointer outline-none transition-transform duration-150 ${
                    activeSofaOption === 'toggle_tv' ? '-translate-y-0.5 scale-105' : 'opacity-80 hover:-translate-y-0.5 hover:opacity-100'
                  }`}
                >
                  <span
                    className={`text-[16px] tracking-[0.08em] ${
                      activeSofaOption === 'toggle_tv' ? 'text-[#ffd8fb]' : 'text-[#ffe0f7] group-hover:text-[#ecc4ff]'
                    }`}
                    style={PINK_PURPLE_OUTLINE_STYLE}
                  >
                    {livingTvOn ? '关掉电视' : '打开电视'}
                  </span>
                  {activeSofaOption === 'toggle_tv' && (
                    <span className="text-[12px] text-[#ffd8fb]" style={PINK_PURPLE_OUTLINE_STYLE}>
                      [F]
                    </span>
                  )}
                  {activeSofaOption === 'toggle_tv' && (
                    <span className="pointer-events-none absolute left-0 right-0 -bottom-0.5 h-[2px] bg-gradient-to-r from-transparent via-[#ffb8f5] to-transparent" />
                  )}
                </button>
                {livingTvOn && (
                  <>
                    <span className="h-3.5 w-[1.5px] bg-gradient-to-b from-transparent via-[#f2b5ff]/75 to-transparent" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSwitchLivingTvChannel?.();
                      }}
                      className={`group relative flex items-center gap-1.5 bg-transparent border-0 px-1.5 py-1 cursor-pointer outline-none transition-transform duration-150 ${
                        activeSofaOption === 'switch_channel' ? '-translate-y-0.5 scale-105' : 'opacity-80 hover:-translate-y-0.5 hover:opacity-100'
                      }`}
                    >
                      <span
                        className={`text-[16px] tracking-[0.08em] ${
                          activeSofaOption === 'switch_channel' ? 'text-[#ffd8fb]' : 'text-[#ffe0f7] group-hover:text-[#ecc4ff]'
                        }`}
                        style={PINK_PURPLE_OUTLINE_STYLE}
                      >
                        换台
                      </span>
                      {activeSofaOption === 'switch_channel' && (
                        <span className="text-[12px] text-[#ffd8fb]" style={PINK_PURPLE_OUTLINE_STYLE}>
                          [F]
                        </span>
                      )}
                      {activeSofaOption === 'switch_channel' && (
                        <span className="pointer-events-none absolute left-0 right-0 -bottom-0.5 h-[2px] bg-gradient-to-r from-transparent via-[#ffb8f5] to-transparent" />
                      )}
                    </button>
                  </>
                )}
              </>
            )}

            {coPlayPhase === 'fetching' && (
              <span
                className="text-[15.5px] tracking-[0.09em] text-[#ffdcf5]"
                style={PINK_PURPLE_OUTLINE_STYLE}
              >
                她正在茶几取来两只手柄……
              </span>
            )}

            {coPlayPhase === 'playing' && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTvGame?.('snowball');
                  }}
                  className={`group relative flex items-center gap-1.5 bg-transparent border-0 px-1.5 py-1 cursor-pointer outline-none transition-transform duration-150 ${
                    activeSofaOption === 'snowball' ? '-translate-y-0.5 scale-105' : 'opacity-80 hover:-translate-y-0.5 hover:opacity-100'
                  }`}
                >
                  <span
                    className={`text-[16px] tracking-[0.08em] ${
                      activeSofaOption === 'snowball' ||
                      tvScreenMode === 'snowball' ||
                      (tvScreenMode === 'launcher' && selectedTvGame === 'snowball')
                        ? 'text-[#7cebff]'
                        : 'text-[#ffe0f7] group-hover:text-[#aef6ff]'
                    }`}
                    style={PINK_PURPLE_OUTLINE_STYLE}
                  >
                    ① 双人打雪仗
                  </span>
                  {activeSofaOption === 'snowball' && (
                    <span className="text-[12px] text-[#7cebff]" style={PINK_PURPLE_OUTLINE_STYLE}>
                      [F]
                    </span>
                  )}
                  {activeSofaOption === 'snowball' && (
                    <span className="pointer-events-none absolute left-0 right-0 -bottom-0.5 h-[2px] bg-gradient-to-r from-transparent via-[#7cebff] to-transparent" />
                  )}
                </button>
                <span className="h-3.5 w-[1.5px] bg-gradient-to-b from-transparent via-[#f2b5ff]/75 to-transparent" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTvGame?.('tank');
                  }}
                  className={`group relative flex items-center gap-1.5 bg-transparent border-0 px-1.5 py-1 cursor-pointer outline-none transition-transform duration-150 ${
                    activeSofaOption === 'tank' ? '-translate-y-0.5 scale-105' : 'opacity-80 hover:-translate-y-0.5 hover:opacity-100'
                  }`}
                >
                  <span
                    className={`text-[16px] tracking-[0.08em] ${
                      activeSofaOption === 'tank' ||
                      tvScreenMode === 'tank' ||
                      (tvScreenMode === 'launcher' && selectedTvGame === 'tank')
                        ? 'text-[#ffca7a]'
                        : 'text-[#ffe0f7] group-hover:text-[#ffdca8]'
                    }`}
                    style={PINK_PURPLE_OUTLINE_STYLE}
                  >
                    ② 坦克大战
                  </span>
                  {activeSofaOption === 'tank' && (
                    <span className="text-[12px] text-[#ffca7a]" style={PINK_PURPLE_OUTLINE_STYLE}>
                      [F]
                    </span>
                  )}
                  {activeSofaOption === 'tank' && (
                    <span className="pointer-events-none absolute left-0 right-0 -bottom-0.5 h-[2px] bg-gradient-to-r from-transparent via-[#ffca7a] to-transparent" />
                  )}
                </button>
                {tvScreenMode !== 'launcher' && (
                  <>
                    <span className="h-3.5 w-[1.5px] bg-gradient-to-b from-transparent via-[#f2b5ff]/75 to-transparent" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onReturnTvLauncher?.();
                      }}
                      className={`group relative flex items-center gap-1.5 bg-transparent border-0 px-1.5 py-1 cursor-pointer outline-none transition-transform duration-150 ${
                        activeSofaOption === 'launcher' ? '-translate-y-0.5 scale-105' : 'opacity-80 hover:-translate-y-0.5 hover:opacity-100'
                      }`}
                    >
                      <span
                        className={`text-[15px] tracking-[0.08em] ${
                          activeSofaOption === 'launcher' ? 'text-[#ffd8fb]' : 'text-[#ffe0f7] group-hover:text-[#ecc4ff]'
                        }`}
                        style={PINK_PURPLE_OUTLINE_STYLE}
                      >
                        游戏选单
                      </span>
                      {activeSofaOption === 'launcher' && (
                        <span className="text-[12px] text-[#ffd8fb]" style={PINK_PURPLE_OUTLINE_STYLE}>
                          [F]
                        </span>
                      )}
                      {activeSofaOption === 'launcher' && (
                        <span className="pointer-events-none absolute left-0 right-0 -bottom-0.5 h-[2px] bg-gradient-to-r from-transparent via-[#ffb8f5] to-transparent" />
                      )}
                    </button>
                  </>
                )}
                <span className="h-3.5 w-[1.5px] bg-gradient-to-b from-transparent via-[#f2b5ff]/75 to-transparent" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStopSofaCoPlay?.();
                  }}
                  className={`group relative flex items-center gap-1.5 bg-transparent border-0 px-1.5 py-1 cursor-pointer outline-none transition-transform duration-150 ${
                    activeSofaOption === 'stop_coplay' ? '-translate-y-0.5 scale-105' : 'opacity-80 hover:-translate-y-0.5 hover:opacity-100'
                  }`}
                >
                  <span
                    className={`text-[15px] tracking-[0.08em] ${
                      activeSofaOption === 'stop_coplay' ? 'text-[#ffd8fb]' : 'text-[#ffe0f7] group-hover:text-[#ecc4ff]'
                    }`}
                    style={PINK_PURPLE_OUTLINE_STYLE}
                  >
                    放回手柄
                  </span>
                  {activeSofaOption === 'stop_coplay' && (
                    <span className="text-[12px] text-[#ffd8fb]" style={PINK_PURPLE_OUTLINE_STYLE}>
                      [F]
                    </span>
                  )}
                  {activeSofaOption === 'stop_coplay' && (
                    <span className="pointer-events-none absolute left-0 right-0 -bottom-0.5 h-[2px] bg-gradient-to-r from-transparent via-[#ffb8f5] to-transparent" />
                  )}
                </button>
              </>
            )}

            <span className="h-3.5 w-[1.5px] bg-gradient-to-b from-transparent via-[#f2b5ff]/75 to-transparent" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStandUpSofa?.();
              }}
              className={`group relative flex items-center gap-1.5 bg-transparent border-0 px-1.5 py-1 cursor-pointer outline-none transition-transform duration-150 ${
                activeSofaOption === 'stand_up' ? '-translate-y-0.5 scale-105' : 'opacity-80 hover:-translate-y-0.5 hover:opacity-100'
              }`}
            >
              <span
                className={`text-[16px] tracking-[0.08em] ${
                  activeSofaOption === 'stand_up' ? 'text-[#ffd8fb]' : 'text-[#ffe0f7] group-hover:text-[#ecc4ff]'
                }`}
                style={PINK_PURPLE_OUTLINE_STYLE}
              >
                起身离开
              </span>
              {activeSofaOption === 'stand_up' && (
                <span className="text-[12px] text-[#ffd8fb]" style={PINK_PURPLE_OUTLINE_STYLE}>
                  [F]
                </span>
              )}
              {activeSofaOption === 'stand_up' && (
                <span className="pointer-events-none absolute left-0 right-0 -bottom-0.5 h-[2px] bg-gradient-to-r from-transparent via-[#ffb8f5] to-transparent" />
              )}
            </button>
          </div>
          <span
            className="text-[11.5px] tracking-[0.12em] text-[#f2d0ff]/85"
            style={PINK_PURPLE_OUTLINE_STYLE}
          >
            滚轮切换选项 · F 键确认
          </span>
        </div>
      )}

      {/* 2. Clickable floating continue cue tucked beneath the 3D floating subtitle (never blocks camera/movement) */}
      {(mode === 'speaking' || mode === 'ready_continue') && (
        <div
          ref={continueElRef}
          className="fixed top-0 left-0 will-change-transform transition-opacity duration-250"
          style={{ opacity: 0, pointerEvents: 'none' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdvanceLine();
            }}
            className="bg-transparent border-0 px-2 py-1 cursor-pointer pointer-events-auto outline-none transition-transform duration-150 hover:translate-y-0.5"
          >
            <span
              className="inline-block text-[13.5px] tracking-[0.14em] text-[#ffd4f4] whitespace-nowrap animate-pulse hover:text-[#e9c4ff]"
              style={PINK_PURPLE_OUTLINE_STYLE}
            >
              {mode === 'speaking' ? '按 F / 点击跳过' : '轻触继续 ↓ · F'}
            </span>
          </button>
        </div>
      )}

      {/* 3. Minimalist 3D Floating Protagonist Choice Options (pure cute pink-purple outlined typography) */}
      {mode === 'choices' && choices.length > 0 && (
        <div
          ref={choicesElRef}
          className="fixed top-0 left-0 will-change-transform transition-opacity duration-200"
          style={{ opacity: 0, pointerEvents: 'none' }}
        >
          <div className="flex flex-col items-end gap-3.5 max-w-[350px]">
            {choices.map((choice, index) => (
              <button
                key={choice.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerChoiceSelect(choice);
                }}
                className="group relative flex items-center justify-end gap-2.5 py-1 pl-2 pr-1 bg-transparent border-0 cursor-pointer pointer-events-auto text-right outline-none focus-visible:ring-1 focus-visible:ring-fuchsia-200/70 transition-transform duration-200 hover:-translate-x-1"
                style={{
                  animation: `floatingTextGentleReveal 320ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 75}ms both`,
                }}
              >
                <span
                  className="text-[17px] leading-snug tracking-[0.05em] text-[#ffe2f7] transition-colors duration-150 group-hover:text-[#e6b8ff]"
                  style={CHOICE_OUTLINE_STYLE}
                >
                  {choice.label}
                </span>
                <span
                  className="text-[12px] tabular-nums text-[#e6a8ff]/95 transition-all duration-150 group-hover:text-[#fff2fc] group-hover:scale-110"
                  style={CHOICE_OUTLINE_STYLE}
                >
                  [{index + 1}]
                </span>
                <span className="pointer-events-none absolute right-0 -bottom-0.5 h-[1.5px] w-0 bg-gradient-to-l from-[#ffbae8] via-[#d7a4ff] to-transparent transition-all duration-200 group-hover:w-full" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Gravity-Dropping Dismissed Choice Options (matching 3D subtitle gravity-drop scatter) */}
      {droppingGroups.map((group) => (
        <div
          key={group.id}
          className="fixed top-0 left-0 pointer-events-none"
          style={{
            transform: `translate3d(${group.x.toFixed(1)}px, ${group.y.toFixed(1)}px, 0) translate(-100%, -50%) scale(${group.scale.toFixed(3)})`,
          }}
        >
          <div className="flex flex-col items-end gap-3.5 max-w-[350px]">
            {group.items.map((item) => (
              <div
                key={item.id}
                className="text-right py-1 pl-2 pr-1"
                style={
                  {
                    '--drift-x': `${item.driftX.toFixed(1)}px`,
                    '--tilt-deg': `${item.tiltDeg.toFixed(1)}deg`,
                    animation: `floatingChoiceGravityDrop 860ms cubic-bezier(0.32, 0.02, 0.78, 0.65) ${item.delayMs}ms forwards`,
                  } as React.CSSProperties
                }
              >
                <span
                  className={`text-[17px] leading-snug tracking-[0.05em] ${
                    item.chosen ? 'text-[#f2bcff]' : 'text-[#ffe0f6]/75'
                  }`}
                  style={CHOICE_OUTLINE_STYLE}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});
