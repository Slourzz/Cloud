import React, { useState } from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { Search, Play, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Library() {
  const { allSongs, currentSong, play, isPlaying } = useMusicPlayer();
  const [search, setSearch] = useState("");

  const filtered = allSongs.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase()) ||
      s.album.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 px-8 pt-8 pb-4 border-b border-outline-variant/20"
        style={{ background: "hsl(var(--background) / 0.9)", backdropFilter: "blur(12px)" }}
      >
        <h1 className="text-2xl font-bold text-on-surface mb-4">Biblioteca</h1>
        {/* M3 Search bar */}
        <div className="relative flex items-center h-12 bg-surface-high rounded-full px-4 gap-2 elevation-1 focus-within:elevation-2 transition-all max-w-lg">
          <Search className="w-4 h-4 text-on-surface-variant shrink-0" />
          <input
            type="text"
            placeholder="Buscar canciones, artistas, álbumes..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-on-surface placeholder:text-on-surface-variant"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <p className="text-xs text-on-surface-variant mt-2 ml-1">
          {filtered.length} {filtered.length === 1 ? "canción" : "canciones"}
        </p>
      </div>

      {/* Table header */}
      <div className="px-8 py-3 grid grid-cols-[2rem_1fr_1fr_6rem_3rem] gap-4 border-b border-outline-variant/10 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
        <span className="text-center">#</span>
        <span>Título</span>
        <span>Álbum</span>
        <span className="text-right">Duración</span>
        <span />
      </div>

      {/* Songs list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 pb-28">
        {filtered.map((song, i) => {
          const isCurrent = currentSong?.id === song.id;
          return (
            <div
              key={song.id}
              onDoubleClick={() => play(song)}
              onClick={() => play(song)}
              className={cn(
                "grid grid-cols-[2rem_1fr_1fr_6rem_3rem] gap-4 items-center px-4 py-2.5 rounded-xl cursor-pointer ripple group transition-colors animate-in fade-in",
                isCurrent
                  ? "bg-secondary-container text-on-secondary-container"
                  : "hover:bg-surface-container"
              )}
              style={{ animationDelay: `${Math.min(i * 20, 400)}ms`, animationFillMode: "both" }}
            >
              {/* Index / playing indicator */}
              <div className="flex items-center justify-center">
                {isCurrent && isPlaying ? (
                  <div className="flex items-end gap-0.5 h-4">
                    {[0.5, 1, 0.6].map((h, j) => (
                      <div
                        key={j}
                        className="w-0.5 bg-primary rounded-full animate-pulse"
                        style={{ height: `${h * 14}px`, animationDelay: `${j * 0.15}s` }}
                      />
                    ))}
                  </div>
                ) : (
                  <span className={cn(
                    "text-xs font-medium group-hover:hidden",
                    isCurrent ? "text-on-secondary-container" : "text-on-surface-variant"
                  )}>
                    {i + 1}
                  </span>
                )}
                {!isCurrent && (
                  <Play className="w-3.5 h-3.5 fill-current text-on-surface hidden group-hover:block" />
                )}
              </div>

              {/* Title + Artist + Thumbnail */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className={cn(
                    "text-sm font-semibold truncate leading-tight",
                    isCurrent ? "text-on-secondary-container" : "text-on-surface"
                  )}>
                    {song.title}
                  </p>
                  <p className={cn(
                    "text-xs truncate leading-tight mt-0.5",
                    isCurrent ? "text-on-secondary-container/70" : "text-on-surface-variant"
                  )}>
                    {song.artist}
                    {song.isUserUploaded && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-primary-container text-on-primary-container font-bold">
                        SUBIDO
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Album */}
              <p className={cn(
                "text-sm truncate",
                isCurrent ? "text-on-secondary-container/80" : "text-on-surface-variant"
              )}>
                {song.album}
              </p>

              {/* Duration */}
              <span className={cn(
                "text-sm text-right tabular-nums",
                isCurrent ? "text-on-secondary-container/80" : "text-on-surface-variant"
              )}>
                {formatTime(song.duration)}
              </span>

              {/* More */}
              <button
                className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-on-surface/10 transition-all text-on-surface-variant"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-on-surface-variant">
            <Search className="w-12 h-12 opacity-20" />
            <p className="text-base font-medium">Sin resultados para "{search}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
