import type { AudioEngine } from "../piano/types";
import { noteToMidi } from "../piano/noteMapper";
import { ensureAudioContextRunning, getOrCreateAudioContext } from "./sharedAudioContext";

interface SynthVoice {
  gain: GainNode;
  osc: OscillatorNode;
}

interface SoundfontVoice {
  stop: (when?: number) => void;
}

interface SoundfontModule {
  instrument: (
    ctx: AudioContext,
    instrument: string,
    options?: {
      soundfont?: string;
      nameToUrl?: (name: string, soundfont: string, format: string) => string;
    },
  ) => Promise<{
    play: (midi: number, when?: number, opts?: { gain?: number }) => SoundfontVoice;
  }>;
}

export class WebAudioEngine implements AudioEngine {
  private ctx: AudioContext | null = null;

  private releaseMs = 500;

  private mode: "synth" | "soundfont" = "synth";

  private synthVoices = new Map<number, SynthVoice>();

  private soundfontVoices = new Map<number, SoundfontVoice>();

  private soundfontInstrument: {
    play: (midi: number, when?: number, opts?: { gain?: number }) => SoundfontVoice;
  } | null = null;

  async init(): Promise<void> {
    if (!this.ctx) {
      this.ctx = getOrCreateAudioContext();
    }
    this.ctx = await ensureAudioContextRunning();
  }

  setMode(mode: "synth" | "soundfont"): void {
    this.mode = mode;
  }

  async loadSoundfont(instrument: string): Promise<void> {
    await this.init();
    if (!this.ctx) {
      throw new Error("AudioContext is unavailable.");
    }

    const mod = (await import("soundfont-player")) as { default: SoundfontModule };
    const Soundfont = mod.default;

    const localBase = (import.meta.env.VITE_LOCAL_SOUNDFONT_BASE as string | undefined) || "/soundfonts";
    const nameToUrl = (name: string, soundfont: string, format: string): string =>
      `${localBase}/${name}-${soundfont}.${format}.js`;

    try {
      this.soundfontInstrument = await Soundfont.instrument(this.ctx, instrument, {
        soundfont: "MusyngKite",
        nameToUrl,
      });
      return;
    } catch {
      this.soundfontInstrument = await Soundfont.instrument(this.ctx, instrument, {
        soundfont: "MusyngKite",
      });
    }
  }

  setReleaseMs(ms: number): void {
    this.releaseMs = Math.max(0, Math.min(3000, ms));
  }

  play(note: number, velocity: number): void {
    if (!this.ctx) {
      return;
    }

    if (this.mode === "soundfont" && this.soundfontInstrument) {
      this.stop(note);
      const voice = this.soundfontInstrument.play(noteToMidi(note), this.ctx.currentTime, {
        gain: velocity / 127,
      });
      this.soundfontVoices.set(note, voice);
      return;
    }

    this.playSynth(note, velocity);
  }

  stop(note: number): void {
    if (!this.ctx) {
      return;
    }

    const synthVoice = this.synthVoices.get(note);
    if (synthVoice) {
      const now = this.ctx.currentTime;
      const releaseSec = this.releaseMs / 1000;
      synthVoice.gain.gain.cancelScheduledValues(now);
      synthVoice.gain.gain.setValueAtTime(synthVoice.gain.gain.value, now);
      synthVoice.gain.gain.linearRampToValueAtTime(0, now + releaseSec);
      synthVoice.osc.stop(now + releaseSec + 0.01);
      this.synthVoices.delete(note);
    }

    const sfVoice = this.soundfontVoices.get(note);
    if (sfVoice) {
      sfVoice.stop(this.ctx.currentTime + this.releaseMs / 1000);
      this.soundfontVoices.delete(note);
    }
  }

  stopAll(): void {
    const notes = new Set<number>([...this.synthVoices.keys(), ...this.soundfontVoices.keys()]);
    notes.forEach((note) => this.stop(note));
  }

  private playSynth(note: number, velocity: number): void {
    if (!this.ctx) {
      return;
    }

    this.stop(note);
    const midi = noteToMidi(note);
    const freq = 440 * Math.pow(2, (midi - 69) / 12);

    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    const targetGain = Math.max(0.05, Math.min(0.5, velocity / 127 / 2));
    gain.gain.linearRampToValueAtTime(targetGain, this.ctx.currentTime + 0.02);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();

    this.synthVoices.set(note, { gain, osc });
  }
}
