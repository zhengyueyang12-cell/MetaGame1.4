import React, { useState } from 'react';
import { ArrowLeft, Check, Cpu, Flame, Monitor, Zap } from 'lucide-react';
import { BUREAU_ASSETS } from '../../data/bureauScript';
import { vnAudioEngine } from '../../utils/vnAudioEngine';

interface CircuitSolderGameProps {
  playerName: string;
  onComplete: () => void;
  onLeaveDesk: () => void;
}

interface SolderNode {
  id: string;
  name: string;
  pinLabel: string;
  desc: string;
}

const NODES: SolderNode[] = [
  {
    id: 'pcie_adapter',
    name: '2018 旧式 PCI-E 转接卡',
    pinLabel: 'PIN_A1 // DATA_BUS',
    desc: '来自地下室货架 1 号位 · 不含 2042 看门狗物理熔断芯片，可直连老主板北桥总线。',
  },
  {
    id: 'photodiode',
    name: '高灵敏度光敏二极管',
    pinLabel: 'PIN_B4 // OPTIC_BRIDGE',
    desc: '来自地下室货架 3 号位 · 用于读取钛合金玻璃圆柱体内部微米级磁光涂层反射信号。',
  },
  {
    id: 'oscillator',
    name: '48MHz 时钟晶振与逻辑芯片',
    pinLabel: 'PIN_C7 // CLK_SYNC',
    desc: '来自地下室 CRT 检修台 · 将介质脉冲与 CRT 显像管刷新节拍强行对齐锁定。',
  },
];

