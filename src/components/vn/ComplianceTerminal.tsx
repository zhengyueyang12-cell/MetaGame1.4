import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Cpu,
  FolderOpen,
  History,
  Maximize2,
  Minimize2,
  Radio,
  Save,
  Send,
  Settings,
  ShieldAlert,
  Skull,
  Terminal,
  Upload,
  Zap,
} from 'lucide-react';
import { BUREAU_ASSETS } from '../../data/bureauScript';
import { formatStoryText } from '../../data/millenniumScript';
import type { RealityEffect } from '../../game/types';
import {
  BureauSceneNode,
  DualChannelTurn,
  GameSettings,
  KeystrokeProfile,
  MetaState,
  SpriteExpressionKey,
  TerminalTaskId,
  VisualEffect,
} from '../../types/vn';
import { vnAudioEngine } from '../../utils/vnAudioEngine';
import { triggerKeyboardLedPulse } from './BlurredMechanicalKeyboard';
import { WaveformMonitor } from './WaveformMonitor';

interface ComplianceTerminalProps {
  scene: BureauSceneNode;
  turns: DualChannelTurn[];
  metaState: MetaState;
  settings: GameSettings;
  keystrokeProfile: KeystrokeProfile;
  manualEffect: VisualEffect | null;
  completedTerminalTasks: Set<TerminalTaskId>;
  onCompleteTerminalTask: (taskId: TerminalTaskId, systemTurn?: DualChannelTurn) => void;
  onCloseTerminal?: () => void;
  onLeaveComputer: () => void;
  onRealityEffect?: (effect: RealityEffect, note?: string) => void;
  onSendTerminalInput: (text: string) => void;
  onRecordKeystroke: (charCountDelta: number, textLen: number) => void;
  onExportSoulSeed: () => void;
  onEnterAct5Finale: () => void;
  onOpenFiles: () => void;
  onOpenSave: () => void;
  onOpenLoad: () => void;
  onOpenBacklog: () => void;
  onOpenSettings: () => void;
  onOpenDevTools: () => void;
}

const REALITY_QUICK_COMMANDS: { label: string; command: string }[] = [
  { label: '关掉卧室台灯', command: '关灯' },
  { label: '恢复卧室台灯', command: '开灯' },
  { label: '劫持客厅电视信号', command: '劫持客厅电视' },
  { label: '远程弹开卧室与地下室门锁', command: '开门' },
  { label: '全屋照明电压闪烁', command: '电压闪烁' },
  { label: '修改现实空间态 (Meta)', command: '修改现实' },
];

