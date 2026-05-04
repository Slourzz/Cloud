import React, { useRef } from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { cn } from "@/lib/utils";
import { Music2, Upload, Wifi } from "lucide-react";

export default function Home() {
  const { currentSong, isPlaying, audioQuality, addUserSong } = useMusicPlayer();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await addUserSong(file);
    }
  };

  const qualityColors: Record<string, string> = {
    low: "bg-tertiary-container text-on-tertiary-container",
    normal: "bg-secondary-container text-on-secondary-container",
    high: "bg-primary-container text-on-primary-container",
    lossless: "bg-primary text-primary-foreground",
  };
  const qualityLabels: Record<string, string> = {
    low: "Baja", normal: "Normal", high: "Alta", lossless: "Lossless",
  };

  if (!currentSong) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 animate-in fade-in duration-500">
        <div
          className="w-full max-w-sm flex flex-col items-center gap-6"
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          onDragOver={(e) => e.preventDefault()}
        >
          <div
            className="w-24 h-24 rounded-[28px] flex items-center justify-center"
            style={{ background: `rgb(var(--dyn-v) / 0.15)` }}
          >
            <Music2 className="w-10 h-10" style={{ color: `rgb(var(--dyn-v))` }} />
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">
              Tu música, aquí
            </h1>
            <p className="text-sm text-on-surface-variant">
              Sube tus archivos de audio para empezar a escuchar
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2.5 px-6 py-3 rounded-full font-semibold text-white transition-all hover:scale-105 active:scale-95"
            style={{
              background: `rgb(var(--dyn-v))`,
              boxShadow: `0 6px 24px rgb(var(--dyn-v) / 0.4)`,
            }}
          >
            <Upload className="w-4 h-4" />
            Subir archivos
          </button>

          <p className="text-xs text-on-surface-variant text-center">
            MP3 · WAV · FLAC · AAC · OGG · M4A · OPUS
            <br />o arrastra archivos aquí
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
      {/* Album art */}
      <div
        className={cn(
          "relative rounded-[32px] overflow-hidden transition-all duration-700 mb-8",
          isPlaying
            ? "scale-100 shadow-2xl"
            : "scale-95 opacity-85"
        )}
        style={{
          width: "min(400px, calc(100vw - 340px))",
          aspectRatio: "1",
          boxShadow: isPlaying
            ? `0 32px 80px rgb(var(--dyn-d) / 0.55), 0 0 0 1px rgb(var(--dyn-v) / 0.1)`
            : undefined,
        }}
      >
        <img
          src={currentSong.coverUrl}
          alt={currentSong.album}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />

        {/* Quality badge */}
        <div className="absolute top-4 right-4">
          <span
            className={cn(
              "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm",
              qualityColors[audioQuality]
            )}
          >
            <Wifi className="w-3 h-3" />
            {qualityLabels[audioQuality]}
          </span>
        </div>
      </div>

      {/* Song info */}
      <div className="text-center w-full max-w-sm">
        <h1
          className="text-3xl font-bold tracking-tight mb-1 truncate text-on-surface"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {currentSong.title}
        </h1>
        <p className="text-lg text-on-surface-variant truncate">
          {currentSong.artist}
        </p>
        <p className="text-sm text-outline mt-1 truncate">
          {currentSong.album}
        </p>
      </div>

      {/* Playback indicator bars */}
      {isPlaying && (
        <div className="mt-7 flex items-end gap-[3px] h-6">
          {[0.45, 1, 0.65, 0.9, 0.5, 0.75, 0.4].map((h, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full animate-pulse"
              style={{
                height: `${h * 22}px`,
                background: `rgb(var(--dyn-v))`,
                animationDelay: `${i * 0.12}s`,
                animationDuration: `${0.55 + i * 0.09}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
