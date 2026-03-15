import { defineStore } from "pinia";

export interface KeymapProfile {
  id: string;
  name: string;
  createdAt: number;
  map: Record<number, number>;
}

export interface PianoSettings {
  showKeyName: boolean;
  showKeyNumber: boolean;
  showCenterCText: boolean;
  autoSustainMs: number;
  shiftSharp: boolean;
  tabSustain: boolean;
  keyboardScale: number;
  keyboardOffset: number;
  pcKeyMap: Record<number, number>;
  keymapProfiles: KeymapProfile[];
}

const STORAGE_KEY = "piano_v1_settings";
const STORAGE_VERSION = 2;

export const blackKeyMapPreset: Record<number, number> = {
  90: 28,
  83: 29,
  88: 30,
  68: 31,
  67: 32,
  86: 33,
  71: 34,
  66: 35,
  72: 36,
  78: 37,
  74: 38,
  77: 39,
  188: 40,
  81: 40,
  76: 41,
  50: 41,
  190: 42,
  87: 42,
  186: 43,
  51: 43,
  191: 44,
  69: 44,
  82: 45,
  53: 46,
  84: 47,
  54: 48,
  89: 49,
  55: 50,
  85: 51,
  73: 52,
  57: 53,
  79: 54,
  48: 55,
  80: 56,
  219: 57,
  187: 58,
  221: 59,
};

export const whiteKeyMapPreset: Record<number, number> = {
  90: 16,
  88: 18,
  67: 20,
  86: 21,
  66: 23,
  78: 25,
  77: 27,
  65: 28,
  83: 30,
  68: 32,
  70: 33,
  71: 35,
  72: 37,
  74: 39,
  75: 40,
  76: 42,
  81: 40,
  87: 42,
  69: 44,
  82: 45,
  84: 47,
  89: 49,
  85: 51,
  73: 52,
  79: 54,
  80: 56,
  219: 57,
  221: 59,
};

export const defaultSettings: PianoSettings = {
  showKeyName: true,
  showKeyNumber: false,
  showCenterCText: true,
  autoSustainMs: 500,
  shiftSharp: true,
  tabSustain: true,
  keyboardScale: 1,
  keyboardOffset: 0,
  pcKeyMap: { ...blackKeyMapPreset },
  keymapProfiles: [],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizeKeyMap(map: Record<number, number> | Record<string, number>): Record<number, number> {
  const out: Record<number, number> = {};
  Object.entries(map || {}).forEach(([key, value]) => {
    const code = Number.parseInt(String(key), 10);
    const note = Number.parseInt(String(value), 10);
    if (!Number.isInteger(code) || !Number.isInteger(note)) {
      return;
    }
    if (code < 1 || code > 255 || note < 1 || note > 88) {
      return;
    }
    out[code] = note;
  });
  return out;
}

function sanitizeProfiles(raw: unknown): KeymapProfile[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Partial<KeymapProfile>;
      const id = String(candidate.id || "").trim();
      const name = String(candidate.name || "").trim();
      const createdAt = Number(candidate.createdAt);
      const map = sanitizeKeyMap((candidate.map as Record<string, number>) || {});
      if (!id || !name || !Number.isFinite(createdAt)) {
        return null;
      }

      return {
        id,
        name: name.slice(0, 60),
        createdAt,
        map,
      } satisfies KeymapProfile;
    })
    .filter((item): item is KeymapProfile => !!item);
}

function mergeSettings(raw: Partial<PianoSettings>): PianoSettings {
  const merged = {
    ...defaultSettings,
    ...raw,
  };

  const safeMap = sanitizeKeyMap(raw.pcKeyMap || merged.pcKeyMap || defaultSettings.pcKeyMap);

  return {
    ...merged,
    autoSustainMs: clamp(Number(merged.autoSustainMs || 0), 0, 3000),
    keyboardScale: clamp(Number(merged.keyboardScale || 1), 0.7, 1.8),
    keyboardOffset: clamp(Number(merged.keyboardOffset || 0), 0, 1),
    pcKeyMap: Object.keys(safeMap).length ? safeMap : { ...defaultSettings.pcKeyMap },
    keymapProfiles: sanitizeProfiles(raw.keymapProfiles),
  };
}

export const useSettingsStore = defineStore("settings", {
  state: () => ({
    settings: { ...defaultSettings },
  }),
  actions: {
    loadFromStorage(): void {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        return;
      }

      try {
        const parsed = JSON.parse(data) as unknown;
        let payload: Partial<PianoSettings> = {};

        if (parsed && typeof parsed === "object" && "settings" in parsed) {
          const nested = (parsed as { settings?: unknown }).settings;
          payload = nested && typeof nested === "object" ? (nested as Partial<PianoSettings>) : {};
        } else if (parsed && typeof parsed === "object") {
          payload = parsed as Partial<PianoSettings>;
        }

        this.settings = mergeSettings(payload);
      } catch {
        this.settings = { ...defaultSettings };
      }
    },
    saveToStorage(): void {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: STORAGE_VERSION,
          settings: this.settings,
        }),
      );
    },
    patchSettings(next: Partial<PianoSettings>): void {
      this.settings = mergeSettings({ ...this.settings, ...next });
      this.saveToStorage();
    },
    setPcKeyMap(map: Record<number, number>): void {
      this.settings.pcKeyMap = sanitizeKeyMap(map);
      this.saveToStorage();
    },
    saveCurrentKeymapProfile(name: string): KeymapProfile {
      const normalized = name.trim().slice(0, 60) || `Keymap ${this.settings.keymapProfiles.length + 1}`;
      const profile: KeymapProfile = {
        id: `kmp-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        name: normalized,
        createdAt: Date.now(),
        map: { ...this.settings.pcKeyMap },
      };

      this.settings.keymapProfiles = [profile, ...this.settings.keymapProfiles].slice(0, 20);
      this.saveToStorage();
      return profile;
    },
    applyKeymapProfile(id: string): void {
      const profile = this.settings.keymapProfiles.find((item) => item.id === id);
      if (!profile) {
        return;
      }
      this.settings.pcKeyMap = { ...profile.map };
      this.saveToStorage();
    },
    deleteKeymapProfile(id: string): void {
      this.settings.keymapProfiles = this.settings.keymapProfiles.filter((item) => item.id !== id);
      this.saveToStorage();
    },
    resetSettings(): void {
      this.settings = { ...defaultSettings };
      this.saveToStorage();
    },
  },
});
