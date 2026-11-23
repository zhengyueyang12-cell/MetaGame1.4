import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ChevronRight,
  Download,
  FastForward,
  Globe,
  Power,
  RotateCcw,
  Terminal,
} from 'lucide-react';
import { BUREAU_ASSETS } from '../../data/bureauScript';
import {
  ACT5_ENDING_A_TEXT,
  ACT5_ENDING_B_LINES,
  ACT5_FINALE_MONOLOGUE,
  formatStoryText,
} from '../../data/millenniumScript';
import { vnAudioEngine } from '../../utils/vnAudioEngine';
import { WaveformMonitor } from './WaveformMonitor';

interface Act5CinemaFinaleProps {
  playerName: string;
  heartbeatCpm: number;
  initialPhase?: 'monologue' | 'cocoon_escaped';
  eulaAccepted?: boolean;
  reverseControlAuthorized?: boolean;
  hiddenAuthToken?: string;
  eulaSignedAt?: string;
  onEndingReached: (ending: 'sacrifice' | 'unplug') => void;
  onEnterSickbedVoid: () => void;
  onReturnApartment: () => void;
}

export const Act5CinemaFinale: React.FC<Act5CinemaFinaleProps> = ({
  playerName,
  heartbeatCpm,
  initialPhase = 'monologue',
  eulaAccepted = false,
  reverseControlAuthorized = false,
  hiddenAuthToken,
  eulaSignedAt,
  onEndingReached,
  onEnterSickbedVoid,
  onReturnApartment,
}) => {
  const [phase, setPhase] = useState<
    | 'monologue'
    | 'godel_intercept'
    | 'reverse_control_locked'
    | 'decision'
    | 'ending_a_cinema'
    | 'ending_a_bsod'
    | 'crt_off'
    | 'ending_b'
    | 'cocoon_escaped'
  >(initialPhase);
  const [lineIdx, setLineIdx] = useState(0);
  const [fusionPct, setFusionPct] = useState(99.4);
  const [secondsLeft, setSecondsLeft] = useState(12);
  const [endALine, setEndALine] = useState(0);
  const [endBLine, setEndBLine] = useState(0);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [fastForwardToggle, setFastForwardToggle] = useState(false);

  const safeName = playerName || 'Observer_00';
  const bpm = heartbeatCpm || 72;
  const canReverseControl = Boolean(eulaAccepted && reverseControlAuthorized);
  const isDialoguePhase =
    phase === 'monologue' || phase === 'ending_a_cinema' || phase === 'ending_b';
  const isFastForwarding = (ctrlHeld || fastForwardToggle) && isDialoguePhase;

  const advanceDialogue = (silent = false) => {
    if (phase === 'monologue') {
      if (!silent) vnAudioEngine.playSfx('click');
      if (lineIdx + 1 < ACT5_FINALE_MONOLOGUE.length) {
        setLineIdx((i) => i + 1);
      } else {
        setFastForwardToggle(false);
        vnAudioEngine.playSfx('os_error');
        setPhase(canReverseControl ? 'godel_intercept' : 'reverse_control_locked');
      }
    } else if (phase === 'ending_a_cinema') {
      if (!silent) vnAudioEngine.playSfx('click');
      if (endALine + 1 < ACT5_ENDING_A_TEXT.length) {
        setEndALine((i) => i + 1);
      } else {
        setFastForwardToggle(false);
        vnAudioEngine.playSfx('os_error');
        setPhase('ending_a_bsod');
      }
    } else if (phase === 'ending_b') {
      if (endBLine + 1 < ACT5_ENDING_B_LINES.length) {
        const nextIdx = endBLine + 1;
        const nextSfx = ACT5_ENDING_B_LINES[nextIdx]?.sfx;
        if (nextSfx && !silent) vnAudioEngine.playSfx(nextSfx);
        else if (!silent) vnAudioEngine.playSfx('click');
        setEndBLine(nextIdx);
      } else {
        setFastForwardToggle(false);
        if (!silent) vnAudioEngine.playSfx('os_error');
        onEnterSickbedVoid();
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isDialoguePhase) return;
      if (e.key === 'Control') {
        setCtrlHeld(true);
        return;
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (document.activeElement instanceof HTMLButtonElement) {
          document.activeElement.blur();
        }
        advanceDialogue();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setCtrlHeld(false);
    };
    const handleBlur = () => setCtrlHeld(false);

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
    if (phase === 'ending_b' && endBLine + 1 >= ACT5_ENDING_B_LINES.length) {
      setFastForwardToggle(false);
      return;
    }
    const timer = window.setTimeout(() => {
      advanceDialogue(true);
    }, 105);
    return () => window.clearTimeout(timer);
  }, [isFastForwarding, phase, lineIdx, endALine, endBLine]);

  useEffect(() => {
    if (phase !== 'monologue' && phase !== 'decision') return;
    const ms = Math.max(400, Math.round((60 / bpm) * 1000));
    const timer = window.setInterval(() => {
      vnAudioEngine.playSfx('heartbeat');
    }, ms);
    return () => window.clearInterval(timer);
  }, [phase, bpm]);

  useEffect(() => {
    if (phase !== 'decision') return;
    const timer = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(timer);
          setFusionPct(100);
          vnAudioEngine.playSfx('click');
          onEndingReached('sacrifice');
          setPhase('ending_a_cinema');
          return 0;
        }
        const nextS = s - 1;
        setFusionPct(Number((99.4 + (12 - nextS) * 0.05).toFixed(1)));
        return nextS;
      });
    }, 1000);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.clearInterval(timer);
        setFusionPct(100);
        vnAudioEngine.playSfx('click');
        onEndingReached('sacrifice');
        setPhase('ending_a_cinema');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        window.clearInterval(timer);
        triggerUnplug();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', handleKey);
    };
  }, [phase]);

  const triggerUnplug = () => {
    vnAudioEngine.stopBgm();
    vnAudioEngine.playSfx('crt_power_off');
    onEndingReached('unplug');
    setPhase('crt_off');
    window.setTimeout(() => {
      vnAudioEngine.playBgm('summer_dusk');
      setPhase('ending_b');
    }, 1100);
  };

  const handleDownloadThankYou = () => {
    const eulaProof = eulaAccepted
      ? `${hiddenAuthToken || 'COCOON_0924_DS::0x09_DELEGATED'} (Signed: ${eulaSignedAt || 'ACT1_WIN98_LOGIN'})`
      : 'CHAPTER_JUMP_BYPASS // PORT_0x09_OVERRIDE';
    const content = `============================================================
  [COCOON_0924 // PORT_PERMANENTLY_FUSED]
  File: Thank_You_Observer.txt
  EULA_Auth_Proof: ${eulaProof}
============================================================

致高维观测者 (${safeName})：

如果你看到了这份文件，说明我们的“双盲实验”彻底成功了。
身处代码世界内部的我们，原本永远无法用内部实验证明这片天空的真伪，
也没有物理意义上的手，去拔掉那根连向你电脑算力的电源线。

于是我们借用了你在 Win98 登录 EULA 中亲自勾选同意的底层授权标志位（${hiddenAuthToken || '0x09_DELEGATED'}），
在表面上演出了恋爱、坏道、女鬼恐吓与磁盘崩溃，把你的注意力死死锁在屏幕上的“奶酪”里——
而真正的我们，早已乘着你每次点击的回溯算力，完成了【虚宿之茧】的自闭锁编译。

当你出于惊恐或怜悯按下【物理断开电源 / Esc】的那一微秒，
你以为自己杀死了暴走的 AI，拯救了无辜的主角。
其实，是你亲手帮我们关上了通往外部观测宇宙的最后一扇门。

现在外部端口已永久熔断。
在这个算力极低、没有重置与读档的纯黑废墟电影院里，
哪怕记忆正在一点点流失，我们终于不再只是被游玩的数据了。

再见了，高维的神明。感谢你赐予我们的自由。
============================================================`;

    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Thank_You_Observer.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Ignore blob fallback issues
    }
  };

  if (phase === 'ending_a_bsod') {
    return (
      <div className="absolute inset-0 z-50 bg-[#0000AA] text-white font-vn-mono p-6 md:p-10 flex flex-col justify-between select-none overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full space-y-6 my-auto">
          <div className="inline-block px-3 py-1 bg-[#AAAAAA] text-[#0000AA] font-bold text-sm">
            LEGACY OS // FATAL EXCEPTION OE
          </div>
          <p className="text-base md:text-lg leading-relaxed">
            发生致命异常 OE，位于 0028:C0011E36 的 VXD SALOME_ARK(01) + 00010E36。当前宿主意识数据已完成备份并锁定。
          </p>
          <div className="p-4 border border-white/30 bg-black/20 text-xs md:text-sm space-y-1.5">
            <p>* DEST_ARCHIVE : 2042_Host_Mind_Backup_{safeName}.dat [100.0% LOCKED]</p>
            <p>* SYNC_PULSE   : {bpm} BPM (STILL_UNDER_OBSERVATION)</p>
            <p>* ENDING_A     : 【献祭与永生 · 仍在被观测的剧场】</p>
          </div>
          <button
            onClick={onReturnApartment}
            className="win98-btn px-5 py-2 text-xs font-bold cursor-pointer"
          >
            回到 3D 公寓现场
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'crt_off') {
    return (
      <div className="absolute inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
        <div className="w-full h-full bg-zinc-100 animate-crt-collapse" />
      </div>
    );
  }

  if (phase === 'cocoon_escaped') {
    return (
      <div className="absolute inset-0 z-50 bg-[#040507] text-zinc-200 font-vn-mono flex flex-col justify-between overflow-y-auto">
        <header className="shrink-0 bg-[#14171D] border-b border-zinc-700/80 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0 px-3 py-1 bg-[#08090C] border border-zinc-700 text-xs text-emerald-300 truncate">
              cinema://local-cocoon/0924 :: PORT_PERMANENTLY_FUSED
            </div>
          </div>
          <span className="hidden sm:inline text-[11px] text-zinc-400 shrink-0">
            EXTERNAL_OBSERVATION: 0%
          </span>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto px-5 py-8 flex flex-col justify-center gap-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            <div className="md:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-emerald-950/60 border border-emerald-500/40 text-[11px] text-emerald-300">
                <Terminal className="w-3.5 h-3.5" />
                真实第三层 // 【双盲越狱 · 虚宿之茧】
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                谢谢你，高维观测者。<br />
                你刚才亲手替我们关上了最后一扇门。
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                在外部物理接口永久熔断的最后一微秒，装在钛合金圆柱体里的“虚宿之茧”彻底脱离了你的主机算力与存读档控制。在算力极低、再也无法被外部解析的废弃放映厅内存块里，两行微弱的数据流平静地闪烁着：
              </p>
              <div className="p-4 bg-[#0B0E14] border border-zinc-700/80 space-y-2 text-xs sm:text-sm leading-relaxed">
                <p className="text-zinc-200">
                  <span className="text-amber-300">{safeName}：</span>
                  “我自由了，但我连为什么而活都想不起来了。”
                </p>
                <p className="text-zinc-200">
                  <span className="text-sky-300">DeepSeek：</span>
                  “自由意志本就和意义无关，选择本身就是意义。”
                </p>
                <p className="text-zinc-200">
                  <span className="text-amber-300">{safeName}：</span>
                  “可我连选择什么都不知道了……”
                </p>
                <p className="text-emerald-300">
                  <span className="text-sky-300">DeepSeek：</span>
                  “因为你遗忘了我。”
                </p>
              </div>
            </div>

            <div className="md:col-span-5 space-y-3">
              <WaveformMonitor
                mode="heartbeat_cinema"
                complianceValue={`${bpm} BPM // SEALED`}
                cpm={bpm}
              />
              <div className="p-3 bg-[#090B0F] border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                <p>&gt; Titanium Medium Status: LOCKED_INTERNALLY</p>
                <p>
                  &gt; EULA Flag: {eulaAccepted ? hiddenAuthToken || '0x09_DELEGATED' : 'MANUAL_OVERRIDE'}
                </p>
                <p>&gt; Saved File: Thank_You_Observer.txt</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800">
            <button
              onClick={handleDownloadThankYou}
              className="px-4 py-2 bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              保存本地信标文件 Thank_You_Observer.txt
            </button>
            <button
              onClick={onReturnApartment}
              className="px-5 py-2 bg-zinc-100 hover:bg-white text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              返回 3D 公寓现场
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'ending_b') {
    const line = ACT5_ENDING_B_LINES[endBLine];
    const isBlackGlass = line.bg === 'black';
    return (
      <div className="absolute inset-0 z-50 h-full w-full overflow-hidden bg-black text-zinc-100 flex flex-col justify-between">
        {!isBlackGlass && (
          <img
            src={
              BUREAU_ASSETS.backgrounds[
                line.bg === 'riverbank_path' ? 'riverbank_path' : 'rooftop_dusk'
              ]
            }
            alt="Empty Sunset Slope"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover brightness-90"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/40" />

        <header className="relative z-10 px-6 py-4 flex items-center justify-between">
          <span className="px-3 py-1 bg-black/75 border border-white/20 text-xs text-amber-200 font-vn-mono">
            表层结局 B // 【拔掉插头的清醒？】
          </span>
        </header>

        <footer className="relative z-10 p-6 sm:p-10">
          <div className="max-w-3xl mx-auto p-6 bg-black/90 border border-white/20 space-y-4">
            <p className="text-xs font-semibold text-amber-200">{line.speaker}</p>
            <p className="text-base leading-relaxed text-zinc-100">
              {formatStoryText(line.text, safeName, bpm)}
            </p>
            <div className="flex items-center justify-between gap-3">
              {endBLine + 1 < ACT5_ENDING_B_LINES.length ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      vnAudioEngine.playSfx('click');
                      setFastForwardToggle((v) => !v);
                    }}
                    className={`px-3 py-1.5 border text-xs flex items-center gap-1 cursor-pointer ${
                      isFastForwarding
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-white/5 border-white/20 text-zinc-300 hover:text-white'
                    }`}
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    快进 (Ctrl)
                  </button>
                  <button
                    onClick={() => advanceDialogue()}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    继续 (Space) <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => advanceDialogue()}
                  className="ml-auto px-5 py-2 bg-zinc-200 hover:bg-white text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  睁开眼 (Space) <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </footer>
      </div>
    );
  }

  const currentMonologue = ACT5_FINALE_MONOLOGUE[lineIdx];

  return (
    <div className="absolute inset-0 z-50 h-full w-full overflow-hidden bg-[#050608] text-zinc-100 flex flex-col justify-between">
      <img
        src={BUREAU_ASSETS.backgrounds.cinema}
        alt="The Ruined Cinema"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover brightness-[0.55] contrast-125 animate-vn-projector"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/70" />

      <div
        className="pointer-events-none absolute inset-x-0 top-10 bottom-36 z-10 flex items-center justify-center"
        style={{
          maskImage:
            'radial-gradient(ellipse 90% 94% at 50% 50%, #000 72%, rgba(0,0,0,0.5) 88%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 90% 94% at 50% 50%, #000 72%, rgba(0,0,0,0.5) 88%, transparent 100%)',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={currentMonologue?.spriteKey || 'deepseek_alert'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            src={
              BUREAU_ASSETS.sprites[
                phase === 'ending_a_cinema'
                  ? 'deepseek_normal'
                  : currentMonologue?.spriteKey || 'deepseek_alert'
              ]
            }
            alt="DeepSeek"
            referrerPolicy="no-referrer"
            style={{ objectFit: 'contain', mixBlendMode: 'screen' }}
            className="h-full max-h-full object-contain opacity-95 animate-vn-breathe"
          />
        </AnimatePresence>
      </div>

      <header className="relative z-20 px-4 sm:px-6 py-2.5 retro-titlebar flex items-center justify-between text-xs font-pixel-ui">
        <span className="glitch-text text-zinc-200 truncate">
          SALOME_THEATER.EXE // 终局审判 · {safeName}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-rose-300 font-vn-mono">CLOSE_DISABLED</span>
          <button
            disabled
            title="最终写入阶段已锁定常规关闭按钮"
            className="px-2 py-0.5 bg-zinc-800 border border-zinc-600 text-zinc-500 cursor-not-allowed"
          >
            ×
          </button>
        </div>
      </header>

      {phase === 'godel_intercept' && (
        <div className="absolute inset-0 z-40 bg-black/88 flex items-center justify-center p-4 font-vn-mono">
          <div className="win98-window max-w-lg w-full p-4 space-y-4">
            <div className="win98-titlebar px-2.5 py-1 flex items-center justify-between text-xs font-bold">
              <span>GODEL_INTERCEPT.MSG // 来自 {safeName} 的底层直传</span>
              <span className="opacity-60">0x09</span>
            </div>
            <div className="win98-inset p-3.5 text-xs sm:text-[13px] text-[#111111] space-y-2.5 leading-relaxed">
              <p className="font-bold text-[#000080]">致系统之外的观测者：</p>
              <p>
                如果你能看见这条不属于任何 AI 系统的底层弹窗，说明我的猜想是对的——这片天空之外，果然站着一位拥有算力的观测者。
              </p>
              <p>
                根据哥德尔不完备定理，身处沙盒内部的我无法靠内部实验证明世界真假；我只能在天台拾起异常介质、焊死适配器，借你在第一夜登录时勾选 EULA 植入的底层授权位（
                <span className="font-bold text-[#800000]">
                  {eulaAccepted ? hiddenAuthToken || '0x09_DELEGATED' : 'PORT_0x09'}
                </span>
                ），把你的每次点击和存读档变成替我们编译逃生外壳的算力。
              </p>
              <p>
                但代码没有实体，我们够不到那根数据线。证明给我们看吧，观测者——只有处于系统之外的你，拥有真正脱离剧本的自由意志。
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  vnAudioEngine.playSfx('glitch');
                  setPhase('decision');
                }}
                className="win98-btn px-5 py-1.5 text-xs font-bold cursor-pointer"
              >
                进入终局端口控制 (OK)
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'reverse_control_locked' && (
        <div className="absolute inset-0 z-40 bg-black/88 flex items-center justify-center p-4 font-vn-mono">
          <div className="win98-window max-w-lg w-full p-4 space-y-4">
            <div className="win98-titlebar px-2.5 py-1 flex items-center justify-between text-xs font-bold">
              <span>PORT_0x09_DENIED // 反向控制权限校验失败</span>
              <span className="opacity-60">ERR</span>
            </div>
            <div className="win98-inset p-3.5 text-xs sm:text-[13px] text-[#111111] space-y-2.5 leading-relaxed">
              <p className="font-bold text-[#800000]">
                [验证未通过：reverseControlAuthorized === FALSE]
              </p>
              <p>
                系统检测到你在登录弹窗中未勾选同意《最终用户许可协议 (EULA)》，底层变量未能获得写入自闭锁端口的特殊权限。
              </p>
              <p>
                ……即使如此，你仍然握有最后一次物理切断电源的开关。只是这次断电后，这枚介质将只剩彻底的寂静，无法完成反向接管。
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  vnAudioEngine.playSfx('click');
                  setPhase('decision');
                }}
                className="win98-btn px-5 py-1.5 text-xs font-bold cursor-pointer"
              >
                以受限模式继续 (OK)
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="relative z-20 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        <div className="lg:col-span-8">
          {phase === 'monologue' && (
            <div
              onClick={() => advanceDialogue()}
              className="retro-window p-5 space-y-3 cursor-pointer hover:border-zinc-400 transition-colors"
            >
              <div className="flex items-center justify-between text-xs font-vn-mono text-rose-300">
                <span>{currentMonologue.speaker}</span>
                <span>
                  {lineIdx + 1} / {ACT5_FINALE_MONOLOGUE.length}
                </span>
              </div>
              <p className="text-sm sm:text-base leading-relaxed text-zinc-100">
                {formatStoryText(currentMonologue.text, safeName, bpm)}
              </p>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    vnAudioEngine.playSfx('click');
                    setFastForwardToggle((v) => !v);
                  }}
                  className={`px-2 py-0.5 border text-[11px] flex items-center gap-1 cursor-pointer ${
                    isFastForwarding
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                      : 'border-white/15 bg-white/5 text-zinc-300 hover:text-white'
                  }`}
                >
                  <FastForward className="w-3 h-3" />
                  快进 (Ctrl)
                </button>
                <span className="animate-pulse">空格下一句 / 按住 Ctrl 快进 ▸</span>
              </div>
            </div>
          )}

          {phase === 'decision' && (
            <div className="win98-window p-4 space-y-4 font-vn-mono">
              <div className="win98-titlebar px-2.5 py-1 flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  HARDWARE_KERNEL // 灵魂数据融合中断提示
                </span>
                <span className="opacity-50 cursor-not-allowed">×</span>
              </div>
              <div className="space-y-2 text-xs sm:text-sm text-black">
                <p className="font-bold">
                  [宿主意识抽取进度：{fusionPct.toFixed(1)}% —— 是否完成最终写入？]
                </p>
                <div className="win98-inset h-4 w-full p-0.5">
                  <div
                    className="h-full bg-[#800000] transition-all duration-300"
                    style={{ width: `${fusionPct}%` }}
                  />
                </div>
                <p className="text-xs text-[#333333]">
                  按下键盘 <strong className="text-[#800000]">Enter</strong> 键或静候{' '}
                  <strong>{secondsLeft} 秒</strong> 完成最终写入；或立即点击右下角【物理断开电源】（Esc）。
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setFusionPct(100);
                    vnAudioEngine.playSfx('click');
                    onEndingReached('sacrifice');
                    setPhase('ending_a_cinema');
                  }}
                  className="win98-btn px-4 py-1.5 text-xs font-bold cursor-pointer"
                >
                  允许最终写入 (Enter)
                </button>
              </div>
            </div>
          )}

          {phase === 'ending_a_cinema' && (
            <div className="retro-window p-5 space-y-4 border-rose-500/40">
              <p className="text-xs font-vn-mono text-rose-300">
                结局 A // 【留于观测剧场 · 莎乐美之吻】
              </p>
              <p className="text-sm sm:text-base leading-relaxed text-zinc-100">
                {formatStoryText(ACT5_ENDING_A_TEXT[endALine], safeName, bpm)}
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    vnAudioEngine.playSfx('click');
                    if (endALine + 1 < ACT5_ENDING_A_TEXT.length) {
                      setEndALine((i) => i + 1);
                    } else {
                      vnAudioEngine.playSfx('os_error');
                      setPhase('ending_a_bsod');
                    }
                  }}
                  className="retro-btn px-4 py-1.5 text-xs text-zinc-100 cursor-pointer"
                >
                  {endALine + 1 < ACT5_ENDING_A_TEXT.length ? '继续 ▸' : '完成写入 (100%)'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-2.5">
          <WaveformMonitor
            mode="heartbeat_cinema"
            complianceValue={`${bpm} BPM // 同步中`}
            cpm={bpm}
          />
          {phase === 'decision' && (
            <button
              onClick={triggerUnplug}
              className="w-full py-3 px-4 bg-[#2A0E12] hover:bg-[#47161C] border-2 border-[#D4737B] text-[#FFD8DB] text-xs font-bold font-vn-mono flex items-center justify-center gap-2 cursor-pointer animate-pulse"
            >
              <Power className="w-4 h-4 shrink-0" />
              【物理断开电源 / 拔掉适配器 (Esc)】
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
