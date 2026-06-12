# 📚 Resumen de Integración de AMLL

## ✅ Lo que se ha agregado a tu proyecto

### 📁 Archivos Creados

1. **`AMLL_DOCUMENTATION.md`** - Documentación completa de AMLL
   - Descripción de los 4 paquetes principales
   - Guías de instalación y uso
   - Modelo de datos
   - Casos de uso
   - Personalización de estilos

2. **`src/components/AMLL_INTEGRATION_EXAMPLES.tsx`** - Ejemplos de integración
   - 5 ejemplos prácticos listos para usar
   - Componentes híbridos
   - Toggle entre proveedores
   - Comentados para usar directamente

3. **`src/hooks/use-am-lyrics.ts`** - Hook mejorado con conversiones
   - `convertToAMLLFormat()` - Convierte letras locales a AMLL
   - `convertFromAMLLLyricParser()` - Convierte desde parser de WASM
   - `handleLineClick()` - Manejo de clicks con seek automático

### 📦 Dependencias Instaladas

```json
{
  "@applemusic-like-lyrics/core": "^0.4.2",
  "@applemusic-like-lyrics/lyric": "^1.0.0",
  "@applemusic-like-lyrics/react": "^0.4.2",
  "@uimaxbai/am-lyrics": "^1.4.1",
  "@lit/react": "^1.0.8"
}
```

---

## 🚀 Cómo usar

### Opción 1: Usar AMLL React (lo que ya tienes)

```tsx
import { LyricPlayer } from "@applemusic-like-lyrics/react";
import { useAmLyrics } from "@/hooks/use-am-lyrics";
import { useLyrics } from "@/hooks/use-lyrics";

export function LyricsView() {
  const { convertToAMLLFormat } = useAmLyrics();
  const { lines, source } = useLyrics();
  
  const amllLines = source === "ttml" ? convertToAMLLFormat(lines) : [];
  
  return (
    <LyricPlayer
      lyricLines={amllLines}
      currentTime={currentTime * 1000}
      playing={!isPaused}
    />
  );
}
```

### Opción 2: Usar am-lyrics con búsqueda automática

```tsx
import { AmLyricsDisplay } from "@/components/am-lyrics-display";
import { useAmLyrics } from "@/hooks/use-am-lyrics";

export function LyricsView() {
  const { handleLineClick } = useAmLyrics();
  const { currentSong, currentTime, isPaused } = useMusicPlayer();
  
  return (
    <AmLyricsDisplay
      lines={[]} // am-lyrics busca automáticamente
      currentTime={currentTime}
      source={null}
      isPaused={isPaused}
      songTitle={currentSong?.title}
      songArtist={currentSong?.artist}
      onLineClick={handleLineClick}
    />
  );
}
```

### Opción 3: Parsear archivos con AMLL Lyric

```tsx
import { parseTtml } from "@applemusic-like-lyrics/lyric";
import { useAmLyrics } from "@/hooks/use-am-lyrics";
import { LyricPlayer } from "@applemusic-like-lyrics/react";

export function LyricsView() {
  const { convertFromAMLLLyricParser } = useAmLyrics();
  const ttmlContent = "..."; // Tu contenido TTML
  
  const parsedLines = parseTtml(ttmlContent);
  const amllLines = convertFromAMLLLyricParser(parsedLines);
  
  return (
    <LyricPlayer
      lyricLines={amllLines}
      currentTime={currentTime * 1000}
      playing={!isPaused}
    />
  );
}
```

---

## 📊 Comparación Rápida

| Aspecto | AMLL React | am-lyrics |
|---------|-----------|-----------|
| **Búsqueda automática** | ❌ | ✅ |
| **Parseadores de letras** | ✅ (Rust/WASM) | ❌ |
| **React support** | ✅ Nativo | ✅ @lit/react |
| **Vue support** | ✅ | ❌ |
| **Personalización** | Muy completa | Buena |
| **Mejor para** | Letras locales/TTML | Búsqueda online |

---

## 🎨 Personalización

### Con AMLL React

```tsx
<LyricPlayer
  lyricLines={lines}
  currentTime={currentTime}
  style={{
    "--amll-lp-color": "#ffffff",
    "--amll-lp-bg-color": "rgba(0, 0, 0, 0.3)",
  } as React.CSSProperties}
/>
```

### Con am-lyrics

```tsx
<AmLyrics
  highlightColor="rgba(255, 255, 255, 0.9)"
  autoScroll={true}
  interpolate={true}
/>
```

---

## 📖 Recursos

- Documentación completa: `AMLL_DOCUMENTATION.md`
- Ejemplos de código: `src/components/AMLL_INTEGRATION_EXAMPLES.tsx`
- Hook de utilidades: `src/hooks/use-am-lyrics.ts`
- Componente am-lyrics: `src/components/am-lyrics-display.tsx`

---

## ✨ Próximos Pasos Recomendados

1. **Decidir qué usar:**
   - AMLL si tienes archivos TTML locales
   - am-lyrics si quieres búsqueda automática online

2. **Integrar en tu component principal:**
   - Actualizar `src/components/lyrics-display.tsx`
   - O crear nuevo componente especializado

3. **Personalizar estilos:**
   - Ajustar CSS variables según diseño
   - Probar en diferentes dispositivos

4. **Testear rendimiento:**
   - AMLL usa PixiJS (GPU acceleration)
   - am-lyrics es más ligero
   - Ambos soportan 60 FPS

---

## 🐛 Troubleshooting

### "Cannot find module '@applemusic-like-lyrics/core'"
```bash
pnpm install
```

### "LyricPlayer is not rendering"
- Asegúrate de pasar `lyricLines` correctamente
- Verifica que `currentTime` está en milisegundos
- Comprueba que los tiempos de las líneas son válidos

### "am-lyrics no encuentra letras"
- Verifica que `query` tiene el formato correcto
- Am-lyrics busca en LyricsPlus + Apple Music
- Algunos temas pueden no tener letras sincronizadas

---

## 📝 Notas

- AMLL es para renderizado frontend (mejor privacidad)
- am-lyrics usa APIs externas (mejor coverage de canciones)
- Ambos soportan sincronización palabra por palabra
- Puedes combinar ambos sistemas en tu app
