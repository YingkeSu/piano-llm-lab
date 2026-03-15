import type { NoteEvent, Recorder } from "../piano/types";
import { InputManager } from "../input/inputManager";

export interface RecordedSession {
  events: NoteEvent[];
  durationMs: number;
  recordedAt: number;
}

export class PianoRecorder implements Recorder {
  private recording = false;

  private startedAt = 0;

  private recordedAt = 0;

  private events: NoteEvent[] = [];

  constructor(private readonly inputManager: InputManager) {
    this.inputManager.onEvent((event) => {
      if (!this.recording) {
        return;
      }
      if (event.source === "midi-player" || event.source === "recorder") {
        return;
      }

      this.events.push({
        ...event,
        at: Math.max(0, event.at - this.startedAt),
        source: "recorder",
      });
    });
  }

  start(): void {
    this.events = [];
    this.recordedAt = Date.now();
    this.startedAt = performance.now();
    this.recording = true;
  }

  stop(): RecordedSession {
    const now = performance.now();
    this.recording = false;
    return {
      events: [...this.events],
      durationMs: Math.max(0, Math.round(now - this.startedAt)),
      recordedAt: this.recordedAt,
    };
  }

  clear(): void {
    this.events = [];
  }
}
