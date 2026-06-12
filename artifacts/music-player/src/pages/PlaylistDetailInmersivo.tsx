import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { usePlaylists, Playlist } from "@/hooks/use-playlists";
import { useMusicPlayer, Song } from "@/hooks/use-music-player";
import {
  Play,
  Shuffle,
  Edit3,
  Trash2,
  Plus,
  X,
  Music,
  Upload,
  GripVertical,
} from "lucide-react";

// ── Caché global de colores dominantes ──────────────────────
const colorCache = new Map<string, { r: number; g: number; b: number }>();

// --- Utilidades de color (canvas) ---
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

// ------------------------------------------------------
// COMPONENTE PRINCIPAL (solo busca la playlist)
// ------------------------------------------------------
export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const { playlists } = usePlaylists();
  const playlist = playlists.find((p) => p.id === id);

  if (!playlist) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center">
          <Music className="w-16 h-16 mx-auto opacity-20 mb-4" />
          <p className="text-xl font-medium">Playlist no encontrada</p>
        </div>
      </div>
    );
  }

  return <PlaylistDetailInner playlist={playlist} />;
}

// ------------------------------------------------------
// COMPONENTE INTERNO (toda la lógica y UI)
// ------------------------------------------------------
function PlaylistDetailInner({ playlist }: { playlist: Playlist }) {
  const {
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
  } = usePlaylists();
  const { allSongs, play, setCurrentPlaylist, currentSong } = useMusicPlayer();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addSongsModalOpen, setAddSongsModalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [tempCoverPreview, setTempCoverPreview] = useState("");

  // ── Colores iniciales según caché o template ──────────────
  const templateMap: Record<string, { r: number; g: number; b: number }> = {
    "tpl-purple": { r: 139, g: 92, b: 246 },
    "tpl-sunset": { r: 244, g: 63, b: 94 },
    "tpl-ocean": { r: 6, g: 182, b: 212 },
    "tpl-forest": { r: 16, g: 185, b: 129 },
    "tpl-gold": { r: 245, g: 158, b: 11 },
    "tpl-night": { r: 59, g: 130, b: 246 },
    "tpl-rose": { r: 236, g: 72, b: 153 },
    "tpl-mint": { r: 20, g: 184, b: 166 },
  };

  const getInitialColors = () => {
    if (playlist.customCoverUrl && colorCache.has(playlist.customCoverUrl)) {
      const cached = colorCache.get(playlist.customCoverUrl)!;
      return {
        dynV: cached,
        dynD: {
          r: Math.floor(cached.r * 0.6),
          g: Math.floor(cached.g * 0.6),
          b: Math.floor(cached.b * 0.6),
        },
      };
    }
    const fallback = templateMap[playlist.coverTemplate] || {
      r: 100,
      g: 100,
      b: 200,
    };
    return {
      dynV: fallback,
      dynD: {
        r: Math.floor(fallback.r * 0.5),
        g: Math.floor(fallback.g * 0.5),
        b: Math.floor(fallback.b * 0.5),
      },
    };
  };

  const [dynV, setDynV] = useState<{ r: number; g: number; b: number }>(
    getInitialColors().dynV,
  );
  const [dynD, setDynD] = useState<{ r: number; g: number; b: number }>(
    getInitialColors().dynD,
  );
  const [coverUrl, setCoverUrl] = useState("");

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const [deletePlaylistModalOpen, setDeletePlaylistModalOpen] = useState(false);

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggedSongId, setDraggedSongId] = useState<string | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);

  const playlistSongs = playlist.songIds
    .map((songId) => allSongs.find((s) => s.id === songId))
    .filter(Boolean) as Song[];

  // Determinar la URL de portada
  useEffect(() => {
    let url = "";
    if (playlist.customCoverUrl) url = playlist.customCoverUrl;
    else if (
      playlistSongs.length > 0 &&
      playlistSongs[0].coverUrl &&
      !playlistSongs[0].coverUrl.startsWith("/album")
    )
      url = playlistSongs[0].coverUrl;
    setCoverUrl(url);
  }, [playlist, playlistSongs]);

  // Color dinámico (con caché)
  useEffect(() => {
    if (!coverUrl) {
      const tpl = templateMap[playlist.coverTemplate] || {
        r: 100,
        g: 100,
        b: 200,
      };
      setDynV(tpl);
      setDynD({
        r: Math.floor(tpl.r * 0.5),
        g: Math.floor(tpl.g * 0.5),
        b: Math.floor(tpl.b * 0.5),
      });
      return;
    }

    if (colorCache.has(coverUrl)) {
      const cached = colorCache.get(coverUrl)!;
      setDynV(cached);
      setDynD({
        r: Math.floor(cached.r * 0.6),
        g: Math.floor(cached.g * 0.6),
        b: Math.floor(cached.b * 0.6),
      });
      return;
    }

    getDominantColor(coverUrl)
      .then((color) => {
        const { r, g, b } = rgbToRgbValues(color);
        const boosted = boostSaturation(r, g, b, 0.55);
        colorCache.set(coverUrl, boosted);
        setDynV(boosted);
        setDynD({
          r: Math.floor(boosted.r * 0.6),
          g: Math.floor(boosted.g * 0.6),
          b: Math.floor(boosted.b * 0.6),
        });
      })
      .catch(() => {
        // mantener el color actual (template)
      });
  }, [coverUrl, playlist.coverTemplate]);

  // Handlers
  const handlePlayAll = () => {
    if (playlistSongs.length === 0) return;
    setCurrentPlaylist(playlistSongs);
    play(playlistSongs[0]);
  };

  const handlePlaySong = (song: Song) => {
    setCurrentPlaylist(playlistSongs);
    play(song);
  };

  const handleShuffle = () => {
    if (playlistSongs.length === 0) return;
    const shuffled = [...playlistSongs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setCurrentPlaylist(shuffled);
    play(shuffled[0]);
  };

  const handleDeletePlaylist = () => {
    setDeletePlaylistModalOpen(true);
  };

  const confirmDeletePlaylist = () => {
    deletePlaylist(playlist.id);
    window.location.href = "/home";
  };

  const handleEditPlaylist = () => {
    setEditingTitle(playlist.title);
    setEditingDescription(playlist.description || "");
    setTempCoverPreview("");
    setEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingTitle.trim()) return;
    const newCoverUrl = tempCoverPreview || playlist.customCoverUrl;
    updatePlaylist(playlist.id, {
      title: editingTitle.trim(),
      description: editingDescription.trim(),
      customCoverUrl: newCoverUrl,
    });
    setEditModalOpen(false);
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 800;
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height *= maxSize / width;
          width = maxSize;
        } else if (height > maxSize) {
          width *= maxSize / height;
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setTempCoverPreview(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAddSong = (songId: string) =>
    addSongToPlaylist(playlist.id, songId);

  const handleRemoveSong = (songId: string, songTitle: string) => {
    setSongToDelete({ id: songId, title: songTitle });
    setConfirmModalOpen(true);
  };

  const confirmDelete = () => {
    if (songToDelete) {
      removeSongFromPlaylist(playlist.id, songToDelete.id);
    }
    setConfirmModalOpen(false);
    setSongToDelete(null);
  };

  const cancelDelete = () => {
    setConfirmModalOpen(false);
    setSongToDelete(null);
  };

  const availableSongs = allSongs.filter(
    (song) => !playlist.songIds.includes(song.id),
  );

  // Drag & drop
  const handleDragStart = (
    e: React.DragEvent,
    songId: string,
    index: number,
  ) => {
    e.dataTransfer.setData("text/plain", songId);
    e.dataTransfer.effectAllowed = "move";
    const ghost = document.createElement("div");
    ghost.textContent = "🎵";
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
    setDraggedSongId(songId);
    setDragSourceIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (
      draggedSongId !== null &&
      dragSourceIndex !== null &&
      dragSourceIndex !== index
    ) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedSongId === null || dragSourceIndex === null) return;
    if (dragSourceIndex === targetIndex) {
      resetDrag();
      return;
    }
    const newSongs = [...playlistSongs];
    const [removed] = newSongs.splice(dragSourceIndex, 1);
    newSongs.splice(targetIndex, 0, removed);
    const newSongIds = newSongs.map((s) => s.id);
    updatePlaylist(playlist.id, { songIds: newSongIds });
    if (currentSong && newSongs.some((s) => s.id === currentSong.id)) {
      setCurrentPlaylist(newSongs);
    }
    resetDrag();
  };

  const handleDragEnd = () => resetDrag();
  const resetDrag = () => {
    setDraggedSongId(null);
    setDragOverIndex(null);
    setDragSourceIndex(null);
  };

  // Estilos
  const solidBackgroundStyle = {
    backgroundColor: `rgb(${dynD.r}, ${dynD.g}, ${dynD.b})`,
    transition: "background-color 1.2s ease",
  };

  const bannerStyle = {
    backgroundImage: coverUrl ? `url(${coverUrl})` : "none",
    backgroundSize: "cover",
    backgroundPosition: "center 30%",
  };

  const fadeOverlay = {
    background: `linear-gradient(to bottom, 
      rgba(${dynV.r}, ${dynV.g}, ${dynV.b}, 0.3) 0%, 
      rgba(${dynD.r}, ${dynD.g}, ${dynD.b}, 0) 55%, 
      rgba(${dynD.r}, ${dynD.g}, ${dynD.b}, 1) 100%
    )`,
  };

  const glassmorphismStyle = {
    background: "rgba(255, 255, 255, 0.2)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  };

  const glassButtonStyle = {
    background: "rgba(255, 255, 255, 0.2)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    transition: "all 150ms ease",
    cursor: "pointer",
    color: "white",
  };

  const isSaveDisabled = !editingTitle.trim();

  return (
    <div
      className="cloud-themed-page min-h-screen text-white"
      style={solidBackgroundStyle}
    >
      {/* Banner */}
      <div className="cloud-detail-banner relative w-full h-80 md:h-96 overflow-hidden">
        {coverUrl &&
          (coverUrl.startsWith("http") ||
            coverUrl.startsWith("/") ||
            coverUrl.startsWith("blob:") ||
            coverUrl.startsWith("data:")) && (
            <div className="absolute inset-0" style={bannerStyle} />
          )}
        <div className="absolute inset-0" style={fadeOverlay} />

        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-end md:items-end px-6 pt-20 pb-6 h-full w-full">
          <div
            className="w-72 h-72 rounded-2xl shadow-2xl overflow-hidden flex-shrink-0 ring-4 ring-white/30"
            style={glassmorphismStyle}
          >
            {coverUrl &&
            (coverUrl.startsWith("http") ||
              coverUrl.startsWith("/") ||
              coverUrl.startsWith("blob:") ||
              coverUrl.startsWith("data:")) ? (
              <img
                src={coverUrl}
                alt={playlist.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-12 h-12 opacity-80" />
              </div>
            )}
          </div>
          <div className="flex-1 pb-2">
            <h1 className="text-4xl md:text-5xl font-extrabold drop-shadow-lg mb-1">
              {playlist.title}
            </h1>
            {playlist.description && (
              <p className="text-white/80 text-sm mb-2 max-w-2xl line-clamp-2 drop-shadow">
                {playlist.description}
              </p>
            )}
            <p className="text-white/60 text-xs mb-3 drop-shadow">
              {playlistSongs.length} canciones •{" "}
              {formatTotalDuration(playlistSongs)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handlePlayAll}
                className="flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm"
                style={glassmorphismStyle}
              >
                <Play className="w-4 h-4 fill-current" />
                Reproducir
              </button>
              <button
                onClick={handleShuffle}
                className="flex items-center justify-center w-10 h-10 rounded-full"
                style={glassmorphismStyle}
              >
                <Shuffle className="w-4 h-4" />
              </button>
              <button
                onClick={handleEditPlaylist}
                className="flex items-center justify-center w-10 h-10 rounded-full"
                style={glassmorphismStyle}
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setAddSongsModalOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-full"
                style={glassmorphismStyle}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de canciones */}
      <div className="relative z-10 px-6 pb-32 mt-0">
        <div className="mt-8">
          <div className="grid grid-cols-[48px_1fr_1fr_80px] gap-4 px-4 pb-2 border-b border-white/20 text-white/50 text-xs uppercase tracking-wider">
            <div className="text-left pl-5">#</div>
            <div className="text-left pl-11">Canción</div>
            <div className="text-center">Artista</div>
            <div className="text-left">Duración</div>
          </div>
          <div className="cloud-themed-list mt-2 space-y-2">
            {playlistSongs.map((song, idx) => {
              const isCurrent = currentSong?.id === song.id;
              return (
                <div
                  key={song.id}
                  className={`grid grid-cols-[48px_1fr_1fr_80px] gap-4 items-center p-2 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/10 ${
                    idx % 2 === 0 ? "bg-white/5" : ""
                  } ${isCurrent ? "bg-white/15" : ""}`}
                  onClick={() => handlePlaySong(song)}
                >
                  <div className="text-left text-white/60 text-sm pl-7">
                    {idx + 1}
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-black/20">
                      {song.coverUrl && !song.coverUrl.startsWith("/album") ? (
                        <img
                          src={song.coverUrl}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="w-5 h-5 m-auto mt-2.5 opacity-60" />
                      )}
                    </div>
                    <span
                      className={`font-semibold text-white truncate ${isCurrent ? "text-primary" : ""}`}
                    >
                      {song.title}
                    </span>
                  </div>
                  <div className="text-center text-white/65 text-sm truncate">
                    {song.artist}
                  </div>
                  <div className="text-left text-white/55 text-sm pl-2">
                    {formatDuration(song.duration)}
                  </div>
                </div>
              );
            })}
          </div>
          {playlistSongs.length === 0 && (
            <div className="text-center py-8 text-white/40">
              No hay canciones en esta playlist
            </div>
          )}
        </div>
      </div>

      {/* MODAL EDITAR PLAYLIST */}
      {editModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(6px)" }}
          onClick={() => setEditModalOpen(false)}
        >
          <div
            className="w-full max-w-lg mx-4 p-6 rounded-2xl"
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4 text-white">
              Editar playlist
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Título (obligatorio)"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
              <textarea
                placeholder="Descripción (opcional)"
                rows={2}
                value={editingDescription}
                onChange={(e) => setEditingDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/30 text-white placeholder-white/60 focus:outline-none"
              />
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/10">
                  {tempCoverPreview || coverUrl ? (
                    <img
                      src={tempCoverPreview || coverUrl}
                      className="w-full h-full object-cover"
                      alt="preview"
                    />
                  ) : (
                    <Music className="w-6 h-6 m-auto mt-5 text-white/60" />
                  )}
                </div>
                <label
                  className="cursor-pointer px-3 py-2 rounded-lg text-sm transition-all hover:scale-105"
                  style={glassButtonStyle}
                >
                  <Upload className="w-4 h-4 inline mr-1" /> Cambiar imagen
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverFileChange}
                  />
                </label>
              </div>

              {/* Lista de canciones con drag & drop */}
              <div className="mt-2">
                <h3 className="text-sm font-semibold text-white/70 mb-2">
                  Canciones en esta playlist
                </h3>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {playlistSongs.length === 0 ? (
                    <p className="text-sm text-white/40 text-center py-2">
                      No hay canciones
                    </p>
                  ) : (
                    playlistSongs.map((song, idx) => (
                      <div
                        key={song.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, song.id, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={`relative flex items-center justify-between gap-2 p-2 rounded-lg transition ${
                          dragOverIndex === idx
                            ? "bg-white/20"
                            : "bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        {dragOverIndex === idx && draggedSongId !== song.id && (
                          <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/60 rounded-full" />
                        )}
                        <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-4 h-4 text-white/50" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {song.title}
                          </p>
                          <p className="text-xs text-white/60 truncate">
                            {song.artist}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemoveSong(song.id, song.title)}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-105 hover:bg-red-500/20"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-white/80" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95"
                style={glassButtonStyle}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaveDisabled}
                className={`px-4 py-2 rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 ${
                  isSaveDisabled ? "opacity-50 cursor-not-allowed" : ""
                }`}
                style={{
                  ...glassButtonStyle,
                  background: isSaveDisabled
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.3)",
                }}
              >
                Guardar
              </button>
              <button
                onClick={handleDeletePlaylist}
                className="px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95"
                style={glassButtonStyle}
              >
                Eliminar playlist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AÑADIR CANCIONES */}
      {addSongsModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(6px)" }}
          onClick={() => setAddSongsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] mx-4 flex flex-col p-6 rounded-2xl"
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Añadir canciones</h2>
              <button
                onClick={() => setAddSongsModalOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white/80" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1">
              {availableSongs.length === 0 ? (
                <p className="text-center py-8 text-white/60">
                  No hay más canciones disponibles
                </p>
              ) : (
                <div className="space-y-2">
                  {availableSongs.map((song) => (
                    <div
                      key={song.id}
                      className="flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/15"
                      onClick={() => handleAddSong(song.id)}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-white">{song.title}</p>
                        <p className="text-sm text-white/70">{song.artist}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSong(song.id);
                        }}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95"
                        style={glassButtonStyle}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setAddSongsModalOpen(false)}
              className="mt-4 w-full py-2 rounded-full font-semibold transition-all duration-150 hover:scale-[1.02] active:scale-95"
              style={glassButtonStyle}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR CANCIÓN */}
      {confirmModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(6px)" }}
          onClick={cancelDelete}
        >
          <div
            className="w-80 p-6 rounded-2xl text-center"
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-white text-sm mb-6">
              ¿Seguro que quieres eliminar{" "}
              <span className="font-bold">{songToDelete?.title}</span> de la
              playlist?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95"
                style={glassButtonStyle}
              >
                No
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95"
                style={{
                  ...glassButtonStyle,
                  background: "rgba(220, 38, 38, 0.3)",
                }}
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR PLAYLIST */}
      {deletePlaylistModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(6px)" }}
          onClick={() => setDeletePlaylistModalOpen(false)}
        >
          <div
            className="w-80 p-6 rounded-2xl text-center"
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
              boxShadow:
                "0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-white text-sm mb-6">
              ¿Eliminar la playlist{" "}
              <span className="font-bold">"{playlist.title}"</span>? Esta acción
              no se puede deshacer.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setDeletePlaylistModalOpen(false)}
                className="px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95"
                style={glassButtonStyle}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeletePlaylist}
                className="px-4 py-2 rounded-lg transition-all hover:scale-105 active:scale-95"
                style={{
                  ...glassButtonStyle,
                  background: "rgba(220, 38, 38, 0.3)",
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helpers ---
function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTotalDuration(songs: Song[]): string {
  const totalSecs = songs.reduce((acc, s) => acc + (s.duration || 0), 0);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  if (hours > 0)
    return `${hours} hora${hours !== 1 ? "s" : ""} ${mins} minuto${mins !== 1 ? "s" : ""}`;
  return `${mins} minuto${mins !== 1 ? "s" : ""}`;
}
