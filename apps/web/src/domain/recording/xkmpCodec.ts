export type XkmpErrorCode =
  | "XKMP_HEADER_INVALID"
  | "XKMP_VERSION_UNSUPPORTED"
  | "XKMP_NAME_MISSING"
  | "XKMP_CREATED_AT_INVALID"
  | "XKMP_BODY_MISSING"
  | "XKMP_ENTRY_INVALID"
  | "XKMP_NOTE_INVALID"
  | "XKMP_KEY_INVALID"
  | "XKMP_UNKNOWN";

export interface XkmpPayload {
  name: string;
  createdAt: number;
  map: Record<number, number>;
}

export class InvalidXkmpError extends Error {
  constructor(
    message: string,
    readonly code: XkmpErrorCode,
  ) {
    super(message);
    this.name = "InvalidXkmpError";
  }
}

function sanitizeName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length ? trimmed.slice(0, 60) : "keymap";
}

function validateKeyCode(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 255) {
    throw new InvalidXkmpError(`Invalid key code: ${value}`, "XKMP_KEY_INVALID");
  }
}

function validateNote(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 88) {
    throw new InvalidXkmpError(`Invalid piano note: ${value}`, "XKMP_NOTE_INVALID");
  }
}

export class BasicXkmpCodec {
  encode(payload: XkmpPayload): string {
    const entries = Object.entries(payload.map)
      .map(([codeRaw, noteRaw]) => [Number.parseInt(codeRaw, 10), Math.round(noteRaw)] as const)
      .sort((a, b) => a[0] - b[0]);

    entries.forEach(([code, note]) => {
      validateKeyCode(code);
      validateNote(note);
    });

    const body = entries.map(([code, note]) => `${code},${note}`).join("|");

    return [
      "!xkmp",
      "v:1",
      `n:${encodeURIComponent(sanitizeName(payload.name))}`,
      `m:${Math.round(payload.createdAt)}`,
      `b:${body}`,
    ].join("\n");
  }

  decode(content: string): XkmpPayload {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines[0] !== "!xkmp") {
      throw new InvalidXkmpError("Missing xkmp header", "XKMP_HEADER_INVALID");
    }

    if (lines.find((line) => line.startsWith("v:")) !== "v:1") {
      throw new InvalidXkmpError("Unsupported xkmp version", "XKMP_VERSION_UNSUPPORTED");
    }

    const nameLine = lines.find((line) => line.startsWith("n:"));
    if (!nameLine || nameLine.length < 3) {
      throw new InvalidXkmpError("Missing keymap name", "XKMP_NAME_MISSING");
    }

    const createdLine = lines.find((line) => line.startsWith("m:"));
    if (!createdLine) {
      throw new InvalidXkmpError("Missing keymap createdAt", "XKMP_CREATED_AT_INVALID");
    }

    const createdAt = Number.parseInt(createdLine.slice(2), 10);
    if (!Number.isFinite(createdAt) || createdAt <= 0) {
      throw new InvalidXkmpError("Invalid keymap createdAt", "XKMP_CREATED_AT_INVALID");
    }

    const bodyLine = lines.find((line) => line.startsWith("b:"));
    if (!bodyLine) {
      throw new InvalidXkmpError("Missing keymap body", "XKMP_BODY_MISSING");
    }

    const body = bodyLine.slice(2).trim();
    const map: Record<number, number> = {};
    if (body.length) {
      body.split("|").forEach((entry) => {
        const [codeRaw, noteRaw] = entry.split(",");
        const code = Number.parseInt(codeRaw, 10);
        const note = Number.parseInt(noteRaw, 10);

        if (Number.isNaN(code) || Number.isNaN(note)) {
          throw new InvalidXkmpError(`Invalid keymap entry: ${entry}`, "XKMP_ENTRY_INVALID");
        }

        validateKeyCode(code);
        validateNote(note);
        map[code] = note;
      });
    }

    return {
      name: sanitizeName(decodeURIComponent(nameLine.slice(2))),
      createdAt,
      map,
    };
  }
}
