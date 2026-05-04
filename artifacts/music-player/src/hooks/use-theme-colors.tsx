import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";

export interface ColorPalette {
  vibrant: [number, number, number];
  dark: [number, number, number];
  mid: [number, number, number];
}

const DEFAULT_PALETTE: ColorPalette = {
  vibrant: [103, 80, 164],
  dark: [18, 14, 30],
  mid: [55, 42, 95],
};

function extractVibrant(img: HTMLImageElement): ColorPalette {
  try {
    const W = 80, H = 80;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return DEFAULT_PALETTE;
    ctx.drawImage(img, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    type Bucket = { r: number; g: number; b: number; count: number };
    const buckets = new Map<string, Bucket>();

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const qr = Math.round(r / 10) * 10;
      const qg = Math.round(g / 10) * 10;
      const qb = Math.round(b / 10) * 10;
      const key = `${qr},${qg},${qb}`;
      const bk = buckets.get(key);
      if (bk) bk.count++;
      else buckets.set(key, { r: qr, g: qg, b: qb, count: 1 });
    }

    let bestColor: [number, number, number] = DEFAULT_PALETTE.vibrant;
    let bestScore = -1;

    for (const bk of buckets.values()) {
      if (bk.count < 6) continue;
      const { r, g, b } = bk;
      const max = Math.max(r, g, b) / 255;
      const min = Math.min(r, g, b) / 255;
      const sat = max === 0 ? 0 : (max - min) / max;
      const bright = max;
      if (bright < 0.2 || bright > 0.95) continue;
      const score = sat * 2.5 + bright * 0.4 + Math.log(bk.count + 1) * 0.15;
      if (score > bestScore) {
        bestScore = score;
        bestColor = [r, g, b];
      }
    }

    const [r, g, b] = bestColor;
    return {
      vibrant: bestColor,
      dark: [Math.round(r * 0.12), Math.round(g * 0.12), Math.round(b * 0.12)],
      mid: [Math.round(r * 0.4), Math.round(g * 0.4), Math.round(b * 0.4)],
    };
  } catch {
    return DEFAULT_PALETTE;
  }
}

let animFrameId: number | null = null;

function animatePalette(from: ColorPalette, to: ColorPalette, onUpdate?: (p: ColorPalette) => void) {
  if (animFrameId != null) cancelAnimationFrame(animFrameId);
  const startTime = performance.now();
  const DURATION = 1800;

  function ease(t: number) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function lerp(a: number, b: number, t: number) { return Math.round(a + (b - a) * t); }

  function frame(now: number) {
    const raw = (now - startTime) / DURATION;
    const t = ease(Math.min(raw, 1));

    const vr = lerp(from.vibrant[0], to.vibrant[0], t);
    const vg = lerp(from.vibrant[1], to.vibrant[1], t);
    const vb = lerp(from.vibrant[2], to.vibrant[2], t);
    const dr = lerp(from.dark[0], to.dark[0], t);
    const dg = lerp(from.dark[1], to.dark[1], t);
    const db = lerp(from.dark[2], to.dark[2], t);
    const mr = lerp(from.mid[0], to.mid[0], t);
    const mg = lerp(from.mid[1], to.mid[1], t);
    const mb = lerp(from.mid[2], to.mid[2], t);

    const root = document.documentElement;
    root.style.setProperty("--dyn-v", `${vr} ${vg} ${vb}`);
    root.style.setProperty("--dyn-d", `${dr} ${dg} ${db}`);
    root.style.setProperty("--dyn-m", `${mr} ${mg} ${mb}`);

    if (raw < 1) {
      animFrameId = requestAnimationFrame(frame);
    } else {
      animFrameId = null;
      onUpdate?.({ vibrant: [vr, vg, vb], dark: [dr, dg, db], mid: [mr, mg, mb] });
    }
  }

  animFrameId = requestAnimationFrame(frame);
}

interface ThemeColorsContextValue {
  palette: ColorPalette;
  rgb: (key: "v" | "d" | "m", opacity?: number) => string;
  gradientBg: (opacity?: number) => React.CSSProperties;
  fullscreenBg: () => React.CSSProperties;
}

const ThemeColorsContext = createContext<ThemeColorsContextValue>({
  palette: DEFAULT_PALETTE,
  rgb: () => "rgb(103 80 164)",
  gradientBg: () => ({}),
  fullscreenBg: () => ({}),
});

export function ThemeColorsProvider({ children }: { children: ReactNode }) {
  const { currentSong } = useMusicPlayer();
  const paletteRef = useRef<ColorPalette>(DEFAULT_PALETTE);
  const [palette, setPalette] = useState<ColorPalette>(DEFAULT_PALETTE);

  useEffect(() => {
    if (!currentSong?.coverUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const next = extractVibrant(img);
      animatePalette(paletteRef.current, next, (final) => {
        paletteRef.current = final;
        setPalette(final);
      });
    };
    img.src = currentSong.coverUrl;
  }, [currentSong?.id, currentSong?.coverUrl]);

  const rgb = (key: "v" | "d" | "m", opacity = 1) => {
    const p = key === "v" ? palette.vibrant : key === "d" ? palette.dark : palette.mid;
    return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${opacity})`;
  };

  const gradientBg = (opacity = 0.1): React.CSSProperties => ({
    background: `
      radial-gradient(ellipse 90% 60% at 5% 0%, rgb(var(--dyn-v) / ${opacity}) 0%, transparent 55%),
      radial-gradient(ellipse 60% 70% at 95% 100%, rgb(var(--dyn-m) / ${opacity * 0.7}) 0%, transparent 55%)
    `,
  });

  const fullscreenBg = (): React.CSSProperties => ({
    background: `
      radial-gradient(ellipse 120% 80% at 30% 20%, rgb(var(--dyn-m) / 0.55) 0%, transparent 60%),
      radial-gradient(ellipse 80% 100% at 70% 80%, rgb(var(--dyn-d) / 0.9) 0%, transparent 60%),
      rgb(var(--dyn-d))
    `,
  });

  return (
    <ThemeColorsContext.Provider value={{ palette, rgb, gradientBg, fullscreenBg }}>
      {children}
    </ThemeColorsContext.Provider>
  );
}

export function useThemeColors() {
  return useContext(ThemeColorsContext);
}
