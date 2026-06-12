import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLyrics } from "@/hooks/use-lyrics";
import { useMusicPlayer } from "@/hooks/use-music-player";
import {
  useAppearance,
  type LyricsAnimationFormat,
} from "@/providers/appearance-provider";

export type CastLayout = "cover" | "linear" | "split";
export type CastStatus =
  | "unavailable"
  | "ready"
  | "connecting"
  | "connected"
  | "error";

type CastContextValue = {
  status: CastStatus;
  message: string;
  layout: CastLayout;
  lyricFormat: LyricsAnimationFormat;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setLayout: (layout: CastLayout) => void;
  setLyricFormat: (format: LyricsAnimationFormat) => void;
  dismissMessage: () => void;
};

const CAST_NAMESPACE = "urn:x-cast:com.cloudapp.player";
const CAST_SCRIPT_URL =
  "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
const CAST_LAYOUT_KEY = "cloud.cast.layout";
const CAST_LYRICS_KEY = "cloud.cast.lyrics-format";
const RECEIVER_APPLICATION_ID =
  import.meta.env.VITE_GOOGLE_CAST_APP_ID?.trim() ?? "";

const fallbackContext: CastContextValue = {
  status: "unavailable",
  message: "",
  layout: "cover",
  lyricFormat: "line-words",
  connect: async () => {},
  disconnect: async () => {},
  setLayout: () => {},
  setLyricFormat: () => {},
  dismissMessage: () => {},
};

const GoogleCastContext = createContext<CastContextValue | null>(null);

