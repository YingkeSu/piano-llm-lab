export type InputSource =
  | "mouse"
  | "touch"
  | "pc-keyboard"
  | "web-midi"
  | "midi-player"
  | "recorder";

export interface NoteEvent {
  note: number;
  velocity: number;
  at: number;
  source: InputSource;
  type: "noteOn" | "noteOff";
}

export interface AudioEngine {
  init(): Promise<void>;
  setMode(mode: "synth" | "soundfont"): void;
  loadSoundfont(instrument: string): Promise<void>;
  play(note: number, velocity: number): void;
  stop(note: number): void;
  stopAll(): void;
  setReleaseMs(ms: number): void;
}

export interface MidiPlayer {
  load(file: ArrayBuffer, meta?: Record<string, string>): Promise<void>;
  play(): void;
  pause(): void;
  stop(): void;
  seek(ms: number): void;
  onProgress(cb: (nowMs: number, totalMs: number, playing: boolean) => void): () => void;
}

export interface Recorder {
  start(): void;
  stop(): { events: NoteEvent[]; durationMs: number; recordedAt: number };
  clear(): void;
}

export interface XmidCodec {
  encode(payload: { events: NoteEvent[]; recordedAt: number }): string;
  decode(content: string): { events: NoteEvent[]; recordedAt: number };
}

export interface LlmCoachPlugin {
  name: string;
  analyze(session: {
    events: NoteEvent[];
    durationMs: number;
  }): Promise<{ summary: string; suggestions: string[] }>;
}

export interface KeyLayout {
  note: number;
  midi: number;
  left: number;
  width: number;
  isBlack: boolean;
  label: string;
}
