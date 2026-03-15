import { describe, expect, it } from "vitest";

import { buildEventQueueFromTracks } from "../src/domain/midi/midiPlayer";

describe("midi queue", () => {
  it("merges and sorts note events by timeline", () => {
    const { events, totalMs } = buildEventQueueFromTracks([
      {
        notes: [
          { midi: 60, time: 0.2, duration: 0.5, velocity: 0.8 },
          { midi: 64, time: 0.1, duration: 0.2, velocity: 0.7 },
        ],
      },
    ]);

    expect(events[0].type).toBe("noteOn");
    expect(events[0].atMs).toBe(100);
    expect(events[1].atMs).toBe(200);
    expect(totalMs).toBe(700);
  });

  it("ignores out-of-range midi notes", () => {
    const { events } = buildEventQueueFromTracks([
      {
        notes: [{ midi: 5, time: 0, duration: 1, velocity: 0.6 }],
      },
    ]);

    expect(events).toHaveLength(0);
  });
});
