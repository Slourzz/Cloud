/**
 * AMLL Integration Examples for Music Player
 * 
 * Este archivo muestra cómo usar los diferentes componentes de AMLL
 * y am-lyrics en tu music-player
 */

// ============================================================================
// EJEMPLO 1: Usar AMLL React con letras locales
// ============================================================================

/**
 * Importar esto en tu componente de letras
 */
/*
import { LyricPlayer } from "@applemusic-like-lyrics/react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { useLyrics } from "@/hooks/use-lyrics";
import { useState, useEffect } from "react";
import type { LyricLine } from "@applemusic-like-lyrics/core";

export function AMLLLyricsPanel() {
  const { currentTime, isPaused } = useMusicPlayer();
  const { lines: localLines, source } = useLyrics();
  const [amllLines, setAmllLines] = useState<LyricLine[]>([]);

  // Convertir letras locales a formato AMLL
  useEffect(() => {
    if (source !== "ttml" || !localLines.length) {
      setAmllLines([]);
      return;
    }

    const converted = localLines.map((line, i, arr) => ({
      words: line.words?.length 
        ? line.words.map(w => ({
            word: w.text + " ",
            startTime: Math.round(w.begin * 1000),
            endTime: Math.round(w.end * 1000),
          }))
        : [{
            word: line.text + " ",
            startTime: Math.round(line.begin * 1000),
            endTime: Math.round((arr[i + 1]?.begin ?? line.end) * 1000),
          }],
      startTime: Math.round(line.begin * 1000),
      endTime: Math.round(line.end * 1000),
      translatedLyric: "",
      romanLyric: "",
      isBG: false,
      isDuet: false,
    }));

    setAmllLines(converted);
  }, [localLines, source]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <LyricPlayer
        lyricLines={amllLines}
        currentTime={Math.round(currentTime * 1000)}
        playing={!isPaused}
        style={{
          width: "100%",
          height: "100%",
          "--amll-lp-color": "#ffffff",
          "--amll-lp-bg-color": "rgba(0, 0, 0, 0.3)",
        } as React.CSSProperties}
      />
    </div>
  );
}
*/

// ============================================================================
// EJEMPLO 2: Parsear archivos TTML con AMLL Lyric
// ============================================================================

/**
 * Usar esto en tu hook use-lyrics.ts
 */
/*
import { parseTtml, parseLrc } from "@applemusic-like-lyrics/lyric";
import type { LyricLine } from "@applemusic-like-lyrics/core";

export function parseLyricsWithAMLL(content: string, format: "ttml" | "lrc"): LyricLine[] {
  let parsedLines: any[] = [];

  if (format === "ttml") {
    parsedLines = parseTtml(content);
  } else if (format === "lrc") {
    parsedLines = parseLrc(content);
  }

  // Convertir al formato esperado por AMLL
  return parsedLines.map((line, i, arr) => ({
    words: line.words.map((w: any) => ({
      word: w.word,
      startTime: w.startTime,
      endTime: w.endTime,
      romanWord: w.romanWord,
    })),
    startTime: line.startTime,
    endTime: line.endTime,
    translatedLyric: line.translatedLyric || "",
    romanLyric: line.romanLyric || "",
    isBG: line.isBG || false,
    isDuet: line.isDuet || false,
  }));
}
*/

// ============================================================================
// EJEMPLO 3: Usar am-lyrics con búsqueda automática
// ============================================================================

/**
 * Importar esto en tu componente de letras
 */
/*
import { AmLyrics } from "@uimaxbai/am-lyrics/react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { useCallback } from "react";

export function AmLyricsPanel() {
  const { currentSong, currentTime, isPaused, seek } = useMusicPlayer();

  const handleLineClick = useCallback((event: CustomEvent) => {
    const timestamp = event.detail?.timestamp;
    if (timestamp !== undefined) {
      seek(timestamp / 1000); // Convertir de ms a segundos
    }
  }, [seek]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <AmLyrics
        songTitle={currentSong?.title || "Unknown"}
        songArtist={currentSong?.artist || "Unknown"}
        query={`${currentSong?.title} ${currentSong?.artist}`}
        currentTime={Math.round(currentTime * 1000)}
        autoScroll={true}
        interpolate={true}
        highlightColor="rgba(255, 255, 255, 0.9)"
        onLineClick={handleLineClick}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
*/

// ============================================================================
// EJEMPLO 4: Componente Híbrido (AMLL + Fallback de Texto)
// ============================================================================

/**
 * El mejor de ambos mundos
 */
