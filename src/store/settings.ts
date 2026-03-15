import { defineStore } from "pinia";

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
}

const STORAGE_KEY = "piano_v1_settings";

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
};

function mergeSettings(raw: Partial<PianoSettings>): PianoSettings {
  return {
    ...defaultSettings,
    ...raw,
    pcKeyMap: {
      ...defaultSettings.pcKeyMap,
      ...(raw.pcKeyMap ?? {}),
    },
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
        this.settings = mergeSettings(JSON.parse(data) as Partial<PianoSettings>);
      } catch {
        this.settings = { ...defaultSettings };
      }
    },
    saveToStorage(): void {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    },
    patchSettings(next: Partial<PianoSettings>): void {
      this.settings = mergeSettings({ ...this.settings, ...next });
      this.saveToStorage();
    },
    setPcKeyMap(map: Record<number, number>): void {
      this.settings.pcKeyMap = { ...map };
      this.saveToStorage();
    },
    resetSettings(): void {
      this.settings = { ...defaultSettings };
      this.saveToStorage();
    },
  },
});
