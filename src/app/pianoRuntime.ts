import { ref } from "vue";

import type { NoteEvent } from "../domain/piano/types";
import { buildKeyboardLayout, KEYBOARD_HEIGHT } from "../domain/piano/noteMapper";
import { WebAudioEngine } from "../domain/audio/webAudioEngine";
import { InputManager } from "../domain/input/inputManager";
import { PcKeyboardAdapter } from "../domain/input/pcKeyboardAdapter";
import { PointerInputAdapter } from "../domain/input/pointerInputAdapter";
import { WebMidiAdapter } from "../domain/input/webMidiAdapter";
import { ToneMidiPlayer } from "../domain/midi/midiPlayer";
import { PianoRecorder, type RecordedSession } from "../domain/recording/recorder";
import { BasicXmidCodec, InvalidXmidError } from "../domain/recording/xmidCodec";
import { NoopCoachPlugin } from "../llm/coach";
import { useSettingsStore } from "../store/settings";

export interface TimelineEvent {
  note: number;
  at: number;
  velocity: number;
}

export interface RecordingClip {
  id: string;
  name: string;
  session: RecordedSession;
  coachSummary: string;
  coachSuggestions: string[];
}

const seconds = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

export class PianoRuntime {
  readonly keyLayout = buildKeyboardLayout();

  readonly activeNotes = ref<number[]>([]);

  readonly timelineEvents = ref<TimelineEvent[]>([]);

  readonly playbackNowMs = ref(0);

  readonly playbackTotalMs = ref(0);

  readonly playbackPlaying = ref(false);

  readonly playbackMeta = ref<Record<string, string>>({});

  readonly recording = ref(false);

  readonly recordings = ref<RecordingClip[]>([]);

  readonly midiConnected = ref(false);

  readonly midiSupported = ref(false);

  readonly midiInputNames = ref<string[]>([]);

  readonly statusMessage = ref("Ready");

  readonly audioMode = ref<"synth" | "soundfont">("synth");

  readonly soundfontLoaded = ref(false);

  readonly soundfontInstrument = ref("acoustic_grand_piano");

  private pointerAdapter: PointerInputAdapter | null = null;

  private readonly inputManager = new InputManager();

  private readonly audioEngine = new WebAudioEngine();

  private readonly midiPlayer = new ToneMidiPlayer(this.inputManager);

  private readonly recorder = new PianoRecorder(this.inputManager);

  private readonly xmid = new BasicXmidCodec();

  private readonly midiAdapter = new WebMidiAdapter(this.inputManager);

  private readonly llmCoach = new NoopCoachPlugin();

  private readonly settingsStore = useSettingsStore();

  private recordPlaybackTimers: number[] = [];

  private recordPlaybackInterval = 0;

  private readonly pcAdapter = new PcKeyboardAdapter(this.inputManager, () => ({
    shiftSharp: this.settingsStore.settings.shiftSharp,
    keyMap: this.settingsStore.settings.pcKeyMap,
  }));

  constructor() {
    this.inputManager.onEvent((event) => {
      if (event.type === "noteOn") {
        this.timelineEvents.value.push({
          note: event.note,
          at: performance.now(),
          velocity: event.velocity,
        });

        if (this.timelineEvents.value.length > 250) {
          this.timelineEvents.value.splice(0, this.timelineEvents.value.length - 250);
        }
      }

      this.activeNotes.value = this.inputManager.getActiveNotes();
    });

    this.inputManager.onSoundOn((event) => {
      this.audioEngine.play(event.note, event.velocity);
    });

    this.inputManager.onSoundOff((event) => {
      this.audioEngine.stop(event.note);
    });

    this.midiPlayer.onProgress((nowMs, totalMs, playing) => {
      this.playbackNowMs.value = nowMs;
      this.playbackTotalMs.value = totalMs;
      this.playbackPlaying.value = playing;
    });

    const midiStatus = this.midiAdapter.getStatus();
    this.midiSupported.value = midiStatus.supported;
    this.midiConnected.value = midiStatus.connected;
    this.midiInputNames.value = midiStatus.inputNames;
  }

