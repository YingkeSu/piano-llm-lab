let sharedContext: AudioContext | null = null;

export function getOrCreateAudioContext(): AudioContext {
  if (sharedContext) {
    return sharedContext;
  }

  const Ctor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!Ctor) {
    throw new Error("AudioContext is not supported.");
  }

  sharedContext = new Ctor();
  return sharedContext;
}

export async function ensureAudioContextRunning(): Promise<AudioContext> {
  const ctx = getOrCreateAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}
