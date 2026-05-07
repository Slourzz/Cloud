import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type SortBy = "newest" | "az" | "artist";

export interface Playlist {
  id: string;
  title: string;
  coverTemplate: string;
  customCoverUrl?: string;
  songIds: string[];
  sortBy: SortBy;
  createdAt: number;
}

export const COVER_TEMPLATES = [
  { id: "tpl-purple", label: "Púrpura", bg: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { id: "tpl-sunset", label: "Atardecer", bg: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" },
  { id: "tpl-ocean", label: "Océano", bg: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" },
  { id: "tpl-forest", label: "Bosque", bg: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)" },
  { id: "tpl-gold", label: "Dorado", bg: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)" },
  { id: "tpl-night", label: "Noche", bg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" },
  { id: "tpl-rose", label: "Rosa", bg: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)" },
  { id: "tpl-mint", label: "Menta", bg: "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)" },
];

export function getPlaylistCoverStyle(playlist: Playlist): React.CSSProperties {
  if (playlist.customCoverUrl) {
    return { backgroundImage: `url(${playlist.customCoverUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
  }
  const tpl = COVER_TEMPLATES.find((t) => t.id === playlist.coverTemplate);
  return { background: tpl?.bg ?? COVER_TEMPLATES[0].bg };
}

interface PlaylistsContextValue {
  playlists: Playlist[];
  createPlaylist: (data: Omit<Playlist, "id" | "createdAt">) => Playlist;
  updatePlaylist: (id: string, data: Partial<Omit<Playlist, "id" | "createdAt">>) => void;
  deletePlaylist: (id: string) => void;
  addSongToPlaylist: (playlistId: string, songId: string) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
}

const PlaylistsContext = createContext<PlaylistsContextValue>({
  playlists: [],
  createPlaylist: () => ({ id: "", title: "", coverTemplate: "", songIds: [], sortBy: "newest", createdAt: 0 }),
  updatePlaylist: () => {},
  deletePlaylist: () => {},
  addSongToPlaylist: () => {},
  removeSongFromPlaylist: () => {},
});

const STORAGE_KEY = "cloud-playlists";

function loadPlaylists(): Playlist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Playlist[];
  } catch {
    return [];
  }
}

function savePlaylists(playlists: Playlist[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
  } catch {}
}

export function PlaylistsProvider({ children }: { children: ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists());

  useEffect(() => {
    savePlaylists(playlists);
  }, [playlists]);

  const createPlaylist = (data: Omit<Playlist, "id" | "createdAt">): Playlist => {
    const playlist: Playlist = {
      ...data,
      id: `playlist-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: Date.now(),
    };
    setPlaylists((prev) => [playlist, ...prev]);
    return playlist;
  };

  const updatePlaylist = (id: string, data: Partial<Omit<Playlist, "id" | "createdAt">>) => {
    setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
  };

  const deletePlaylist = (id: string) => {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
  };

  const addSongToPlaylist = (playlistId: string, songId: string) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId && !p.songIds.includes(songId)
          ? { ...p, songIds: [...p.songIds, songId] }
          : p
      )
    );
  };

  const removeSongFromPlaylist = (playlistId: string, songId: string) => {
    setPlaylists((prev) =>
      prev.map((p) =>
        p.id === playlistId ? { ...p, songIds: p.songIds.filter((id) => id !== songId) } : p
      )
    );
  };

  return (
    <PlaylistsContext.Provider
      value={{ playlists, createPlaylist, updatePlaylist, deletePlaylist, addSongToPlaylist, removeSongFromPlaylist }}
    >
      {children}
    </PlaylistsContext.Provider>
  );
}

export function usePlaylists() {
  return useContext(PlaylistsContext);
}