  async init(): Promise<void> {
    this.settingsStore.loadFromStorage();
    this.pcAdapter.enable();
    this.inputManager.setSustain(this.settingsStore.settings.tabSustain);
    this.audioEngine.setMode(this.audioMode.value);
    this.audioEngine.setReleaseMs(this.settingsStore.settings.autoSustainMs);
  }

  destroy(): void {
    this.pcAdapter.disable();
    this.pointerAdapter?.unmount();
    this.pointerAdapter = null;
    this.audioEngine.stopAll();
    this.inputManager.clearAll();
  }

  attachKeyboard(element: HTMLElement, getState: () => { scale: number; offsetPx: number }): void {
    this.pointerAdapter?.unmount();
    this.pointerAdapter = new PointerInputAdapter(this.inputManager, element, this.keyLayout.keys, getState);
    this.pointerAdapter.mount();
  }

  async ensureAudioReady(): Promise<void> {
    await this.audioEngine.init();
  }

  setAudioMode(mode: "synth" | "soundfont"): void {
    this.audioMode.value = mode;
    this.audioEngine.setMode(mode);
  }

  async loadSoundfont(instrument: string): Promise<void> {
    this.soundfontLoaded.value = false;
    this.soundfontInstrument.value = instrument;

    try {
      await this.audioEngine.loadSoundfont(instrument);
      this.soundfontLoaded.value = true;
      this.statusMessage.value = `Soundfont loaded (${instrument}).`;
    } catch (error) {
      this.soundfontLoaded.value = false;
      this.setAudioMode("synth");
      this.statusMessage.value =
        error instanceof Error ? `Soundfont load failed, fallback to synth: ${error.message}` : "Soundfont load failed.";
    }
  }

  setReleaseMs(ms: number): void {
    this.audioEngine.setReleaseMs(ms);
  }

  setSustain(enabled: boolean): void {
    this.inputManager.setSustain(enabled);
  }

  async connectMidi(): Promise<void> {
    const status = await this.midiAdapter.connect();
    this.midiConnected.value = status.connected;
    this.midiInputNames.value = status.inputNames;
    this.statusMessage.value = status.error || (status.connected ? "MIDI device connected." : "MIDI unavailable.");
  }

  disconnectMidi(): void {
    const status = this.midiAdapter.disconnect();
    this.midiConnected.value = status.connected;
    this.midiInputNames.value = status.inputNames;
    this.statusMessage.value = "MIDI disconnected.";
  }

  async loadMidiFile(file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    await this.midiPlayer.load(buffer, { name: file.name, size: `${file.size}` });
    this.playbackMeta.value = {
      file: file.name,
      size: `${(file.size / 1024).toFixed(1)}KB`,
    };
    this.statusMessage.value = `MIDI loaded: ${file.name}`;
  }

  playMidi(): void {
    this.midiPlayer.play();
  }

  pauseMidi(): void {
    this.midiPlayer.pause();
    this.clearRecordedPlayback();
  }

  stopMidi(): void {
    this.midiPlayer.stop();
    this.clearRecordedPlayback();
  }

  seekMidi(ms: number): void {
    this.midiPlayer.seek(ms);
  }

  startRecording(): void {
    this.recording.value = true;
    this.recorder.start();
    this.statusMessage.value = "Recording started.";
  }

  async stopRecording(): Promise<RecordingClip | null> {
    this.recording.value = false;
    const session = this.recorder.stop();
    if (session.events.length === 0) {
      this.statusMessage.value = "Recording is empty.";
      return null;
    }

    const analysis = await this.llmCoach.analyze({
      events: session.events,
      durationMs: session.durationMs,
    });

    const clip: RecordingClip = {
      id: `rec-${Date.now()}`,
      name: `recording-${new Date(session.recordedAt).toISOString().replace(/[:.]/g, "-")}`,
      session,
      coachSummary: analysis.summary,
      coachSuggestions: analysis.suggestions,
    };

    this.recordings.value.unshift(clip);
    this.statusMessage.value = `Recording saved (${seconds(session.durationMs)}).`;
    return clip;
  }

