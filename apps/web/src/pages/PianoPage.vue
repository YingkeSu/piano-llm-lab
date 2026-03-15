<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";

import ControlBar from "../components/ControlBar.vue";
import NoteTimeline from "../components/NoteTimeline.vue";
import PianoComments from "../components/PianoComments.vue";
import PianoKeyboard from "../components/PianoKeyboard.vue";
import RecordingList from "../components/RecordingList.vue";
import SettingsPanel from "../components/SettingsPanel.vue";
import { PianoRuntime, type RecordingClip } from "../app/pianoRuntime";
import {
  blackKeyMapPreset,
  useSettingsStore,
  whiteKeyMapPreset,
  type KeymapProfile,
} from "../store/settings";

interface KeyboardExpose {
  getViewportElement(): HTMLElement | null;
  getPointerState(): { scale: number; offsetPx: number };
  getMaxOffset(): number;
}

const settingsStore = useSettingsStore();
const runtime = shallowRef<PianoRuntime | null>(null);
const keyboardRef = ref<KeyboardExpose | null>(null);
const dragging = ref(false);

const activeNotes = computed(() => runtime.value?.activeNotes.value ?? []);
const timelineEvents = computed(() => runtime.value?.timelineEvents.value ?? []);
const playbackNowMs = computed(() => runtime.value?.playbackNowMs.value ?? 0);
const playbackTotalMs = computed(() => runtime.value?.playbackTotalMs.value ?? 0);
const playbackPlaying = computed(() => runtime.value?.playbackPlaying.value ?? false);
const recording = computed(() => runtime.value?.recording.value ?? false);
const recordings = computed(() => runtime.value?.recordings.value ?? []);
const statusMessage = computed(() => runtime.value?.statusMessage.value ?? "Booting");
const audioMode = computed(() => runtime.value?.audioMode.value ?? "synth");
const soundfontLoaded = computed(() => runtime.value?.soundfontLoaded.value ?? false);
const midiConnected = computed(() => runtime.value?.midiConnected.value ?? false);
const midiSupported = computed(() => runtime.value?.midiSupported.value ?? false);
const midiInputNames = computed(() => runtime.value?.midiInputNames.value ?? []);
const playbackMeta = computed(() => runtime.value?.playbackMeta.value ?? {});

const loadFileText = async (file: File): Promise<string> => file.text();

const downloadText = (name: string, content: string): void => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const attachKeyboard = () => {
  const keyboard = keyboardRef.value;
  const app = runtime.value;
  if (!keyboard || !app) {
    return;
  }

  const viewport = keyboard.getViewportElement();
  if (!viewport) {
    return;
  }

  app.attachKeyboard(viewport, () => keyboard.getPointerState());
};

watch(
  () => settingsStore.settings,
  () => {
    runtime.value?.applySettingSync();
  },
  { deep: true },
);

const patchSettings = (patch: Partial<typeof settingsStore.settings>) => {
  settingsStore.patchSettings(patch);
};

const onAudioReady = async () => {
  await runtime.value?.ensureAudioReady();
};

const onAudioMode = (mode: "synth" | "soundfont") => {
  runtime.value?.setAudioMode(mode);
};

const onLoadSoundfont = async () => {
  await runtime.value?.loadSoundfont("acoustic_grand_piano");
};

const onLoadMidi = async (file: File) => {
  try {
    await runtime.value?.loadMidiFile(file);
  } catch {
    // runtime updates status message
  }
};

const onSeekMidi = (ms: number) => {
  runtime.value?.seekMidi(ms);
};

const onImportXmid = async (file: File) => {
  try {
    const text = await loadFileText(file);
    runtime.value?.importXmid(text, file.name);
  } catch {
    // runtime updates status message
  }
};

const onRecordStart = () => runtime.value?.startRecording();
const onRecordStop = async () => {
  await runtime.value?.stopRecording();
};

const onRecordingPlay = async (clip: RecordingClip) => {
  await runtime.value?.playRecording(clip);
};

const onRecordingExport = (clip: RecordingClip) => {
  const content = runtime.value?.exportRecording(clip);
  if (!content) {
    return;
  }
  downloadText(`${clip.name}.xmid`, content);
};

const onExportKeymap = () => {
  const content = runtime.value?.exportKeymap(`keymap-${Date.now()}`);
  if (!content) {
    return;
  }
  downloadText(`piano-keymap-${Date.now()}.xkmp`, content);
};

const onImportKeymap = async (file: File) => {
  try {
    const content = await loadFileText(file);
    const parsed = runtime.value?.importKeymap(content);
    if (!parsed) {
      return;
    }
    settingsStore.setPcKeyMap(parsed.map);
  } catch {
    // runtime updates status message
  }
};

