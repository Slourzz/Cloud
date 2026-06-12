# AMLL (Apple Music-like Lyrics) - Documentación Completa

## Descripción General

AMLL es una librería de componentes para mostrar letras sincronizadas estilo Apple Music. Incluye binding para React y Vue, además de un módulo de parsing de letras.

**NOTA**: Este es un proyecto en desarrollo. No usar directamente en producción.

---

## 📦 Paquetes Disponibles

### 1. AMLL Core (`@applemusic-like-lyrics/core`)

**Componente base de JS puro para letras y fondos dinámicos.**

#### Características
- Renderizado puro en frontend
- Letras sincronizadas a nivel de palabra
- Soporte para traducción y romanización
- Líneas múltiples, duetos, líneas de fondo
- Personalización vía CSS variables
- Fondos dinámicos con PixiJS

#### Instalación
```bash
npm install @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite
npm install @applemusic-like-lyrics/core
```

#### Uso Básico
```javascript
import { LyricPlayer } from "@applemusic-like-lyrics/core";
import "@applemusic-like-lyrics/core/style.css";

const player = new LyricPlayer();
document.body.appendChild(player.getElement());
player.setLyricLines([]); // Agregar letras
player.setCurrentTime(0); // Actualizar cada frame
player.update(0); // Actualizar animación cada frame
```

#### Modelo de Datos - LyricLine
```typescript
interface LyricLine {
  words: Array<{
    word: string;
    startTime: number; // ms
    endTime: number; // ms
    romanWord?: string;
    ruby?: string;
    obscene?: boolean;
  }>;
  translatedLyric: string;
  romanLyric: string;
  startTime: number; // ms
  endTime: number; // ms
  isBG: boolean; // Vocalización de fondo
  isDuet: boolean; // Dueto
}
```

#### Estilos Personalizables
```css
.amll-lyric-player {
  --amll-lp-color: #ffffff;
  --amll-lp-bg-color: rgba(0, 0, 0, 0.35);
  /* Más variables disponibles en style.css */
}
```

---

### 2. AMLL React (`@applemusic-like-lyrics/react`)

**Binding de React para usar AMLL como componente nativo.**

#### Instalación
```bash
npm install @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite jss jss-preset-default
npm install react react-dom
npm install @applemusic-like-lyrics/react
```

#### Uso Básico
```typescript
import { LyricPlayer } from "@applemusic-like-lyrics/react";
import { useState } from "react";

export default function App() {
  const [currentTime, setCurrentTime] = useState(0);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);

  return (
    <LyricPlayer 
      lyricLines={lyricLines} 
      currentTime={currentTime}
    />
  );
}
```

#### Props Disponibles
- `lyricLines`: `LyricLine[]` - Array de líneas de letras
- `currentTime`: `number` - Tiempo actual en milisegundos
- `playing`: `boolean` (opcional) - Estado de reproducción
- `style`: `CSSProperties` (opcional) - Estilos inline

---

### 3. AMLL Lyric (`@applemusic-like-lyrics/lyric`)

**Módulo de parsing/generación de letras escrito en Rust (compilado a WASM).**

#### Formatos Soportados
- ✅ **LyRiC Format** (.lrc) - Lee/escribe, con word timing
- ✅ **ESLyric Word-by-word Format** (.lrc)
- ✅ **NetEase Cloud Music YRC** (.yrc)
- ✅ **QQ Music QRC** (.qrc)
- ✅ **Lyricify Syllable LYS** (.lys)
- ✅ **TTML Lyric Format** (.ttml)
- ❌ **ASS Subtitle Format** (.ass)

#### Instalación
```bash
npm install @applemusic-like-lyrics/lyric
```

#### Uso Básico
```typescript
import { parseLrc } from "@applemusic-like-lyrics/lyric";

const lines = parseLrc("[00:00.00]test");
```

#### Convertir para AMLL Core
```typescript
import { parseLrc } from "@applemusic-like-lyrics/lyric";

const lines = parseLrc("[00:00.00]test");
const converted = lines.map((line, i, lines) => ({
  words: [
    {
      word: line.words[0]?.word ?? "",
      startTime: line.words[0]?.startTime ?? 0,
      endTime: lines[i + 1]?.words?.[0]?.startTime ?? Infinity,
    },
  ],
  startTime: line.words[0]?.startTime ?? 0,
  endTime: lines[i + 1]?.words?.[0]?.startTime ?? Infinity,
  translatedLyric: "",
  romanLyric: "",
  isBG: false,
  isDuet: false,
}));

// Ahora `converted` puede ser pasado a LyricPlayer
```

#### Tabla de Conversión de Formatos
| Formato | Parse | To LRC | To YRC | To QRC | To LYS | To TTML |
|---------|-------|--------|--------|--------|--------|---------|
| LyRiC   | ✅    | ✅     | ✅     | ✅     | ✅     | ✅      |
| YRC     | ✅    | ⚠️¹    | ✅     | ✅     | ✅     | ✅      |
| QRC     | ✅    | ⚠️¹    | ✅     | ✅     | ✅     | ✅      |
| LYS     | ✅    | ⚠️¹    | ⚠️²    | ⚠️²    | ✅     | ✅      |
| TTML    | ✅    | ⚠️¹    | ⚠️²    | ⚠️²    | ⚠️³    | ✅      |

¹ Pierde timing palabra por palabra
² Pierde atributos vocales (background, dueto)
³ Pierde metadatos de AMLL

