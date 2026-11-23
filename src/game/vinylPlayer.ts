import type { RoomId } from './types';

export interface LofiTrackSpec {
  id: string;
  side: string;
  title: string;
  englishTitle: string;
  bpm: number;
  swing: number;
  labelHex: number;
  accentHex: number;
  sleeveVariantIdx: number;
  moodNote: string;
  /** Gentle sparse electric piano solo phrases (64 eighth/sixteenth steps over 4 bars; null = breathing rest) */
  soloSteps: (number | null)[];
  /** Ethereal crystalline natural harmonic overtone chimes (MIDI note, +12/+19 overtone glow; null = silence) */
  harmonicSteps: (number | null)[];
  /** Whisper-quiet warm left-hand electric piano harmonic anchors per bar (arpeggiated gently, 2–3 notes max) */
  anchorVoicings: number[][];
  /** Tine brightness multiplier (kept silky & delicate, never harsh) */
  tineBrightness: number;
  /** Harmonic shimmer presence (0..1) */
  harmonicGlow: number;
}

/**
 * Four serene, minimal Electric Piano & Ethereal Harmonic Solo pieces
 * tailored to the quiet twilight/daylight/midnight apartment atmosphere.
 * Zero drums, zero noisy sawtooth synth pads, zero heavy cavern reverb.
 */
