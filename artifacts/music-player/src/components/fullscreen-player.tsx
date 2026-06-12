import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMusicPlayer, type Song } from "@/hooks/use-music-player";
import { useLyrics } from "@/hooks/use-lyrics";
import { LyricsDisplay } from "@/components/lyrics-display";
import { Slider } from "@/components/ui/slider";
import { CloudDynamicBackground } from "@/components/CloudDynamicBackground";
import {
  FileText,
  LayoutGrid,
  Link2,
  Loader2,
  Mic2,
  Pause,
  Play,
  Repeat,
  Send,
  Shuffle,
  SkipBack,
  SkipForward,
  UploadCloud,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCloudNotifications } from "@/hooks/use-cloud-notifications";
import { useDiscordAuth } from "@/hooks/use-discord-auth";

interface FullscreenPlayerProps {
  open: boolean;
  onClose: () => void;
}

type FullscreenLayout = "lyrics" | "coverLyrics" | "player" | "spotify";

type PendingTTMLSubmission = {
  file: File;
  content: string;
};

type TTMLReviewResponse = {
  id: string;
  status: "pending" | "approved" | "rejected";
  title?: string;
  message?: string;
  detail?: string;
  author?: string;
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function nextLayout(
  current: FullscreenLayout,
  hasLyrics: boolean,
): FullscreenLayout {
  if (!hasLyrics) return current === "spotify" ? "player" : "spotify";
  if (current === "lyrics") return "coverLyrics";
  if (current === "coverLyrics") return "player";
  if (current === "player") return "spotify";
  return "lyrics";
}

function getTTMLReviewEndpoint() {
  return (
    import.meta.env.VITE_TTML_REVIEW_ENDPOINT?.trim() ||
    "https://cloud-production-4b12.up.railway.app/api/ttml/review"
  );
}

async function submitTTMLReview({
  file,
  content,
  song,
  discordToken,
}: {
  file: File;
  content: string;
  song: Song;
  discordToken: string;
}) {
  const endpoint = getTTMLReviewEndpoint();
  const formData = new FormData();

  formData.append("ttml", file);
  formData.append("ttmlContent", content);
  formData.append(
    "song",
    JSON.stringify({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      coverUrl: song.coverUrl,
      audioUrl: song.audioUrl,
      submittedAt: new Date().toISOString(),
    }),
  );

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${discordToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(
      result?.error || `TTML review request failed: ${response.status}`,
    );
  }

  return (await response.json()) as TTMLReviewResponse;
}

function CoverActionButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      title={title}
      className="flex h-14 w-14 items-center justify-center rounded-full border border-white/42 bg-white/10 text-white shadow-[0_14px_32px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-300 hover:bg-white hover:text-black active:scale-95"
    >
      {children}
    </button>
  );
}

