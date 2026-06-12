import { useEffect, useRef, useState } from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import Kawarp from "@kawarp/core";

const KAWARP_OPTIONS = {
  warpIntensity: 1.85,
  blurPasses: 10,
  animationSpeed: 0.82,
  saturation: 2.15,
  dithering: 0.012,
  transitionDuration: 950,
  tintIntensity: 0.28,
  scale: 1.08,
};

export function CloudDynamicBackground() {
  const { currentSong, isPlaying } = useMusicPlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const kawarpRef = useRef<Kawarp | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!canvasRef.current || kawarpRef.current) return;

    const instance = new Kawarp(canvasRef.current, KAWARP_OPTIONS);
    kawarpRef.current = instance;
    instance.start();

    return () => {
      kawarpRef.current?.dispose();
      kawarpRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !kawarpRef.current) return;

    kawarpRef.current.resize();
    kawarpRef.current.renderFrame();
  }, [canvasSize.width, canvasSize.height]);

  useEffect(() => {
    if (!kawarpRef.current) return;

    const coverUrl = currentSong?.coverUrl;
    if (!coverUrl) return;

    const image = new Image();
    if (coverUrl.startsWith("http")) image.crossOrigin = "Anonymous";
    image.src = coverUrl;

    image.onload = async () => {
      try {
        await kawarpRef.current?.loadImage(coverUrl);
        kawarpRef.current?.setOptions({
          animationSpeed: isPlayingRef.current
            ? KAWARP_OPTIONS.animationSpeed
            : 0,
        });
      } catch (error) {
        console.error("Error en loadImage:", error);
      }
    };

    image.onerror = () =>
      console.error("Error cargando imagen desde URL:", coverUrl);
  }, [currentSong?.coverUrl]);

  useEffect(() => {
    if (!kawarpRef.current) return;

    kawarpRef.current.setOptions({
      animationSpeed: isPlaying ? KAWARP_OPTIONS.animationSpeed : 0,
    });
  }, [isPlaying]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="h-full w-full"
        style={{ pointerEvents: "none", display: "block" }}
      />
    </div>
  );
}