export const LOFI_TRACKS: LofiTrackSpec[] = [
  {
    id: 'window_harmonics',
    side: 'SIDE A · 01',
    title: '窗边泛音',
    englishTitle: 'Windowpane Harmonics',
    bpm: 58,
    swing: 0.08,
    labelHex: 0xf2b58e,
    accentHex: 0x4b3b64,
    sleeveVariantIdx: 0,
    moodNote: '58 BPM · Fmaj9 – Em7 – Dm9 – Cmaj9 · 空灵电钢琴独奏与清透自然泛音',
    anchorVoicings: [
      [53, 60, 64], // F3, C4, E4 (open warm fifth + seventh)
      [52, 59, 62], // E3, B3, D4
      [50, 57, 60], // D3, A3, C4
      [48, 55, 59], // C3, G3, B3
    ],
    soloSteps: [
      // Bar 1 (Fmaj9) — gentle breathing melody
      null, null, 72, null, null, null, 76, null, null, null, 74, null, null, null, null, null,
      // Bar 2 (Em7)
      null, null, null, 71, null, null, null, 74, null, null, 72, null, null, null, 67, null,
      // Bar 3 (Dm9)
      null, null, 69, null, null, null, 72, null, null, null, 76, null, null, 74, null, null,
      // Bar 4 (Cmaj9) — open quiet resolution
      null, null, null, 71, null, null, null, null, null, 72, null, null, null, null, null, null,
    ],
    harmonicSteps: [
      // Delicate floating high natural harmonics in the pauses
      84, null, null, null, null, null, null, null, 88, null, null, null, null, null, 86, null,
      null, null, null, null, null, 83, null, null, null, null, null, null, 86, null, null, null,
      81, null, null, null, null, null, null, null, null, 88, null, null, null, null, null, null,
      null, null, null, null, 84, null, null, null, null, null, null, 91, null, null, null, null,
    ],
    tineBrightness: 0.78,
    harmonicGlow: 0.88,
  },
  {
    id: 'twilight_keys',
    side: 'SIDE A · 02',
    title: '暮色琴键',
    englishTitle: 'Dusk Tine Soliloquy',
    bpm: 56,
    swing: 0.10,
    labelHex: 0x9cd2d6,
    accentHex: 0x3b536b,
    sleeveVariantIdx: 2,
    moodNote: '56 BPM · Ebmaj9 – Cm9 – Abmaj7 – Bb6 · 轻柔罗德电钢与星尘泛音留白',
    anchorVoicings: [
      [51, 58, 62], // Eb3, Bb3, D4
      [48, 55, 58], // C3, G3, Bb3
      [44, 51, 55], // Ab2, Eb3, G3
      [46, 53, 58], // Bb2, F3, Bb3
    ],
    soloSteps: [
      // Bar 1 (Ebmaj9)
      null, null, 70, null, null, null, null, 74, null, null, null, 72, null, null, null, null,
      // Bar 2 (Cm9)
      null, null, null, 75, null, null, 74, null, null, null, 70, null, null, null, null, null,
      // Bar 3 (Abmaj7)
      null, null, 67, null, null, null, 72, null, null, null, null, 70, null, null, 67, null,
      // Bar 4 (Bb6)
      null, null, null, 69, null, null, null, null, null, 70, null, null, null, null, null, null,
    ],
    harmonicSteps: [
      null, null, null, null, 82, null, null, null, null, null, null, null, null, 86, null, null,
      null, null, null, null, null, null, null, null, 87, null, null, null, null, null, 82, null,
      79, null, null, null, null, null, null, null, null, 84, null, null, null, null, null, null,
      null, null, null, null, null, 82, null, null, null, null, null, null, 86, null, null, null,
    ],
    tineBrightness: 0.72,
    harmonicGlow: 0.92,
  },
  {
    id: 'dust_and_moonlight',
    side: 'SIDE B · 01',
    title: '微尘与月光',
    englishTitle: 'Motes in Moonlight',
    bpm: 60,
    swing: 0.06,
    labelHex: 0xf4cf84,
    accentHex: 0x5c4738,
    sleeveVariantIdx: 4,
    moodNote: '60 BPM · Dmaj9 – Bm9 – Gmaj9 – Asus2 · 透明高音泛音与安静午夜琴声',
    anchorVoicings: [
      [50, 57, 61], // D3, A3, C#4
      [47, 54, 57], // B2, F#3, A3
      [43, 50, 54], // G2, D3, F#3
      [45, 52, 57], // A2, E3, A3
    ],
    soloSteps: [
      // Bar 1 (Dmaj9)
      null, null, 73, null, null, null, 76, null, null, null, null, 74, null, null, null, null,
      // Bar 2 (Bm9)
      null, null, null, 69, null, null, null, 73, null, null, null, null, 71, null, null, null,
      // Bar 3 (Gmaj9)
      null, null, 66, null, null, null, 71, null, null, null, 74, null, null, null, 73, null,
      // Bar 4 (Asus2)
      null, null, null, 69, null, null, null, null, null, null, 73, null, null, null, null, null,
    ],
    harmonicSteps: [
      85, null, null, null, null, null, null, null, null, 88, null, null, null, null, null, null,
      null, null, null, null, null, 81, null, null, null, null, null, null, null, null, 85, null,
      null, null, null, null, 83, null, null, null, null, null, null, null, 90, null, null, null,
      null, null, null, null, null, null, 88, null, null, null, null, null, null, 85, null, null,
    ],
    tineBrightness: 0.84,
    harmonicGlow: 0.95,
  },
  {
    id: 'still_afternoon',
    side: 'SIDE B · 02',
    title: '静止的午后',
    englishTitle: 'Still Afternoon Air',
    bpm: 54,
    swing: 0.08,
    labelHex: 0xc5b2e0,
    accentHex: 0x3b3556,
    sleeveVariantIdx: 6,
    moodNote: '54 BPM · Am9 – Fmaj9 – Cmaj9 – G6 · 极简冥想电钢琴与空灵泛音回响',
    anchorVoicings: [
      [45, 52, 59], // A2, E3, B3
      [41, 48, 55], // F2, C3, G3
      [48, 55, 59], // C3, G3, B3
      [43, 50, 55], // G2, D3, G3
    ],
    soloSteps: [
      // Bar 1 (Am9)
      null, null, 72, null, null, null, null, 71, null, null, null, 69, null, null, null, null,
      // Bar 2 (Fmaj9)
      null, null, null, 67, null, null, null, 72, null, null, null, null, null, 76, null, null,
      // Bar 3 (Cmaj9)
      null, null, 74, null, null, null, 71, null, null, null, null, 67, null, null, null, null,
      // Bar 4 (G6)
      null, null, null, 69, null, null, null, null, null, 71, null, null, null, null, null, null,
    ],
    harmonicSteps: [
      null, null, null, null, 84, null, null, null, null, null, null, null, null, null, 83, null,
      null, null, null, null, null, null, null, null, 88, null, null, null, null, null, null, null,
      86, null, null, null, null, null, null, null, null, 83, null, null, null, null, null, null,
      null, null, null, null, null, 86, null, null, null, null, null, null, 91, null, null, null,
    ],
    tineBrightness: 0.74,
    harmonicGlow: 0.90,
  },
];

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Creates a clean, transparent, short intimate apartment room air impulse (1.35s)
 * so electric piano harmonics bloom lightly without muddy cavern wash.
 */
