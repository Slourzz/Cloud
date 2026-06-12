import { useEffect, useState } from "react";

interface AlbumArtBackgroundProps {
  coverUrl?: string;
}

// Extrae el color dominante de una imagen usando canvas
function getDominantColor(imgElement: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "rgba(30,30,40,0.9)";

  // Escalar imagen a 50x50 para rendimiento
  canvas.width = 50;
  canvas.height = 50;
  ctx.drawImage(imgElement, 0, 0, 50, 50);
  const imageData = ctx.getImageData(0, 0, 50, 50);
  const data = imageData.data;

  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i+1];
    b += data[i+2];
    count++;
  }
  r = Math.floor(r / count);
  g = Math.floor(g / count);
  b = Math.floor(b / count);

  return `rgba(${r}, ${g}, ${b}, 0.85)`;
}

export function AlbumArtBackground({ coverUrl }: AlbumArtBackgroundProps) {
  const [dominantColor, setDominantColor] = useState("rgba(30,30,40,0.85)");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!coverUrl) {
      setDominantColor("rgba(30,30,40,0.85)");
      setIsLoaded(true);
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = coverUrl;

    img.onload = () => {
      const color = getDominantColor(img);
      setDominantColor(color);
      setIsLoaded(true);
    };

    img.onerror = () => {
      setDominantColor("rgba(30,30,40,0.85)");
      setIsLoaded(true);
    };
  }, [coverUrl]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden transition-opacity duration-1000">
      {/* Capa 1: imagen de la carátula con blur extremo y escala */}
      {coverUrl && (
        <div
          className="absolute inset-0 transition-all duration-1000 ease-out will-change-transform"
          style={{
            backgroundImage: `url(${coverUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(60px) brightness(0.8)",
            transform: "scale(1.1)",
            opacity: isLoaded ? 0.7 : 0,
          }}
        />
      )}

      {/* Capa 2: degradado radial con el color dominante */}
      <div
        className="absolute inset-0 transition-all duration-1000 ease-out"
        style={{
          background: `radial-gradient(circle at 30% 40%, ${dominantColor}, rgba(0,0,0,0.8))`,
          opacity: isLoaded ? 1 : 0,
        }}
      />
    </div>
  );
}
