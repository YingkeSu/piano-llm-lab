# Piano-LLM-Lab (Non-LLM Complete)

Piano-LLM-Lab is now a local fullstack monorepo delivering the non-LLM scope:

- Piano page (`/`) with 88-key play, MIDI import/playback/seek, recorder replay/export, comments, keymap profile management.
- Metronome page (`/metronome`) with BPM/time-signature/accent controls.
- Backend auth + session + CSRF + comments API powered by SQLite.
- LLM interfaces are preserved as extension points only (no real model integration).

## Monorepo Layout

- `apps/web`: Vue 3 + Vite frontend
- `apps/api`: Express + SQLite backend
- `packages/shared-types`: shared DTO/types

## Requirements

- Node 22+ (see `.nvmrc`)
- npm 10+

## Quick Start

```bash
npm install
npm run dev:all
```

- Web: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:8787](http://localhost:8787)

## Scripts

```bash
npm run dev:all      # start api + web
npm run dev:web
npm run dev:api
npm run lint:all
npm run test:all
npm run build:all
npm run test:e2e
```

## API Summary

- `GET /api/health`
- `GET /api/csrf`
- `GET /api/auth/me`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/pinlun/list`
- `POST /api/pinlun/publish`
- `POST /api/pinlun/del`

All write APIs require session + `_csrf`.

## Data Persistence

- Backend: SQLite database in `apps/api/data/piano.db`
- Session: SQLite-backed session store in `apps/api/data/sessions.db`
- Frontend settings/keymaps/recording history: browser localStorage

## Soundfont Local-First

Frontend tries local static soundfont first:

- Directory: `apps/web/public/soundfonts`
- Pattern: `<instrument>-MusyngKite.js`

If unavailable, it falls back to remote soundfont, and finally to synth mode.

## Testing

- Unit tests (Vitest): core piano/input/midi/xmid/xkmp + API auth/comments
- E2E tests (Playwright): auth/comments, MIDI+record flow, metronome flow

## LLM Extension

LLM-related types/plugins remain in `apps/web/src/llm`, currently with noop implementation only.
