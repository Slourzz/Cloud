import React from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, SkipBack, SkipForward,
  Repeat, Shuffle, Heart, Volume2, VolumeX,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TransportBar() {
  const {
    currentSong, isPlaying, progress, volume,
    isShuffle, isRepeat, likedSongs,
    togglePlayPause, next, prev, seek,
    setVolume, toggleShuffle, toggleRepeat, toggleLike,
  } = useMusicPlayer();

  if (!currentSong) return null;

  const isLiked = likedSongs.has(currentSong.id);

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[min(860px,calc(100vw-2rem))]">
      <div
        className="flex items-center gap-4 px-5 py-3 rounded-full elevation-3 border border-outline-variant/20"
        style={{
          background: "hsl(var(--surface-container) / 0.88)",
          backdropFilter: "blur(20px) saturate(1.6)",
          WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        }}
      >
        {/* Album art + info */}
        <div className="flex items-center gap-3 w-52 shrink-0 min-w-0">
          <img
            src={currentSong.coverUrl}
            alt={currentSong.album}
            className={cn(
              "w-11 h-11 rounded-xl object-cover shrink-0 transition-transform duration-700",
              isPlaying ? "scale-100" : "scale-95 opacity-80"
            )}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-on-surface truncate leading-tight">
              {currentSong.title}
            </p>
            <p className="text-xs text-on-surface-variant truncate leading-tight mt-0.5">
              {currentSong.artist}
            </p>
          </div>
        </div>

        {/* Center: controls + progress */}
        <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          {/* Playback buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleShuffle}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-colors ripple",
                isShuffle
                  ? "text-primary bg-primary-container"
                  : "text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface"
              )}
              title="Aleatorio"
            >
              <Shuffle className="w-[14px] h-[14px]" strokeWidth={2.5} />
            </button>

            <button
              onClick={prev}
              className="w-9 h-9 rounded-full flex items-center justify-center ripple text-on-surface hover:bg-on-surface/8 transition-colors"
              title="Anterior"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={togglePlayPause}
              className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center ripple elevation-1 hover:scale-105 transition-transform mx-1"
              title={isPlaying ? "Pausar" : "Reproducir"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={next}
              className="w-9 h-9 rounded-full flex items-center justify-center ripple text-on-surface hover:bg-on-surface/8 transition-colors"
              title="Siguiente"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={toggleRepeat}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-colors ripple",
                isRepeat
                  ? "text-primary bg-primary-container"
                  : "text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface"
              )}
              title="Repetir"
            >
              <Repeat className="w-[14px] h-[14px]" strokeWidth={2.5} />
            </button>

            <div className="w-px h-5 bg-outline-variant/50 mx-1" />

            <button
              onClick={() => toggleLike(currentSong.id)}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-colors ripple",
                isLiked
                  ? "text-primary bg-primary-container"
                  : "text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface"
              )}
              title="Me gusta"
            >
              <Heart
                className="w-[14px] h-[14px]"
                fill={isLiked ? "currentColor" : "none"}
                strokeWidth={isLiked ? 0 : 2.5}
              />
            </button>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 w-full px-1">
            <span className="text-[10px] tabular-nums text-on-surface-variant w-7 text-right shrink-0">
              {formatTime(progress)}
            </span>
            <Slider
              value={[progress]}
              max={currentSong.duration || 1}
              step={1}
              onValueChange={(v) => seek(v[0])}
              className="flex-1 cursor-pointer"
            />
            <span className="text-[10px] tabular-nums text-on-surface-variant w-7 shrink-0">
              {formatTime(currentSong.duration)}
            </span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 w-32 shrink-0">
          <button
            onClick={() => setVolume(volume === 0 ? 80 : 0)}
            className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
          >
            {volume === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <Slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={(v) => setVolume(v[0])}
            className="flex-1 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
