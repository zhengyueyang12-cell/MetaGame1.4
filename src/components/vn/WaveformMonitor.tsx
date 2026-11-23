import React, { useEffect, useRef } from 'react';
import { WaveformMode } from '../../types/vn';

interface WaveformMonitorProps {
  mode: WaveformMode;
  complianceValue: string;
  cpm?: number;
}

export const WaveformMonitor: React.FC<WaveformMonitorProps> = ({
  mode,
  complianceValue,
  cpm = 72,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 0;

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 28) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      const strokeColor =
        mode === 'heartbeat_cinema'
          ? '#D95B66'
          : mode === 'spike_red'
            ? '#D4A5A5'
            : mode === 'overflow_glitch'
              ? '#A9CBB7'
              : '#D1D5DB';

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let x = 0; x < w; x++) {
        let y = h / 2;
        const t = x * 0.045 + phase;
        if (mode === 'flat_cyan') {
          y += Math.sin(t * 0.8) * 3.5;
        } else if (mode === 'fake_flat_999') {
          const micro = Math.sin(t) * 1.5;
          const spike =
            Math.sin(phase * 3.1) > 0.97 && x > w * 0.65 && x < w * 0.72
              ? (Math.random() - 0.5) * 26
              : 0;
          y += micro + spike;
        } else if (mode === 'spike_red') {
          y += Math.sin(t * 2.5) * 18 + (Math.random() - 0.5) * 22;
        } else if (mode === 'overflow_glitch') {
          y += Math.sin(t * 1.8) * 12 + (Math.random() > 0.86 ? (Math.random() - 0.5) * 30 : 0);
        } else if (mode === 'heartbeat_cinema') {
          const cycle = (x * 0.03 + phase * 0.8) % (Math.PI * 2);
          if (cycle > 2.6 && cycle < 2.95) y -= 22;
          else if (cycle >= 2.95 && cycle < 3.2) y += 14;
          else if (cycle >= 3.2 && cycle < 3.45) y -= 7;
          else y += Math.sin(t * 0.5) * 1.5;
        }
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      ctx.stroke();
      const bpmStep =
        mode === 'heartbeat_cinema' ? (Math.max(40, cpm) / 60) * 0.11 : mode === 'spike_red' ? 0.16 : 0.07;
      phase += bpmStep;
      animId = window.requestAnimationFrame(render);
    };

    animId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animId);
  }, [mode, cpm]);

  return (
    <div className="retro-window p-2.5 space-y-2">
      <div className="flex items-center justify-between text-[11px] font-vn-mono border-b border-[#2D333B] pb-1.5">
        <span className="text-zinc-400">
          {mode === 'heartbeat_cinema' ? `OBSERVER_PULSE [${cpm} BPM]` : 'SYS_WAVEFORM.CRT'}
        </span>
        <span
          className={`font-semibold tabular-nums ${
            mode === 'spike_red'
              ? 'text-zinc-200 glitch-text'
              : mode === 'overflow_glitch'
                ? 'text-[#B5D3C2]'
                : 'text-zinc-300'
          }`}
        >
          {complianceValue}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={360}
        height={64}
        className="w-full h-[64px] block bg-[#050608] border border-[#252A31]"
      />
    </div>
  );
};
