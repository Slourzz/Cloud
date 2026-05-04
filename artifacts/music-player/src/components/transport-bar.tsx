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

  const iconBtn = (active: boolean) => ({
    background: active ? `rgb(var(--dyn-v) / 0.18)` : "transparent",
    color: active ? `rgb(var(--dyn-v))` : "hsl(var(--on-surface-variant))",
  } as React.CSSProperties);

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[min(1040px,calc(100vw-2rem))]">
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-[28px] elevation-3 border border-outline-variant/15"
        style={{
          background: "hsl(var(--surface-container) / 0.92)",
          backdropFilter: "blur(28px) saturate(1.9)",
          WebkitBackdropFilter: "blur(28px) saturate(1.9)",
        }}
      >
        {/* ── Album art + info ── */}
        <div className="flex items-center gap-3 w-48 shrink-0 min-w-0">
          <img
            src={currentSong.coverUrl}
            alt={currentSong.album}
            className={cn(
              "w-11 h-11 rounded-2xl object-cover shrink-0 transition-all duration-700",
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

        {/* ── Center: controls + progress ── */}
        <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
          <div className="flex items-center gap-1">
            <button
              onClick={toggleShuffle}
              title="Aleatorio"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all ripple"
              style={iconBtn(isShuffle)}
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
              className="w-11 h-11 rounded-full flex items-center justify-center ripple text-white hover:scale-105 active:scale-95 transition-transform mx-1"
              title={isPlaying ? "Pausar" : "Reproducir"}
              style={{
                background: `rgb(var(--dyn-v))`,
                boxShadow: `0 4px 18px rgb(var(--dyn-v) / 0.5)`,
              }}
            >
              {isPlaying
                ? <Pause className="w-5 h-5 fill-current" />
                : <Play className="w-5 h-5 fill-current ml-0.5" />}
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
              title="Repetir"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all ripple"
              style={iconBtn(isRepeat)}
            >
              <Repeat className="w-[14px] h-[14px]" strokeWidth={2.5} />
            </button>

            <div className="w-px h-4 bg-outline-variant/40 mx-1" />

            <button
              onClick={() => toggleLike(currentSong.id)}
              title="Me gusta"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all ripple"
              style={iconBtn(isLiked)}
            >
              <Heart
                className="w-[14px] h-[14px]"
                fill={isLiked ? "currentColor" : "none"}
                strokeWidth={isLiked ? 0 : 2.5}
              />
            </button>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 w-full px-1">
            <span className="text-[10px] tabular-nums text-on-surface-variant w-7 text-right shrink-0">
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
            className="text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
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
        <div className="w-px h-7 bg-outline-variant/30 mx-0.5 shrink-0" />

        {/* ── Queue + Fullscreen ── */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setLocation(queueActive ? "/" : "/queue")}
            title="Cola de reproducción"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all ripple"
            style={iconBtn(queueActive)}
          >
            <ListVideo className="w-[16px] h-[16px]" />
          </button>

          <button
            onClick={onFullscreen}
            title="Pantalla completa"
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all ripple hover:scale-110 active:scale-95 text-white"
            style={{
              background: `linear-gradient(135deg, rgb(var(--dyn-v) / 0.9), rgb(var(--dyn-m) / 0.85))`,
              boxShadow: `0 3px 12px rgb(var(--dyn-v) / 0.4)`,
            }}
          >
            <Maximize2 className="w-[14px] h-[14px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
