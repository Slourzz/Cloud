import React, { useRef, useState } from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { cn } from "@/lib/utils";
import { Music2, Upload, Wifi } from "lucide-react";

export default function Home() {
  const { currentSong, isPlaying, audioQuality, addUserSong } = useMusicPlayer();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setIsDragging(false);
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
      <div className="h-full flex flex-col items-center justify-center p-12 page-enter">
        <div
          className={cn(
            "w-full max-w-sm flex flex-col items-center gap-6 transition-all duration-300",
            isDragging && "scale-[1.02]"
          )}
          onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
        >
          <div
            className="w-24 h-24 rounded-[28px] flex items-center justify-center transition-all duration-300 fade-scale-in"
            style={{
              background: isDragging
                ? `rgb(var(--dyn-v) / 0.25)`
                : `rgb(var(--dyn-v) / 0.12)`,
              boxShadow: isDragging ? `0 0 40px rgb(var(--dyn-v) / 0.3)` : "none",
              transform: isDragging ? "scale(1.08) rotate(2deg)" : "scale(1) rotate(0deg)",
            }}
          >
            <Music2
              className="w-10 h-10 transition-transform duration-300"
              style={{
                color: `rgb(var(--dyn-v))`,
                transform: isDragging ? "scale(1.15)" : "scale(1)",
              }}
            />
          </div>

          <div className="text-center space-y-2 stagger-item" style={{ animationDelay: "80ms" }}>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight">
              Tu música, aquí
            </h1>
            <p className="text-sm text-on-surface-variant">
              {isDragging ? "Suéltalo aquí" : "Sube tus archivos de audio para empezar a escuchar"}
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2.5 px-6 py-3 rounded-full font-semibold text-white stagger-item"
            style={{
              animationDelay: "140ms",
              background: `rgb(var(--dyn-v))`,
              boxShadow: `0 6px 24px rgb(var(--dyn-v) / 0.4)`,
              transition: "transform 150ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 200ms ease",
            }}
          >
            <Upload className="w-4 h-4" />
            Subir archivos
          </button>

          <p className="text-xs text-on-surface-variant text-center stagger-item" style={{ animationDelay: "180ms" }}>
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
    <div className="h-full flex flex-col items-center justify-center p-8 page-enter">
      {/* Album art */}
      <div
        key={currentSong.id}
        className={cn(
          "relative rounded-[32px] overflow-hidden mb-8 fade-scale-in",
          isPlaying ? "art-playing" : "opacity-85 scale-95"
        )}
        style={{
          width: "min(400px, calc(100vw - 340px))",
          aspectRatio: "1",
          transition: "transform 700ms cubic-bezier(0.34,1.56,0.64,1), opacity 400ms ease",
          transform: isPlaying ? "scale(1)" : "scale(0.94)",
        }}
      >
        <img
          src={currentSong.coverUrl}
          alt={currentSong.album}
          className="w-full h-full object-cover transition-transform duration-700"
          style={{ transform: isPlaying ? "scale(1.02)" : "scale(1)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

        {/* Quality badge */}
        <div className="absolute top-4 right-4">
          <span
            className={cn(
              "flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm fade-scale-in",
              qualityColors[audioQuality]
            )}
          >
            <Wifi className="w-3 h-3" />
            {qualityLabels[audioQuality]}
          </span>
        </div>
      </div>

      {/* Song info — re-animates on song change */}
      <div
        key={currentSong.id + "-info"}
        className="text-center w-full max-w-sm stagger-item"
      >
        <h1
          className="text-3xl font-bold tracking-tight mb-1 truncate text-on-surface"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {currentSong.title}
        </h1>
        <p className="text-lg text-on-surface-variant truncate stagger-item" style={{ animationDelay: "50ms" }}>
          {currentSong.artist}
        </p>
        <p className="text-sm text-outline mt-1 truncate stagger-item" style={{ animationDelay: "90ms" }}>
          {currentSong.album}
        </p>
      </div>

      {/* Playback indicator bars */}
      {isPlaying && (
        <div className="mt-7 flex items-end gap-[3px] h-6 fade-scale-in">
          {[0.45, 1, 0.65, 0.9, 0.5, 0.75, 0.4].map((h, i) => (
            <div
              key={i}
              className="w-[3px] rounded-full"
              style={{
                height: `${h * 22}px`,
                background: `rgb(var(--dyn-v))`,
                animation: `waveform ${0.55 + i * 0.09}s ease-in-out ${i * 0.07}s infinite alternate`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
