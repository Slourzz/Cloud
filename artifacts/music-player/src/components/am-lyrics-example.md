/**
 * Ejemplo de uso de am-lyrics en el music-player
 * 
 * Para usar am-lyrics en lugar del componente LyricsDisplay:
 * 
 * import { AmLyricsDisplay } from '@/components/am-lyrics-display';
 * import { useAmLyrics } from '@/hooks/use-am-lyrics';
 * 
 * export function MyLyricsComponent() {
 *   const { lyrics, isLoading } = useLyrics();
 *   const { currentSong, currentTime, isPaused, seek } = useMusicPlayer();
 *   const { handleLineClick } = useAmLyrics();
 * 
 *   if (isLoading) return <div>Loading lyrics...</div>;
 * 
 *   return (
 *     <AmLyricsDisplay
 *       lines={lyrics.lines}
 *       currentTime={currentTime}
 *       source={lyrics.source}
 *       isPaused={isPaused}
 *       songTitle={currentSong?.title}
 *       songArtist={currentSong?.artist}
 *       onLineClick={handleLineClick}
 *     />
 *   );
 * }
 * 
 * 
 * PROPIEDADES DE am-lyrics:
 * 
 * - songTitle: string - Título de la canción
 * - songArtist: string - Artista
 * - query: string - Query de búsqueda (ej: "Song Title Artist Name")
 * - currentTime: number - Tiempo actual en milisegundos
 * - autoScroll: boolean - Scroll automático (default: true)
 * - interpolate: boolean - Animación suave palabra por palabra (default: true)
 * - highlightColor: string - Color del highlight (default: "#000")
 * - hideSourceFooter: boolean - Ocultar footer de fuente (default: false)
 * 
 * PROVEEDORES DE LETRAS:
 * 
 * 1. LyricsPlus (por defecto) - Requiere songTitle y songArtist
 * 2. Apple Music (fallback) - Si LyricsPlus no tiene letras
 * 
 * EVENTOS:
 * 
 * - line-click: Se dispara cuando haces click en una línea
 *   event.detail.timestamp contiene el tiempo en milisegundos
 * 
 * ESTILOS CSS PERSONALIZABLES:
 * 
 * am-lyrics {
 *   --am-lyrics-highlight-color: #007aff;
 *   --am-lyrics-font-size: 1.5rem;
 *   font-family: 'SF Pro Display', sans-serif;
 * }
 */

export const AmLyricsExample = {};