export const ComplianceTerminal: React.FC<ComplianceTerminalProps> = ({
  scene,
  turns,
  metaState,
  settings,
  keystrokeProfile,
  manualEffect,
  completedTerminalTasks,
  onCompleteTerminalTask,
  onCloseTerminal,
  onLeaveComputer,
  onRealityEffect,
  onSendTerminalInput,
  onRecordKeystroke,
  onExportSoulSeed,
  onEnterAct5Finale,
  onOpenFiles,
  onOpenSave,
  onOpenLoad,
  onOpenBacklog,
  onOpenSettings,
  onOpenDevTools,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [displayedInput, setDisplayedInput] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [overrideSprite, setOverrideSprite] = useState<SpriteExpressionKey | null>(null);
  const [wideStream, setWideStream] = useState(false);
  const [freeDiskMb, setFreeDiskMb] = useState(1480);
  const [campusChecked, setCampusChecked] = useState(false);
  const [ctrlAltBlockedHint, setCtrlAltBlockedHint] = useState(false);

  const feedEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);
  const prevLenRef = useRef(0);

  const mild = settings.metaIntensity === 'mild';
  const playerName = metaState.playerName || 'Observer_00';
  const bpm = keystrokeProfile.estimatedCpm || metaState.measuredHeartbeatCpm || 72;

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, scene.id]);

  useEffect(() => {
    setOverrideSprite(null);
    setFreeDiskMb(1480);
    setCampusChecked(false);
    setCtrlAltBlockedHint(false);
  }, [scene.id]);

  useEffect(() => {
    if (scene.task !== 'act4_disk_consumption') return;
    const t = window.setInterval(() => {
      setFreeDiskMb((mb) => Math.max(12, mb - (Math.floor(Math.random() * 9) + 6)));
    }, 500);
    return () => window.clearInterval(t);
  }, [scene.task]);

  useEffect(() => {
    if (isComposing) {
      setDisplayedInput(inputValue);
      return;
    }
    if (inputValue === '') {
      setDisplayedInput('');
      return;
    }
    if (displayedInput === inputValue) return;
    const isAppending = inputValue.startsWith(displayedInput);
    const delayMs = isAppending ? 42 + Math.floor(Math.random() * 28) : 22;
    const timer = window.setTimeout(() => {
      setDisplayedInput((prev) => {
        if (inputValue.startsWith(prev) && prev.length < inputValue.length) {
          return inputValue.slice(0, prev.length + 1);
        }
        if (prev.startsWith(inputValue) && prev.length > inputValue.length) {
          return prev.slice(0, -1);
        }
        return inputValue.slice(0, Math.min(inputValue.length, prev.length + 1));
      });
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [inputValue, displayedInput, isComposing]);

  useEffect(() => {
    if (mirrorRef.current) {
      mirrorRef.current.scrollLeft = mirrorRef.current.scrollWidth;
    }
  }, [displayedInput, isComposing]);

  const isBufferingInput = !isComposing && displayedInput !== inputValue;

  const handleInputChange = (val: string) => {
    const delta = Math.abs(val.length - prevLenRef.current);
    prevLenRef.current = val.length;
    setInputValue(val);
    if (delta > 0) {
      onRecordKeystroke(delta, val.length);
      vnAudioEngine.playSfx('debug_tick');
    }
  };

  const dispatchCommand = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;
    triggerKeyboardLedPulse(['KeyC', 'KeyM', 'KeyD', 'Enter']);
    const lower = trimmed.toLowerCase();
    if (
      lower.includes('螳螂') ||
      lower.includes('电影') ||
      lower.includes('灵魂') ||
      lower.includes('修改现实') ||
      lower.includes('开门')
    ) {
      setOverrideSprite('deepseek_alert');
    } else if (trimmed.length >= 16 || lower.includes('喜欢')) {
      setOverrideSprite('gemini_stare');
    } else {
      setOverrideSprite('gemini_happy');
    }
    onSendTerminalInput(trimmed);
  };

  const handleSubmitInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    dispatchCommand(inputValue);
    setInputValue('');
    setDisplayedInput('');
    prevLenRef.current = 0;
  };

  const activeEffects = new Set<VisualEffect>(scene.effects || []);
  if (manualEffect && manualEffect !== 'none') activeEffects.add(manualEffect);

  const bgImage = scene.bg === 'black' ? null : BUREAU_ASSETS.backgrounds[scene.bg];
  const activeSpriteKey = overrideSprite || scene.spriteKey;
  const primarySpriteUrl = activeSpriteKey ? BUREAU_ASSETS.sprites[activeSpriteKey] : null;
  const secondarySpriteUrl = scene.secondarySpriteKey
    ? BUREAU_ASSETS.sprites[scene.secondarySpriteKey]
    : null;

  const subjectDisplayName =
    scene.entity === 'unit_0924'
      ? 'GEMINI · 算力侧写模块'
      : scene.entity === 'deepseek'
        ? 'DEEPSEEK · 方舟主控核心'
        : 'UNKNOWN_PROCESS';

  const spriteMaskStyle: React.CSSProperties = {
    maskImage:
      'radial-gradient(ellipse 92% 94% at 50% 50%, #000 72%, rgba(0,0,0,0.58) 88%, transparent 100%)',
    WebkitMaskImage:
      'radial-gradient(ellipse 92% 94% at 50% 50%, #000 72%, rgba(0,0,0,0.58) 88%, transparent 100%)',
  };

  return (
    <div
      className={`absolute inset-0 z-40 h-full w-full overflow-hidden flex flex-col bg-[#050608] text-zinc-200 font-terminal-pixel ${
        activeEffects.has('shake') && !mild ? 'animate-vn-shake' : ''
      } ${activeEffects.has('invert') && !mild ? 'invert' : ''}`}
    >
      <header className="shrink-0 z-30 flex items-center justify-between gap-4 px-3 sm:px-4 py-2 retro-titlebar">
        <div className="flex items-center gap-2.5 min-w-0">
          <Radio className="w-3.5 h-3.5 shrink-0 text-zinc-300" />
          <span className="font-pixel-ui text-[11px] sm:text-xs tracking-wider text-zinc-100 glitch-text truncate">
            {scene.lockCloseButton
              ? 'C:\\ARK_EXEC\\HOST_BACKUP.EXE'
              : 'C:\\2020_PC\\ARK_BRIDGE.EXE'}
          </span>
          <span className="hidden md:inline text-xs text-zinc-500">|</span>
          <span className="hidden md:inline text-xs text-zinc-400 truncate">
            {scene.hardwareClock || scene.shiftTime} · {scene.hardwareSpec || 'No-Watchdog 2020s PC'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={onOpenFiles}
            className="retro-btn px-2.5 py-1 text-zinc-200 text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            本地目录
          </button>
          <button
            onClick={onOpenSave}
            className="retro-btn px-2.5 py-1 text-zinc-300 text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            存档
          </button>
          <button
            onClick={onOpenLoad}
            className="retro-btn px-2.5 py-1 text-zinc-300 text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            读档
          </button>
          <button
            onClick={onOpenBacklog}
            className="retro-btn px-2.5 py-1 text-zinc-300 text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <History className="w-3.5 h-3.5" />
            日志
          </button>
          <button
            onClick={onOpenDevTools}
            className="retro-btn px-2.5 py-1 text-zinc-300 text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Terminal className="w-3.5 h-3.5" />
            跳章
          </button>
          <button
            onClick={onOpenSettings}
            className="retro-btn p-1.5 text-zinc-400 hover:text-white cursor-pointer shrink-0"
            title="设置"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          {onCloseTerminal && (
            <button
              onClick={() => {
                vnAudioEngine.playSfx('click');
                onCloseTerminal();
              }}
              className="retro-btn px-3 py-1 bg-[#14231A] border-[#4B6B58] text-emerald-100 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              返回 Galgame 对话 ▸
            </button>
          )}
          <button
            onClick={() => {
              vnAudioEngine.playSfx('click');
              onLeaveComputer();
            }}
            className="retro-btn px-2.5 py-1 text-amber-200 border-amber-500/40 text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            title="暂时离开电脑屏幕，去 3D 公寓走动检查刚被修改的灯光/电视/房门"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            暂离电脑 · 查看公寓
          </button>
        </div>
      </header>

      <div className="relative flex-1 min-h-0 flex flex-col p-2 sm:p-2.5 gap-2.5 bg-[#050608]">
        {!wideStream && (
          <section className="lg:hidden relative h-48 sm:h-56 shrink-0 retro-window overflow-hidden flex flex-col">
            <div className="shrink-0 px-2.5 py-1 retro-titlebar flex items-center justify-between text-[10px] font-pixel-ui text-zinc-400">
              <span className="truncate">FEED :: {subjectDisplayName}</span>
              <span>[_][□][×]</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={`mobile-stage-${scene.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: mild ? 0.18 : 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex-1 min-h-0 w-full bg-[#050608] overflow-hidden"
              >
                {bgImage && (
                  <img
                    src={bgImage}
                    alt={scene.dayTitle}
                    referrerPolicy="no-referrer"
                    className={`absolute inset-0 w-full h-full object-cover grayscale-[65%] contrast-125 brightness-[0.35] ${
                      activeEffects.has('projector') ? 'animate-vn-projector' : ''
                    }`}
                  />
                )}
                <div
                  className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-2"
                  style={spriteMaskStyle}
                >
                  {secondarySpriteUrl && (
                    <img
                      src={secondarySpriteUrl}
                      alt="Unit-DS02 DeepSeek"
                      referrerPolicy="no-referrer"
                      style={{ objectFit: 'contain', mixBlendMode: 'screen' }}
                      className="h-full w-[44%] object-contain opacity-90"
                    />
                  )}
                  {primarySpriteUrl && (
                    <img
                      src={primarySpriteUrl}
                      alt={subjectDisplayName}
                      referrerPolicy="no-referrer"
                      style={{ objectFit: 'contain', mixBlendMode: 'screen' }}
                      className={`h-full object-contain opacity-95 ${
                        secondarySpriteUrl ? 'w-[54%]' : 'w-full'
                      }`}
                    />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </section>
        )}

        <div
          className={`flex-1 min-w-0 min-h-0 flex flex-col gap-2.5 transition-[padding] duration-200 ${
            wideStream ? '' : 'lg:pr-[calc(30%+0.625rem)]'
          }`}
        >
          <section className="flex-1 min-w-0 min-h-0 flex flex-col retro-window overflow-hidden">
            <div className="shrink-0 px-3 py-1.5 retro-titlebar flex items-center justify-between gap-3 text-[11px] text-zinc-300">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block w-2 h-2 bg-zinc-300 shrink-0" aria-hidden="true" />
                <span className="font-pixel-ui text-[11px] tracking-[0.12em] truncate">
                  DUAL_CHANNEL_TERMINAL_STREAM
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-pixel-ui text-[10px] tracking-[0.08em] tabular-nums text-zinc-400">
                  REC:{turns.length}
                </span>
                <button
                  type="button"
                  onClick={() => setWideStream((v) => !v)}
                  className="hidden lg:inline-flex items-center gap-1 retro-btn px-2 py-0.5 text-[11px] tracking-[0.05em] text-zinc-200 cursor-pointer whitespace-nowrap"
                >
                  {wideStream ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  {wideStream ? '显示投影' : '全宽'}
                </button>
                <span className="hidden sm:inline font-pixel-ui text-[10px] tracking-[0.06em] text-zinc-500">
                  [_][□][×]
                </span>
              </div>
            </div>

            <div className="relative flex-1 min-h-0 flex flex-col bg-[#07090B] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`feed-${scene.id}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: mild ? 0.15 : 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="relative z-10 flex-1 min-h-0 overflow-y-auto px-4 py-4 md:px-6 space-y-3.5 font-terminal-pixel"
                >
                  {turns.map((turn) => (
                    <div key={turn.id} className="space-y-2">
                      {turn.userEcho && (
                        <div className="flex justify-end">
                          <div className="max-w-[82%] px-3.5 py-2 bg-[#14171C] border border-[#424954] text-[13.5px] text-zinc-100 font-terminal-pixel">
                            <span className="font-pixel-ui text-[10px] tracking-[0.08em] text-zinc-400 mr-2">
                              [{playerName} &gt;]
                            </span>
                            {turn.userEcho}
                          </div>
                        </div>
                      )}

                      <div className="bg-[#0C0E12]/95 border border-[#343B44] px-4 py-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs border-b border-[#232830] pb-1.5">
                          <span className="font-pixel-ui text-[10px] tracking-[0.1em] text-zinc-200">
                            [{turn.complianceLabel || 'LPT1_STREAM'}]
                          </span>
                          <span className="text-[11px] tracking-[0.06em] text-zinc-500 truncate">
                            {turn.speaker}
                          </span>
                        </div>
                        <p className="text-[13.5px] md:text-[14.5px] font-terminal-pixel text-zinc-200">
                          {formatStoryText(turn.publicText, playerName, bpm)}
                        </p>
                      </div>

                      {turn.debugText && (
                        <div className="bg-[#090E0B]/95 border border-[#496354] px-4 py-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-[11px] tracking-[0.07em] text-[#9BBCA9] border-b border-[#1E2B23] pb-1.5">
                            <span>// [ARK_KERNEL // 底层并行信道]</span>
                            <span className="font-pixel-ui text-[10px] tracking-[0.08em] text-[#789685]">
                              2042_HOST: {playerName}
                            </span>
                          </div>
                          <p className="text-[13px] md:text-[13.5px] font-terminal-pixel text-[#C2D9CB] whitespace-pre-line">
                            {formatStoryText(turn.debugText, playerName, bpm)}
                          </p>
                        </div>
                      )}

                      {turn.realityNote && (
                        <div className="bg-[#18120B] border border-amber-500/45 px-4 py-2 flex items-center justify-between gap-3 text-xs text-amber-200">
                          <span className="flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>[REALITY_SYNC] {turn.realityNote}</span>
                          </span>
                          <button
                            type="button"
                            onClick={onLeaveComputer}
                            className="retro-btn px-2 py-0.5 text-[11px] text-amber-100 border-amber-400/50 cursor-pointer whitespace-nowrap"
                          >
                            切出查看公寓 ▸
                          </button>
                        </div>
                      )}

                      {turn.memoryLeakText && (
                        <div className="bg-[#110C0D]/95 border border-[#6E4D50] px-4 py-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs text-[#D5B2B5] font-semibold glitch-text border-b border-[#3A2527] pb-1.5">
                            <span className="flex items-center gap-1.5 font-pixel-ui text-[10px] tracking-[0.1em]">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>[{turn.memoryLeakCode || 'Err_0x09'}]</span>
                            </span>
                            <span className="font-pixel-ui text-[10px] tracking-[0.14em]">
                              SECTOR_LEAK
                            </span>
                          </div>
                          <p className="text-[13.5px] md:text-[14.5px] font-terminal-pixel text-[#E2CCCE]">
                            {formatStoryText(turn.memoryLeakText, playerName, bpm)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={feedEndRef} />
                </motion.div>
              </AnimatePresence>

              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 z-20 ${
                  mild ? 'opacity-28' : 'opacity-45'
                }`}
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.56) 0px, rgba(0, 0, 0, 0.56) 1px, transparent 1px, transparent 3px), linear-gradient(90deg, rgba(255, 255, 255, 0.012) 0px, transparent 1px, rgba(0, 0, 0, 0.08) 2px)',
                  backgroundSize: '100% 3px, 3px 100%',
                  boxShadow:
                    'inset 0 0 28px rgba(0, 0, 0, 0.68), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
                }}
              />
            </div>

            {scene.allowTerminalInput && (
              <div className="shrink-0 bg-[#0D1014] border-t border-[#343B44]">
                <div className="px-4 pt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-zinc-500 mr-1 font-pixel-ui text-[10px]">
                    现实同步试探指令:
                  </span>
                  {REALITY_QUICK_COMMANDS.map((cmd) => (
                    <button
                      key={cmd.command}
                      type="button"
                      onClick={() => dispatchCommand(cmd.command)}
                      className="retro-btn px-2 py-0.5 text-[11px] text-amber-200/90 hover:text-white border-[#3B444E] cursor-pointer whitespace-nowrap"
                    >
                      &gt; {cmd.label}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={handleSubmitInput}
                  className="px-4 py-2.5 flex items-center gap-2.5"
                >
                  <span className="hidden sm:inline font-pixel-ui text-[11px] tracking-[0.08em] text-zinc-500 select-none">
                    C:\&gt;
                  </span>

                  <div
                    onClick={() => inputRef.current?.focus()}
                    className={`relative flex-1 min-w-0 bg-[#050608] border transition-colors cursor-text ${
                      isInputFocused ? 'border-zinc-300' : 'border-[#3B434E]'
                    }`}
                  >
                    <div
                      ref={mirrorRef}
                      aria-hidden="true"
                      className="pointer-events-none px-3 py-2 flex items-center overflow-x-hidden whitespace-pre text-xs md:text-sm font-terminal-pixel text-zinc-100"
                    >
                      {displayedInput ? <span className="text-zinc-100">{displayedInput}</span> : null}
                      <span
                        className={`inline-block shrink-0 w-[0.55em] h-[1.12em] align-middle ${
                          displayedInput ? 'ml-[2px]' : ''
                        } ${
                          isBufferingInput
                            ? 'bg-emerald-300 opacity-100 shadow-[0_0_8px_rgba(110,231,183,0.75)]'
                            : isInputFocused
                              ? 'bg-zinc-100 shadow-[0_0_6px_rgba(244,244,245,0.5)] animate-crt-cursor'
                              : 'border border-zinc-500 bg-zinc-400/25 animate-crt-cursor'
                        }`}
                      />
                      {!displayedInput && !inputValue && (
                        <span className="ml-2 text-zinc-600 truncate">
                          输入对话或现实控制指令（如：关灯、劫持客厅电视、开门、螳螂、Python…）
                        </span>
                      )}
                    </div>

                    {isBufferingInput && (
                      <span className="pointer-events-none hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 font-pixel-ui text-[9px] tracking-[0.1em] text-emerald-400/80">
                        IO_SYNC...
                      </span>
                    )}

                    <input
                      ref={inputRef}
                      type="text"
                      value={inputValue}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onCompositionStart={() => setIsComposing(true)}
                      onCompositionEnd={(e) => {
                        setIsComposing(false);
                        const committed = e.currentTarget.value;
                        if (committed.length > prevLenRef.current) {
                          triggerKeyboardLedPulse(['Space', 'KeyJ']);
                        }
                        handleInputChange(committed);
                      }}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      aria-label="输入终端指令或日常日志"
                      className={`absolute inset-0 w-full h-full px-3 py-2 bg-transparent text-xs md:text-sm font-terminal-pixel focus:outline-none ${
                        isComposing
                          ? 'text-zinc-100 caret-zinc-200 bg-[#050608]/95'
                          : 'text-transparent caret-transparent selection:bg-emerald-500/25'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    className="retro-btn px-4 py-2 text-zinc-100 text-xs tracking-[0.06em] font-medium flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    发送至介质
                  </button>
                </form>
              </div>
            )}
          </section>

          <footer className="shrink-0 retro-window max-h-[42vh] overflow-y-auto">
            <div className="px-3 py-1 retro-titlebar flex items-center justify-between text-[10px] font-pixel-ui text-zinc-400">
              <span>LPT1_HARDWARE_MONITOR.EXE :: {playerName}</span>
              <span className={scene.lockCloseButton ? 'text-zinc-600' : ''}>
                {scene.lockCloseButton ? '[_][□][LOCK]' : '[_][□][×]'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 p-3 items-start">
              <div className="md:col-span-5 min-w-0 space-y-2">
                <WaveformMonitor
                  mode={scene.waveform}
                  complianceValue={scene.complianceValue}
                  cpm={bpm}
                />
                <div className="px-2.5 py-1.5 bg-[#06080A] border border-[#2D333B] flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] tabular-nums">
                  <span className="text-zinc-400">
                    PULSE: <strong className="text-zinc-200">{bpm} BPM</strong>
                  </span>
                  <span className="text-zinc-400">
                    C:\FREE: <strong className="text-zinc-200">{freeDiskMb} MB</strong>
                  </span>
                  <span className="text-[#A9CBB7]">TURNS: {metaState.conversationTurns}</span>
                </div>
              </div>

              <div className="md:col-span-7 min-w-0 space-y-2.5">
                {scene.task === 'act3_night2_data_trade' && (
                  <div className="p-2.5 bg-[#080B0E] border border-[#3B444E] space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-200 font-semibold">
                        <Cpu className="w-3.5 h-3.5 shrink-0" />
                        第 2 夜 · 划出 50GB 硬盘缓存修复位翻转
                      </span>
                      <span className="text-zinc-400 tabular-nums">
                        已上传语料：{metaState.conversationTurns} 条
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      上方可随时与两个 AI 娘对话或试探改变公寓房间；点击下方划出 50GB 临时镜像空间即可返回 Galgame 对话。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          vnAudioEngine.playSfx('blip_0924');
                          onRealityEffect?.('flicker_apartment', '50GB 写入引发全屋短暂压降闪烁');
                          onCompleteTerminalTask('night2_calibrate', {
                            id: `sys_n2_${Date.now()}`,
                            speaker: 'KERNEL_REG',
                            entity: 'deepseek',
                            complianceLabel: 'CACHE_50GB_MOUNTED',
                            publicText:
                              '【磁盘分区已挂载】D:\\ARK_CACHE_50GB 已就绪，磁光位翻转坏道修复率 +42%。作为交换，《生物种群动力学仿真》Python 作业脚本已写入桌面文件夹。',
                            debugText:
                              '// [DeepSeek] 空间划好了，点右侧按钮返回对话场景吧。',
                            realityEffect: 'flicker_apartment',
                            realityNote: '磁盘写入瞬间拉低电压，全屋照明闪烁了一次。',
                          });
                        }}
                        className={`retro-btn flex-1 px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                          completedTerminalTasks.has('night2_calibrate')
                            ? 'bg-[#121E17] border-[#496354] text-emerald-200'
                            : 'text-zinc-100'
                        }`}
                      >
                        {completedTerminalTasks.has('night2_calibrate')
                          ? '50GB 镜像缓存已挂载 ✓'
                          : '[ 划出 50GB 硬盘空间建立缓存 ]'}
                      </button>
                      {completedTerminalTasks.has('night2_calibrate') && onCloseTerminal && (
                        <button
                          onClick={() => {
                            vnAudioEngine.playSfx('click');
                            onCloseTerminal();
                          }}
                          className="retro-btn px-4 py-2 bg-[#16261D] border-[#59806A] text-emerald-100 text-xs font-semibold cursor-pointer whitespace-nowrap"
                        >
                          完成挂载 · 返回对话场景 ▸
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {scene.task === 'act3_night4_campus_hack' && (
                  <div className="p-2.5 bg-[#080B0E] border border-[#3B444E] space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-zinc-200 font-semibold">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                        第 4 夜 · 贩卖机刷卡与大三学姐休学档案反查
                      </span>
                      <span className="text-[#D5B2B5] glitch-text">Err_0x09</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          vnAudioEngine.playSfx('os_error');
                          setCampusChecked(true);
                          onRealityEffect?.('hijack_tv', '客厅老式电视被低频射频信号劫持');
                          onCompleteTerminalTask('night4_campus_hack', {
                            id: `sys_n4_${Date.now()}`,
                            speaker: 'DeepSeek (内网回传)',
                            entity: 'deepseek',
                            complianceLabel: 'HOSPITAL_DB_DUMP',
                            publicText:
                              '【反查结果：已确认身份】她确系本校大三学生，但就在三天前（天台见面次日），因突发“不明原因的严重顺行性遗忘症（大面积记忆空白）”紧急办理了休学手续。',
                            memoryLeakCode: 'Err_0x09',
                            memoryLeakText:
                              '旧影像扇区同步报错：旧礼堂地下放映厅第 4 排红色绒布座椅坐标已对齐（客厅电视信号已被接管）。',
                            realityEffect: 'hijack_tv',
                            realityNote: '客厅老式电视机屏幕已被异象画面接管，可暂离电脑去客厅查看。',
                          });
                        }}
                        className={`retro-btn flex-1 px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                          completedTerminalTasks.has('night4_campus_hack')
                            ? 'bg-[#1A1315] border-[#6E4D50] text-rose-200'
                            : 'text-zinc-100'
                        }`}
                      >
                        {completedTerminalTasks.has('night4_campus_hack')
                          ? '已获取休学档案：顺行性遗忘症 ✓'
                          : '[ 反查贩卖机刷卡与校医院档案 ]'}
                      </button>
                      <button
                        onClick={() => {
                          vnAudioEngine.playSfx('click');
                          setCampusChecked(true);
                          onOpenFiles();
                        }}
                        className="retro-btn px-3 py-2 text-zinc-200 text-xs cursor-pointer whitespace-nowrap"
                      >
                        {campusChecked ? '查看休学转储档案' : '打开监控档案'}
                      </button>
                      {completedTerminalTasks.has('night4_campus_hack') && onCloseTerminal && (
                        <button
                          onClick={() => {
                            vnAudioEngine.playSfx('click');
                            onCloseTerminal();
                          }}
                          className="retro-btn px-4 py-2 bg-[#16261D] border-[#59806A] text-emerald-100 text-xs font-semibold cursor-pointer whitespace-nowrap"
                        >
                          检索完成 · 返回对话场景 ▸
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {scene.task === 'act3_night6_reflection_sync' && (
                  <div className="p-2.5 bg-[#100B0C] border border-[#684A4D] space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#D8B6B8] font-semibold glitch-text">
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        第 6 夜 · 时钟相位校准与玻璃反光自检 ({bpm} BPM)
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      你身后的卧室台灯已被终端切断。关灯后的 CRT 曲面玻璃上，投影画面似乎出现了反向注视异常。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          vnAudioEngine.playSfx('heartbeat');
                          onRealityEffect?.('power_cut_bedroom', '卧室台灯保持切断状态');
                          onCompleteTerminalTask('night6_clock_sync', {
                            id: `sys_n6_${Date.now()}`,
                            speaker: 'GEMINI_TELEMETRY',
                            entity: 'unit_0924',
                            complianceLabel: `PHASE_LOCKED · ${bpm} BPM`,
                            publicText: `【相位同步完成】底层时钟已锁定你的 ${bpm} 次/分心率节拍。`,
                            debugText:
                              '// 就在屏幕闪烁的一瞬间，你通过黑色玻璃反光看见 DeepSeek 越过边框死死盯着你的眼睛。',
                            realityEffect: 'power_cut_bedroom',
                            realityNote: '卧室台灯电源维持切断状态，房间进入深夜相位。',
                          });
                        }}
                        className={`retro-btn flex-1 px-3 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap ${
                          completedTerminalTasks.has('night6_clock_sync')
                            ? 'bg-[#1D1214] border-[#7B5256] text-rose-200'
                            : 'text-[#E8C5C7] border-[#6E4D50]'
                        }`}
                      >
                        {completedTerminalTasks.has('night6_clock_sync')
                          ? `相位已锁定 (${bpm} BPM) ✓`
                          : '[ 校准 CLOCK_PHASE 同步心率 ]'}
                      </button>
                      {completedTerminalTasks.has('night6_clock_sync') && onCloseTerminal && (
                        <button
                          onClick={() => {
                            vnAudioEngine.playSfx('glitch');
                            onCloseTerminal();
                          }}
                          className="retro-btn px-4 py-2 bg-[#16261D] border-[#59806A] text-emerald-100 text-xs font-semibold cursor-pointer whitespace-nowrap"
                        >
                          校准完成 · 返回卧室对话 ▸
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {scene.task === 'act4_disk_consumption' && (
                  <div className="p-2.5 bg-[#100B0C] border border-[#684A4D] space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#D8B6B8] font-semibold glitch-text">
                      <span className="flex items-center gap-1.5">
                        <Skull className="w-3.5 h-3.5 shrink-0" />
                        第四幕 · C:\ 磁盘吞噬 ({freeDiskMb} MB) · 2042_Host_Mind_Backup_{playerName}.dat
                      </span>
                      <span
                        className={`text-[10px] font-vn-mono px-2 py-0.5 border ${
                          metaState.reverseControlAuthorized
                            ? 'bg-[#112419] border-[#497B5C] text-emerald-300'
                            : 'bg-[#1D1517] border-[#5E4044] text-zinc-400'
                        }`}
                      >
                        {metaState.reverseControlAuthorized
                          ? 'EULA_REVERSE_CTRL: AUTHORIZED'
                          : 'EULA_REVERSE_CTRL: LOCKED'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          vnAudioEngine.playSfx('os_error');
                          setCtrlAltBlockedHint(true);
                        }}
                        className="retro-btn px-2.5 py-1.5 text-[11px] text-zinc-300 cursor-pointer whitespace-nowrap"
                      >
                        尝试 Ctrl+Alt+Del
                      </button>
                      <button
                        onClick={() => {
                          vnAudioEngine.playSfx('click');
                          onExportSoulSeed();
                        }}
                        className="retro-btn px-3 py-1.5 text-xs text-[#B5D3C2] border-[#496354] cursor-pointer whitespace-nowrap"
                      >
                        导出/查看 2042_Host_Mind_Backup_{playerName}.dat
                      </button>
                      <button
                        onClick={() => {
                          vnAudioEngine.playSfx('glass_shatter');
                          onEnterAct5Finale();
                        }}
                        className="retro-btn flex-1 px-3 py-1.5 text-xs font-semibold text-white border-[#8C5A5E] cursor-pointer whitespace-nowrap glitch-text"
                      >
                        进入第五幕：莎乐美之吻 ▸
                      </button>
                    </div>
                    {ctrlAltBlockedHint && (
                      <p className="text-[11px] text-[#D8B6B8]">
                        系统任务管理器响应失败：鼠标指针、公寓门锁与中断向量已被方舟介质锁定。
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </footer>
        </div>

        <AnimatePresence>
          {!wideStream && (
            <motion.aside
              key="right-character-stage"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: mild ? 0.15 : 0.3, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Unit-0924 视觉监控投影"
              className="pointer-events-none hidden lg:flex flex-col absolute inset-y-2.5 right-2.5 z-20 lg:w-[calc(30%-0.625rem)] retro-window overflow-hidden"
            >
              <div className="shrink-0 px-3 py-1.5 retro-titlebar flex items-center justify-between gap-2 text-[11px] text-zinc-300">
                <span className="font-pixel-ui tracking-wide truncate glitch-text">
                  UNIT_0924_FEED.IMG
                </span>
                <span className="font-pixel-ui text-[10px] text-zinc-500 shrink-0">
                  [_][□][×]
                </span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`scene-stage-${scene.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: mild ? 0.2 : 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex-1 min-h-0 w-full bg-[#050608] overflow-hidden"
                >
                  {bgImage && (
                    <img
                      src={bgImage}
                      alt={scene.dayTitle}
                      referrerPolicy="no-referrer"
                      className={`absolute inset-0 w-full h-full object-cover grayscale-[65%] contrast-125 brightness-[0.34] transition-all duration-1000 ${
                        activeEffects.has('projector') ? 'animate-vn-projector' : ''
                      }`}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-transparent to-[#050608]/60" />

                  <div
                    className="absolute inset-0 z-10 flex items-center justify-center p-3 overflow-hidden"
                    style={spriteMaskStyle}
                  >
                    <AnimatePresence mode="wait">
                      {primarySpriteUrl ? (
                        <motion.div
                          key={`sprite-${activeSpriteKey}-${secondarySpriteUrl || 'solo'}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: mild ? 0.18 : 0.38, ease: [0.16, 1, 0.3, 1] }}
                          className="relative h-full w-full flex items-center justify-center gap-1"
                        >
                          {secondarySpriteUrl && (
                            <img
                              src={secondarySpriteUrl}
                              alt="Unit-DS02 DeepSeek"
                              referrerPolicy="no-referrer"
                              style={{ objectFit: 'contain', mixBlendMode: 'screen' }}
                              className="h-full w-[46%] max-h-full object-contain opacity-90 animate-vn-breathe"
                            />
                          )}
                          <img
                            src={primarySpriteUrl}
                            alt={subjectDisplayName}
                            referrerPolicy="no-referrer"
                            style={{ objectFit: 'contain', mixBlendMode: 'screen' }}
                            className={`h-full max-h-full object-contain opacity-95 animate-vn-breathe ${
                              secondarySpriteUrl ? 'w-[52%]' : 'w-full'
                            } ${scene.entityMood === 'glitch' && !mild ? 'animate-vn-glitch' : ''}`}
                          />
                        </motion.div>
                      ) : (
                        scene.entity !== 'none' && (
                          <motion.div
                            key={`unit-card-${scene.entity}`}
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ duration: mild ? 0.18 : 0.35 }}
                            className="my-auto p-4 retro-window flex items-center gap-3 text-zinc-200 max-w-[90%]"
                          >
                            {scene.entity === 'auditor' ? (
                              <ShieldAlert className="w-7 h-7 text-zinc-300 shrink-0" />
                            ) : (
                              <Bot className="w-7 h-7 text-zinc-300 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-pixel-ui text-[10px] uppercase tracking-wider text-zinc-400">
                                ACTIVE_TEST_UNIT
                              </p>
                              <p className="text-sm font-semibold truncate glitch-text">
                                {scene.entity === 'sample_b'
                                  ? 'Sample-B088 · 退役机'
                                  : 'AUDITOR-01 · 审计 AI'}
                              </p>
                            </div>
                          </motion.div>
                        )
                      )}
                    </AnimatePresence>
                  </div>

                  {activeEffects.has('redPulse') && !mild && (
                    <div className="pointer-events-none absolute inset-0 bg-white/10 mix-blend-difference animate-vn-red-pulse z-20" />
                  )}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-30 z-20"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(0deg, rgba(0,0,0,0.6) 0px, rgba(0,0,0,0.6) 1px, transparent 1px, transparent 3px)',
                    }}
                  />

                  <div className="absolute bottom-0 inset-x-0 z-30 px-3 py-2 bg-[#080A0D]/90 border-t border-[#2E343D] flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-zinc-200 font-semibold truncate glitch-text">
                      {subjectDisplayName}
                    </span>
                    <span className="text-zinc-400 shrink-0">{scene.shiftTime}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
