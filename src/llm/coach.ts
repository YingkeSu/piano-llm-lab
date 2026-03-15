import type { LlmCoachPlugin, NoteEvent } from "../domain/piano/types";

export class NoopCoachPlugin implements LlmCoachPlugin {
  name = "noop-coach";

  async analyze(session: {
    events: NoteEvent[];
    durationMs: number;
  }): Promise<{ summary: string; suggestions: string[] }> {
    const noteOnCount = session.events.filter((event) => event.type === "noteOn").length;
    return {
      summary: `Captured ${noteOnCount} note-on events across ${Math.round(session.durationMs / 1000)} seconds.`,
      suggestions: [
        "LLM integration is not enabled in V1.",
        "Implement a real coach plugin in src/llm with API-backed analysis.",
      ],
    };
  }
}