function readStoredValue<T extends string>(key: string, fallback: T): T {
  try {
    return (window.localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

function getCastContext() {
  return (window as any).cast?.framework?.CastContext?.getInstance?.() ?? null;
}

function getCurrentCastSession() {
  return getCastContext()?.getCurrentSession?.() ?? null;
}

function loadCastFramework() {
  if ((window as any).cast?.framework) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CAST_SCRIPT_URL}"]`,
    );
    const previousCallback = (window as any).__onGCastApiAvailable;

    (window as any).__onGCastApiAvailable = (available: boolean) => {
      previousCallback?.(available);
      if (available) resolve();
      else reject(new Error("Google Cast no esta disponible."));
    };

    if (existing) {
      existing.addEventListener("error", () =>
        reject(new Error("No se pudo cargar Google Cast.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = CAST_SCRIPT_URL;
    script.async = true;
    script.onerror = () => reject(new Error("No se pudo cargar Google Cast."));
    document.head.appendChild(script);
  });
}

async function imageToReceiverSource(url?: string) {
  if (!url) return "";
  if (/^https:\/\//i.test(url) || url.startsWith("data:")) return url;

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const maxSize = 360;
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.68);
  } catch {
    return "";
  }
}

export function GoogleCastProvider({ children }: { children: ReactNode }) {
  const { currentSong, queue, progress, isPlaying } = useMusicPlayer();
  const { getLyrics } = useLyrics();
  const { settings: appearance } = useAppearance();
  const [status, setStatus] = useState<CastStatus>("unavailable");
  const [message, setMessage] = useState("");
  const [layout, setLayoutState] = useState<CastLayout>(() =>
    readStoredValue(CAST_LAYOUT_KEY, "cover"),
  );
  const [lyricFormat, setLyricFormatState] = useState<LyricsAnimationFormat>(
    () => readStoredValue(CAST_LYRICS_KEY, "line-words"),
  );
  const coverCacheRef = useRef(new Map<string, string>());
  const syncSequenceRef = useRef(0);
  const lyricsState = currentSong
    ? getLyrics(currentSong.id)
    : {
        lines: [],
        source: null,
        rawText: "",
        isLoading: false,
        error: null,
        cloudApproved: false,
        credits: { writers: [], community: false },
      };

  const sendMessage = useCallback(async (payload: unknown) => {
    const session = getCurrentCastSession();
    if (!session) return false;
    await session.sendMessage(CAST_NAMESPACE, payload);
    return true;
  }, []);

  const configureCast = useCallback(async () => {
    if (!RECEIVER_APPLICATION_ID) {
      setStatus("unavailable");
      return false;
    }

    await loadCastFramework();
    const framework = (window as any).cast.framework;
    const context = framework.CastContext.getInstance();
    context.setOptions({
      receiverApplicationId: RECEIVER_APPLICATION_ID,
      autoJoinPolicy:
        (window as any).chrome?.cast?.AutoJoinPolicy?.ORIGIN_SCOPED ??
        "origin_scoped",
      resumeSavedSession: true,
    });

    if (context.getCurrentSession?.()) {
      setStatus("connected");
      setMessage("Transmitiendo en Google Cast.");
    } else {
      setStatus("ready");
      setMessage("");
    }

    return true;
  }, []);

  useEffect(() => {
    let disposed = false;
    let context: any = null;
    let eventType: string | null = null;
    let onSessionStateChanged: ((event: any) => void) | null = null;

    configureCast()
      .then((configured) => {
        if (!configured || disposed) return;
        const framework = (window as any).cast.framework;
        context = framework.CastContext.getInstance();
        eventType = framework.CastContextEventType.SESSION_STATE_CHANGED;
        onSessionStateChanged = (event: any) => {
          const state = String(event.sessionState ?? "");
          if (state.includes("STARTING")) setStatus("connecting");
          if (state.includes("STARTED") || state.includes("RESUMED")) {
            setStatus("connected");
            setMessage("Transmitiendo en Google Cast.");
          }
          if (state.includes("ENDED")) {
            setStatus("ready");
            setMessage("");
          }
          if (state.includes("FAILED")) {
            setStatus("error");
            setMessage("No se pudo iniciar Google Cast.");
          }
        };

        context.addEventListener(eventType, onSessionStateChanged);
      })
      .catch(() => {
        if (!disposed) {
          setStatus("unavailable");
        }
      });

    return () => {
      disposed = true;
      if (context && eventType && onSessionStateChanged) {
        context.removeEventListener(eventType, onSessionStateChanged);
      }
    };
  }, [configureCast]);

  const connect = useCallback(async () => {
    setMessage("");
    if (!RECEIVER_APPLICATION_ID) {
      setStatus("unavailable");
      setMessage(
        "Google Cast aun no esta habilitado en esta compilacion de Cloud.",
      );
      return;
    }
    try {
      const configured = await configureCast();
      if (!configured) return;
      setStatus("connecting");
      await getCastContext()?.requestSession?.();
      setStatus("connected");
      setMessage("Transmitiendo en Google Cast.");
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "No se pudo conectar.";
      if (!text.toLowerCase().includes("cancel")) {
        setStatus("error");
        setMessage(text);
      } else {
        setStatus("ready");
      }
    }
  }, [configureCast]);

  const disconnect = useCallback(async () => {
    try {
      await getCurrentCastSession()?.endSession?.(true);
    } finally {
      setStatus(RECEIVER_APPLICATION_ID ? "ready" : "unavailable");
      setMessage("");
    }
  }, []);

  const setLayout = useCallback((nextLayout: CastLayout) => {
    setLayoutState(nextLayout);
    window.localStorage.setItem(CAST_LAYOUT_KEY, nextLayout);
  }, []);

  const setLyricFormat = useCallback((format: LyricsAnimationFormat) => {
    setLyricFormatState(format);
    window.localStorage.setItem(CAST_LYRICS_KEY, format);
  }, []);

  const dismissMessage = useCallback(() => setMessage(""), []);

  useEffect(() => {
    if (status !== "connected" || !currentSong) return;
    const sequence = ++syncSequenceRef.current;

    const sync = async () => {
      const cachedCover = coverCacheRef.current.get(currentSong.id);
      const cover =
        cachedCover ??
        (await imageToReceiverSource(
          currentSong.customCoverUrl || currentSong.coverUrl,
        ));
      if (sequence !== syncSequenceRef.current) return;
      if (cover) coverCacheRef.current.set(currentSong.id, cover);

      const nextSong = queue[0];
      const cachedNextCover = nextSong
        ? coverCacheRef.current.get(nextSong.id)
        : "";
      const nextCover =
        cachedNextCover ??
        (await imageToReceiverSource(
          nextSong?.customCoverUrl || nextSong?.coverUrl,
        ));
      if (sequence !== syncSequenceRef.current) return;
      if (nextSong && nextCover) {
        coverCacheRef.current.set(nextSong.id, nextCover);
      }

      await sendMessage({
        type: "cloud-state",
        layout,
        lyricFormat,
        interfaceTheme: appearance.interfaceTheme,
        song: {
          id: currentSong.id,
          title: currentSong.title,
          artist: currentSong.artist,
          duration: currentSong.duration,
          cover,
        },
        nextSong: nextSong
          ? {
              id: nextSong.id,
              title: nextSong.title,
              artist: nextSong.artist,
              cover: nextCover,
            }
          : null,
        lyrics: lyricsState.lines.slice(0, 500).map((line) => ({
          begin: line.begin,
          end: line.end,
          text: line.text,
          words: line.words?.map((word) => ({
            begin: word.begin,
            end: word.end,
            text: word.text,
          })),
        })),
      });
    };

    sync().catch(() => {
      setMessage("La pantalla Cast dejo de responder.");
    });
  }, [
    status,
    currentSong?.id,
    currentSong?.title,
    currentSong?.artist,
    currentSong?.duration,
    currentSong?.coverUrl,
    currentSong?.customCoverUrl,
    queue,
    lyricsState.lines,
    layout,
    lyricFormat,
    appearance.interfaceTheme,
    sendMessage,
  ]);

  useEffect(() => {
    if (status !== "connected" || !currentSong) return;
    sendMessage({
      type: "cloud-progress",
      progress,
      duration: currentSong.duration,
      isPlaying,
    }).catch(() => {});
  }, [
    status,
    progress,
    isPlaying,
    currentSong?.id,
    currentSong?.duration,
    sendMessage,
  ]);

  const value = useMemo<CastContextValue>(
    () => ({
      status,
      message,
      layout,
      lyricFormat,
      connect,
      disconnect,
      setLayout,
      setLyricFormat,
      dismissMessage,
    }),
    [
      status,
      message,
      layout,
      lyricFormat,
      connect,
      disconnect,
      setLayout,
      setLyricFormat,
      dismissMessage,
    ],
  );

  return (
    <GoogleCastContext.Provider value={value}>
      {children}
    </GoogleCastContext.Provider>
  );
}

export function useGoogleCast() {
  return useContext(GoogleCastContext) ?? fallbackContext;
}
