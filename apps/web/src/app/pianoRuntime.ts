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
import {
  BasicXkmpCodec,
  InvalidXkmpError,
  type XkmpErrorCode,
} from "../domain/recording/xkmpCodec";
import { NoopCoachPlugin } from "../llm/coach";
import { useSettingsStore, type KeymapProfile } from "../store/settings";

export interface TimelineEvent {
  id: string;
  note: number;
  velocity: number;
  startAt: number;
  endAt: number | null;
}

export interface RecordingClip {
  id: string;
  name: string;
  session: RecordedSession;
  coachSummary: string;
  coachSuggestions: string[];
}

interface StoredRecordingIndex {
  id: string;
  name: string;
  recordedAt: number;
  durationMs: number;
}

interface ImportedKeymap {
  name: string;
  createdAt: number;
  map: Record<number, number>;
}

const RECORDING_INDEX_KEY = "piano_v1_recordings_index";
const RECORDING_DATA_PREFIX = "piano_v1_recording_clip_";
const MAX_RECORDINGS = 40;

const seconds = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

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

  private readonly xkmp = new BasicXkmpCodec();

  private readonly midiAdapter = new WebMidiAdapter(this.inputManager);

  private readonly llmCoach = new NoopCoachPlugin();

  private readonly settingsStore = useSettingsStore();

  private recordPlaybackTimers: number[] = [];

  private recordPlaybackInterval = 0;

  private timelineSeq = 0;

  private readonly openTimelineByNote = new Map<number, TimelineEvent[]>();

  private readonly pcAdapter = new PcKeyboardAdapter(this.inputManager, () => ({
    shiftSharp: this.settingsStore.settings.shiftSharp,
    tabSustain: this.settingsStore.settings.tabSustain,
    keyMap: this.settingsStore.settings.pcKeyMap,
  }));

  constructor() {
    this.inputManager.onEvent((event) => {
      if (event.type === "noteOn") {
        this.openTimelineNote(event);
      } else {
        this.closeTimelineNote(event);
      }

      this.activeNotes.value = this.inputManager.getActiveNotes();
      this.trimTimeline();
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

    const initialStatus = this.midiAdapter.getStatus();
    this.midiSupported.value = initialStatus.supported;
    this.midiConnected.value = initialStatus.connected;
    this.midiInputNames.value = initialStatus.inputNames;

    this.midiAdapter.onStatusChange((status) => {
      this.midiSupported.value = status.supported;
      this.midiConnected.value = status.connected;
      this.midiInputNames.value = status.inputNames;
      if (status.error) {
        this.statusMessage.value = status.error;
      } else if (status.connected && status.inputNames.length) {
        this.statusMessage.value = `MIDI ready: ${status.inputNames.join(", ")}`;
      }
    });
  }

  async init(): Promise<void> {
    this.settingsStore.loadFromStorage();
    this.pcAdapter.enable();
    this.inputManager.setSustain(this.settingsStore.settings.tabSustain);
    this.audioEngine.setMode(this.audioMode.value);
    this.audioEngine.setReleaseMs(this.settingsStore.settings.autoSustainMs);
    this.loadRecordingHistory();
  }

  destroy(): void {
    this.pcAdapter.disable();
    this.pointerAdapter?.unmount();
    this.pointerAdapter = null;
    this.audioEngine.stopAll();
    this.inputManager.clearAll();
    this.clearRecordedPlayback();
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
    try {
      const buffer = await file.arrayBuffer();
      await this.midiPlayer.load(buffer, { name: file.name, size: `${file.size}` });
      this.playbackMeta.value = {
        source: "midi",
        file: file.name,
        ext: fileExtension(file.name) || "unknown",
        size: `${(file.size / 1024).toFixed(1)}KB`,
      };
      this.statusMessage.value = `MIDI loaded: ${file.name}`;
    } catch (error) {
      this.statusMessage.value = error instanceof Error ? `MIDI parse failed: ${error.message}` : "MIDI parse failed.";
      throw error;
    }
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

    this.recordings.value = [clip, ...this.recordings.value].slice(0, MAX_RECORDINGS);
    this.persistRecordingHistory();
    this.statusMessage.value = `Recording saved (${seconds(session.durationMs)}).`;
    return clip;
  }

  async playRecording(clip: RecordingClip): Promise<void> {
    this.stopMidi();
    this.playRecordedEvents(clip.session.events);
    this.playbackMeta.value = {
      source: "recording",
      clip: clip.name,
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
    try {
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

      this.recordings.value = [clip, ...this.recordings.value].slice(0, MAX_RECORDINGS);
      this.persistRecordingHistory();
      this.statusMessage.value = `Imported xmid: ${name}`;
      return clip;
    } catch (error) {
      this.statusMessage.value =
        error instanceof InvalidXmidError ? `XMID import failed: ${error.message}` : "XMID import failed.";
      throw error;
    }
  }

  applySettingSync(): void {
    this.inputManager.setSustain(this.settingsStore.settings.tabSustain);
    this.audioEngine.setReleaseMs(this.settingsStore.settings.autoSustainMs);
  }

  exportKeymap(name = "keymap"): string {
    return this.xkmp.encode({
      name,
      createdAt: Date.now(),
      map: this.settingsStore.settings.pcKeyMap,
    });
  }

  importKeymap(content: string): ImportedKeymap {
    try {
      const decoded = this.xkmp.decode(content);
      this.statusMessage.value = `Imported keymap: ${decoded.name}`;
      return decoded;
    } catch (error) {
      this.statusMessage.value =
        error instanceof InvalidXkmpError
          ? `Keymap import failed [${error.code}]: ${error.message}`
          : "Keymap import failed.";
      throw error;
    }
  }

  saveCurrentKeymapProfile(name: string): KeymapProfile {
    return this.settingsStore.saveCurrentKeymapProfile(name);
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

  decodeXkmpSafe(content: string): { ok: true } | { ok: false; message: string; code: XkmpErrorCode } {
    try {
      this.xkmp.decode(content);
      return { ok: true };
    } catch (error) {
      if (error instanceof InvalidXkmpError) {
        return { ok: false, message: error.message, code: error.code };
      }
      return { ok: false, message: "Unknown xkmp parse error.", code: "XKMP_UNKNOWN" };
    }
  }

  getKeyboardHeight(): number {
    return KEYBOARD_HEIGHT;
  }

  private openTimelineNote(event: NoteEvent): void {
    const item: TimelineEvent = {
      id: `t-${this.timelineSeq++}`,
      note: event.note,
      velocity: event.velocity,
      startAt: performance.now(),
      endAt: null,
    };

    this.timelineEvents.value.push(item);
    const stack = this.openTimelineByNote.get(event.note) || [];
    stack.push(item);
    this.openTimelineByNote.set(event.note, stack);
  }

  private closeTimelineNote(event: NoteEvent): void {
    const stack = this.openTimelineByNote.get(event.note);
    if (!stack || stack.length === 0) {
      return;
    }

    const current = stack.pop();
    if (current) {
      current.endAt = performance.now();
    }

    if (stack.length === 0) {
      this.openTimelineByNote.delete(event.note);
    }
  }

  private trimTimeline(): void {
    const now = performance.now();
    const keepWindowMs = 12000;

    if (this.timelineEvents.value.length > 1200) {
      this.timelineEvents.value = this.timelineEvents.value.slice(this.timelineEvents.value.length - 1000);
      return;
    }

    if (this.timelineEvents.value.length > 260) {
      this.timelineEvents.value = this.timelineEvents.value.filter((item) => {
        const end = item.endAt ?? now;
        return now - end < keepWindowMs;
      });
    }
  }

  private loadRecordingHistory(): void {
    const indexRaw = localStorage.getItem(RECORDING_INDEX_KEY);
    if (!indexRaw) {
      this.recordings.value = [];
      return;
    }

    try {
      const index = JSON.parse(indexRaw) as StoredRecordingIndex[];
      const clips: RecordingClip[] = [];

      for (const meta of index) {
        const dataRaw = localStorage.getItem(`${RECORDING_DATA_PREFIX}${meta.id}`);
        if (!dataRaw) {
          continue;
        }

        const decoded = this.xmid.decode(dataRaw);
        clips.push({
          id: meta.id,
          name: meta.name,
          session: {
            events: decoded.events,
            durationMs: meta.durationMs,
            recordedAt: meta.recordedAt,
          },
          coachSummary: "Loaded from local history.",
          coachSuggestions: ["Ready for replay/export."],
        });
      }

      this.recordings.value = clips;
    } catch {
      this.recordings.value = [];
    }
  }

  private persistRecordingHistory(): void {
    const clips = this.recordings.value.slice(0, MAX_RECORDINGS);
    const index: StoredRecordingIndex[] = clips.map((clip) => ({
      id: clip.id,
      name: clip.name,
      recordedAt: clip.session.recordedAt,
      durationMs: clip.session.durationMs,
    }));

    localStorage.setItem(RECORDING_INDEX_KEY, JSON.stringify(index));

    for (const clip of clips) {
      const encoded = this.exportRecording(clip);
      localStorage.setItem(`${RECORDING_DATA_PREFIX}${clip.id}`, encoded);
    }

    const alive = new Set(index.map((item) => `${RECORDING_DATA_PREFIX}${item.id}`));
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(RECORDING_DATA_PREFIX)) {
        continue;
      }
      if (!alive.has(key)) {
        localStorage.removeItem(key);
      }
    }
  }
}
