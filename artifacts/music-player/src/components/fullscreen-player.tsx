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
      const t = setTimeout(() => setVisible(false), 400);
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
      if (!res.ok || data.error === "lyrics_not_found") {
        throw new Error("lyrics_not_found");
      }
      if (!res.ok || !data.ttml) throw new Error("server_error");
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
        "fixed inset-0 z-50 flex flex-col transition-all duration-500",
        open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6 pointer-events-none"
      )}
      style={fullscreenBg()}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 pt-6 pb-4 shrink-0">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Reproduciendo</p>
          {currentSong && (
            <p className="text-white/80 text-sm font-semibold truncate max-w-sm mt-0.5">
              {currentSong.album}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowLyricsPanel((v) => !v)}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          style={{ color: showLyricsPanel ? rgb("v") : "rgba(255,255,255,0.6)" }}
          title="Letras"
        >
          <FileText className="w-4 h-4" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: album art + info + controls */}
        <div
          className={cn(
            "flex flex-col items-center justify-center p-8 transition-all duration-500",
            showLyricsPanel ? "w-1/2" : "w-full"
          )}
        >
          {/* Album art */}
          <div
            className={cn(
              "rounded-[28px] overflow-hidden transition-all duration-700 mb-8",
              isPlaying ? "scale-100" : "scale-95"
            )}
            style={{
              width: showLyricsPanel ? "min(300px, 40vw)" : "min(420px, 50vw)",
              aspectRatio: "1",
              boxShadow: `0 30px 80px rgb(var(--dyn-d) / 0.7), 0 0 0 1px rgba(255,255,255,0.08)`,
            }}
          >
            <img
              src={currentSong?.coverUrl ?? "/album1.png"}
              alt={currentSong?.album}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Song info */}
          <div className="text-center mb-8 w-full max-w-sm">
            <h1 className="text-3xl font-bold text-white leading-tight mb-2 truncate">
              {currentSong?.title ?? "—"}
            </h1>
            <p className="text-white/70 text-lg truncate">{currentSong?.artist}</p>
          </div>

          {/* Playback controls */}
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleShuffle}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                  isShuffle ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80 hover:bg-white/10"
                )}
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button onClick={prev} className="w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all">
                <SkipBack className="w-6 h-6 fill-current" />
              </button>
              <button
                onClick={togglePlayPause}
                className="w-16 h-16 rounded-full flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95"
                style={{ background: rgb("v", 0.9), boxShadow: `0 8px 30px ${rgb("v", 0.4)}` }}
              >
                {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
              </button>
              <button onClick={next} className="w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all">
                <SkipForward className="w-6 h-6 fill-current" />
              </button>
              <button
                onClick={toggleRepeat}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                  isRepeat ? "bg-white/20 text-white" : "text-white/50 hover:text-white/80 hover:bg-white/10"
                )}
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-3 w-full">
              <span className="text-white/60 text-xs tabular-nums w-8 text-right">{formatTime(progress)}</span>
              <Slider
                value={[progress]}
                max={currentSong?.duration || 1}
                step={1}
                onValueChange={(v) => seek(v[0])}
                className="flex-1 [--slider-thumb:white] [--slider-track:rgba(255,255,255,0.2)] [--slider-range:white]"
              />
              <span className="text-white/60 text-xs tabular-nums w-8">{formatTime(currentSong?.duration ?? 0)}</span>
            </div>

            {/* Volume + Like */}
            <div className="flex items-center gap-3 w-full">
              <Volume2 className="w-4 h-4 text-white/60 shrink-0" />
              <Slider
                value={[volume]}
                max={100}
                step={1}
                onValueChange={(v) => setVolume(v[0])}
                className="flex-1"
              />
              <button
                onClick={() => toggleLike(songId)}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-all ml-2",
                  isLiked ? "text-white bg-white/20" : "text-white/50 hover:text-white/80 hover:bg-white/10"
                )}
              >
                <Heart className="w-4 h-4" fill={isLiked ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Lyrics panel */}
        {showLyricsPanel && (
          <div className="w-1/2 flex flex-col border-l border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-8 pt-6 pb-4 shrink-0">
              <h2 className="text-white/80 font-bold text-lg">Letras</h2>
              <div className="flex items-center gap-2">
                {lyricsState.source && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/10 text-white/60">
                    {lyricsState.source === "ttml" ? "TTML" : lyricsState.source === "auto" ? "Auto" : lyricsState.source === "ai" ? "IA" : "Texto"}
                  </span>
                )}
                {/* AI generate button */}
                <button
                  onClick={handleGenerateWithAI}
                  disabled={isGenerating || !currentSong}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-40"
                  style={{
                    background: isGenerating ? "rgba(255,255,255,0.05)" : `rgb(var(--dyn-v) / 0.25)`,
                    color: `rgb(var(--dyn-v))`,
                  }}
                  title="Generar letras con IA"
                >
                  {isGenerating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                </button>
                {/* Upload buttons */}
                <button
                  onClick={() => ttmlInputRef.current?.click()}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                  title="Subir TTML"
                >
                  <Upload className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => plainInputRef.current?.click()}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                  title="Subir texto"
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <input ref={ttmlInputRef} type="file" accept=".ttml,.xml,text/xml,application/xml" className="hidden" onChange={handleTTMLFile} />
            <input ref={plainInputRef} type="file" accept=".txt,text/plain" className="hidden" onChange={handlePlainFile} />

            {/* Lyrics content */}
            <div className="flex-1 min-h-0 relative">
              {isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-white/60">
                  <div className="relative">
                    <Sparkles className="w-10 h-10 animate-pulse" style={{ color: `rgb(var(--dyn-v))` }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white/80">Generando letras con IA...</p>
                    <p className="text-xs text-white/40 mt-1">Esto puede tomar unos segundos</p>
                  </div>
                </div>
              ) : lyricsState.isLoading ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-white/60">
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
                <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
                  <FileText className="w-12 h-12 text-white/20" />
                  <div>
                    <p className="text-white/70 font-semibold text-base mb-1">Sin letras</p>
                    <p className="text-white/40 text-sm">
                      {generateError ?? lyricsState.error ?? "Sube un archivo TTML o genera con IA"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    {/* AI generate — primary CTA */}
                    <button
                      onClick={handleGenerateWithAI}
                      disabled={isGenerating || !currentSong}
                      className="flex items-center gap-2 justify-center px-4 py-2.5 rounded-2xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                      style={{ background: `rgb(var(--dyn-v) / 0.8)`, boxShadow: `0 4px 20px rgb(var(--dyn-v) / 0.3)` }}
                    >
                      <Sparkles className="w-4 h-4" />
                      Generar con IA
                    </button>
                    <button
                      onClick={() => ttmlInputRef.current?.click()}
                      className="flex items-center gap-2 justify-center px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm font-semibold transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      Subir TTML (sincronizado)
                    </button>
                    <button
                      onClick={() => plainInputRef.current?.click()}
                      className="flex items-center gap-2 justify-center px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-sm font-semibold transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Subir texto plano
                    </button>
                    <button
                      onClick={handleAutoFetch}
                      className="flex items-center gap-2 justify-center px-4 py-2.5 rounded-2xl transition-colors text-sm font-semibold text-white hover:opacity-80"
                      style={{ background: rgb("v", 0.3) }}
                    >
                      <Globe className="w-4 h-4" />
                      Buscar en internet
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
