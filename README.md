# Piano-LLM-Lab V1

Piano-LLM-Lab is a local reproduction of an online piano experience with engineering-ready architecture.

## Features

- 88-key piano layout with mouse/touch/PC keyboard input.
- WebAudio playback with dual mode:
  - `synth` mode (always available).
  - `soundfont` mode with automatic fallback to synth on load failure.
- MIDI import and playback (`.mid`, `.midi`).
- Performance recording and replay.
- XMID custom format export/import (`!xmid`, `v:1`, `m:`, `b:`).
- Settings persistence via `localStorage`.
- Web MIDI device connection (if browser supports it).
- LLM extension entrypoint with `NoopCoachPlugin`.

## Tech Stack

- Vue 3 + TypeScript + Vite
- Pinia
- WebAudio API
- `@tonejs/midi`
- Vitest + ESLint + Prettier

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Commands

```bash
npm run dev
npm run build
npm run test
npm run lint
npm run format
```

## Project Structure

- `src/app`: runtime orchestration
- `src/domain/piano`: note mapping, key layout, shared types
- `src/domain/audio`: `AudioEngine` implementation
- `src/domain/input`: keyboard/touch/midi adapters + input manager
- `src/domain/midi`: MIDI parser and scheduler
- `src/domain/recording`: recorder and XMID codec
- `src/store`: persisted settings store
- `src/components`: UI components
- `src/llm`: plugin interface and noop coach
- `tests`: unit tests

## LLM Extension (V1 scope)

V1 only provides extension points.

- Interface: `LlmCoachPlugin`
- Default plugin: `NoopCoachPlugin`
- Next step: implement real API-backed coach in `src/llm`.

## Notes

- If browser blocks audio autoplay, click `Init Audio` before playing.
- If soundfont loading fails, runtime automatically falls back to synth mode.
