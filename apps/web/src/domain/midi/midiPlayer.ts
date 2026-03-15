import { Midi } from "@tonejs/midi";

import type { MidiPlayer, NoteEvent } from "../piano/types";
import { MAX_MIDI, MIN_MIDI, clampPianoNote, midiToNote } from "../piano/noteMapper";
import { InputManager } from "../input/inputManager";

export interface QueuedMidiEvent {
  atMs: number;
  type: "noteOn" | "noteOff";
  note: number;
  velocity: number;
}

export function buildEventQueueFromTracks(
  tracks: Array<{ notes: Array<{ midi: number; time: number; duration: number; velocity: number }> }>,
): { events: QueuedMidiEvent[]; totalMs: number } {
  const queue: QueuedMidiEvent[] = [];
  let maxMs = 0;

  tracks.forEach((track) => {
    track.notes.forEach((note) => {
      if (note.midi < MIN_MIDI || note.midi > MAX_MIDI) {
        return;
      }
      const noteOnMs = Math.round(note.time * 1000);
      const noteOffMs = Math.round((note.time + note.duration) * 1000);
      const pianoNote = clampPianoNote(midiToNote(note.midi));
      const velocity = Math.max(1, Math.min(127, Math.round(note.velocity * 127)));

      queue.push({ atMs: noteOnMs, type: "noteOn", note: pianoNote, velocity });
      queue.push({ atMs: noteOffMs, type: "noteOff", note: pianoNote, velocity: 0 });
      maxMs = Math.max(maxMs, noteOffMs);
    });
  });

  queue.sort((a, b) => {
    if (a.atMs === b.atMs) {
      if (a.type === b.type) {
        return a.note - b.note;
      }
      return a.type === "noteOff" ? -1 : 1;
    }
    return a.atMs - b.atMs;
  });

  return { events: queue, totalMs: maxMs };
}

export class ToneMidiPlayer implements MidiPlayer {
  private events: QueuedMidiEvent[] = [];

  private totalMs = 0;

  private nowMs = 0;

  private eventIndex = 0;

  private playing = false;

  private startedAt = 0;

  private rafId = 0;

  private progressListeners = new Set<(nowMs: number, totalMs: number, playing: boolean) => void>();

  constructor(private readonly inputManager: InputManager) {}

  async load(file: ArrayBuffer, _meta?: Record<string, string>): Promise<void> {
    this.stop();
    const midi = new Midi(file);
    const queue = buildEventQueueFromTracks(midi.tracks);
    this.events = queue.events;
    this.totalMs = queue.totalMs;
    this.nowMs = 0;
    this.eventIndex = 0;
    this.emitProgress();
  }

  play(): void {
    if (this.playing || this.events.length === 0) {
      return;
    }

    this.playing = true;
    this.startedAt = performance.now() - this.nowMs;
    this.tick();
    this.emitProgress();
  }

  pause(): void {
    if (!this.playing) {
      return;
    }

    this.playing = false;
    cancelAnimationFrame(this.rafId);
    this.nowMs = Math.max(0, performance.now() - this.startedAt);
    this.inputManager.clearSource("midi-player");
    this.emitProgress();
  }

  stop(): void {
    this.playing = false;
    cancelAnimationFrame(this.rafId);
    this.nowMs = 0;
    this.eventIndex = 0;
    this.inputManager.clearSource("midi-player");
    this.emitProgress();
  }

  seek(ms: number): void {
    const clamped = Math.max(0, Math.min(this.totalMs, ms));
    this.nowMs = clamped;
    this.eventIndex = this.events.findIndex((event) => event.atMs >= clamped);
    if (this.eventIndex < 0) {
      this.eventIndex = this.events.length;
    }

    this.inputManager.clearSource("midi-player");
    if (this.playing) {
      this.startedAt = performance.now() - this.nowMs;
    }
    this.emitProgress();
  }

  onProgress(cb: (nowMs: number, totalMs: number, playing: boolean) => void): () => void {
    this.progressListeners.add(cb);
    cb(this.nowMs, this.totalMs, this.playing);
    return () => this.progressListeners.delete(cb);
  }

  private tick = (): void => {
    if (!this.playing) {
      return;
    }

    this.nowMs = Math.max(0, performance.now() - this.startedAt);

    while (this.eventIndex < this.events.length) {
      const event = this.events[this.eventIndex];
      if (event.atMs > this.nowMs) {
        break;
      }

      this.dispatchEvent(event);
      this.eventIndex += 1;
    }

    if (this.nowMs >= this.totalMs || this.eventIndex >= this.events.length) {
      this.stop();
      return;
    }

    this.emitProgress();
    this.rafId = requestAnimationFrame(this.tick);
  };

  private dispatchEvent(event: QueuedMidiEvent): void {
    if (event.type === "noteOn") {
      this.inputManager.noteOn(event.note, event.velocity, "midi-player");
    } else {
      this.inputManager.noteOff(event.note, "midi-player");
    }
  }

  private emitProgress(): void {
    this.progressListeners.forEach((cb) => cb(this.nowMs, this.totalMs, this.playing));
  }
}

export function toNoteEvent(event: QueuedMidiEvent, source: NoteEvent["source"]): NoteEvent {
  return {
    note: event.note,
    velocity: event.velocity,
    at: event.atMs,
    source,
    type: event.type,
  };
}
