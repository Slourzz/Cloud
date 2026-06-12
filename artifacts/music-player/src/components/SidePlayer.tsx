import React, { useEffect, useRef, useState } from "react";
import { useMusicPlayer, type Song } from "@/hooks/use-music-player";
import { useLyrics } from "@/hooks/use-lyrics";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { LyricsDisplay } from "@/components/lyrics-display";
import { CloudDynamicBackground } from "@/components/CloudDynamicBackground";
import { useAppearance } from "@/providers/appearance-provider";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Shuffle,
  Heart,
  FileText,
  Upload,
  UploadCloud,
  Loader2,
  Music2,
  Disc3,
  ListMusic,
  GripVertical,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SidePlayerMode = "player" | "lyrics" | "queue";

interface SidePlayerProps {
  open: boolean;
  mode: SidePlayerMode;
  onModeChange: (mode: SidePlayerMode) => void;
  isSystemFullscreen?: boolean;
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function SideIconBtn({
  onClick,
  active,
  children,
  className,
  style,
  title,
}: any) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={style}
      className={cn(
        "icon-btn relative text-white rounded-full transition-all",
        active
          ? "bg-white/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
          : "hover:bg-white/12",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SidePlayer({
  open,
  mode,
  onModeChange,
  isSystemFullscreen = false,
}: SidePlayerProps) {
  const {
    currentSong,
    queue,
    isPlaying,
    progress,
    isShuffle,
    isShufflePlus,
    isRepeat,
    isRepeatOne,
    likedSongs,
    togglePlayPause,
    next,
    prev,
    seek,
    toggleShuffle,
    toggleRepeat,
    toggleLike,
    play,
    removeFromQueue,
    reorderQueue,
  } = useMusicPlayer();
  const { getLyrics, loadTTML, loadPlainText, fetchAutoLyrics } = useLyrics();
  const { rgb } = useThemeColors();
  const { settings: appearance } = useAppearance();
  const isSimplyUI = appearance.interfaceTheme === "simplyui";

  const [visible, setVisible] = useState(false);
  const [displayMode, setDisplayMode] = useState<SidePlayerMode>(mode);
  const [modeFading, setModeFading] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [draggedQueueIndex, setDraggedQueueIndex] = useState<number | null>(
    null,
  );
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const ttmlInputRef = useRef<HTMLInputElement>(null);
  const plainInputRef = useRef<HTMLInputElement>(null);
  const modeTimeoutRef = useRef<number | null>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const latestProgressRef = useRef(progress);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [localProgress, setLocalProgress] = useState(progress);

  const songId = currentSong?.id ?? "";
  const lyricsState = getLyrics(songId);

  useEffect(() => {
    if (open) setVisible(true);
    else {
      setUploadMenuOpen(false);
      const t = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (modeTimeoutRef.current) window.clearTimeout(modeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (mode === displayMode) return;

    if (modeTimeoutRef.current) {
      window.clearTimeout(modeTimeoutRef.current);
    }

    setModeFading(true);
    modeTimeoutRef.current = window.setTimeout(() => {
      setDisplayMode(mode);
      window.requestAnimationFrame(() => setModeFading(false));
      modeTimeoutRef.current = null;
    }, 140);
  }, [displayMode, mode]);

  useEffect(() => {
    if (open && currentSong && songId) {
      fetchAutoLyrics(
        songId,
        currentSong.artist,
        currentSong.title,
        currentSong.duration,
      );
    }
  }, [
    open,
    songId,
    currentSong?.artist,
    currentSong?.title,
    currentSong?.duration,
    fetchAutoLyrics,
  ]);

  useEffect(() => {
    if (!isDraggingProgress) {
      setLocalProgress(progress);
      latestProgressRef.current = progress;
    }
  }, [progress, isDraggingProgress]);

  const updateProgressFromMouse = (clientX: number, commit = false) => {
    if (!progressTrackRef.current || !currentSong?.duration) return;

    const rect = progressTrackRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const percent = x / rect.width;
    const newTime = percent * currentSong.duration;

    latestProgressRef.current = newTime;
    setLocalProgress(newTime);

    if (commit) seek(newTime);
  };

  const handleProgressClick = (e: React.MouseEvent) => {
    updateProgressFromMouse(e.clientX, true);
  };

  const handleProgressDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingProgress(true);
    updateProgressFromMouse(e.clientX, false);
    document.addEventListener("mousemove", handleProgressDragMove);
    document.addEventListener("mouseup", handleProgressDragEnd);
  };

  const handleProgressDragMove = (e: MouseEvent) => {
    updateProgressFromMouse(e.clientX, false);
  };

  const handleProgressDragEnd = () => {
    seek(latestProgressRef.current);
    setIsDraggingProgress(false);
    document.removeEventListener("mousemove", handleProgressDragMove);
    document.removeEventListener("mouseup", handleProgressDragEnd);
  };

  const handleTTMLFile = (e: any) => {
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

  const handlePlainFile = (e: any) => {
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
    fetchAutoLyrics(
      songId,
      currentSong.artist,
      currentSong.title,
      currentSong.duration,
    );
  };

  const handleGenerateWithAI = async () => {};

  const handleModeChange = (nextMode: SidePlayerMode) => {
    if (nextMode !== mode) onModeChange(nextMode);
    setUploadMenuOpen(false);
  };

  const handleQueueDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    sourceIndex: number,
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(sourceIndex));
    setDraggedQueueIndex(sourceIndex);
  };

  const handleQueueDrop = (
    event: React.DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    const transferredIndex = Number(event.dataTransfer.getData("text/plain"));
    const sourceIndex =
      draggedQueueIndex ??
      (Number.isFinite(transferredIndex) ? transferredIndex : -1);
    if (sourceIndex < 0 || sourceIndex >= queue.length) return;
    const nextQueue = [...queue];

    const [movedSong] = nextQueue.splice(sourceIndex, 1);
    const adjustedTargetIndex =
      sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    nextQueue.splice(adjustedTargetIndex, 0, movedSong);
    reorderQueue(nextQueue);
    setDraggedQueueIndex(null);
    setDragOverIndex(null);
  };

  const handleQueuePlay = (song: Song) => {
    play(song);
  };

  if (!visible) return null;
  const isLiked = likedSongs.has(songId);
  const hasLyrics = lyricsState.lines.length > 0;
  const duration = currentSong?.duration ?? 0;
  const progressPercent = duration
    ? Math.min(100, (localProgress / duration) * 100)
    : 0;
  return (
    <div
      className={cn(
        "relative z-20 flex h-full w-full flex-col overflow-hidden transition-[transform,opacity,filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        open
          ? "translate-x-0 opacity-100 blur-0"
          : "translate-x-full opacity-0 blur-sm",
      )}
      style={{
        background: isSimplyUI ? "#1d1e20" : "transparent",
      }}
    >
      {!isSimplyUI ? <CloudDynamicBackground /> : null}
      {!isSimplyUI ? (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/26 via-black/8 to-transparent" />
      ) : null}

      <div
        className={cn(
          "relative z-10 flex h-full flex-col px-4 pb-4 text-white",
          isSystemFullscreen ? "pt-4" : "pt-14",
        )}
      >
        <div className="sideplayer-toolbar relative z-40 border-b border-white/10 pb-3">
          <div className="grid h-11 min-w-0 grid-cols-3 rounded-lg bg-black/14 p-1">
            {(
              [
                ["player", "Cancion"],
                ["lyrics", "Letras"],
                ["queue", "Cola de reproduccion"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => handleModeChange(value)}
                className={cn(
                  "min-w-0 rounded-md px-1 text-[10px] font-black leading-tight text-white/50",
                  mode === value && "bg-white/14 text-white",
                )}
                aria-pressed={mode === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {displayMode === "player" ? (
          <div
            className={cn(
              "flex-1 min-h-0 px-2 py-7 overflow-y-auto sideplayer-scroll sideplayer-mode-panel",
              modeFading ? "sideplayer-mode-out" : "sideplayer-mode-in",
            )}
          >
            <div className="flex min-h-full flex-col items-center justify-center gap-6 pb-14">
              <div className="relative mx-auto w-[min(315px,78vw)]">
                <div
                  className="absolute -inset-7 rounded-[46px] blur-3xl opacity-75"
                  style={{
                    background: `radial-gradient(circle, ${rgb("v", 0.36)}, transparent 68%)`,
                  }}
                />
                <div className="relative aspect-square overflow-hidden rounded-[32px] bg-white/10 ring-1 ring-white/24 shadow-2xl">
                  {currentSong?.coverUrl ? (
                    <img
                      src={currentSong.coverUrl}
                      alt="cover"
                      className={cn(
                        "w-full h-full object-cover transition-transform duration-700",
                        isPlaying ? "scale-[1.035]" : "scale-100",
                      )}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/18 to-white/5">
                      <Disc3 className="w-16 h-16 text-white/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-white/12 via-transparent to-black/24 pointer-events-none" />
                  <div className="absolute inset-x-5 top-2 h-9 rounded-full bg-white/16 blur-xl pointer-events-none" />
                </div>
              </div>

              <div className="text-center">
                <h2 className="mx-auto max-w-[330px] truncate text-2xl font-black tracking-tight text-white">
                  {currentSong?.title ?? "-"}
                </h2>
                <p className="mt-1 truncate text-sm font-semibold text-white/65">
                  {currentSong?.artist ?? "Artista desconocido"}
                </p>
              </div>

              <div className="flex items-center justify-center gap-5">
                <SideIconBtn
                  onClick={toggleShuffle}
                  active={isShuffle}
                  className="w-10 h-10"
                  title="Aleatorio"
                >
                  <Shuffle className="w-4 h-4" />
                  {isShufflePlus ? (
                    <span className="absolute right-1 top-1 text-[9px] font-black">
                      +
                    </span>
                  ) : null}
                </SideIconBtn>
                <SideIconBtn
                  onClick={prev}
                  className="w-12 h-12"
                  title="Anterior"
                >
                  <SkipBack
                    className="w-6 h-6 fill-current"
                    strokeWidth={1.4}
                  />
                </SideIconBtn>
                <button
                  onClick={togglePlayPause}
                  className="w-16 h-16 flex items-center justify-center text-white transition-transform duration-150 hover:scale-110 active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="w-9 h-9 fill-current" />
                  ) : (
                    <Play className="w-9 h-9 fill-current ml-0.5" />
                  )}
                </button>
                <SideIconBtn
                  onClick={next}
                  className="w-12 h-12"
                  title="Siguiente"
                >
                  <SkipForward
                    className="w-6 h-6 fill-current"
                    strokeWidth={1.4}
                  />
                </SideIconBtn>
                <SideIconBtn
                  onClick={toggleRepeat}
                  active={isRepeat}
                  className="w-10 h-10"
                  title="Repetir"
                >
                  <Repeat className="w-4 h-4" />
                  {isRepeatOne ? (
                    <span className="absolute right-1 top-1 text-[9px] font-black">
                      1
                    </span>
                  ) : null}
                </SideIconBtn>
              </div>

              <div className="w-full space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-white/58 tabular-nums">
                  <span>{formatTime(localProgress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <div
                  ref={progressTrackRef}
                  className="cloud-progress-track relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full"
                  onMouseDown={handleProgressDragStart}
                  onClick={handleProgressClick}
                  title={`${formatTime(localProgress)} / ${formatTime(duration)}`}
                >
                  <div
                    className="cloud-progress-fill absolute left-0 top-0 h-full rounded-full transition-[width] duration-50"
                    style={{
                      width: `${progressPercent}%`,
                      boxShadow: "0 0 16px rgba(255,255,255,0.22)",
                    }}
                  />
                </div>
              </div>

              <div className="flex w-full items-center justify-center">
                <SideIconBtn
                  onClick={() => toggleLike(songId)}
                  active={isLiked}
                  className="w-10 h-10"
                  style={{ color: isLiked ? "white" : "white" }}
                  title="Me gusta"
                >
                  <Heart
                    className="w-4 h-4"
                    fill={isLiked ? "currentColor" : "none"}
                  />
                </SideIconBtn>
              </div>
            </div>
          </div>
        ) : displayMode === "lyrics" ? (
          <div
            className={cn(
              "sideplayer-lyrics-panel flex-1 flex flex-col overflow-hidden px-2 pb-2 pt-4 gap-2 sideplayer-mode-panel",
              modeFading ? "sideplayer-mode-out" : "sideplayer-mode-in",
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-wider text-white/70">
                Letras
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => ttmlInputRef.current?.click()}
                  className="icon-btn w-8 h-8 text-white/70 hover:bg-white/10 rounded-full"
                >
                  <Upload className="w-4 h-4" />
                </button>
                <button
                  onClick={() => plainInputRef.current?.click()}
                  className="icon-btn w-8 h-8 text-white/70 hover:bg-white/10 rounded-full"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {lyricsState.isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-white/60">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <p className="text-sm">Cargando letras...</p>
                </div>
              ) : hasLyrics ? (
                <LyricsDisplay
                  lines={lyricsState.lines}
                  currentTime={progress}
                  source={lyricsState.source}
                  isPaused={!isPlaying}
                />
              ) : (
                <div className="text-center text-white/60 py-10">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Sin letras</p>
                  <p className="text-xs mt-1">
                    {lyricsState.error ?? "Sube un archivo TTML o busca"}
                  </p>
                  <div className="flex flex-col gap-2 mt-5 max-w-xs mx-auto">
                    <button
                      onClick={handleAutoFetch}
                      className="bg-white/10 text-white text-sm py-2 rounded-lg hover:bg-white/20 transition"
                    >
                      Buscar en internet
                    </button>
                    <button
                      onClick={handleGenerateWithAI}
                      className="bg-primary/80 text-white text-sm py-2 rounded-lg hover:bg-primary/90 transition"
                    >
                      Generar con IA
                    </button>
                  </div>
                </div>
              )}
            </div>
            <style>{`
              .sideplayer-lyrics-panel .sl-container {
                padding-left: clamp(0.75rem, 2.5vw, 1.25rem);
                padding-right: clamp(0.75rem, 2.5vw, 1.25rem);
              }

              .sideplayer-lyrics-panel .sl-line {
                --sl-size: clamp(1.9rem, 7cqw, 3.15rem);
                max-width: none;
              }

              .sideplayer-lyrics-panel .sl-credits {
                width: 100%;
              }
            `}</style>
          </div>
        ) : (
          <div
            className={cn(
              "sideplayer-mode-panel min-h-0 flex-1 overflow-hidden px-1 pb-16 pt-4",
              modeFading ? "sideplayer-mode-out" : "sideplayer-mode-in",
            )}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-end justify-between px-2 pb-3">
                <div>
                  <p className="text-sm font-black text-white">
                    Siguiente en la cola
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-white/42">
                    {queue.length} canciones
                  </p>
                </div>
                <ListMusic className="h-5 w-5 text-white/46" />
              </div>

              <div className="sideplayer-scroll min-h-0 flex-1 overflow-y-auto pr-1">
                {queue.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                    <ListMusic className="h-9 w-9 text-white/24" />
                    <p className="mt-4 text-sm font-bold text-white/62">
                      La cola esta vacia
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-white/38">
                      Reproduce una playlist o agrega canciones para verlas
                      aqui.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {queue.map((song, index) => (
                      <div
                        key={`${song.id}-${index}`}
                        className={cn(
                          "group flex items-center gap-2 rounded-lg px-2 py-2",
                          dragOverIndex === index
                            ? "bg-white/14"
                            : "hover:bg-white/8",
                        )}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDragOverIndex(index);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleQueueDrop(event, index);
                        }}
                      >
                        <button
                          type="button"
                          draggable
                          onDragStart={(event) =>
                            handleQueueDragStart(event, index)
                          }
                          onDragEnd={() => {
                            setDraggedQueueIndex(null);
                            setDragOverIndex(null);
                          }}
                          className="cursor-grab text-white/28 active:cursor-grabbing"
                          title="Reordenar"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleQueuePlay(song)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/8">
                            {song.coverUrl ? (
                              <img
                                src={song.coverUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Music2 className="h-4 w-4 text-white/34" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white/82">
                              {song.title}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-white/42">
                              {song.artist}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => removeFromQueue(song.id)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/28 opacity-0 hover:bg-white/10 hover:text-white group-hover:opacity-100"
                          title="Quitar de la cola"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div
          className={cn(
            "absolute bottom-5 left-5 z-30",
            displayMode !== "lyrics" && "hidden",
          )}
        >
          <div
            className={cn(
              "sideplayer-upload-menu absolute bottom-14 left-0 w-52 origin-bottom-left overflow-hidden rounded-2xl p-2 transition-all duration-300",
              uploadMenuOpen
                ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                : "pointer-events-none translate-y-2 scale-95 opacity-0",
            )}
          >
            <button
              type="button"
              onClick={() => {
                setUploadMenuOpen(false);
                ttmlInputRef.current?.click();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white/82 transition hover:bg-white/14 hover:text-white"
            >
              <UploadCloud className="h-4 w-4" />
              TTML sincronizado
            </button>
            <button
              type="button"
              onClick={() => {
                setUploadMenuOpen(false);
                plainInputRef.current?.click();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white/82 transition hover:bg-white/14 hover:text-white"
            >
              <FileText className="h-4 w-4" />
              Texto plano
            </button>
          </div>

          <button
            type="button"
            onClick={() => setUploadMenuOpen((current) => !current)}
            className={cn(
              "sideplayer-liquid-button flex h-11 w-11 items-center justify-center rounded-full text-white transition-all duration-300 active:scale-95",
              uploadMenuOpen
                ? "scale-105 bg-white/22"
                : "bg-white/12 hover:scale-105 hover:bg-white/18",
            )}
            title="Subir letras"
          >
            <UploadCloud className="h-5 w-5" />
          </button>
        </div>
      </div>
      <input
        ref={ttmlInputRef}
        type="file"
        accept=".ttml,.xml"
        className="hidden"
        onChange={handleTTMLFile}
      />
      <input
        ref={plainInputRef}
        type="file"
        accept=".txt"
        className="hidden"
        onChange={handlePlainFile}
      />

      <style>{`
        .sideplayer-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.30) rgba(255,255,255,0.08);
        }

        .sideplayer-scroll::-webkit-scrollbar {
          width: 7px;
        }

        .sideplayer-scroll::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.08);
          border-radius: 999px;
        }

        .sideplayer-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.28);
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.16);
        }

        .sideplayer-mode-panel {
          will-change: opacity, transform, filter;
        }

        .sideplayer-liquid-button,
        .sideplayer-upload-menu,
        .sideplayer-utility-popover {
          border: 1px solid rgba(255,255,255,0.22);
          background-image: linear-gradient(
            145deg,
            rgba(255,255,255,0.18),
            rgba(255,255,255,0.07)
          );
          backdrop-filter: blur(24px) saturate(155%);
          -webkit-backdrop-filter: blur(24px) saturate(155%);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.28),
            0 16px 38px rgba(0,0,0,0.24);
        }

        .sideplayer-mode-in {
          animation: sideplayer-mode-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .sideplayer-mode-out {
          animation: sideplayer-mode-out 150ms ease both;
        }

        @keyframes sideplayer-mode-in {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.985);
            filter: blur(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes sideplayer-mode-out {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
          to {
            opacity: 0;
            transform: translateY(-8px) scale(0.985);
            filter: blur(8px);
          }
        }
      `}</style>
    </div>
  );
}
