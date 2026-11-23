import { useEffect, useState } from 'react';

interface GlitchDizzyOverlayProps {
  /** Normalized progress in [0, 1] during the 3.5s basement glitch cutscene, or null when inactive */
  progress: number | null;
}

interface TearBand {
  topPct: number;
  heightPx: number;
  shiftX: number;
  tint: string;
  opacity: number;
}

/**
 * Full-screen 3.5s Basement Terminal Glitch & Vertigo Cutscene Overlay:
 * - Horizontal scanline tearing bands
 * - RGB chromatic split edges & jitter slices
 * - High-frequency voltage flicker strobes
 * - Deep closing dizzy vignette (zero backdrop-filter over WebGL)
 */
export function GlitchDizzyOverlay({ progress }: GlitchDizzyOverlayProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (progress === null) return;
    let rafId = 0;
    let lastMs = 0;
    const loop = (now: number) => {
      if (now - lastMs >= 42) {
        lastMs = now;
        setTick((t) => (t + 1) % 10000);
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [progress !== null]);

  if (progress === null) return null;

  const p = Math.max(0, Math.min(1, progress));
  // Smooth envelope: rapid hit (0..0.14), heavy dizzy peak (0.14..0.78), gradual recovery (0.78..1.0)
  const envelope =
    p < 0.14
      ? p / 0.14
      : p < 0.78
        ? 1.0
        : Math.max(0, (1.0 - p) / 0.22);

  // Deterministic pseudo-random jitter from frame tick (zero Math.random impurity glitches)
  const hash = (seed: number) => {
    const x = Math.sin((tick * 12.9898 + seed * 78.233)) * 43758.5453;
    return x - Math.floor(x);
  };

  // High-frequency strobe / blackout flicker spikes
  const flickerWave = hash(1);
  const strobeOpacity =
    flickerWave > 0.84
      ? 0.42 * envelope
      : flickerWave < 0.12
        ? 0.26 * envelope
        : 0.04 * envelope;

  // RGB chromatic offset in px
  const rgbShift = (6 + hash(2) * 16) * envelope;

  // Dynamic horizontal tear bands
  const bands: TearBand[] = [];
  for (let i = 0; i < 8; i++) {
    const topPct = hash(10 + i * 3) * 94;
    const heightPx = 3 + Math.floor(hash(11 + i * 3) * 26);
    const shiftX = (hash(12 + i * 3) - 0.5) * 90 * envelope;
    const tint =
      i % 3 === 0
        ? 'rgba(255, 42, 92, 0.36)'
        : i % 3 === 1
          ? 'rgba(54, 240, 255, 0.34)'
          : 'rgba(255, 232, 246, 0.24)';
    bands.push({
      topPct,
      heightPx,
      shiftX,
      tint,
      opacity: (0.32 + hash(40 + i) * 0.55) * envelope,
    });
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Fine CRT horizontal scanlines */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.48 * envelope,
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.45) 0px, rgba(0,0,0,0.45) 2px, transparent 2px, transparent 5px)',
        }}
      />

      {/* RGB Chromatic Aberration Edge Split (Red left / Cyan right) */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.65 * envelope,
          boxShadow: `inset ${rgbShift}px 0 ${rgbShift * 2.2}px rgba(255, 36, 88, 0.55), inset ${-rgbShift}px 0 ${rgbShift * 2.2}px rgba(48, 240, 255, 0.55)`,
        }}
      />

      {/* Horizontal Scanline Tearing Slices */}
      {bands.map((b, idx) => (
        <div
          key={idx}
          className="absolute left-0 right-0"
          style={{
            top: `${b.topPct}%`,
            height: `${b.heightPx}px`,
            opacity: b.opacity,
            transform: `translate3d(${b.shiftX}px, 0, 0)`,
            background: `linear-gradient(90deg, transparent 0%, ${b.tint} 18%, rgba(255,255,255,0.22) 50%, ${b.tint} 82%, transparent 100%)`,
          }}
        />
      ))}

      {/* High-Frequency Flicker / Micro-Blackout Pulse */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: flickerWave > 0.88 ? '#180512' : '#05030a',
          opacity: strobeOpacity,
        }}
      />

      {/* Deep Vertigo Vignette closing around peripheral vision */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.92 * envelope,
          background: `radial-gradient(ellipse at 50% ${50 + p * 12}%, rgba(10, 4, 18, 0.08) ${
            Math.max(14, 46 - envelope * 26)
          }%, rgba(16, 4, 24, 0.78) 76%, rgba(4, 1, 8, 0.96) 100%)`,
        }}
      />

      {/* Subtle Diegetic Glitch Telemetry Flash */}
      {envelope > 0.35 && (
        <div
          className="absolute inset-x-0 top-[18%] flex flex-col items-center gap-1 px-4 text-center font-mono"
          style={{
            opacity: (0.45 + hash(99) * 0.5) * envelope,
            transform: `translate3d(${(hash(101) - 0.5) * 14}px, 0, 0)`,
          }}
        >
          <span className="text-[11px] tracking-[0.28em] text-[#ff5c8a] drop-shadow-[2px_0_0_rgba(56,242,255,0.85)]">
            // SYNC_OVERLOAD :: SECTOR_06_TERMINAL
          </span>
          <span className="text-xs tracking-[0.16em] text-[#f8eefc]/90 drop-shadow-[-2px_0_0_rgba(255,46,99,0.8)]">
            {p < 0.45
              ? '信号同步过载……眼前一阵天旋地转'
              : p < 0.82
                ? '现实锚点已重映射 // 卧室坐标响应中……'
                : '意识正在恢复……楼上传来了轻微的响动'}
          </span>
        </div>
      )}
    </div>
  );
}
