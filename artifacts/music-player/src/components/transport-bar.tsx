import React from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, SkipBack, SkipForward,
  Repeat, Shuffle, Heart, Volume2, VolumeX,
  ListVideo, Maximize2,
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface TransportBarProps {
  onFullscreen?: () => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TransportBar({ onFullscreen }: TransportBarProps) {
  const {
    currentSong, isPlaying, progress, volume,
    isShuffle, isRepeat, likedSongs,
    togglePlayPause, next, prev, seek,
    setVolume, toggleShuffle, toggleRepeat, toggleLike,
  } = useMusicPlayer();

  const [location, setLocation] = useLocation();
  const queueActive = location === "/queue";

  if (!currentSong) return null;
  const isLiked = likedSongs.has(currentSong.id);

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[min(1040px,calc(100vw-2rem))] slide-up">
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-[28px] elevation-3 border border-outline-variant/12"
        style={{
          background: "hsl(var(--surface-container) / 0.88)",
          backdropFilter: "blur(32px) saturate(2)",
          WebkitBackdropFilter: "blur(32px) saturate(2)",
        }}
      >
        {/* ── Album art + info ── */}
        <div className="flex items-center gap-3 w-48 shrink-0 min-w-0">
          <div className="relative shrink-0">
            <img
              src={currentSong.coverUrl}
              alt={currentSong.album}
              className={cn(
                "w-11 h-11 rounded-2xl object-cover transition-all duration-700",
                isPlaying ? "scale-100 opacity-100" : "scale-[0.92] opacity-75"
              )}
              style={{
                boxShadow: isPlaying
                  ? `0 4px 16px rgb(var(--dyn-v) / 0.35)`
                  : "none",
                transition: "transform 600ms cubic-bezier(0.34,1.56,0.64,1), opacity 400ms ease, box-shadow 600ms ease",
              }}
            />
            {/* Playing dot */}
            {isPlaying && (
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                style={{
                  background: `rgb(var(--dyn-v))`,
                  borderColor: "hsl(var(--surface-container))",
                  animation: "play-pulse 2s ease infinite",
                }}
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-on-surface truncate leading-tight">
              {currentSong.title}
            </p>
            <p className="text-xs text-on-surface-variant truncate leading-tight mt-0.5">
              {currentSong.artist}
            </p>
          </div>
        </div>

        {/* ── Center: controls + progress ── */}
        <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          <div className="flex items-center gap-1">
            {/* Shuffle */}
            <button
              onClick={toggleShuffle}
              title="Aleatorio"
              className={cn("icon-btn w-8 h-8 ripple", isShuffle ? "" : "text-on-surface-variant hover:text-on-surface")}
              style={isShuffle ? {
                background: `rgb(var(--dyn-v) / 0.15)`,
                color: `rgb(var(--dyn-v))`,
              } : {}}
            >
              <Shuffle className="w-[14px] h-[14px]" strokeWidth={2.5} />
            </button>

            {/* Prev */}
            <button
              onClick={prev}
              className="icon-btn w-9 h-9 ripple text-on-surface hover:bg-on-surface/8 hover:text-on-surface"
              title="Anterior"
            >
              <SkipBack className="w-[18px] h-[18px] fill-current" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              title={isPlaying ? "Pausar" : "Reproducir"}
              className={cn(
                "icon-btn w-11 h-11 text-white mx-1",
                isPlaying && "play-pulse"
              )}
              style={{
                background: `rgb(var(--dyn-v))`,
                boxShadow: isPlaying
                  ? `0 4px 18px rgb(var(--dyn-v) / 0.55)`
                  : `0 2px 10px rgb(var(--dyn-v) / 0.35)`,
              }}
            >
              <span
                className="flex items-center justify-center transition-all duration-200"
                style={{ transform: isPlaying ? "scale(1)" : "scale(1.05)" }}
              >
                {isPlaying
                  ? <Pause className="w-5 h-5 fill-current" />
                  : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </span>
            </button>

            {/* Next */}
            <button
              onClick={next}
              className="icon-btn w-9 h-9 ripple text-on-surface hover:bg-on-surface/8"
              title="Siguiente"
            >
              <SkipForward className="w-[18px] h-[18px] fill-current" />
            </button>

            {/* Repeat */}
            <button
              onClick={toggleRepeat}
              title="Repetir"
              className={cn("icon-btn w-8 h-8 ripple", isRepeat ? "" : "text-on-surface-variant hover:text-on-surface")}
              style={isRepeat ? {
                background: `rgb(var(--dyn-v) / 0.15)`,
                color: `rgb(var(--dyn-v))`,
              } : {}}
            >
              <Repeat className="w-[14px] h-[14px]" strokeWidth={2.5} />
            </button>

            <div className="w-px h-4 bg-outline-variant/35 mx-1" />

            {/* Like */}
            <button
              onClick={() => toggleLike(currentSong.id)}
              title="Me gusta"
              className={cn("icon-btn w-8 h-8 ripple", isLiked ? "" : "text-on-surface-variant hover:text-on-surface")}
              style={isLiked ? {
                background: `rgb(var(--dyn-v) / 0.15)`,
                color: `rgb(var(--dyn-v))`,
              } : {}}
            >
              <Heart
                className="w-[14px] h-[14px] transition-all duration-200"
                fill={isLiked ? "currentColor" : "none"}
                strokeWidth={isLiked ? 0 : 2.5}
                style={{ transform: isLiked ? "scale(1.15)" : "scale(1)" }}
              />
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 w-full px-1">
            <span className="text-[10px] tabular-nums text-on-surface-variant w-7 text-right shrink-0 transition-all duration-200">
              {formatTime(progress)}
            </span>
            <Slider
              value={[progress]}
              max={currentSong.duration || 1}
              step={1}
              onValueChange={(v) => seek(v[0])}
              className="flex-1 cursor-pointer dynamic-slider"
            />
            <span className="text-[10px] tabular-nums text-on-surface-variant w-7 shrink-0">
              {formatTime(currentSong.duration)}
            </span>
          </div>
        </div>

        {/* ── Volume ── */}
        <div className="flex items-center gap-1.5 w-28 shrink-0">
          <button
            onClick={() => setVolume(volume === 0 ? 80 : 0)}
            className="icon-btn text-on-surface-variant hover:text-on-surface shrink-0"
          >
            {volume === 0
              ? <VolumeX className="w-4 h-4" />
              : <Volume2 className="w-4 h-4" />}
          </button>
          <Slider
            value={[volume]}
            max={100}
            step={1}
            onValueChange={(v) => setVolume(v[0])}
            className="flex-1 cursor-pointer dynamic-slider"
          />
        </div>

        {/* ── Separator ── */}
        <div className="w-px h-7 bg-outline-variant/25 mx-0.5 shrink-0" />

        {/* ── Queue + Fullscreen ── */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setLocation(queueActive ? "/" : "/queue")}
            title="Cola de reproducción"
            className={cn("icon-btn w-9 h-9 ripple", queueActive ? "" : "text-on-surface-variant hover:text-on-surface")}
            style={queueActive ? {
              background: `rgb(var(--dyn-v) / 0.15)`,
              color: `rgb(var(--dyn-v))`,
            } : {}}
          >
            <ListVideo className="w-[16px] h-[16px]" />
          </button>

          <button
            onClick={onFullscreen}
            title="Pantalla completa"
            className="icon-btn w-9 h-9 text-white"
            style={{
              background: `linear-gradient(135deg, rgb(var(--dyn-v) / 0.9), rgb(var(--dyn-m) / 0.85))`,
              boxShadow: `0 3px 14px rgb(var(--dyn-v) / 0.45)`,
            }}
          >
            <Maximize2 className="w-[14px] h-[14px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
