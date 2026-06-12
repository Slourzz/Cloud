import { useEffect, useState } from "react";

interface DynamicBackgroundProps {
  coverUrl?: string;
}

export function DynamicBackground({ coverUrl }: DynamicBackgroundProps) {
  const [colors, setColors] = useState<string[]>([]);
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Listener de resize
  useEffect(() => {
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Extraer colores de la portada
  useEffect(() => {
    if (!coverUrl) return;

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = coverUrl;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, 100, 100);
      const imageData = ctx.getImageData(0, 0, 100, 100);
      const data = imageData.data;

      const extractedColors: string[] = [];
      for (let i = 0; i < data.length; i += 16) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        extractedColors.push(`rgb(${r}, ${g}, ${b})`);
      }

      setColors(extractedColors);
    };
  }, [coverUrl]);

  if (colors.length === 0) return null;

  return (
    <div
      key={`${windowSize.width}-${windowSize.height}`} // Fuerza remontaje al cambiar tamaño
      className="fixed inset-0 -z-10"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        background: "rgb(0, 0, 0)",
      }}
    >
      {Array.from({ length: 36 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: colors[Math.floor(Math.random() * colors.length)] || "rgb(0,0,0)",
          }}
        />
      ))}
      <div
        className="absolute inset-0 backdrop-blur-xl"
        style={{ background: "rgba(0, 0, 0, 0.4)" }}
      />
    </div>
  );
}
