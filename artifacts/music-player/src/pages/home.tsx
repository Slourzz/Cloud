import { useState, useEffect, useRef, useMemo } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useMusicPlayer, Song } from "@/hooks/use-music-player";
import { usePlaylists } from "@/hooks/use-playlists";
import {
  Play,
  Search,
  Music,
  Loader2,
  User,
  X,
  ListPlus,
  Disc3,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { CustomScrollbar } from "@/components/CustomScrollbar";
import TimeLogo from "@/components/TimeLogo";
import { useTranslation } from "@/hooks/use-translations";
import { useArtistImage } from "@/hooks/use-artist-image";
import { useDiscordAuth } from "@/hooks/use-discord-auth";

type AlbumCard = {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  songs: Song[];
};

type HomeShelfItem = {
  id: string;
  title: string;
  subtitle?: string;
  coverUrl?: string | null;
  onSelect: () => void;
};

function ArtistImage({
  artist,
  fallback,
}: {
  artist: string;
  fallback: string | null;
}) {
  const image = useArtistImage(artist, fallback);

  return (
    <div className="w-11 h-11 rounded-full overflow-hidden bg-white/20 flex-shrink-0 flex items-center justify-center ring-1 ring-white/20 shadow-lg">
      {image ? (
        <img src={image} alt={artist} className="w-full h-full object-cover" />
      ) : (
        <User className="w-5 h-5 text-white/60" />
      )}
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const { user: discordUser } = useDiscordAuth();
  const {
    allSongs,
    play,
    setCurrentPlaylist,
    currentSong,
    isLoadingLibrary,
    addToQueue,
  } = useMusicPlayer();
  const { playlists } = usePlaylists();
  const [recentPlaylists, setRecentPlaylists] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<{
    songs: Song[];
    artists: string[];
    playlists: any[];
  }>({ songs: [], artists: [], playlists: [] });
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const playlistsCarouselRef = useRef<HTMLDivElement>(null);
  const albumsCarouselRef = useRef<HTMLDivElement>(null);
  const [playlistScrollState, setPlaylistScrollState] = useState({
    left: false,
    right: false,
  });
  const [albumScrollState, setAlbumScrollState] = useState({
    left: false,
    right: false,
  });

  useEffect(() => {
    if (playlists.length > 0) {
      const sorted = [...playlists].sort((a, b) => b.createdAt - a.createdAt);
      setRecentPlaylists(sorted);
    }
  }, [playlists]);

  useEffect(() => {
    if (searchTerm.trim().length === 0) {
      setSearchResults({ songs: [], artists: [], playlists: [] });
      setShowResults(false);
      return;
    }

    const term = searchTerm.toLowerCase();
    const matchedSongs = allSongs.filter(
      (song) =>
        song.title.toLowerCase().includes(term) ||
        song.artist.toLowerCase().includes(term),
    );
    const allArtists = [...new Set(allSongs.map((song) => song.artist))];
    const matchedArtists = allArtists.filter((artist) =>
      artist.toLowerCase().includes(term),
    );
    const matchedPlaylists = playlists.filter((playlist) =>
      playlist.title.toLowerCase().includes(term),
    );

    setSearchResults({
      songs: matchedSongs,
      artists: matchedArtists,
      playlists: matchedPlaylists,
    });
    setShowResults(true);
  }, [searchTerm, allSongs, playlists]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const artists = useMemo(() => {
    const map = new Map<string, string | null>();

    allSongs.forEach((song) => {
      if (!map.has(song.artist)) {
        const cover =
          song.coverUrl && !song.coverUrl.startsWith("/album")
            ? song.coverUrl
            : null;
        map.set(song.artist, cover);
      }
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, image]) => ({ name, image }));
  }, [allSongs]);

  const mostPlayedPlaylists = useMemo(() => {
    return [...playlists]
      .sort((a, b) => {
        const playsA = (a as any).playCount ?? (a as any).plays ?? 0;
        const playsB = (b as any).playCount ?? (b as any).plays ?? 0;
        const sizeA = a.songIds?.length ?? 0;
        const sizeB = b.songIds?.length ?? 0;
        return playsB + sizeB * 0.15 - (playsA + sizeA * 0.15);
      })
      .slice(0, 10);
  }, [playlists]);

  const albumCards = useMemo<AlbumCard[]>(() => {
    const albums = new Map<string, AlbumCard>();

    allSongs.forEach((song) => {
      const source = song as any;
      const albumTitle =
        source.album ||
        source.albumName ||
        source.collection ||
        source.release ||
        song.artist;
      const albumArtist = song.artist || "Unknown artist";
      const key = `${albumTitle}-${albumArtist}`.toLowerCase();

      if (!albums.has(key)) {
        albums.set(key, {
          id: key,
          title: albumTitle,
          artist: albumArtist,
          coverUrl:
            song.coverUrl && !song.coverUrl.startsWith("/album")
              ? song.coverUrl
              : null,
          songs: [],
        });
      }

      albums.get(key)?.songs.push(song);
    });

    return Array.from(albums.values())
      .sort((a, b) => {
        const aScore = a.songs.length + (a.coverUrl ? 0.5 : 0);
        const bScore = b.songs.length + (b.coverUrl ? 0.5 : 0);
        return bScore - aScore;
      })
      .slice(0, 12);
  }, [allSongs]);

  const recentlyPlayedSongs = useMemo(() => {
    const songs = currentSong ? [currentSong, ...allSongs] : allSongs;
    return songs
      .filter(
        (song, index, collection) =>
          collection.findIndex((candidate) => candidate.id === song.id) ===
          index,
      )
      .slice(0, 10);
  }, [allSongs, currentSong]);

  const recommendationItems = useMemo<HomeShelfItem[]>(() => {
    const playlistItems = mostPlayedPlaylists.slice(0, 5).map((playlist) => {
      const firstSong = allSongs.find(
        (song) => song.id === playlist.songIds[0],
      );

      return {
        id: `playlist-${playlist.id}`,
        title: playlist.title,
        subtitle: `${playlist.songIds.length} canciones`,
        coverUrl: playlist.customCoverUrl || firstSong?.coverUrl,
        onSelect: () => handlePlayPlaylist(playlist.id),
      };
    });

    const albumItems = albumCards.slice(0, 5).map((album) => ({
      id: `album-${album.id}`,
      title: album.title,
      subtitle: album.artist,
      coverUrl: album.coverUrl,
      onSelect: () => handlePlayAlbum(album),
    }));

    return [...playlistItems, ...albumItems].slice(0, 10);
  }, [albumCards, allSongs, mostPlayedPlaylists]);

  useEffect(() => {
    const el = playlistsCarouselRef.current;
    if (!el) return;

    const updateButtons = () => {
      const hasOverflow = el.scrollWidth > el.clientWidth + 1;
      setPlaylistScrollState({
        left: hasOverflow && el.scrollLeft > 1,
        right:
          hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    };

    const timeoutId = window.setTimeout(updateButtons, 80);
    el.addEventListener("scroll", updateButtons, { passive: true });

    const observer = new ResizeObserver(updateButtons);
    observer.observe(el);

    return () => {
      window.clearTimeout(timeoutId);
      el.removeEventListener("scroll", updateButtons);
      observer.disconnect();
    };
  }, [mostPlayedPlaylists.length]);

  useEffect(() => {
    const el = albumsCarouselRef.current;
    if (!el) return;

    const updateButtons = () => {
      const hasOverflow = el.scrollWidth > el.clientWidth + 1;
      setAlbumScrollState({
        left: hasOverflow && el.scrollLeft > 1,
        right:
          hasOverflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    };

    const timeoutId = window.setTimeout(updateButtons, 80);
    el.addEventListener("scroll", updateButtons, { passive: true });

    const observer = new ResizeObserver(updateButtons);
    observer.observe(el);

    return () => {
      window.clearTimeout(timeoutId);
      el.removeEventListener("scroll", updateButtons);
      observer.disconnect();
    };
  }, [albumCards.length]);

  if (isLoadingLibrary) {
    return (
      <div className="cloud-theme-root flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/50 animate-spin" />
      </div>
    );
  }

  const glassCardStyle: CSSProperties = {
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.13), rgba(255,255,255,0.045)), var(--cloud-surface)",
    backdropFilter: "var(--cloud-glass-filter)",
    WebkitBackdropFilter: "var(--cloud-glass-filter)",
    border: "1px solid var(--cloud-border)",
    borderRadius: "1.5rem",
    boxShadow:
      "0 18px 50px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.24)",
  };

  const softGlassStyle: CSSProperties = {
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055)), var(--cloud-surface-soft)",
    backdropFilter: "var(--cloud-glass-filter)",
    WebkitBackdropFilter: "var(--cloud-glass-filter)",
    border: "1px solid var(--cloud-border)",
    boxShadow:
      "0 16px 40px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.28)",
  };

  const handlePlayPlaylist = (playlistId: string) => {
    const playlist = playlists.find((p) => p.id === playlistId);
    if (!playlist || playlist.songIds.length === 0) return;

    const playlistSongs = playlist.songIds
      .map((id) => allSongs.find((s) => s.id === id))
      .filter(Boolean) as Song[];

    if (playlistSongs.length === 0) return;

    setCurrentPlaylist(playlistSongs);
    play(playlistSongs[0]);
    setShowResults(false);
    setSearchTerm("");
  };

  const handlePlaySong = (song: Song) => {
    setCurrentPlaylist(searchResults.songs);
    play(song);
    setShowResults(false);
    setSearchTerm("");
  };

  const handleSelectArtist = (artist: string) => {
    const artistSongs = allSongs.filter((s) => s.artist === artist);
    if (artistSongs.length > 0) {
      setCurrentPlaylist(artistSongs);
      play(artistSongs[0]);
    }
    setShowResults(false);
    setSearchTerm("");
  };

  const handlePlayAlbum = (album: AlbumCard) => {
    if (album.songs.length === 0) return;
    setCurrentPlaylist(album.songs);
    play(album.songs[0]);
  };

  const scrollCarousel = (
    ref: RefObject<HTMLDivElement | null>,
    direction: "left" | "right",
  ) => {
    const el = ref.current;
    if (!el) return;

    const distance = Math.max(320, Math.round(el.clientWidth * 0.72));
    el.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t.goodMorning;
    if (hour < 18) return t.goodAfternoon;
    return t.goodEvening;
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "manana";
    if (hour < 18) return "tarde";
    return "noche";
  };

  const greeting = getGreeting();
  const timeOfDay = getTimeOfDay();
  const measureText = searchTerm || t.searchPlaceholder;
  const textWidth = measureRef.current ? measureRef.current.offsetWidth : 0;
  const inputWidth = Math.min(Math.max(textWidth + 52, 280), 520);
  const hasResults =
    searchResults.songs.length > 0 ||
    searchResults.artists.length > 0 ||
    searchResults.playlists.length > 0;

  return (
    <>
      <div className="home-page relative z-10 min-h-full w-full pt-12 pb-36 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-8 top-12 h-64 rounded-full bg-white/10 blur-3xl opacity-60 premium-float" />

        <div className="relative flex w-full flex-col gap-8">
          <div className="sticky top-3 z-40 flex w-full justify-center">
            <div className="relative flex w-full max-w-[560px] justify-center">
              <div
                className="premium-search relative flex items-center transition-all duration-300"
                style={{
                  ...softGlassStyle,
                  borderRadius: "9999px",
                  width: `${inputWidth}px`,
                  maxWidth: "100%",
                }}
              >
                <div className="pointer-events-none absolute inset-x-4 top-1 h-5 rounded-full bg-white/20 blur-md" />
                <Search className="absolute left-4 w-4 h-4 text-white/70 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="relative w-full py-3 pl-10 pr-10 text-white placeholder-white/55 outline-none bg-transparent text-sm font-medium"
                  style={{ minWidth: 0 }}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 p-1.5 rounded-full hover:bg-white/15 transition text-white/70 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <span
                ref={measureRef}
                className="absolute invisible whitespace-pre text-sm"
                style={{ paddingLeft: "2.5rem", paddingRight: "1rem" }}
              >
                {measureText}
              </span>

              {showResults && hasResults && (
                <div
                  ref={resultsRef}
                  className="premium-results absolute top-full mt-3 w-full max-w-xl rounded-[28px] z-50 overflow-hidden"
                  style={{
                    ...softGlassStyle,
                    left: "50%",
                    transform: "translateX(-50%)",
                  }}
                >
                  <div className="pointer-events-none absolute inset-x-4 top-1 h-9 rounded-full bg-white/15 blur-xl" />
                  <div className="h-[420px] overflow-hidden rounded-[28px]">
                    <CustomScrollbar
                      className="h-full"
                      size="small"
                      barWidth="6px"
                    >
                      <div className="p-3 space-y-3">
                        {searchResults.songs.length > 0 && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-white/55 px-3 pt-2 pb-1">
                              {t.songs}
                            </p>
                            {searchResults.songs.map((song) => (
                              <div
                                key={song.id}
                                className="group flex items-center gap-3 px-3 py-2.5 hover:bg-white/12 rounded-2xl cursor-pointer transition-all"
                              >
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/20 flex-shrink-0 ring-1 ring-white/15">
                                  {song.coverUrl &&
                                  !song.coverUrl.startsWith("/album") ? (
                                    <img
                                      src={song.coverUrl}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Music className="w-4 h-4 m-auto mt-3 opacity-60" />
                                  )}
                                </div>
                                <div
                                  className="flex-1 min-w-0"
                                  onClick={() => handlePlaySong(song)}
                                >
                                  <p className="text-sm font-semibold text-white truncate">
                                    {song.title}
                                  </p>
                                  <p className="text-xs text-white/60 truncate">
                                    {song.artist}
                                  </p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePlaySong(song);
                                  }}
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 transition"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToQueue(song);
                                  }}
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 transition"
                                >
                                  <ListPlus className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {searchResults.artists.length > 0 && (
                          <div>
                            <div className="border-t border-white/10 my-1" />
                            <p className="text-xs font-bold uppercase tracking-wider text-white/55 px-3 pt-2 pb-1">
                              {t.artists}
                            </p>
                            {searchResults.artists.map((artist) => (
                              <div
                                key={artist}
                                onClick={() => handleSelectArtist(artist)}
                                className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/12 rounded-2xl cursor-pointer transition-all"
                              >
                                <div className="w-9 h-9 rounded-full bg-white/18 flex items-center justify-center ring-1 ring-white/15">
                                  <User className="w-4 h-4 text-white/70" />
                                </div>
                                <span className="text-sm font-medium text-white">
                                  {artist}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {searchResults.playlists.length > 0 && (
                          <div>
                            <div className="border-t border-white/10 my-1" />
                            <p className="text-xs font-bold uppercase tracking-wider text-white/55 px-3 pt-2 pb-1">
                              {t.playlists}
                            </p>
                            {searchResults.playlists.map((playlist) => (
                              <div
                                key={playlist.id}
                                onClick={() => handlePlayPlaylist(playlist.id)}
                                className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/12 rounded-2xl cursor-pointer transition-all"
                              >
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-black/20 flex-shrink-0 ring-1 ring-white/15">
                                  {playlist.customCoverUrl ? (
                                    <img
                                      src={playlist.customCoverUrl}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Music className="w-4 h-4 m-auto mt-3 opacity-60" />
                                  )}
                                </div>
                                <span className="text-sm font-semibold text-white truncate">
                                  {playlist.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CustomScrollbar>
                  </div>
                </div>
              )}
            </div>
          </div>

          <section className="home-greeting animate-premium-in">
            <div className="home-greeting-heading">
              <div className="home-greeting-icon">
                <TimeLogo />
              </div>
              <h1 className="home-greeting-title font-black text-white drop-shadow-lg">
                {discordUser?.displayName
                  ? `${greeting} ${discordUser.displayName}`
                  : greeting}
              </h1>
            </div>
            <p className="home-greeting-message mt-2 text-white/76 font-medium">
              {t.whatToListen(timeOfDay)}
            </p>
          </section>

          <HomeShelf
            title="Escuchado recientemente"
            items={recentlyPlayedSongs.map((song) => ({
              id: `recent-${song.id}`,
              title: song.title,
              subtitle: song.artist,
              coverUrl: song.coverUrl,
              onSelect: () => handlePlaySong(song),
            }))}
          />

          <HomeShelf
            title="Recomendaciones del dia"
            items={recommendationItems}
          />

          <HomeShelf
            title="Artistas"
            roundArtwork
            items={artists.slice(0, 12).map((artist) => ({
              id: `artist-${artist.name}`,
              title: artist.name,
              coverUrl: artist.image,
              onSelect: () =>
                setLocation(`/artist/${encodeURIComponent(artist.name)}`),
            }))}
          />

          <HomeShelf
            title="Albumes mas escuchados"
            items={albumCards.map((album) => ({
              id: `shelf-album-${album.id}`,
              title: album.title,
              subtitle: album.artist,
              coverUrl: album.coverUrl,
              onSelect: () => handlePlayAlbum(album),
            }))}
          />
        </div>
      </div>

      <style>{`
        .home-page {
          container-type: inline-size;
          padding-inline: clamp(1.25rem, 2.2vw, 2rem);
        }

        .home-greeting {
          width: 100%;
          padding-block: 0.75rem 0;
        }

        .home-greeting-heading {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          min-width: 0;
        }

        .home-greeting-icon {
          display: flex;
          flex-shrink: 0;
          transform: translateY(0.05rem) scale(1);
        }

        .home-greeting-title {
          max-width: 100%;
          font-size: clamp(2rem, 3.2cqw, 2.85rem);
          line-height: 1.04;
          overflow-wrap: anywhere;
        }

        .home-greeting-message {
          max-width: 42rem;
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .premium-search {
          animation: premium-search-in 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .premium-search:focus-within {
          transform: translateY(-1px) scale(1.015);
          border-color: rgba(255,255,255,0.42) !important;
          box-shadow:
            0 18px 48px rgba(0,0,0,0.22),
            0 0 0 1px rgba(255,255,255,0.16),
            inset 0 1px 0 rgba(255,255,255,0.38) !important;
        }

        .premium-results {
          animation: premium-pop 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .home-shelf {
          min-width: 0;
        }

        .home-shelf-title {
          margin-bottom: 0.8rem;
          font-size: clamp(1.05rem, 1.55cqw, 1.35rem);
          font-weight: 800;
          color: white;
        }

        .home-shelf-row {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: clamp(132px, 14cqw, 184px);
          gap: clamp(12px, 1.25cqw, 18px);
          overflow-x: auto;
          overflow-y: hidden;
          padding: 0 0 0.8rem;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.32) rgba(255,255,255,0.07);
          scroll-snap-type: x proximity;
        }

        .home-shelf-row::-webkit-scrollbar {
          height: 5px;
        }

        .home-shelf-row::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.07);
        }

        .home-shelf-row::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.36);
        }

        .home-shelf-card {
          min-width: 0;
          scroll-snap-align: start;
          text-align: left;
        }

        .home-shelf-artwork {
          position: relative;
          aspect-ratio: 1;
          overflow: hidden;
          border: 1px solid var(--cloud-border);
          border-radius: 8px;
          background:
            linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0.04)),
            var(--cloud-surface);
          box-shadow: 0 12px 30px rgba(0,0,0,0.16);
          transition:
            transform 220ms ease,
            border-color 220ms ease,
            box-shadow 220ms ease;
        }

        .home-shelf-artwork-round {
          border-radius: 999px;
        }

        .home-shelf-card:hover .home-shelf-artwork {
          transform: translateY(-3px);
          border-color: rgba(255,255,255,0.42);
          box-shadow: 0 18px 38px rgba(0,0,0,0.22);
        }

        .home-shelf-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .home-shelf-fallback {
          display: flex;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          background:
            linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03)),
            var(--cloud-surface-strong);
        }

        .home-shelf-caption {
          position: absolute;
          inset: auto 0 0;
          padding: 2.2rem 0.65rem 0.6rem;
          background: linear-gradient(transparent, rgba(0,0,0,0.78));
        }

        .home-shelf-name,
        .home-shelf-subtitle {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .home-shelf-name {
          font-size: 0.82rem;
          font-weight: 800;
          color: white;
        }

        .home-shelf-subtitle {
          margin-top: 0.16rem;
          font-size: 0.68rem;
          font-weight: 600;
          color: rgba(255,255,255,0.68);
        }

        html[data-cloud-interface="simplyui"] .home-shelf-artwork {
          border-color: rgba(255,255,255,0.09);
          background: #202020;
          box-shadow: none;
        }

        html[data-cloud-interface="simplyui"] .home-shelf-card:hover .home-shelf-artwork {
          border-color: rgba(255,255,255,0.2);
          box-shadow: none;
        }

        .premium-carousel-shell {
          position: relative;
          width: 100%;
        }

        .premium-linear-row {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: clamp(220px, 17vw, 288px);
          grid-auto-columns: clamp(230px, 16cqw, 288px);
          gap: clamp(16px, 1.5vw, 24px);
          overflow-x: auto;
          overflow-y: visible;
          padding: 16px 8px 26px;
          scroll-snap-type: x mandatory;
          scroll-padding-inline: 8px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.34) rgba(255,255,255,0.08);
          mask-image: linear-gradient(90deg, transparent, #000 2%, #000 98%, transparent);
        }

        .premium-linear-row::-webkit-scrollbar {
          height: 8px;
        }

        .premium-linear-row::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.08);
          border-radius: 999px;
        }

        .premium-linear-row::-webkit-scrollbar-thumb {
          background: var(--cloud-progress-fill);
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.18);
        }

        .premium-carousel-button {
          position: absolute;
          top: 46%;
          z-index: 20;
          display: flex;
          height: 38px;
          width: 38px;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          color: white;
          border: 1px solid var(--cloud-border);
          background:
            linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06)),
            var(--cloud-surface);
          box-shadow:
            0 16px 34px rgba(0,0,0,0.24),
            inset 0 1px 0 rgba(255,255,255,0.34);
          backdrop-filter: var(--cloud-glass-filter);
          -webkit-backdrop-filter: var(--cloud-glass-filter);
          opacity: 0;
          transform: translateY(-50%) scale(0.94);
          transition: opacity 180ms ease, transform 180ms ease, background 180ms ease;
        }

        .premium-carousel-shell:hover .premium-carousel-button {
          opacity: 1;
          transform: translateY(-50%) scale(1);
        }

        .premium-carousel-button:hover {
          background:
            linear-gradient(135deg, rgba(255,255,255,0.24), rgba(255,255,255,0.10)),
            var(--cloud-surface-strong);
          transform: translateY(-50%) scale(1.06) !important;
        }

        .premium-carousel-button-left {
          left: 6px;
        }

        .premium-carousel-button-right {
          right: 6px;
        }

        .premium-card {
          scroll-snap-align: start;
          animation: premium-card-in 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
          transform: rotate(-0.7deg);
          transform-origin: center center;
        }

        .premium-card:nth-child(3n + 2) {
          transform: rotate(0.7deg);
        }

        .premium-card:nth-child(3n) {
          transform: rotate(-0.25deg);
        }

        .premium-card:hover,
        .premium-card:nth-child(3n + 2):hover,
        .premium-card:nth-child(3n):hover {
          transform: translateY(-8px) rotate(0deg) scale(1.018);
          box-shadow:
            0 26px 70px rgba(0,0,0,0.26),
            inset 0 1px 0 rgba(255,255,255,0.32) !important;
        }

        .premium-artist-row {
          animation: premium-slide-up 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .premium-float {
          animation: premium-float 8s ease-in-out infinite alternate;
        }

        .animate-premium-in {
          animation: premium-slide-up 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .animate-premium-in-delayed {
          animation: premium-slide-up 720ms cubic-bezier(0.16, 1, 0.3, 1) 120ms both;
        }

        @keyframes premium-search-in {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes premium-pop {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px) scale(0.98); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }

        @keyframes premium-card-in {
          from { opacity: 0; translate: 0 18px; filter: blur(8px); }
          to { opacity: 1; translate: 0 0; filter: blur(0); }
        }

        @keyframes premium-slide-up {
          from { opacity: 0; transform: translateY(18px); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        @keyframes premium-float {
          from { transform: translate3d(-2%, -4%, 0) scale(0.98); opacity: 0.45; }
          to { transform: translate3d(2%, 4%, 0) scale(1.04); opacity: 0.75; }
        }

        @container (max-width: 1320px) {
          .home-greeting-title {
            font-size: 3rem;
          }
        }

        @container (max-width: 1080px) {
          .home-greeting-title {
            font-size: 2.6rem;
          }
        }

        @media (max-width: 720px) {
          .home-page {
            padding-inline: 1.25rem;
          }

          .home-greeting {
            padding-block: 0.9rem 0.1rem;
          }

          .home-greeting-heading {
            gap: 0.65rem;
          }

          .home-greeting-icon {
            transform: translateY(0.03rem) scale(0.92);
          }

          .home-greeting-title {
            font-size: 2.2rem;
            line-height: 1.08;
          }

          .home-greeting-message {
            font-size: 0.86rem;
          }

          .premium-linear-row {
            grid-auto-columns: minmax(178px, 74vw);
            gap: 14px;
            padding-left: 2px;
            padding-right: 2px;
            mask-image: none;
          }

          .home-shelf-row {
            grid-auto-columns: minmax(126px, 42vw);
          }

          .premium-card,
          .premium-card:nth-child(3n + 2),
          .premium-card:nth-child(3n),
          .premium-card:hover {
            transform: none;
          }

          .premium-carousel-button {
            opacity: 1;
            transform: translateY(-50%) scale(1);
          }
        }
      `}</style>
    </>
  );
}

function HomeShelf({
  title,
  items,
  roundArtwork = false,
}: {
  title: string;
  items: HomeShelfItem[];
  roundArtwork?: boolean;
}) {
  return (
    <section className="home-shelf">
      <h2 className="home-shelf-title">{title}</h2>
      {items.length > 0 ? (
        <div className="home-shelf-row">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onSelect}
              className="home-shelf-card group"
            >
              <span
                className={cn(
                  "home-shelf-artwork block",
                  roundArtwork && "home-shelf-artwork-round",
                )}
              >
                {item.coverUrl && !item.coverUrl.startsWith("/album") ? (
                  <img
                    src={item.coverUrl}
                    alt=""
                    className="home-shelf-image"
                  />
                ) : (
                  <span className="home-shelf-fallback">
                    {roundArtwork ? (
                      <User className="h-10 w-10 text-white/58" />
                    ) : (
                      <Music className="h-10 w-10 text-white/58" />
                    )}
                  </span>
                )}
                <span
                  className={cn(
                    "home-shelf-caption",
                    roundArtwork && "text-center",
                  )}
                >
                  <span className="home-shelf-name">{item.title}</span>
                  {item.subtitle ? (
                    <span className="home-shelf-subtitle">{item.subtitle}</span>
                  ) : null}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="py-5 text-sm font-semibold text-white/48">
          Aun no hay contenido para mostrar.
        </p>
      )}
    </section>
  );
}

function SectionHeader({
  title,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-black text-white drop-shadow-sm">
          {title}
        </h2>
      </div>
    </div>
  );
}

function EmptyState({
  glassCardStyle,
  text,
  linkText,
}: {
  glassCardStyle: CSSProperties;
  text: string;
  linkText: string;
}) {
  return (
    <div
      className="text-center py-12 text-white/55 rounded-[28px]"
      style={glassCardStyle}
    >
      <p>{text}</p>
      <Link
        href="/playlists"
        className="inline-block mt-2 text-white text-sm font-semibold"
      >
        {linkText}
      </Link>
    </div>
  );
}

function PlaylistCard({
  playlist,
  coverUrl,
  index,
  tracksLabel,
  glassCardStyle,
  onPlay,
  compact = false,
}: {
  playlist: any;
  coverUrl?: string | null;
  index: number;
  tracksLabel: string;
  glassCardStyle: CSSProperties;
  onPlay: (playlistId: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`premium-card group relative overflow-hidden rounded-[28px] transition-all duration-500 ${
        compact ? "" : "min-h-[310px]"
      }`}
      style={{
        ...glassCardStyle,
        animationDelay: `${Math.min(index, 10) * 70}ms`,
      }}
    >
      <Link href={`/playlists/${playlist.id}`}>
        <div className="cursor-pointer">
          <div
            className={
              compact
                ? "aspect-[1.45] w-full overflow-hidden"
                : "aspect-square w-full overflow-hidden"
            }
          >
            {coverUrl && !coverUrl.startsWith("/album") ? (
              <img
                src={coverUrl}
                alt={playlist.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-white/25 to-white/5 flex items-center justify-center">
                <Music className="h-12 w-12 text-white/45" />
              </div>
            )}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-transparent to-white/5 pointer-events-none" />
          <div className="relative p-4">
            <h3 className="font-black text-white truncate">{playlist.title}</h3>
            <p className="text-xs text-white/65 mt-1 font-medium">
              {playlist.songIds.length} {tracksLabel}
            </p>
          </div>
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPlay(playlist.id);
        }}
        className="absolute right-4 bottom-4 w-11 h-11 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 cloud-accent-bg text-white shadow-xl"
      >
        <Play className="w-5 h-5 ml-0.5 fill-current" />
      </button>
    </div>
  );
}

function AlbumCardView({
  album,
  index,
  glassCardStyle,
  onPlay,
}: {
  album: AlbumCard;
  index: number;
  glassCardStyle: CSSProperties;
  onPlay: (album: AlbumCard) => void;
}) {
  return (
    <div
      className="premium-card group relative overflow-hidden rounded-[28px] transition-all duration-500 min-h-[300px]"
      style={{
        ...glassCardStyle,
        animationDelay: `${Math.min(index, 10) * 70}ms`,
      }}
    >
      <Link
        href={`/album/${encodeURIComponent(album.artist)}/${encodeURIComponent(album.title)}`}
        className="block w-full text-left cursor-pointer"
      >
        <div className="aspect-square w-full overflow-hidden">
          {album.coverUrl ? (
            <img
              src={album.coverUrl}
              alt={album.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-white/25 to-white/5 flex items-center justify-center">
              <Disc3 className="h-14 w-14 text-white/45" />
            </div>
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/48 via-transparent to-white/5 pointer-events-none" />
        <div className="relative p-4">
          <h3 className="font-black text-white truncate">{album.title}</h3>
          <p className="text-xs text-white/65 mt-1 font-medium truncate">
            {album.artist} - {album.songs.length} canciones
          </p>
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPlay(album);
        }}
        className="absolute right-4 bottom-4 w-11 h-11 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 cloud-accent-bg text-white shadow-xl"
      >
        <Play className="w-5 h-5 ml-0.5 fill-current" />
      </button>
    </div>
  );
}
