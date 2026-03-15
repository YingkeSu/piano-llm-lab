import { hitTestKey, KEYBOARD_HEIGHT } from "../piano/noteMapper";
import type { KeyLayout } from "../piano/types";
import { InputManager } from "./inputManager";

export interface PointerAdapterState {
  scale: number;
  offsetPx: number;
}

export class PointerInputAdapter {
  private readonly pointerToNote = new Map<number, number>();

  private mounted = false;

  constructor(
    private readonly inputManager: InputManager,
    private readonly element: HTMLElement,
    private readonly keys: KeyLayout[],
    private readonly getState: () => PointerAdapterState,
  ) {}

  mount(): void {
    if (this.mounted) {
      return;
    }

    this.mounted = true;
    this.element.addEventListener("pointerdown", this.onPointerDown, { passive: false });
    this.element.addEventListener("pointermove", this.onPointerMove, { passive: false });
    this.element.addEventListener("pointerup", this.onPointerUp, { passive: false });
    this.element.addEventListener("pointercancel", this.onPointerUp, { passive: false });
    this.element.addEventListener("pointerleave", this.onPointerUp, { passive: false });
    this.element.style.touchAction = "none";
  }

  unmount(): void {
    if (!this.mounted) {
      return;
    }

    this.mounted = false;
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.element.removeEventListener("pointermove", this.onPointerMove);
    this.element.removeEventListener("pointerup", this.onPointerUp);
    this.element.removeEventListener("pointercancel", this.onPointerUp);
    this.element.removeEventListener("pointerleave", this.onPointerUp);

    this.pointerToNote.forEach((note) => this.inputManager.noteOff(note, "touch"));
    this.pointerToNote.clear();
  }

  private resolveSource(event: PointerEvent): "mouse" | "touch" {
    return event.pointerType === "mouse" ? "mouse" : "touch";
  }

  private toKeyboardCoordinates(event: PointerEvent): { x: number; y: number } {
    const rect = this.element.getBoundingClientRect();
    const { scale, offsetPx } = this.getState();
    return {
      x: (event.clientX - rect.left + offsetPx) / scale,
      y: (event.clientY - rect.top) / scale,
    };
  }

  private noteAtPointer(event: PointerEvent): number | null {
    const { x, y } = this.toKeyboardCoordinates(event);
    return hitTestKey(this.keys, x, y, KEYBOARD_HEIGHT);
  }

  private onPointerDown = (event: PointerEvent): void => {
    const note = this.noteAtPointer(event);
    if (!note) {
      return;
    }

    this.element.setPointerCapture(event.pointerId);
    this.pointerToNote.set(event.pointerId, note);
    this.inputManager.noteOn(note, 120, this.resolveSource(event));
    event.preventDefault();
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.pointerToNote.has(event.pointerId)) {
      return;
    }

    const prevNote = this.pointerToNote.get(event.pointerId)!;
    const nextNote = this.noteAtPointer(event);
    if (!nextNote || nextNote === prevNote) {
      return;
    }

    const source = this.resolveSource(event);
    this.pointerToNote.set(event.pointerId, nextNote);
    this.inputManager.noteOff(prevNote, source);
    this.inputManager.noteOn(nextNote, 120, source);
    event.preventDefault();
  };

  private onPointerUp = (event: PointerEvent): void => {
    const note = this.pointerToNote.get(event.pointerId);
    if (!note) {
      return;
    }

    this.pointerToNote.delete(event.pointerId);
    this.inputManager.noteOff(note, this.resolveSource(event));
    event.preventDefault();
  };
}