/*
import { LyricPlayer } from "@applemusic-like-lyrics/react";
import { AmLyrics } from "@uimaxbai/am-lyrics/react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { useLyrics } from "@/hooks/use-lyrics";
import { useState, useEffect } from "react";
import type { LyricLine } from "@applemusic-like-lyrics/core";

export function HybridLyricsPanel() {
  const { currentTime, isPaused, currentSong, seek } = useMusicPlayer();
  const { lines: localLines, source } = useLyrics();
  const [amllLines, setAmllLines] = useState<LyricLine[]>([]);
  const [useAmLyrics, setUseAmLyrics] = useState(false);

  // Convertir letras locales a formato AMLL
  useEffect(() => {
    if (source !== "ttml" || !localLines.length) {
      setAmllLines([]);
      setUseAmLyrics(false); // Fallback a am-lyrics
      return;
    }

    const converted = localLines.map((line, i, arr) => ({
      words: line.words?.length 
        ? line.words.map(w => ({
            word: w.text + " ",
            startTime: Math.round(w.begin * 1000),
            endTime: Math.round(w.end * 1000),
          }))
        : [{
            word: line.text + " ",
            startTime: Math.round(line.begin * 1000),
            endTime: Math.round((arr[i + 1]?.begin ?? line.end) * 1000),
          }],
      startTime: Math.round(line.begin * 1000),
      endTime: Math.round(line.end * 1000),
      translatedLyric: "",
      romanLyric: "",
      isBG: false,
      isDuet: false,
    }));

    setAmllLines(converted);
    setUseAmLyrics(true); // Letras locales disponibles
  }, [localLines, source]);

  // Si tenemos letras TTML locales, usar AMLL
  if (useAmLyrics && amllLines.length) {
    return (
      <div style={{ width: "100%", height: "100%" }}>
        <LyricPlayer
          lyricLines={amllLines}
          currentTime={Math.round(currentTime * 1000)}
          playing={!isPaused}
          style={{
            width: "100%",
            height: "100%",
            "--amll-lp-color": "#ffffff",
            "--amll-lp-bg-color": "rgba(0, 0, 0, 0.3)",
          } as React.CSSProperties}
        />
      </div>
    );
  }

  // Fallback: usar am-lyrics con búsqueda automática
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <AmLyrics
        songTitle={currentSong?.title || "Unknown"}
        songArtist={currentSong?.artist || "Unknown"}
        query={`${currentSong?.title} ${currentSong?.artist}`}
        currentTime={Math.round(currentTime * 1000)}
        autoScroll={true}
        interpolate={true}
        highlightColor="rgba(255, 255, 255, 0.9)"
        onLineClick={(e: CustomEvent) => {
          if (e.detail?.timestamp) {
            seek(e.detail.timestamp / 1000);
          }
        }}
      />
    </div>
  );
}
*/

// ============================================================================
// EJEMPLO 5: Toggle entre Componentes
// ============================================================================

/**
 * Permitir al usuario cambiar entre AMLL y am-lyrics
 */
/*
import { useState } from "react";
import AMLLLyricsPanel from "./AMLLLyricsPanel";
import AmLyricsPanel from "./AmLyricsPanel";

export function LyricsContainer() {
  const [useLyricProvider, setUseLyricProvider] = useState<"amll" | "am-lyrics">("amll");

  return (
    <div>
      <div className="flex gap-2 p-4">
        <button
          onClick={() => setUseLyricProvider("amll")}
          className={useLyricProvider === "amll" ? "active" : ""}
        >
          AMLL
        </button>
        <button
          onClick={() => setUseLyricProvider("am-lyrics")}
          className={useLyricProvider === "am-lyrics" ? "active" : ""}
        >
          am-lyrics (Auto-search)
        </button>
      </div>
      
      <div style={{ height: "calc(100% - 60px)" }}>
        {useLyricProvider === "amll" ? (
          <AMLLLyricsPanel />
        ) : (
          <AmLyricsPanel />
        )}
      </div>
    </div>
  );
}
*/

// ============================================================================
// ESTILOS CSS PERSONALIZABLES
// ============================================================================

/*
// En tu CSS global o componente
.amll-lyric-player {
  /* Color de letra activa */
  --amll-lp-color: #ffffff;
  
  /* Color de fondo */
  --amll-lp-bg-color: rgba(0, 0, 0, 0.3);
  
  /* Más variables personalizables según AMLL Core */
}

am-lyrics {
  /* Color de highlight de letras activas */
  --am-lyrics-highlight-color: rgba(255, 255, 255, 0.9);
}
*/

// ============================================================================
// DEPENDENCIAS INSTALADAS
// ============================================================================

/*
Ya están instaladas en tu proyecto:

✅ @applemusic-like-lyrics/core ^0.4.2
✅ @applemusic-like-lyrics/lyric ^1.0.0
✅ @applemusic-like-lyrics/react ^0.4.2
✅ @uimaxbai/am-lyrics ^1.4.1
✅ @lit/react ^1.0.8

Dependencias peer de AMLL:
✅ @pixi/app, @pixi/core, @pixi/display
✅ @pixi/filter-blur, @pixi/filter-bulge-pinch, @pixi/filter-color-matrix
✅ @pixi/sprite
✅ jss, jss-preset-default
*/

export const AmllExamples = {};
