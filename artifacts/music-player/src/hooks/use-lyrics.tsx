import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

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

export type LyricsSource = "ttml" | "plain" | "auto" | null;

interface LyricsState {
  lines: LyricLine[];
  source: LyricsSource;
  rawText: string;
  isLoading: boolean;
  error: string | null;
}

interface LyricsContextValue {
  lyricsMap: Map<string, LyricsState>;
  getLyrics: (songId: string) => LyricsState;
  loadTTML: (songId: string, content: string) => void;
  loadPlainText: (songId: string, text: string) => void;
  fetchAutoLyrics: (songId: string, artist: string, title: string) => Promise<void>;
  clearLyrics: (songId: string) => void;
}

const EMPTY_LYRICS: LyricsState = { lines: [], source: null, rawText: "", isLoading: false, error: null };

const LyricsContext = createContext<LyricsContextValue>({
  lyricsMap: new Map(),
  getLyrics: () => EMPTY_LYRICS,
  loadTTML: () => {},
  loadPlainText: () => {},
  fetchAutoLyrics: async () => {},
  clearLyrics: () => {},
});

function parseTime(raw: string): number {
  if (!raw) return 0;
  raw = raw.trim();
  if (raw.endsWith("s")) return parseFloat(raw);
  const parts = raw.split(":");
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(raw);
}

function parseTTMLContent(content: string): LyricLine[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/xml");
    const parserError = doc.querySelector("parsererror");
    if (parserError) throw new Error("Invalid XML");

    const paragraphs = doc.querySelectorAll("p");
    const lines: LyricLine[] = [];

    paragraphs.forEach((p, i) => {
      const begin = parseTime(p.getAttribute("begin") || "0");
      const end = parseTime(p.getAttribute("end") || "0");
      const spans = p.querySelectorAll("span");

      let text = "";
      const words: LyricWord[] = [];

      if (spans.length > 0) {
        spans.forEach((span) => {
          const wBegin = parseTime(span.getAttribute("begin") || p.getAttribute("begin") || "0");
          const wEnd = parseTime(span.getAttribute("end") || p.getAttribute("end") || "0");
          const wText = span.textContent?.replace(/\s+/g, " ").trim() || "";
          if (wText) {
            text += (text ? " " : "") + wText;
            words.push({ begin: wBegin, end: wEnd, text: wText });
          }
        });
      } else {
        text = p.textContent?.replace(/\s+/g, " ").trim() || "";
      }

      if (text) {
        lines.push({
          id: `line-${i}`,
          begin,
          end,
          text,
          words: words.length > 0 ? words : undefined,
        });
      }
    });

    return lines;
  } catch {
    return [];
  }
}

function parsePlainText(text: string): LyricLine[] {
  const rawLines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  return rawLines.map((line, i) => ({
    id: `line-${i}`,
    begin: 0,
    end: 0,
    text: line,
  }));
}

async function fetchLyricsOVH(artist: string, title: string): Promise<string | null> {
  try {
    const cleanArtist = artist.replace(/unknown artist/i, "").replace(/[^\w\s]/g, "").trim();
    const cleanTitle = title.replace(/[^\w\s]/g, "").trim();
    if (!cleanArtist || !cleanTitle) return null;

    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.lyrics === "string" && data.lyrics.length > 0 ? data.lyrics : null;
  } catch {
    return null;
  }
}

export function LyricsProvider({ children }: { children: ReactNode }) {
  const [lyricsMap, setLyricsMap] = useState<Map<string, LyricsState>>(new Map());

  const setLyricsForSong = useCallback((songId: string, state: LyricsState) => {
    setLyricsMap((prev) => new Map(prev).set(songId, state));
  }, []);

  const getLyrics = useCallback(
    (songId: string) => lyricsMap.get(songId) ?? EMPTY_LYRICS,
    [lyricsMap]
  );

  const loadTTML = useCallback(
    (songId: string, content: string) => {
      const lines = parseTTMLContent(content);
      setLyricsForSong(songId, {
        lines,
        source: "ttml",
        rawText: content,
        isLoading: false,
        error: lines.length === 0 ? "No se pudieron leer las letras del archivo TTML" : null,
      });
    },
    [setLyricsForSong]
  );

  const loadPlainText = useCallback(
    (songId: string, text: string) => {
      const lines = parsePlainText(text);
      setLyricsForSong(songId, {
        lines,
        source: "plain",
        rawText: text,
        isLoading: false,
        error: lines.length === 0 ? "Archivo de letras vacío" : null,
      });
    },
    [setLyricsForSong]
  );

  const fetchAutoLyrics = useCallback(
    async (songId: string, artist: string, title: string) => {
      const existing = lyricsMap.get(songId);
      if (existing && existing.source !== null && !existing.error) return;

      setLyricsForSong(songId, { ...EMPTY_LYRICS, isLoading: true });
      const text = await fetchLyricsOVH(artist, title);
      if (text) {
        const lines = parsePlainText(text);
        setLyricsForSong(songId, { lines, source: "auto", rawText: text, isLoading: false, error: null });
      } else {
        setLyricsForSong(songId, { ...EMPTY_LYRICS, error: "No se encontraron letras en internet" });
      }
    },
    [lyricsMap, setLyricsForSong]
  );

  const clearLyrics = useCallback(
    (songId: string) => {
      setLyricsMap((prev) => {
        const next = new Map(prev);
        next.delete(songId);
        return next;
      });
    },
    []
  );

  return (
    <LyricsContext.Provider value={{ lyricsMap, getLyrics, loadTTML, loadPlainText, fetchAutoLyrics, clearLyrics }}>
      {children}
    </LyricsContext.Provider>
  );
}

export function useLyrics() {
  return useContext(LyricsContext);
}