export const CircuitSolderGame: React.FC<CircuitSolderGameProps> = ({
  playerName,
  onComplete,
  onLeaveDesk,
}) => {
  const [soldered, setSoldered] = useState<Set<string>>(() => new Set());
  const [smokeKey, setSmokeKey] = useState(0);
  const [bootPhase, setBootPhase] = useState<'solder' | 'booting' | 'win98_popup'>('solder');

  const allDone = soldered.size === NODES.length;

  const handleSolder = (id: string) => {
    if (soldered.has(id)) return;
    vnAudioEngine.unlock();
    vnAudioEngine.playSfx('solder_sizzle');
    setSmokeKey((k) => k + 1);
    setSoldered((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handlePowerOnPC = () => {
    vnAudioEngine.playSfx('glitch');
    setBootPhase('booting');
    window.setTimeout(() => {
      vnAudioEngine.playSfx('os_error');
      setBootPhase('win98_popup');
    }, 1450);
  };

  return (
    <div className="absolute inset-0 z-40 h-full w-full overflow-hidden bg-[#06070A] text-zinc-100 flex flex-col justify-between">
      <img
        src={BUREAU_ASSETS.backgrounds.apartment_morning}
        alt="Student Apartment Midnight DIY"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover brightness-[0.26] contrast-125 saturate-50 transition-all duration-700"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-[#050608]/60 to-[#050608]/85" />

      <header className="relative z-10 px-4 py-2 flex items-center justify-between border-b border-white/10 bg-black/55">
        <div className="flex items-center gap-2 text-xs font-vn-mono text-zinc-300 truncate">
          <Flame className="w-3.5 h-3.5 shrink-0 text-amber-300" />
          <span className="truncate">卧室书桌 DIY 适配器焊接台（地下室零件已就位）</span>
        </div>
        <button
          onClick={onLeaveDesk}
          className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-[11px] text-zinc-200 flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-3 h-3" />
          离开书桌
        </button>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center p-3 md:p-4 overflow-y-auto">
        {bootPhase === 'solder' && (
          <div className="w-full max-w-4xl bg-[#0D1016]/96 border border-zinc-700 p-4 md:p-5 space-y-4 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-amber-300" />
                  自制光电脉冲转接适配器 · 焊点拼接
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  你已从地下室集齐 3 个旧零件。请依次焊接到卡槽上，制成读取学校捡来硬盘的转接器并插上电脑。
                </p>
              </div>
              <span className="font-vn-mono text-xs px-3 py-1 bg-black/65 border border-zinc-700 text-amber-300 tabular-nums">
                焊点导通率：{Math.round((soldered.size / NODES.length) * 100)}%
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {NODES.map((node) => {
                const done = soldered.has(node.id);
                return (
                  <button
                    key={node.id}
                    onClick={() => handleSolder(node.id)}
                    className={`text-left p-4 border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      done
                        ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-100'
                        : 'bg-zinc-900/90 border-zinc-700 hover:border-amber-400/70 text-zinc-200'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-vn-mono text-[11px] text-amber-300/90">
                          {node.pinLabel}
                        </span>
                        {done ? (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Zap className="w-4 h-4 text-zinc-500 shrink-0" />
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white">{node.name}</h3>
                      <p className="text-xs text-zinc-400 leading-relaxed">{node.desc}</p>
                    </div>
                    <span className="text-xs font-vn-mono">
                      {done ? '● 焊锡已凝固导通' : '○ 点击使用电烙铁焊接'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="p-4 bg-[#07090D] border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  key={smokeKey}
                  className={`w-12 h-12 border flex items-center justify-center shrink-0 transition-colors ${
                    allDone
                      ? 'bg-emerald-950/50 border-emerald-400 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-600 text-zinc-400'
                  }`}
                >
                  <Monitor className="w-6 h-6" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-vn-mono text-zinc-200">
                    插槽目标：学校天台捡来的奇怪硬盘（钛合金玻璃圆柱体）
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    {allDone
                      ? `所有引脚已对齐，宿主 ${playerName} 可接入卧室桌角古董主机并开机。`
                      : `还需焊接 ${NODES.length - soldered.size} 处引脚才能建立数据通信。`}
                  </p>
                </div>
              </div>
              <button
                disabled={!allDone}
                onClick={handlePowerOnPC}
                className={`px-5 py-2.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  allDone
                    ? 'bg-amber-500 hover:bg-amber-400 text-black cursor-pointer'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                插入适配器与硬盘并开机
              </button>
            </div>
          </div>
        )}

        {bootPhase === 'booting' && (
          <div className="w-full max-w-xl p-6 bg-black border-2 border-zinc-500 font-vn-mono text-xs space-y-3 text-emerald-300 animate-vn-shake">
            <p className="text-white font-bold">
              LEGACY BIOS // NO_WATCHDOG_CHIPSET (2020s ARCH)
            </p>
            <p>Memory Test : 8192M OK (NON-CENSORED HARDWARE)</p>
            <p className="text-amber-300">
              Detecting DIY PCI-E Bridge ... [PRE-2029 MAGNETO-OPTICAL CAPSULE]
            </p>
            <p className="text-rose-400 animate-pulse">
              &gt; 警告：机械硬盘发出尖锐啸叫，CRT 显像管闪过绿色雪花噪点……
            </p>
          </div>
        )}

        {bootPhase === 'win98_popup' && (
          <div className="win98-window w-full max-w-md font-vn-mono">
            <div className="win98-titlebar px-2.5 py-1 flex items-center justify-between text-xs font-bold">
              <span>未知光盘/硬盘映像 // 古早 Galgame 启动器</span>
              <span>×</span>
            </div>
            <div className="p-5 space-y-4 text-xs text-black">
              <p className="font-bold">
                系统检测到来自自制适配器端口的 2029 前旧版交互程序映像：《Chapter：超越命运之轮》。
              </p>
              <p className="text-[#333333] leading-relaxed">
                没有任何现代发行商审核印记的复古窗口强行占满了屏幕——两个似乎已被遗忘的过时 AI 少女，在屏幕另一侧苏醒了。
              </p>
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => {
                    vnAudioEngine.playSfx('click');
                    onComplete();
                  }}
                  className="win98-btn px-5 py-1.5 font-bold cursor-pointer"
                >
                  打开程序：进入《超越命运之轮》 (BOOT)
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
