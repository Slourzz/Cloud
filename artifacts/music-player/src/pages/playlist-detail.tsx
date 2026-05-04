import React, { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { usePlaylists, getPlaylistCoverStyle, SortBy, COVER_TEMPLATES } from "@/hooks/use-playlists";
import { useMusicPlayer, DEMO_SONGS, Song } from "@/hooks/use-music-player";
import { CreatePlaylistDialog } from "@/components/create-playlist-dialog";
import {
  ArrowLeft, Play, Shuffle, MoreVertical, Plus, Search,
  Pencil, Trash2, Music2,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function sortSongs(songs: Song[], sortBy: SortBy): Song[] {
  switch (sortBy) {
    case "az": return [...songs].sort((a, b) => a.title.localeCompare(b.title));
    case "artist": return [...songs].sort((a, b) => {
      const cmp = a.artist.localeCompare(b.artist);
      return cmp !== 0 ? cmp : a.title.localeCompare(b.title);
    });
    default: return songs;
  }
}

export default function PlaylistDetail() {
  const params = useParams<{ id: string }>();
  const { playlists, addSongToPlaylist, removeSongFromPlaylist, updatePlaylist } = usePlaylists();
  const { allSongs, play, currentSong, isPlaying, toggleShuffle } = useMusicPlayer();

  const [editOpen, setEditOpen] = useState(false);
  const [addSongSearch, setAddSongSearch] = useState("");
  const [showAddSongs, setShowAddSongs] = useState(false);

  const playlist = playlists.find((p) => p.id === params.id);

  if (!playlist) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-on-surface-variant">
        <Music2 className="w-16 h-16 opacity-20" />
        <p className="text-lg font-medium">Playlist no encontrada</p>
        <Link href="/playlists">
          <a className="text-primary text-sm font-semibold hover:underline">Volver a Explorar</a>
        </Link>
      </div>
    );
  }

  const playlistSongs = playlist.songIds
    .map((id) => allSongs.find((s) => s.id === id))
    .filter((s): s is Song => s !== undefined);

  const sorted = sortSongs(playlistSongs, playlist.sortBy);
  const totalDuration = sorted.reduce((acc, s) => acc + s.duration, 0);

  const handlePlay = () => {
    if (sorted.length > 0) play(sorted[0]);
  };

  const availableToAdd = allSongs.filter(
    (s) => !playlist.songIds.includes(s.id) &&
      (addSongSearch === "" ||
        s.title.toLowerCase().includes(addSongSearch.toLowerCase()) ||
        s.artist.toLowerCase().includes(addSongSearch.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      {/* Header */}
      <div
        className="px-8 pt-6 pb-4 border-b border-outline-variant/20 shrink-0"
        style={{ background: "hsl(var(--background) / 0.95)", backdropFilter: "blur(12px)" }}
      >
        <Link href="/playlists">
          <a className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-on-surface text-sm font-medium transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" /> Explorar
          </a>
        </Link>

        <div className="flex items-end gap-6">
          {/* Cover */}
          <div
            className="w-32 h-32 rounded-[20px] shrink-0 elevation-2"
            style={getPlaylistCoverStyle(playlist)}
          />

          {/* Info */}
          <div className="flex-1 min-w-0 pb-1">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Playlist</p>
            <h1 className="text-3xl font-bold text-on-surface leading-tight truncate mb-2">
              {playlist.title}
            </h1>
            <p className="text-sm text-on-surface-variant">
              {sorted.length} canciones · {formatTime(totalDuration)}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handlePlay}
                disabled={sorted.length === 0}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm ripple hover:opacity-90 disabled:opacity-40 transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                Reproducir
              </button>
              <button
                onClick={() => { toggleShuffle(); if (sorted.length > 0) handlePlay(); }}
                disabled={sorted.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-surface-container text-on-surface font-semibold text-sm ripple hover:bg-surface-high disabled:opacity-40 transition-all"
              >
                <Shuffle className="w-4 h-4" />
                Aleatorio
              </button>
              <button
                onClick={() => setEditOpen(true)}
                className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-colors"
                title="Editar"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowAddSongs((v) => !v)}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                  showAddSongs
                    ? "bg-primary-container text-on-primary-container"
                    : "bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-high"
                )}
                title="Agregar canciones"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        {/* Playlist songs */}
        <div className="px-6 py-4">
          {sorted.length === 0 && !showAddSongs ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-on-surface-variant">
              <Music2 className="w-12 h-12 opacity-20" />
              <p className="text-base font-medium">Esta playlist está vacía</p>
              <button
                onClick={() => setShowAddSongs(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary-container text-on-primary-container text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Agregar canciones
              </button>
            </div>
          ) : (
            sorted.map((song, i) => {
              const isCurrent = currentSong?.id === song.id;
              return (
                <div
                  key={song.id}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-2.5 rounded-2xl cursor-pointer ripple transition-colors animate-in fade-in",
                    isCurrent ? "bg-secondary-container text-on-secondary-container" : "hover:bg-surface-container"
                  )}
                  style={{ animationDelay: `${Math.min(i * 20, 300)}ms`, animationFillMode: "both" }}
                  onClick={() => play(song)}
                >
                  <span className={cn("text-xs w-5 text-right shrink-0", isCurrent ? "text-on-secondary-container" : "text-on-surface-variant")}>
                    {i + 1}
                  </span>
                  <img src={song.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold truncate", isCurrent ? "text-on-secondary-container" : "text-on-surface")}>
                      {song.title}
                    </p>
                    <p className={cn("text-xs truncate", isCurrent ? "text-on-secondary-container/70" : "text-on-surface-variant")}>
                      {song.artist}
                    </p>
                  </div>
                  <span className="text-xs text-on-surface-variant shrink-0">{formatTime(song.duration)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSongFromPlaylist(playlist.id, song.id); }}
                    className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-error hover:bg-error/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Add Songs Panel */}
        {showAddSongs && (
          <div className="px-6 pb-4 border-t border-outline-variant/20 pt-4">
            <h3 className="text-sm font-bold text-on-surface mb-3 px-4">Agregar canciones</h3>
            <div className="relative flex items-center h-10 bg-surface-high rounded-full px-4 gap-2 mb-3">
              <Search className="w-4 h-4 text-on-surface-variant shrink-0" />
              <input
                type="text"
                placeholder="Buscar..."
                className="flex-1 bg-transparent outline-none text-sm text-on-surface placeholder:text-on-surface-variant"
                value={addSongSearch}
                onChange={(e) => setAddSongSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {availableToAdd.slice(0, 30).map((song) => (
                <div
                  key={song.id}
                  className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-surface-container cursor-pointer group transition-colors"
                  onClick={() => addSongToPlaylist(playlist.id, song.id)}
                >
                  <img src={song.coverUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{song.title}</p>
                    <p className="text-xs text-on-surface-variant truncate">{song.artist}</p>
                  </div>
                  <div className="w-6 h-6 rounded-full border-2 border-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Plus className="w-3 h-3 text-primary" />
                  </div>
                </div>
              ))}
              {availableToAdd.length === 0 && (
                <p className="text-sm text-on-surface-variant text-center py-4">No hay más canciones para agregar</p>
              )}
            </div>
          </div>
        )}
      </div>

      <CreatePlaylistDialog open={editOpen} onClose={() => setEditOpen(false)} editPlaylist={playlist} />
    </div>
  );
}
