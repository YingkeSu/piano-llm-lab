import type { NoteEvent, XmidCodec } from "../piano/types";

export class InvalidXmidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidXmidError";
  }
}

const TYPE_TO_NUM: Record<NoteEvent["type"], 1 | 2> = {
  noteOn: 1,
  noteOff: 2,
};

const NUM_TO_TYPE: Record<number, NoteEvent["type"]> = {
  1: "noteOn",
  2: "noteOff",
};

export class BasicXmidCodec implements XmidCodec {
  encode(payload: { events: NoteEvent[]; recordedAt: number }): string {
    const body = payload.events
      .map((event) => `${Math.round(event.at)},${TYPE_TO_NUM[event.type]},${event.note},${event.velocity}`)
      .join("|");

    return [`!xmid`, `v:1`, `m:${Math.round(payload.recordedAt)}`, `b:${body}`].join("\n");
  }

  decode(content: string): { events: NoteEvent[]; recordedAt: number } {
    const lines = content.split(/\r?\n/).map((line) => line.trim());
    if (lines[0] !== "!xmid") {
      throw new InvalidXmidError("Missing xmid header.");
    }

    const version = lines.find((line) => line.startsWith("v:"));
    if (version !== "v:1") {
      throw new InvalidXmidError("Unsupported xmid version.");
    }

    const metaLine = lines.find((line) => line.startsWith("m:"));
    if (!metaLine) {
      throw new InvalidXmidError("Missing xmid metadata line.");
    }

    const bodyLine = lines.find((line) => line.startsWith("b:"));
    if (!bodyLine) {
      throw new InvalidXmidError("Missing xmid event line.");
    }

    const recordedAt = Number.parseInt(metaLine.slice(2), 10);
    if (Number.isNaN(recordedAt)) {
      throw new InvalidXmidError("Invalid recordedAt value.");
    }

    const eventData = bodyLine.slice(2).trim();
    if (!eventData) {
      return { events: [], recordedAt };
    }

    const events: NoteEvent[] = eventData.split("|").map((chunk) => {
      const [atRaw, typeRaw, noteRaw, velocityRaw] = chunk.split(",");
      const at = Number.parseInt(atRaw, 10);
      const note = Number.parseInt(noteRaw, 10);
      const velocity = Number.parseInt(velocityRaw, 10);
      const type = NUM_TO_TYPE[Number.parseInt(typeRaw, 10)];

      if (!type || Number.isNaN(at) || Number.isNaN(note) || Number.isNaN(velocity)) {
        throw new InvalidXmidError(`Invalid xmid event: ${chunk}`);
      }

      return {
        at,
        note,
        velocity,
        type,
        source: "recorder",
      };
    });

    return { events, recordedAt };
  }
}
