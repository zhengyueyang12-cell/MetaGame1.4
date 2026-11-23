import React, { useState } from 'react';
import { Disc3, Image as ImageIcon, Lock, Play, Square, X } from 'lucide-react';
import { BUREAU_CGS } from '../../data/bureauScript';
import { BgmMood, MetaState } from '../../types/vn';
import { vnAudioEngine } from '../../utils/vnAudioEngine';

interface GalleryModalProps {
  metaState: MetaState;
  initialTab?: 'cg' | 'music';
  contained?: boolean;
  onClose: () => void;
}

const BGM_TRACKS: { id: BgmMood; title: string; subtitle: string }[] = [
  {
    id: 'cinema_projector',
    title: '01 · 废墟放映厅《莎乐美之吻》',
    subtitle: '序章 & 第五幕 低频泄露梦境与圆舞曲',
  },
  {
    id: 'summer_dusk',
    title: '02 · 2042 年夏末暮蝉与天台夕阳',
    subtitle: '第一～二幕 公寓清晨、校园天台与地下室搜寻',
  },
  {
    id: 'bureau_hum',
    title: '03 · 深夜古董主机 CRT 蜂鸣',
    subtitle: '第三幕 第 2 夜 机械硬盘啸叫与 50GB 缓存挂载',
  },
  {
    id: 'unease',
    title: '04 · 球面玻璃反光与休学真相',
    subtitle: '第三幕 第 4～6 夜 顺行性遗忘症档案与 72 BPM 同步',
  },
  {
    id: 'audit_alarm',
    title: '05 · 台风夜磁盘吞噬警报',
    subtitle: '第四幕 C 盘空间耗尽与 2042_Host_Mind_Backup 写入',
  },
];

export const GalleryModal: React.FC<GalleryModalProps> = ({
  metaState,
  initialTab = 'cg',
  contained = false,
  onClose,
}) => {
  const [tab, setTab] = useState<'cg' | 'music'>(initialTab);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [playingTrack, setPlayingTrack] = useState<BgmMood | null>(null);

  const handleToggleTrack = (mood: BgmMood) => {
    vnAudioEngine.unlock();
    if (playingTrack === mood) {
      vnAudioEngine.stopBgm();
      setPlayingTrack(null);
    } else {
      vnAudioEngine.playBgm(mood);
      setPlayingTrack(mood);
    }
  };

  return (
    <div
      className={`${contained ? 'absolute p-2.5' : 'fixed p-4'} inset-0 z-50 flex items-center justify-center bg-black/88`}
    >
      <div
        className={`w-full max-w-4xl rounded-xl bg-[#0D1017] border border-white/15 shadow-2xl overflow-hidden flex flex-col ${contained ? 'max-h-[92%]' : 'max-h-[86vh]'}`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-6">
            <h2 className="font-vn-serif text-lg font-semibold text-white">档案视觉记录与音轨室</h2>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-white/10">
              <button
                onClick={() => setTab('cg')}
                className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  tab === 'cg' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                场景记录
              </button>
              <button
                onClick={() => setTab('music')}
                className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                  tab === 'music' ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Disc3 className="w-3.5 h-3.5" />
                合成音轨
              </button>
            </div>
          </div>
          <button
            onClick={() => {
              if (playingTrack) vnAudioEngine.stopBgm();
              onClose();
            }}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {tab === 'cg' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {BUREAU_CGS.map((cg) => {
                const unlocked = metaState.unlockedCGs.includes(cg.id);
                return (
                  <div
                    key={cg.id}
                    className="rounded-lg bg-zinc-900/75 border border-white/10 overflow-hidden flex flex-col"
                  >
                    <button
                      disabled={!unlocked}
                      onClick={() => unlocked && setPreviewImage(cg.image)}
                      className={`relative aspect-video w-full bg-black overflow-hidden ${
                        unlocked ? 'cursor-pointer group' : 'cursor-not-allowed'
                      }`}
                    >
                      {unlocked ? (
                        <img
                          src={cg.image}
                          alt={cg.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-600">
                          <Lock className="w-6 h-6" />
                          <span className="text-xs font-vn-mono">LOCKED</span>
                        </div>
                      )}
                    </button>
                    <div className="p-3.5 space-y-1">
                      <p className="text-sm font-medium text-zinc-100">
                        {unlocked ? cg.title : '未解锁场景'}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {unlocked ? cg.subtitle : cg.unlockHint}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {BGM_TRACKS.map((track) => {
                const isPlaying = playingTrack === track.id;
                return (
                  <div
                    key={track.id}
                    className={`flex items-center justify-between gap-4 p-4 rounded-lg border transition-colors ${
                      isPlaying
                        ? 'bg-emerald-950/30 border-emerald-500/40'
                        : 'bg-zinc-900/60 border-white/10'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{track.title}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{track.subtitle}</p>
                    </div>
                    <button
                      onClick={() => handleToggleTrack(track.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                        isPlaying
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white/10 hover:bg-white/15 text-zinc-100'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          停止
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          试听
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className={`${contained ? 'absolute p-3' : 'fixed p-6'} inset-0 z-60 bg-black/95 flex items-center justify-center cursor-zoom-out`}
        >
          <img
            src={previewImage}
            alt="Full CG"
            referrerPolicy="no-referrer"
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
          />
        </div>
      )}
    </div>
  );
};
