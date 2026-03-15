import { describe, expect, it } from "vitest";

import { BasicXmidCodec, InvalidXmidError } from "../src/domain/recording/xmidCodec";

describe("xmid codec", () => {
  it("encodes and decodes events", () => {
    const codec = new BasicXmidCodec();
    const encoded = codec.encode({
      recordedAt: 1700000000000,
      events: [
        { note: 40, velocity: 100, at: 12, source: "recorder", type: "noteOn" },
        { note: 40, velocity: 0, at: 300, source: "recorder", type: "noteOff" },
      ],
    });

    const decoded = codec.decode(encoded);
    expect(decoded.recordedAt).toBe(1700000000000);
    expect(decoded.events).toHaveLength(2);
    expect(decoded.events[0].type).toBe("noteOn");
    expect(decoded.events[1].type).toBe("noteOff");
  });

  it("throws for invalid header", () => {
    const codec = new BasicXmidCodec();
    expect(() => codec.decode("invalid")).toThrowError(InvalidXmidError);
  });
});
