# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Music Player Artifact (`artifacts/music-player`)

Full desktop music player at `/`. React + Vite + Tailwind v4 + Material You (M3) deep purple theme.

### Architecture

- **`src/hooks/use-music-player.tsx`** — central state: real HTMLAudioElement playback, crossfade (two audio refs, setInterval fade), iTunes API album art auto-search for user uploads, simulated timer for demo songs.
- **`src/hooks/use-theme-colors.tsx`** — extracts vibrant color from current album art via canvas, animates `--dyn-v` / `--dyn-d` / `--dyn-m` CSS custom properties via `requestAnimationFrame` at 60fps for smooth color transitions across the whole UI.
- **`src/hooks/use-playlists.tsx`** — playlist CRUD with localStorage persistence. Covers: 8 gradient templates + custom image. Sort by newest/A-Z/artist.
- **`src/hooks/use-lyrics.tsx`** — TTML parser (via DOMParser), plain text parser, auto-fetch from lyrics.ovh API (no key needed).

### Layout

- **Sidebar** (240px): Explorar · Biblioteca · Me gusta · Settings gear button · Mini now-playing indicator
- **Main content**: route-based pages
- **Transport bar** (floating pill, bottom center): all controls + progress + volume, colors driven by `--dyn-v`
- **Corner controls** (bottom-right): Queue toggle (navigates to /queue) + Fullscreen button
- **Fullscreen overlay**: dynamic gradient bg from album art, album art + controls (left) + lyrics panel (right)

### Dynamic Theming

CSS variables `--dyn-v`, `--dyn-d`, `--dyn-m` (RGB space-separated) are updated frame-by-frame via RAF. Components use `rgb(var(--dyn-v))` inline styles. The background gradient overlay in Layout uses these variables, creating a smooth ambient glow that changes with each song. Sidebar active states, play button, corner buttons, slider thumb all follow the dynamic color.

### Routes

- `/` — Now Playing (large centered album art)
- `/library` — Full song list with search
- `/queue` — Playback queue
- `/liked` — Liked songs list
- `/playlists` — Playlists grid (Explorar mode)
- `/playlists/:id` — Playlist detail with editable title, sort, add/remove songs

### Features

- **Real audio playback** for uploaded files (HTMLAudioElement)
- **Crossfade** 0–12s between user-uploaded songs
- **Auto album art** from iTunes Search API for uploaded songs
- **Auto lyrics** from lyrics.ovh (no key) for uploaded songs
- **TTML lyrics** upload with Apple Music–style word-level sync
- **Plain text lyrics** upload (line-based)
- **Fullscreen lyrics** with auto-scroll, past/current/future line styling
- **Playlist system**: create/edit/delete, custom covers, sort, add songs
- **Settings panel**: audio quality selector, crossfade slider, drag-and-drop file upload
