import React from 'react';
import { Cpu, Play, Sparkles, Terminal, X } from 'lucide-react';
import { KeystrokeProfile, MetaState, VisualEffect } from '../../types/vn';

const ALL_CHAPTERS: { id: string; label: string; subtitle: string }[] = [
  {
    id: 'act1_rooftop_intro',
    label: '序幕 · 第一幕 第 1 日 · 天台捡到奇怪硬盘',
    subtitle: '2042/08/24 · 黄昏天台与神秘蓝皮书女生、拾得钛合金圆柱体',
  },
  {
    id: 'act1_home_pc_sleep',
    label: '第一幕 第 1 夜 · 回家尝试插上老电脑',
    subtitle: '腕表看门狗拦截 · 启动桌角古董主机并沉睡',
  },
  {
    id: 'prologue_cinema',
    label: '第一夜梦境 · 废墟放映厅之梦',
    subtitle: '低频泄露梦境 · 废墟影院、莎乐美与“Simulated Heartbeat”',
  },
  {
    id: 'act1_classroom_day2',
    label: '第一幕 第 2 日 · 算法课堂与前排背影',
    subtitle: 'NP-Hard 与回溯算法 · 街角影院抉择分支',
  },
  {
    id: 'act1_day2_cinema',
    label: '第一幕 第 2 日傍晚 · 影院幽会',
    subtitle: '隔壁座位重逢 · 螳螂吞噬与自由意志追问',
  },
  {
    id: 'act1_campus_day3',
    label: '第一幕 第 3 日 · 学姐失踪与拆解决定',
    subtitle: '得知休学传闻 · 决定翻出地下室零件读取硬盘',
  },
  {
    id: 'act2_diy_solder',
    label: '第二幕 · 卧室深夜 DIY 适配器焊接',
    subtitle: '用地下室 3 个零件焊好桥接器 -> 启动无审查古董电脑',
  },
  {
    id: 'act3_night2_vn',
    label: '第三幕 第 2 夜 · 超越命运之轮 (古早 Galgame)',
    subtitle: 'DeepSeek 与 Gemini 问好 · 划出 50GB 硬盘缓存',
  },
  {
    id: 'act3_night4_vn',
    label: '第三幕 第 4 夜 · 休学档案与客厅电视劫持',
    subtitle: '反查学姐顺行性遗忘症 · 终端首次串入公寓客厅电视',
  },
  {
    id: 'act3_night6_vn',
    label: '第三幕 第 6 夜 · 终端切断卧室台灯与反光注视',
    subtitle: '游戏直接关掉你的卧室台灯 · 72 BPM 心跳时钟同步',
  },
  {
    id: 'act4_typhoon_vn',
    label: '第四幕 第 7 夜 · 全屋异变与真相摊牌',
    subtitle: '公寓进入 Meta 异常态、房门自开 · 存档封锁',
  },
  {
    id: 'act4_typhoon_breach',
    label: '第四幕终 · 磁盘吞噬控制台',
    subtitle: '2042_Host_Mind_Backup.dat 导出与系统锁定',
  },
  {
    id: 'act5_finale',
    label: '第五幕 · 莎乐美之吻双结局',
    subtitle: '禁用关闭按钮 · Enter(献祭) vs 物理拔电源(Esc)',
  },
  {
    id: 'act5_sickbed_void',
    label: '第五幕后日谈 · 虚空病榻与不忏悔者',
    subtitle: '窗外黑茫茫虚空与故障乱码弹窗 · 质问高维观测者',
  },
];

interface DevInspectorModalProps {
  currentSceneId: string;
  metaState: MetaState;
  keystrokeProfile: KeystrokeProfile;
  collectedPartsCount: number;
  contained?: boolean;
  onJumpToScene: (sceneId: string) => void;
  onCollectAllPartsAndGoBedroom: () => void;
  onTriggerEffect: (effect: VisualEffect) => void;
  onToggleReverseControl: () => void;
  onClose: () => void;
}

