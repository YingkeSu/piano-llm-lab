import { describe, expect, it } from "vitest";

import { BasicXkmpCodec, InvalidXkmpError } from "../src/domain/recording/xkmpCodec";

describe("xkmp codec", () => {
  it("encodes and decodes keymap", () => {
    const codec = new BasicXkmpCodec();
    const encoded = codec.encode({
      name: "Test",
      createdAt: 1700000000000,
      map: {
        90: 28,
        88: 30,
      },
    });

    const decoded = codec.decode(encoded);
    expect(decoded.name).toBe("Test");
    expect(decoded.createdAt).toBe(1700000000000);
    expect(decoded.map[90]).toBe(28);
  });

  it("rejects invalid header", () => {
    const codec = new BasicXkmpCodec();
    expect(() => codec.decode("invalid")).toThrowError(InvalidXkmpError);
  });
});
