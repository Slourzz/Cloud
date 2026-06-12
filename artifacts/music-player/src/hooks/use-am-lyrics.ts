import { useCallback } from 'react';
import { useMusicPlayer } from '@/hooks/use-music-player';
import type { LyricLine as AMLLLyricLine } from '@applemusic-like-lyrics/core';

interface UseAmLyricsOptions {
  onLineClick?: (timestamp: number) => void;
}

/**
 * Hook para integrar am-lyrics con el music player
 * Proporciona manejadores de eventos y sincronización automática
 */
export function useAmLyrics(options?: UseAmLyricsOptions) {
  const { seek } = useMusicPlayer();

  const handleLineClick = useCallback(
    (timestamp: number) => {
      // Convertir de milisegundos a segundos
      const seconds = timestamp / 1000;
      seek(seconds);
      options?.onLineClick?.(seconds);
    },
    [seek, options]
  );

  /**
   * Convierte líneas de letras locales al formato AMLL Core
   * @param lines - Array de líneas locales con timing en segundos
   * @returns Array de LyricLine compatible con AMLL
   */
  const convertToAMLLFormat = useCallback(
    (lines: any[]): AMLLLyricLine[] => {
      return lines.map((line, i, arr) => {
        const hasWords = line.words && line.words.length > 0;
        
        return {
          words: hasWords
            ? line.words.map((w: any) => ({
                word: (w.text || w.word || '') + ' ',
                startTime: Math.round((w.begin || w.startTime || 0) * 1000),
                endTime: Math.round((w.end || w.endTime || 0) * 1000),
                romanWord: w.romanWord,
                ruby: w.ruby,
              }))
            : [
                {
                  word: (line.text || '') + ' ',
                  startTime: Math.round((line.begin || line.startTime || 0) * 1000),
                  endTime: Math.round(
                    (arr[i + 1]?.begin || arr[i + 1]?.startTime || line.end || line.endTime || 0) * 1000
                  ),
                },
              ],
          startTime: Math.round((line.begin || line.startTime || 0) * 1000),
          endTime: Math.round((line.end || line.endTime || 0) * 1000),
          translatedLyric: line.translatedLyric || line.translated || '',
          romanLyric: line.romanLyric || line.roman || '',
          isBG: line.isBG || line.isBackground || false,
          isDuet: line.isDuet || line.isDuet || false,
        };
      });
    },
    []
  );

  /**
   * Convierte desde formato parseado de AMLL Lyric (Rust/WASM)
   * @param parsedLines - Resultado de parseTtml, parseLrc, etc.
   * @returns Array de LyricLine compatible con AMLL React
   */
  const convertFromAMLLLyricParser = useCallback(
    (parsedLines: any[]): AMLLLyricLine[] => {
      return convertToAMLLFormat(parsedLines);
    },
    [convertToAMLLFormat]
  );

  return {
    handleLineClick,
    convertToAMLLFormat,
    convertFromAMLLLyricParser,
  };
}