function createIntimateAirImpulse(ctx: AudioContext, duration = 1.35, decay = 3.2): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * duration);
  const impulse = ctx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp = 0;
    const preDelaySamples = Math.floor(rate * (0.012 + ch * 0.004));
    for (let i = 0; i < length; i++) {
      if (i < preDelaySamples) {
        data[i] = 0;
        continue;
      }
      const t = (i - preDelaySamples) / (length - preDelaySamples);
      const fadeIn = Math.min(1, (i - preDelaySamples) / (rate * 0.016));
      const env = Math.pow(1 - t, decay) * fadeIn;
      const white = Math.random() * 2 - 1;
      // Gentle natural room air smoothing
      const alpha = 0.36 * (1 - t * 0.55) + 0.08;
      lp += alpha * (white - lp);
      data[i] = lp * env * 0.52;
    }
  }
  return impulse;
}

/**
 * Generates an ultra-soft, whisper-quiet vinyl surface warmth buffer (barely audible patina).
 */
function createWhisperVinylBuffer(ctx: AudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const duration = 6.0;
  const len = Math.floor(rate * duration);
  const buf = ctx.createBuffer(2, len, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let pink = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      pink = 0.975 * pink + 0.025 * white;
      let sample = pink * 0.09;

      // Occasional delicate needle dust speck
      const r = Math.random();
      if (r < 0.00011) {
        sample += (Math.random() > 0.5 ? 1 : -1) * (0.07 + Math.random() * 0.08);
      }

      const edge = Math.min(i, len - 1 - i);
      if (edge < 1000) {
        sample *= edge / 1000;
      }
      data[i] = sample;
    }
  }
  return buf;
}

/**
 * Serene, Intimate Electric Piano & Ethereal Harmonic Solo Engine.
 * Focused purely on velvety Rhodes/celeste-tine electric piano phrasing and
 * crystalline floating high natural harmonics with calm breathing rests and transparent room air.
 */
export class VinylLofiPlayer {
  private ctx: AudioContext;
  private outGain: GainNode;
  private spatialFilter: BiquadFilterNode;
  private dryBus: GainNode;
  private airSend: GainNode;
  private airNode: ConvolverNode;
  private airReturn: GainNode;
  private crackleGain: GainNode;
  private crackleSrc: AudioBufferSourceNode | null = null;
  private crackleBuffer: AudioBuffer;

  private trackIndex = 0;
  private playing = false;
  private schedulerId: number | null = null;
  private nextStepTime = 0;
  private currentStep = 0;
  private phraseCycle = 0;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;

    // Spatial distance/room filter + gentle master fader
    this.spatialFilter = ctx.createBiquadFilter();
    this.spatialFilter.type = 'lowpass';
    this.spatialFilter.frequency.value = 8800;
    this.spatialFilter.Q.value = 0.5;

    this.outGain = ctx.createGain();
    this.outGain.gain.value = 0.0001;

    // Clean direct bus (zero distortion, zero harsh compression)
    this.dryBus = ctx.createGain();
    this.dryBus.gain.value = 0.92;

    // Light, airy, transparent short room halo (low wet mix so sound stays clear & close)
    this.airSend = ctx.createGain();
    this.airSend.gain.value = 0.30;

    this.airNode = ctx.createConvolver();
    this.airNode.buffer = createIntimateAirImpulse(ctx, 1.35, 3.2);

    const airTone = ctx.createBiquadFilter();
    airTone.type = 'highpass';
    airTone.frequency.value = 320;

    const airSmooth = ctx.createBiquadFilter();
    airSmooth.type = 'lowpass';
    airSmooth.frequency.value = 4600;

    this.airReturn = ctx.createGain();
    this.airReturn.gain.value = 0.24;

    // Wire clean audio graph: dryBus + subtle airReturn -> spatialFilter -> outGain -> destination
    this.dryBus.connect(this.spatialFilter);
    this.airSend.connect(this.airNode);
    this.airNode.connect(airTone);
    airTone.connect(airSmooth);
    airSmooth.connect(this.airReturn);
    this.airReturn.connect(this.spatialFilter);

    this.spatialFilter.connect(this.outGain);
    this.outGain.connect(destination);

