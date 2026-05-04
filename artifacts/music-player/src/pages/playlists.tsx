import React, { useState } from "react";
import { Link } from "wouter";
import { usePlaylists, getPlaylistCoverStyle } from "@/hooks/use-playlists";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { CreatePlaylistDialog } from "@/components/create-playlist-dialog";
import { ListMusic, Plus, Play, MoreVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="h-full flex flex-col animate-in fade-in duration-500">
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-8 pt-8 pb-4 border-b border-outline-variant/20"
        style={{ background: "hsl(var(--background) / 0.9)", backdropFilter: "blur(12px)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">Explorar</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {playlists.length > 0
                ? `${playlists.length} playlist${playlists.length !== 1 ? "s" : ""}`
                : "Crea tu primera playlist"}
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold ripple hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Nueva playlist
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 pb-28">
        {playlists.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-16">
            <div className="w-24 h-24 rounded-[28px] bg-surface-container flex items-center justify-center">
              <ListMusic className="w-12 h-12 text-on-surface-variant/40" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface mb-2">Aún no tienes playlists</h2>
              <p className="text-on-surface-variant max-w-sm text-sm">
                Crea playlists para organizar y compartir tu música favorita
              </p>
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold ripple hover:opacity-90 transition-opacity"
            >
              <Plus className="w-5 h-5" />
              Crear primera playlist
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
            {playlists.map((playlist, i) => {
              const songCount = playlist.songIds.length;
              return (
                <Link key={playlist.id} href={`/playlists/${playlist.id}`}>
                  <div
                    className="group relative cursor-pointer animate-in fade-in zoom-in-95"
                    style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
                    onClick={() => setMenuOpen(null)}
                  >
                    {/* Cover */}
                    <div
                      className="w-full aspect-square rounded-[20px] mb-3 relative overflow-hidden transition-all duration-300 group-hover:scale-[0.97] group-hover:shadow-xl"
                      style={getPlaylistCoverStyle(playlist)}
                    >
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/30 flex items-end justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => handlePlayPlaylist(e, playlist.id)}
                          className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                          disabled={songCount === 0}
                        >
                          <Play className="w-5 h-5 text-black fill-current ml-0.5" />
                        </button>
                      </div>

                      {/* More button */}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(menuOpen === playlist.id ? null : playlist.id); }}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/50"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {menuOpen === playlist.id && (
                        <div
                          className="absolute top-12 right-3 bg-surface border border-outline-variant/30 rounded-2xl overflow-hidden shadow-xl z-10 min-w-36"
                          onClick={(e) => e.preventDefault()}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); deletePlaylist(playlist.id); setMenuOpen(null); }}
                            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-error hover:bg-error/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="px-1">
                      <p className="text-sm font-bold text-on-surface truncate leading-tight">{playlist.title}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {songCount === 0 ? "Vacía" : `${songCount} canción${songCount !== 1 ? "es" : ""}`}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <CreatePlaylistDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
