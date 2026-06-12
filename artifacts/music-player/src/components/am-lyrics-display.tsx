'use client';

import React, { useCallback, useRef, useEffect } from 'react';
import { AmLyrics } from '@uimaxbai/am-lyrics/react';
import { LyricLine } from '@/hooks/use-lyrics';

interface AmLyricsDisplayProps {
  lines: LyricLine[];
  currentTime: number;
  source: "ttml" | "plain" | "auto" | null;
  isPaused: boolean;
  songTitle?: string;
  songArtist?: string;
  onLineClick?: (timestamp: number) => void;
}

/**
 * Componente que integra am-lyrics Web Component con React
 * Muestra letras sincronizadas estilo Apple Music
 */
export function AmLyricsDisplay({
  lines,
  currentTime,
  source,
  isPaused,
  songTitle = 'Unknown',
  songArtist = 'Unknown',
  onLineClick,
}: AmLyricsDisplayProps) {
  const amLyricsRef = useRef<HTMLDivElement>(null);

  // Crear query para búsqueda de letras
  const query = songTitle && songArtist ? `${songTitle} ${songArtist}` : '';

  // Manejar clicks en líneas de letras
  const handleLineClick = useCallback((event: CustomEvent) => {
    const timestamp = event.detail?.timestamp;
    if (timestamp !== undefined && onLineClick) {
      onLineClick(timestamp / 1000); // Convertir de ms a segundos
    }
  }, [onLineClick]);

  useEffect(() => {
    if (!amLyricsRef.current) return;

    const amLyrics = amLyricsRef.current.querySelector('am-lyrics') as any;
    if (!amLyrics) return;

    // Suscribirse al evento de click en líneas
    amLyrics.addEventListener('line-click', handleLineClick);

    return () => {
      amLyrics.removeEventListener('line-click', handleLineClick);
    };
  }, [handleLineClick]);

  return (
    <div
      ref={amLyricsRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
      className="am-lyrics-container"
    >
      <AmLyrics
        songTitle={songTitle}
        songArtist={songArtist}
        query={query}
        currentTime={Math.round(currentTime * 1000)} // Convertir a milisegundos
        autoScroll={true}
        interpolate={true}
        highlightColor="rgba(255, 255, 255, 0.9)"
        style={{
          width: '100%',
          height: '100%',
          '--am-lyrics-highlight-color': 'rgba(255, 255, 255, 0.9)',
        } as React.CSSProperties}
      />
    </div>
  );
}
