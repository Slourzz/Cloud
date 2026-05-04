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
        className="max-w-md border border-outline-variant/30"
        style={{ background: "hsl(var(--surface))", color: "hsl(var(--on-surface))" }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-on-surface">Ajustes</DialogTitle>
        </DialogHeader>

        <div className="space-y-7 py-2">
          {/* Audio Quality */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant mb-3">
              Calidad de audio
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {QUALITY_OPTIONS.map(({ value, label, desc, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setAudioQuality(value)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-2xl text-left transition-all ripple border",
                    audioQuality === value
                      ? "bg-primary-container text-on-primary-container border-transparent elevation-1"
                      : "bg-surface-container text-on-surface-variant border-transparent hover:border-outline-variant/40 hover:text-on-surface"
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{label}</p>
                    <p className="text-[11px] opacity-70 leading-tight mt-0.5 truncate">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Crossfade */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">
                Crossfade
              </h3>
              <span
                className={cn(
                  "text-sm font-semibold px-3 py-0.5 rounded-full",
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
              className="w-full"
            />
            <div className="flex justify-between mt-1.5 text-[11px] text-on-surface-variant">
              <span>Off</span>
              <span>12s</span>
            </div>
            {crossfadeSeconds > 0 && (
              <p className="text-xs text-on-surface-variant mt-2 bg-surface-container rounded-xl px-3 py-2">
                Las canciones se mezclarán suavemente durante {crossfadeSeconds} segundo{crossfadeSeconds !== 1 ? "s" : ""}.
                Funciona con archivos de audio subidos.
              </p>
            )}
          </section>

          {/* File Upload */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant mb-3">
              Subir archivos de audio
            </h3>
            <label
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="cursor-pointer flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-outline-variant hover:border-primary/60 hover:bg-primary-container/10 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center group-hover:bg-primary-container transition-colors">
                <Upload className="w-6 h-6 text-on-surface-variant group-hover:text-on-primary-container transition-colors" />
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
              <div className="mt-3 space-y-1 max-h-36 overflow-y-auto rounded-xl bg-surface-container p-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant px-2 mb-2">
                  Subidos ({userSongs.length})
                </p>
                {userSongs.map((song) => (
                  <div
                    key={song.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-on-surface/5 transition-colors"
                  >
                    <Music2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs text-on-surface truncate">{song.title}</span>
                    {song.duration > 0 && (
                      <span className="text-[10px] text-on-surface-variant ml-auto shrink-0">
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
