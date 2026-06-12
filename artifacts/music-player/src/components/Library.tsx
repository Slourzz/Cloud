import { useState } from "react";
import { Link } from "wouter";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { usePlaylists } from "@/hooks/use-playlists";
import { Heart, Music2, User, Disc3 } from "lucide-react";

type LibraryTab = "artist" | "az" | "albums";

export default function Library() {
  const { allSongs, likedSongs } = useMusicPlayer();
  const { playlists } = usePlaylists();
  const [activeTab, setActiveTab] = useState<LibraryTab>("artist");

  // Datos derivados
  const likedSongIds = [...likedSongs];
  const likedPlaylists = playlists.filter((p) => likedSongIds.some((id) => p.songIds.includes(id)));

  const artists = [...new Set(allSongs.map((s) => s.artist))].sort((a, b) => a.localeCompare(b));
  const albums = [...new Set(allSongs.map((s) => s.album || "Sin álbum"))].sort((a, b) => a.localeCompare(b));

  // Estilos vidrio
  const glassPanel = {
    background: "rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  };

  const glassCard = {
    background: "rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "1.5rem",
  };

  return (
    <div className="flex h-full">
      {/* Panel izquierdo – Biblioteca */}
      <div className="w-72 shrink-0 h-full flex flex-col border-r border-white/10" style={glassPanel}>
        {/* Encabezado */}
        <div className="px-5 pt-6 pb-3">
          <h1 className="text-2xl font-bold text-white">Biblioteca</h1>
        </div>

        {/* Pestañas de filtro */}
        <div className="flex gap-1 px-4 pb-3">
          {(["artist", "az", "albums"] as LibraryTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                activeTab === tab
                  ? "bg-white/20 text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              {tab === "artist" ? "Artista" : tab === "az" ? "A-Z" : "Álbums"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-6">
          {/* Sección Me Gusta (siempre visible) */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50 px-3 py-1.5">
              Me Gusta
            </h3>
            <ul className="space-y-1">
              {likedSongIds.size > 0 ? (
                <>
                  <li>
                    <Link href="/liked" className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-sm text-white/70 hover:text-white transition">
                      <Heart className="w-4 h-4 text-red-400" />
                      <span>Me Gusta</span>
                    </Link>
                  </li>
                  {likedPlaylists.slice(0, 3).map((pl) => (
                    <li key={pl.id}>
                      <Link href={`/playlists/${pl.id}`} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-sm text-white/70 hover:text-white transition truncate">
                        <Music2 className="w-4 h-4 opacity-60" />
                        <span className="truncate">{pl.title}</span>
                      </Link>
                    </li>
                  ))}
                </>
              ) : (
                <li className="px-3 py-2 text-sm text-white/40">No hay "Me gusta" aún</li>
              )}
            </ul>
          </div>

          {/* Contenido dinámico según pestaña activa */}
          {activeTab === "artist" && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50 px-3 py-1.5">
                Artistas
              </h3>
              <ul className="space-y-1">
                {artists.slice(0, 10).map((artist) => (
                  <li key={artist}>
                    <button
                      onClick={() => {
                        // Navegar o filtrar canciones de ese artista
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-sm text-white/70 hover:text-white transition w-full text-left"
                    >
                      <User className="w-4 h-4 opacity-60" />
                      <span className="truncate">{artist}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === "az" && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50 px-3 py-1.5">
                A-Z
              </h3>
              <ul className="space-y-1">
                {allSongs
                  .slice()
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .slice(0, 20)
                  .map((song) => (
                    <li key={song.id}>
                      <button
                        onClick={() => {
                          // Reproducir canción
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-sm text-white/70 hover:text-white transition w-full text-left"
                      >
                        <Music2 className="w-4 h-4 opacity-60" />
                        <span className="truncate">{song.title}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {activeTab === "albums" && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50 px-3 py-1.5">
                Álbums
              </h3>
              <ul className="space-y-1">
                {albums.slice(0, 10).map((album) => (
                  <li key={album}>
                    <button
                      onClick={() => {
                        // Navegar o filtrar canciones del álbum
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-sm text-white/70 hover:text-white transition w-full text-left"
                    >
                      <Disc3 className="w-4 h-4 opacity-60" />
                      <span className="truncate">{album}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Panel principal – Contenido */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Saludo dinámico */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white drop-shadow-lg">Buenos días</h2>
          <p className="text-white/60 text-sm">Explora tu colección</p>
        </div>

        {/* Tarjetas superiores (3 columnas) – placeholder */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="aspect-square rounded-2xl flex items-center justify-center" style={glassCard}>
              <Music2 className="w-12 h-12 text-white/20" />
            </div>
          ))}
        </div>

        <hr className="border-white/10 mb-6" />

        {/* Tus Playlists (scroll) */}
        <h3 className="text-xl font-semibold text-white/90 mb-4">Tus Playlists</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {playlists.slice(0, 6).map((playlist) => (
            <Link key={playlist.id} href={`/playlists/${playlist.id}`}>
              <div className="rounded-2xl p-3 transition hover:scale-[1.02] hover:shadow-xl" style={glassCard}>
                <div className="w-full aspect-square rounded-lg bg-white/10 flex items-center justify-center mb-3">
                  {playlist.customCoverUrl ? (
                    <img src={playlist.customCoverUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <Music2 className="w-8 h-8 text-white/40" />
                  )}
                </div>
                <p className="font-semibold text-white truncate">{playlist.title}</p>
                <p className="text-xs text-white/60">{playlist.songIds.length} canciones</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
