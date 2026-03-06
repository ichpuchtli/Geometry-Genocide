import { SFX_NAMES, SFXName, MASTER_VOLUME, SFX_VOLUME, MUSIC_VOLUME } from '../config';

// ============================================================
// AudioManager — SFX + Procedural Music
// ============================================================

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private music: ProceduralMusic | null = null;
  private _muted = false;
  private _initialized = false;
  private _loading = false;

  get muted(): boolean { return this._muted; }
  get initialized(): boolean { return this._initialized; }

  /** Must be called from a user gesture (click/touch) */
  async init(): Promise<void> {
    if (this._initialized || this._loading) return;
    this._loading = true;

    try {
      this.ctx = new AudioContext();

      // Resume if suspended (Safari requirement)
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      // Gain chain: source -> sfx/musicGain -> masterGain -> destination
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = MASTER_VOLUME;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = SFX_VOLUME;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = MUSIC_VOLUME;
      this.musicGain.connect(this.masterGain);

      // Load all SFX
      await this.loadAllSFX();

      // Create procedural music
      this.music = new ProceduralMusic(this.ctx, this.musicGain);

      // Restore mute state from localStorage
      const stored = localStorage.getItem('gg_muted');
      if (stored === 'true') {
        this._muted = true;
        this.masterGain.gain.value = 0;
      }

      this._initialized = true;
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
    this._loading = false;
  }

  private async loadAllSFX(): Promise<void> {
    const promises = SFX_NAMES.map(async (name) => {
      try {
        const resp = await fetch(`./sounds/${name}.wav`);
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await this.ctx!.decodeAudioData(arrayBuf);
        this.buffers.set(name, audioBuf);
      } catch (e) {
        console.warn(`Failed to load SFX: ${name}`, e);
      }
    });
    await Promise.all(promises);
  }

  playSFX(name: SFXName): void {
    if (!this._initialized || !this.ctx || !this.sfxGain) return;
    const buf = this.buffers.get(name);
    if (!buf) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    source.connect(this.sfxGain);
    source.start(0);
  }

  toggleMute(): boolean {
    this._muted = !this._muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this._muted ? 0 : MASTER_VOLUME;
    }
    try {
      localStorage.setItem('gg_muted', String(this._muted));
    } catch { /* ignore */ }
    return this._muted;
  }

  /** Update music intensity (0 = ambient/menu, 1 = max chaos) */
  setMusicIntensity(intensity: number): void {
    if (this.music) this.music.setIntensity(intensity);
  }

  startMusic(): void {
    if (this.music) this.music.start();
  }

  stopMusic(): void {
    if (this.music) this.music.stop();
  }

  /** Procedural BlackHole death explosion — scales with absorbed count */
  playBlackHoleDeath(absorbed: number): void {
    if (!this._initialized || !this.ctx || !this.sfxGain) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const intensity = Math.min(absorbed / 12, 1);

    // 1. Deep sub-bass boom (swept sine 80Hz → 20Hz)
    const boom = ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(80 + intensity * 40, now);
    boom.frequency.exponentialRampToValueAtTime(20, now + 0.8);
    const boomGain = ctx.createGain();
    boomGain.gain.setValueAtTime(0.7 + intensity * 0.3, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2 + intensity * 0.5);
    boom.connect(boomGain);
    boomGain.connect(this.sfxGain);
    boom.start(now);
    boom.stop(now + 1.5 + intensity * 0.5);

    // 2. Noise burst (white noise through bandpass for crunch)
    const noiseLen = 1.0 + intensity * 0.8;
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseBP = ctx.createBiquadFilter();
    noiseBP.type = 'bandpass';
    noiseBP.frequency.setValueAtTime(400 + intensity * 600, now);
    noiseBP.frequency.exponentialRampToValueAtTime(80, now + noiseLen);
    noiseBP.Q.value = 1.5;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4 + intensity * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLen);
    noise.connect(noiseBP);
    noiseBP.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now);

    // 3. Reverb-like tail — descending tone cluster
    for (let i = 0; i < 3; i++) {
      const tail = ctx.createOscillator();
      tail.type = 'triangle';
      tail.frequency.setValueAtTime(200 + i * 80 + intensity * 100, now);
      tail.frequency.exponentialRampToValueAtTime(40 + i * 10, now + 1.5);
      const tGain = ctx.createGain();
      tGain.gain.setValueAtTime(0.12, now);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      tail.connect(tGain);
      tGain.connect(this.sfxGain);
      tail.start(now + 0.02 * i);
      tail.stop(now + 2.0);
    }
  }

  /** Resume AudioContext if suspended (call on user gesture) */
  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }
}

