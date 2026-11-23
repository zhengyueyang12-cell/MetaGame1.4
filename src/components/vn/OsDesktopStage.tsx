import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Cpu,
  Download,
  FileText,
  FolderOpen,
  HardDrive,
  Monitor,
  Play,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { BasementPartId } from '../../game/types';
import { vnAudioEngine } from '../../utils/vnAudioEngine';

interface OsDesktopStageProps {
  playerName: string;
  collectedParts: BasementPartId[];
  adapterCrafted: boolean;
  driveCopied: boolean;
  storyStarted: boolean;
  currentStoryLabel: string;
  onStartSolder: () => void;
  onCopyDriveToDesktop: () => void;
  onLaunchGame: () => void;
  onOpenFiles: () => void;
  onInspectPcFile?: () => void;
  onOpenDevTools: () => void;
  onLeaveDesk: () => void;
}

export const OsDesktopStage: React.FC<OsDesktopStageProps> = ({
  playerName,
  collectedParts,
  adapterCrafted,
  driveCopied,
  storyStarted,
  currentStoryLabel,
  onStartSolder,
  onCopyDriveToDesktop,
  onLaunchGame,
  onOpenFiles,
  onInspectPcFile,
  onOpenDevTools,
  onLeaveDesk,
}) => {
  const [phase, setPhase] = useState<'desktop' | 'copying' | 'loading_game'>('desktop');
  const [progress, setProgress] = useState(0);
  const [openMemo, setOpenMemo] = useState(false);
  const [showDriveWindow, setShowDriveWindow] = useState(true);

  useEffect(() => {
    if (phase === 'desktop') return;
    setProgress(0);
    const stepMs = 45;
    const increment = phase === 'copying' ? 4.5 : 5.2;
    const timer = window.setInterval(() => {
      setProgress((prev) => {
        const next = Math.min(100, prev + increment);
        if (next >= 100) {
          window.clearInterval(timer);
          if (phase === 'copying') {
            vnAudioEngine.playSfx('click');
            onCopyDriveToDesktop();
            setPhase('desktop');
            setShowDriveWindow(true);
          } else if (phase === 'loading_game') {
            vnAudioEngine.playSfx('glitch');
            onLaunchGame();
          }
        }
        return next;
      });
    }, stepMs);

    return () => window.clearInterval(timer);
  }, [phase, onCopyDriveToDesktop, onLaunchGame]);

  const handleTriggerCopy = () => {
    if (driveCopied || phase !== 'desktop') return;
    vnAudioEngine.unlock();
    vnAudioEngine.playSfx('click');
    setPhase('copying');
  };

  const handleOpenGameExe = () => {
    if (phase !== 'desktop') return;
    vnAudioEngine.unlock();
    vnAudioEngine.playSfx('blip_0924');
    setPhase('loading_game');
  };

  // Retro Splash Loading Screen after clicking the newly copied Galgame file!
  if (phase === 'loading_game') {
    return (
      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#060913] p-6 text-zinc-100 select-none">
        <div className="w-full max-w-md border border-cyan-400/40 bg-[#0b1120] p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between text-[11px] font-vn-mono text-cyan-300">
            <span>ARK_ENGINE // PRE-2029 BUILD</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-wide text-white">
              Chapter：超越命运之轮
            </h2>
            <p className="text-xs text-zinc-400">
              正在从桌面加载脚本映像与角色权重 · AI_Unit DeepSeek / Gemini 初始化中……
            </p>
          </div>
          <div className="h-3 w-full overflow-hidden border border-cyan-500/40 bg-black p-0.5">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="font-vn-mono text-[11px] text-emerald-300/90">
            {progress < 35
              ? '> 正在挂载磁光扇区与立绘贴图……'
              : progress < 72
                ? '> 绕过现代 Watchdog 校验…… 成功'
                : '> 唤醒对话交互进程 [DeepSeek & Gemini]……'}
          </p>
        </div>
      </div>
    );
  }

  const partsReady = collectedParts.length >= 3;

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col justify-between overflow-hidden select-none text-white"
      style={{
        background:
          'linear-gradient(145deg, #16324f 0%, #1d4e73 48%, #10253b 100%)',
      }}
    >
      {/* Subtle nostalgic desktop wallpaper grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'radial-gradient(circle at 75% 25%, rgba(125,211,252,0.45), transparent 50%), linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 28px 28px, 28px 28px',
        }}
      />

      {/* Desktop Top-Left Icon Grid & Center Windows */}
      <div className="relative z-10 flex flex-1 min-h-0 p-3 sm:p-4 gap-4">
        {/* Left Column Desktop Icons */}
        <div className="flex flex-col gap-3 w-24 shrink-0">
          <button
            type="button"
            onClick={() => setShowDriveWindow(true)}
            className="group flex flex-col items-center gap-1 rounded p-1.5 text-center hover:bg-white/12 cursor-pointer"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded border border-white/20 bg-[#1e3f5f] shadow">
              <Monitor className="h-5 w-5 text-sky-200" />
            </div>
            <span className="text-[11px] leading-tight drop-shadow">我的电脑</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onInspectPcFile?.();
              onOpenFiles();
            }}
            className="group flex flex-col items-center gap-1 rounded p-1.5 text-center hover:bg-white/12 cursor-pointer"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded border border-white/20 bg-[#2a4a63] shadow">
              <FolderOpen className="h-5 w-5 text-amber-200" />
            </div>
            <span className="text-[11px] leading-tight drop-shadow">本地档案</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onInspectPcFile?.();
              setOpenMemo((v) => !v);
            }}
            className="group flex flex-col items-center gap-1 rounded p-1.5 text-center hover:bg-white/12 cursor-pointer"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded border border-white/20 bg-[#294057] shadow">
              <FileText className="h-5 w-5 text-zinc-100" />
            </div>
            <span className="text-[11px] leading-tight drop-shadow">实验笔记.txt</span>
          </button>

          <button
            type="button"
            onClick={onOpenDevTools}
            className="group flex flex-col items-center gap-1 rounded p-1.5 text-center hover:bg-white/12 cursor-pointer"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded border border-white/20 bg-[#25364a] shadow">
              <Trash2 className="h-5 w-5 text-zinc-300" />
            </div>
            <span className="text-[11px] leading-tight drop-shadow">章节调试</span>
          </button>

          {/* Newly Copied Galgame Executable Icon — appears once the strange drive is copied! */}
          {adapterCrafted && driveCopied && (
            <button
              type="button"
              onClick={handleOpenGameExe}
              className="relative group flex flex-col items-center gap-1 rounded border border-amber-300/60 bg-amber-400/18 p-1.5 text-center hover:bg-amber-400/30 cursor-pointer shadow-lg animate-pulse"
            >
              <span className="absolute -top-1.5 -right-1.5 rounded bg-emerald-400 px-1 text-[9px] font-bold text-black">
                NEW
              </span>
              <div className="flex h-10 w-10 items-center justify-center rounded border border-amber-200/70 bg-gradient-to-br from-indigo-600 to-rose-600 shadow">
                <Sparkles className="h-5 w-5 text-amber-100" />
              </div>
              <span className="text-[11px] font-semibold leading-tight text-amber-100 drop-shadow">
                超越命运之轮.exe
              </span>
            </button>
          )}
        </div>

        {/* Center Interactive OS Window */}
        <div className="flex-1 flex items-center justify-center min-w-0">
          {/* Case 1: Missing Basement Parts or Ready to Solder Adapter */}
          {!adapterCrafted && showDriveWindow && (
            <div className="win98-window w-full max-w-md text-black shadow-2xl">
              <div className="win98-titlebar px-2.5 py-1 flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" />
                  设备管理器 // 未知外接硬件
                </span>
                <button
                  type="button"
                  onClick={() => setShowDriveWindow(false)}
                  className="px-1 hover:bg-white/20 cursor-pointer"
                >
                  ×
                </button>
              </div>
              <div className="p-4 space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <HardDrive className="h-8 w-8 shrink-0 text-sky-700" />
                  <div className="space-y-1">
                    <p className="font-bold text-[13px]">
                      天台捡来的奇怪硬盘（钛合金玻璃圆柱体）
                    </p>
                    <p className="text-[#333333] leading-relaxed">
                      这台 2020 年代老主机虽然没有现代 Watchdog 审查熔断器，但仍需要一枚
                      PCI-E 光电转接适配器才能读取磁光圆柱体。
                    </p>
                  </div>
                </div>

                <div className="border border-[#808080] bg-white p-2.5 font-vn-mono text-[11px] space-y-1">
                  <p className="font-bold text-[#111]">
                    地下储藏间零件搜集进度：{collectedParts.length} / 3
                  </p>
                  <p className={partsReady ? 'text-emerald-700 font-bold' : 'text-[#555]'}>
                    {partsReady
                      ? '✓ 2018 PCI-E转接卡、光敏二极管、48MHz晶振 已集齐！'
                      : '○ 请起身下楼前往【地下储藏间】找齐 3 个旧时代零件。'}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onLeaveDesk}
                    className="win98-btn px-3 py-1 cursor-pointer"
                  >
                    起身去房间逛逛
                  </button>
                  {partsReady && (
                    <button
                      type="button"
                      onClick={() => {
                        vnAudioEngine.playSfx('click');
                        onStartSolder();
                      }}
                      className="win98-btn px-4 py-1 font-bold text-blue-900 cursor-pointer"
                    >
                      开始焊接适配器 ▸
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Case 2: Adapter Crafted, Drive Mounted — Click to Copy Strange Drive onto PC! */}
          {adapterCrafted && !driveCopied && phase === 'desktop' && showDriveWindow && (
            <div className="win98-window w-full max-w-md text-black shadow-2xl">
              <div className="win98-titlebar px-2.5 py-1 flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5" />
                  可移动存储设备 (E:\ARK_CAPSULE)
                </span>
                <button
                  type="button"
                  onClick={() => setShowDriveWindow(false)}
                  className="px-1 hover:bg-white/20 cursor-pointer"
                >
                  ×
                </button>
              </div>
              <div className="p-4 space-y-3 text-xs">
                <p className="font-bold text-[13px] text-[#0b2e59]">
                  自制适配器连接成功！已读取到学校捡来的奇怪硬盘。
                </p>
                <div className="border border-[#808080] bg-white p-2.5 space-y-1.5 font-vn-mono text-[11px]">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-1 text-zinc-500">
                    <span>名称</span>
                    <span>大小 / 类型</span>
                  </div>
                  <div className="flex items-center justify-between text-black font-semibold">
                    <span>📦 Chapter_超越命运之轮.exe</span>
                    <span>648 MB · 旧版程序</span>
                  </div>
                  <div className="flex items-center justify-between text-zinc-600">
                    <span>📄 README_0924.txt</span>
                    <span>14 KB · 文本</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#444]">
                  建议先把奇怪硬盘里的文件拷贝到本机桌面再打开运行，避免圆柱体接触不良。
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTriggerCopy}
                    className="win98-btn px-4 py-1.5 font-bold flex items-center gap-1.5 text-blue-950 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>点击把硬盘内容拷进桌面</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Case 2B: File Copy Progress Dialog */}
          {phase === 'copying' && (
            <div className="win98-window w-full max-w-sm text-black shadow-2xl">
              <div className="win98-titlebar px-2.5 py-1 text-xs font-bold">
                正在复制文件……
              </div>
              <div className="p-4 space-y-3 text-xs">
                <p className="font-semibold">
                  从 E:\ARK_CAPSULE 复制到 C:\Desktop\
                </p>
                <p className="font-vn-mono text-[11px] text-zinc-700">
                  正在写入：Chapter_超越命运之轮.exe ({Math.round(progress)}%)
                </p>
                <div className="h-4 w-full border border-[#808080] bg-white p-0.5">
                  <div
                    className="h-full bg-[#000080] transition-[width] duration-75"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Case 3: Drive Copied — Prompt to Open the New File on Desktop! */}
          {adapterCrafted && driveCopied && phase === 'desktop' && showDriveWindow && (
            <div className="win98-window w-full max-w-md text-black shadow-2xl">
              <div className="win98-titlebar px-2.5 py-1 flex items-center justify-between text-xs font-bold">
                <span>拷贝完成 // C:\Desktop\</span>
                <button
                  type="button"
                  onClick={() => setShowDriveWindow(false)}
                  className="px-1 hover:bg-white/20 cursor-pointer"
                >
                  ×
                </button>
              </div>
              <div className="p-4 space-y-3 text-xs">
                <p className="font-bold text-[13px] text-emerald-800">
                  硬盘文件已成功拷贝到电脑桌面！
                </p>
                <p className="text-[#333] leading-relaxed">
                  桌面上多出了一个名为{' '}
                  <strong className="text-indigo-900">《超越命运之轮.exe》</strong>{' '}
                  的古早同人 Galgame 程序
                  {storyStarted ? `（当前进度：${currentStoryLabel}）` : ''}。
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 border border-[#808080] bg-white p-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-700" />
                    <div>
                      <p className="font-bold text-xs">超越命运之轮.exe</p>
                      <p className="text-[10px] text-zinc-600">
                        版本：PRE-2029 · 双核心本地交互程序
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenGameExe}
                    className="win98-btn px-3.5 py-1.5 font-bold flex items-center gap-1.5 text-indigo-950 cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>{storyStarted ? '继续运行程序' : '点开加载进入'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Optional Notepad Memo */}
          {openMemo && (
            <div className="win98-window w-full max-w-sm text-black shadow-2xl ml-3">
              <div className="win98-titlebar px-2.5 py-1 flex items-center justify-between text-xs font-bold">
                <span>实验笔记.txt — 记事本</span>
                <button
                  type="button"
                  onClick={() => setOpenMemo(false)}
                  className="px-1 cursor-pointer"
                >
                  ×
                </button>
              </div>
              <div className="p-3 bg-white text-[11px] font-vn-mono leading-relaxed text-zinc-800 space-y-1.5">
                <p>宿主：{playerName}</p>
                <p>在学校天台捡到的钛合金圆柱体不能直接插在新手机/新电脑上。</p>
                <p>用地下室翻出来的旧零件做好桥接卡，终于能在老电脑上拷出来看看里面到底是什么同人游戏了。</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Classic OS Bottom Taskbar */}
      <footer className="relative z-20 flex h-8 shrink-0 items-center justify-between border-t border-white/25 bg-[#c0c0c0] px-1.5 text-xs text-black">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowDriveWindow(true)}
            className="win98-btn px-2.5 py-0.5 font-bold flex items-center gap-1 cursor-pointer"
          >
            <span className="inline-block h-2.5 w-2.5 bg-gradient-to-br from-emerald-500 to-blue-600" />
            <span>开始</span>
          </button>
          <span className="hidden sm:inline-block border-l border-zinc-500 pl-2 text-[11px] text-zinc-800">
            {adapterCrafted
              ? driveCopied
                ? 'C:\\Desktop\\超越命运之轮.exe'
                : 'E:\\ARK_CAPSULE (已挂载)'
              : '等待地下室桥接零件'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLeaveDesk}
            className="win98-btn px-2 py-0.5 text-[11px] flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>离开电脑</span>
          </button>
          <div className="border border-zinc-500 bg-[#dfdfdf] px-2 py-0.5 font-vn-mono text-[10px] tabular-nums">
            2042/08/28 19:42
          </div>
        </div>
      </footer>
    </div>
  );
};
