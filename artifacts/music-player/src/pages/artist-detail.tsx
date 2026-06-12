import { useEffect, useState, useMemo, useRef } from "react";
import { useParams } from "wouter";
import { useMusicPlayer, Song } from "@/hooks/use-music-player";
import { usePlaylists } from "@/hooks/use-playlists";
import {
  Play,
  Shuffle,
  Edit3,
  Star,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useArtistImage } from "@/hooks/use-artist-image";

// --- Utilidades de color ---
const colorCache = new Map<string, { r: number; g: number; b: number }>();

const getDominantColor = (imageUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!imageUrl.startsWith("blob:")) img.crossOrigin = "Anonymous";
    img.src = imageUrl;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 100;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject();
      ctx.drawImage(img, 0, 0, size, size);
      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      let r = 0,
        g = 0,
        b = 0,
        count = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);
      resolve(`rgb(${r}, ${g}, ${b})`);
    };
    img.onerror = () => reject();
  });
};

const rgbToRgbValues = (rgb: string): { r: number; g: number; b: number } => {
  const match = rgb.match(/\d+/g);
  if (!match) return { r: 100, g: 100, b: 200 };
  return {
    r: parseInt(match[0]),
    g: parseInt(match[1]),
    b: parseInt(match[2]),
  };
};

const boostSaturation = (
  r: number,
  g: number,
  b: number,
  amount: number,
): { r: number; g: number; b: number } => {
  let rNorm = r / 255,
    gNorm = g / 255,
    bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0,
    s,
    l = (max + min) / 2;
  if (max === min) {
    s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  }
  s = Math.min(1, s * (1 + amount));
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (max !== min) {
    if (max === rNorm) h = (gNorm - bNorm) / (max - min);
    else if (max === gNorm) h = 2 + (bNorm - rNorm) / (max - min);
    else h = 4 + (rNorm - gNorm) / (max - min);
    h /= 6;
    if (h < 0) h += 1;
  }
  let rr, gg, bb;
  if (s === 0) {
    rr = gg = bb = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    rr = hue2rgb(p, q, h + 1 / 3);
    gg = hue2rgb(p, q, h);
    bb = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(rr * 255),
    g: Math.round(gg * 255),
    b: Math.round(bb * 255),
  };
};

// --- Funciones de caché para biografía y colores ---
const CACHE_EXPIRATION = 30 * 24 * 60 * 60 * 1000;

function getCachedBio(artist: string): string | null {
  try {
    const raw = localStorage.getItem(`artist_bio_${artist}`);
    if (!raw) return null;
    const { bio, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp < CACHE_EXPIRATION) return bio;
    localStorage.removeItem(`artist_bio_${artist}`);
  } catch {}
  return null;
}

function setCachedBio(artist: string, bio: string) {
  try {
    localStorage.setItem(
      `artist_bio_${artist}`,
      JSON.stringify({ bio, timestamp: Date.now() }),
    );
  } catch {}
}

function getCachedColor(
  artist: string,
): { r: number; g: number; b: number } | null {
  try {
    const raw = localStorage.getItem(`artist_color_${artist}`);
    if (!raw) return null;
    const { r, g, b, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp < CACHE_EXPIRATION) return { r, g, b };
    localStorage.removeItem(`artist_color_${artist}`);
  } catch {}
  return null;
}

function setCachedColor(
  artist: string,
  color: { r: number; g: number; b: number },
) {
  try {
    localStorage.setItem(
      `artist_color_${artist}`,
      JSON.stringify({ ...color, timestamp: Date.now() }),
    );
  } catch {}
}

