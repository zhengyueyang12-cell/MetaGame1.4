import React, { useEffect } from 'react';
import {
  Backpack,
  BookOpen,
  Check,
  Crosshair,
  Eye,
  Lightbulb,
  Lock,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type {
  AtmosphereMode,
  InventoryItem,
  InventorySnapshot,
  PipelineSettings,
  RoomId,
  ToyGunAmmoType,
  ViewMode,
} from '../game/types';

export type InventoryModalTab = 'inventory' | 'settings';

interface InventoryModalProps {
  open: boolean;
  activeTab: InventoryModalTab;
  onTabChange: (tab: InventoryModalTab) => void;
  inventory: InventorySnapshot;
  currentRoom: { id: RoomId; label: string };
  viewMode: ViewMode;
  atmosphere: AtmosphereMode;
  settings: PipelineSettings;
  livingLightOn: boolean;
  isPointerLocked: boolean;
  onClose: () => void;
  onSelectSlot: (slotIndex: number) => void;
  onToggleEquip: (slotIndex: number) => void;
  onSwitchAmmo: (ammo: ToyGunAmmoType) => void;
  onOpenPaperNote: () => void;
  onSelectRoom: (room: RoomId) => void;
  onSelectViewMode: (mode: ViewMode) => void;
  onSelectAtmosphere: (mode: AtmosphereMode) => void;
  onToggleSetting: (key: Exclude<keyof PipelineSettings, 'brightness'>) => void;
  onChangeBrightness: (value: number) => void;
  onToggleLivingLight: () => void;
  onRequestPointerLock: () => void;
}

const ROOM_ITEMS: { id: RoomId; label: string }[] = [
  { id: 'living', label: '客厅' },
  { id: 'entryway', label: '玄关' },
  { id: 'dining', label: '餐厅' },
  { id: 'kitchen', label: '厨房' },
  { id: 'bedroom', label: '卧室' },
  { id: 'bathroom', label: '浴室' },
  { id: 'basement', label: '地下室' },
];

const ATMOSPHERE_ITEMS: { id: AtmosphereMode; label: string; desc: string }[] = [
  { id: 'daylight', label: '日光', desc: '晴朗自然漫射' },
  { id: 'sunset', label: '黄昏', desc: '琥珀暮紫余晖' },
  { id: 'midnight', label: '深夜', desc: '静谧室内灯影' },
  { id: 'meta', label: '异常', desc: '紫红信号侵蚀' },
];

const PIPELINE_TOGGLES: {
  key: Exclude<keyof PipelineSettings, 'brightness'>;
  label: string;
  desc: string;
}[] = [
  {
    key: 'celShading',
    label: '暮紫风格化着色',
    desc: '启用暖暗对比的阴影色阶与微颗粒质感',
  },
  {
    key: 'volumetricRays',
    label: '丁达尔体积光束',
    desc: '窗景斜射光束与空气尘埃散射效果',
  },
  {
    key: 'inkOutlines',
    label: '建筑与家具描边',
    desc: '柔和的手绘边缘轮廓线条增强层次',
  },
  {
    key: 'occlusionCulling',
    label: '房间遮挡剔除',
    desc: '按门廊视野动态剔除不可见房间以提升帧率',
  },
  {
    key: 'disablePostInNormal',
    label: '常规画面直出',
    desc: '跳过常规态后处理通道，获得更锐利的原生画面',
  },
  {
    key: 'audioEnabled',
    label: '空间环境音效',
    desc: '脚步声、门锁机械音与房间环境声场',
  },
];

function ItemGlyph({
  item,
  ammoType,
  large = false,
}: {
  item: InventoryItem;
  ammoType: ToyGunAmmoType;
  large?: boolean;
}) {
  const sizeClass = large ? 'w-20 h-20' : 'w-11 h-11';
  if (item.id === 'toy_gun') {
    return (
      <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
        <rect
          x="14"
          y="18"
          width="28"
          height="15"
          rx="6"
          fill="#73dfc0"
          stroke="#2d2033"
          strokeWidth="2.2"
        />
        <rect
          x="38"
          y="20"
          width="12"
          height="11"
          rx="3"
          fill="#73dfc0"
          stroke="#2d2033"
          strokeWidth="2.2"
        />
        <path
          d="M48 18 L57 15 L57 36 L48 33 Z"
          fill="#ff6736"
          stroke="#2d2033"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <rect
          x="19"
          y="13"
          width="18"
          height="6"
          rx="3"
          fill="#fff0a8"
          stroke="#2d2033"
          strokeWidth="2"
        />
        <path
          d="M22 33 L16 50 C15 53 19 55 23 54 L28 52 L31 33 Z"
          fill="#fff0a8"
          stroke="#2d2033"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M31 34 Q36 39 31 42"
          fill="none"
          stroke="#ff6736"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx="15" cy="25" r="4.5" fill="#ff6736" stroke="#2d2033" strokeWidth="1.8" />
        <rect
          x="27"
          y="20"
          width="11"
          height="11"
          rx="3"
          fill={ammoType === 'dart' ? 'rgba(255, 118, 66, 0.55)' : 'rgba(156, 240, 214, 0.65)'}
          stroke="#fffdf4"
          strokeWidth="1.6"
        />
        <circle cx="22" cy="25.5" r="2.6" fill="#ffe169" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" className={sizeClass} aria-hidden="true">
      <path
        d="M10 35 L54 14 L42 50 L29 39 Z"
        fill="#f8f2e1"
        stroke="#4b3b36"
        strokeWidth="2.1"
        strokeLinejoin="round"
      />
      <path
        d="M54 14 L29 39 L26 49 L34 42"
        fill="#e9dec7"
        stroke="#4b3b36"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M36 28 C34 25.5 31 26.5 32 29 C33 31 36 32.8 36 32.8 C36 32.8 39 31 40 29 C41 26.5 38 25.5 36 28 Z"
        fill="#e4666c"
      />
    </svg>
  );
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  open,
  activeTab,
  onTabChange,
  inventory,
  currentRoom,
  viewMode,
  atmosphere,
  settings,
  livingLightOn,
  isPointerLocked,
  onClose,
  onSelectSlot,
  onToggleEquip,
  onSwitchAmmo,
  onOpenPaperNote,
  onSelectRoom,
  onSelectViewMode,
  onSelectAtmosphere,
  onToggleSetting,
  onChangeBrightness,
  onToggleLivingLight,
  onRequestPointerLock,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyB') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const selectedItem = inventory.slots[inventory.selectedSlot] ?? null;
  const isSelectedEquipped =
    selectedItem !== null && inventory.equippedSlot === inventory.selectedSlot;
  const ownedCount = inventory.slots.filter(Boolean).length;
  const brightness = settings.brightness ?? 1.15;
  const brightnessPct = Math.round(brightness * 100);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d0816]/76 p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[740px] max-h-[90vh] flex flex-col rounded-2xl border border-[#ffe2cf]/25 bg-[#191227]/96 text-[#fff4eb] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Unified Tabs: Backpack / Graphics & Settings */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#ffe2cf]/12 bg-[#150f22]">
          <div className="flex items-center gap-1.5 rounded-xl border border-[#ffe2cf]/14 bg-[#110c1c] p-1">
            <button
              type="button"
              onClick={() => onTabChange('inventory')}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition cursor-pointer ${
                activeTab === 'inventory'
                  ? 'bg-[#ffb88c] text-[#1a1126]'
                  : 'text-[#d4c4e4] hover:bg-white/8 hover:text-white'
              }`}
            >
              <Backpack className="w-3.5 h-3.5" />
              <span>随身背包</span>
              <span
                className={`ml-0.5 text-[11px] font-mono ${
                  activeTab === 'inventory' ? 'text-[#3d251b]' : 'text-[#9c8ab3]'
                }`}
              >
                {ownedCount}/16
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange('settings')}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-[#ffb88c] text-[#1a1126]'
                  : 'text-[#d4c4e4] hover:bg-white/8 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>画面与设置</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[11.5px] text-[#aa97be]">
              当前位置：<strong className="text-[#ffd4b8] font-medium">{currentRoom.label}</strong>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#ffe2cf]/18 bg-[#281d3d] text-[#f4dfd0] hover:bg-[#382954] transition cursor-pointer"
              aria-label="关闭窗口"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto">
          {activeTab === 'inventory' ? (
            /* Tab 1: 4x4 Inventory Grid + Right Item Inspector */
            <div className="grid grid-cols-1 md:grid-cols-[1fr_256px] gap-5 p-6">
              <div className="grid grid-cols-4 gap-2.5">
                {inventory.slots.map((slot, idx) => {
                  const isSelected = idx === inventory.selectedSlot;
                  const isEquipped = idx === inventory.equippedSlot && slot !== null;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onSelectSlot(idx)}
                      onDoubleClick={() => {
                        if (!slot) return;
                        if (slot.id === 'paper_airplane_note') {
                          onOpenPaperNote();
                        } else {
                          onToggleEquip(idx);
                        }
                      }}
                      className={`relative aspect-square rounded-xl border flex flex-col items-center justify-center p-1.5 transition cursor-pointer ${
                        isSelected
                          ? 'border-[#ffb88c] bg-[#2e2246] shadow-[0_0_0_1px_rgba(255,184,140,0.45)]'
                          : slot
                            ? 'border-[#ffe2cf]/22 bg-[#231936] hover:border-[#ffb88c]/55 hover:bg-[#2a1f40]'
                            : 'border-[#ffe2cf]/10 bg-[#140e20]/80 hover:border-[#ffe2cf]/18'
                      }`}
                    >
                      {slot ? (
                        <>
                          <ItemGlyph item={slot} ammoType={inventory.ammoType} />
                          <span className="mt-1 text-[11px] font-medium text-[#ffefe2] truncate max-w-full px-1">
                            {slot.shortName}
                          </span>
                          {isEquipped && (
                            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded bg-[#ffb88c] text-[#1a1126]">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}
                          {slot.id === 'toy_gun' && (
                            <span className="absolute top-1.5 left-1.5 text-[9px] leading-none font-medium px-1 py-0.5 rounded bg-[#140d21]/85 text-[#9ef0d6] border border-[#9ef0d6]/30">
                              {inventory.ammoType === 'dart' ? '吸盘' : '网弹'}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-[#78688c]/45 font-mono">{idx + 1}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-[#ffe2cf]/14 bg-[#140e21]/90 p-4">
                {selectedItem ? (
                  <>
                    <div>
                      <div className="flex items-center justify-center h-24 rounded-lg bg-[#201733] border border-[#ffe2cf]/10 mb-3">
                        <ItemGlyph item={selectedItem} ammoType={inventory.ammoType} large />
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-[15px] font-semibold text-[#fff3e8]">
                          {selectedItem.name}
                        </h3>
                        <span className="text-[11px] text-[#cbb6dc] shrink-0">
                          {selectedItem.category}
                        </span>
                      </div>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-[#d9cbe4]">
                        {selectedItem.description}
                      </p>

                      {selectedItem.id === 'toy_gun' && (
                        <div className="mt-3 pt-3 border-t border-[#ffe2cf]/10">
                          <div className="text-[11px] text-[#b8a5cc] mb-1.5">
                            当前弹药类型（按 X 切换）
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSwitchAmmo('dart')}
                              className={`px-2 py-1.5 rounded-lg text-[11.5px] font-medium border transition cursor-pointer ${
                                inventory.ammoType === 'dart'
                                  ? 'border-[#ff8a5b] bg-[#ff6f3c]/25 text-[#ffd9c4]'
                                  : 'border-[#ffe2cf]/14 bg-[#1d142e] text-[#c7b6d6] hover:bg-[#271b3e]'
                              }`}
                            >
                              吸盘飞镖弹
                            </button>
                            <button
                              type="button"
                              onClick={() => onSwitchAmmo('net')}
                              className={`px-2 py-1.5 rounded-lg text-[11.5px] font-medium border transition cursor-pointer ${
                                inventory.ammoType === 'net'
                                  ? 'border-[#7ee0c0] bg-[#73dfc0]/22 text-[#d4fff0]'
                                  : 'border-[#ffe2cf]/14 bg-[#1d142e] text-[#c7b6d6] hover:bg-[#271b3e]'
                              }`}
                            >
                              捕捉网弹
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      {selectedItem.readable && (
                        <button
                          type="button"
                          onClick={onOpenPaperNote}
                          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[#f6e8d2] text-[#2c1f20] text-[12.5px] font-semibold hover:bg-[#fff2de] transition cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          展开阅读手写字条
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleEquip(inventory.selectedSlot)}
                        className={`flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-[12.5px] font-semibold transition cursor-pointer ${
                          isSelectedEquipped
                            ? 'border border-[#ffe2cf]/25 bg-[#2a1f40] text-[#ffe9db] hover:bg-[#382954]'
                            : 'bg-[#ffb88c] text-[#1c1229] hover:bg-[#ffc8a6]'
                        }`}
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        {isSelectedEquipped ? '卸下物品 [Q]' : '装备到手中 [Q]'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-center py-8 px-2">
                    <p className="text-[13px] font-medium text-[#cbbad8]">空格子</p>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#9282a8]">
                      探索公寓拾取物品后会自动收纳进这里。客厅沙发上似乎放着一把塑料玩具枪。
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Tab 2: Shader, Render Pipeline, Atmosphere, Brightness, Lighting & Room Teleport */
            <div className="p-5 sm:p-6 space-y-5">
              {/* Row 1: Atmosphere + Brightness */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="rounded-xl border border-[#ffe2cf]/14 bg-[#140e21]/90 p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-[13px] font-semibold text-[#ffe8d6]">氛围与时段</h3>
                    <span className="text-[11px] text-[#a795be]">实时切换全屋光影</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {ATMOSPHERE_ITEMS.map((item) => {
                      const active = atmosphere === item.id;
                      const activeStyle =
                        item.id === 'meta'
                          ? 'border-rose-300/65 bg-[#e34b74]/28 text-[#ffe6ee]'
                          : item.id === 'daylight'
                            ? 'border-[#ffe29c]/65 bg-[#f5b95f]/26 text-[#fff1cf]'
                            : 'border-[#c5aef7]/65 bg-[#7c61b8]/35 text-[#f7f0ff]';
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelectAtmosphere(item.id)}
                          className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition cursor-pointer ${
                            active
                              ? activeStyle
                              : 'border-[#ffe2cf]/12 bg-[#1c142e] text-[#d3c4e3] hover:border-[#ffe2cf]/28 hover:bg-[#241a3a]'
                          }`}
                        >
                          <span className="text-[12.5px] font-semibold">{item.label}</span>
                          <span className="text-[10.5px] text-[#b4a3c9] mt-0.5">{item.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-xl border border-[#ffe2cf]/14 bg-[#140e21]/90 p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#ffe8d6]">
                        <Sun className="w-3.5 h-3.5 text-[#ffd28a]" />
                        <span>画面亮度</span>
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[12px] font-semibold text-[#ffcca8] tabular-nums">
                          {brightnessPct}%
                        </span>
                        <button
                          type="button"
                          onClick={() => onChangeBrightness(1.15)}
                          title="恢复默认亮度 115%"
                          className="flex h-6 w-6 items-center justify-center rounded border border-white/15 bg-white/6 text-[#cbb8de] hover:bg-white/15 hover:text-white transition cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => onChangeBrightness(brightness - 0.05)}
                        aria-label="调暗画面"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#ffe2cf]/18 bg-[#221838] text-[#e6daf3] hover:bg-[#30224e] cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="range"
                        min={0.75}
                        max={1.6}
                        step={0.05}
                        value={brightness}
                        onChange={(e) => onChangeBrightness(Number(e.target.value))}
                        aria-label="画面亮度调节"
                        className="w-full accent-[#ffb88c] cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => onChangeBrightness(brightness + 0.05)}
                        aria-label="调亮画面"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#ffe2cf]/18 bg-[#221838] text-[#e6daf3] hover:bg-[#30224e] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick Lighting & Camera View Controls */}
                  <div className="mt-4 pt-3 border-t border-[#ffe2cf]/10 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onToggleLivingLight}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition cursor-pointer ${
                        livingLightOn
                          ? 'border-[#ffe28a]/60 bg-[#ffdf85]/22 text-[#fff0b8]'
                          : 'border-[#ffe2cf]/15 bg-[#1d1530] text-[#d5c6e6] hover:bg-[#281d40]'
                      }`}
                    >
                      <Lightbulb
                        className={`w-3.5 h-3.5 ${livingLightOn ? 'text-[#ffe48c]' : 'text-[#a594ba]'}`}
                      />
                      <span>客厅主灯：{livingLightOn ? '已开启' : '已关闭'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onSelectViewMode(viewMode === 'first-person' ? 'overview' : 'first-person')
                      }
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition cursor-pointer ${
                        viewMode === 'overview'
                          ? 'border-[#c5aef7]/65 bg-[#9b7ce0]/30 text-[#efe5ff]'
                          : 'border-[#ffe2cf]/15 bg-[#1d1530] text-[#d5c6e6] hover:bg-[#281d40]'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5 text-[#c9b4ef]" />
                      <span>{viewMode === 'overview' ? '切回第一人称' : '公寓俯瞰视角'}</span>
                    </button>
                  </div>
                </section>
              </div>

              {/* Row 2: Shader & Render Pipeline Toggles */}
              <section className="rounded-xl border border-[#ffe2cf]/14 bg-[#140e21]/90 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-semibold text-[#ffe8d6]">着色器与渲染管线</h3>
                  <span className="text-[11px] text-[#a795be]">实时生效，无需重载场景</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {PIPELINE_TOGGLES.map((item) => {
                    const enabled = settings[item.key];
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onToggleSetting(item.key)}
                        className={`flex flex-col justify-between rounded-lg border p-2.5 text-left transition cursor-pointer ${
                          enabled
                            ? 'border-[#ffb88c]/55 bg-[#291e3e] text-[#fff2e6]'
                            : 'border-[#ffe2cf]/12 bg-[#1a132b] text-[#baa9cd] hover:border-[#ffe2cf]/25 hover:bg-[#221936]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="flex items-center gap-1.5 text-[12px] font-semibold">
                            {item.key === 'audioEnabled' &&
                              (enabled ? (
                                <Volume2 className="w-3.5 h-3.5 text-[#ffb88c]" />
                              ) : (
                                <VolumeX className="w-3.5 h-3.5 text-[#9887ad]" />
                              ))}
                            <span>{item.label}</span>
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                              enabled
                                ? 'border-[#ffb88c]/50 bg-[#ffb88c]/20 text-[#ffd6bc]'
                                : 'border-white/12 bg-white/5 text-[#9483aa]'
                            }`}
                          >
                            {enabled ? '开启' : '关闭'}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[10.5px] leading-snug text-[#a796bc]">
                          {item.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Row 3: Quick Room Navigation + Pointer Lock Action */}
              <section className="rounded-xl border border-[#ffe2cf]/14 bg-[#140e21]/90 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#ffe8d6]">
                    <MapPin className="w-3.5 h-3.5 text-[#ffb88c]" />
                    <span>房间快捷前往</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onRequestPointerLock();
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-[#ffb88c]/45 bg-[#ffb085]/18 px-2.5 py-1 text-[11.5px] font-medium text-[#ffd8be] hover:bg-[#ffb085]/30 transition cursor-pointer"
                  >
                    <Lock className="w-3 h-3" />
                    <span>{isPointerLocked ? '鼠标已锁定 (ESC 解锁)' : '返回画面并锁定鼠标'}</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ROOM_ITEMS.map((room) => {
                    const active = viewMode === 'first-person' && currentRoom.id === room.id;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => {
                          onSelectRoom(room.id);
                          onClose();
                        }}
                        className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition cursor-pointer ${
                          active
                            ? 'border-[#ffd4b8]/65 bg-[#ffb085] text-[#1c132b]'
                            : 'border-[#ffe2cf]/15 bg-[#1d1530] text-[#e7dbf5] hover:border-[#ffb88c]/45 hover:bg-[#2a1f42]'
                        }`}
                      >
                        {room.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer Controls Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 bg-[#130d1f] border-t border-[#ffe2cf]/10 text-[11.5px] text-[#baa9cc]">
          {activeTab === 'inventory' ? (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  <strong className="text-[#ffd6bc]">B</strong> 开关面板
                </span>
                <span>
                  <strong className="text-[#ffd6bc]">Q</strong> 快速装备 / 卸下
                </span>
                <span>
                  <strong className="text-[#ffd6bc]">滚轮</strong> 切换物品
                </span>
                <span>
                  <strong className="text-[#ffd6bc]">X</strong> 切换玩具枪弹药
                </span>
              </div>
              <span className="text-[#9987b0]">双击格子可快捷使用</span>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  <strong className="text-[#ffd6bc]">点击游戏画面</strong> 默认锁定鼠标视角
                </span>
                <span>
                  <strong className="text-[#ffd6bc]">ESC</strong> 释放鼠标
                </span>
                <span>
                  <strong className="text-[#ffd6bc]">H</strong> 隐藏顶部界面
                </span>
              </div>
              <span className="text-[#9987b0]">关闭面板即可返回探索</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
