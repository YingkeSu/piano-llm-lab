import { clampPianoNote } from "../piano/noteMapper";
import { InputManager } from "./inputManager";

export interface PcKeyboardOptions {
  shiftSharp: boolean;
  tabSustain: boolean;
  keyMap: Record<number, number>;
}

const eventCode = (event: KeyboardEvent): number => {
  if (event.key.length === 1) {
    return event.key.toUpperCase().charCodeAt(0);
  }
  return event.keyCode || event.which;
};

export class PcKeyboardAdapter {
  private readonly activeCodeToNote = new Map<number, number>();

  private enabled = false;

  private capsSustainOn = false;

  constructor(
    private readonly inputManager: InputManager,
    private readonly getOptions: () => PcKeyboardOptions,
  ) {}

  enable(): void {
    if (this.enabled) {
      return;
    }
    this.enabled = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  disable(): void {
    if (!this.enabled) {
      return;
    }
    this.enabled = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.activeCodeToNote.forEach((note) => this.inputManager.noteOff(note, "pc-keyboard"));
    this.activeCodeToNote.clear();
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) {
      return;
    }

    const code = eventCode(event);
    if (this.activeCodeToNote.has(code)) {
      return;
    }

    const { keyMap, shiftSharp } = this.getOptions();
    if (code === 20 && this.getOptions().tabSustain) {
      this.capsSustainOn = !this.capsSustainOn;
      this.inputManager.setSustain(this.capsSustainOn);
      event.preventDefault();
      return;
    }

    const mapped = keyMap[code];
    if (!mapped) {
      return;
    }

    const note = shiftSharp && event.shiftKey ? clampPianoNote(mapped + 1) : mapped;
    this.activeCodeToNote.set(code, note);
    this.inputManager.noteOn(note, 112, "pc-keyboard");
    event.preventDefault();
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    const code = eventCode(event);
    if (code === 20 && this.getOptions().tabSustain) {
      event.preventDefault();
      return;
    }
    const note = this.activeCodeToNote.get(code);
    if (!note) {
      return;
    }

    this.activeCodeToNote.delete(code);
    this.inputManager.noteOff(note, "pc-keyboard");
    event.preventDefault();
  };
}
