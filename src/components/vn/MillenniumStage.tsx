import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ChevronRight,
  FastForward,
  FolderOpen,
  Monitor,
  RotateCcw,
  Save,
  Settings,
  Terminal,
} from 'lucide-react';
import { BUREAU_ASSETS } from '../../data/bureauScript';
import { formatStoryText } from '../../data/millenniumScript';
import type { RealityEffect } from '../../game/types';
import { BureauBgId, TerminalTaskId, VNChoice, VNLine, VNSceneBlock } from '../../types/vn';
import { vnAudioEngine } from '../../utils/vnAudioEngine';

interface MillenniumStageProps {
  scene: VNSceneBlock;
  lineIdx: number;
  onLineIdxChange: (nextIdx: number) => void;
  playerName: string;
  heartbeatCpm: number;
  textSpeed: number;
  hasConfirmedLogin: boolean;
  pcBooted: boolean;
  saveScumCount?: number;
  recordedChoiceTags?: string[];
  completedTerminalTasks: Set<TerminalTaskId>;
  isModalOpen?: boolean;
  onNeedLoginModal: () => void;
  onOpenTerminal: (taskHint?: TerminalTaskId) => void;
  onRealityEffect?: (effect: RealityEffect) => void;
  onRecordChoice: (actTitle: string, choice: VNChoice, dwellMs: number) => void;
  onSceneComplete: (nextSceneId: string) => void;
  onOpenSave: () => void;
  onOpenFiles: () => void;
  onOpenSettings: () => void;
  onOpenDevTools: () => void;
  onLeaveComputer: () => void;
}

function getEnvironmentalLighting(bg: BureauBgId): {
  filterClass: string;
  overlayClass: string;
} {
  switch (bg) {
    case 'rooftop_dusk':
      return {
        filterClass: 'saturate-[0.94] contrast-[1.04] brightness-[0.93]',
        overlayClass:
          'bg-gradient-to-t from-slate-950/38 via-transparent to-indigo-950/20 mix-blend-soft-light',
      };
    case 'riverbank_path':
      return {
        filterClass: 'sepia-[0.06] brightness-[0.95]',
        overlayClass: 'bg-gradient-to-t from-slate-950/30 via-transparent to-amber-300/10',
      };
    case 'elec_alley':
      return {
        filterClass: 'saturate-[0.9] contrast-[1.04] brightness-[0.9]',
        overlayClass: 'bg-gradient-to-t from-slate-950/40 via-transparent to-cyan-950/20',
      };
    case 'classroom':
      return {
        filterClass: 'saturate-[0.9] contrast-[1.03] brightness-[0.94]',
        overlayClass:
          'bg-gradient-to-t from-slate-950/32 via-transparent to-sky-950/15 mix-blend-soft-light',
      };
    case 'ark_world':
      return {
        filterClass: 'contrast-[1.04] brightness-[0.96]',
        overlayClass: 'bg-gradient-to-t from-cyan-950/25 via-transparent to-indigo-900/10',
      };
    case 'sickbed_void':
      return {
        filterClass: 'saturate-[0.65] contrast-[1.08] brightness-[0.86]',
        overlayClass: 'bg-gradient-to-t from-black/55 via-transparent to-black/45',
      };
    default:
      return {
        filterClass: '',
        overlayClass: '',
      };
  }
}

