<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import type { TimelineEvent } from "../app/pianoRuntime";

const props = defineProps<{
  events: TimelineEvent[];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let rafId = 0;
let observer: ResizeObserver | null = null;

const draw = () => {
  const canvas = canvasRef.value;
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const now = performance.now();
  const width = canvas.width;
  const height = canvas.height;
  const speed = 0.22;

  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#101420");
  gradient.addColorStop(1, "#07090f");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  props.events.forEach((event) => {
    const age = now - event.startAt;
    const duration = (event.endAt ?? now) - event.startAt;
    const y = age * speed;
    const h = Math.max(4, duration * speed);
    if (y - h > height + 24) {
      return;
    }

    const x = ((event.note - 1) / 88) * width;
    const w = Math.max(4, width / 90);
    const hue = (event.note * 11) % 360;
    const alpha = Math.max(0.38, Math.min(0.95, event.velocity / 127));
    ctx.fillStyle = `hsla(${hue}, 85%, 62%, ${alpha})`;
    ctx.fillRect(x, y - h, w, h);
  });

  rafId = requestAnimationFrame(draw);
};

const measure = () => {
  const canvas = canvasRef.value;
  if (!canvas || !canvas.parentElement) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = canvas.parentElement.clientWidth;
  const height = canvas.parentElement.clientHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
};

onMounted(() => {
  measure();
  observer = new ResizeObserver(() => measure());
  if (canvasRef.value?.parentElement) {
    observer.observe(canvasRef.value.parentElement);
  }
  rafId = requestAnimationFrame(draw);
});

onUnmounted(() => {
  cancelAnimationFrame(rafId);
  observer?.disconnect();
});
</script>

<template>
  <div class="timeline-panel">
    <canvas ref="canvasRef" />
  </div>
</template>
