import React from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { Heart, Play, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Liked() {
  const { allSongs, likedSongs, currentSong, isPlaying, play } = useMusicPlayer();
  const liked = allSongs.filter((s) => likedSongs.has(s.id));

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-md px-8 pt-8 pb-4 border-b border-outline-variant/20"
        style={{ background: "hsl(var(--background) / 0.9)" }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-primary-container flex items-center justify-center">
            <Heart className="w-5 h-5 text-on-primary-container fill-current" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Me gusta</h1>
            <p className="text-sm text-on-surface-variant">{liked.length} canciones</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {liked.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-on-surface-variant">
            <Heart className="w-16 h-16 opacity-20" />
            <p className="text-lg font-medium">Aún no hay canciones</p>
            <p className="text-sm opacity-70">Marca canciones con Me gusta desde la barra de reproducción</p>
          </div>
        ) : (
          <div className="space-y-1">
            {liked.map((song, i) => {
              const isCurrent = currentSong?.id === song.id;
              return (
                <div
                  key={song.id}
                  onClick={() => play(song)}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 rounded-2xl cursor-pointer ripple group transition-colors animate-in fade-in slide-in-from-bottom-1",
                    isCurrent
                      ? "bg-primary-container text-on-primary-container"
                      : "hover:bg-surface-container"
                  )}
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
                >
                  <span className="text-sm font-medium text-on-surface-variant w-5 text-right shrink-0">
                    {i + 1}
                  </span>
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                    <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                    {isCurrent && isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="flex items-end gap-0.5 h-4">
                          {[0.4, 1, 0.6].map((h, j) => (
                            <div
                              key={j}
                              className="w-1 bg-white rounded-full animate-pulse"
                              style={{ height: `${h * 14}px`, animationDelay: `${j * 0.15}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {!isCurrent && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-5 h-5 text-white fill-current" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-semibold truncate", isCurrent ? "text-on-primary-container" : "text-on-surface")}>
                      {song.title}
                    </p>
                    <p className={cn("text-xs truncate", isCurrent ? "text-on-primary-container/70" : "text-on-surface-variant")}>
                      {song.artist} · {song.album}
                    </p>
                  </div>
                  <Heart className={cn("w-4 h-4 shrink-0", isCurrent ? "text-on-primary-container fill-current" : "text-primary fill-current")} />
                  <span className="text-xs text-on-surface-variant shrink-0 ml-2">
                    {formatTime(song.duration)}
                  </span>
                  <button
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-on-surface/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4 text-on-surface-variant" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
