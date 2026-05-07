# Cloud — Music Player

Desktop music player web app. Users upload their own audio files and listen with a premium Apple Music–style experience.

## Run & Operate

- `pnpm --filter @workspace/music-player run dev` — start frontend (via workflow)
- `pnpm --filter @workspace/api-server run dev` — start API server (via workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

Required env vars: `PORT`, `SESSION_SECRET`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`

## Stack

- **Frontend**: React + Vite + Tailwind v4 + Wouter router + Lucide + shadcn/ui Slider
- **Backend**: Express 5 + pnpm workspace monorepo
- **AI**: OpenAI via Replit AI Integrations (`@workspace/integrations-openai-ai-server`)
- **Storage**: IndexedDB (`cloud-music-db`) for audio + cover persistence
- **Theme**: Material You M3 blue (`#0A84FF`), dark mode default
- **Node.js**: 24 / TypeScript 5.9

## Where things live

- `artifacts/music-player/src/hooks/use-music-player.tsx` — all playback state, IndexedDB persistence, iTunes art search
- `artifacts/music-player/src/hooks/use-song-db.ts` — IndexedDB CRUD (save/load/cover/delete songs)
- `artifacts/music-player/src/hooks/use-theme-colors.tsx` — RAF-animated `--dyn-v/d/m` CSS vars from album art
- `artifacts/music-player/src/hooks/use-lyrics.tsx` — TTML + plain text parsers, lyrics.ovh auto-fetch
- `artifacts/music-player/src/hooks/use-dark-mode.tsx` — dark mode default (localStorage key: `cloud-mode`)
- `artifacts/music-player/src/hooks/use-playlists.tsx` — playlist CRUD (localStorage key: `cloud-playlists`)
- `artifacts/api-server/src/routes/ttml.ts` — `POST /api/ttml/generate` — AI TTML generation via OpenAI

## Architecture decisions

- **IndexedDB for audio**: songs are stored as ArrayBuffers in `cloud-music-db`; blob URLs created on load. Avoids data loss on refresh.
- **Dynamic theming via RAF**: `--dyn-v/d/m` CSS vars updated at 60fps from canvas pixel sampling of album art. Used via `rgb(var(--dyn-v))` everywhere.
- **No demo songs**: app starts empty; only user-uploaded audio.
- **TTML AI generation**: server-side OpenAI call with strict system prompt — only uses real known lyrics; returns `{"error":"lyrics_not_found"}` if uncertain.
- **Dark mode default**: inline `<script>` in `index.html` applies `.dark` before React mounts, preventing flash.

## Product

- Upload MP3/WAV/FLAC/AAC/OGG/M4A/OPUS files
- Auto album art from iTunes Search API on upload
- Custom cover art per song (click thumbnail in library → pick image)
- Delete songs from library (also removes from IndexedDB)
- Songs persist across sessions via IndexedDB (no re-upload needed)
- Crossfade 0–12s between songs
- AI-generated TTML lyrics (real lyrics only, via `POST /api/ttml/generate`)
- Upload TTML or plain text lyrics manually
- Fullscreen player with lyrics panel (word glow + idle dots)
- Playlists with custom covers and sorting
- Liked songs list
- Queue management

## Gotchas

- Blob URLs revoked on cleanup; all audio/cover data stored in IndexedDB
- `res.json()` must only be called once per response (body is a stream)
- The AI TTML endpoint returns 404 with `{"error":"lyrics_not_found"}` when lyrics are unknown — handle in frontend
- `cloud-mode` localStorage key (values: `"dark"` | `"light"`) — changed from `cloud-dark` to reset stale state
