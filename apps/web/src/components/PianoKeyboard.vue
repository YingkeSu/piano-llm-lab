<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

import type { KeyLayout } from "../domain/piano/types";

const props = defineProps<{
  keys: KeyLayout[];
  activeNotes: number[];
  scale: number;
  offsetRatio: number;
  showKeyName: boolean;
  showKeyNumber: boolean;
  showCenterCText: boolean;
}>();

const viewportRef = ref<HTMLElement | null>(null);
const viewportWidth = ref(0);

const whiteKeys = computed(() => props.keys.filter((key) => !key.isBlack));
const blackKeys = computed(() => props.keys.filter((key) => key.isBlack));
const totalWidth = computed(() => {
  const lastWhite = whiteKeys.value[whiteKeys.value.length - 1];
  return lastWhite ? lastWhite.left + lastWhite.width : 0;
});

const scaledTotalWidth = computed(() => totalWidth.value * props.scale);
const maxOffset = computed(() => Math.max(0, scaledTotalWidth.value - viewportWidth.value));
const offsetPx = computed(() => props.offsetRatio * maxOffset.value);

const activeSet = computed(() => new Set(props.activeNotes));

const measure = () => {
  viewportWidth.value = viewportRef.value?.clientWidth ?? 0;
};

let observer: ResizeObserver | null = null;

onMounted(() => {
  measure();
  observer = new ResizeObserver(() => measure());
  if (viewportRef.value) {
    observer.observe(viewportRef.value);
  }
});

onUnmounted(() => {
  observer?.disconnect();
});

function getPointerState(): { scale: number; offsetPx: number } {
  return {
    scale: props.scale,
    offsetPx: offsetPx.value,
  };
}

function getViewportElement(): HTMLElement | null {
  return viewportRef.value;
}

const centerCNote = 40;

defineExpose({
  getPointerState,
  getViewportElement,
  getMaxOffset: () => maxOffset.value,
});
</script>

<template>
  <div ref="viewportRef" class="keyboard-viewport">
    <div class="keyboard-track" :style="{ width: `${scaledTotalWidth}px`, left: `${-offsetPx}px` }">
      <button
        v-for="key in whiteKeys"
        :key="`w-${key.note}`"
        class="key white"
        :class="{ active: activeSet.has(key.note) }"
        :style="{ left: `${key.left * scale}px`, width: `${key.width * scale}px` }"
      >
        <span v-if="showKeyNumber" class="num">{{ key.note }}</span>
        <span v-if="showKeyName" class="label">{{ key.label }}</span>
        <span v-if="showCenterCText && key.note === centerCNote" class="center-c">C4</span>
      </button>
      <button
        v-for="key in blackKeys"
        :key="`b-${key.note}`"
        class="key black"
        :class="{ active: activeSet.has(key.note) }"
        :style="{ left: `${key.left * scale}px`, width: `${key.width * scale}px` }"
      >
        <span v-if="showKeyNumber" class="num">{{ key.note }}</span>
        <span v-if="showKeyName" class="label">{{ key.label }}</span>
      </button>
    </div>
  </div>
</template>
