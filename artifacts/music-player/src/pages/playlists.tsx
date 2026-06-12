import React, { useState } from "react";
import { Link } from "wouter";
import { usePlaylists, getPlaylistCoverStyle } from "@/hooks/use-playlists";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { CreatePlaylistDialog } from "@/components/create-playlist-dialog";
import { ListMusic, Plus, Play, MoreVertical, Trash2 } from "lucide-react";

export default function Playlists() {
  const { playlists, deletePlaylist } = usePlaylists();
  const { allSongs, play } = useMusicPlayer();
  const [createOpen, setCreateOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const handlePlayPlaylist = (e: React.MouseEvent, playlistId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist || playlist.songIds.length === 0) return;
    const firstSong = allSongs.find((s) => s.id === playlist.songIds[0]);
    if (firstSong) play(firstSong);
  };

  return (
    <div className="cloud-themed-page playlists-root flex h-full flex-col animate-in fade-in duration-500">
      <div
        className="playlists-header sticky top-0 z-10 border-b border-outline-variant/20 px-8 pb-4 pt-8"
        style={{
          background: "hsl(var(--background) / 0.9)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="playlists-header-content flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-on-surface">Explorar</h1>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              {playlists.length > 0
                ? `${playlists.length} playlist${playlists.length !== 1 ? "s" : ""}`
                : "Crea tu primera playlist"}
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="playlists-create-button ripple flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Nueva playlist
          </button>
        </div>
      </div>

      <div className="playlists-content flex-1 overflow-y-auto px-6 py-6 pb-28">
        {playlists.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-6 py-16 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-surface-container">
              <ListMusic className="h-12 w-12 text-on-surface-variant/40" />
            </div>
            <div>
              <h2 className="mb-2 text-xl font-bold text-on-surface">
                Aun no tienes playlists
              </h2>
              <p className="max-w-sm text-sm text-on-surface-variant">
                Crea playlists para organizar y compartir tu musica favorita
              </p>
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              className="ripple flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-5 w-5" />
              Crear primera playlist
            </button>
          </div>
        ) : (
          <div className="playlists-grid grid gap-4">
            {playlists.map((playlist, i) => {
              const songCount = playlist.songIds.length;

              return (
                <Link key={playlist.id} href={`/playlists/${playlist.id}`}>
                  <div
                    className="playlist-card group relative min-w-0 cursor-pointer animate-in fade-in zoom-in-95"
                    style={{
                      animationDelay: `${i * 50}ms`,
                      animationFillMode: "both",
                    }}
                    onClick={() => setMenuOpen(null)}
                  >
                    <div
                      className="playlist-cover relative mb-3 aspect-square w-full overflow-hidden rounded-[20px] transition-all duration-300 group-hover:scale-[0.97] group-hover:shadow-xl"
                      style={getPlaylistCoverStyle(playlist)}
                    >
                      <div className="absolute inset-0 flex items-end justify-end bg-black/30 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => handlePlayPlaylist(e, playlist.id)}
                          className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg transition-transform hover:scale-110"
                          disabled={songCount === 0}
                        >
                          <Play className="ml-0.5 h-5 w-5 fill-current text-black" />
                        </button>
                      </div>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMenuOpen(
                            menuOpen === playlist.id ? null : playlist.id,
                          );
                        }}
                        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/50 group-hover:opacity-100"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      {menuOpen === playlist.id && (
                        <div
                          className="absolute right-3 top-12 z-10 min-w-36 overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface shadow-xl"
                          onClick={(e) => e.preventDefault()}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePlaylist(playlist.id);
                              setMenuOpen(null);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-error transition-colors hover:bg-error/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 px-1">
                      <p className="truncate text-sm font-bold leading-tight text-on-surface">
                        {playlist.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-on-surface-variant">
                        {songCount === 0
                          ? "Vacia"
                          : `${songCount} cancion${songCount !== 1 ? "es" : ""}`}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <CreatePlaylistDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <style>{`
        .playlists-root {
          container-type: inline-size;
        }

        .playlists-header,
        .playlists-content {
          padding-inline: clamp(1.5rem, 2.25cqw, 2rem);
        }

        .playlists-header-content {
          min-height: 3rem;
        }

        .playlists-create-button {
          flex-shrink: 0;
          min-height: 2.5rem;
          white-space: nowrap;
        }

        .playlists-grid {
          grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
          grid-template-columns: repeat(auto-fill, minmax(clamp(170px, 18cqw, 240px), 1fr));
          align-items: start;
        }

        .playlist-card {
          max-width: 280px;
        }

        .playlist-cover {
          max-width: 100%;
        }

        @container (max-width: 820px) {
          .playlists-grid {
            grid-template-columns: repeat(auto-fill, minmax(clamp(150px, 32cqw, 220px), 1fr));
          }
        }

        @container (max-width: 560px) {
          .playlists-header,
          .playlists-content {
            padding-inline: 1.1rem;
          }

          .playlists-header-content {
            align-items: flex-start;
            flex-direction: column;
          }

          .playlists-create-button {
            width: 100%;
            justify-content: center;
          }

          .playlists-grid {
            grid-template-columns: repeat(auto-fill, minmax(138px, 1fr));
          }

          .playlist-card {
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
}