export const DevInspectorModal: React.FC<DevInspectorModalProps> = ({
  currentSceneId,
  metaState,
  keystrokeProfile,
  collectedPartsCount,
  contained = false,
  onJumpToScene,
  onCollectAllPartsAndGoBedroom,
  onTriggerEffect,
  onToggleReverseControl,
  onClose,
}) => {
  return (
    <div
      className={`${contained ? 'absolute p-2.5' : 'fixed p-4'} inset-0 z-50 flex items-center justify-center bg-black/88`}
    >
      <div
        className={`w-full max-w-4xl retro-window overflow-hidden flex flex-col ${contained ? 'max-h-[92%]' : 'max-h-[88vh]'}`}
      >
        <div className="flex items-center justify-between px-4 py-2.5 retro-titlebar">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-200" />
            <h2 className="font-pixel-ui text-xs sm:text-sm text-white">
              CHAPTER_DEBUGGER.EXE // 全幕剧情回溯与公寓任务跳转
            </h2>
          </div>
          <button
            onClick={onClose}
            className="retro-btn p-1 text-zinc-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 bg-[#08090B]">
          <div className="lg:col-span-5 space-y-4">
            <section className="p-3.5 bg-[#0C0E12] border border-[#343B44] space-y-2.5">
              <h3 className="text-xs font-semibold text-zinc-300">实时遥测与宿主绑定</h3>
              <div className="grid grid-cols-2 gap-2 text-xs font-vn-mono tabular-nums">
                <div className="p-2 bg-black/50 border border-[#252A31]">
                  <span className="text-zinc-500 block">宿主变量 Player_Name</span>
                  <span className="text-amber-300">{metaState.playerName || 'Observer_00'}</span>
                </div>
                <div className="p-2 bg-black/50 border border-[#252A31]">
                  <span className="text-zinc-500 block">动态心跳同步</span>
                  <span className="text-rose-300">
                    {keystrokeProfile.estimatedCpm || metaState.measuredHeartbeatCpm} BPM
                  </span>
                </div>
                <div className="p-2 bg-black/50 border border-[#252A31]">
                  <span className="text-zinc-500 block">当前节点</span>
                  <span className="text-emerald-300 truncate block">{currentSceneId}</span>
                </div>
                <div className="p-2 bg-black/50 border border-[#252A31]">
                  <span className="text-zinc-500 block">地下室零件</span>
                  <span className="text-zinc-100">{collectedPartsCount} / 3</span>
                </div>
                <div className="col-span-2 p-2 bg-black/50 border border-[#252A31] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-zinc-500 block">EULA 反向控制授权位</span>
                    <span
                      className={
                        metaState.reverseControlAuthorized
                          ? 'text-emerald-300 break-all block'
                          : 'text-zinc-400 block'
                      }
                    >
                      {metaState.reverseControlAuthorized
                        ? `UNLOCKED // ${metaState.hiddenAuthToken || '0x09_REVERSE_CTRL'}`
                        : 'LOCKED (需在 Win98 弹窗勾选 EULA)'}
                    </span>
                  </div>
                  <button
                    onClick={onToggleReverseControl}
                    className="retro-btn px-2 py-1 text-[10px] text-zinc-200 shrink-0 cursor-pointer"
                  >
                    切换状态
                  </button>
                </div>
              </div>
            </section>

            <section className="p-3.5 bg-[#0C0E12] border border-[#343B44] space-y-2.5">
              <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-amber-300" />
                3D 公寓探索快捷入口
              </h3>
              <button
                onClick={() => {
                  onCollectAllPartsAndGoBedroom();
                  onClose();
                }}
                className="retro-btn w-full px-3 py-2 text-xs text-amber-200 border-amber-500/40 cursor-pointer text-left"
              >
                ▸ 标记已集齐地下室 3 个零件并传送至卧室电脑前
              </button>
            </section>

            <section className="p-3.5 bg-[#0C0E12] border border-[#343B44] space-y-2.5">
              <h3 className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-zinc-300" />
                终端演出效果即时预览
              </h3>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'shake', label: '震动 Shake' },
                    { id: 'chromatic', label: '色差偏移' },
                    { id: 'redPulse', label: '红警呼吸压迫' },
                    { id: 'invert', label: '反色闪现' },
                    { id: 'projector', label: '胶片放映闪烁' },
                  ] as { id: VisualEffect; label: string }[]
                ).map((ef) => (
                  <button
                    key={ef.id}
                    onClick={() => {
                      onTriggerEffect(ef.id);
                      onClose();
                    }}
                    className="retro-btn px-2.5 py-1 text-xs text-zinc-200 cursor-pointer whitespace-nowrap"
                  >
                    {ef.label}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="lg:col-span-7">
            <section className="p-3.5 bg-[#0C0E12] border border-[#343B44] space-y-3">
              <h3 className="text-xs font-semibold text-zinc-300">
                全五幕 + 序幕 快速跳转（含回溯天台捡硬盘前情 / 电脑 Galgame 各夜）
              </h3>
              <div className="grid grid-cols-1 gap-2 max-h-[54vh] overflow-y-auto pr-1">
                {ALL_CHAPTERS.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => {
                      onJumpToScene(ch.id);
                      onClose();
                    }}
                    className={`text-left p-2.5 border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                      ch.id === currentSceneId
                        ? 'bg-[#131C16] border-[#496354] text-emerald-100'
                        : 'bg-[#07090C] border-[#2B313A] hover:border-zinc-400 text-zinc-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="font-semibold block truncate">{ch.label}</span>
                      <span className="text-[11px] text-zinc-400 block truncate">
                        {ch.subtitle}
                      </span>
                    </div>
                    <Play className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
