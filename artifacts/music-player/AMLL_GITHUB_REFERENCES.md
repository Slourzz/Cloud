# 🔗 Referencias Directas a Documentación Original

## AMLL - Apple Music-like Lyrics

### 📚 README Oficial

- **Repositorio Principal**: https://github.com/amll-dev/applemusic-like-lyrics
- **README Principal**: https://github.com/amll-dev/applemusic-like-lyrics#readme

---

## 📦 Paquetes Individuales

### 1. AMLL Core - Componente Base de JS Puro

**URL**: https://github.com/amll-dev/applemusic-like-lyrics/blob/main/packages/core/README.md

**Contenido:**
- Renderizado puro de letras y fondos dinámicos
- Sincronización a nivel de palabra
- Soporte para traducción y romanización
- Líneas múltiples, duetos, fondos
- Personalización vía CSS variables

**Características Clave:**
- ✅ Pure frontend rendering
- ✅ Word-level timed lyrics with translation and romanization
- ✅ Multi-line, duet, and background line support
- ✅ Style customization via CSS variables

**Instalación:**
```bash
npm install @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite
npm install @applemusic-like-lyrics/core
```

**API Documentation:** https://github.com/amll-dev/applemusic-like-lyrics/blob/main/packages/core/docs/modules.md

**Test Program:** https://github.com/amll-dev/applemusic-like-lyrics/blob/main/packages/playground/core/src/test.ts

---

### 2. AMLL React - Binding de React

**URL**: https://github.com/amll-dev/applemusic-like-lyrics/blob/main/packages/react/README.md

**Contenido:**
- Binding nativo de React para AMLL
- Componente React de clase alta
- Props tipados con TypeScript

**Instalación:**
```bash
npm install @pixi/app @pixi/core @pixi/display @pixi/filter-blur @pixi/filter-bulge-pinch @pixi/filter-color-matrix @pixi/sprite jss jss-preset-default
npm install react react-dom
npm install @applemusic-like-lyrics/react
```

**API Documentation:** https://github.com/amll-dev/applemusic-like-lyrics/blob/main/packages/react/docs/modules.md

**Test Program:** https://github.com/amll-dev/applemusic-like-lyrics/blob/main/packages/playground/react/src/test.tsx

---

### 3. AMLL Vue - Binding de Vue 3

**URL**: https://github.com/amll-dev/applemusic-like-lyrics/blob/main/packages/vue/README.md

**Contenido:**
- Binding de Vue 3 Composition API
- Componentes Vue de alta calidad
- Integración con sistema reactivo de Vue

**Instalación:**
```bash
npm install @applemusic-like-lyrics/vue
```

**Test Program:** https://github.com/amll-dev/applemusic-like-lyrics/blob/main/packages/playground/vue/src/test.vue

---

### 4. AMLL Lyric - Parser/Writer de Letras (Rust/WASM)

**URL**: https://github.com/amll-dev/applemusic-like-lyrics/blob/main/packages/lyric/README.md

**Contenido:**
- Módulo de parsing/generación escrito en Rust
- Compilado a WASM para usar en el navegador
- Soporte para múltiples formatos de letras

**Formatos Soportados:**
- ✅ LyRiC Format (.lrc)
- ✅ ESLyric Word-by-word Format (.lrc)
- ✅ NetEase Cloud Music YRC (.yrc)
- ✅ QQ Music QRC (.qrc)
- ✅ Lyricify Syllable LYS (.lys)
- ✅ TTML Lyric Format (.ttml)
- ❌ ASS Subtitle Format (.ass)

**Instalación:**
```bash
npm install @applemusic-like-lyrics/lyric
```

**Conversión de formatos disponible** entre todos los formatos soportados con notas sobre pérdida de datos.

---

## 🛠️ Herramientas Relacionadas

### AMLL Editor - Editor Profesional de Letras Sincronizadas

**URL**: https://github.com/amll-dev/amll-editor

