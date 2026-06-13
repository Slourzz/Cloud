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
import { dbGetSongById } from "@/hooks/use-song-db";
import {
  useAppearance,
  type LyricsAnimationFormat,
} from "@/providers/appearance-provider";
import { invoke } from "@tauri-apps/api/core";

export type CastLayout = "cover" | "linear" | "split";
export type CastLyricMode = "static" | LyricsAnimationFormat;
export type CastDevice = {
  id: string;
  name: string;
  model: string;
  address: string;
};
export type CastStatus =
  | "unavailable"
  | "ready"
  | "discovering"
  | "connecting"
  | "connected"
  | "error";

type CastContextValue = {
  status: CastStatus;
  message: string;
  devices: CastDevice[];
  native: boolean;
  layout: CastLayout;
  lyricFormat: CastLyricMode;
  discoverDevices: () => Promise<CastDevice[]>;
  connect: (device?: CastDevice) => Promise<void>;
  disconnect: () => Promise<void>;
  setLayout: (layout: CastLayout) => void;
  setLyricFormat: (format: CastLyricMode) => void;
  dismissMessage: () => void;
};

const CAST_NAMESPACE = "urn:x-cast:com.cloudapp.player";
const CAST_SCRIPT_URL =
  "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
const CAST_LAYOUT_KEY = "cloud.cast.layout";
const CAST_LYRICS_KEY = "cloud.cast.lyrics-format";
const CAST_LOAD_TIMEOUT_MS = 8_000;
const CAST_MESSAGE_CHUNK_SIZE = 12_000;
const RECEIVER_APPLICATION_ID =
  import.meta.env.VITE_GOOGLE_CAST_APP_ID?.trim() ?? "";
let castFrameworkPromise: Promise<void> | null = null;

function isTauriRuntime() {
  return Boolean((window as any).__TAURI_INTERNALS__);
}

const fallbackContext: CastContextValue = {
  status: "unavailable",
  message: "",
  devices: [],
  native: false,
  layout: "cover",
  lyricFormat: "line-words",
  discoverDevices: async () => [],
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
  if (castFrameworkPromise) return castFrameworkPromise;

  castFrameworkPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    const previousCallback = (window as any).__onGCastApiAvailable;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (error) {
        castFrameworkPromise = null;
        reject(error);
      } else {
        resolve();
      }
    };

    (window as any).__onGCastApiAvailable = (available: boolean) => {
      previousCallback?.(available);
      if (available && (window as any).cast?.framework) finish();
      else
        finish(
          new Error(
            "Google Cast no esta disponible en este navegador o WebView.",
          ),
        );
    };

    const timeout = window.setTimeout(() => {
      finish(
        new Error(
          "Google Cast no respondio. Comprueba que Cloud y el dispositivo Cast esten en la misma red.",
        ),
      );
    }, CAST_LOAD_TIMEOUT_MS);

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CAST_SCRIPT_URL}"]`,
    );
    if (existing) {
      existing.addEventListener(
        "error",
        () => finish(new Error("No se pudo cargar Google Cast.")),
        { once: true },
      );
      if ((window as any).cast?.framework) finish();
      return;
    }

    const script = document.createElement("script");
    script.src = CAST_SCRIPT_URL;
    script.async = true;
    script.onerror = () => finish(new Error("No se pudo cargar Google Cast."));
    document.head.appendChild(script);
  });

  return castFrameworkPromise;
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

type ReceiverLyricLine = {
  begin: number;
  end: number;
  text: string;
  words?: Array<{
    begin: number;
    end: number;
    text: string;
  }>;
};

function splitTextForCast(value: string) {
  if (!value) return [""];
  const chunks: string[] = [];
  for (
    let offset = 0;
    offset < value.length;
    offset += CAST_MESSAGE_CHUNK_SIZE
  ) {
    chunks.push(value.slice(offset, offset + CAST_MESSAGE_CHUNK_SIZE));
  }
  return chunks;
}

