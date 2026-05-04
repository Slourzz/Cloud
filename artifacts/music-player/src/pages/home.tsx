import React from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { cn } from "@/lib/utils";
import { Music2, Wifi } from "lucide-react";

export default function Home() {
  const { currentSong, isPlaying, audioQuality } = useMusicPlayer();

  if (!currentSong) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-on-surface-variant">
        <Music2 className="w-16 h-16 opacity-30" />
        <p className="text-lg font-medium">Selecciona una canción para empezar</p>
      </div>
    );
  }

  const qualityColors: Record<string, string> = {
    low: "bg-tertiary-container text-on-tertiary-container",
    normal: "bg-secondary-container text-on-secondary-container",
    high: "bg-primary-container text-on-primary-container",
    lossless: "bg-primary text-primary-foreground",
  };

  const qualityLabels: Record<string, string> = {
    low: "Baja",
    normal: "Normal",
    high: "Alta",
    lossless: "Lossless",
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
      {/* Album art — large, centered */}
      <div
        className={cn(
          "relative rounded-[28px] overflow-hidden elevation-3 transition-all duration-700 mb-8",
          isPlaying ? "scale-100 shadow-2xl" : "scale-95 opacity-90"
        )}
        style={{ width: "min(420px, calc(100vw - 320px))", aspectRatio: "1" }}
      >
        <img
          src={currentSong.coverUrl}
          alt={currentSong.album}
          className="w-full h-full object-cover"
        />
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
        {/* Quality badge */}
        <div className="absolute top-4 right-4">
          <span
            className={cn(
              "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold",
              qualityColors[audioQuality]
            )}
          >
            <Wifi className="w-3 h-3" />
            {qualityLabels[audioQuality]}
          </span>
        </div>
      </div>

      {/* Song info */}
      <div className="text-center max-w-sm w-full">
        <h1 className="text-3xl font-bold text-on-surface tracking-tight mb-1 truncate">
          {currentSong.title}
        </h1>
        <p className="text-lg text-on-surface-variant truncate">
          {currentSong.artist}
        </p>
        <p className="text-sm text-outline mt-1 truncate">
          {currentSong.album}
        </p>
      </div>

      {/* Playback indicator */}
      {isPlaying && (
        <div className="mt-6 flex items-end gap-1 h-6">
          {[0.4, 1, 0.6, 0.9, 0.5].map((h, i) => (
            <div
              key={i}
              className="w-1 rounded-full bg-primary animate-pulse"
              style={{
                height: `${h * 24}px`,
                animationDelay: `${i * 0.15}s`,
                animationDuration: `${0.6 + i * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