function CoverArt({
  coverUrl,
  sizeClass,
  hoverClass,
  onLayout,
  onTTML,
  onLocalTTML,
  onPlain,
  onClose,
  canSubmitTTML,
  ttmlTitle,
  hoverPlayback,
}: {
  coverUrl: string;
  sizeClass: string;
  hoverClass?: string;
  onLayout: () => void;
  onTTML: () => void;
  onLocalTTML: () => void;
  onPlain: () => void;
  onClose: () => void;
  canSubmitTTML: boolean;
  ttmlTitle: string;
  hoverPlayback?: React.ReactNode;
}) {
  return (
    <div className={cn("group relative z-20", sizeClass, hoverClass)}>
      <div className="relative h-full w-full overflow-hidden rounded-md shadow-[0_28px_76px_rgba(0,0,0,0.34)] transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:shadow-[0_36px_96px_rgba(0,0,0,0.42)]">
        <img
          src={coverUrl}
          alt="cover"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-start justify-center bg-black/0 opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:bg-black/22 group-hover:opacity-100">
          <div className="fullscreen-cover-actions mt-5 flex max-w-full translate-y-2 flex-wrap items-center justify-center gap-3 px-4 opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-hover:opacity-100">
            <CoverActionButton onClick={onLayout} title="Cambiar organizacion">
              <LayoutGrid className="h-6 w-6" />
            </CoverActionButton>
            {canSubmitTTML ? (
              <CoverActionButton onClick={onTTML} title={ttmlTitle}>
                <UploadCloud className="h-6 w-6" />
              </CoverActionButton>
            ) : null}
            <CoverActionButton onClick={onLocalTTML} title="Subir TTML local">
              <Mic2 className="h-6 w-6" />
            </CoverActionButton>
            <CoverActionButton onClick={onPlain} title="Subir texto plano">
              <FileText className="h-6 w-6" />
            </CoverActionButton>
            <CoverActionButton onClick={onClose} title="Cerrar">
              <X className="h-6 w-6" />
            </CoverActionButton>
          </div>
        </div>
        {hoverPlayback ? (
          <div className="fullscreen-cover-playback absolute inset-x-4 bottom-4 translate-y-4 opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0 group-hover:opacity-100">
            {hoverPlayback}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FullscreenPlayer({ open, onClose }: FullscreenPlayerProps) {
  const {
    currentSong,
    isPlaying,
    progress,
    isShuffle,
    isShufflePlus,
    isRepeat,
    isRepeatOne,
    togglePlayPause,
    next,
    prev,
    seek,
    toggleShuffle,
    toggleRepeat,
  } = useMusicPlayer();
  const { getLyrics, loadTTML, loadPlainText, fetchAutoLyrics } = useLyrics();
  const shuffleModeIcon = (
    <span className="relative inline-flex">
      <Shuffle className="h-5 w-5" />
      {isShufflePlus ? (
        <span className="absolute -right-1.5 -top-1 text-[9px] font-black">
          +
        </span>
      ) : null}
    </span>
  );
  const repeatModeIcon = (
    <span className="relative inline-flex">
      <Repeat className="h-5 w-5" />
      {isRepeatOne ? (
        <span className="absolute -right-1.5 -top-1 text-[9px] font-black">
          1
        </span>
      ) : null}
    </span>
  );
  const { addNotification, trackReview } = useCloudNotifications();
  const {
    user: discordUser,
    token: discordToken,
    isConnecting: isConnectingDiscord,
    error: discordAuthError,
    login: loginWithDiscord,
    clearError: clearDiscordAuthError,
  } = useDiscordAuth();

  const [visible, setVisible] = useState(false);
  const [layout, setLayout] = useState<FullscreenLayout>("lyrics");
  const [pendingTTML, setPendingTTML] = useState<PendingTTMLSubmission | null>(
    null,
  );
  const [isSubmittingTTML, setIsSubmittingTTML] = useState(false);
  const [showDiscordConnect, setShowDiscordConnect] = useState(false);
  const ttmlInputRef = useRef<HTMLInputElement>(null);
  const localTtmlInputRef = useRef<HTMLInputElement>(null);
  const plainInputRef = useRef<HTMLInputElement>(null);
  const nativeFullscreenState = useRef({
    enteredByPlayer: false,
    wasMaximized: false,
  });

  const songId = currentSong?.id ?? "";
  const lyricsState = getLyrics(songId);
  const hasLyrics = lyricsState.lines.length > 0;
  const hasApprovedCloudTTML = lyricsState.cloudApproved;
  const coverUrl = currentSong?.coverUrl ?? "/album1.png";
  const duration = currentSong?.duration ?? 0;
  const displayCredits = useMemo(
    () => ({
      ...lyricsState.credits,
      writers:
        lyricsState.credits.writers.length > 0
          ? lyricsState.credits.writers
          : (currentSong?.artist ?? "")
              .split(/\s*(?:,|&|\bfeat\.?\b|\bft\.?\b)\s*/i)
              .map((artist) => artist.trim())
              .filter(Boolean),
    }),
    [lyricsState.credits, currentSong?.artist],
  );

  const effectiveLayout: FullscreenLayout = hasLyrics
    ? layout
    : layout === "spotify"
      ? "spotify"
      : "player";

  const rotateLayout = () =>
    setLayout((current) => nextLayout(current, hasLyrics));

  useEffect(() => {
    if (open) {
      setVisible(true);
      return;
    }

    const timer = setTimeout(() => setVisible(false), 450);
    return () => clearTimeout(timer);
  }, [open]);

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
    if (!open) return;

    let cancelled = false;

    const enterNativeFullscreen = async () => {
      try {
        const [{ getCurrentWindow }, { invoke }] = await Promise.all([
          import("@tauri-apps/api/window"),
          import("@tauri-apps/api/core"),
        ]);
        const win = getCurrentWindow();
        const alreadyFullscreen = await win.isFullscreen();
        if (alreadyFullscreen || cancelled) return;

        nativeFullscreenState.current.wasMaximized = await win.isMaximized();
        await invoke("enter_fullscreen");
        nativeFullscreenState.current.enteredByPlayer = true;
        window.dispatchEvent(new Event("resize"));
      } catch {
        // Browser preview: the player still fills the current viewport.
      }
    };

    void enterNativeFullscreen();

    return () => {
      cancelled = true;

      const restoreWindow = async () => {
        if (!nativeFullscreenState.current.enteredByPlayer) return;

        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          const win = getCurrentWindow();
          await win.setFullscreen(false);
          await new Promise((resolve) => setTimeout(resolve, 120));

          if (nativeFullscreenState.current.wasMaximized) {
            await win.maximize();
          }

          window.dispatchEvent(new Event("resize"));
        } catch {
          // Nothing to restore in the browser preview.
        } finally {
          nativeFullscreenState.current = {
            enteredByPlayer: false,
            wasMaximized: false,
          };
        }
      };

      void restoreWindow();
    };
  }, [open]);

  const handleTTMLFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !songId) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        setPendingTTML({ file, content });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const requestTTMLReviewUpload = async () => {
    if (!discordUser || !discordToken) {
      clearDiscordAuthError();
      setShowDiscordConnect(true);
      return;
    }

    ttmlInputRef.current?.click();
  };

  const connectDiscordAndContinue = async () => {
    try {
      const connectedUser = await loginWithDiscord();
      addNotification({
        type: "success",
        title: "Discord conectado",
        message: `Tus contribuciones se enviaran como ${connectedUser.displayName}.`,
        detail: "Cloud recordara este usuario en este dispositivo.",
        author: "Cloud",
      });
      setShowDiscordConnect(false);
      window.setTimeout(() => ttmlInputRef.current?.click(), 120);
    } catch {
      // The provider exposes the error directly in the connection dialog.
    }
  };

  const handleLocalTTMLFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !songId) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        loadTTML(songId, content);
        addNotification({
          type: "info",
          title: "TTML local cargado",
          message: currentSong
            ? `${currentSong.artist} - ${currentSong.title} ahora usa letras locales.`
            : "El TTML se cargo solo en tu app.",
          detail: "Este archivo no se envio a revision ni a Discord.",
          author: "Cloud",
        });
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const cancelTTMLReview = () => {
    setPendingTTML(null);
    setIsSubmittingTTML(false);
  };

  const confirmTTMLReview = async () => {
    if (
      !pendingTTML ||
      !currentSong ||
      !songId ||
      !discordToken ||
      !discordUser
    ) {
      return;
    }

    const submission = pendingTTML;
    const song = currentSong;
    setIsSubmittingTTML(true);
    setPendingTTML(null);

    try {
      const review = await submitTTMLReview({
        file: submission.file,
        content: submission.content,
        song,
        discordToken,
      });

      addNotification({
        type: "pending",
        title: "TTML enviado a revision",
        message: `${song.artist} - ${song.title} fue enviado al equipo de moderacion.`,
        detail: `Te avisaremos aqui cuando sea aprobado o necesite ajustes. Folio: ${review.id}`,
        author: "Cloud",
      });
      trackReview({
        id: review.id,
        songId: song.id,
        artist: song.artist,
        title: song.title,
        duration: song.duration,
      });
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "No fue posible contactar al servicio de revision.";
      addNotification({
        type: "warning",
        title: "No se pudo enviar el TTML",
        message: `${song.artist} - ${song.title} conserva sus letras anteriores.`,
        detail,
        author: "Cloud",
      });
    } finally {
      setIsSubmittingTTML(false);
    }
  };

  const handlePlainFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !songId) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) loadPlainText(songId, content);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  if (!visible) return null;

  const coverActions = (
    sizeClass: string,
    hoverClass?: string,
    hoverPlayback?: React.ReactNode,
  ) => (
    <CoverArt
      coverUrl={coverUrl}
      sizeClass={sizeClass}
      hoverClass={hoverClass}
      onLayout={rotateLayout}
      onTTML={() => void requestTTMLReviewUpload()}
      onLocalTTML={() => localTtmlInputRef.current?.click()}
      onPlain={() => plainInputRef.current?.click()}
      onClose={onClose}
      canSubmitTTML={!hasApprovedCloudTTML}
      ttmlTitle={
        discordUser
          ? `Subir TTML como ${discordUser.displayName}`
          : "Conectar Discord y subir TTML"
      }
      hoverPlayback={hoverPlayback}
    />
  );

  const hoverPlaybackControls = (
    <div className="w-full text-white drop-shadow-[0_10px_24px_rgba(0,0,0,0.36)]">
      <div className="mb-3 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleShuffle();
          }}
          title="Aleatorio"
          className={cn(
            "fullscreen-hover-control",
            isShuffle ? "opacity-100" : "opacity-[0.85]",
          )}
        >
          {shuffleModeIcon}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            prev();
          }}
          title="Anterior"
          className="fullscreen-hover-control"
        >
          <SkipBack className="h-6 w-6 fill-current" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            togglePlayPause();
          }}
          title={isPlaying ? "Pausar" : "Reproducir"}
          className="fullscreen-hover-play"
        >
          {isPlaying ? (
            <Pause className="h-8 w-8 fill-current" />
          ) : (
            <Play className="ml-0.5 h-8 w-8 fill-current" />
          )}
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            next();
          }}
          title="Siguiente"
          className="fullscreen-hover-control"
        >
          <SkipForward className="h-6 w-6 fill-current" />
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toggleRepeat();
          }}
          title="Repetir"
          className={cn(
            "fullscreen-hover-control",
            isRepeat ? "opacity-100" : "opacity-[0.85]",
          )}
        >
          {repeatModeIcon}
        </button>
      </div>
      <div className="flex items-center gap-2 text-[0.62rem] font-bold tabular-nums text-white/82">
        <span>{formatTime(progress)}</span>
        <Slider
          value={[progress]}
          max={duration || 1}
          step={1}
          onValueChange={(value) => seek(value[0])}
          className="fullscreen-white-slider group flex-1"
        />
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );

  const spotifyHoverControls = (
    <div className="flex items-center justify-center gap-2 text-white drop-shadow-[0_10px_24px_rgba(0,0,0,0.36)]">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          toggleShuffle();
        }}
        title="Aleatorio"
        className={cn(
          "fullscreen-spotify-control-button",
          isShuffle ? "opacity-100" : "opacity-[0.82]",
        )}
      >
        {shuffleModeIcon}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          prev();
        }}
        title="Anterior"
        className="fullscreen-spotify-control-button opacity-95"
      >
        <SkipBack className="h-6 w-6 fill-current" />
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          togglePlayPause();
        }}
        title={isPlaying ? "Pausar" : "Reproducir"}
        className="fullscreen-spotify-play-button"
      >
        {isPlaying ? (
          <Pause className="h-9 w-9 fill-current" />
        ) : (
          <Play className="ml-1 h-9 w-9 fill-current" />
        )}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          next();
        }}
        title="Siguiente"
        className="fullscreen-spotify-control-button opacity-95"
      >
        <SkipForward className="h-6 w-6 fill-current" />
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          toggleRepeat();
        }}
        title="Repetir"
        className={cn(
          "fullscreen-spotify-control-button",
          isRepeat ? "opacity-100" : "opacity-[0.82]",
        )}
      >
        {repeatModeIcon}
      </button>
    </div>
  );

  const playbackControls = (wide = false) => (
    <div
      className={cn(
        "flex w-full flex-col items-center",
        wide ? "max-w-[600px]" : "max-w-[560px]",
      )}
    >
      <div className="mb-8 flex items-center justify-center gap-7 text-white drop-shadow-[0_10px_24px_rgba(0,0,0,0.30)]">
        <button
          type="button"
          onClick={toggleShuffle}
          title="Aleatorio"
          className={cn(
            "fullscreen-control-button",
            isShuffle ? "opacity-100" : "opacity-[0.78] hover:opacity-100",
          )}
        >
          {shuffleModeIcon}
        </button>
        <button
          type="button"
          onClick={prev}
          title="Anterior"
          className="fullscreen-control-button opacity-95"
        >
          <SkipBack className="h-8 w-8 fill-current" />
        </button>
        <button
          type="button"
          onClick={togglePlayPause}
          title={isPlaying ? "Pausar" : "Reproducir"}
          className="fullscreen-play-button"
        >
          {isPlaying ? (
            <Pause className="h-12 w-12 fill-current" />
          ) : (
            <Play className="ml-1 h-12 w-12 fill-current" />
          )}
        </button>
        <button
          type="button"
          onClick={next}
          title="Siguiente"
          className="fullscreen-control-button opacity-95"
        >
          <SkipForward className="h-8 w-8 fill-current" />
        </button>
        <button
          type="button"
          onClick={toggleRepeat}
          title="Repetir"
          className={cn(
            "fullscreen-control-button",
            isRepeat ? "opacity-100" : "opacity-[0.78] hover:opacity-100",
          )}
        >
          {repeatModeIcon}
        </button>
      </div>

      <div className="flex w-full items-center gap-4">
        <span className="w-12 text-right text-lg font-bold tabular-nums text-white/76 drop-shadow">
          {formatTime(progress)}
        </span>
        <Slider
          value={[progress]}
          max={duration || 1}
          step={1}
          onValueChange={(value) => seek(value[0])}
          className="fullscreen-white-slider group flex-1"
        />
        <span className="w-12 text-lg font-bold tabular-nums text-white/76 drop-shadow">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );

  const lyricsContent = (
    <div className="h-full min-h-0 w-full overflow-hidden">
      {lyricsState.isLoading ? (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <Loader2 className="h-10 w-10 animate-spin text-white/70" />
          <p className="mt-4 text-lg font-semibold text-white/72">
            Cargando letras
          </p>
        </div>
      ) : hasLyrics ? (
        <LyricsDisplay
          lines={lyricsState.lines}
          currentTime={progress}
          source={lyricsState.source}
          isPaused={!isPlaying}
          credits={displayCredits}
        />
      ) : (
        <div className="h-full w-full" />
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex w-full flex-col overflow-hidden bg-[#09090a] text-white",
        "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
        open
          ? "translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-4 scale-[0.99] opacity-0",
      )}
      style={{ height: "100dvh", minHeight: "100dvh" }}
    >
      <div className="absolute inset-0 h-full w-full saturate-[1.35] brightness-[0.95] contrast-[1.05]">
        <CloudDynamicBackground />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_32%,rgba(255,255,255,0.055),transparent_30%),radial-gradient(circle_at_78%_14%,rgba(255,255,255,0.045),transparent_34%),linear-gradient(135deg,rgba(8,6,6,0.20),rgba(5,5,8,0.32))]" />

      <div
        key={effectiveLayout}
        className="fullscreen-layout-stage relative z-10 h-full min-h-0 w-full px-[9vw] pb-10 pt-16"
      >
        {effectiveLayout === "lyrics" ? (
          <div className="fullscreen-linear-shell relative h-full min-h-0 w-full">
            <div className="fullscreen-linear-header absolute left-[9vw] top-0 z-20 flex items-start gap-9">
              {coverActions(
                "fullscreen-linear-cover h-40 w-40",
                undefined,
                hoverPlaybackControls,
              )}
              <div className="fullscreen-linear-title min-w-0">
                <h1 className="fullscreen-linear-title-heading max-w-[560px] truncate font-black leading-tight text-white drop-shadow-lg">
                  {currentSong?.title ?? "-"}
                </h1>
                <p className="fullscreen-linear-title-artist mt-3 max-w-[560px] truncate font-semibold text-white/78 drop-shadow">
                  {currentSong?.artist}
                </p>
              </div>
            </div>
            <main className="fullscreen-lyrics-main absolute inset-x-[9vw] bottom-0 min-h-0">
              {lyricsContent}
            </main>
          </div>
        ) : effectiveLayout === "coverLyrics" ? (
          <div className="grid h-full min-h-0 grid-cols-[minmax(420px,0.92fr)_minmax(0,1.08fr)] gap-[5vw]">
            <section className="flex min-h-0 flex-col items-center justify-center pb-10">
              {coverActions(
                "aspect-square w-[min(620px,34vw)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                "hover:scale-[1.045]",
              )}
              <div className="mt-8 flex w-full justify-center">
                {playbackControls(true)}
              </div>
              <div className="mt-8 w-full max-w-[620px] text-center">
                <h1 className="truncate text-[2.55rem] font-black leading-tight text-white drop-shadow-lg">
                  {currentSong?.title ?? "-"}
                </h1>
                <p className="mt-3 truncate text-2xl font-semibold text-white/76 drop-shadow">
                  {currentSong?.artist}
                </p>
              </div>
            </section>
            <main className="fullscreen-lyrics-side min-h-0 py-[5vh]">
              {lyricsContent}
            </main>
          </div>
        ) : effectiveLayout === "spotify" ? (
          <div className="fullscreen-spotify-shell relative h-full min-h-0 w-full">
            <div className="fullscreen-spotify-now absolute bottom-[-1.5rem] left-[calc(-9vw+1.5rem)] z-20 flex items-end gap-5">
              <div className="fullscreen-spotify-cover-stack group/spotify relative pb-16">
                {coverActions(
                  "fullscreen-spotify-cover-art aspect-square w-[min(13.5rem,17vw)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                )}
                <div className="fullscreen-spotify-hover-controls absolute bottom-0 left-1/2 flex -translate-x-1/2 translate-y-3 items-center justify-center opacity-0 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/spotify:translate-y-0 group-hover/spotify:opacity-100">
                  {spotifyHoverControls}
                </div>
              </div>
              <div className="mb-16 min-w-0 pb-1">
                <h1 className="max-w-[34vw] truncate text-[clamp(2rem,2.7vw,3.2rem)] font-black leading-tight text-white drop-shadow-[0_14px_28px_rgba(0,0,0,0.36)]">
                  {currentSong?.title ?? "-"}
                </h1>
                <p className="mt-3 max-w-[34vw] truncate text-[clamp(1.15rem,1.35vw,1.55rem)] font-semibold text-white/76 drop-shadow">
                  {currentSong?.artist}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 w-full flex-col items-center justify-center pb-[6vh]">
            {coverActions(
              "aspect-square w-[min(620px,32vw)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
              "hover:scale-[1.045]",
            )}
            <div className="mt-8 flex w-full justify-center">
              {playbackControls(true)}
            </div>
            <div className="mt-8 w-full max-w-[620px] text-center">
              <h1 className="truncate text-[2.65rem] font-black leading-tight text-white drop-shadow-lg">
                {currentSong?.title ?? "-"}
              </h1>
              <p className="mt-3 truncate text-2xl font-semibold text-white/76 drop-shadow">
                {currentSong?.artist}
              </p>
            </div>
          </div>
        )}
      </div>

      {showDiscordConnect ? (
        <div className="fixed inset-0 z-[72] flex items-center justify-center bg-black/42 px-6 backdrop-blur-sm">
          <div className="ttml-review-dialog w-full max-w-md overflow-hidden rounded-[30px] p-6 text-white">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/14 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                <Link2 className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black leading-tight">
                  Vincula tu cuenta de Discord
                </h2>
                <p className="mt-2 text-sm font-medium leading-relaxed text-white/68">
                  Cloud usara tu nombre y avatar para identificar tus
                  contribuciones y recordar la cuenta en este dispositivo.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/12 bg-white/[0.055] px-4 py-3 text-sm font-semibold leading-relaxed text-white/65">
              Discord compartira tu identidad basica y, si aun no perteneces,
              podra unirte al servidor de Cloud. Cloud no recibe tu contrasena
              ni puede leer tus mensajes.
            </div>

            {discordAuthError ? (
              <div className="mt-3 rounded-2xl border border-red-200/18 bg-red-400/10 px-4 py-3 text-sm font-semibold leading-relaxed text-red-50/85">
                {discordAuthError}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDiscordConnect(false)}
                disabled={isConnectingDiscord}
                className="rounded-full px-5 py-2.5 text-sm font-black text-white/72 transition hover:bg-white/12 hover:text-white disabled:pointer-events-none disabled:opacity-50"
              >
                Ahora no
              </button>
              <button
                type="button"
                onClick={() => void connectDiscordAndContinue()}
                disabled={isConnectingDiscord}
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-black shadow-[0_14px_36px_rgba(0,0,0,0.26)] transition hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
              >
                {isConnectingDiscord ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                {isConnectingDiscord
                  ? "Esperando a Discord"
                  : "Continuar con Discord"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingTTML ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/42 px-6 backdrop-blur-sm">
          <div className="ttml-review-dialog w-full max-w-md overflow-hidden rounded-[30px] p-6 text-white">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black leading-tight">
                  Deseas enviar a revision tu TTML?
                </h2>
                <p className="mt-2 text-sm font-medium leading-relaxed text-white/68">
                  Cloud enviara el archivo junto con los datos de la cancion al
                  equipo de moderacion.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/12 bg-white/[0.055] px-4 py-3">
              <p className="truncate text-sm font-black text-white">
                {currentSong?.artist} - {currentSong?.title}
              </p>
              <p className="mt-1 truncate text-xs font-semibold text-white/52">
                {pendingTTML.file.name}
              </p>
              {discordUser ? (
                <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                  {discordUser.avatarUrl ? (
                    <img
                      src={discordUser.avatarUrl}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/12 text-xs font-black">
                      {discordUser.displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <p className="text-xs font-bold text-white/72">
                    Subir TTML como{" "}
                    <span className="text-white">
                      {discordUser.displayName}
                    </span>
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={cancelTTMLReview}
                disabled={isSubmittingTTML || isConnectingDiscord}
                className="rounded-full px-5 py-2.5 text-sm font-black text-white/72 transition hover:bg-white/12 hover:text-white disabled:pointer-events-none disabled:opacity-50"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmTTMLReview}
                disabled={
                  isSubmittingTTML ||
                  isConnectingDiscord ||
                  !discordUser ||
                  !discordToken
                }
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black text-black shadow-[0_14px_36px_rgba(0,0,0,0.26)] transition hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-60"
              >
                {isSubmittingTTML ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Si, enviar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={ttmlInputRef}
        type="file"
        accept=".ttml,.xml"
        className="hidden"
        onChange={handleTTMLFile}
      />
      <input
        ref={localTtmlInputRef}
        type="file"
        accept=".ttml,.xml"
        className="hidden"
        onChange={handleLocalTTMLFile}
      />
      <input
        ref={plainInputRef}
        type="file"
        accept=".txt"
        className="hidden"
        onChange={handlePlainFile}
      />

      <style>{`
        .fullscreen-layout-stage {
          animation: fullscreenLayoutBlend 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .ttml-review-dialog {
          background:
            linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.055)),
            rgba(18,18,22,0.62);
          border: 1px solid rgba(255,255,255,0.20);
          box-shadow:
            0 28px 90px rgba(0,0,0,0.36),
            inset 0 1px 0 rgba(255,255,255,0.28);
          backdrop-filter: blur(28px) saturate(1.35);
          -webkit-backdrop-filter: blur(28px) saturate(1.35);
          animation: ttml-review-dialog-in 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes ttml-review-dialog-in {
          from {
            opacity: 0;
            transform: translate3d(0, 14px, 0) scale(0.965);
            filter: blur(10px);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
            filter: blur(0);
          }
        }
        @keyframes fullscreenLayoutBlend {
          from {
            opacity: 0;
            transform: translate3d(0, 18px, 0) scale(0.985);
            filter: blur(18px);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
            filter: blur(0);
          }
        }
        .fullscreen-linear-cover {
          width: clamp(9.5rem, 8.4vw, 10rem);
          height: clamp(9.5rem, 8.4vw, 10rem);
          margin-left: 0;
          margin-top: 0;
          flex: 0 0 auto;
          transition:
            width 720ms cubic-bezier(0.16, 1, 0.3, 1),
            height 720ms cubic-bezier(0.16, 1, 0.3, 1),
            margin 720ms cubic-bezier(0.16, 1, 0.3, 1),
            transform 720ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fullscreen-linear-title {
          margin-top: clamp(2.4rem, 3.8vw, 4rem);
          transition:
            margin 720ms cubic-bezier(0.16, 1, 0.3, 1),
            transform 720ms cubic-bezier(0.16, 1, 0.3, 1),
            opacity 420ms ease;
        }
        .fullscreen-linear-title-heading {
          font-size: clamp(2.25rem, 2.25vw, 2.65rem);
        }
        .fullscreen-linear-title-artist {
          font-size: clamp(1.3rem, 1.45vw, 1.65rem);
        }
        .fullscreen-linear-shell .fullscreen-lyrics-main {
          top: clamp(11.5rem, 18vh, 14rem);
          transition:
            top 720ms cubic-bezier(0.16, 1, 0.3, 1),
            filter 520ms ease,
            opacity 520ms ease;
        }
        .fullscreen-linear-shell .sl-container {
          padding-inline: clamp(2.5rem, 4vw, 5rem) !important;
        }
        .fullscreen-linear-header:hover .fullscreen-linear-cover,
        .fullscreen-linear-shell:has(.fullscreen-linear-cover:hover) .fullscreen-linear-cover {
          width: clamp(22rem, 22vw, 26.2rem);
          height: clamp(22rem, 22vw, 26.2rem);
          margin-left: 0;
          margin-top: 0;
        }
        .fullscreen-linear-header:hover .fullscreen-linear-title,
        .fullscreen-linear-shell:has(.fullscreen-linear-cover:hover) .fullscreen-linear-title {
          margin-left: clamp(1.8rem, 2.5vw, 3.5rem);
          margin-top: clamp(17.5rem, 28vh, 20rem);
        }
        .fullscreen-linear-header:hover ~ .fullscreen-lyrics-main,
        .fullscreen-linear-shell:has(.fullscreen-linear-cover:hover) .fullscreen-lyrics-main {
          top: clamp(24rem, 37vh, 28rem);
        }
        .fullscreen-cover-actions,
        .fullscreen-cover-playback {
          transition-delay: 0ms;
        }
        .group:hover .fullscreen-cover-actions {
          transition-delay: 360ms;
        }
        .group:hover .fullscreen-cover-playback {
          transition-delay: 430ms;
        }
        .fullscreen-spotify-cover-stack:hover .fullscreen-spotify-cover-art {
          transform: translateY(-1.55rem) scale(1.025);
        }
        .fullscreen-spotify-control-button {
          display: flex;
          height: 2.25rem;
          width: 2.25rem;
          align-items: center;
          justify-content: center;
          color: white;
          background: transparent;
          border: 0;
          box-shadow: none;
          transition: transform 200ms ease, opacity 200ms ease, filter 200ms ease;
        }
        .fullscreen-spotify-control-button:hover {
          transform: scale(1.13);
          filter: drop-shadow(0 0 14px rgba(255,255,255,0.42));
        }
        .fullscreen-spotify-control-button:active {
          transform: scale(0.94);
        }
        .fullscreen-spotify-play-button {
          display: flex;
          height: 3rem;
          width: 3rem;
          align-items: center;
          justify-content: center;
          color: white;
          background: transparent;
          border: 0;
          box-shadow: none;
          transition: transform 220ms ease, filter 220ms ease, opacity 220ms ease;
        }
        .fullscreen-spotify-play-button:hover {
          transform: scale(1.08);
          filter: drop-shadow(0 0 18px rgba(255,255,255,0.46));
        }
        .fullscreen-spotify-play-button:active {
          transform: scale(0.94);
        }
        .fullscreen-control-button {
          display: flex;
          height: 2.75rem;
          width: 2.75rem;
          align-items: center;
          justify-content: center;
          color: white;
          background: transparent;
          border: 0;
          box-shadow: none;
          transition: transform 200ms ease, opacity 200ms ease, filter 200ms ease;
        }
        .fullscreen-control-button:hover {
          transform: scale(1.12);
          filter: drop-shadow(0 0 14px rgba(255,255,255,0.38));
        }
        .fullscreen-control-button:active {
          transform: scale(0.94);
        }
        .fullscreen-play-button {
          display: flex;
          height: 4.75rem;
          width: 4.75rem;
          align-items: center;
          justify-content: center;
          color: white;
          background: transparent;
          border: 0;
          box-shadow: none;
          transition: transform 220ms ease, filter 220ms ease, opacity 220ms ease;
        }
        .fullscreen-play-button:hover {
          transform: scale(1.08);
          filter: drop-shadow(0 0 18px rgba(255,255,255,0.42));
        }
        .fullscreen-play-button:active {
          transform: scale(0.94);
        }
        .fullscreen-hover-control {
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          background: transparent;
          border: 0;
          box-shadow: none;
          transition: transform 180ms ease, opacity 180ms ease, filter 180ms ease;
        }
        .fullscreen-hover-control:hover {
          transform: scale(1.14);
          filter: drop-shadow(0 0 12px rgba(255,255,255,0.4));
        }
        .fullscreen-hover-play {
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          background: transparent;
          border: 0;
          box-shadow: none;
          transition: transform 180ms ease, filter 180ms ease;
        }
        .fullscreen-hover-play:hover {
          transform: scale(1.08);
          filter: drop-shadow(0 0 14px rgba(255,255,255,0.42));
        }
        .fullscreen-white-slider [class*="bg-primary"] {
          background: rgba(255, 255, 255, 0.98) !important;
          border-color: rgba(255, 255, 255, 0.98) !important;
        }
        .fullscreen-white-slider [class*="bg-secondary-container"] {
          background: rgba(255, 255, 255, 0.26) !important;
        }
        .fullscreen-white-slider [role="slider"] {
          height: 1rem !important;
          width: 1rem !important;
          background: white !important;
          border-color: white !important;
          box-shadow: 0 8px 22px rgba(0,0,0,0.18) !important;
          opacity: 1 !important;
        }
        .fullscreen-lyrics-main .sl-container,
        .fullscreen-lyrics-side .sl-container {
          padding-inline: clamp(2.5rem, 4vw, 5rem) !important;
        }
        .fullscreen-lyrics-main .sl-scroll {
          padding-top: clamp(3rem, 7vh, 5rem) !important;
          padding-bottom: 38vh !important;
        }
        .fullscreen-lyrics-main .sl-line {
          --sl-size: clamp(2.65rem, 3.05vw, 4rem) !important;
          max-width: min(980px, 72vw);
          margin-block: clamp(0.12rem, 0.45vh, 0.5rem) !important;
          text-align: left;
        }
        .fullscreen-lyrics-main p:not(.sl-credit-line) {
          font-size: clamp(2.65rem, 3.05vw, 4rem) !important;
          line-height: 1.18 !important;
          font-weight: 800 !important;
          text-align: left !important;
        }
        .fullscreen-lyrics-side .sl-scroll {
          padding-top: clamp(2.75rem, 6vh, 4.5rem) !important;
          padding-bottom: 36vh !important;
        }
        .fullscreen-lyrics-side .sl-line {
          --sl-size: clamp(2.55rem, 3.25vw, 4.35rem) !important;
          max-width: min(760px, 46vw);
          margin-block: clamp(0.1rem, 0.38vh, 0.42rem) !important;
          text-align: left;
        }
        .fullscreen-lyrics-side p:not(.sl-credit-line) {
          font-size: clamp(2.55rem, 3.25vw, 4.35rem) !important;
          line-height: 1.2 !important;
          font-weight: 800 !important;
          text-align: left !important;
        }
      `}</style>
    </div>
  );
}
