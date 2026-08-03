/**
 * The colony's sound, generated entirely in code.
 *
 * The project ships no audio files, so every sound here is synthesised with the
 * Web Audio API: filtered noise for wind, stacked oscillators for machinery,
 * short enveloped tones for the interface. That keeps the download at zero
 * bytes and means a sound can be tuned by changing a number rather than by
 * re-recording anything.
 *
 * Browsers refuse to start audio before a user gesture, so nothing is created
 * until `unlock()` is called from a real click. Everything is a no-op until
 * then rather than throwing.
 */

export type SoundName =
  | 'click'
  | 'place'
  | 'invalid'
  | 'complete'
  | 'alert'
  | 'unlock'
  | 'demolish';

/** Length of the looping noise buffer used for wind, in seconds. */
const NOISE_SECONDS = 4;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambienceGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;

  private windFilter: BiquadFilterNode | null = null;
  private hum: OscillatorNode | null = null;
  private humGain: GainNode | null = null;

  private muted = false;
  private started = false;

  get isMuted(): boolean {
    return this.muted;
  }

  get isRunning(): boolean {
    return this.started;
  }

  /**
   * Creates the audio graph. Must be called from a user gesture.
   *
   * Safe to call repeatedly - subsequent calls only resume a suspended context,
   * which is what happens when a tab is backgrounded and returned to.
   */
  unlock(): void {
    if (typeof window === 'undefined') return;

    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }

    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;

      const ctx = new Ctor();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(ctx.destination);

      this.ambienceGain = ctx.createGain();
      this.ambienceGain.gain.value = 0;
      this.ambienceGain.connect(this.master);

      this.effectsGain = ctx.createGain();
      this.effectsGain.gain.value = 0.55;
      this.effectsGain.connect(this.master);

      this.buildAmbience(ctx);
      this.started = true;
    } catch {
      // Audio is a nicety; never let it take the game down.
      this.ctx = null;
    }
  }

  /**
   * Wind and machinery.
   *
   * Mars' atmosphere is about 1% of Earth's, so real Martian wind is a thin
   * hiss rather than a roar however fast it blows - hence a high-passed, quiet
   * noise bed rather than the low rumble the ear expects from wind on Earth.
   */
  private buildAmbience(ctx: AudioContext): void {
    const frames = ctx.sampleRate * NOISE_SECONDS;
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Brown-ish noise: integrated white noise, which sounds far less harsh.
    let last = 0;
    for (let i = 0; i < frames; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 620;
    filter.Q.value = 0.7;
    this.windFilter = filter;

    source.connect(filter);
    filter.connect(this.ambienceGain!);
    source.start();

    // Life-support hum: two detuned oscillators, barely audible, that give the
    // colony a sense of running machinery.
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 54;

    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 160;

    const humGain = ctx.createGain();
    humGain.gain.value = 0.0;

    hum.connect(humFilter);
    humFilter.connect(humGain);
    humGain.connect(this.ambienceGain!);
    hum.start();

    this.hum = hum;
    this.humGain = humGain;
  }

  /**
   * Drives the ambience from the world.
   *
   * @param wind      0-1, rises during dust storms
   * @param night     0-1, night factor
   * @param machinery 0-1, roughly how much plant is running
   */
  update(wind: number, night: number, machinery: number): void {
    if (!this.ctx || !this.ambienceGain) return;

    const now = this.ctx.currentTime;

    // Ramp rather than set: an instant gain change is an audible click.
    const level = 0.05 + wind * 0.22;
    this.ambienceGain.gain.setTargetAtTime(level, now, 1.2);

    if (this.windFilter) {
      // Wind brightens as it strengthens.
      this.windFilter.frequency.setTargetAtTime(560 + wind * 900, now, 1.5);
    }

    if (this.humGain) {
      // Machinery is quieter at night when fewer plants are staffed.
      const target = Math.min(0.05, machinery * 0.05) * (1 - night * 0.35);
      this.humGain.gain.setTargetAtTime(target, now, 2);
    }
  }

  /** Short synthesised interface and event sounds. */
  play(name: SoundName): void {
    const ctx = this.ctx;
    const out = this.effectsGain;
    if (!ctx || !out || this.muted) return;

    const now = ctx.currentTime;

    const tone = (
      frequency: number,
      duration: number,
      type: OscillatorType,
      gain: number,
      slideTo?: number,
    ) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);
      if (slideTo !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + duration);
      }

      // Fast attack, exponential decay - the shape of almost every UI sound.
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(gain, now + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(env);
      env.connect(out);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    };

    switch (name) {
      case 'click':
        tone(880, 0.05, 'triangle', 0.1);
        break;
      case 'place':
        // A low thump plus a confirming fifth above it.
        tone(150, 0.16, 'sine', 0.28, 90);
        tone(520, 0.1, 'triangle', 0.09);
        break;
      case 'invalid':
        tone(180, 0.14, 'square', 0.08, 120);
        break;
      case 'complete':
        tone(523, 0.1, 'triangle', 0.12);
        window.setTimeout(() => tone(784, 0.16, 'triangle', 0.12), 90);
        break;
      case 'unlock':
        tone(659, 0.1, 'sine', 0.11);
        window.setTimeout(() => tone(988, 0.22, 'sine', 0.11), 110);
        break;
      case 'alert':
        tone(440, 0.18, 'square', 0.1);
        window.setTimeout(() => tone(370, 0.24, 'square', 0.1), 190);
        break;
      case 'demolish':
        tone(120, 0.28, 'sawtooth', 0.16, 60);
        break;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.08);
    }
  }
}

export const audio = new AudioEngine();
