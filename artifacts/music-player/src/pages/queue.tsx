import React from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { GripVertical, Play, ListVideo } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Queue() {
  const { currentSong, queue, play, isPlaying } = useMusicPlayer();

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const totalDuration = queue.reduce((acc, s) => acc + s.duration, 0);

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-8 pt-8 pb-4 border-b border-outline-variant/20"
        style={{ background: "hsl(var(--background) / 0.9)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-secondary-container flex items-center justify-center">
            <ListVideo className="w-5 h-5 text-on-secondary-container" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Cola de reproducción</h1>
            <p className="text-sm text-on-surface-variant">
              {queue.length} canciones · {formatTime(totalDuration)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 pb-28 space-y-6">
        {/* Now Playing */}
        {currentSong && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-3 px-2">
              Reproduciendo ahora
            </h2>
            <div className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-primary-container text-on-primary-container elevation-1">
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0">
                <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="flex items-end gap-0.5 h-4">
                      {[0.5, 1, 0.65].map((h, i) => (
                        <div
                          key={i}
                          className="w-0.5 bg-white rounded-full animate-pulse"
                          style={{ height: `${h * 14}px`, animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{currentSong.title}</p>
                <p className="text-xs opacity-75 truncate">{currentSong.artist}</p>
              </div>
              <span className="text-xs font-medium opacity-75 shrink-0">
                {formatTime(currentSong.duration)}
              </span>
            </div>
          </section>
        )}

        {/* Up Next */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3 px-2">
            A continuación
          </h2>

          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-on-surface-variant">
              <ListVideo className="w-12 h-12 opacity-20" />
              <p className="text-base font-medium">La cola está vacía</p>
            </div>
          ) : (
            <div className="space-y-1">
              {queue.map((song, i) => (
                <div
                  key={`${song.id}-${i}`}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-2xl cursor-pointer group ripple hover:bg-surface-container transition-colors animate-in fade-in slide-in-from-bottom-1"
                  style={{ animationDelay: `${Math.min(i * 30, 300)}ms`, animationFillMode: "both" }}
                  onClick={() => play(song)}
                >
                  <div className="text-outline-variant hover:text-on-surface cursor-grab transition-colors">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                    <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 text-white fill-current" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{song.title}</p>
                    <p className="text-xs text-on-surface-variant truncate">{song.artist}</p>
                  </div>
                  <span className="text-xs text-on-surface-variant tabular-nums shrink-0">
                    {formatTime(song.duration)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