    // Whisper-soft vinyl surface warmth (barely audible patina)
    this.crackleBuffer = createWhisperVinylBuffer(ctx);
    const crackleLp = ctx.createBiquadFilter();
    crackleLp.type = 'lowpass';
    crackleLp.frequency.value = 3400;
    this.crackleGain = ctx.createGain();
    this.crackleGain.gain.value = 0.0001;
    this.crackleGain.connect(crackleLp);
    crackleLp.connect(this.spatialFilter);
  }

  public getState(): { playing: boolean; trackIndex: number; track: LofiTrackSpec } {
    return {
      playing: this.playing,
      trackIndex: this.trackIndex,
      track: LOFI_TRACKS[this.trackIndex],
    };
  }

  public start(trackIndex?: number): { playing: boolean; trackIndex: number; track: LofiTrackSpec } {
    if (typeof trackIndex === 'number') {
      this.trackIndex = ((trackIndex % LOFI_TRACKS.length) + LOFI_TRACKS.length) % LOFI_TRACKS.length;
    }

    const now = this.ctx.currentTime;
    this.triggerSoftNeedleTouch(now);

    if (!this.crackleSrc) {
      this.crackleSrc = this.ctx.createBufferSource();
      this.crackleSrc.buffer = this.crackleBuffer;
      this.crackleSrc.loop = true;
      this.crackleSrc.connect(this.crackleGain);
      this.crackleSrc.start(now);
    }

    this.playing = true;
    this.currentStep = 0;
    this.phraseCycle = 0;
    this.nextStepTime = now + 0.18;

    this.outGain.gain.cancelScheduledValues(now);
    this.outGain.gain.setTargetAtTime(0.54, now, 0.25);

    this.crackleGain.gain.cancelScheduledValues(now);
    this.crackleGain.gain.setTargetAtTime(0.016, now, 0.35);

    if (this.schedulerId === null) {
      this.schedulerId = window.setInterval(() => this.scheduleAhead(), 60);
    }
    this.scheduleAhead();
    return this.getState();
  }

  public pause(): { playing: boolean; trackIndex: number; track: LofiTrackSpec } {
    if (!this.playing) return this.getState();
    this.playing = false;

    const now = this.ctx.currentTime;
    this.outGain.gain.cancelScheduledValues(now);
    this.outGain.gain.setTargetAtTime(0.0001, now, 0.16);

    this.crackleGain.gain.cancelScheduledValues(now);
    this.crackleGain.gain.setTargetAtTime(0.0001, now, 0.14);

    if (this.schedulerId !== null) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    return this.getState();
  }

  public toggle(): { playing: boolean; trackIndex: number; track: LofiTrackSpec } {
    return this.playing ? this.pause() : this.start(this.trackIndex);
  }

  public nextTrack(): { playing: boolean; trackIndex: number; track: LofiTrackSpec } {
    const nextIdx = (this.trackIndex + 1) % LOFI_TRACKS.length;
    this.trackIndex = nextIdx;
    this.currentStep = 0;
    this.phraseCycle = 0;
    if (!this.playing) {
      return this.start(nextIdx);
    }
    const now = this.ctx.currentTime;
    this.triggerSoftNeedleTouch(now);
    this.nextStepTime = now + 0.20;
    return this.getState();
  }

  public cycleTurntable(): { playing: boolean; trackIndex: number; track: LofiTrackSpec } {
    if (!this.playing) {
      return this.start(this.trackIndex);
    }
    if (this.trackIndex >= LOFI_TRACKS.length - 1) {
      this.trackIndex = 0;
      return this.pause();
    }
    return this.nextTrack();
  }

  /**
   * Gentle spatial roll-off so the solo feels intimate near the living room turntable
   * and softly muffled when wandering into the kitchen, bedroom, or bathroom.
   */
  public updateSpatial(distanceMeters: number, currentRoom: RoomId): void {
    if (!this.playing) return;
    const now = this.ctx.currentTime;

    let roomMul = 1.0;
    let cutoff = 8800;
    if (currentRoom === 'living') {
      roomMul = 1.0;
      cutoff = 8800;
    } else if (currentRoom === 'kitchen' || currentRoom === 'dining' || currentRoom === 'entryway') {
      roomMul = 0.56;
      cutoff = 2800;
    } else if (currentRoom === 'bedroom' || currentRoom === 'bathroom') {
      roomMul = 0.34;
      cutoff = 1650;
    } else {
      roomMul = 0.20;
      cutoff = 1100;
    }

    const distAtten = 1 / (1 + Math.max(0, distanceMeters - 1.4) * 0.14);
    const targetGain = Math.max(0.06, Math.min(0.56, 0.54 * roomMul * distAtten));
    const targetCutoff = Math.max(900, Math.min(9200, cutoff * (0.68 + 0.32 * distAtten)));

    this.outGain.gain.setTargetAtTime(targetGain, now, 0.28);
    this.spatialFilter.frequency.setTargetAtTime(targetCutoff, now, 0.28);
  }

  /**
   * Delicate tactile vinyl stylus touch when starting or changing records.
   */
  private triggerSoftNeedleTouch(time: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(105, time);
    osc.frequency.exponentialRampToValueAtTime(52, time + 0.045);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(0.06, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.055);

    osc.connect(g);
    g.connect(this.spatialFilter);
    osc.start(time);
    osc.stop(time + 0.065);
  }

  private scheduleAhead(): void {
    if (!this.playing) return;
    const lookahead = 0.26;
    while (this.nextStepTime < this.ctx.currentTime + lookahead) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }
  }

  private advanceStep(): void {
    const track = LOFI_TRACKS[this.trackIndex];
    const sixteenth = 60 / track.bpm / 4;
    const isOdd = this.currentStep % 2 === 1;
    const swingOffset = isOdd ? -sixteenth * track.swing * 0.35 : sixteenth * track.swing * 0.35;
    this.nextStepTime += sixteenth + swingOffset;
    this.currentStep = (this.currentStep + 1) % 64;
    if (this.currentStep === 0) {
      this.phraseCycle = (this.phraseCycle + 1) % 4;
    }
  }

  private scheduleStep(step: number, time: number): void {
    const track = LOFI_TRACKS[this.trackIndex];
    const barIdx = Math.floor(step / 16);
    const stepInBar = step % 16;
    const barDuration = (60 / track.bpm) * 4;
    const anchor = track.anchorVoicings[barIdx % track.anchorVoicings.length];

    // 1. Whisper-soft left-hand electric piano harmonic anchor at bar start (gently rolled arpeggio)
    if (stepInBar === 0) {
      anchor.forEach((midi, idx) => {
        const roll = idx * 0.058 + (Math.random() - 0.5) * 0.008;
        const vel = (idx === 0 ? 0.50 : 0.38) * (0.92 + Math.random() * 0.14);
        this.triggerElectricPianoNote(
          midi,
          time + roll,
          barDuration * 0.88,
          vel,
          track.tineBrightness * 0.65,
          -0.22 + idx * 0.14
        );
      });
    }

    // Occasional delicate mid-bar echo of the top anchor tone for gentle breath
    if (stepInBar === 10 && (barIdx + this.phraseCycle) % 2 === 1) {
      const topAnchor = anchor[anchor.length - 1];
      this.triggerElectricPianoNote(
        topAnchor + 12,
        time + 0.012,
        barDuration * 0.45,
        0.24,
        track.tineBrightness * 0.72,
        0.18
      );
    }

    // 2. Primary Voice: Expressive Solo Electric Piano Phrase
    const soloMidi = track.soloSteps[step];
    if (soloMidi !== null && soloMidi !== undefined) {
      const rubato = (Math.random() - 0.5) * 0.016;
      const vel = 0.68 + Math.random() * 0.16;
      const pan = Math.sin(step * 0.45) * 0.24;
      this.triggerElectricPianoNote(
        soloMidi,
        Math.max(this.ctx.currentTime, time + rubato),
        barDuration * 0.62,
        vel,
        track.tineBrightness,
        pan
      );

      // Subtle sympathetic natural harmonic overtone blooming softly above key solo notes
      if (this.phraseCycle % 2 === 0 || stepInBar >= 8) {
        const overtoneShift = step % 3 === 0 ? 19 : 12; // 12 = octave, 19 = octave + fifth
        this.triggerEtherealHarmonic(
          soloMidi + overtoneShift,
          Math.max(this.ctx.currentTime, time + rubato + 0.022),
          barDuration * 0.52,
          0.26 * track.harmonicGlow,
          -pan * 0.85
        );
      }
    }

    // 3. Dedicated Ethereal Natural Harmonics Solo (crystalline bell-like overtones in the rests!)
    const harmMidi = track.harmonicSteps[step];
    if (harmMidi !== null && harmMidi !== undefined) {
      // Gently vary octave/voicing across 4-bar cycles so the solo feels live & never mechanical
      const octaveLift = this.phraseCycle === 3 && stepInBar > 8 ? 12 : 0;
      const finalMidi = Math.min(98, harmMidi + octaveLift);
      const rubato = (Math.random() - 0.5) * 0.020;
      const pan = Math.cos(step * 0.37) * 0.38;
      this.triggerEtherealHarmonic(
        finalMidi,
        Math.max(this.ctx.currentTime, time + rubato),
        barDuration * 0.68,
        (0.48 + Math.random() * 0.12) * track.harmonicGlow,
        pan
      );
    }
  }

  /**
   * Velvety Electric Piano (Rhodes / Celeste-Tine) voice:
   * Pure warm fundamental sine + gentle 2nd harmonic body + soft transient FM tine bell strike.
   */
  private triggerElectricPianoNote(
    midi: number,
    time: number,
    duration: number,
    velocity: number,
    tineBrightness: number,
    panValue: number
  ): void {
    const freq = midiToFreq(midi);

    // 1. Warm pure fundamental carrier
    const carrier = this.ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.setValueAtTime(freq, time);

    // 2. Delicate FM tine strike (ratio 7.0 or 3.0 depending on register, decays fast into pure warmth)
    const tineMod = this.ctx.createOscillator();
    tineMod.type = 'sine';
    tineMod.frequency.setValueAtTime(freq * (midi >= 70 ? 3.0 : 4.0), time);

    const tineIdx = this.ctx.createGain();
    const peakFm = freq * 0.42 * tineBrightness * velocity;
    tineIdx.gain.setValueAtTime(peakFm, time);
    tineIdx.gain.exponentialRampToValueAtTime(0.01, time + 0.085);

    tineMod.connect(tineIdx);
    tineIdx.connect(carrier.frequency);

    // 3. Soft woody 2nd harmonic body (fades slightly faster than fundamental)
    const bodyOsc = this.ctx.createOscillator();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(freq * 2.0, time);
    const bodyGain = this.ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.linearRampToValueAtTime(0.036 * velocity, time + 0.010);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + duration * 0.45);

    // 4. Main silky envelope (soft felt-hammer attack, long singing decay)
    const env = this.ctx.createGain();
    const peak = 0.135 * velocity;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peak, time + 0.012);
    env.gain.exponentialRampToValueAtTime(peak * 0.36, time + duration * 0.40);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    // Gentle warmth tone filter
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2400 + velocity * 1400, time);
    lp.frequency.exponentialRampToValueAtTime(980, time + duration * 0.65);

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-0.5, Math.min(0.5, panValue)), time);

    carrier.connect(env);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(lp);
    env.connect(lp);
    lp.connect(panner);

    panner.connect(this.dryBus);
    panner.connect(this.airSend);

    carrier.start(time);
    tineMod.start(time);
    bodyOsc.start(time);

    const stopAt = time + duration + 0.08;
    carrier.stop(stopAt);
    tineMod.stop(time + 0.12);
    bodyOsc.stop(stopAt);
  }

  /**
   * Ethereal Crystalline Natural Harmonic voice (空灵泛音):
   * Pure glassy harmonic sine + whisper-soft 2x shimmer overtone with gentle bloom attack
   * and airy floating decay — evokes plucked tine harmonics hanging in sunlit dust.
   */
  private triggerEtherealHarmonic(
    midi: number,
    time: number,
    duration: number,
    velocity: number,
    panValue: number
  ): void {
    const freq = midiToFreq(midi);

    // Primary pure harmonic sine
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    // Subtle crystalline upper shimmer (exact harmonic octave with delicate micro-detune)
    const shimmer = this.ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(freq * 2.0, time);
    shimmer.detune.setValueAtTime(2.5, time);

    const shimmerGain = this.ctx.createGain();
    shimmerGain.gain.setValueAtTime(0.0001, time);
    shimmerGain.gain.linearRampToValueAtTime(0.016 * velocity, time + 0.028);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, time + duration * 0.55);

    // Soft glassy bloom envelope (no sharp transient click, pure airy shimmer)
    const env = this.ctx.createGain();
    const peak = 0.068 * velocity;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.linearRampToValueAtTime(peak, time + 0.024);
    env.gain.exponentialRampToValueAtTime(peak * 0.28, time + duration * 0.48);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-0.55, Math.min(0.55, panValue)), time);

    osc.connect(env);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(panner);
    env.connect(panner);

    // Balanced direct + light air send so harmonics float cleanly in the room
    panner.connect(this.dryBus);
    panner.connect(this.airSend);

    osc.start(time);
    shimmer.start(time);

    const stopAt = time + duration + 0.08;
    osc.stop(stopAt);
    shimmer.stop(stopAt);
  }

  public dispose(): void {
    this.pause();
    try {
      this.crackleSrc?.stop();
    } catch {
      // ignore
    }
    this.crackleSrc = null;
  }
}
