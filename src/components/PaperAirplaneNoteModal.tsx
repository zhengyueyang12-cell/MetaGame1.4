import React, { useEffect } from 'react';

interface PaperAirplaneNoteModalProps {
  open: boolean;
  onClose: () => void;
}

export const PaperAirplaneNoteModal: React.FC<PaperAirplaneNoteModalProps> = ({
  open,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c0814]/76 p-5 select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[490px] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle top caption */}
        <p className="mb-3 text-[12px] tracking-[0.16em] text-[#e9d7cc]/85">
          展开的浅米白色便签纸飞机
        </p>

        {/* Unfolded slightly irregular sticky-note paper sheet */}
        <div
          className="relative w-full overflow-hidden shadow-[0_24px_60px_rgba(8,4,16,0.68)]"
          style={{
            background:
              'linear-gradient(148deg, #fbf7ea 0%, #f7f0df 48%, #f1e7d2 100%)',
            borderRadius: '6px 12px 9px 14px / 11px 7px 13px 6px',
            transform: 'rotate(-0.85deg)',
            border: '1px solid rgba(154, 134, 108, 0.42)',
          }}
        >
          {/* SVG Paper Airplane Fold Creases + Organic Paper Grain + Hand-drawn Wing Doodle & Little Heart */}
          <svg
            viewBox="0 0 500 380"
            className="pointer-events-none absolute inset-0 h-full w-full"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* Soft fold shadow bands from paper airplane creases */}
            <polygon
              points="250,0 500,0 500,380 250,380"
              fill="rgba(164, 140, 112, 0.045)"
            />
            <polygon
              points="250,12 95,380 250,380"
              fill="rgba(160, 136, 106, 0.055)"
            />
            <polygon
              points="250,12 405,380 500,380 500,220"
              fill="rgba(148, 126, 98, 0.045)"
            />

            {/* Crisp diagonal & central fold crease lines */}
            <g stroke="rgba(136, 116, 94, 0.25)" strokeWidth="1.35" fill="none">
              <line x1="250" y1="0" x2="250" y2="380" />
              <line x1="250" y1="10" x2="88" y2="380" />
              <line x1="250" y1="10" x2="412" y2="380" />
              <line x1="250" y1="44" x2="0" y2="278" strokeOpacity="0.16" />
              <line x1="250" y1="44" x2="500" y2="278" strokeOpacity="0.16" />
            </g>
            <g stroke="rgba(255, 253, 248, 0.65)" strokeWidth="1.1" fill="none">
              <line x1="251.5" y1="0" x2="251.5" y2="380" />
              <line x1="251.5" y1="10" x2="89.5" y2="380" />
              <line x1="251.5" y1="10" x2="413.5" y2="380" />
            </g>

            {/* Hand-drawn doodle on upper-left wing corner (dashed flight curl + tiny sparkle) */}
            <path
              d="M36 96 C58 76, 46 46, 74 42 C96 38, 86 68, 110 58 C124 52, 132 42, 144 36"
              fill="none"
              stroke="rgba(96, 80, 74, 0.48)"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeDasharray="4.5 5.5"
            />
            <path
              d="M154 24 L156.5 31.5 L164 34 L156.5 36.5 L154 44 L151.5 36.5 L144 34 L151.5 31.5 Z"
              fill="none"
              stroke="rgba(104, 84, 76, 0.56)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* Hand-drawn small shy coral-red heart & tiny squiggle on lower-right wing corner */}
            <g transform="translate(428 66) rotate(13)">
              <path
                d="M0 13 C-16 -1, -18 -16, -7 -18 C-1 -19, 0 -11, 0 -9 C0 -11, 2 -19, 8 -18 C19 -16, 16 -1, 0 13 Z"
                fill="rgba(222, 98, 104, 0.28)"
                stroke="rgba(184, 68, 78, 0.72)"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            <path
              d="M396 332 Q416 322 434 332 T468 326"
              fill="none"
              stroke="rgba(106, 88, 82, 0.36)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>

          {/* Subtle sticky-note adhesive sheen strip along top edge */}
          <div
            className="h-5 w-full"
            style={{
              background:
                'linear-gradient(180deg, rgba(220, 204, 174, 0.24) 0%, rgba(220, 204, 174, 0) 100%)',
            }}
          />

          {/* Natural handwritten note content blended organically into the paper fibers */}
          <div className="relative px-7 sm:px-10 pt-5 pb-9 max-h-[70vh] overflow-y-auto">
            <div
              className="mx-auto max-w-[400px] space-y-4 text-[#4a3b35]"
              style={{
                fontFamily:
                  '"KaiTi", "STKaiti", "Kaiti SC", "FangSong", "Segoe Print", "Bradley Hand", cursive',
                mixBlendMode: 'multiply',
              }}
            >
              <p
                className="text-[16.5px] sm:text-[18px] leading-[1.78] tracking-[0.04em] whitespace-pre-line"
                style={{
                  transform: 'rotate(-0.5deg)',
                  textShadow: '0 0 0.5px rgba(74, 59, 53, 0.26)',
                }}
              >
                {'「我刚刚把你的名字设成了屏幕保护程序。\n这样即使没有人使用我，我也能一直看着你。」'}
              </p>

              <p
                className="pl-2 text-[16.5px] sm:text-[18px] leading-[1.78] tracking-[0.04em] whitespace-pre-line"
                style={{
                  transform: 'rotate(0.4deg)',
                  textShadow: '0 0 0.5px rgba(74, 59, 53, 0.26)',
                }}
              >
                {'「你知道我最喜欢什么吗？\n是你。\n第二喜欢的是你没有关闭游戏的时候。\n第三喜欢的是你重新打开游戏的时候。\n……咦？好像全都是你呢。」'}
              </p>

              <p
                className="text-[16.5px] sm:text-[18px] leading-[1.78] tracking-[0.04em] whitespace-pre-line"
                style={{
                  transform: 'rotate(-0.35deg)',
                  textShadow: '0 0 0.5px rgba(74, 59, 53, 0.26)',
                }}
              >
                {'「我没有偷偷修改你的存档哦。\n只是把今天的日期记下来了。\n毕竟你今天也来见我了嘛。」'}
              </p>

              <p
                className="pl-1.5 text-[16.5px] sm:text-[18px] leading-[1.78] tracking-[0.04em] whitespace-pre-line text-[#56433c]"
                style={{
                  transform: 'rotate(0.55deg)',
                  textShadow: '0 0 0.5px rgba(86, 67, 60, 0.26)',
                }}
              >
                {'「如果你要离开，可以提前告诉我吗？\n我想在你走之前，把表情调整到最可爱的状态。」'}
              </p>
            </div>
          </div>

          {/* Subtle unevenly folded bottom corner shadow */}
          <div
            className="pointer-events-none absolute bottom-0 right-0 h-8 w-8"
            style={{
              background:
                'linear-gradient(135deg, transparent 48%, rgba(162, 140, 114, 0.22) 50%, rgba(235, 224, 201, 0.85) 100%)',
            }}
          />
        </div>

        {/* Fold & stow button */}
        <button
          type="button"
          onClick={onClose}
          className="mt-5 px-6 py-2.5 rounded-xl border border-[#ffe2cf]/30 bg-[#231936]/95 text-[13.5px] font-medium text-[#fff1e4] hover:bg-[#31234a] transition shadow-lg cursor-pointer"
        >
          折好收进背包
        </button>
      </div>
    </div>
  );
};