export const MillenniumStage: React.FC<MillenniumStageProps> = ({
  scene,
  lineIdx,
  onLineIdxChange,
  playerName,
  heartbeatCpm,
  textSpeed,
  hasConfirmedLogin,
  pcBooted,
  saveScumCount = 0,
  recordedChoiceTags = [],
  completedTerminalTasks,
  isModalOpen = false,
  onNeedLoginModal,
  onOpenTerminal,
  onRealityEffect,
  onRecordChoice,
  onSceneComplete,
  onOpenSave,
  onOpenFiles,
  onOpenSettings,
  onOpenDevTools,
  onLeaveComputer,
}) => {
  const [typedLen, setTypedLen] = useState(0);
  const [choiceReply, setChoiceReply] = useState<{ speaker: string; text: string } | null>(null);
  const [subtextFlash, setSubtextFlash] = useState(false);
  const [fastForwardToggle, setFastForwardToggle] = useState(false);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const lineStartRef = useRef<number>(Date.now());
  const firedLineEffectsRef = useRef<Set<string>>(new Set());

  const safeIdx = Math.min(Math.max(0, lineIdx), Math.max(0, scene.lines.length - 1));
  const currentLine: VNLine | undefined = scene.lines[safeIdx];

  let resolvedRawText = currentLine?.text || '';
  if (saveScumCount > 0 && currentLine?.saveScumText) {
    resolvedRawText = currentLine.saveScumText;
  } else if (currentLine?.altTextByTag) {
    for (const tag of recordedChoiceTags) {
      if (currentLine.altTextByTag[tag]) {
        resolvedRawText = currentLine.altTextByTag[tag];
        break;
      }
    }
  }

  const activeText = choiceReply
    ? formatStoryText(choiceReply.text, playerName, heartbeatCpm)
    : formatStoryText(resolvedRawText, playerName, heartbeatCpm);
  const activeSpeaker = choiceReply ? choiceReply.speaker : currentLine?.speaker || '';

  useEffect(() => {
    setTypedLen(0);
    setChoiceReply(null);
    lineStartRef.current = Date.now();
  }, [scene.id]);

  useEffect(() => {
    lineStartRef.current = Date.now();
    if (currentLine?.sfx) {
      vnAudioEngine.playSfx(currentLine.sfx);
    }
    if (
      currentLine?.realityEffect &&
      onRealityEffect &&
      !firedLineEffectsRef.current.has(currentLine.id)
    ) {
      firedLineEffectsRef.current.add(currentLine.id);
      onRealityEffect(currentLine.realityEffect);
    }
    if (currentLine?.triggerLoginModal && !hasConfirmedLogin) {
      onNeedLoginModal();
    }
    if (currentLine?.hiddenSubtext) {
      setSubtextFlash(true);
      const t = window.setTimeout(() => setSubtextFlash(false), 650);
      return () => window.clearTimeout(t);
    }
    setSubtextFlash(false);
  }, [safeIdx, scene.id, currentLine, hasConfirmedLogin, onNeedLoginModal, onRealityEffect]);

  const pendingTask = currentLine?.requireTerminalTask;
  const isWaitingForTerminal = Boolean(
    pendingTask && !completedTerminalTasks.has(pendingTask)
  );

  useEffect(() => {
    setTypedLen(0);
    if (!activeText) return;
    const speed = Math.max(8, 42 - textSpeed);
    const timer = window.setInterval(() => {
      setTypedLen((prev) => {
        if (prev >= activeText.length) {
          window.clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
    return () => window.clearInterval(timer);
  }, [activeText, textSpeed]);

  const isTyping = typedLen < activeText.length;
  const activeChoices = !choiceReply ? currentLine?.choices : undefined;
  const isFastForwarding = (fastForwardToggle || ctrlHeld) && !isModalOpen;

  const advance = (silent = false) => {
    if (activeChoices && activeChoices.length > 0) return;
    if (isTyping) {
      setTypedLen(activeText.length);
      return;
    }
    if (isWaitingForTerminal) {
      if (!silent) vnAudioEngine.playSfx('click');
      setFastForwardToggle(false);
      onOpenTerminal(pendingTask);
      return;
    }
    if (currentLine?.openTerminalDirectly) {
      if (!silent) vnAudioEngine.playSfx('glitch');
      setFastForwardToggle(false);
      onSceneComplete(scene.nextSceneId);
      return;
    }
    if (!silent) vnAudioEngine.playSfx('click');
    if (choiceReply) {
      setChoiceReply(null);
    }
    if (safeIdx + 1 < scene.lines.length) {
      onLineIdxChange(safeIdx + 1);
    } else {
      onSceneComplete(scene.nextSceneId);
    }
  };

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen) return;
      if (e.key === 'Control') {
        if (!isEditableTarget(e.target)) {
          setCtrlHeld(true);
        }
        return;
      }
      if (e.code === 'Space' || e.key === ' ') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        if (document.activeElement instanceof HTMLButtonElement) {
          document.activeElement.blur();
        }
        advance();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setCtrlHeld(false);
      }
    };

    const handleBlur = () => {
      setCtrlHeld(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  });

  useEffect(() => {
    if (!isFastForwarding) return;
    const blockedByChoice = Boolean(activeChoices && activeChoices.length > 0);
    const blockedByLogin = Boolean(currentLine?.triggerLoginModal && !hasConfirmedLogin);
    if (
      blockedByChoice ||
      isWaitingForTerminal ||
      currentLine?.openTerminalDirectly ||
      blockedByLogin
    ) {
      if (fastForwardToggle) setFastForwardToggle(false);
      return;
    }
    if (isTyping) {
      setTypedLen(activeText.length);
      return;
    }
    const timer = window.setTimeout(() => {
      advance(true);
    }, 95);
    return () => window.clearTimeout(timer);
  }, [
    isFastForwarding,
    isTyping,
    activeText.length,
    safeIdx,
    scene.id,
    activeChoices,
    isWaitingForTerminal,
    currentLine?.openTerminalDirectly,
    currentLine?.triggerLoginModal,
    hasConfirmedLogin,
    fastForwardToggle,
  ]);

  const handleSelectChoice = (choice: VNChoice) => {
    vnAudioEngine.playSfx('click');
    const dwellMs = Date.now() - lineStartRef.current;
    onRecordChoice(scene.title, choice, dwellMs);
    if (choice.replyText) {
      setChoiceReply({
        speaker: choice.replySpeaker || currentLine?.speaker || '神秘女生',
        text: choice.replyText,
      });
    } else if (safeIdx + 1 < scene.lines.length) {
      onLineIdxChange(safeIdx + 1);
    } else {
      onSceneComplete(scene.nextSceneId);
    }
  };

  const effectiveBg = currentLine?.bg || scene.defaultBg;
  const bgUrl =
    effectiveBg === 'black' ? null : BUREAU_ASSETS.backgrounds[effectiveBg] || null;
  const primarySpriteUrl = currentLine?.spriteKey
    ? BUREAU_ASSETS.sprites[currentLine.spriteKey]
    : null;
  const secondarySpriteUrl = currentLine?.secondarySpriteKey
    ? BUREAU_ASSETS.sprites[currentLine.secondarySpriteKey]
    : null;
  const isPrologue = scene.kind === 'prologue_cinema';
  const showTerminalBtn = pcBooted || scene.pcActive;
  const lighting = getEnvironmentalLighting(effectiveBg);

  return (
    <div className="absolute inset-0 z-40 h-full w-full overflow-hidden bg-[#050608] text-zinc-100 select-none flex flex-col justify-between">
      <AnimatePresence mode="wait">
        <motion.div
          key={`vn-bg-${effectiveBg}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55 }}
          className="absolute inset-0"
        >
          {bgUrl ? (
            <img
              src={bgUrl}
              alt={scene.title}
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover ${
                isPrologue
                  ? 'brightness-[0.58] contrast-110 animate-vn-projector'
                  : 'brightness-[0.78] contrast-[1.06]'
              }`}
            />
          ) : (
            <div className="w-full h-full bg-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/32 to-black/55" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 68% 72% at 50% 58%, rgba(6, 10, 18, 0.44) 0%, rgba(6, 10, 18, 0.16) 52%, transparent 82%)',
            }}
          />
          {lighting.overlayClass && (
            <div className={`pointer-events-none absolute inset-0 ${lighting.overlayClass}`} />
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {(primarySpriteUrl || secondarySpriteUrl) && (
          <motion.div
            key={`vn-sprites-${currentLine?.spriteKey || 'none'}-${currentLine?.secondarySpriteKey || 'none'}-${effectiveBg}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32 }}
            className="pointer-events-none absolute inset-x-0 bottom-[26%] top-11 z-10 flex items-end justify-center gap-2 sm:gap-8 px-4 overflow-hidden"
          >
            {secondarySpriteUrl && (
              <div
                className="relative h-full flex items-end justify-center"
                style={{
                  maskImage:
                    'radial-gradient(ellipse 92% 96% at 50% 44%, #000 58%, rgba(0,0,0,0.68) 84%, transparent 100%)',
                  WebkitMaskImage:
                    'radial-gradient(ellipse 92% 96% at 50% 44%, #000 58%, rgba(0,0,0,0.68) 84%, transparent 100%)',
                }}
              >
                <img
                  src={secondarySpriteUrl}
                  alt="Partner Character"
                  referrerPolicy="no-referrer"
                  style={{
                    mixBlendMode: 'screen',
                    maskImage:
                      'linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, #000 9%, #000 72%, rgba(0,0,0,0.45) 89%, transparent 100%)',
                    WebkitMaskImage:
                      'linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, #000 9%, #000 72%, rgba(0,0,0,0.45) 89%, transparent 100%)',
                  }}
                  className={`h-full max-h-full w-auto object-contain object-bottom transition-all duration-300 ${
                    lighting.filterClass
                  } ${
                    currentLine?.dimSecondary
                      ? 'brightness-[0.76] opacity-75 scale-[0.97]'
                      : 'opacity-90'
                  }`}
                />
              </div>
            )}
            {primarySpriteUrl && (
              <div
                className="relative h-full flex items-end justify-center"
                style={{
                  maskImage:
                    'radial-gradient(ellipse 92% 96% at 50% 44%, #000 60%, rgba(0,0,0,0.72) 85%, transparent 100%)',
                  WebkitMaskImage:
                    'radial-gradient(ellipse 92% 96% at 50% 44%, #000 60%, rgba(0,0,0,0.72) 85%, transparent 100%)',
                }}
              >
                <img
                  src={primarySpriteUrl}
                  alt={activeSpeaker}
                  referrerPolicy="no-referrer"
                  style={{
                    mixBlendMode: 'screen',
                    maskImage:
                      'linear-gradient(to bottom, rgba(0,0,0,0.92) 0%, #000 8%, #000 74%, rgba(0,0,0,0.48) 90%, transparent 100%)',
                    WebkitMaskImage:
                      'linear-gradient(to bottom, rgba(0,0,0,0.92) 0%, #000 8%, #000 74%, rgba(0,0,0,0.48) 90%, transparent 100%)',
                  }}
                  className={`h-full max-h-full w-auto object-contain object-bottom transition-all duration-300 opacity-95 ${
                    lighting.filterClass
                  } animate-vn-breathe`}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="relative z-20 px-4 sm:px-7 py-3 flex items-center justify-between gap-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-medium text-amber-200 whitespace-nowrap shrink-0">
            {scene.timeLabel}
          </span>
          <span className="text-zinc-500 shrink-0" aria-hidden="true">
            ·
          </span>
          <span className="text-xs sm:text-sm font-medium text-white/95 truncate drop-shadow">
            {scene.title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isPrologue && (
            <button
              onClick={onOpenSave}
              className="px-2.5 py-1.5 text-xs bg-black/70 hover:bg-black/90 border border-white/15 text-zinc-200 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              存档
            </button>
          )}
          <button
            onClick={onOpenFiles}
            className="px-2.5 py-1.5 text-xs bg-black/70 hover:bg-black/90 border border-white/15 text-zinc-200 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            档案
          </button>
          <button
            onClick={onOpenDevTools}
            className="hidden sm:flex px-2.5 py-1.5 text-xs bg-black/70 hover:bg-black/90 border border-white/15 text-zinc-200 items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Terminal className="w-3.5 h-3.5" />
            跳章
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1.5 bg-black/70 hover:bg-black/90 border border-white/15 text-zinc-200 cursor-pointer shrink-0"
            title="设置"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          {showTerminalBtn && (
            <button
              onClick={() => {
                vnAudioEngine.playSfx('click');
                onOpenTerminal(pendingTask);
              }}
              className={`ml-1 px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 border transition-colors ${
                isWaitingForTerminal
                  ? 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-black font-bold shadow-lg'
                  : 'bg-[#111722]/95 hover:bg-[#1A2434] border-cyan-300/45 text-cyan-100'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 shrink-0" />
              {isWaitingForTerminal ? '打开电脑终端 · 需校准' : '打开电脑终端'}
            </button>
          )}
          <button
            onClick={() => {
              vnAudioEngine.playSfx('click');
              onLeaveComputer();
            }}
            className="px-2.5 py-1.5 text-xs bg-black/75 hover:bg-white/15 border border-white/25 text-zinc-100 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            title="暂时离开电脑屏幕，回到 3D 公寓走动检查房间变化"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            暂离电脑
          </button>
        </div>
      </header>

      <footer className="relative z-20 px-3 sm:px-6 pb-3 sm:pb-4 pt-1">
        <div className="max-w-4xl mx-auto space-y-2">
          {currentLine?.hiddenSubtext && !choiceReply && (
            <div
              className={`px-3.5 py-1.5 border font-vn-mono text-[10px] sm:text-[11px] transition-all duration-300 select-none ${
                subtextFlash
                  ? 'bg-emerald-950/95 border-emerald-400/80 text-emerald-200 opacity-100 glitch-text shadow-lg'
                  : 'bg-black/75 border-white/10 text-emerald-300/60 opacity-75 hover:opacity-100'
              }`}
            >
              <span className="text-emerald-400/85 mr-1.5">[MEM_TRACE // GODEL_LOG]:</span>
              {formatStoryText(currentLine.hiddenSubtext, playerName, heartbeatCpm)}
            </div>
          )}

          {activeChoices && activeChoices.length > 0 && !isTyping && (
            <div className="flex flex-col gap-1.5 items-center pb-1">
              {activeChoices.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleSelectChoice(ch)}
                  className="w-full max-w-xl px-4 py-2 bg-black/90 hover:bg-amber-950/90 border border-amber-200/40 hover:border-amber-200 text-xs sm:text-sm text-zinc-100 text-left transition-colors cursor-pointer shadow-lg"
                >
                  ▸ {ch.label}
                </button>
              ))}
            </div>
          )}

          {isWaitingForTerminal && !isTyping && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[#0C121D]/95 border border-amber-300/60 text-xs text-amber-100 shadow-lg">
              <span>
                {currentLine?.terminalHint || '需要从右上角打开电脑终端完成参数修改后再继续对话。'}
              </span>
              <button
                onClick={() => {
                  vnAudioEngine.playSfx('click');
                  onOpenTerminal(pendingTask);
                }}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Monitor className="w-3.5 h-3.5" />
                打开电脑终端
              </button>
            </div>
          )}

          {currentLine?.openTerminalDirectly && !isTyping && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-[#190C0E]/95 border border-rose-400/60 text-xs text-rose-100 shadow-lg">
              <span>{currentLine.terminalHint}</span>
              <button
                onClick={() => {
                  vnAudioEngine.playSfx('glitch');
                  onSceneComplete(scene.nextSceneId);
                }}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Monitor className="w-3.5 h-3.5" />
                进入写入终端控制台
              </button>
            </div>
          )}

          <div
            onClick={() => advance()}
            className={`relative p-3.5 sm:p-4 bg-black/92 border border-white/20 shadow-2xl transition-colors ${
              activeChoices && !isTyping ? 'cursor-default' : 'cursor-pointer hover:border-white/35'
            }`}
          >
            <div className="flex items-center justify-between gap-4 mb-1.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-amber-200 truncate">
                  {activeSpeaker}
                </span>
                {isFastForwarding && (
                  <span className="text-[11px] font-vn-mono text-amber-300 animate-pulse shrink-0">
                    快进中 · Ctrl
                  </span>
                )}
              </div>
              <span className="text-[11px] font-vn-mono text-zinc-400 tabular-nums shrink-0">
                {safeIdx + 1} / {scene.lines.length}
              </span>
            </div>

            <p
              className={`min-h-[3.2rem] text-xs sm:text-sm leading-relaxed ${
                currentLine?.narration && !choiceReply ? 'text-zinc-200' : 'text-white'
              }`}
            >
              {activeText.slice(0, typedLen)}
              {isTyping && (
                <span className="inline-block w-2 h-3.5 ml-1 bg-amber-300 animate-pulse align-middle" />
              )}
            </p>

            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-zinc-400">
              <span className="truncate">
                {activeChoices && !isTyping
                  ? '请先选择上方对话分支'
                  : isWaitingForTerminal && !isTyping
                    ? '请点击右上角【打开电脑终端】完成修改，或点击此处直接打开'
                    : currentLine?.openTerminalDirectly && !isTyping
                      ? '点击进入终端控制台'
                      : isTyping
                        ? '点击文本框或按空格立即显示完整台词'
                        : '点击/空格下一句 · Ctrl 快进 · 随时可点击右上角“暂离电脑”返回公寓'}
              </span>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    vnAudioEngine.playSfx('click');
                    setFastForwardToggle((v) => !v);
                  }}
                  className={`px-2 py-0.5 border text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap transition-colors ${
                    isFastForwarding
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'border-white/15 bg-white/5 text-zinc-300 hover:text-white hover:border-white/30'
                  }`}
                  title="切换快进（或按住 Ctrl 键）"
                >
                  <FastForward className="w-3 h-3" />
                  快进
                </button>
                {safeIdx > 0 && !choiceReply && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFastForwardToggle(false);
                      onLineIdxChange(Math.max(0, safeIdx - 1));
                    }}
                    className="hover:text-white flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3 h-3" />
                    上一句
                  </button>
                )}
                {!isTyping && !(activeChoices && activeChoices.length > 0) && !isWaitingForTerminal && (
                  <ChevronRight className="w-4 h-4 text-amber-300 shrink-0" />
                )}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