---

### 4. AMLL Vue (`@applemusic-like-lyrics/vue`)

**Binding de Vue 3 para usar AMLL como componente nativo.**

Similar a React, pero optimizado para Vue 3 con Composition API.

---

## 🎯 Casos de Uso en Tu Music Player

### Opción 1: Usar AMLL React directamente
```typescript
import { LyricPlayer } from "@applemusic-like-lyrics/react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { useLyrics } from "@/hooks/use-lyrics";

export function LyricsPanel() {
  const { currentTime, isPaused } = useMusicPlayer();
  const { lyrics } = useLyrics();
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);

  useEffect(() => {
    // Convertir letras locales a formato AMLL si es necesario
    if (lyrics.source === "ttml") {
      setLyricLines(convertToAMLLFormat(lyrics.lines));
    }
  }, [lyrics]);

  return (
    <LyricPlayer
      lyricLines={lyricLines}
      currentTime={currentTime * 1000}
      playing={!isPaused}
    />
  );
}
```

### Opción 2: Parsear archivos TTML con AMLL Lyric
```typescript
import { parseTtml } from "@applemusic-like-lyrics/lyric";
import { LyricPlayer } from "@applemusic-like-lyrics/react";

export function LyricsPanel() {
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);

  useEffect(() => {
    // Cargar y parsear archivo TTML
    const ttmlContent = "...";
    const parsedLines = parseTtml(ttmlContent);
    
    // Convertir al formato esperado
    const converted = parsedLines.map((line, i, lines) => ({
      words: line.words.map(w => ({
        word: w.word,
        startTime: w.startTime,
        endTime: w.endTime,
      })),
      startTime: line.startTime,
      endTime: line.endTime,
      translatedLyric: "",
      romanLyric: "",
      isBG: false,
      isDuet: false,
    }));
    
    setLyricLines(converted);
  }, []);

  return <LyricPlayer lyricLines={lyricLines} currentTime={currentTime * 1000} />;
}
```

---

## 🎨 Personalización de Estilos

### CSS Variables
```css
.amll-lyric-player {
  /* Color de texto */
  --amll-lp-color: #ffffff;
  
  /* Color de fondo */
  --amll-lp-bg-color: rgba(0, 0, 0, 0.35);
  
  /* Más variables personalizables */
}
```

### En React/Vue
```jsx
<LyricPlayer
  lyricLines={lyricLines}
  currentTime={currentTime}
  style={{
    "--amll-lp-color": "#ffffff",
    "--amll-lp-bg-color": "rgba(0, 0, 0, 0.35)",
  }}
/>
```

---

## 🛠️ Desarrollo

### Ejecutar demo local
```bash
# Core
bun run --cwd packages/core dev

# React
bun run --cwd packages/react dev

# Vue
bun run --cwd packages/vue dev
```

### Build
```bash
# Core
bun run --cwd packages/core build

# React
bun run --cwd packages/react build

# Lyric (WASM)
wasm-pack build --target bundler --release --scope applemusic-like-lyrics
```

---

## 📊 Comparación: AMLL vs am-lyrics

| Característica | AMLL Core | am-lyrics |
|---|---|---|
| Fuente | Web Component Lit | Web Component |
| Búsqueda Auto | ❌ | ✅ (LyricsPlus + Apple Music) |
| Sincronización | Word-level | Word-level |
| Parseadores | ✅ (Rust/WASM) | ❌ |
| React Support | ✅ Nativo | ✅ @lit/react |
| Vue Support | ✅ Nativo | ❌ |
| Personalización | CSS Variables | CSS Variables + Props |

---

## 🔗 Referencias

- **AMLL Oficial**: https://github.com/amll-dev/applemusic-like-lyrics
- **am-lyrics**: https://github.com/binimum/am-lyrics
- **AMLL DB**: https://github.com/amll-dev/amll-ttml-db
- **AMLL Editor**: https://github.com/amll-dev/amll-editor

---

## ✅ Requisitos de Navegador

### Mínimo
- Chromium/Edge 91+
- Firefox 100+
- Safari 9.1+

### Para Efectos Completos
- Chromium 120+
- Firefox 100+
- Safari 15.4+

---

## 📋 Dependencias Requeridas

### Para AMLL Core/React
```json
{
  "@pixi/app": "^7.4.3",
  "@pixi/core": "^7.4.3",
  "@pixi/display": "^7.4.3",
  "@pixi/filter-blur": "^7.4.3",
  "@pixi/filter-bulge-pinch": "^5.1.1",
  "@pixi/filter-color-matrix": "^7.4.3",
  "@pixi/sprite": "^7.4.3",
  "jss": "^10.10.0",
  "jss-preset-default": "^10.10.0"
}
```

---

## 🎵 Integración en Tu Music Player

Ya tienes instalado:
- ✅ `@applemusic-like-lyrics/core`
- ✅ `@applemusic-like-lyrics/react`
- ✅ `@applemusic-like-lyrics/lyric`
- ✅ `@uimaxbai/am-lyrics` (alternativa con búsqueda automática)

**Próximos pasos recomendados:**
1. Decidir entre AMLL (más control) o am-lyrics (más automático)
2. Integrar parsers de TTML usando `@applemusic-like-lyrics/lyric`
3. Crear componente unificado que use uno de los dos sistemas
4. Personalizar estilos con CSS variables
