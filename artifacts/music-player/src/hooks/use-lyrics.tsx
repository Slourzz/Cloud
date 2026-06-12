import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface LyricWord {
  begin: number;
  end: number;
  text: string;
}

export interface LyricLine {
  id: string;
  begin: number;
  end: number;
  text: string;
  words?: LyricWord[];
}

export interface LyricsCredits {
  writers: string[];
  community: boolean;
  provider?: string;
  synchronizer?: {
    id?: string;
    name: string;
    avatarUrl?: string;
  };
}

export type LyricsSource = "ttml" | "plain" | "auto" | null;

interface LyricsState {
  lines: LyricLine[];
  source: LyricsSource;
  rawText: string;
  isLoading: boolean;
  error: string | null;
  cloudApproved: boolean;
  credits: LyricsCredits;
}

interface LyricsContextValue {
  lyricsMap: Map<string, LyricsState>;
  getLyrics: (songId: string) => LyricsState;
  loadTTML: (songId: string, content: string) => void;
  loadPlainText: (songId: string, text: string) => void;
  fetchAutoLyrics: (
    songId: string,
    artist: string,
    title: string,
    duration?: number,
  ) => Promise<void>;
  clearLyrics: (songId: string) => void;
}

const EMPTY_LYRICS: LyricsState = {
  lines: [],
  source: null,
  rawText: "",
  isLoading: false,
  error: null,
  cloudApproved: false,
  credits: {
    writers: [],
    community: false,
  },
};

const DEFAULT_REVIEW_ENDPOINT =
  "https://cloud-production-4b12.up.railway.app/api/ttml/review";

const LyricsContext = createContext<LyricsContextValue>({
  lyricsMap: new Map(),
  getLyrics: () => EMPTY_LYRICS,
  loadTTML: () => {},
  loadPlainText: () => {},
  fetchAutoLyrics: async () => {},
  clearLyrics: () => {},
});

function getApprovedTTMLEndpoint() {
  const reviewEndpoint =
    import.meta.env.VITE_TTML_REVIEW_ENDPOINT?.trim() ||
    DEFAULT_REVIEW_ENDPOINT;

  return reviewEndpoint.replace(/\/+$/, "").replace(/\/review$/, "/approved");
}

function parseTime(raw: string): number {
  if (!raw) return 0;

  const value = raw.trim();
  if (value.endsWith("s")) return parseFloat(value);

  const parts = value.split(":");
  if (parts.length === 3) {
    return (
      parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])
    );
  }

  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }

  return parseFloat(value);
}

function splitCreditNames(value: string) {
  return value
    .split(/\s*(?:,|;|&|\band\b|\by\b)\s*/i)
    .map((name) => name.trim())
    .filter(Boolean);
}

function readTTMLCredits(doc: Document): LyricsCredits {
  const metadata = [...doc.querySelectorAll("meta")];
  const findMetadata = (names: string[]) =>
    metadata.find((element) => {
      const name = (
        element.getAttribute("name") ||
        element.getAttribute("property") ||
        ""
      )
        .toLowerCase()
        .replace(/[^a-z]/g, "");
      return names.includes(name);
    });

  const writerMeta = findMetadata([
    "writer",
    "writers",
    "writtenby",
    "songwriter",
    "songwriters",
  ]);
  const providerMeta = findMetadata(["provider", "source"]);
  const writerValue =
    writerMeta?.getAttribute("content") || writerMeta?.textContent || "";
  const songwriterValues = [...doc.querySelectorAll("songwriter")]
    .map((element) => element.textContent?.trim() || "")
    .filter(Boolean);
  const providerValue =
    providerMeta?.getAttribute("content") || providerMeta?.textContent || "";

  return {
    writers:
      songwriterValues.length > 0
        ? [...new Set(songwriterValues)]
        : splitCreditNames(writerValue),
    community: false,
    provider: providerValue.trim() || undefined,
  };
}

