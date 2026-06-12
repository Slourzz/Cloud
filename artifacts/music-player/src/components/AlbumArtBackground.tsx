import { useEffect, useState } from "react";

interface AlbumArtBackgroundProps {
  coverUrl?: string;
}

function getDominantColor(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "rgba(30,30,40,0.9)";

  canvas.width = 50;
  canvas.height = 50;
  ctx.drawImage(img, 0, 0, 50, 50);
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

  return `rgba(${r}, ${g}, ${b}, 0.9)`;
}

export function AlbumArtBackground({ coverUrl }: AlbumArtBackgroundProps) {
  const [gradientColors, setGradientColors] = useState<{
    from: string;
    to: string;
  }>({
    from: "rgba(20,20,30,0.9)",
    to: "rgba(0,0,0,0.7)",
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!coverUrl) return;

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = coverUrl;

    img.onload = () => {
      const dominant = getDominantColor(img);
      const match = dominant.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        const r = Math.max(0, parseInt(match[1]) - 40);
        const g = Math.max(0, parseInt(match[2]) - 40);
        const b = Math.max(0, parseInt(match[3]) - 40);
        const toColor = `rgba(${r}, ${g}, ${b}, 0.85)`;
        setGradientColors({ from: dominant, to: toColor });
      }
      setIsLoaded(true);
    };

    img.onerror = () => {
      setGradientColors({
        from: "rgba(30,30,40,0.9)",
        to: "rgba(10,10,20,0.8)",
      });
      setIsLoaded(true);
    };
  }, [coverUrl]);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {coverUrl && (
        <div
          className="absolute inset-0 transition-all duration-1000 ease-out will-change-transform"
          style={{
            backgroundImage: `url(${coverUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(60px) brightness(0.7)",
            transform: "scale(1.1)",
            opacity: isLoaded ? 0.6 : 0,
          }}
        />
      )}
      <div
        className="absolute inset-0 transition-all duration-1000 ease-out"
        style={{
          background: `radial-gradient(circle at 30% 40%, ${gradientColors.from}, ${gradientColors.to})`,
          opacity: isLoaded ? 1 : 0,
        }}
      />
    </div>
  );
}