// ============================================================
// ProceduralMusic — 4-layer adaptive synthwave
// ============================================================

class ProceduralMusic {
  private ctx: AudioContext;
  private output: GainNode;
  private playing = false;
  private intensity = 0;

  // Layers
  private bassOsc: OscillatorNode | null = null;
  private bassGain: GainNode | null = null;
  private padOsc: OscillatorNode | null = null;
  private padOsc2: OscillatorNode | null = null;
  private padGain: GainNode | null = null;

  // Rhythm layer
  private rhythmInterval: number = 0;
  private rhythmGain: GainNode | null = null;

  // Arpeggio layer
  private arpInterval: number = 0;
  private arpGain: GainNode | null = null;
  private arpOsc: OscillatorNode | null = null;
  private arpNoteIndex = 0;

  // Lead layer
  private leadGain: GainNode | null = null;
  private leadOsc: OscillatorNode | null = null;
  private leadInterval: number = 0;
  private leadNoteIndex = 0;

  // Musical scales (A minor pentatonic for synthwave feel)
  private bassNotes = [55, 65.41, 73.42, 82.41]; // A1, C2, D2, E2
  private arpNotes = [220, 261.63, 293.66, 329.63, 392, 440]; // A3, C4, D4, E4, G4, A4
  private leadNotes = [440, 523.25, 587.33, 659.26, 783.99, 880]; // A4, C5, D5, E5, G5, A5

  private bassNoteIndex = 0;
  private bassChangeTimer = 0;

  constructor(ctx: AudioContext, output: GainNode) {
    this.ctx = ctx;
    this.output = output;
  }

  start(): void {
    if (this.playing) return;
    this.playing = true;

    // Layer 1: Bass — deep sawtooth through lowpass
    this.bassGain = this.ctx.createGain();
    this.bassGain.gain.value = 0.3;
    const bassFilter = this.ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.value = 200;
    bassFilter.Q.value = 2;
    this.bassOsc = this.ctx.createOscillator();
    this.bassOsc.type = 'sawtooth';
    this.bassOsc.frequency.value = this.bassNotes[0];
    this.bassOsc.connect(bassFilter);
    bassFilter.connect(this.bassGain);
    this.bassGain.connect(this.output);
    this.bassOsc.start();

    // Layer 1b: Pad — soft detuned triangle oscillators
    this.padGain = this.ctx.createGain();
    this.padGain.gain.value = 0.15;
    this.padOsc = this.ctx.createOscillator();
    this.padOsc.type = 'triangle';
    this.padOsc.frequency.value = 110;
    this.padOsc2 = this.ctx.createOscillator();
    this.padOsc2.type = 'triangle';
    this.padOsc2.frequency.value = 112; // slight detune for width
    this.padOsc.connect(this.padGain);
    this.padOsc2.connect(this.padGain);
    this.padGain.connect(this.output);
    this.padOsc.start();
    this.padOsc2.start();

    // Layer 2: Rhythm — periodic clicks/kicks
    this.rhythmGain = this.ctx.createGain();
    this.rhythmGain.gain.value = 0;
    this.rhythmGain.connect(this.output);
    this.startRhythm();

    // Layer 3: Arpeggio — fast notes
    this.arpGain = this.ctx.createGain();
    this.arpGain.gain.value = 0;
    const arpFilter = this.ctx.createBiquadFilter();
    arpFilter.type = 'lowpass';
    arpFilter.frequency.value = 2000;
    this.arpOsc = this.ctx.createOscillator();
    this.arpOsc.type = 'square';
    this.arpOsc.frequency.value = this.arpNotes[0];
    this.arpOsc.connect(arpFilter);
    arpFilter.connect(this.arpGain);
    this.arpGain.connect(this.output);
    this.arpOsc.start();
    this.startArpeggio();

    // Layer 4: Lead melody — sine with vibrato
    this.leadGain = this.ctx.createGain();
    this.leadGain.gain.value = 0;
    this.leadOsc = this.ctx.createOscillator();
    this.leadOsc.type = 'sine';
    this.leadOsc.frequency.value = this.leadNotes[0];
    this.leadOsc.connect(this.leadGain);
    this.leadGain.connect(this.output);
    this.leadOsc.start();
    this.startLead();

    this.setIntensity(0);
  }

