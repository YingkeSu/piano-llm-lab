import { ensureAudioContextRunning } from "./sharedAudioContext";

export interface MetronomeOptions {
  bpm: number;
  beatsPerBar: number;
  accentGain: number;
  normalGain: number;
}

export class MetronomeEngine {
  private running = false;

  private timer = 0;

  private beat = 0;

  private options: MetronomeOptions = {
    bpm: 100,
    beatsPerBar: 4,
    accentGain: 0.35,
    normalGain: 0.2,
  };

  setOptions(options: Partial<MetronomeOptions>): void {
    this.options = { ...this.options, ...options };
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.beat = 0;
    this.running = true;
    await this.tick();
  }

  stop(): void {
    this.running = false;
    this.beat = 0;
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = 0;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  private async tick(): Promise<void> {
    if (!this.running) {
      return;
    }

    await this.click();

    const interval = 60000 / Math.max(20, this.options.bpm);
    this.timer = window.setTimeout(() => {
      this.tick().catch(() => {
        this.stop();
      });
    }, interval);
  }

  private async click(): Promise<void> {
    const ctx = await ensureAudioContextRunning();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const isAccent = this.beat % this.options.beatsPerBar === 0;
    gain.gain.value = isAccent ? this.options.accentGain : this.options.normalGain;
    osc.frequency.value = isAccent ? 1200 : 880;
    osc.type = "square";

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.stop(now + 0.09);

    this.beat += 1;
  }
}
