class ArcadeChiptuneAudio {
  private ctx: AudioContext | null = null;
  private muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(m: boolean): void {
    this.muted = m;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private tone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType,
    gainPeak: number,
    delay = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freqStart), now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.015);
  }

  public playCoin(): void {
    this.tone(987.77, 987.77, 0.075, 'square', 0.09, 0);
    this.tone(1318.51, 1318.51, 0.22, 'square', 0.09, 0.075);
  }

  public playBootTick(): void {
    this.tone(620, 740, 0.045, 'square', 0.045, 0);
  }

  public playShoot(): void {
    this.tone(540, 140, 0.09, 'square', 0.075, 0);
  }

  public playBrickHit(): void {
    this.tone(240, 95, 0.06, 'triangle', 0.08, 0);
  }

  public playSteelClang(): void {
    this.tone(1280, 920, 0.065, 'square', 0.055, 0);
  }

  public playExplode(big = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const dur = big ? 0.34 : 0.18;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(big ? 520 : 780, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(big ? 0.18 : 0.11, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  public playPowerup(): void {
    this.tone(523.25, 523.25, 0.07, 'square', 0.08, 0);
    this.tone(659.25, 659.25, 0.07, 'square', 0.08, 0.07);
    this.tone(783.99, 783.99, 0.07, 'square', 0.08, 0.14);
    this.tone(1046.5, 1046.5, 0.16, 'square', 0.09, 0.21);
  }

  public playStageClear(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      this.tone(f, f, idx === notes.length - 1 ? 0.28 : 0.09, 'square', 0.08, idx * 0.095);
    });
  }

  public playGameOver(): void {
    const notes = [392.0, 349.23, 329.63, 261.63];
    notes.forEach((f, idx) => {
      this.tone(f, f * 0.96, idx === notes.length - 1 ? 0.42 : 0.16, 'sawtooth', 0.07, idx * 0.18);
    });
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const arcadeAudio = new ArcadeChiptuneAudio();
