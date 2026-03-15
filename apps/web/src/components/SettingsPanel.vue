<script setup lang="ts">
import { ref } from "vue";

import type { KeymapProfile, PianoSettings } from "../store/settings";

defineProps<{
  settings: PianoSettings;
}>();

const emit = defineEmits<{
  (event: "patch", patch: Partial<PianoSettings>): void;
  (event: "set-keymap-preset", preset: "black" | "white"): void;
  (event: "export-keymap"): void;
  (event: "import-keymap", file: File): void;
  (event: "save-keymap-profile", name: string): void;
  (event: "apply-keymap-profile", profile: KeymapProfile): void;
  (event: "delete-keymap-profile", id: string): void;
  (event: "reset"): void;
}>();

const keymapInput = ref<HTMLInputElement | null>(null);
const keymapName = ref("");

const openKeymapFile = () => keymapInput.value?.click();

const onKeymapFile = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    emit("import-keymap", file);
  }
  (event.target as HTMLInputElement).value = "";
};

const saveKeymapProfile = () => {
  emit("save-keymap-profile", keymapName.value);
  keymapName.value = "";
};

const formatTime = (ms: number): string => new Date(ms).toLocaleString();
</script>

<template>
  <aside class="settings-panel">
    <h2>Settings</h2>

    <label><input type="checkbox" :checked="settings.showKeyName" @change="emit('patch', { showKeyName: ($event.target as HTMLInputElement).checked })" /> Show key name</label>
    <label><input type="checkbox" :checked="settings.showKeyNumber" @change="emit('patch', { showKeyNumber: ($event.target as HTMLInputElement).checked })" /> Show key number</label>
    <label><input type="checkbox" :checked="settings.showCenterCText" @change="emit('patch', { showCenterCText: ($event.target as HTMLInputElement).checked })" /> Show center C</label>
    <label><input type="checkbox" :checked="settings.tabSustain" @change="emit('patch', { tabSustain: ($event.target as HTMLInputElement).checked })" /> Sustain switch</label>
    <label><input type="checkbox" :checked="settings.shiftSharp" @change="emit('patch', { shiftSharp: ($event.target as HTMLInputElement).checked })" /> Shift raises semitone</label>

    <label>
      Auto release (ms)
      <input type="range" min="0" max="2000" step="10" :value="settings.autoSustainMs" @input="emit('patch', { autoSustainMs: Number(($event.target as HTMLInputElement).value) })" />
      <span>{{ settings.autoSustainMs }}</span>
    </label>

    <label>
      Keyboard scale
      <input type="range" min="0.7" max="1.8" step="0.01" :value="settings.keyboardScale" @input="emit('patch', { keyboardScale: Number(($event.target as HTMLInputElement).value) })" />
      <span>{{ settings.keyboardScale.toFixed(2) }}</span>
    </label>

    <label>
      Keyboard position
      <input type="range" min="0" max="1" step="0.01" :value="settings.keyboardOffset" @input="emit('patch', { keyboardOffset: Number(($event.target as HTMLInputElement).value) })" />
      <span>{{ settings.keyboardOffset.toFixed(2) }}</span>
    </label>

    <div class="actions">
      <button type="button" @click="emit('set-keymap-preset', 'black')">Black-key preset</button>
      <button type="button" @click="emit('set-keymap-preset', 'white')">White-key preset</button>
      <button type="button" @click="emit('export-keymap')">Export keymap</button>
      <button type="button" @click="openKeymapFile">Import keymap</button>
      <input ref="keymapInput" type="file" class="hidden" accept=".xkmp,.json,text/plain" @change="onKeymapFile" />
    </div>

    <div class="profile-tools">
      <input v-model="keymapName" placeholder="Save as keymap name" data-testid="keymap-profile-name" />
      <button type="button" @click="saveKeymapProfile" data-testid="save-keymap-profile">Save Current Mapping</button>
    </div>

    <div class="profile-list">
      <h3>Local Keymap Profiles</h3>
      <p v-if="settings.keymapProfiles.length === 0" class="empty">No local keymap profile.</p>
      <article class="profile-item" v-for="profile in settings.keymapProfiles" :key="profile.id">
        <header>
          <strong>{{ profile.name }}</strong>
          <span>{{ formatTime(profile.createdAt) }}</span>
        </header>
        <p>{{ Object.keys(profile.map).length }} keys</p>
        <div class="actions">
          <button type="button" @click="emit('apply-keymap-profile', profile)">Apply</button>
          <button type="button" class="danger" @click="emit('delete-keymap-profile', profile.id)">Delete</button>
        </div>
      </article>
    </div>

    <button type="button" class="danger" @click="emit('reset')">Reset</button>
  </aside>
</template>
