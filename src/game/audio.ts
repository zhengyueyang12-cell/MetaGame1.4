import type { AtmosphereMode, RoomId } from './types';
import { LOFI_TRACKS, VinylLofiPlayer, type LofiTrackSpec } from './vinylPlayer';

export class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private droneOsc: OscillatorNode | null = null;
  private droneSub: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;
  private vinylPlayer: VinylLofiPlayer | null = null;
  private enabled = true;
  private started = false;
  private stepTimer = 0;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        enabled ? 0.38 : 0.0,
        this.ctx.currentTime,
        0.08
      );
    }
  }

  unlock(): void {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.enabled ? 0.38 : 0.0;
      this.masterGain.connect(this.ctx.destination);

      // Subtle twilight room tone / basement hum drone
      this.droneFilter = this.ctx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.value = 140;

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.value = 0.045;

      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = 'triangle';
      this.droneOsc.frequency.value = 60;

      this.droneSub = this.ctx.createOscillator();
      this.droneSub.type = 'sine';
      this.droneSub.frequency.value = 90;

      this.droneOsc.connect(this.droneFilter);
      this.droneSub.connect(this.droneFilter);
      this.droneFilter.connect(this.droneGain);
      this.droneGain.connect(this.masterGain);

      this.droneOsc.start();
      this.droneSub.start();
      this.started = true;
    } catch {
      // Ignore audio initialization errors if blocked
    }
  }

  updateAtmosphere(room: RoomId, mode: AtmosphereMode): void {
    if (!this.ctx || !this.droneGain || !this.droneFilter || !this.droneOsc || !this.droneSub) {
      return;
    }
    const now = this.ctx.currentTime;
    const inBasement = room === 'basement';
    if (mode === 'meta') {
      this.droneOsc.frequency.setTargetAtTime(inBasement ? 55 : 64, now, 0.3);
      this.droneSub.frequency.setTargetAtTime(93.5, now, 0.3); // subtle dissonant beating
      this.droneFilter.frequency.setTargetAtTime(220, now, 0.3);
      this.droneGain.gain.setTargetAtTime(0.08, now, 0.3);
    } else if (inBasement) {
      this.droneOsc.frequency.setTargetAtTime(60, now, 0.3);
      this.droneSub.frequency.setTargetAtTime(120, now, 0.3);
      this.droneFilter.frequency.setTargetAtTime(175, now, 0.3);
      this.droneGain.gain.setTargetAtTime(0.07, now, 0.3);
    } else if (mode === 'midnight') {
      this.droneOsc.frequency.setTargetAtTime(52, now, 0.4);
      this.droneSub.frequency.setTargetAtTime(78, now, 0.4);
      this.droneFilter.frequency.setTargetAtTime(120, now, 0.4);
      this.droneGain.gain.setTargetAtTime(0.045, now, 0.4);
    } else if (mode === 'daylight') {
      this.droneOsc.frequency.setTargetAtTime(72, now, 0.4);
      this.droneSub.frequency.setTargetAtTime(108, now, 0.4);
      this.droneFilter.frequency.setTargetAtTime(92, now, 0.4);
      this.droneGain.gain.setTargetAtTime(0.018, now, 0.4);
    } else {
      this.droneOsc.frequency.setTargetAtTime(65, now, 0.4);
      this.droneSub.frequency.setTargetAtTime(97.5, now, 0.4);
      this.droneFilter.frequency.setTargetAtTime(100, now, 0.4);
      this.droneGain.gain.setTargetAtTime(0.028, now, 0.4);
    }
  }

  tickFootsteps(dt: number, isMoving: boolean, room: RoomId): void {
    if (!isMoving || !this.enabled || !this.ctx || !this.masterGain) {
      this.stepTimer = 0.16;
      return;
    }
    this.stepTimer -= dt;
    if (this.stepTimer <= 0) {
      this.stepTimer = 0.44;
      this.playFootstep(room);
    }
  }

  private playFootstep(room: RoomId): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    if (
      room === 'basement' ||
      room === 'entryway' ||
      room === 'kitchen' ||
      room === 'bathroom'
    ) {
      // Crisper tile / concrete tap
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(145 + Math.random() * 25, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.06);
      filter.type = 'bandpass';
      filter.frequency.value = room === 'basement' ? 420 : room === 'bathroom' ? 760 : 620;
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    } else {
      // Warm hardwood step
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110 + Math.random() * 16, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.075);
      filter.type = 'lowpass';
      filter.frequency.value = 260;
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playSpaceFold(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.55);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(540, now);
    osc2.frequency.exponentialRampToValueAtTime(195, now + 0.45);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(920, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.55);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.6);
    osc2.stop(now + 0.6);
  }

  playDoor(open: boolean): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(open ? 190 : 250, now);
    osc.frequency.exponentialRampToValueAtTime(open ? 310 : 120, now + 0.18);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  /**
   * Synthesizes a randomized wooden cabinet/cupboard hinge 'creak' + latch
   * click/thunk sound effect to enhance the lived-in environment.
   */
  playCabinetCreak(open: boolean): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;

    // Randomized creak duration, base pitch, and wood resonant formant
    const duration = 0.22 + Math.random() * 0.16;
    const baseFreq = (open ? 210 : 265) + (Math.random() - 0.5) * 75;
    const midFreq = baseFreq * (open ? 1.28 + Math.random() * 0.25 : 0.76 + Math.random() * 0.18);
    const endFreq = baseFreq * (open ? 1.08 + Math.random() * 0.22 : 0.54 + Math.random() * 0.14);

    // 1. Stick-slip hinge creak carrier + FM friction modulator
    const carrier = this.ctx.createOscillator();
    const modOsc = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const formant = this.ctx.createBiquadFilter();
    const creakGain = this.ctx.createGain();

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(baseFreq, now);
    carrier.frequency.exponentialRampToValueAtTime(
      Math.max(60, midFreq),
      now + duration * (0.42 + Math.random() * 0.18)
    );
    carrier.frequency.exponentialRampToValueAtTime(
      Math.max(50, endFreq),
      now + duration
    );

    // Stick-slip graininess modulation (15..32 Hz)
    modOsc.type = 'triangle';
    modOsc.frequency.setValueAtTime(15 + Math.random() * 17, now);
    modGain.gain.setValueAtTime(22 + Math.random() * 28, now);

    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(480 + Math.random() * 380, now);
    formant.Q.value = 3.8 + Math.random() * 3.2;

    const peakGain = 0.055 + Math.random() * 0.025;
    creakGain.gain.setValueAtTime(0.001, now);
    creakGain.gain.linearRampToValueAtTime(peakGain, now + 0.028);
    creakGain.gain.setValueAtTime(peakGain * (0.55 + Math.random() * 0.3), now + duration * 0.5);
    creakGain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    modOsc.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(formant);
    formant.connect(creakGain);
    creakGain.connect(this.masterGain);

    carrier.start(now);
    modOsc.start(now);
    carrier.stop(now + duration + 0.02);
    modOsc.stop(now + duration + 0.02);

    // 2. Subtle wooden cabinet catch click (at start when pulling open, or at end when shutting)
    const knockTime = open ? now : now + duration * 0.78;
    const knockOsc = this.ctx.createOscillator();
    const knockFilter = this.ctx.createBiquadFilter();
    const knockGain = this.ctx.createGain();

    knockOsc.type = 'triangle';
    knockOsc.frequency.setValueAtTime(open ? 165 + Math.random() * 40 : 125 + Math.random() * 30, knockTime);
    knockOsc.frequency.exponentialRampToValueAtTime(48, knockTime + 0.055);

    knockFilter.type = 'lowpass';
    knockFilter.frequency.value = 340;

    knockGain.gain.setValueAtTime(open ? 0.048 : 0.068, knockTime);
    knockGain.gain.exponentialRampToValueAtTime(0.001, knockTime + 0.065);

    knockOsc.connect(knockFilter);
    knockFilter.connect(knockGain);
    knockGain.connect(this.masterGain);

    knockOsc.start(knockTime);
    knockOsc.stop(knockTime + 0.07);
  }

  playInteract(isMeta = false): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    if (isMeta) {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.setValueAtTime(240, now + 0.06);
      osc.frequency.setValueAtTime(780, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.14);
    }
  }

  playLightFlicker(severity = 0.6): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;

    // 120Hz / 60Hz electrical ballast hum + sputter envelope
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.setValueAtTime(98, now + 0.05);
    osc.frequency.setValueAtTime(124, now + 0.11);

    sub.type = 'square';
    sub.frequency.setValueAtTime(60, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(340, now);
    filter.Q.value = 3.2;

    const peak = Math.min(0.065, 0.028 * severity);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.02);
    gain.gain.setValueAtTime(peak * 0.2, now + 0.055);
    gain.gain.linearRampToValueAtTime(peak * 0.85, now + 0.09);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.25);
    sub.stop(now + 0.25);
  }

  playGlitchCatMeow(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;

    // Harmonic feline meow glide + digital bit-stutter harmonic
    const carrier = this.ctx.createOscillator();
    const harmonic = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    carrier.type = 'triangle';
    carrier.frequency.setValueAtTime(510, now);
    carrier.frequency.exponentialRampToValueAtTime(790, now + 0.11);
    carrier.frequency.exponentialRampToValueAtTime(420, now + 0.36);

    harmonic.type = 'sawtooth';
    harmonic.frequency.setValueAtTime(1025, now);
    harmonic.frequency.setValueAtTime(1480, now + 0.09);
    harmonic.frequency.setValueAtTime(640, now + 0.18);
    harmonic.frequency.exponentialRampToValueAtTime(840, now + 0.34);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1150, now);
    filter.frequency.exponentialRampToValueAtTime(720, now + 0.36);
    filter.Q.value = 2.4;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.095, now + 0.04);
    gain.gain.setValueAtTime(0.075, now + 0.14);
    gain.gain.setValueAtTime(0.02, now + 0.17);
    gain.gain.linearRampToValueAtTime(0.068, now + 0.21);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.42);

    carrier.connect(filter);
    harmonic.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    carrier.start(now);
    harmonic.start(now);
    carrier.stop(now + 0.44);
    harmonic.stop(now + 0.44);
  }

  playCatPhaseBlip(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.09);
    gain.gain.setValueAtTime(0.032, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.11);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playLightSwitch(on: boolean): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(on ? 1480 : 1060, now);
    osc.frequency.exponentialRampToValueAtTime(on ? 520 : 340, now + 0.028);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.036);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.042);

    // Secondary plastic rocker snap
    const snap = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snap.type = 'square';
    snap.frequency.setValueAtTime(on ? 2150 : 1620, now + 0.012);
    snap.frequency.exponentialRampToValueAtTime(680, now + 0.032);
    snapGain.gain.setValueAtTime(0.035, now + 0.012);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.036);
    snap.connect(snapGain);
    snapGain.connect(this.masterGain);
    snap.start(now + 0.012);
    snap.stop(now + 0.042);
  }

  playPickup(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.095, t + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  }

  playInventoryToggle(open: boolean): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(open ? 320 : 480, now);
    osc.frequency.exponentialRampToValueAtTime(open ? 560 : 280, now + 0.075);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playEquipToggle(equipped: boolean): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(equipped ? 280 : 420, now);
    osc.frequency.exponentialRampToValueAtTime(equipped ? 640 : 210, now + 0.065);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playAmmoSwitch(ammo: 'dart' | 'net'): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    // Chunky plastic ratchet double-click
    const freqs = ammo === 'dart' ? [680, 960] : [820, 560];
    freqs.forEach((f, i) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + i * 0.048;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.032);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 2.0;
      gain.gain.setValueAtTime(0.075, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.038);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.045);
    });
  }

  playToyGunShoot(ammo: 'dart' | 'net'): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;

    // 1. Punchy spring-piston pop
    const pop = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    pop.type = ammo === 'dart' ? 'triangle' : 'sine';
    pop.frequency.setValueAtTime(ammo === 'dart' ? 360 : 250, now);
    pop.frequency.exponentialRampToValueAtTime(ammo === 'dart' ? 92 : 74, now + 0.095);
    popGain.gain.setValueAtTime(ammo === 'dart' ? 0.22 : 0.19, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    pop.connect(popGain);
    popGain.connect(this.masterGain);
    pop.start(now);
    pop.stop(now + 0.12);

    // 2. Toy plastic spring boing overtone
    const boing = this.ctx.createOscillator();
    const boingGain = this.ctx.createGain();
    boing.type = 'sine';
    boing.frequency.setValueAtTime(ammo === 'dart' ? 540 : 410, now + 0.008);
    boing.frequency.exponentialRampToValueAtTime(ammo === 'dart' ? 880 : 620, now + 0.045);
    boing.frequency.exponentialRampToValueAtTime(ammo === 'dart' ? 420 : 290, now + 0.12);
    boingGain.gain.setValueAtTime(0.08, now + 0.008);
    boingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    boing.connect(boingGain);
    boingGain.connect(this.masterGain);
    boing.start(now + 0.008);
    boing.stop(now + 0.14);

    // 3. Crisp compressed-air puff noise burst
    const len = Math.floor(this.ctx.sampleRate * (ammo === 'dart' ? 0.075 : 0.14));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, 1.5);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(ammo === 'dart' ? 1850 : 1200, now);
    filter.frequency.exponentialRampToValueAtTime(ammo === 'dart' ? 950 : 2200, now + (ammo === 'dart' ? 0.07 : 0.13));
    filter.Q.value = 1.4;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(ammo === 'dart' ? 0.14 : 0.17, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + (ammo === 'dart' ? 0.075 : 0.14));
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);
  }

  playDartStick(pitchJitter = 1.0): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    // Classic juicy rubber suction-cup "PLOP-THWACK!"
    const plop = this.ctx.createOscillator();
    const plopGain = this.ctx.createGain();
    plop.type = 'sine';
    plop.frequency.setValueAtTime(195 * pitchJitter, now);
    plop.frequency.exponentialRampToValueAtTime(520 * pitchJitter, now + 0.048);
    plop.frequency.exponentialRampToValueAtTime(340 * pitchJitter, now + 0.095);
    plopGain.gain.setValueAtTime(0.18, now);
    plopGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    plop.connect(plopGain);
    plopGain.connect(this.masterGain);
    plop.start(now);
    plop.stop(now + 0.12);

    // Subtle rubber thud
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(140 * pitchJitter, now);
    thud.frequency.exponentialRampToValueAtTime(58, now + 0.055);
    thudGain.gain.setValueAtTime(0.14, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    thud.connect(thudGain);
    thudGain.connect(this.masterGain);
    thud.start(now);
    thud.stop(now + 0.07);
  }

  playNetDeploy(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    // Crisp soft-nylon snap + airy bloom
    const len = Math.floor(this.ctx.sampleRate * 0.16);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * (1 - t * 0.4);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(2400, now + 0.12);
    filter.Q.value = 1.6;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);

    const chime = this.ctx.createOscillator();
    const cGain = this.ctx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(580, now);
    chime.frequency.exponentialRampToValueAtTime(860, now + 0.08);
    cGain.gain.setValueAtTime(0.055, now);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    chime.connect(cGain);
    cGain.connect(this.masterGain);
    chime.start(now);
    chime.stop(now + 0.12);
  }

  playPaperCapture(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    // Dreamy romantic shimmering bell arpeggio + paper flutter
    const notes = [587.33, 739.99, 880.0, 1174.66];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const t = now + idx * 0.075;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.52);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.56);
    });
    this.playPaperUnfold();
  }

  playPaperUnfold(): void {
    if (!this.ctx || !this.masterGain || !this.enabled) return;
    const now = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * 0.22);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const crinkle = Math.sin(t * Math.PI) * (0.6 + 0.4 * Math.sin(t * 48));
      data[i] = (Math.random() * 2 - 1) * crinkle;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
  }

  private ensureVinylPlayer(): VinylLofiPlayer | null {
    this.unlock();
    if (!this.ctx || !this.masterGain) return null;
    if (!this.vinylPlayer) {
      this.vinylPlayer = new VinylLofiPlayer(this.ctx, this.masterGain);
    }
    return this.vinylPlayer;
  }

  public cycleVinylTurntable(): { playing: boolean; trackIndex: number; track: LofiTrackSpec } {
    const vp = this.ensureVinylPlayer();
    if (!vp) {
      return { playing: false, trackIndex: 0, track: LOFI_TRACKS[0] };
    }
    return vp.cycleTurntable();
  }

  public nextVinylTrack(): { playing: boolean; trackIndex: number; track: LofiTrackSpec } {
    const vp = this.ensureVinylPlayer();
    if (!vp) {
      return { playing: false, trackIndex: 0, track: LOFI_TRACKS[0] };
    }
    return vp.nextTrack();
  }

  public toggleVinylPlayback(): { playing: boolean; trackIndex: number; track: LofiTrackSpec } {
    const vp = this.ensureVinylPlayer();
    if (!vp) {
      return { playing: false, trackIndex: 0, track: LOFI_TRACKS[0] };
    }
    return vp.toggle();
  }

  public getVinylState(): { playing: boolean; trackIndex: number; track: LofiTrackSpec } {
    if (!this.vinylPlayer) {
      return { playing: false, trackIndex: 0, track: LOFI_TRACKS[0] };
    }
    return this.vinylPlayer.getState();
  }

  public updateVinylSpatial(distanceMeters: number, room: RoomId): void {
    this.vinylPlayer?.updateSpatial(distanceMeters, room);
  }

  dispose(): void {
    try {
      this.vinylPlayer?.dispose();
      this.vinylPlayer = null;
      this.droneOsc?.stop();
      this.droneSub?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
  }
}
