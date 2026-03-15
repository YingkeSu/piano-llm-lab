import { describe, expect, it } from "vitest";

import { buildKeyboardLayout, midiToNote, noteToMidi } from "../src/domain/piano/noteMapper";

describe("note mapper", () => {
  it("converts note to midi and back", () => {
    expect(noteToMidi(1)).toBe(21);
    expect(noteToMidi(40)).toBe(60);
    expect(midiToNote(108)).toBe(88);
  });

  it("builds a full 88-key layout", () => {
    const { keys, whiteKeyCount } = buildKeyboardLayout();
    expect(keys).toHaveLength(88);
    expect(whiteKeyCount).toBe(52);
    expect(keys.filter((k) => k.isBlack)).toHaveLength(36);
  });
});