const onSetKeymapPreset = (preset: "black" | "white") => {
  settingsStore.setPcKeyMap(preset === "black" ? blackKeyMapPreset : whiteKeyMapPreset);
};

const onSaveKeymapProfile = (name: string) => {
  runtime.value?.saveCurrentKeymapProfile(name);
};

const onApplyKeymapProfile = (profile: KeymapProfile) => {
  settingsStore.applyKeymapProfile(profile.id);
};

const onDeleteKeymapProfile = (id: string) => {
  settingsStore.deleteKeymapProfile(id);
};

const onResetSettings = () => {
  settingsStore.resetSettings();
};

const handleDropFile = async (file: File) => {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".mid") || lower.endsWith(".midi")) {
    await onLoadMidi(file);
    return;
  }
  if (lower.endsWith(".xmid")) {
    await onImportXmid(file);
    return;
  }
  if (lower.endsWith(".xkmp")) {
    await onImportKeymap(file);
  }
};

const onDrop = async (event: DragEvent) => {
  event.preventDefault();
  dragging.value = false;
  const files = event.dataTransfer?.files;
  if (!files?.length) {
    return;
  }

  for (let i = 0; i < files.length; i += 1) {
    await handleDropFile(files[i]);
  }
};

onMounted(async () => {
  const appRuntime = new PianoRuntime();
  runtime.value = appRuntime;
  await appRuntime.init();
  await nextTick();
  attachKeyboard();
  appRuntime.applySettingSync();
});

onUnmounted(() => {
  runtime.value?.destroy();
});
</script>

<template>
  <div
    class="page"
    :class="{ dragging }"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop="onDrop"
  >
    <header class="hero">
      <h1>Piano Lab</h1>
      <p>88 keys, MIDI, recorder, comments, keymap presets and local persistence.</p>
      <p class="status" data-testid="status-message">{{ statusMessage }}</p>
      <p v-if="midiInputNames.length" class="status">MIDI Inputs: {{ midiInputNames.join(', ') }}</p>
      <p class="drop-tip">Drop .mid/.xmid/.xkmp files anywhere on this page.</p>
    </header>

    <ControlBar
      :playback-now-ms="playbackNowMs"
      :playback-total-ms="playbackTotalMs"
      :playback-playing="playbackPlaying"
      :recording="recording"
      :audio-mode="audioMode"
      :soundfont-loaded="soundfontLoaded"
      :midi-connected="midiConnected"
      :midi-supported="midiSupported"
      @audio-ready="onAudioReady"
      @audio-mode="onAudioMode"
      @load-soundfont="onLoadSoundfont"
      @load-midi="onLoadMidi"
      @play="runtime?.playMidi()"
      @pause="runtime?.pauseMidi()"
      @stop="runtime?.stopMidi()"
      @seek="onSeekMidi"
      @record-start="onRecordStart"
      @record-stop="onRecordStop"
      @import-xmid="onImportXmid"
      @connect-midi="runtime?.connectMidi()"
      @disconnect-midi="runtime?.disconnectMidi()"
    />

    <main class="workspace">
      <section class="piano-area">
        <div class="timeline-wrap">
          <NoteTimeline :events="timelineEvents" />
        </div>
        <PianoKeyboard
          ref="keyboardRef"
          :keys="runtime?.keyLayout.keys ?? []"
          :active-notes="activeNotes"
          :scale="settingsStore.settings.keyboardScale"
          :offset-ratio="settingsStore.settings.keyboardOffset"
          :show-key-name="settingsStore.settings.showKeyName"
          :show-key-number="settingsStore.settings.showKeyNumber"
          :show-center-c-text="settingsStore.settings.showCenterCText"
        />
      </section>

      <SettingsPanel
        :settings="settingsStore.settings"
        @patch="patchSettings"
        @set-keymap-preset="onSetKeymapPreset"
        @export-keymap="onExportKeymap"
        @import-keymap="onImportKeymap"
        @save-keymap-profile="onSaveKeymapProfile"
        @apply-keymap-profile="onApplyKeymapProfile"
        @delete-keymap-profile="onDeleteKeymapProfile"
        @reset="onResetSettings"
      />
    </main>

    <section class="meta-panel" v-if="Object.keys(playbackMeta).length">
      <h2>Playback Meta</h2>
      <div class="meta-grid">
        <div v-for="(value, key) in playbackMeta" :key="key"><strong>{{ key }}:</strong> {{ value }}</div>
      </div>
    </section>

    <RecordingList :clips="recordings" @play="onRecordingPlay" @export="onRecordingExport" />

    <PianoComments />
  </div>
</template>
