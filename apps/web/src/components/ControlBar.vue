<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{
  playbackNowMs: number;
  playbackTotalMs: number;
  playbackPlaying: boolean;
  recording: boolean;
  audioMode: "synth" | "soundfont";
  soundfontLoaded: boolean;
  midiConnected: boolean;
  midiSupported: boolean;
}>();

const emit = defineEmits<{
  (event: "audio-ready"): void;
  (event: "audio-mode", mode: "synth" | "soundfont"): void;
  (event: "load-soundfont"): void;
  (event: "load-midi", file: File): void;
  (event: "play"): void;
  (event: "pause"): void;
  (event: "stop"): void;
  (event: "seek", ms: number): void;
  (event: "record-start"): void;
  (event: "record-stop"): void;
  (event: "import-xmid", file: File): void;
  (event: "connect-midi"): void;
  (event: "disconnect-midi"): void;
}>();

const midiInput = ref<HTMLInputElement | null>(null);
const xmidInput = ref<HTMLInputElement | null>(null);

const openMidiFile = () => midiInput.value?.click();
const openXmidFile = () => xmidInput.value?.click();

const onMidiFile = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    emit("load-midi", file);
  }
  (event.target as HTMLInputElement).value = "";
};

const onXmidFile = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    emit("import-xmid", file);
  }
  (event.target as HTMLInputElement).value = "";
};

const formatMs = (ms: number): string => {
  const safe = Math.max(0, Math.round(ms));
  const minutes = Math.floor(safe / 60000);
  const seconds = Math.floor((safe % 60000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const seekValue = computed(() => Math.round(props.playbackNowMs));
</script>

<template>
  <section class="control-bar">
    <div class="control-row">
      <button type="button" @click="$emit('audio-ready')">Init Audio</button>
      <label>
        Mode
        <select
          :value="audioMode"
          @change="$emit('audio-mode', ($event.target as HTMLSelectElement).value as 'synth' | 'soundfont')"
          data-testid="audio-mode-select"
        >
          <option value="synth">Synth</option>
          <option value="soundfont">Soundfont</option>
        </select>
      </label>
      <button type="button" :disabled="soundfontLoaded" @click="$emit('load-soundfont')">
        {{ soundfontLoaded ? 'Soundfont Ready' : 'Load Soundfont' }}
      </button>
      <button type="button" @click="openMidiFile" data-testid="import-midi">Import MIDI</button>
      <button type="button" @click="openXmidFile">Import XMID</button>
      <input ref="midiInput" type="file" accept=".mid,.midi,audio/midi" class="hidden" @change="onMidiFile" data-testid="midi-file-input" />
      <input ref="xmidInput" type="file" accept=".xmid,text/plain" class="hidden" @change="onXmidFile" />
    </div>

    <div class="control-row">
      <button type="button" @click="$emit('play')" data-testid="play-midi">Play</button>
      <button type="button" @click="$emit('pause')">Pause</button>
      <button type="button" @click="$emit('stop')" data-testid="stop-midi">Stop</button>
      <span class="time">{{ playbackPlaying ? 'Playing' : 'Idle' }} {{ formatMs(playbackNowMs) }} / {{ formatMs(playbackTotalMs) }}</span>
      <button v-if="!recording" type="button" class="danger" @click="$emit('record-start')" data-testid="record-start">Start Record</button>
      <button v-else type="button" class="danger" @click="$emit('record-stop')" data-testid="record-stop">Stop Record</button>
      <button v-if="midiSupported && !midiConnected" type="button" @click="$emit('connect-midi')">Connect MIDI</button>
      <button v-if="midiSupported && midiConnected" type="button" @click="$emit('disconnect-midi')">Disconnect MIDI</button>
      <span v-if="!midiSupported" class="warn">Web MIDI not supported</span>
    </div>

    <div class="control-row seek-row">
      <label for="seek-bar">Seek</label>
      <input
        id="seek-bar"
        class="seek-bar"
        type="range"
        min="0"
        :max="Math.max(1, Math.round(playbackTotalMs))"
        :value="seekValue"
        :disabled="playbackTotalMs <= 0"
        @input="$emit('seek', Number(($event.target as HTMLInputElement).value))"
        data-testid="seek-midi"
      />
      <span>{{ formatMs(playbackNowMs) }}</span>
    </div>
  </section>
</template>
