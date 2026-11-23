import {
  Archive,
  Backpack,
  BookOpen,
  Cpu,
  Eye,
  EyeOff,
  FolderOpen,
  Image as ImageIcon,
  Monitor,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';
import type {
  BasementPartId,
  BasementQuestItemId,
  HitFeedbackPayload,
  InteractResult,
  InventorySnapshot,
  MainQuestStage,
  RoomId,
  ViewMode,
} from '../game/types';

interface HudOverlayProps {
  currentRoom: { id: RoomId; label: string };
  viewMode: ViewMode;
  hoverTarget: { label: string; actionLabel: string } | null;
  inspectMessage: InteractResult | null;
  discoveredClues: number;
  totalClues: number;
  collectedParts: BasementPartId[];
  adapterCrafted: boolean;
  mainQuestStage: MainQuestStage;
  collectedQuestItems: BasementQuestItemId[];
  currentStoryLabel: string;
  realityAlert: string | null;
  isPointerLocked: boolean;
  dockCollapsed: boolean;
  contextLost: boolean;
  onToggleDock: () => void;
  onSelectRoom: (room: RoomId) => void;
  onSelectViewMode: (mode: ViewMode) => void;
  onDismissInspect: () => void;
  onDismissRealityAlert: () => void;
  onOpenComputer: () => void;
  onOpenDevTools: () => void;
  onOpenFiles: () => void;
  onOpenGallery: () => void;
  inventory: InventorySnapshot;
  hitFeedback: HitFeedbackPayload | null;
  onOpenInventory: () => void;
  onOpenSettings: () => void;
  onSwitchAmmo: () => void;
  onOpenPaperNote: () => void;
}

const PART_ITEMS: { id: BasementPartId; shortLabel: string }[] = [
  { id: 'part_pcie_card', shortLabel: 'PCI-E卡' },
  { id: 'part_photodiode', shortLabel: '光敏管' },
  { id: 'part_oscillator', shortLabel: '晶振' },
];

const QUEST_ITEMS: { id: BasementQuestItemId; shortLabel: string }[] = [
  { id: 'quest_keepsake', shortLabel: '信物' },
  { id: 'quest_battery', shortLabel: '电池' },
];

// Shared compact semi-transparent panel style with crisp outer border stroke
const PANEL_CLS =
  'rounded-lg border border-white/25 bg-[#150f22]/52 shadow-[0_4px_18px_rgba(8,4,16,0.32)]';

export function HudOverlay({
  currentRoom,
  viewMode,
  hoverTarget,
  inspectMessage,
  discoveredClues,
  totalClues,
  collectedParts,
  adapterCrafted,
  mainQuestStage,
  collectedQuestItems,
  currentStoryLabel,
  realityAlert,
  isPointerLocked,
  dockCollapsed,
  contextLost,
  onToggleDock,
  onSelectRoom,
  onSelectViewMode,
  onDismissInspect,
  onDismissRealityAlert,
  onOpenComputer,
  onOpenDevTools,
  onOpenFiles,
  onOpenGallery,
  inventory,
  hitFeedback,
  onOpenInventory,
  onOpenSettings,
  onSwitchAmmo,
  onOpenPaperNote,
}: HudOverlayProps) {
  const partsReady = collectedParts.length >= 3;
  const equippedItem =
    inventory.equippedSlot !== null ? inventory.slots[inventory.equippedSlot] ?? null : null;
  const ownedItemCount = inventory.slots.filter(Boolean).length;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-2.5 sm:p-3">
      {/* Top Row: One-Click Collapse Button + Compact Translucent Status & Utility Strips */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-start gap-1.5">
          {/* Master One-Click Fold/Unfold Toggle (always accessible in top-left) */}
          <button
            type="button"
            onClick={onToggleDock}
            title="一键折叠 / 展开界面 (快捷键 H)"
            className={`pointer-events-auto flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-[#f1e7fc] transition-colors hover:bg-[#1f1633]/75 hover:border-white/40 cursor-pointer whitespace-nowrap ${PANEL_CLS}`}
          >
            {dockCollapsed ? (
              <>
                <Eye className="h-3 w-3 text-[#ffb88c]" />
                <span>展开界面 [H]</span>
              </>
            ) : (
              <>
                <EyeOff className="h-3 w-3 text-[#cbb8de]" />
                <span>折叠 [H]</span>
              </>
            )}
          </button>

          {!dockCollapsed && (
            <div className={`pointer-events-auto px-2.5 py-1.5 max-w-md ${PANEL_CLS}`}>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#e6daf3] tabular-nums">
                <span className="font-semibold text-[#ffb88c]">{currentRoom.label}</span>
                <span className="text-white/30">·</span>
                <span>
                  线索 {discoveredClues}/{totalClues}
                </span>
                <span className="text-white/30 hidden sm:inline">·</span>
                <span className="hidden sm:inline text-[#cbb8de]/90">
                  F 互动 · B 背包与设置 · Q 装备 · 滚轮切换
                </span>
              </div>

              {/* Phase 1 Mainline Story Objective Row */}
              <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-white/15 pt-1 text-[10.5px]">
                <Sparkles className="h-3 w-3 shrink-0 text-[#ff9ec7]" />
                {mainQuestStage === 'open_pc_files' && (
                  <>
                    <span className="text-[#ffe2f0]">① 打开卧室电脑文件</span>
                    <button
                      type="button"
                      onClick={onOpenComputer}
                      className="ml-auto rounded border border-[#ff9ec7]/45 bg-[#ff8fbf]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#ffd8ea] hover:bg-[#ff8fbf]/35 cursor-pointer whitespace-nowrap"
                    >
                      打开电脑
                    </button>
                  </>
                )}
                {mainQuestStage === 'find_basement_items' && (
                  <>
                    <span className="text-[#ffe2f0]">② 地下室寻信物与电池</span>
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      {QUEST_ITEMS.map((item) => {
                        const got = collectedQuestItems.includes(item.id);
                        return (
                          <span
                            key={item.id}
                            className={got ? 'text-emerald-300' : 'text-[#cbb8de]'}
                          >
                            {got ? '✓' : '○'}
                            {item.shortLabel}
                          </span>
                        );
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectRoom('basement')}
                      className="ml-auto rounded border border-[#ff9ec7]/45 bg-[#ff8fbf]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#ffd8ea] hover:bg-[#ff8fbf]/35 cursor-pointer whitespace-nowrap"
                    >
                      去地下室
                    </button>
                  </>
                )}
                {mainQuestStage === 'activate_basement_terminal' && (
                  <>
                    <span className="text-emerald-200">③ 启动地下室实验终端 [F]</span>
                    <button
                      type="button"
                      onClick={() => onSelectRoom('basement')}
                      className="ml-auto rounded border border-emerald-300/45 bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-100 hover:bg-emerald-500/35 cursor-pointer whitespace-nowrap"
                    >
                      地下室终端
                    </button>
                  </>
                )}
                {mainQuestStage === 'return_to_bedroom' && (
                  <>
                    <span className="text-[#ffd2b5] font-medium">④ 返回卧室查看床边</span>
                    <button
                      type="button"
                      onClick={() => onSelectRoom('bedroom')}
                      className="ml-auto rounded border border-[#ffd2b5]/55 bg-[#ffb085]/85 px-1.5 py-0.5 text-[10px] font-semibold text-[#1c132b] hover:bg-[#ffc3a1] cursor-pointer whitespace-nowrap"
                    >
                      回卧室
                    </button>
                  </>
                )}
              </div>

              {/* Compact Adapter Parts / Host Progress Line */}
              <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-white/15 pt-1 text-[10.5px]">
                <Cpu className="h-3 w-3 shrink-0 text-[#ffb88c]" />
                {!adapterCrafted ? (
                  <>
                    <span className="text-[#e6daf3]">零件 {collectedParts.length}/3</span>
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      {PART_ITEMS.map((part) => {
                        const got = collectedParts.includes(part.id);
                        return (
                          <span
                            key={part.id}
                            className={got ? 'text-emerald-300' : 'text-[#b7a5cc]'}
                          >
                            {got ? '✓' : '○'}
                            {part.shortLabel}
                          </span>
                        );
                      })}
                    </span>
                    {!partsReady ? (
                      <button
                        type="button"
                        onClick={() => onSelectRoom('basement')}
                        className="ml-auto rounded border border-[#ffb88c]/40 bg-[#ffb085]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#ffd0b0] hover:bg-[#ffb085]/35 cursor-pointer whitespace-nowrap"
                      >
                        去地下室
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onOpenComputer}
                        className="ml-auto rounded border border-[#ffd2b5]/50 bg-[#ffb085]/85 px-1.5 py-0.5 text-[10px] font-semibold text-[#1c132b] hover:bg-[#ffc3a1] cursor-pointer whitespace-nowrap"
                      >
                        去卧室开机
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-emerald-300 font-medium">已接入主机</span>
                    <span className="text-[#d6c7e8] truncate max-w-[150px]">
                      {currentStoryLabel}
                    </span>
                    <button
                      type="button"
                      onClick={onOpenComputer}
                      className="ml-auto flex items-center gap-1 rounded border border-[#ffd2b5]/45 bg-[#ffb085]/85 px-1.5 py-0.5 text-[10px] font-semibold text-[#1c132b] hover:bg-[#ffc3a1] cursor-pointer whitespace-nowrap"
                    >
                      <Monitor className="h-2.5 w-2.5" />
                      <span>电脑</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Top-Right Compact Utility Buttons */}
        {!dockCollapsed && (
          <div className={`pointer-events-auto flex flex-wrap items-center gap-1 p-1 ${PANEL_CLS}`}>
            <button
              type="button"
              onClick={onOpenInventory}
              className="flex items-center gap-1 rounded border border-white/15 bg-white/8 px-2 py-1 text-[11px] font-medium text-[#f2eafc] transition-colors hover:bg-white/18 cursor-pointer whitespace-nowrap"
            >
              <Backpack className="h-3 w-3 text-[#7ee0c0]" />
              <span>背包[B]{ownedItemCount > 0 ? `(${ownedItemCount})` : ''}</span>
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-1 rounded border border-white/15 bg-white/8 px-2 py-1 text-[11px] font-medium text-[#f2eafc] transition-colors hover:bg-white/18 cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="h-3 w-3 text-[#ffd4a3]" />
              <span>设置</span>
            </button>
            <button
              type="button"
              onClick={onOpenDevTools}
              className="flex items-center gap-1 rounded border border-white/15 bg-white/8 px-2 py-1 text-[11px] font-medium text-[#f2eafc] transition-colors hover:bg-white/18 cursor-pointer whitespace-nowrap"
            >
              <BookOpen className="h-3 w-3 text-[#ffb88c]" />
              <span>跳章</span>
            </button>
            <button
              type="button"
              onClick={onOpenFiles}
              className="flex items-center gap-1 rounded border border-white/15 bg-white/8 px-2 py-1 text-[11px] font-medium text-[#f2eafc] transition-colors hover:bg-white/18 cursor-pointer whitespace-nowrap"
            >
              <FolderOpen className="h-3 w-3 text-emerald-300" />
              <span>档案</span>
            </button>
            <button
              type="button"
              onClick={onOpenGallery}
              className="flex items-center gap-1 rounded border border-white/15 bg-white/8 px-2 py-1 text-[11px] font-medium text-[#f2eafc] transition-colors hover:bg-white/18 cursor-pointer whitespace-nowrap"
            >
              <ImageIcon className="h-3 w-3 text-sky-300" />
              <span>记录</span>
            </button>
            {adapterCrafted && (
              <button
                type="button"
                onClick={onOpenComputer}
                className="flex items-center gap-1 rounded border border-[#b79dff]/40 bg-[#6b4eb0]/80 px-2 py-1 text-[11px] font-medium text-white hover:bg-[#7d5ec7] cursor-pointer whitespace-nowrap"
              >
                <Archive className="h-3 w-3" />
                <span>程序</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Center Reticle, Hitmarker & Compact Hover Prompt */}
      {viewMode === 'first-person' && !contextLost && (
        <div className="pointer-events-none fixed inset-0 flex flex-col items-center justify-center">
          <div className="relative flex items-center justify-center">
            {equippedItem?.id === 'toy_gun' && (
              <div
                className={`absolute h-5 w-5 rounded-full border transition-colors duration-150 ${
                  inventory.ammoType === 'dart'
                    ? 'border-[#ff8a5b]/70'
                    : 'border-[#7ee0c0]/80 border-dashed'
                }`}
              />
            )}

            {hitFeedback && (
              <svg
                key={hitFeedback.id}
                viewBox="0 0 36 36"
                className="absolute h-9 w-9 animate-ping"
                style={{ animationDuration: '280ms', animationIterationCount: 1 }}
                aria-hidden="true"
              >
                <g
                  stroke={
                    hitFeedback.kind === 'capture'
                      ? '#ffd98a'
                      : hitFeedback.kind === 'net'
                        ? '#7ee0c0'
                        : hitFeedback.kind === 'bounce'
                          ? '#ffe885'
                          : '#ff7744'
                  }
                  strokeWidth="2.6"
                  strokeLinecap="round"
                >
                  <line x1="6" y1="6" x2="13" y2="13" />
                  <line x1="30" y1="6" x2="23" y2="13" />
                  <line x1="6" y1="30" x2="13" y2="23" />
                  <line x1="30" y1="30" x2="23" y2="23" />
                </g>
              </svg>
            )}

            <div
              className={`h-1.5 w-1.5 rounded-full transition-transform duration-100 shadow-[0_0_4px_rgba(0,0,0,0.65)] ${
                hoverTarget
                  ? 'scale-150 bg-[#ffb88c] ring-2 ring-[#ffb88c]/55'
                  : equippedItem?.id === 'toy_gun'
                    ? inventory.ammoType === 'dart'
                      ? 'bg-[#ff8452]'
                      : 'bg-[#7ee0c0]'
                    : 'bg-white/85'
              }`}
            />
          </div>

          {hitFeedback?.label && (
            <div className="mt-2.5 rounded border border-white/25 bg-[#150f22]/65 px-2 py-0.5 text-[11px] font-medium text-[#ffe9d6]">
              {hitFeedback.label}
            </div>
          )}

          {hoverTarget && (
            <div className="mt-3 rounded-md border border-white/28 bg-[#150f22]/60 px-2.5 py-1 text-[11px] text-[#f8eefc]">
              <span className="font-mono font-semibold text-[#ffb88c]">[F]</span>{' '}
              <span>{hoverTarget.actionLabel}</span>
              <span className="mx-1 text-white/35">·</span>
              <span className="font-medium">{hoverTarget.label}</span>
            </div>
          )}
        </div>
      )}

      {/* Minimal Compact Equipped Item Chip (Bottom-Right) */}
      {viewMode === 'first-person' && !contextLost && equippedItem && (
        <div className={`pointer-events-auto fixed bottom-3 right-3 z-20 px-2.5 py-1.5 ${PANEL_CLS}`}>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-medium text-[#fff1e4]">{equippedItem.shortName}</span>
            {equippedItem.id === 'toy_gun' ? (
              <button
                type="button"
                onClick={onSwitchAmmo}
                className={`rounded border px-1.5 py-0.5 text-[10.5px] font-medium transition cursor-pointer ${
                  inventory.ammoType === 'dart'
                    ? 'border-[#ff8a5b]/60 bg-[#ff6f3c]/25 text-[#ffd8c2]'
                    : 'border-[#7ee0c0]/60 bg-[#73dfc0]/22 text-[#d4fff0]'
                }`}
              >
                {inventory.ammoType === 'dart' ? '吸盘镖' : '捕捉网'} [X]
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenPaperNote}
                className="rounded border border-[#f5e2c4]/45 bg-[#f6e8d2]/18 px-1.5 py-0.5 text-[10.5px] font-medium text-[#fff0d9] hover:bg-[#f6e8d2]/30 cursor-pointer"
              >
                展开字条
              </button>
            )}
            <span className="text-[10px] text-[#cbb8de]">[Q]收起</span>
          </div>
        </div>
      )}

      {/* WebGL Context Lost Fallback Notice */}
      {contextLost && (
        <div className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-[#161024]/95">
          <div className="max-w-md rounded-xl border border-white/25 bg-[#201733] p-6 text-center">
            <p className="text-base font-semibold text-[#f8eefc]">3D 渲染上下文已暂停</p>
            <p className="mt-2 text-xs text-[#cbb8de]">
              浏览器正在恢复 WebGL 渲染资源，请稍候或刷新页面。
            </p>
          </div>
        </div>
      )}

      {/* Bottom Area: Clean Toasts + Subtle Pointer-Lock / Overview Hint Only */}
      <div className="flex flex-col items-center gap-1.5">
        {realityAlert && (
          <div className="pointer-events-auto w-full max-w-md rounded-lg border border-rose-300/45 bg-[#211022]/70 px-3 py-1.5 shadow-lg">
            <div className="flex items-center justify-between gap-2 text-[11px] text-rose-100">
              <div className="flex items-center gap-1.5 min-w-0">
                <Zap className="h-3.5 w-3.5 shrink-0 text-[#ff85a3]" />
                <span className="truncate sm:whitespace-normal">
                  <strong className="text-[#ff85a3] mr-1">[同步]</strong>
                  {realityAlert}
                </span>
              </div>
              <button
                type="button"
                onClick={onDismissRealityAlert}
                className="shrink-0 rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-rose-200/90 hover:bg-white/15 cursor-pointer"
              >
                确认
              </button>
            </div>
          </div>
        )}

        {inspectMessage && (
          <div
            className={`pointer-events-auto w-full max-w-md px-3.5 py-2.5 ${PANEL_CLS} bg-[#150f22]/72`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[#ffbe94]">{inspectMessage.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[#f2eafc]">
                  {inspectMessage.message}
                </p>
              </div>
              <button
                type="button"
                onClick={onDismissInspect}
                className="shrink-0 rounded border border-white/20 px-1.5 py-0.5 text-[10.5px] text-[#d5c5ea] hover:bg-white/15 hover:text-white cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        )}

        {viewMode === 'overview' && !contextLost && (
          <button
            type="button"
            onClick={() => onSelectViewMode('first-person')}
            className={`pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 text-[11.5px] font-medium text-[#f8eefc] hover:bg-[#24193b]/80 transition cursor-pointer ${PANEL_CLS}`}
          >
            <Eye className="h-3.5 w-3.5 text-[#ffb88c]" />
            <span>公寓俯瞰模式 · 点击返回第一人称</span>
          </button>
        )}

        {viewMode === 'first-person' && !isPointerLocked && !contextLost && !inspectMessage && (
          <div className="pointer-events-none rounded-md border border-white/18 bg-[#150f22]/52 px-3 py-1 text-[11px] text-[#e6daf3]/90">
            点击画面锁定鼠标视角 · <span className="text-[#ffd2b5]">ESC</span> 解锁 ·{' '}
            <span className="text-[#ffd2b5]">B</span> 背包与设置
          </div>
        )}
      </div>
    </div>
  );
}
