import type { KeyLayout } from "./types";

export const MIN_MIDI = 21;
export const MAX_MIDI = 108;
export const TOTAL_NOTES = 88;
export const WHITE_KEY_WIDTH = 40;
export const BLACK_KEY_WIDTH = 24;
export const KEYBOARD_HEIGHT = 200;

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteToMidi(note: number): number {
  if (note < 1 || note > TOTAL_NOTES) {
    throw new Error(`Invalid piano note: ${note}`);
  }
  return note + 20;
}

export function midiToNote(midi: number): number {
  if (midi < MIN_MIDI || midi > MAX_MIDI) {
    throw new Error(`Invalid midi note: ${midi}`);
  }
  return midi - 20;
}

export function isBlackMidi(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

export function midiToLabel(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

export function buildKeyboardLayout(
  whiteWidth: number = WHITE_KEY_WIDTH,
  blackWidth: number = BLACK_KEY_WIDTH,
): { keys: KeyLayout[]; totalWidth: number; whiteKeyCount: number } {
  const keys: KeyLayout[] = [];
  let whiteIndex = 0;

  for (let note = 1; note <= TOTAL_NOTES; note += 1) {
    const midi = noteToMidi(note);
    const black = isBlackMidi(midi);

    if (black) {
      const left = whiteIndex * whiteWidth - blackWidth / 2;
      keys.push({
        note,
        midi,
        left,
        width: blackWidth,
        isBlack: true,
        label: midiToLabel(midi),
      });
    } else {
      const left = whiteIndex * whiteWidth;
      keys.push({
        note,
        midi,
        left,
        width: whiteWidth,
        isBlack: false,
        label: midiToLabel(midi),
      });
      whiteIndex += 1;
    }
  }

  return { keys, totalWidth: whiteIndex * whiteWidth, whiteKeyCount: whiteIndex };
}

export function hitTestKey(keys: KeyLayout[], x: number, y: number, keyboardHeight: number): number | null {
  const blackZone = keyboardHeight * 0.65;
  if (y <= blackZone) {
    for (let i = keys.length - 1; i >= 0; i -= 1) {
      const key = keys[i];
      if (!key.isBlack) {
        continue;
      }
      if (x >= key.left && x <= key.left + key.width) {
        return key.note;
      }
    }
  }

  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (key.isBlack) {
      continue;
    }
    if (x >= key.left && x <= key.left + key.width) {
      return key.note;
    }
  }

  return null;
}

export function clampPianoNote(note: number): number {
  return Math.max(1, Math.min(TOTAL_NOTES, note));
}
