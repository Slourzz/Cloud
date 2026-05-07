import React, { useRef } from "react";
import { useMusicPlayer, AudioQuality } from "@/hooks/use-music-player";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Music2, Zap, Radio, Disc3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

const QUALITY_OPTIONS: { value: AudioQuality; label: string; desc: string; icon: React.ElementType }[] = [
  { value: "low", label: "Baja", desc: "64 kbps · Ahorra datos", icon: Radio },
  { value: "normal", label: "Normal", desc: "128 kbps · Estándar", icon: Music2 },
  { value: "high", label: "Alta", desc: "320 kbps · Recomendado", icon: Zap },
  { value: "lossless", label: "Lossless", desc: "FLAC · Sin pérdidas", icon: Disc3 },
];

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const {
    audioQuality, setAudioQuality,
    crossfadeSeconds, setCrossfadeSeconds,
    addUserSong, userSongs,
  } = useMusicPlayer();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      await addUserSong(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-md border border-outline-variant/25"
        style={{
          background: "hsl(var(--surface))",
          color: "hsl(var(--on-surface))",
          animation: "slide-up 300ms cubic-bezier(0.16,1,0.3,1) both",
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-on-surface">Ajustes</DialogTitle>
        </DialogHeader>

        <div className="space-y-7 py-2">
          {/* Audio Quality */}
          <section className="stagger-item" style={{ animationDelay: "60ms" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3 select-none">
              Calidad de audio
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {QUALITY_OPTIONS.map(({ value, label, desc, icon: Icon }, idx) => {
                const isSelected = audioQuality === value;
                return (
                  <button
                    key={value}
                    onClick={() => setAudioQuality(value)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-2xl text-left border ripple stagger-item",
                      isSelected
                        ? "border-transparent"
                        : "bg-surface-container text-on-surface-variant border-transparent hover:text-on-surface"
                    )}
                    style={{
                      animationDelay: `${80 + idx * 40}ms`,
                      ...(isSelected ? {
                        background: `rgb(var(--dyn-v) / 0.12)`,
                        color: `rgb(var(--dyn-v))`,
                        boxShadow: `0 0 0 1.5px rgb(var(--dyn-v) / 0.4)`,
                      } : {}),
                      transition: "background-color 200ms ease, box-shadow 200ms ease, color 150ms ease, transform 150ms cubic-bezier(0.34,1.56,0.64,1)",
                    }}
                  >
                    <Icon
                      className="w-5 h-5 shrink-0 transition-transform duration-200"
                      style={{ transform: isSelected ? "scale(1.12)" : "scale(1)" }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">{label}</p>
                      <p className="text-[11px] opacity-65 leading-tight mt-0.5 truncate">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Crossfade */}
          <section className="stagger-item" style={{ animationDelay: "120ms" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant select-none">
                Crossfade
              </h3>
              <span
                className={cn(
                  "text-sm font-semibold px-3 py-0.5 rounded-full transition-all duration-300",
                  crossfadeSeconds > 0
                    ? "bg-primary-container text-on-primary-container"
                    : "bg-surface-container text-on-surface-variant"
                )}
              >
                {crossfadeSeconds === 0 ? "Desactivado" : `${crossfadeSeconds}s`}
              </span>
            </div>
            <Slider
              value={[crossfadeSeconds]}
              min={0}
              max={12}
              step={1}
              onValueChange={(v) => setCrossfadeSeconds(v[0])}
              className="w-full dynamic-slider"
            />
            <div className="flex justify-between mt-1.5 text-[11px] text-on-surface-variant select-none">
              <span>Off</span>
              <span>12s</span>
            </div>
            {crossfadeSeconds > 0 && (
              <p className="text-xs text-on-surface-variant mt-2 bg-surface-container rounded-xl px-3 py-2 fade-scale-in">
                Las canciones se mezclarán suavemente durante {crossfadeSeconds} segundo{crossfadeSeconds !== 1 ? "s" : ""}.
              </p>
            )}
          </section>

          {/* File Upload */}
          <section className="stagger-item" style={{ animationDelay: "160ms" }}>
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3 select-none">
              Subir archivos de audio
            </h3>
            <label
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="cursor-pointer flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-outline-variant/40 hover:border-primary/55 hover:bg-primary-container/8 group"
              style={{ transition: "border-color 200ms ease, background-color 200ms ease" }}
            >
              <div
                className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center group-hover:bg-primary-container"
                style={{ transition: "background-color 200ms ease, transform 200ms cubic-bezier(0.34,1.56,0.64,1)" }}
              >
                <Upload
                  className="w-6 h-6 text-on-surface-variant group-hover:text-on-primary-container"
                  style={{ transition: "color 200ms ease, transform 200ms cubic-bezier(0.34,1.56,0.64,1)" }}
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-on-surface">
                  Haz clic o arrastra archivos aquí
                </p>
                <p className="text-xs text-on-surface-variant mt-1">
                  MP3, WAV, FLAC, AAC, OGG, M4A, OPUS y más
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>

            {userSongs.length > 0 && (
              <div className="mt-3 space-y-0.5 max-h-36 overflow-y-auto rounded-xl bg-surface-container p-2 scrollbar-hide">
                <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant px-2 mb-2 select-none">
                  Subidos ({userSongs.length})
                </p>
                {userSongs.map((song, i) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-on-surface/5 stagger-item"
                    style={{ animationDelay: `${i * 25}ms`, transition: "background-color 150ms ease" }}
                  >
                    <Music2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs text-on-surface truncate">{song.title}</span>
                    {song.duration > 0 && (
                      <span className="text-[10px] text-on-surface-variant ml-auto shrink-0 tabular-nums">
                        {Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
