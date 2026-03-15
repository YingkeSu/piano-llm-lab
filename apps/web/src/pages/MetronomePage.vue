<script setup lang="ts">
import { onUnmounted, ref, watch } from "vue";

import { MetronomeEngine } from "../domain/audio/metronomeEngine";

const bpm = ref(100);
const beatsPerBar = ref(4);
const accentGain = ref(0.35);
const normalGain = ref(0.2);
const running = ref(false);
const status = ref("Ready");

const engine = new MetronomeEngine();

const syncOptions = () => {
  engine.setOptions({
    bpm: bpm.value,
    beatsPerBar: beatsPerBar.value,
    accentGain: accentGain.value,
    normalGain: normalGain.value,
  });
};

watch([bpm, beatsPerBar, accentGain, normalGain], syncOptions);

const start = async () => {
  syncOptions();
  try {
    await engine.start();
    running.value = true;
    status.value = `Running at ${bpm.value} BPM`;
  } catch (error) {
    status.value = error instanceof Error ? error.message : "Metronome start failed";
  }
};

const stop = () => {
  engine.stop();
  running.value = false;
  status.value = "Stopped";
};

onUnmounted(() => {
  stop();
});
</script>

<template>
  <section class="page metronome-page">
    <header class="hero">
      <h1>Metronome</h1>
      <p>Shared WebAudio context with piano page. Supports tempo, beats per bar and accent intensity.</p>
      <p class="status" data-testid="metronome-status">{{ status }}</p>
    </header>

    <article class="metronome-card">
      <label>
        BPM
        <input v-model.number="bpm" type="number" min="20" max="320" step="1" data-testid="metronome-bpm" />
      </label>

      <label>
        Beats Per Bar
        <select v-model.number="beatsPerBar" data-testid="metronome-beats">
          <option :value="2">2/4</option>
          <option :value="3">3/4</option>
          <option :value="4">4/4</option>
          <option :value="5">5/4</option>
          <option :value="6">6/8</option>
          <option :value="7">7/8</option>
        </select>
      </label>

      <label>
        Accent Volume
        <input v-model.number="accentGain" type="range" min="0.05" max="0.8" step="0.01" />
        <span>{{ accentGain.toFixed(2) }}</span>
      </label>

      <label>
        Normal Volume
        <input v-model.number="normalGain" type="range" min="0.05" max="0.8" step="0.01" />
        <span>{{ normalGain.toFixed(2) }}</span>
      </label>

      <div class="actions">
        <button v-if="!running" type="button" @click="start" data-testid="metronome-start">Start</button>
        <button v-else type="button" class="danger" @click="stop" data-testid="metronome-stop">Stop</button>
      </div>
    </article>
  </section>
</template>