  stop(): void {
    if (!this.playing) return;
    this.playing = false;

    // Stop all oscillators
    [this.bassOsc, this.padOsc, this.padOsc2, this.arpOsc, this.leadOsc].forEach(osc => {
      if (osc) { try { osc.stop(); } catch { /* ignore */ } }
    });

    // Clear intervals
    if (this.rhythmInterval) clearInterval(this.rhythmInterval);
    if (this.arpInterval) clearInterval(this.arpInterval);
    if (this.leadInterval) clearInterval(this.leadInterval);

    this.bassOsc = this.padOsc = this.padOsc2 = this.arpOsc = this.leadOsc = null;
  }

  setIntensity(val: number): void {
    this.intensity = Math.max(0, Math.min(1, val));
    if (!this.playing) return;

    const t = this.ctx.currentTime;
    const ramp = 0.5; // seconds to transition

    // Bass always plays; louder with intensity
    if (this.bassGain) {
      this.bassGain.gain.linearRampToValueAtTime(0.2 + this.intensity * 0.25, t + ramp);
    }

    // Pad fades slightly at high intensity
    if (this.padGain) {
      this.padGain.gain.linearRampToValueAtTime(0.15 - this.intensity * 0.05, t + ramp);
    }

    // Rhythm fades in after 0.2 intensity
    if (this.rhythmGain) {
      const rv = this.intensity > 0.2 ? Math.min((this.intensity - 0.2) / 0.3, 1) * 0.2 : 0;
      this.rhythmGain.gain.linearRampToValueAtTime(rv, t + ramp);
    }

    // Arpeggio fades in after 0.5 intensity
    if (this.arpGain) {
      const av = this.intensity > 0.5 ? Math.min((this.intensity - 0.5) / 0.3, 1) * 0.15 : 0;
      this.arpGain.gain.linearRampToValueAtTime(av, t + ramp);
    }

    // Lead fades in after 0.7 intensity (boss encounters)
    if (this.leadGain) {
      const lv = this.intensity > 0.7 ? Math.min((this.intensity - 0.7) / 0.3, 1) * 0.12 : 0;
      this.leadGain.gain.linearRampToValueAtTime(lv, t + ramp);
    }
  }

  private startRhythm(): void {
    const kick = () => {
      if (!this.playing || !this.ctx || !this.rhythmGain) return;
      // Create a quick noise burst for percussion
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 80;
      const env = this.ctx.createGain();
      env.gain.value = 0.8;
      env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      osc.connect(env);
      env.connect(this.rhythmGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
      // Frequency drop for kick feel
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.08);
    };

    // Tempo varies with intensity (120-160 BPM)
    const bpm = () => 120 + this.intensity * 40;
    const scheduleNext = () => {
      if (!this.playing) return;
      kick();
      this.rhythmInterval = window.setTimeout(scheduleNext, 60000 / bpm());
    };
    scheduleNext();
  }

  private startArpeggio(): void {
    const step = () => {
      if (!this.playing || !this.arpOsc) return;
      const note = this.arpNotes[this.arpNoteIndex % this.arpNotes.length];
      this.arpOsc.frequency.setValueAtTime(note, this.ctx.currentTime);
      this.arpNoteIndex++;
    };

    // Arpeggio speed: 8th notes at current BPM
    const bpm = () => 120 + this.intensity * 40;
    const scheduleNext = () => {
      if (!this.playing) return;
      step();
      this.arpInterval = window.setTimeout(scheduleNext, 60000 / bpm() / 2);
    };
    scheduleNext();
  }

  private startLead(): void {
    const step = () => {
      if (!this.playing || !this.leadOsc) return;
      const note = this.leadNotes[this.leadNoteIndex % this.leadNotes.length];
      this.leadOsc.frequency.setValueAtTime(note, this.ctx.currentTime);
      this.leadNoteIndex++;
    };

    const bpm = () => 120 + this.intensity * 40;
    const scheduleNext = () => {
      if (!this.playing) return;
      step();
      this.leadInterval = window.setTimeout(scheduleNext, 60000 / bpm());
    };
    scheduleNext();
  }
}
