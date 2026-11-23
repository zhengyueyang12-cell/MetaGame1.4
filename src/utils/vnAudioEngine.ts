import type { BgmMood, SfxType } from '../types/vn';

class ProceduralVnAudioEngine {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private activeBgmNodes: AudioNode[] = [];
  private activeBgmTimer: number | null = null;
  private currentMood: BgmMood = 'none';
  private bgmVol = 0.45;
  private sfxVol = 0.65;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmGain.gain.value = this.bgmVol * 0.28;
      this.sfxGain.gain.value = this.sfxVol * 0.35;
      this.bgmGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
  }

  public setVolumes(bgm: number, sfx: number) {
    this.bgmVol = Math.max(0, Math.min(1, bgm));
    this.sfxVol = Math.max(0, Math.min(1, sfx));
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(this.bgmVol * 0.28, this.ctx.currentTime, 0.08);
    }
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVol * 0.35, this.ctx.currentTime, 0.05);
    }
  }

  public stopBgm() {
    if (this.activeBgmTimer !== null) {
      window.clearInterval(this.activeBgmTimer);
      this.activeBgmTimer = null;
    }
    this.activeBgmNodes.forEach((node) => {
      try {
        if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
          (node as OscillatorNode).stop();
        }
        node.disconnect();
      } catch {
        // Ignore already stopped
      }
    });
    this.activeBgmNodes = [];
    this.currentMood = 'none';
  }

  public playBgm(mood: BgmMood) {
    if (mood === this.currentMood) return;
    this.stopBgm();
    this.currentMood = mood;
    if (mood === 'none') return;

    const ctx = this.ensureContext();
    if (!ctx || !this.bgmGain) return;

    const playTone = (
      freq: number,
      dur: number,
      type: OscillatorType = 'sine',
      gainVal = 0.14,
      detune = 0
    ) => {
      if (!this.ctx || !this.bgmGain) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (detune) osc.detune.setValueAtTime(detune, now);
      filter.type = 'lowpass';
      filter.frequency.value = 1200;
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(gainVal, now + 0.1);
      env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(filter);
      filter.connect(env);
      env.connect(this.bgmGain);
      osc.start(now);
      osc.stop(now + dur + 0.05);
    };

    if (mood === 'bureau_hum') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 60;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start();
      this.activeBgmNodes.push(osc, gain);

      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 780;
      band.Q.value = 0.7;
      const nGain = ctx.createGain();
      nGain.gain.value = 0.09;
      noise.connect(band);
      band.connect(nGain);
      nGain.connect(this.bgmGain);
      noise.start();
      this.activeBgmNodes.push(noise, band, nGain);

      const notes = [220, 261.63, 329.63, 293.66];
      let i = 0;
      this.activeBgmTimer = window.setInterval(() => {
        playTone(notes[i % notes.length], 2.2, 'sine', 0.07);
        i++;
      }, 2400);
    } else if (mood === 'unease') {
      const notes = [196, 207.65, 293.66, 277.18];
      let i = 0;
      this.activeBgmTimer = window.setInterval(() => {
        playTone(notes[i % notes.length], 1.6, 'triangle', 0.1, i % 2 === 0 ? -15 : 18);
        i++;
      }, 1100);
    } else if (mood === 'audit_alarm') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      gain.gain.value = 0.22;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);
      osc.start();
      this.activeBgmNodes.push(osc, filter, gain);
      this.activeBgmTimer = window.setInterval(() => {
        playTone(880, 0.14, 'square', 0.06);
      }, 900);
    } else if (mood === 'cinema_projector' || mood === 'eternal_cinema') {
      const notes = [349.23, 440, 523.25, 493.88, 392, 329.63];
      let step = 0;
      this.activeBgmTimer = window.setInterval(() => {
        this.playSfx('debug_tick');
        if (step % 4 === 0) {
          playTone(notes[Math.floor(step / 4) % notes.length], 2.4, 'sine', 0.14, -8);
        }
        step++;
      }, 240);
    } else if (mood === 'summer_dusk') {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.value = 4600;
      hp.Q.value = 4.5;
      const nGain = ctx.createGain();
      nGain.gain.value = 0.028;
      noise.connect(hp);
      hp.connect(nGain);
      nGain.connect(this.bgmGain);
      noise.start();
      this.activeBgmNodes.push(noise, hp, nGain);
      const notes = [392.0, 493.88, 587.33, 659.25, 587.33, 493.88];
      let i = 0;
      this.activeBgmTimer = window.setInterval(() => {
        playTone(notes[i % notes.length], 2.6, 'sine', 0.09, 4);
        i++;
      }, 1750);
    }
  }

  public playSfx(sfx: SfxType) {
    if (sfx === 'none') return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;

    if (sfx === 'click' || sfx === 'debug_tick') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = sfx === 'debug_tick' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(sfx === 'debug_tick' ? 980 : 540, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.035);
      gain.gain.setValueAtTime(sfx === 'debug_tick' ? 0.09 : 0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.045);
    } else if (sfx === 'blip_0924' || sfx === 'blip_sample' || sfx === 'blip_auditor') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = sfx === 'blip_auditor' ? 'square' : 'sine';
      const base = sfx === 'blip_0924' ? 520 : sfx === 'blip_sample' ? 700 : 280;
      osc.frequency.setValueAtTime(base + (Math.random() * 24 - 12), now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.03);
    } else if (sfx === 'heartbeat') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(76, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.17);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (sfx === 'school_bell') {
      const chime = [659.25, 587.33, 523.25, 392.0];
      chime.forEach((freq, idx) => {
        const start = now + idx * 0.62;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.22, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.95);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(start);
        osc.stop(start + 1.0);
      });
    } else if (sfx === 'solder_sizzle') {
      const dur = 0.28;
      const bufSize = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      noise.connect(hp);
      hp.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(now);
    } else if (sfx === 'crt_power_off') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1600, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.45);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (sfx === 'glitch' || sfx === 'format_wipe' || sfx === 'glass_shatter') {
      const dur = sfx === 'glass_shatter' ? 0.55 : sfx === 'format_wipe' ? 0.4 : 0.22;
      const bufSize = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = sfx === 'glass_shatter' ? 'highpass' : 'bandpass';
      filter.frequency.value = sfx === 'glass_shatter' ? 2400 : 1100;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(sfx === 'glass_shatter' ? 0.5 : 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      noise.start(now);
    } else if (sfx === 'os_error') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(160, now + 0.09);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.24);
    }
  }
}

export const vnAudioEngine = new ProceduralVnAudioEngine();
