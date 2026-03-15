declare module "soundfont-player" {
  interface SoundfontVoice {
    stop(when?: number): void;
  }

  interface SoundfontInstrument {
    play(midi: number, when?: number, options?: { gain?: number }): SoundfontVoice;
  }

  interface SoundfontStatic {
    instrument(
      context: AudioContext,
      instrument: string,
      options?: { soundfont?: string },
    ): Promise<SoundfontInstrument>;
  }

  const Soundfont: SoundfontStatic;
  export default Soundfont;
}