function groupLyricsForCast(lines: ReceiverLyricLine[]) {
  const groups: ReceiverLyricLine[][] = [];
  let current: ReceiverLyricLine[] = [];
  let currentSize = 0;

  lines.forEach((line) => {
    const lineSize = JSON.stringify(line).length;
    if (
      current.length > 0 &&
      currentSize + lineSize > CAST_MESSAGE_CHUNK_SIZE
    ) {
      groups.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(line);
    currentSize += lineSize;
  });

  if (current.length > 0) groups.push(current);
  return groups;
}

export function GoogleCastProvider({ children }: { children: ReactNode }) {
  const { currentSong, queue, progress, isPlaying, setRemotePlayback } =
    useMusicPlayer();
  const { getLyrics } = useLyrics();
  const { settings: appearance } = useAppearance();
  const [status, setStatus] = useState<CastStatus>("unavailable");
  const [message, setMessage] = useState("");
  const [devices, setDevices] = useState<CastDevice[]>([]);
  const native = isTauriRuntime();
  const [layout, setLayoutState] = useState<CastLayout>(() =>
    readStoredValue(CAST_LAYOUT_KEY, "cover"),
  );
  const [lyricFormat, setLyricFormatState] = useState<CastLyricMode>(() =>
    readStoredValue(CAST_LYRICS_KEY, "line-words"),
  );
  const coverCacheRef = useRef(new Map<string, string>());
  const preparedAudioRef = useRef<{
    songId: string;
    url: string;
    mime: string;
  } | null>(null);
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
    if (isTauriRuntime()) {
      await invoke("send_cast_message", { payload });
      return true;
    }
    const session = getCurrentCastSession();
    if (!session) return false;
    await session.sendMessage(CAST_NAMESPACE, payload);
    return true;
  }, []);

  const sendInitialState = useCallback(
    async (payload: unknown) => {
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          const sent = await sendMessage(payload);
          if (sent) return;
          lastError = new Error("La sesion Cast aun no esta disponible.");
        } catch (error) {
          lastError = error;
        }

        await new Promise((resolve) =>
          window.setTimeout(resolve, 450 + attempt * 350),
        );
      }
      throw lastError ?? new Error("La pantalla Cast no recibio la cancion.");
    },
    [sendMessage],
  );

  const configureCast = useCallback(async () => {
    if (!RECEIVER_APPLICATION_ID) {
      setStatus("unavailable");
      return false;
    }

    await loadCastFramework();
    const framework = (window as any).cast.framework;
    const context = framework.CastContext.getInstance();
    if (!context || typeof context.requestSession !== "function") {
      throw new Error(
        "Este motor web no ofrece el selector de dispositivos Google Cast.",
      );
    }
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
    if (native) {
      setStatus(RECEIVER_APPLICATION_ID ? "ready" : "unavailable");
      return;
    }

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
  }, [configureCast, native]);

  const discoverDevices = useCallback(async () => {
    if (!native) return [];
    setStatus("discovering");
    setMessage("");
    try {
      const found = await invoke<CastDevice[]>("discover_cast_devices", {
        timeoutMs: 4_000,
      });
      setDevices(found);
      setStatus("ready");
      if (found.length === 0) {
        setMessage(
          "No se encontraron dispositivos Cast. Confirma que la TV tenga Chromecast integrado y este en la misma red.",
        );
      }
      return found;
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : String(error || "No se pudo buscar dispositivos Cast.");
      setStatus("error");
      setMessage(text);
      return [];
    }
  }, [native]);

  const connect = useCallback(
    async (device?: CastDevice) => {
      setMessage("");
      if (!RECEIVER_APPLICATION_ID) {
        setStatus("unavailable");
        setMessage(
          "Google Cast aun no esta habilitado en esta compilacion de Cloud.",
        );
        return;
      }
      if (native) {
        let target = device;
        if (!target) {
          const found = await discoverDevices();
          if (found.length === 1) {
            target = found[0];
          } else {
            return;
          }
        }

        setStatus("connecting");
        try {
          await invoke("connect_cast_device", {
            address: target.address,
            appId: RECEIVER_APPLICATION_ID,
          });
          setStatus("connected");
          setMessage(`Transmitiendo en ${target.name}.`);
        } catch (error) {
          setStatus("error");
          setMessage(
            error instanceof Error
              ? error.message
              : String(error || "No se pudo conectar con la TV."),
          );
        }
        return;
      }
      try {
        const configured = await configureCast();
        if (!configured) return;
        setStatus("connecting");
        const context = getCastContext();
        if (!context || typeof context.requestSession !== "function") {
          throw new Error(
            "Este motor web no ofrece el selector de dispositivos Google Cast.",
          );
        }
        await context.requestSession();
        if (!getCurrentCastSession()) {
          throw new Error("No se selecciono ningun dispositivo Google Cast.");
        }
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
    },
    [configureCast, discoverDevices, native],
  );

  const disconnect = useCallback(async () => {
    try {
      if (native) {
        await invoke("disconnect_cast_device");
      } else {
        await getCurrentCastSession()?.endSession?.(true);
      }
    } finally {
      preparedAudioRef.current = null;
      setRemotePlayback(false);
      setStatus(RECEIVER_APPLICATION_ID ? "ready" : "unavailable");
      setMessage("");
    }
  }, [native, setRemotePlayback]);

  useEffect(() => {
    if (status !== "connected") setRemotePlayback(false);
    return () => setRemotePlayback(false);
  }, [status, setRemotePlayback]);

  const setLayout = useCallback((nextLayout: CastLayout) => {
    setLayoutState(nextLayout);
    window.localStorage.setItem(CAST_LAYOUT_KEY, nextLayout);
  }, []);

  const setLyricFormat = useCallback((format: CastLyricMode) => {
    setLyricFormatState(format);
    window.localStorage.setItem(CAST_LYRICS_KEY, format);
  }, []);

  const dismissMessage = useCallback(() => setMessage(""), []);

  useEffect(() => {
    if (status !== "connected" || !currentSong) return;
    const sequence = ++syncSequenceRef.current;

    const sync = async () => {
      const prepareAudio = async () => {
        if (!native) {
          return { songId: currentSong.id, url: "", mime: "audio/mpeg" };
        }
        if (preparedAudioRef.current?.songId === currentSong.id) {
          return preparedAudioRef.current;
        }

        const storedSong = await dbGetSongById(currentSong.id);
        let audioData = storedSong?.audioData;
        let audioMime = storedSong?.audioMime || "audio/mpeg";

        if (!audioData?.byteLength && currentSong.audioUrl) {
          const response = await fetch(currentSong.audioUrl);
          if (!response.ok) {
            throw new Error("No se pudo leer el audio local.");
          }
          audioData = await response.arrayBuffer();
          audioMime = response.headers.get("content-type") || audioMime;
        }

        if (!audioData?.byteLength) {
          throw new Error("No se encontro el audio guardado en la biblioteca.");
        }

        const audioUrl = await invoke<string>("prepare_cast_audio", audioData, {
          headers: {
            "x-cloud-audio-mime": audioMime,
          },
        });
        preparedAudioRef.current = {
          songId: currentSong.id,
          url: audioUrl,
          mime: audioMime,
        };
        return preparedAudioRef.current;
      };

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

      const receiverLyrics: ReceiverLyricLine[] = lyricsState.lines
        .slice(0, 500)
        .map((line) => ({
          begin: line.begin,
          end: line.end,
          text: line.text,
          words: line.words?.map((word) => ({
            begin: word.begin,
            end: word.end,
            text: word.text,
          })),
        }));

      await sendInitialState({
        type: "cloud-state",
        layout,
        lyricMotion: lyricFormat === "static" ? "static" : "animated",
        lyricFormat: lyricFormat === "static" ? "line" : lyricFormat,
        interfaceTheme: appearance.interfaceTheme,
        song: {
          id: currentSong.id,
          title: currentSong.title,
          artist: currentSong.artist,
          duration: currentSong.duration,
          cover: "",
          audioUrl: "",
        },
        nextSong: nextSong
          ? {
              id: nextSong.id,
              title: nextSong.title,
              artist: nextSong.artist,
              cover: "",
            }
          : null,
        lyrics: [],
        progress,
        isPlaying,
      });

      const sendCover = async (
        target: "current" | "next",
        songId: string,
        source: string,
      ) => {
        const chunks = splitTextForCast(source);
        for (let index = 0; index < chunks.length; index += 1) {
          await sendMessage({
            type: "cloud-cover",
            target,
            songId,
            reset: index === 0,
            final: index === chunks.length - 1,
            chunk: chunks[index],
          });
        }
      };

      await sendCover("current", currentSong.id, cover);
      if (nextSong) await sendCover("next", nextSong.id, nextCover);

      const lyricGroups = groupLyricsForCast(receiverLyrics);
      if (lyricGroups.length === 0) {
        await sendMessage({
          type: "cloud-lyrics",
          songId: currentSong.id,
          reset: true,
          final: true,
          lines: [],
        });
      } else {
        for (let index = 0; index < lyricGroups.length; index += 1) {
          await sendMessage({
            type: "cloud-lyrics",
            songId: currentSong.id,
            reset: index === 0,
            final: index === lyricGroups.length - 1,
            lines: lyricGroups[index],
          });
        }
      }

      if (sequence !== syncSequenceRef.current) return;

      try {
        const preparedAudio = await prepareAudio();
        if (sequence !== syncSequenceRef.current) return;
        await sendMessage({
          type: "cloud-audio",
          songId: currentSong.id,
          audioUrl: preparedAudio.url,
          audioMime: preparedAudio.mime,
          progress,
          isPlaying,
        });
        setRemotePlayback(true);
        setMessage("Transmitiendo en Google Cast.");
      } catch (error) {
        setRemotePlayback(false);
        const detail =
          error instanceof Error ? error.message : String(error || "");
        setMessage(
          detail
            ? `La TV recibio la cancion, pero Cloud no pudo enviar el audio: ${detail}`
            : "La TV recibio la cancion, pero el audio continuara en este equipo.",
        );
      }
    };

    sync().catch((error) => {
      setRemotePlayback(false);
      const detail =
        error instanceof Error ? error.message : String(error || "");
      setMessage(
        detail
          ? `Cloud no pudo reproducir el audio en la TV: ${detail}`
          : "Cloud no pudo reproducir el audio en la TV. El audio continuara en este equipo.",
      );
    });
  }, [
    status,
    currentSong?.id,
    currentSong?.title,
    currentSong?.artist,
    currentSong?.duration,
    currentSong?.coverUrl,
    currentSong?.customCoverUrl,
    currentSong?.audioUrl,
    queue,
    lyricsState.lines,
    layout,
    lyricFormat,
    appearance.interfaceTheme,
    native,
    sendMessage,
    sendInitialState,
    setRemotePlayback,
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
      devices,
      native,
      layout,
      lyricFormat,
      discoverDevices,
      connect,
      disconnect,
      setLayout,
      setLyricFormat,
      dismissMessage,
    }),
    [
      status,
      message,
      devices,
      native,
      layout,
      lyricFormat,
      discoverDevices,
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
