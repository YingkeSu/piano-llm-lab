<script setup lang="ts">
import type { RecordingClip } from "../app/pianoRuntime";

defineProps<{
  clips: RecordingClip[];
}>();

const emit = defineEmits<{
  (event: "play", clip: RecordingClip): void;
  (event: "export", clip: RecordingClip): void;
}>();

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString();
const formatDuration = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
</script>

<template>
  <section class="recording-list">
    <h2>Recordings</h2>
    <p v-if="clips.length === 0" class="empty">No recordings yet.</p>
    <article v-for="clip in clips" :key="clip.id" class="record-item">
      <header>
        <strong>{{ clip.name }}</strong>
        <span>{{ formatTime(clip.session.recordedAt) }}</span>
      </header>
      <p>Duration: {{ formatDuration(clip.session.durationMs) }}</p>
      <p>{{ clip.coachSummary }}</p>
      <ul>
        <li v-for="tip in clip.coachSuggestions" :key="tip">{{ tip }}</li>
      </ul>
      <div class="actions">
        <button type="button" @click="emit('play', clip)" data-testid="record-play">Play</button>
        <button type="button" @click="emit('export', clip)" data-testid="record-export">Export XMID</button>
      </div>
    </article>
  </section>
</template>