// --- Componente principal ---
export default function ArtistDetail() {
  const { artist } = useParams<{ artist: string }>();
  const decodedArtist = artist ? decodeURIComponent(artist) : "";
  const { allSongs, play, setCurrentPlaylist, addToQueue } = useMusicPlayer();
  const { playlists, addSongToPlaylist } = usePlaylists();

  const artistSongs = useMemo(
    () => allSongs.filter((s) => s.artist === decodedArtist),
    [allSongs, decodedArtist],
  );
  const artistImageUrl = useArtistImage(decodedArtist);

  const [bio, setBio] = useState<string>(
    () => getCachedBio(decodedArtist) || "",
  );
  const [albums, setAlbums] = useState<any[]>([]);
  const [isStarred, setIsStarred] = useState(false);
  const [albumCategory, setAlbumCategory] = useState<"Album" | "SingleAndEP">(
    "Album",
  );

  const cachedColor = getCachedColor(decodedArtist);
  const [dynV, setDynV] = useState<{ r: number; g: number; b: number }>(
    cachedColor || { r: 100, g: 100, b: 200 },
  );
  const [dynD, setDynD] = useState<{ r: number; g: number; b: number }>(
    cachedColor
      ? {
          r: Math.floor(cachedColor.r * 0.6),
          g: Math.floor(cachedColor.g * 0.6),
          b: Math.floor(cachedColor.b * 0.6),
        }
      : { r: 60, g: 60, b: 120 },
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const albumScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Efecto para inicializar y actualizar flechas del carrusel de álbumes
  useEffect(() => {
    const el = albumScrollRef.current;
    if (!el) return;

    const updateButtons = () => {
      if (!el) return;
      const hasOverflow = el.scrollWidth > el.clientWidth + 1;
      setCanScrollLeft(hasOverflow && el.scrollLeft > 0);
      setCanScrollRight(
        hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      );
    };

    const timeoutId = setTimeout(updateButtons, 50);
    el.addEventListener("scroll", updateButtons, { passive: true });

    const observer = new ResizeObserver(updateButtons);
    observer.observe(el);

    return () => {
      clearTimeout(timeoutId);
      el.removeEventListener("scroll", updateButtons);
      observer.disconnect();
    };
  }, [albums, albumCategory]); // se recalcula al cambiar de categoría

  // Obtener biografía y álbumes
  useEffect(() => {
    if (!decodedArtist) return;
    if (!bio) {
      invoke<string>("fetch_artist_bio", { artist: decodedArtist })
        .then((fetchedBio) => {
          setBio(fetchedBio);
          setCachedBio(decodedArtist, fetchedBio);
        })
        .catch(() => setBio("Biografía no disponible"));
    }
    invoke<any[]>("fetch_artist_albums", { artist: decodedArtist })
      .then((data) => {
        console.log("📀 Álbumes recibidos:", data);
        setAlbums(data);
      })
      .catch(() => setAlbums([]));
  }, [decodedArtist]);

  // Actualizar colores dinámicos
  useEffect(() => {
    if (!artistImageUrl) return;
    if (cachedColor && colorCache.has(artistImageUrl)) {
      const cached = colorCache.get(artistImageUrl)!;
      setDynV(cached);
      setDynD({
        r: Math.floor(cached.r * 0.6),
        g: Math.floor(cached.g * 0.6),
        b: Math.floor(cached.b * 0.6),
      });
      return;
    }
    const storedColor = getCachedColor(decodedArtist);
    if (storedColor) {
      setDynV(storedColor);
      setDynD({
        r: Math.floor(storedColor.r * 0.6),
        g: Math.floor(storedColor.g * 0.6),
        b: Math.floor(storedColor.b * 0.6),
      });
      colorCache.set(artistImageUrl, storedColor);
      return;
    }
    getDominantColor(artistImageUrl)
      .then((color) => {
        const { r, g, b } = rgbToRgbValues(color);
        const boosted = boostSaturation(r, g, b, 0.55);
        colorCache.set(artistImageUrl, boosted);
        setDynV(boosted);
        setDynD({
          r: Math.floor(boosted.r * 0.6),
          g: Math.floor(boosted.g * 0.6),
          b: Math.floor(boosted.b * 0.6),
        });
        setCachedColor(decodedArtist, boosted);
      })
      .catch(() => {});
  }, [artistImageUrl]);

  // Estrella
  useEffect(() => {
    if (!decodedArtist) return;
    const starred = localStorage.getItem("starred_artists");
    const list = starred ? JSON.parse(starred) : [];
    setIsStarred(list.includes(decodedArtist));
  }, [decodedArtist]);

  const toggleStar = () => {
    const starred = localStorage.getItem("starred_artists");
    const list: string[] = starred ? JSON.parse(starred) : [];
    if (list.includes(decodedArtist)) {
      const updated = list.filter((a) => a !== decodedArtist);
      localStorage.setItem("starred_artists", JSON.stringify(updated));
      setIsStarred(false);
    } else {
      list.push(decodedArtist);
      localStorage.setItem("starred_artists", JSON.stringify(list));
      setIsStarred(true);
    }
  };

  const artistPlaylists = useMemo(() => {
    return playlists.filter((pl) =>
      pl.songIds.some((id) => artistSongs.some((s) => s.id === id)),
    );
  }, [playlists, artistSongs]);

  const filteredAlbums = useMemo(() => {
    if (albumCategory === "Album") {
      // Mostrar los que NO tengan "Single" ni "EP" en el nombre
      return albums.filter((a: any) => {
        const name = a.name?.toLowerCase() || "";
        return !name.includes("single") && !name.includes("ep");
      });
    } else {
      // Mostrar los que SÍ tengan "Single" o "EP" en el nombre
      return albums.filter((a: any) => {
        const name = a.name?.toLowerCase() || "";
        return name.includes("single") || name.includes("ep");
      });
    }
  }, [albums, albumCategory]);

  if (!decodedArtist)
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Artista no encontrado
      </div>
    );

  const handlePlayAll = () => {
    if (artistSongs.length === 0) return;
    setCurrentPlaylist(artistSongs);
    play(artistSongs[0]);
  };
  const handlePlaySong = (song: Song) => {
    setCurrentPlaylist(artistSongs);
    play(song);
  };
  const handleShuffle = () => {
    if (artistSongs.length === 0) return;
    const shuffled = [...artistSongs].sort(() => Math.random() - 0.5);
    setCurrentPlaylist(shuffled);
    play(shuffled[0]);
  };

  const solidBackgroundStyle = {
    backgroundColor: `rgb(${dynD.r}, ${dynD.g}, ${dynD.b})`,
    transition: "background-color 1.2s ease",
  };
  const fadeOverlay = {
    background: `linear-gradient(to bottom, rgba(${dynV.r}, ${dynV.g}, ${dynV.b}, 0.3) 0%, rgba(${dynD.r}, ${dynD.g}, ${dynD.b}, 0) 55%, rgba(${dynD.r}, ${dynD.g}, ${dynD.b}, 1) 100%)`,
  };
  const glassmorphismStyle = {
    background: "rgba(255, 255, 255, 0.2)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  };

  return (
    <div
      className="cloud-themed-page min-h-screen text-white"
      style={solidBackgroundStyle}
    >
      {/* BANNER */}
      <div
        className="cloud-detail-banner relative w-full h-[400px] md:h-[500px] overflow-hidden"
        style={{
          backgroundColor: `rgb(${dynD.r}, ${dynD.g}, ${dynD.b})`,
          transition: "background-color 1.2s ease",
        }}
      >
        {artistImageUrl && (
          <>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${artistImageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(10px) saturate(0.9)",
                opacity: 0.8,
              }}
            />
            <div className="absolute inset-0 z-10" style={fadeOverlay} />
          </>
        )}
        <div className="relative z-20 flex flex-col justify-end h-full px-6 pb-6">
          <h1 className="text-5xl md:text-7xl font-extrabold drop-shadow-lg mb-2">
            {decodedArtist}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 transition"
            >
              <Play className="w-4 h-4 fill-current" /> Reproducir
            </button>
            <button
              onClick={handleShuffle}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 transition"
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button className="w-10 h-10 rounded-full flex items-center justify-center bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 transition">
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={toggleStar}
              className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 hover:bg-white/30 transition ${isStarred ? "bg-yellow-400/30" : "bg-white/20"}`}
            >
              <Star
                className={`w-4 h-4 ${isStarred ? "fill-yellow-300 text-yellow-300" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="relative z-10 px-6 pb-32 mt-4 space-y-10">
        {/* CANCIONES */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Canciones</h2>
          {artistSongs.length > 0 ? (
            <div className="max-h-80 overflow-y-auto scrollbar-hide space-y-2 pr-1">
              {artistSongs.map((song) => (
                <div
                  key={song.id}
                  className="cloud-themed-panel flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/10 transition"
                  style={glassmorphismStyle}
                  onClick={() => handlePlaySong(song)}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-black/20 flex-shrink-0">
                    {song.coverUrl && !song.coverUrl.startsWith("/album") ? (
                      <img
                        src={song.coverUrl}
                        className="w-full h-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                        <Play className="w-5 h-5 text-white/60" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {song.title}
                    </p>
                    <p className="text-xs text-white/60">
                      {formatDuration(song.duration)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="p-1 rounded-full hover:bg-white/20"
                  >
                    <MoreVertical className="w-4 h-4 text-white/70" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/40 text-center py-8">
              No hay canciones de este artista
            </p>
          )}
        </div>

        {/* DISCOGRAFÍA */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Discografía</h2>
          {/* Píldoras de categoría */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setAlbumCategory("Album")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                albumCategory === "Album"
                  ? "bg-white/30 text-white shadow-lg"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
              style={{
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              Álbumes
            </button>
            <button
              onClick={() => setAlbumCategory("SingleAndEP")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                albumCategory === "SingleAndEP"
                  ? "bg-white/30 text-white shadow-lg"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
              style={{
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              Sencillos y EP
            </button>
          </div>

          {/* Contenido filtrado */}
          {filteredAlbums.length > 0 ? (
            <div className="relative group">
              <div
                ref={albumScrollRef}
                className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory"
              >
                {filteredAlbums.map((album: any, i: number) => (
                  <div key={i} className="flex-shrink-0 w-64 snap-start">
                    <div
                      className="rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                      style={glassmorphismStyle}
                    >
                      <div className="aspect-square bg-black/20">
                        {album.image_url ? (
                          <img
                            src={album.image_url}
                            alt={album.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                            <Play className="w-8 h-8 text-white/40" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium truncate">
                          {album.name}
                        </p>
                        <p className="text-xs text-white/60">
                          {album.release_date?.split("-")[0] || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {canScrollLeft && (
                <button
                  onClick={() =>
                    albumScrollRef.current?.scrollBy({
                      left: -300,
                      behavior: "smooth",
                    })
                  }
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
              )}
              {canScrollRight && (
                <button
                  onClick={() =>
                    albumScrollRef.current?.scrollBy({
                      left: 300,
                      behavior: "smooth",
                    })
                  }
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              )}
            </div>
          ) : (
            <p className="text-white/40 text-center py-8">
              No se encontraron resultados
            </p>
          )}
        </div>

        {/* EN PLAYLISTS */}
        <div className="-mx-6">
          <h2 className="text-2xl font-bold mb-4 px-6">En playlists</h2>
          {artistPlaylists.length > 0 ? (
            <div className="relative group">
              <div
                ref={scrollContainerRef}
                className="flex gap-3 overflow-x-auto scrollbar-hide px-6 pb-4 snap-x snap-mandatory"
              >
                {artistPlaylists.map((pl) => (
                  <div key={pl.id} className="flex-shrink-0 w-44 snap-start">
                    <div className="flex flex-col gap-2">
                      <div className="aspect-square w-full rounded-lg overflow-hidden bg-black/20">
                        {pl.customCoverUrl ? (
                          <img
                            src={pl.customCoverUrl}
                            alt={pl.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                            <Play className="w-8 h-8 text-white/30" />
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-white truncate">
                          {pl.title}
                        </p>
                        <p className="text-xs text-white/60">
                          {pl.songIds.length} canciones
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  scrollContainerRef.current?.scrollBy({
                    left: -200,
                    behavior: "smooth",
                  })
                }
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() =>
                  scrollContainerRef.current?.scrollBy({
                    left: 200,
                    behavior: "smooth",
                  })
                }
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 backdrop-blur border border-white/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>
          ) : (
            <p className="text-white/40 text-center py-4 px-6">
              No está en ninguna playlist
            </p>
          )}
        </div>

        {/* ACERCA DE */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Acerca de {decodedArtist}</h2>
          <div className="rounded-2xl p-6" style={glassmorphismStyle}>
            <div className="flex flex-col md:flex-row gap-8">
              <div className="w-80 h-52 rounded-xl overflow-hidden flex-shrink-0">
                {artistImageUrl ? (
                  <img
                    src={artistImageUrl}
                    alt={decodedArtist}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/10 flex items-center justify-center">
                    <Play className="w-12 h-12 text-white/40" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                {bio ? (
                  <p
                    className="text-base text-white/80 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: bio }}
                  />
                ) : (
                  <p className="text-base text-white/40">
                    Biografía no disponible
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
