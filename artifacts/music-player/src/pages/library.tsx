import React, { useState, useRef } from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { Search, Play, Camera, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Library() {
  const { allSongs, currentSong, play, isPlaying, updateSongCover, deleteSong, isLoadingLibrary } = useMusicPlayer();
  const [search, setSearch] = useState("");
  const [coveringSongId, setCoveringSongId] = useState<string | null>(null);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const pendingCoverSongIdRef = useRef<string | null>(null);

  const filtered = allSongs.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase()) ||
      s.album.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleCoverClick = (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    pendingCoverSongIdRef.current = songId;
    coverInputRef.current?.click();
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const songId = pendingCoverSongIdRef.current;
    if (!file || !songId) return;
    e.target.value = "";
    setCoveringSongId(songId);
    await updateSongCover(songId, file).catch(() => {});
    setCoveringSongId(null);
    pendingCoverSongIdRef.current = null;
  };

  const handleDelete = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingSongId(songId);
    await deleteSong(songId).catch(() => {});
    setDeletingSongId(null);
  };

  return (
    <div className="h-full flex flex-col page-enter">
      {/* Hidden cover image input */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverFileChange}
      />

      {/* Sticky header */}
      <div
        className="sticky top-0 z-10 px-8 pt-8 pb-4 border-b border-outline-variant/15"
        style={{ background: "hsl(var(--background) / 0.85)", backdropFilter: "blur(16px)" }}
      >
        <h1 className="text-2xl font-bold text-on-surface mb-4 select-none">Biblioteca</h1>
        <div
          className="relative flex items-center h-12 rounded-full px-4 gap-2 max-w-lg"
          style={{
            background: "hsl(var(--surface-high))",
            boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 0 0 1px hsl(var(--outline-variant) / 0.25)",
            transition: "box-shadow 200ms ease",
          }}
        >
          <Search className="w-4 h-4 text-on-surface-variant shrink-0 transition-colors duration-200" />
          <input
            type="text"
            placeholder="Buscar canciones, artistas, álbumes..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-on-surface placeholder:text-on-surface-variant"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-on-surface-variant hover:text-on-surface transition-colors text-xs font-bold fade-scale-in"
            >
              ✕
            </button>
          )}
        </div>
        <p className="text-xs text-on-surface-variant mt-2 ml-1 select-none transition-all duration-300">
          {isLoadingLibrary ? "Cargando..." : `${filtered.length} ${filtered.length === 1 ? "canción" : "canciones"}`}
        </p>
      </div>

      {/* Table header */}
      <div className="px-8 py-3 grid grid-cols-[2rem_1fr_1fr_6rem_5rem] gap-4 border-b border-outline-variant/10 text-xs font-bold uppercase tracking-wider text-on-surface-variant select-none">
        <span className="text-center">#</span>
        <span>Título</span>
        <span>Álbum</span>
        <span className="text-right">Duración</span>
        <span />
      </div>

      {/* Songs list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 pb-28">
        {isLoadingLibrary ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-on-surface-variant fade-scale-in">
            <div className="relative">
              <Loader2 className="w-8 h-8 animate-spin opacity-35" />
            </div>
            <p className="text-sm">Cargando tu biblioteca...</p>
          </div>
        ) : (
          <>
            {filtered.map((song, i) => {
              const isCurrent = currentSong?.id === song.id;
              const isCovering = coveringSongId === song.id;
              const isDeleting = deletingSongId === song.id;

              return (
                <div
                  key={song.id}
                  onDoubleClick={() => play(song)}
                  onClick={() => play(song)}
                  className={cn(
                    "grid grid-cols-[2rem_1fr_1fr_6rem_5rem] gap-4 items-center px-4 py-2.5 rounded-xl cursor-pointer group stagger-item",
                    isCurrent
                      ? "bg-secondary-container text-on-secondary-container"
                      : "hover:bg-surface-container",
                    isDeleting && "opacity-30 pointer-events-none scale-[0.98]"
                  )}
                  style={{
                    animationDelay: `${Math.min(i * 18, 360)}ms`,
                    transition: "background-color 160ms ease, opacity 300ms ease, transform 300ms cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                >
                  {/* Index / playing indicator */}
                  <div className="flex items-center justify-center select-none">
                    {isCurrent && isPlaying ? (
                      <div className="flex items-end gap-[2px] h-4">
                        {[0.5, 1, 0.65].map((h, j) => (
                          <div
                            key={j}
                            className="w-0.5 rounded-full"
                            style={{
                              height: `${h * 14}px`,
                              background: "hsl(var(--primary))",
                              animation: `waveform ${0.55 + j * 0.15}s ease-in-out ${j * 0.1}s infinite alternate`,
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <>
                        <span className={cn(
                          "text-xs font-medium group-hover:opacity-0 group-hover:scale-75 transition-all duration-150",
                          isCurrent ? "text-on-secondary-container" : "text-on-surface-variant"
                        )}>
                          {i + 1}
                        </span>
                        {!isCurrent && (
                          <Play
                            className="w-3.5 h-3.5 fill-current text-on-surface absolute opacity-0 group-hover:opacity-100 transition-all duration-150"
                            style={{ transform: "scale(0.8)", transition: "opacity 150ms ease, transform 150ms cubic-bezier(0.34,1.56,0.64,1)" }}
                          />
                        )}
                      </>
                    )}
                  </div>

                  {/* Title + Artist + Thumbnail */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail */}
                    <button
                      className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 group/cover focus:outline-none"
                      onClick={(e) => handleCoverClick(song.id, e)}
                      title="Cambiar portada"
                      style={{
                        transition: "transform 200ms cubic-bezier(0.34,1.56,0.64,1)",
                      }}
                    >
                      {isCovering ? (
                        <div className="w-full h-full flex items-center justify-center bg-surface-high">
                          <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant" />
                        </div>
                      ) : (
                        <>
                          <img
                            src={song.coverUrl}
                            alt={song.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover/cover:scale-110"
                          />
                          <div className="absolute inset-0 bg-black/55 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                            <Camera className="w-4 h-4 text-white transition-transform duration-200 scale-75 group-hover/cover:scale-100" />
                          </div>
                        </>
                      )}
                    </button>

                    <div className="min-w-0">
                      <p className={cn(
                        "text-sm font-semibold truncate leading-tight",
                        isCurrent ? "text-on-secondary-container" : "text-on-surface"
                      )}>
                        {song.title}
                      </p>
                      <p className={cn(
                        "text-xs truncate leading-tight mt-0.5",
                        isCurrent ? "text-on-secondary-container/70" : "text-on-surface-variant"
                      )}>
                        {song.artist}
                        {song.isUserUploaded && (
                          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] bg-primary-container text-on-primary-container font-bold">
                            SUBIDO
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Album */}
                  <p className={cn(
                    "text-sm truncate select-none",
                    isCurrent ? "text-on-secondary-container/80" : "text-on-surface-variant"
                  )}>
                    {song.album}
                  </p>

                  {/* Duration */}
                  <span className={cn(
                    "text-sm text-right tabular-nums select-none",
                    isCurrent ? "text-on-secondary-container/80" : "text-on-surface-variant"
                  )}>
                    {formatTime(song.duration)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin text-on-surface-variant" />
                    ) : (
                      <button
                        className="icon-btn w-7 h-7 opacity-0 group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-500 text-on-surface-variant"
                        style={{
                          transition: "opacity 150ms ease, transform 150ms cubic-bezier(0.34,1.56,0.64,1), color 150ms ease, background-color 150ms ease",
                        }}
                        onClick={(e) => handleDelete(song.id, e)}
                        title="Eliminar canción"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {!isLoadingLibrary && filtered.length === 0 && search && (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-on-surface-variant fade-scale-in">
                <Search className="w-12 h-12 opacity-18" />
                <p className="text-base font-medium">Sin resultados para "{search}"</p>
                <button
                  onClick={() => setSearch("")}
                  className="text-sm text-primary hover:underline transition-colors"
                >
                  Limpiar búsqueda
                </button>
              </div>
            )}

            {!isLoadingLibrary && allSongs.length === 0 && !search && (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-on-surface-variant fade-scale-in">
                <p className="text-base font-medium opacity-40">Tu biblioteca está vacía</p>
                <p className="text-sm opacity-28">Sube canciones desde la pantalla principal</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
