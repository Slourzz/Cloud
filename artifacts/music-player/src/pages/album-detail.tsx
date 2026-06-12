import { useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Disc3, Heart, Music2, Play, Shuffle } from "lucide-react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { useAppearance } from "@/providers/appearance-provider";

export default function AlbumDetail() {
  const { artist, album } = useParams<{ artist: string; album: string }>();
  const [, navigate] = useLocation();
  const { allSongs, likedSongs, play, setCurrentPlaylist, toggleLike } =
    useMusicPlayer();
  const { settings } = useAppearance();
  const decodedArtist = decodeURIComponent(artist ?? "");
  const decodedAlbum = decodeURIComponent(album ?? "");
  const isSimplyUI = settings.interfaceTheme === "simplyui";

  const songs = useMemo(
    () =>
      allSongs.filter(
        (song) =>
          song.artist === decodedArtist &&
          (song.album || "Mis archivos") === decodedAlbum,
      ),
    [allSongs, decodedAlbum, decodedArtist],
  );
  const cover = songs.find((song) => song.coverUrl)?.coverUrl;
  const isFavorite =
    songs.length > 0 && songs.every((song) => likedSongs.has(song.id));

  const playSongs = (shuffle = false) => {
    if (songs.length === 0) return;
    const ordered = shuffle
      ? [...songs].sort(() => Math.random() - 0.5)
      : songs;
    setCurrentPlaylist(ordered);
    play(ordered[0]);
  };

  return (
    <main className="cloud-theme-root cloud-themed-page min-h-full overflow-y-auto px-6 pb-36 pt-8 text-white sm:px-10">
      <button
        type="button"
        onClick={() => navigate("/home")}
        className="mb-8 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/16"
        aria-label="Volver"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <section className="mx-auto max-w-6xl">
        <header className="flex flex-col items-start gap-7 border-b border-white/10 pb-9 sm:flex-row sm:items-end">
          <div
            className="flex aspect-square w-56 shrink-0 items-center justify-center overflow-hidden rounded-lg"
            style={{
              background: "var(--cloud-surface-strong)",
              boxShadow: isSimplyUI ? "none" : "var(--cloud-shadow)",
              border: "1px solid var(--cloud-border)",
              backdropFilter: "var(--cloud-glass-filter)",
            }}
          >
            {cover ? (
              <img
                src={cover}
                alt={decodedAlbum}
                className="h-full w-full object-cover"
              />
            ) : (
              <Disc3 className="h-20 w-20 text-white/45" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-black uppercase text-white/50">
              Album
            </p>
            <h1 className="truncate text-4xl font-black sm:text-6xl">
              {decodedAlbum}
            </h1>
            <p className="mt-3 text-lg font-bold text-white/68">
              {decodedArtist} · {songs.length} canciones
            </p>
            <div className="mt-7 flex items-center gap-3">
              <button
                type="button"
                onClick={() => playSongs()}
                className="flex h-12 items-center gap-2 rounded-full bg-white px-6 font-black text-black"
              >
                <Play className="h-5 w-5 fill-current" />
                Reproducir
              </button>
              <button
                type="button"
                onClick={() => playSongs(true)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/16"
                aria-label="Reproducir aleatoriamente"
              >
                <Shuffle className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextFavoriteState = !isFavorite;
                  songs.forEach((song) => {
                    if (likedSongs.has(song.id) !== nextFavoriteState) {
                      toggleLike(song.id);
                    }
                  });
                }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/16"
                aria-label="Marcar album como favorito"
              >
                <Heart
                  className="h-5 w-5"
                  fill={isFavorite ? "currentColor" : "none"}
                />
              </button>
            </div>
          </div>
        </header>

        <div className="mt-5">
          {songs.map((song, index) => (
            <button
              key={song.id}
              type="button"
              onClick={() => {
                setCurrentPlaylist(songs);
                play(song);
              }}
              className="grid w-full grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-md px-3 py-3 text-left hover:bg-white/8"
            >
              <span className="text-sm font-bold text-white/45">
                {index + 1}
              </span>
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-white/8">
                  {song.coverUrl ? (
                    <img
                      src={song.coverUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Music2 className="h-4 w-4 text-white/45" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-bold">{song.title}</span>
                  <span className="block truncate text-sm text-white/52">
                    {song.artist}
                  </span>
                </span>
              </span>
              <span className="text-sm font-semibold text-white/50">
                {formatTime(song.duration)}
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function formatTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${Math.floor(safeSeconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