function parseTTMLContent(content: string): {
  lines: LyricLine[];
  credits: LyricsCredits;
} {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/xml");
    if (doc.querySelector("parsererror")) {
      throw new Error("Invalid XML");
    }

    const lines: LyricLine[] = [];
    doc.querySelectorAll("p").forEach((paragraph, index) => {
      const begin = parseTime(paragraph.getAttribute("begin") || "0");
      const end = parseTime(paragraph.getAttribute("end") || "0");
      const spans = [...paragraph.querySelectorAll("span")].filter(
        (span) => !span.querySelector("span"),
      );
      const words: LyricWord[] = [];
      let text = "";

      if (spans.length > 0) {
        spans.forEach((span) => {
          const wordText = span.textContent?.replace(/\s+/g, " ").trim() || "";
          if (!wordText) return;

          text += `${text ? " " : ""}${wordText}`;
          words.push({
            begin: parseTime(
              span.getAttribute("begin") ||
                paragraph.getAttribute("begin") ||
                "0",
            ),
            end: parseTime(
              span.getAttribute("end") || paragraph.getAttribute("end") || "0",
            ),
            text: wordText,
          });
        });
      } else {
        text = paragraph.textContent?.replace(/\s+/g, " ").trim() || "";
      }

      if (text) {
        lines.push({
          id: `line-${index}`,
          begin,
          end,
          text,
          words: words.length > 0 ? words : undefined,
        });
      }
    });

    return {
      lines,
      credits: readTTMLCredits(doc),
    };
  } catch {
    return {
      lines: [],
      credits: {
        writers: [],
        community: false,
      },
    };
  }
}

function parsePlainText(text: string): LyricLine[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({
      id: `line-${index}`,
      begin: 0,
      end: 0,
      text: line,
    }));
}