Herramienta GUI completa para crear y editar letras TTML sincronizadas.

---

### AMLL TTML DB - Base de Datos de Letras TTML

**URL**: https://github.com/amll-dev/amll-ttml-db

Base de datos colaborativa de letras TTML de calidad.

---

### AMLL Player - Reproductor de Música Local

**URL**: https://github.com/amll-dev/amll-player

Reproductor de música de escritorio con soporte para letras TTML.

---

### AMLL Page - Reproductor Web

**URL**: https://github.com/amll-dev/amll-page

Reproductor de música web con sincronización de letras.

---

## 📊 Requisitos Técnicos

### Compatibilidad de Navegadores

**Mínimo:**
- Chromium/Edge 91+
- Firefox 100+
- Safari 9.1+

**Para Efectos Completos:**
- Chromium 120+
- Firefox 100+
- Safari 15.4+

**Referencias:**
- https://caniuse.com/mdn-css_properties_mask-image
- https://caniuse.com/mdn-css_properties_mix-blend-mode_plus-lighter

---

### Requisitos de Rendimiento

- **30 FPS:** CPU mainstream últimos 5 años
- **60 FPS:** CPU con frecuencia ≥ 3.0GHz
- **144+ FPS:** CPU con frecuencia ≥ 4.2GHz

**GPU para 60 FPS:**
- 1080p (1920x1080): NVIDIA GTX 10 series+
- 2160p (3840x2160): NVIDIA RTX 2070+

---

## 🔑 Conceptos Principales

### LyricLine - Estructura de Datos

```typescript
interface LyricLine {
  words: Array<{
    word: string;
    startTime: number;      // milliseconds
    endTime: number;        // milliseconds
    romanWord?: string;
    ruby?: string;
    obscene?: boolean;
  }>;
  translatedLyric: string;
  romanLyric: string;
  startTime: number;        // milliseconds
  endTime: number;          // milliseconds
  isBG: boolean;            // background vocals
  isDuet: boolean;          // duet vocals
}
```

---

## 🎨 Personalización

### CSS Variables Disponibles

En AMLL Core:
```css
.amll-lyric-player {
  --amll-lp-color: #ffffff;
  --amll-lp-bg-color: rgba(0, 0, 0, 0.35);
  /* Más variables disponibles */
}
```

---

## 📞 Soporte Comunitario

- **Issues**: https://github.com/amll-dev/applemusic-like-lyrics/issues
- **Discussions**: https://github.com/amll-dev/applemusic-like-lyrics/discussions
- **GitHub Sponsors**: https://github.com/sponsors/amll-dev

---

## 📜 Licencia

AGPL-3.0 License

---

## 🔗 Enlaces de Utilidad

| Recurso | URL |
|---------|-----|
| NPM Package Core | https://www.npmjs.com/package/@applemusic-like-lyrics/core |
| NPM Package React | https://www.npmjs.com/package/@applemusic-like-lyrics/react |
| NPM Package Vue | https://www.npmjs.com/package/@applemusic-like-lyrics/vue |
| NPM Package Lyric | https://www.npmjs.com/package/@applemusic-like-lyrics/lyric |
| Sitio Oficial | https://amll.dev |

---

## 📝 Notas Importantes

> ⚠️ **Este es un proyecto en desarrollo personal. Puede haber aún muchos issues, por lo que no se recomienda usar directamente en producción.**

Los tres paquetes principales (Core, React, Vue) utilizan PixiJS para renderizado acelerado por GPU de los efectos visuales.

El módulo Lyric es escrito en Rust y compilado a WASM, lo que permite parsing de letras altamente eficiente en el navegador sin dependencias externas de análisis de servidor.

---

## 🎯 Tu Próximo Paso

Revisa el archivo `AMLL_DOCUMENTATION.md` en tu proyecto para ejemplos prácticos de integración, o consulta `src/components/AMLL_INTEGRATION_EXAMPLES.tsx` para ver código comentado listo para usar.
