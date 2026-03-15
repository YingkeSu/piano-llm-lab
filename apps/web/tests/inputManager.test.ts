import { describe, expect, it } from "vitest";

import { InputManager } from "../src/domain/input/inputManager";

describe("input manager", () => {
  it("supports sustain hold and release", () => {
    const manager = new InputManager();
    const soundOff: number[] = [];

    manager.onSoundOff((event) => {
      soundOff.push(event.note);
    });

    manager.noteOn(40, 100, "pc-keyboard");
    manager.setSustain(true);
    manager.noteOff(40, "pc-keyboard");
    expect(manager.getActiveNotes()).toContain(40);

    manager.setSustain(false);
    expect(soundOff).toContain(40);
    expect(manager.getActiveNotes()).not.toContain(40);
  });
});