  async playRecording(clip: RecordingClip): Promise<void> {
    this.stopMidi();
    this.playRecordedEvents(clip.session.events);
    this.playbackMeta.value = {
      source: clip.name,
      duration: seconds(clip.session.durationMs),
      recordedAt: new Date(clip.session.recordedAt).toLocaleString(),
    };
    this.statusMessage.value = `Playback recording: ${clip.name}`;
  }

  private playRecordedEvents(events: NoteEvent[]): void {
    this.stopMidi();
    this.playbackPlaying.value = true;
    this.playbackNowMs.value = 0;
    this.playbackTotalMs.value = events.length ? events[events.length - 1].at : 0;

    const start = performance.now();
    this.recordPlaybackTimers = events.map((event) =>
      window.setTimeout(() => {
        if (event.type === "noteOn") {
          this.inputManager.noteOn(event.note, event.velocity, "midi-player");
        } else {
          this.inputManager.noteOff(event.note, "midi-player");
        }
      }, event.at),
    );

    this.recordPlaybackInterval = window.setInterval(() => {
      const now = performance.now() - start;
      this.playbackNowMs.value = now;
      if (now >= this.playbackTotalMs.value) {
        window.clearInterval(this.recordPlaybackInterval);
        this.recordPlaybackInterval = 0;
        this.playbackPlaying.value = false;
        this.inputManager.clearSource("midi-player");
      }
    }, 30);

    window.setTimeout(() => {
      this.recordPlaybackTimers.forEach((id) => window.clearTimeout(id));
      this.recordPlaybackTimers = [];
      window.clearInterval(this.recordPlaybackInterval);
      this.recordPlaybackInterval = 0;
      this.playbackPlaying.value = false;
      this.inputManager.clearSource("midi-player");
    }, this.playbackTotalMs.value + 100);
  }

  private clearRecordedPlayback(): void {
    if (this.recordPlaybackTimers.length > 0) {
      this.recordPlaybackTimers.forEach((id) => window.clearTimeout(id));
      this.recordPlaybackTimers = [];
    }
    if (this.recordPlaybackInterval) {
      window.clearInterval(this.recordPlaybackInterval);
      this.recordPlaybackInterval = 0;
    }
    this.inputManager.clearSource("midi-player");
    this.playbackPlaying.value = false;
  }

  exportRecording(clip: RecordingClip): string {
    return this.xmid.encode({
      events: clip.session.events,
      recordedAt: clip.session.recordedAt,
    });
  }

  importXmid(content: string, name: string): RecordingClip {
    const data = this.xmid.decode(content);
    const clip: RecordingClip = {
      id: `xmid-${Date.now()}`,
      name,
      session: {
        events: data.events,
        durationMs: data.events.length ? data.events[data.events.length - 1].at : 0,
        recordedAt: data.recordedAt,
      },
      coachSummary: "Imported from xmid.",
      coachSuggestions: ["Run a future LLM coach plugin for detailed feedback."],
    };

    this.recordings.value.unshift(clip);
    return clip;
  }

  applySettingSync(): void {
    this.inputManager.setSustain(this.settingsStore.settings.tabSustain);
    this.audioEngine.setReleaseMs(this.settingsStore.settings.autoSustainMs);
  }

  exportKeymap(): string {
    return `!xkmp\n${JSON.stringify(this.settingsStore.settings.pcKeyMap)}`;
  }

  importKeymap(content: string): Record<number, number> {
    const raw = content.replace(/^!xkmp\n?/, "").trim();
    const parsed = JSON.parse(raw) as Record<string, number>;
    const mapped: Record<number, number> = {};
    Object.keys(parsed).forEach((key) => {
      const num = Number.parseInt(key, 10);
      if (Number.isNaN(num)) {
        return;
      }
      mapped[num] = parsed[key];
    });

    return mapped;
  }

  decodeXmidSafe(content: string): { ok: true } | { ok: false; message: string } {
    try {
      this.xmid.decode(content);
      return { ok: true };
    } catch (error) {
      if (error instanceof InvalidXmidError) {
        return { ok: false, message: error.message };
      }
      return { ok: false, message: "Unknown xmid parse error." };
    }
  }

  getKeyboardHeight(): number {
    return KEYBOARD_HEIGHT;
  }
}