async function fetchApprovedCloudTTML(
  artist: string,
  title: string,
  duration?: number,
): Promise<{
  ttmlContent: string;
  synchronizer?: LyricsCredits["synchronizer"];
} | null> {
  try {
    const params = new URLSearchParams({ artist, title });
    if (duration && Number.isFinite(duration)) {
      params.set("duration", String(duration));
    }

    const response = await fetch(
      `${getApprovedTTMLEndpoint()}?${params.toString()}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) return null;

    const data = (await response.json()) as {
      ttmlContent?: unknown;
      synchronizer?: {
        id?: unknown;
        name?: unknown;
        avatarUrl?: unknown;
      };
    };
    if (typeof data.ttmlContent !== "string" || !data.ttmlContent.trim()) {
      return null;
    }

    return {
      ttmlContent: data.ttmlContent,
      synchronizer:
        data.synchronizer && typeof data.synchronizer.name === "string"
          ? {
              id:
                typeof data.synchronizer.id === "string"
                  ? data.synchronizer.id
                  : undefined,
              name: data.synchronizer.name,
              avatarUrl:
                typeof data.synchronizer.avatarUrl === "string"
                  ? data.synchronizer.avatarUrl
                  : undefined,
            }
          : undefined,
    };
  } catch {
    return null;
  }
}

async function fetchLyricsOVH(
  artist: string,
  title: string,
): Promise<string | null> {
  try {
    const cleanArtist = artist
      .replace(/unknown artist/i, "")
      .replace(/[^\w\s]/g, "")
      .trim();
    const cleanTitle = title.replace(/[^\w\s]/g, "").trim();
    if (!cleanArtist || !cleanTitle) return null;

    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { lyrics?: unknown };
    return typeof data.lyrics === "string" && data.lyrics.length > 0
      ? data.lyrics
      : null;
  } catch {
    return null;
  }
}

export function LyricsProvider({ children }: { children: ReactNode }) {
  const [lyricsMap, setLyricsMap] = useState<Map<string, LyricsState>>(
    new Map(),
  );
  const lyricsMapRef = useRef(lyricsMap);
  lyricsMapRef.current = lyricsMap;

  const setLyricsForSong = useCallback((songId: string, state: LyricsState) => {
    setLyricsMap((previous) => new Map(previous).set(songId, state));
  }, []);

  const getLyrics = useCallback(
    (songId: string) => lyricsMap.get(songId) ?? EMPTY_LYRICS,
    [lyricsMap],
  );

  const loadTTML = useCallback(
    (songId: string, content: string) => {
      const parsed = parseTTMLContent(content);
      setLyricsForSong(songId, {
        lines: parsed.lines,
        source: "ttml",
        rawText: content,
        isLoading: false,
        error:
          parsed.lines.length === 0
            ? "No se pudieron leer las letras del archivo TTML"
            : null,
        cloudApproved: false,
        credits: parsed.credits,
      });
    },
    [setLyricsForSong],
  );

  const loadPlainText = useCallback(
    (songId: string, text: string) => {
      const lines = parsePlainText(text);
      setLyricsForSong(songId, {
        lines,
        source: "plain",
        rawText: text,
        isLoading: false,
        error: lines.length === 0 ? "Archivo de letras vacio" : null,
        cloudApproved: false,
        credits: {
          writers: [],
          community: false,
        },
      });
    },
    [setLyricsForSong],
  );

  const fetchAutoLyrics = useCallback(
    async (
      songId: string,
      artist: string,
      title: string,
      duration?: number,
    ) => {
      const existing = lyricsMapRef.current.get(songId);
      if (existing?.isLoading || existing?.cloudApproved) {
        return;
      }

      const preservesLocalLyrics =
        existing?.source === "ttml" || existing?.source === "plain";
      const hasAutomaticLyrics = existing?.source === "auto" && !existing.error;
      if (!hasAutomaticLyrics && !preservesLocalLyrics) {
        setLyricsForSong(songId, { ...EMPTY_LYRICS, isLoading: true });
      }

      const cloudLyrics = await fetchApprovedCloudTTML(artist, title, duration);
      if (cloudLyrics) {
        if (preservesLocalLyrics && existing) {
          setLyricsForSong(songId, {
            ...existing,
            cloudApproved: true,
          });
          return;
        }

        const parsed = parseTTMLContent(cloudLyrics.ttmlContent);
        if (parsed.lines.length > 0) {
          setLyricsForSong(songId, {
            lines: parsed.lines,
            source: "ttml",
            rawText: cloudLyrics.ttmlContent,
            isLoading: false,
            error: null,
            cloudApproved: true,
            credits: {
              ...parsed.credits,
              community: true,
              provider: parsed.credits.provider || "Comunidad de Cloud",
              synchronizer: cloudLyrics.synchronizer,
            },
          });
          return;
        }
      }

      if (hasAutomaticLyrics || preservesLocalLyrics) return;

      const text = await fetchLyricsOVH(artist, title);
      if (text) {
        setLyricsForSong(songId, {
          lines: parsePlainText(text),
          source: "auto",
          rawText: text,
          isLoading: false,
          error: null,
          cloudApproved: false,
          credits: {
            writers: [],
            community: false,
            provider: "lyrics.ovh",
          },
        });
        return;
      }

      setLyricsForSong(songId, {
        ...EMPTY_LYRICS,
        error: "No se encontraron letras en internet",
      });
    },
    [setLyricsForSong],
  );

  useEffect(() => {
    const handleApprovedTTML = (
      event: Event & {
        detail?: {
          songId?: string;
          artist?: string;
          title?: string;
          duration?: number;
        };
      },
    ) => {
      const detail = event.detail;
      if (!detail?.songId || !detail.artist || !detail.title) return;

      void fetchAutoLyrics(
        detail.songId,
        detail.artist,
        detail.title,
        detail.duration,
      );
    };

    window.addEventListener(
      "cloud:ttml-approved",
      handleApprovedTTML as EventListener,
    );
    return () => {
      window.removeEventListener(
        "cloud:ttml-approved",
        handleApprovedTTML as EventListener,
      );
    };
  }, [fetchAutoLyrics]);

  const clearLyrics = useCallback((songId: string) => {
    setLyricsMap((previous) => {
      const next = new Map(previous);
      next.delete(songId);
      return next;
    });
  }, []);

  return (
    <LyricsContext.Provider
      value={{
        lyricsMap,
        getLyrics,
        loadTTML,
        loadPlainText,
        fetchAutoLyrics,
        clearLyrics,
      }}
    >
      {children}
    </LyricsContext.Provider>
  );
}

export function useLyrics() {
  return useContext(LyricsContext);
}
