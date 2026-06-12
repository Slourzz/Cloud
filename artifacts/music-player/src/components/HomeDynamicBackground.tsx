import { useEffect, useRef, useState } from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { useAppearance } from "@/providers/appearance-provider";
import Kawarp from "@kawarp/core";

const KAWARP_OPTIONS = {
  warpIntensity: 1.85,
  blurPasses: 10,
  animationSpeed: 0.82,
  saturation: 2.2,
  dithering: 0.01,
  transitionDuration: 1500,
  tintIntensity: 0.08,
  scale: 1.16,
};

const HOME_IDLE_SPEED = 0.14;
const FALLBACK_COVER_URL = "/album1.png";

export function HomeDynamicBackground() {
  const { currentSong, isPlaying } = useMusicPlayer();
  const { settings } = useAppearance();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kawarpRef = useRef<Kawarp | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const lastCoverUrlRef = useRef<string | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });

  const isDynamicBackgroundEnabled =
    settings.interfaceTheme !== "simplyui" &&
    settings.backgroundTheme === "dynamic-background";

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!isDynamicBackgroundEnabled) return;

    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(rect.width * dpr));
        const height = Math.max(1, Math.round(rect.height * dpr));

        setCanvasSize((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height },
        );
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);

      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
    };
  }, [isDynamicBackgroundEnabled]);

  useEffect(() => {
    if (!isDynamicBackgroundEnabled) return;
    if (!canvasRef.current || kawarpRef.current) return;

    const instance = new Kawarp(canvasRef.current, KAWARP_OPTIONS);
    kawarpRef.current = instance;
    instance.start();
    instance.setOptions({
      animationSpeed: isPlaying
        ? KAWARP_OPTIONS.animationSpeed
        : HOME_IDLE_SPEED,
    });

    return () => {
      kawarpRef.current?.dispose();
      kawarpRef.current = null;
      lastCoverUrlRef.current = null;
    };
  }, [isDynamicBackgroundEnabled]);

  useEffect(() => {
    if (!isDynamicBackgroundEnabled) return;
    if (!canvasRef.current || !kawarpRef.current) return;

    kawarpRef.current.resize();
    kawarpRef.current.renderFrame();
  }, [isDynamicBackgroundEnabled, canvasSize.width, canvasSize.height]);

  useEffect(() => {
    if (!isDynamicBackgroundEnabled) return;
    if (!kawarpRef.current) return;

    const coverUrl =
      currentSong?.customCoverUrl ||
      currentSong?.coverUrl ||
      FALLBACK_COVER_URL;

    if (lastCoverUrlRef.current === coverUrl) return;

    const image = new Image();
    if (coverUrl.startsWith("http")) image.crossOrigin = "Anonymous";
    image.src = coverUrl;

    image.onload = async () => {
      try {
        await kawarpRef.current?.loadImage(coverUrl);
        lastCoverUrlRef.current = coverUrl;
        kawarpRef.current?.setOptions({
          animationSpeed: isPlayingRef.current
            ? KAWARP_OPTIONS.animationSpeed
            : HOME_IDLE_SPEED,
        });
      } catch (error) {
        console.error("Error en loadImage:", error);
      }
    };

    image.onerror = () =>
      console.error("Error cargando imagen desde URL:", coverUrl);
  }, [
    isDynamicBackgroundEnabled,
    currentSong?.id,
    currentSong?.coverUrl,
    currentSong?.customCoverUrl,
  ]);

  useEffect(() => {
    if (!kawarpRef.current) return;

    kawarpRef.current.setOptions({
      animationSpeed: isPlaying
        ? KAWARP_OPTIONS.animationSpeed
        : HOME_IDLE_SPEED,
    });
  }, [isPlaying]);

  if (!isDynamicBackgroundEnabled) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="cloud-home-dynamic-background fixed inset-0 overflow-hidden"
      style={{
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.72,
        filter: "brightness(1.08) saturate(1.55) contrast(1.05)",
        transition:
          "opacity 900ms cubic-bezier(0.16,1,0.3,1), filter 1200ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="h-full w-full"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
