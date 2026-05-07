import React, { useEffect, useRef, useState } from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { useLyrics } from "@/hooks/use-lyrics";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { LyricsDisplay } from "@/components/lyrics-display";
import { Slider } from "@/components/ui/slider";
import {
  Play, Pause, SkipBack, SkipForward,
  Repeat, Shuffle, Heart, Volume2, ChevronDown,
  Upload, FileText, Globe, Loader2, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FullscreenPlayerProps {
  open: boolean;
  onClose: () => void;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function FsIconBtn({
  onClick, active, disabled, title, children, className, style,
}: {
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "icon-btn text-white disabled:opacity-40 ripple",
        active ? "bg-white/18" : "hover:bg-white/12",
        className
      )}
      style={style}
    >
      {children}
    </button>
  );
}

export function FullscreenPlayer({ open, onClose }: FullscreenPlayerProps) {
  const {
    currentSong, isPlaying, progress, volume, isShuffle, isRepeat, likedSongs,
    togglePlayPause, next, prev, seek, setVolume, toggleShuffle, toggleRepeat, toggleLike,
  } = useMusicPlayer();
  const { getLyrics, loadTTML, loadPlainText, fetchAutoLyrics } = useLyrics();
  const { fullscreenBg, rgb } = useThemeColors();

  const [visible, setVisible] = useState(false);
  const [showLyricsPanel, setShowLyricsPanel] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const ttmlInputRef = useRef<HTMLInputElement>(null);
  const plainInputRef = useRef<HTMLInputElement>(null);

  const songId = currentSong?.id ?? "";
  const lyricsState = getLyrics(songId);

  useEffect(() => {
    if (open) {
      setVisible(true);
    } else {
      const t = setTimeout(() => setVisible(false), 450);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (open && currentSong?.isUserUploaded && songId) {
      fetchAutoLyrics(songId, currentSong.artist, currentSong.title);
    }
  }, [open, songId, currentSong?.isUserUploaded]);

  const handleTTMLFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !songId) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) loadTTML(songId, content);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePlainFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !songId) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) loadPlainText(songId, content);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleAutoFetch = () => {
    if (!currentSong || !songId) return;
    fetchAutoLyrics(songId, currentSong.artist, currentSong.title);
  };

  const handleGenerateWithAI = async () => {
    if (!currentSong || !songId) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/ttml/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: currentSong.title,
          artist: currentSong.artist,
          duration: currentSong.duration,
        }),
      });
      const data = await res.json().catch(() => ({})) as { ttml?: string; error?: string };
      if (!res.ok || data.error === "lyrics_not_found") throw new Error("lyrics_not_found");
      if (!data.ttml) throw new Error("server_error");
      loadTTML(songId, data.ttml);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al generar";
      setGenerateError(msg.includes("404") || msg.includes("lyrics_not_found")
        ? "No encontré las letras de esta canción"
        : "Error al conectar con el servidor");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!visible) return null;
  const isLiked = likedSongs.has(songId);
  const hasLyrics = lyricsState.lines.length > 0;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex flex-col",
        "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-[0.99] pointer-events-none"
      )}
      style={fullscreenBg()}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 pt-6 pb-4 shrink-0">
        <FsIconBtn
          onClick={onClose}
          title="Cerrar"
          className="w-10 h-10"
        >
          <ChevronDown className="w-5 h-5" />
        </FsIconBtn>

        <div className="text-center select-none">
          <p className="text-white/55 text-xs font-bold uppercase tracking-widest">Reproduciendo</p>
          {currentSong && (
            <p className="text-white/80 text-sm font-semibold truncate max-w-sm mt-0.5">
              {currentSong.album}
            </p>
          )}
        </div>

        <FsIconBtn
          onClick={() => setShowLyricsPanel((v) => !v)}
          title="Letras"
          active={showLyricsPanel}
          className="w-10 h-10"
          style={{ color: showLyricsPanel ? rgb("v") : "rgba(255,255,255,0.6)" }}
        >
          <FileText className="w-4 h-4" />
        </FsIconBtn>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: album art + info + controls */}
        <div
          className={cn(
            "flex flex-col items-center justify-center p-8",
            "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            showLyricsPanel ? "w-1/2" : "w-full"
          )}
        >
          {/* Album art */}
          <div
            key={currentSong?.id}
            className={cn(
              "rounded-[28px] overflow-hidden mb-8 fade-scale-in",
            )}
            style={{
              width: showLyricsPanel ? "min(300px, 40vw)" : "min(420px, 50vw)",
              aspectRatio: "1",
              boxShadow: isPlaying
                ? `0 32px 90px rgb(var(--dyn-d) / 0.75), 0 0 0 1px rgba(255,255,255,0.07)`
                : `0 20px 60px rgb(var(--dyn-d) / 0.55), 0 0 0 1px rgba(255,255,255,0.05)`,
              transform: isPlaying ? "scale(1)" : "scale(0.94)",
              transition: "transform 700ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 700ms ease, width 500ms cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <img
              src={currentSong?.coverUrl ?? "/album1.png"}
              alt={currentSong?.album}
              className="w-full h-full object-cover"
              style={{
                transform: isPlaying ? "scale(1.03)" : "scale(1)",
                transition: "transform 700ms cubic-bezier(0.34,1.56,0.64,1)",
              }}
            />
          </div>

          {/* Song info */}
          <div
            key={currentSong?.id + "-fs-info"}
            className="text-center mb-8 w-full max-w-sm stagger-item select-none"
          >
            <h1 className="text-3xl font-bold text-white leading-tight mb-2 truncate">
              {currentSong?.title ?? "—"}
            </h1>
            <p className="text-white/65 text-lg truncate stagger-item" style={{ animationDelay: "50ms" }}>
              {currentSong?.artist}
            </p>
          </div>

          {/* Playback controls */}
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <div className="flex items-center gap-3">
              <FsIconBtn onClick={toggleShuffle} active={isShuffle} className="w-9 h-9">
                <Shuffle className="w-4 h-4" />
              </FsIconBtn>

              <FsIconBtn onClick={prev} className="w-11 h-11">
                <SkipBack className="w-6 h-6 fill-current" />
              </FsIconBtn>

              <button
                onClick={togglePlayPause}
                className={cn("icon-btn w-16 h-16 text-white", isPlaying && "play-pulse")}
                style={{
                  background: rgb("v", 0.9),
                  boxShadow: isPlaying
                    ? `0 8px 30px ${rgb("v", 0.5)}`
                    : `0 4px 16px ${rgb("v", 0.3)}`,
                }}
              >
                <span
                  className="flex items-center justify-center"
                  style={{
                    transition: "transform 200ms cubic-bezier(0.34,1.56,0.64,1)",
                    transform: isPlaying ? "scale(1)" : "scale(1.08)",
                  }}
                >
                  {isPlaying
                    ? <Pause className="w-7 h-7 fill-current" />
                    : <Play className="w-7 h-7 fill-current ml-1" />}
                </span>
              </button>

              <FsIconBtn onClick={next} className="w-11 h-11">
                <SkipForward className="w-6 h-6 fill-current" />
              </FsIconBtn>

              <FsIconBtn onClick={toggleRepeat} active={isRepeat} className="w-9 h-9">
                <Repeat className="w-4 h-4" />
              </FsIconBtn>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-3 w-full">
              <span className="text-white/55 text-xs tabular-nums w-8 text-right select-none">
                {formatTime(progress)}
              </span>
              <Slider
                value={[progress]}
                max={currentSong?.duration || 1}
                step={1}
                onValueChange={(v) => seek(v[0])}
                className="flex-1 [--slider-thumb:white] [--slider-track:rgba(255,255,255,0.2)] [--slider-range:white]"
              />
              <span className="text-white/55 text-xs tabular-nums w-8 select-none">
                {formatTime(currentSong?.duration ?? 0)}
              </span>
            </div>

            {/* Volume + Like */}
            <div className="flex items-center gap-3 w-full">
              <Volume2 className="w-4 h-4 text-white/50 shrink-0" />
              <Slider
                value={[volume]}
                max={100}
                step={1}
                onValueChange={(v) => setVolume(v[0])}
                className="flex-1"
              />
              <FsIconBtn
                onClick={() => toggleLike(songId)}
                active={isLiked}
                className="w-9 h-9 ml-2"
                style={{ color: isLiked ? rgb("v") : "rgba(255,255,255,0.55)" }}
              >
                <Heart
                  className="w-4 h-4"
                  fill={isLiked ? "currentColor" : "none"}
                  style={{
                    transform: isLiked ? "scale(1.18)" : "scale(1)",
                    transition: "transform 200ms cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                />
              </FsIconBtn>
            </div>
          </div>
        </div>

        {/* Right: Lyrics panel */}
        <div
          className={cn(
            "flex flex-col border-l border-white/8 overflow-hidden",
            "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            showLyricsPanel ? "w-1/2 opacity-100" : "w-0 opacity-0 pointer-events-none"
          )}
        >
          <div className="flex items-center justify-between px-8 pt-6 pb-4 shrink-0">
            <h2 className="text-white/80 font-bold text-lg select-none">Letras</h2>
            <div className="flex items-center gap-1.5">
              {lyricsState.source && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/10 text-white/55 select-none">
                  {lyricsState.source === "ttml" ? "TTML" : lyricsState.source === "auto" ? "Auto" : lyricsState.source === "ai" ? "IA" : "Texto"}
                </span>
              )}
              {/* AI generate */}
              <FsIconBtn
                onClick={handleGenerateWithAI}
                disabled={isGenerating || !currentSong}
                title="Generar letras con IA"
                className="w-8 h-8"
                style={{
                  background: isGenerating ? "rgba(255,255,255,0.05)" : `rgb(var(--dyn-v) / 0.22)`,
                  color: `rgb(var(--dyn-v))`,
                }}
              >
                {isGenerating
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Sparkles className="w-3.5 h-3.5" />}
              </FsIconBtn>
              <FsIconBtn onClick={() => ttmlInputRef.current?.click()} title="Subir TTML" className="w-8 h-8">
                <Upload className="w-3.5 h-3.5" />
              </FsIconBtn>
              <FsIconBtn onClick={() => plainInputRef.current?.click()} title="Subir texto" className="w-8 h-8">
                <FileText className="w-3.5 h-3.5" />
              </FsIconBtn>
            </div>
          </div>

          <input ref={ttmlInputRef} type="file" accept=".ttml,.xml,text/xml,application/xml" className="hidden" onChange={handleTTMLFile} />
          <input ref={plainInputRef} type="file" accept=".txt,text/plain" className="hidden" onChange={handlePlainFile} />

          <div className="flex-1 min-h-0 relative">
            {isGenerating ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-white/60 fade-scale-in">
                <div className="relative">
                  <Sparkles
                    className="w-10 h-10"
                    style={{
                      color: `rgb(var(--dyn-v))`,
                      animation: "play-pulse 1.4s ease infinite",
                    }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white/80">Generando letras con IA...</p>
                  <p className="text-xs text-white/40 mt-1">Esto puede tomar unos segundos</p>
                </div>
              </div>
            ) : lyricsState.isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-white/60 fade-scale-in">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">Buscando letras...</p>
              </div>
            ) : hasLyrics ? (
              <LyricsDisplay
                lines={lyricsState.lines}
                currentTime={progress}
                source={lyricsState.source}
                isPaused={!isPlaying}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center fade-scale-in">
                <FileText className="w-12 h-12 text-white/18" />
                <div>
                  <p className="text-white/70 font-semibold text-base mb-1">Sin letras</p>
                  <p className="text-white/38 text-sm">
                    {generateError ?? lyricsState.error ?? "Sube un archivo TTML o genera con IA"}
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <button
                    onClick={handleGenerateWithAI}
                    disabled={isGenerating || !currentSong}
                    className="icon-btn flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white text-sm font-semibold disabled:opacity-40 w-full justify-center"
                    style={{
                      background: `rgb(var(--dyn-v) / 0.8)`,
                      boxShadow: `0 4px 20px rgb(var(--dyn-v) / 0.3)`,
                    }}
                  >
                    <Sparkles className="w-4 h-4" />
                    Generar con IA
                  </button>
                  <button
                    onClick={() => ttmlInputRef.current?.click()}
                    className="icon-btn flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 text-white/70 text-sm font-semibold w-full justify-center"
                  >
                    <Upload className="w-4 h-4" />
                    Subir TTML (sincronizado)
                  </button>
                  <button
                    onClick={() => plainInputRef.current?.click()}
                    className="icon-btn flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 text-white/70 text-sm font-semibold w-full justify-center"
                  >
                    <FileText className="w-4 h-4" />
                    Subir texto plano
                  </button>
                  <button
                    onClick={handleAutoFetch}
                    className="icon-btn flex items-center gap-2 px-4 py-2.5 rounded-2xl text-white text-sm font-semibold w-full justify-center"
                    style={{ background: rgb("v", 0.28) }}
                  >
                    <Globe className="w-4 h-4" />
                    Buscar en internet
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
