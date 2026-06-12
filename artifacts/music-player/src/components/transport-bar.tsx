import React, { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Maximize2,
  PanelLeft,
  Heart,
  ListMusic,
  Cast,
  Volume2,
  VolumeX,
  SlidersHorizontal,
} from "lucide-react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { cn } from "@/lib/utils";
import {
  useAppearance,
  type LyricsAnimationFormat,
} from "@/providers/appearance-provider";
import { useGoogleCast, type CastLayout } from "@/hooks/use-google-cast";

interface TransportBarProps {
  onFullscreen: () => void;
  onSidebarToggle?: () => void;
  onQueueToggle?: () => void;
  sidebarVisible?: boolean;
  queueVisible?: boolean;
  libraryVisible?: boolean;
}

export function TransportBar({
  onFullscreen,
  onSidebarToggle,
  onQueueToggle,
  sidebarVisible = false,
  queueVisible = false,
  libraryVisible = false,
}: TransportBarProps) {
  const { settings: appearanceSettings } = useAppearance();
  const isSimplyUI = appearanceSettings.interfaceTheme === "simplyui";
  const cast = useGoogleCast();

  const {
    currentSong,
    isPlaying,
    togglePlayPause,
    next,
    prev,
    volume,
    setVolume,
    isShuffle,
    isShufflePlus,
    toggleShuffle,
    isRepeat,
    isRepeatOne,
    toggleRepeat,
    toggleLike,
    likedSongs,
    progress,
    seek,
  } = useMusicPlayer();

  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [localVolume, setLocalVolume] = useState(volume);
  const [isLiked, setIsLiked] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [localProgress, setLocalProgress] = useState(progress);
  const [isTitleOverflow, setIsTitleOverflow] = useState(false);
  const [titleMarqueeDistance, setTitleMarqueeDistance] = useState(0);
  const [volumePopoverOpen, setVolumePopoverOpen] = useState(false);
  const [castPopoverOpen, setCastPopoverOpen] = useState(false);

  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const volumeContainerRef = useRef<HTMLDivElement>(null);
  const volumeButtonRef = useRef<HTMLButtonElement>(null);
  const castButtonRef = useRef<HTMLButtonElement>(null);
  const castPopoverRef = useRef<HTMLDivElement>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const latestVolumeRef = useRef(volume);
  const latestProgressRef = useRef(progress);
  const lastAudibleVolumeRef = useRef(volume > 0 ? volume : 70);

  useEffect(() => {
    if (currentSong && likedSongs) {
      setIsLiked(likedSongs.has(currentSong.id));
    }
  }, [currentSong, likedSongs]);

  useEffect(() => {
    if (!isDraggingVolume) {
      setLocalVolume(volume);
      latestVolumeRef.current = volume;
      if (volume > 0) lastAudibleVolumeRef.current = volume;
    }
  }, [volume, isDraggingVolume]);

  useEffect(() => {
    if (!isDraggingProgress) {
      setLocalProgress(progress);
      latestProgressRef.current = progress;
    }
  }, [progress, isDraggingProgress]);

  useEffect(() => {
    const checkTitleOverflow = () => {
      if (!titleRef.current) return;

      const overflowAmount =
        titleRef.current.scrollWidth - titleRef.current.clientWidth;
      const overflow = overflowAmount > 1;

      setIsTitleOverflow(overflow);
      setTitleMarqueeDistance(overflow ? overflowAmount + 18 : 0);
    };

    const frame = window.requestAnimationFrame(checkTitleOverflow);
    window.addEventListener("resize", checkTitleOverflow);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", checkTitleOverflow);
    };
  }, [currentSong?.title]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        volumePopoverOpen &&
        !volumeContainerRef.current?.contains(target) &&
        !volumeButtonRef.current?.contains(target)
      ) {
        setVolumePopoverOpen(false);
      }

      if (
        castPopoverOpen &&
        !castPopoverRef.current?.contains(target) &&
        !castButtonRef.current?.contains(target)
      ) {
        setCastPopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [volumePopoverOpen, castPopoverOpen]);

  const updateVolumeFromMouse = (clientX: number, commit = false) => {
    if (!volumeTrackRef.current) return;

    const rect = volumeTrackRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const percent = x / rect.width;
    const newVol = Math.min(100, Math.max(0, percent * 100));

    latestVolumeRef.current = newVol;
    setLocalVolume(newVol);

    if (commit) setVolume(newVol);
  };

  const handleVolumeClick = (e: React.MouseEvent) => {
    updateVolumeFromMouse(e.clientX, true);
  };

  const handleVolumeDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingVolume(true);
    updateVolumeFromMouse(e.clientX, false);
    document.addEventListener("mousemove", handleVolumeDragMove);
    document.addEventListener("mouseup", handleVolumeDragEnd);
  };

  const handleVolumeDragMove = (e: MouseEvent) => {
    updateVolumeFromMouse(e.clientX, false);
  };

  const handleVolumeDragEnd = () => {
    setVolume(latestVolumeRef.current);
    setIsDraggingVolume(false);
    document.removeEventListener("mousemove", handleVolumeDragMove);
    document.removeEventListener("mouseup", handleVolumeDragEnd);
  };

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

  const handleLike = () => {
    if (currentSong) {
      if (toggleLike) toggleLike(currentSong.id);
      else setIsLiked(!isLiked);
    }
  };

  const handleVolumeToggle = () => {
    setVolume(volume > 0 ? 0 : Math.max(1, lastAudibleVolumeRef.current || 70));
  };

  const handleCast = async () => {
    if (cast.message && cast.status !== "connected") {
      cast.dismissMessage();
      setCastPopoverOpen(false);
      return;
    }
    if (cast.status === "connected") {
      await cast.disconnect();
      setCastPopoverOpen(false);
      return;
    }
    await cast.connect();
  };

  if (!currentSong) return null;

  const volumePercent = Math.min(100, Math.max(0, localVolume));
  const progressPercent = currentSong.duration
    ? Math.min(100, Math.max(0, (localProgress / currentSong.duration) * 100))
    : 0;
  const glassmorphismStyle: React.CSSProperties = isSimplyUI
    ? {
        background: "#1d1d1f",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        border: "0",
        boxShadow: "none",
      }
    : {
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.045)), var(--cloud-surface)",
        backdropFilter: "var(--cloud-glass-filter)",
        WebkitBackdropFilter: "var(--cloud-glass-filter)",
        border: "1px solid var(--cloud-border)",
        boxShadow:
          "0 12px 34px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -1px 0 rgba(255,255,255,0.10)",
      };

  const glassMainStyle: React.CSSProperties = isSimplyUI
    ? {
        background: "#1d1d1f",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
        border: "0",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "none",
      }
    : {
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.055)), var(--cloud-surface-strong)",
        backdropFilter: "var(--cloud-glass-filter)",
        WebkitBackdropFilter: "var(--cloud-glass-filter)",
        border: "1px solid var(--cloud-border)",
        boxShadow:
          "var(--cloud-shadow), inset 0 1px 0 rgba(255,255,255,0.36), inset 0 -1px 0 rgba(255,255,255,0.12)",
      };

  const iconButtonStyle: React.CSSProperties = {
    transition: "all 150ms ease",
    cursor: "pointer",
  };

  const controlButtonStyle: React.CSSProperties = {
    transition: "all 150ms ease",
    cursor: "pointer",
    color: "white",
  };

  const playPauseButtonStyle: React.CSSProperties = {
    transition: "all 150ms ease",
    cursor: "pointer",
    color: "white",
  };

  const sidebarWidth = 420;
  const libraryWidth = 288;
  const occupiedWidth = isSimplyUI
    ? 0
    : (sidebarVisible ? sidebarWidth : 0) + (libraryVisible ? libraryWidth : 0);
  const centerOffset =
    ((libraryVisible ? libraryWidth : 0) -
      (sidebarVisible ? sidebarWidth : 0)) /
    2;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none"
      style={{ paddingBottom: isSimplyUI ? "0px" : "16px" }}
    >
      <div className="relative w-full h-full pointer-events-none">
        <div
          className={`transport-shell pointer-events-auto flex flex-col animate-slide-up ${
            isSimplyUI ? "w-full max-w-none gap-0" : "gap-1"
          }`}
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            width: isSimplyUI
              ? "100%"
              : `min(1100px, max(280px, calc(100vw - ${occupiedWidth + 48}px)))`,
            transform: isSimplyUI
              ? "translateX(-50%)"
              : `translateX(calc(-50% + ${centerOffset}px))`,
            transition:
              "transform 400ms cubic-bezier(0.16, 1, 0.3, 1), width 400ms cubic-bezier(0.16, 1, 0.3, 1)",
            ...(currentSong
              ? {}
              : { transform: "translateY(calc(100% + 24px))" }),
          }}
        >
          <div
            className={cn(
              "flex w-full items-end justify-between gap-4 px-6",
              isSimplyUI && "hidden",
            )}
          >
            <div
              ref={volumeContainerRef}
              className="flex h-12 w-48 items-center gap-3 rounded-full px-4"
              style={glassmorphismStyle}
            >
              <button
                type="button"
                onClick={handleVolumeToggle}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/12"
                aria-label={volume > 0 ? "Silenciar" : "Activar volumen"}
              >
                {volume > 0 ? (
                  <Volume2 className="h-4 w-4" strokeWidth={1.8} />
                ) : (
                  <VolumeX className="h-4 w-4" strokeWidth={1.8} />
                )}
              </button>
              <div
                ref={volumeTrackRef}
                className="cloud-progress-track relative h-2 flex-1 cursor-pointer overflow-hidden rounded-full"
                onMouseDown={handleVolumeDragStart}
                onClick={handleVolumeClick}
                aria-label="Volumen"
              >
                <div
                  className="cloud-progress-fill absolute left-0 top-0 h-full rounded-full"
                  style={{ width: `${volumePercent}%` }}
                />
              </div>
            </div>
            <div
              className="flex gap-1.5 rounded-full p-1.5"
              style={glassmorphismStyle}
            >
              <button
                onClick={handleLike}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-all"
                style={iconButtonStyle}
                aria-label="Like"
              >
                <Heart
                  className="w-4 h-4"
                  fill={isLiked ? "currentColor" : "none"}
                  strokeWidth={1.8}
                />
              </button>
              <button
                onClick={toggleShuffle}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-all relative"
                style={{
                  ...iconButtonStyle,
                  color: "white",
                  background: isShuffle
                    ? "var(--cloud-accent-soft)"
                    : "transparent",
                }}
                aria-label={
                  isShufflePlus
                    ? "Shuffle+ activado"
                    : isShuffle
                      ? "Shuffle activado"
                      : "Activar shuffle"
                }
                aria-pressed={isShuffle}
              >
                <Shuffle className="w-4 h-4" strokeWidth={1.8} />
                {isShufflePlus ? (
                  <span className="absolute right-1 top-0.5 text-[9px] font-black leading-none">
                    +
                  </span>
                ) : isShuffle ? (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current" />
                ) : null}
              </button>
              <button
                onClick={toggleRepeat}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-all relative"
                style={{
                  ...iconButtonStyle,
                  color: "white",
                  background: isRepeat
                    ? "var(--cloud-accent-soft)"
                    : "transparent",
                }}
                aria-label={
                  isRepeatOne
                    ? "Repetir una cancion"
                    : isRepeat
                      ? "Repetir cola"
                      : "Activar repeticion"
                }
                aria-pressed={isRepeat}
              >
                <Repeat className="w-4 h-4" strokeWidth={1.8} />
                {isRepeatOne ? (
                  <span className="absolute right-1 top-0.5 text-[9px] font-black leading-none">
                    1
                  </span>
                ) : isRepeat ? (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-current" />
                ) : null}
              </button>
            </div>
          </div>

          {castPopoverOpen && cast.status === "connected" ? (
            <div
              ref={castPopoverRef}
              className="pointer-events-auto absolute bottom-[5.75rem] right-5 z-[80]"
            >
              <CastSettingsPopover
                isSimplyUI={isSimplyUI}
                layout={cast.layout}
                lyricFormat={cast.lyricFormat}
                onLayoutChange={cast.setLayout}
                onLyricFormatChange={cast.setLyricFormat}
              />
            </div>
          ) : null}

          {cast.message ? (
            <div
              className={cn(
                "pointer-events-auto absolute bottom-[5.75rem] right-5 z-[79] max-w-72 px-4 py-3 text-center text-xs font-bold text-white",
                isSimplyUI
                  ? "rounded-lg border border-white/10 bg-[#242424] shadow-xl"
                  : "rounded-2xl border border-white/18 bg-black/30 shadow-2xl backdrop-blur-2xl",
              )}
            >
              {cast.message}
            </div>
          ) : null}

          <div
            className={cn(
              "relative w-full h-20 overflow-hidden",
              isSimplyUI ? "rounded-none" : "rounded-full",
            )}
            style={glassMainStyle}
          >
            {!isSimplyUI && (
              <>
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/16 via-white/5 to-white/8 pointer-events-none" />
                <div className="absolute inset-x-5 top-1 h-7 rounded-full bg-white/14 blur-xl pointer-events-none" />
                <div className="absolute -left-10 top-2 h-16 w-44 rotate-[-10deg] rounded-full bg-white/10 blur-2xl pointer-events-none" />
                <div className="absolute -right-8 bottom-0 h-14 w-52 rotate-[-8deg] rounded-full bg-white/8 blur-2xl pointer-events-none" />
                <div className="absolute top-0 left-[8%] right-[8%] h-px bg-gradient-to-r from-transparent via-white/58 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              </>
            )}

            <div className="transport-main-grid relative grid h-full items-center px-4 sm:px-5">
              <div className="transport-track-info flex items-center gap-3 min-w-0">
                <img
                  src={currentSong.coverUrl}
                  alt="cover"
                  className="transport-cover w-14 h-14 rounded-2xl object-cover shadow-lg bg-white/10 transition-transform duration-300"
                  style={{ transform: isPlaying ? "scale(1.03)" : "scale(1)" }}
                />
                <div className="flex flex-col min-w-0">
                  <div className="transport-title-box overflow-hidden">
                    <p
                      ref={titleRef}
                      className={`transport-title-text text-base font-bold text-white whitespace-nowrap ${
                        isTitleOverflow ? "transport-title-marquee" : "truncate"
                      }`}
                      title={currentSong.title}
                      style={
                        {
                          "--title-marquee-distance": `-${titleMarqueeDistance}px`,
                        } as React.CSSProperties
                      }
                    >
                      {currentSong.title}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-white/75 truncate max-w-[220px]">
                    {currentSong.artist}
                  </p>
                </div>
              </div>

              <div className="transport-center-controls flex flex-col items-center justify-self-center">
                <div className="transport-control-row flex items-center gap-3">
                  <button
                    onClick={prev}
                    className="transport-skip-button w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/10 transition-all hover:scale-110 active:scale-95"
                    style={controlButtonStyle}
                    aria-label="Anterior"
                  >
                    <SkipBack
                      className="w-6 h-6 fill-current"
                      strokeWidth={1.4}
                    />
                  </button>
                  <button
                    onClick={togglePlayPause}
                    className="transport-play-button w-14 h-14 rounded-full flex items-center justify-center hover:bg-white/10 transition-all hover:scale-110 active:scale-95"
                    style={playPauseButtonStyle}
                    aria-label={isPlaying ? "Pausar" : "Reproducir"}
                  >
                    {isPlaying ? (
                      <Pause className="w-10 h-10 fill-current" />
                    ) : (
                      <Play className="w-10 h-10 fill-current ml-1" />
                    )}
                  </button>
                  <button
                    onClick={next}
                    className="transport-skip-button w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/10 transition-all hover:scale-110 active:scale-95"
                    style={controlButtonStyle}
                    aria-label="Siguiente"
                  >
                    <SkipForward
                      className="w-6 h-6 fill-current"
                      strokeWidth={1.4}
                    />
                  </button>
                </div>

                <div className="transport-progress-row flex items-center gap-2 w-64 max-w-[28vw]">
                  <div
                    ref={progressTrackRef}
                    className="cloud-progress-track relative flex-1 h-1.5 rounded-full cursor-pointer overflow-hidden"
                    onMouseDown={handleProgressDragStart}
                    onClick={handleProgressClick}
                    title={`${formatTime(localProgress)} / ${formatTime(currentSong.duration)}`}
                  >
                    <div
                      className="cloud-progress-fill absolute left-0 top-0 h-full rounded-full transition-[width] duration-50"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="transport-actions relative flex items-center gap-2 justify-self-end">
                <button
                  onClick={handleCast}
                  className="transport-action-button flex h-10 w-10 items-center justify-center rounded-full text-white transition-all hover:scale-105 hover:bg-white/15"
                  style={iconButtonStyle}
                  aria-label={
                    cast.status === "connected"
                      ? "Detener transmision"
                      : "Transmitir"
                  }
                  aria-pressed={cast.status === "connected"}
                >
                  <Cast
                    className={cn(
                      "h-5 w-5",
                      cast.status === "connecting" && "animate-pulse",
                    )}
                    strokeWidth={1.8}
                  />
                </button>
                {cast.status === "connected" ? (
                  <div className="relative">
                    <button
                      ref={castButtonRef}
                      type="button"
                      onClick={() => {
                        setCastPopoverOpen((open) => !open);
                        setVolumePopoverOpen(false);
                      }}
                      className="transport-action-button flex h-10 w-10 items-center justify-center rounded-full text-white transition-all hover:scale-105 hover:bg-white/15"
                      style={{
                        ...iconButtonStyle,
                        background: castPopoverOpen
                          ? "var(--cloud-accent-soft)"
                          : "transparent",
                      }}
                      aria-label="Organizacion de Cast"
                      aria-expanded={castPopoverOpen}
                    >
                      <SlidersHorizontal
                        className="h-5 w-5"
                        strokeWidth={1.8}
                      />
                    </button>
                  </div>
                ) : null}
                <div className={cn("relative", !isSimplyUI && "hidden")}>
                  <button
                    ref={volumeButtonRef}
                    onClick={() => {
                      setVolumePopoverOpen((open) => !open);
                      setCastPopoverOpen(false);
                    }}
                    className="transport-action-button flex h-10 w-10 items-center justify-center rounded-full text-white transition-all hover:scale-105 hover:bg-white/15"
                    style={{
                      ...iconButtonStyle,
                      background: volumePopoverOpen
                        ? "var(--cloud-accent-soft)"
                        : "transparent",
                    }}
                    aria-label={volume > 0 ? "Silenciar" : "Activar volumen"}
                    aria-expanded={volumePopoverOpen}
                  >
                    {volume > 0 ? (
                      <Volume2 className="h-5 w-5" strokeWidth={1.8} />
                    ) : (
                      <VolumeX className="h-5 w-5" strokeWidth={1.8} />
                    )}
                  </button>
                  {volumePopoverOpen ? (
                    <div
                      ref={volumeContainerRef}
                      className={cn(
                        "absolute bottom-12 right-0 flex w-52 items-center gap-3 p-3",
                        isSimplyUI
                          ? "rounded-lg border border-white/10 bg-[#242424]"
                          : "rounded-2xl border border-white/18 bg-black/28 shadow-2xl backdrop-blur-2xl",
                      )}
                    >
                      <button
                        type="button"
                        onClick={handleVolumeToggle}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/88 transition hover:bg-white/12"
                        aria-label={
                          volume > 0 ? "Silenciar" : "Activar volumen"
                        }
                      >
                        {volume > 0 ? (
                          <Volume2 className="h-4 w-4" />
                        ) : (
                          <VolumeX className="h-4 w-4" />
                        )}
                      </button>
                      <div
                        ref={volumeTrackRef}
                        className="cloud-progress-track relative h-2 flex-1 cursor-pointer overflow-hidden rounded-full"
                        onMouseDown={handleVolumeDragStart}
                        onClick={handleVolumeClick}
                      >
                        <div
                          className="cloud-progress-fill absolute left-0 top-0 h-full rounded-full"
                          style={{ width: `${volumePercent}%` }}
                        />
                      </div>
                      <span className="w-7 text-right text-[10px] font-black text-white/62">
                        {Math.round(volumePercent)}
                      </span>
                    </div>
                  ) : null}
                </div>
                <button
                  onClick={onSidebarToggle}
                  className="transport-action-button w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-all hover:scale-105"
                  style={{
                    ...iconButtonStyle,
                    background: sidebarVisible
                      ? "var(--cloud-accent-soft)"
                      : "transparent",
                  }}
                  aria-label="Sidebar"
                  aria-pressed={sidebarVisible}
                >
                  <PanelLeft className="w-5 h-5" strokeWidth={1.8} />
                </button>
                <button
                  onClick={onQueueToggle}
                  className="transport-action-button w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-all hover:scale-105"
                  style={{
                    ...iconButtonStyle,
                    background: queueVisible
                      ? "var(--cloud-accent-soft)"
                      : "transparent",
                  }}
                  aria-label="Cola de reproduccion"
                  aria-pressed={queueVisible}
                >
                  <ListMusic className="w-5 h-5" strokeWidth={1.8} />
                </button>
                <button
                  onClick={onFullscreen}
                  className="transport-action-button w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/15 transition-all hover:scale-105"
                  style={iconButtonStyle}
                  aria-label="Pantalla completa"
                >
                  <Maximize2 className="w-5 h-5" strokeWidth={1.8} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes transport-title-marquee {
          0%, 14% { transform: translateX(0); }
          50%, 86% { transform: translateX(var(--title-marquee-distance)); }
          100% { transform: translateX(0); }
        }

        .animate-slide-up {
          animation: slide-up 400ms cubic-bezier(0.16, 1, 0.3, 1);
        }

        .transport-shell {
          container-type: inline-size;
        }

        .transport-main-grid {
          grid-template-columns:
            minmax(190px, 1fr)
            minmax(230px, 320px)
            minmax(132px, 1fr);
          gap: clamp(0.55rem, 1.2cqw, 1rem);
        }

        .transport-track-info {
          max-width: min(340px, 100%);
        }

        .transport-title-box {
          width: min(220px, 100%);
          max-width: min(34cqw, 220px);
        }

        .transport-center-controls {
          min-width: 220px;
        }

        .transport-progress-row {
          width: min(16rem, 100%);
          max-width: 28cqw;
        }

        .transport-actions {
          min-width: 132px;
        }

        .transport-title-text {
          display: block;
          will-change: transform;
        }

        .transport-title-marquee {
          animation: transport-title-marquee 8.5s ease-in-out infinite;
        }

        @container (max-width: 780px) {
          .transport-main-grid {
            grid-template-columns:
              minmax(150px, 1fr)
              minmax(180px, 236px)
              minmax(104px, 0.72fr);
            gap: 0.45rem;
          }

          .transport-cover {
            width: 3rem;
            height: 3rem;
            border-radius: 1rem;
          }

          .transport-title-box {
            max-width: min(30cqw, 178px);
          }

          .transport-center-controls {
            min-width: 180px;
          }

          .transport-control-row {
            gap: 0.35rem;
          }

          .transport-skip-button,
          .transport-action-button {
            width: 2.25rem;
            height: 2.25rem;
          }

          .transport-play-button {
            width: 2.9rem;
            height: 2.9rem;
          }

          .transport-progress-row {
            width: min(11.5rem, 100%);
            max-width: 26cqw;
          }

          .transport-actions {
            min-width: 104px;
            gap: 0.2rem;
          }
        }

        @container (max-width: 600px) {
          .transport-main-grid {
            grid-template-columns: minmax(132px, 1fr) minmax(162px, 190px) auto;
            padding-inline: 0.75rem;
          }

          .transport-title-box {
            max-width: 132px;
          }

          .transport-actions {
            min-width: 0;
          }

          .transport-action-button {
            width: 2rem;
            height: 2rem;
          }
        }
      `}</style>
    </div>
  );
}

function CastSettingsPopover({
  isSimplyUI,
  layout,
  lyricFormat,
  onLayoutChange,
  onLyricFormatChange,
}: {
  isSimplyUI: boolean;
  layout: CastLayout;
  lyricFormat: LyricsAnimationFormat;
  onLayoutChange: (layout: CastLayout) => void;
  onLyricFormatChange: (format: LyricsAnimationFormat) => void;
}) {
  const layoutOptions: Array<[CastLayout, string]> = [
    ["cover", "Sin letras"],
    ["linear", "Lineal"],
    ["split", "Dividido"],
  ];
  const lyricOptions: Array<[LyricsAnimationFormat, string]> = [
    ["line-words", "Word by word"],
    ["line", "Linea completa"],
    ["letters", "Palabra por palabra"],
  ];

  return (
    <div
      className={cn(
        "w-72 p-4 text-left",
        isSimplyUI
          ? "rounded-lg border border-white/10 bg-[#242424] shadow-xl"
          : "rounded-2xl border border-white/18 bg-black/30 shadow-2xl backdrop-blur-2xl",
      )}
    >
      <p className="text-xs font-black uppercase text-white/46">Organizacion</p>
      <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-white/7 p-1">
        {layoutOptions.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onLayoutChange(value)}
            className={cn(
              "min-h-10 rounded-lg px-2 text-[10px] font-black leading-tight text-white/54 transition",
              layout === value && "bg-white/16 text-white",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs font-black uppercase text-white/46">
        Animacion de letras
      </p>
      <div className="mt-2 grid gap-1">
        {lyricOptions.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onLyricFormatChange(value)}
            disabled={layout === "cover"}
            className={cn(
              "rounded-lg px-3 py-2 text-left text-xs font-bold text-white/58 transition hover:bg-white/10 hover:text-white",
              lyricFormat === value && "bg-white/14 text-white",
              layout === "cover" && "cursor-not-allowed opacity-36",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
