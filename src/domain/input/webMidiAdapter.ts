import { midiToNote, MAX_MIDI, MIN_MIDI } from "../piano/noteMapper";
import { InputManager } from "./inputManager";

export interface WebMidiStatus {
  supported: boolean;
  connected: boolean;
  inputNames: string[];
  error: string;
}

export class WebMidiAdapter {
  private midiAccess: MIDIAccess | null = null;

  private status: WebMidiStatus = {
    supported: typeof navigator !== "undefined" && "requestMIDIAccess" in navigator,
    connected: false,
    inputNames: [],
    error: "",
  };

  constructor(private readonly inputManager: InputManager) {}

  getStatus(): WebMidiStatus {
    return { ...this.status, inputNames: [...this.status.inputNames] };
  }

  async connect(): Promise<WebMidiStatus> {
    if (!this.status.supported) {
      this.status.error = "Web MIDI is not supported by current browser.";
      return this.getStatus();
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this.bindInputs();
      this.midiAccess.onstatechange = () => this.bindInputs();
      this.status.connected = true;
      this.status.error = "";
    } catch (error) {
      this.status.connected = false;
      this.status.error = error instanceof Error ? error.message : "Failed to request MIDI access.";
    }

    return this.getStatus();
  }

  disconnect(): WebMidiStatus {
    if (!this.midiAccess) {
      this.status.connected = false;
      return this.getStatus();
    }

    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      input.onmidimessage = null;
    }

    this.midiAccess.onstatechange = null;
    this.midiAccess = null;
    this.status.connected = false;
    this.status.inputNames = [];
    this.inputManager.clearSource("web-midi");
    return this.getStatus();
  }

  private bindInputs(): void {
    if (!this.midiAccess) {
      return;
    }

    const names: string[] = [];
    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      input.onmidimessage = this.onMidiMessage;
      names.push(input.name || input.manufacturer || "MIDI Input");
    }

    this.status.inputNames = names;
  }

  private onMidiMessage = (event: MIDIMessageEvent): void => {
    const data = event.data;
    if (!data || data.length < 3) {
      return;
    }

    const [status, midiNote, velocity] = data;
    const cmd = status & 0xf0;

    if (midiNote < MIN_MIDI || midiNote > MAX_MIDI) {
      return;
    }

    const note = midiToNote(midiNote);
    if (cmd === 0x90 && velocity > 0) {
      this.inputManager.noteOn(note, velocity, "web-midi");
      return;
    }

    if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
      this.inputManager.noteOff(note, "web-midi");
    }
  };
}
