import type { InputSource, NoteEvent } from "../piano/types";

interface Listener<T> {
  (payload: T): void;
}

export class InputManager {
  private readonly eventListeners = new Set<Listener<NoteEvent>>();

  private readonly soundOnListeners = new Set<Listener<NoteEvent>>();

  private readonly soundOffListeners = new Set<Listener<NoteEvent>>();

  private readonly sourceToNotes = new Map<InputSource, Set<number>>();

  private readonly noteRefCount = new Map<number, number>();

  private readonly sustainedNotes = new Set<number>();

  private sustainEnabled = false;

  onEvent(cb: Listener<NoteEvent>): () => void {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }

  onSoundOn(cb: Listener<NoteEvent>): () => void {
    this.soundOnListeners.add(cb);
    return () => this.soundOnListeners.delete(cb);
  }

  onSoundOff(cb: Listener<NoteEvent>): () => void {
    this.soundOffListeners.add(cb);
    return () => this.soundOffListeners.delete(cb);
  }

  getActiveNotes(): number[] {
    const noteSet = new Set<number>();
    this.noteRefCount.forEach((count, note) => {
      if (count > 0) {
        noteSet.add(note);
      }
    });
    this.sustainedNotes.forEach((note) => noteSet.add(note));
    return [...noteSet].sort((a, b) => a - b);
  }

  setSustain(enabled: boolean): void {
    if (this.sustainEnabled === enabled) {
      return;
    }

    this.sustainEnabled = enabled;
    if (enabled) {
      return;
    }

    const releaseTime = performance.now();
    for (const note of this.sustainedNotes) {
      this.emitSoundOff({
        note,
        velocity: 0,
        at: releaseTime,
        source: "recorder",
        type: "noteOff",
      });
    }
    this.sustainedNotes.clear();
  }

  noteOn(note: number, velocity: number, source: InputSource): void {
    const at = performance.now();
    const sourceNotes = this.getSourceNotes(source);
    sourceNotes.add(note);

    const prevCount = this.noteRefCount.get(note) ?? 0;
    this.noteRefCount.set(note, prevCount + 1);
    this.sustainedNotes.delete(note);

    const event: NoteEvent = {
      note,
      velocity,
      at,
      source,
      type: "noteOn",
    };

    this.emitEvent(event);
    if (prevCount === 0) {
      this.emitSoundOn(event);
    }
  }

  noteOff(note: number, source: InputSource): void {
    const at = performance.now();
    const sourceNotes = this.getSourceNotes(source);
    sourceNotes.delete(note);

    const prevCount = this.noteRefCount.get(note) ?? 0;
    const nextCount = Math.max(0, prevCount - 1);
    if (nextCount === 0) {
      this.noteRefCount.delete(note);
    } else {
      this.noteRefCount.set(note, nextCount);
    }

    const event: NoteEvent = {
      note,
      velocity: 0,
      at,
      source,
      type: "noteOff",
    };

    this.emitEvent(event);

    if (nextCount === 0) {
      if (this.sustainEnabled) {
        this.sustainedNotes.add(note);
      } else {
        this.emitSoundOff(event);
      }
    }
  }

  clearSource(source: InputSource): void {
    const sourceNotes = this.getSourceNotes(source);
    const notes = [...sourceNotes];
    notes.forEach((note) => this.noteOff(note, source));
  }

  clearAll(): void {
    const sources = [...this.sourceToNotes.keys()];
    sources.forEach((source) => this.clearSource(source));
    this.sustainedNotes.clear();
  }

  private getSourceNotes(source: InputSource): Set<number> {
    if (!this.sourceToNotes.has(source)) {
      this.sourceToNotes.set(source, new Set<number>());
    }
    return this.sourceToNotes.get(source)!;
  }

  private emitEvent(event: NoteEvent): void {
    this.eventListeners.forEach((cb) => cb(event));
  }

  private emitSoundOn(event: NoteEvent): void {
    this.soundOnListeners.forEach((cb) => cb(event));
  }

  private emitSoundOff(event: NoteEvent): void {
    this.soundOffListeners.forEach((cb) => cb(event));
  }
}
