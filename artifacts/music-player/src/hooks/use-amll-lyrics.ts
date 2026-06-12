import { useMemo } from "react";
import type { LyricLine as AMLLLyricLine } from "@applemusic-like-lyrics/core";
import { LyricLine } from "@/hooks/use-lyrics";

/**
 * Hook para convertir y optimizar líneas de letras al formato AMLL
 * @param lines - Líneas de letras en formato local
 * @param isEnabled - Si está habilitada la conversión
 * @returns Líneas convertidas al formato AMLL
 */
export function useAMLLLyrics(
  lines: LyricLine[],
  isEnabled: boolean = true
): AMLLLyricLine[] {
  return useMemo(() => {
    if (!isEnabled || !lines.length) return [];

    return lines.map((line) => {
      const hasWords = line.words && line.words.length > 0;

      return {
        words: hasWords
          ? line.words.map((w) => ({
              word: w.text + " ",
              startTime: Math.round(w.begin * 1000),
              endTime: Math.round(w.end * 1000),
            }))
          : [
              {
                word: line.text + " ",
                startTime: Math.round(line.begin * 1000),
                endTime: Math.round(line.end * 1000),
              },
            ],
        startTime: Math.round(line.begin * 1000),
        endTime: Math.round(line.end * 1000),
        translatedLyric: "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      };
    });
  }, [lines, isEnabled]);
}

/**
 * Valida si las líneas tienen tiempos de sincronización válidos
 */
export function hasValidTiming(
  lines: LyricLine[],
  source: "ttml" | "plain" | "auto" | null
): boolean {
  return (
    source === "ttml" &&
    lines.length > 0 &&
    lines.some((l) => typeof l.begin === "number" && l.begin > 0)
  );
}
