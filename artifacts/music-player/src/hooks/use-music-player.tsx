import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import {
  dbSaveSong,
  dbGetAllSongs,
  dbUpdateCover,
  dbUpdateExtCoverUrl,
  dbDeleteSong,
  dbGetSongById,
} from "@/hooks/use-song-db";
import { invoke } from "@tauri-apps/api/core";
import type { SongMetadata } from "@/types";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre?: string;
  duration: number;
  coverUrl: string;
  customCoverUrl?: string;
  audioUrl?: string;
  isUserUploaded?: boolean;
}

export type AudioQuality = "low" | "normal" | "high" | "lossless";

interface MusicPlayerState {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  progress: number;
  volume: number;
  isShuffle: boolean;
  isShufflePlus: boolean;
  isRepeat: boolean;
  isRepeatOne: boolean;
  likedSongs: Set<string>;
  userSongs: Song[];
  allSongs: Song[];
  audioQuality: AudioQuality;
  crossfadeSeconds: number;
  isLoadingLibrary: boolean;
  isRemotePlayback: boolean;
  play: (song?: Song) => void;
  pause: () => void;
  togglePlayPause: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleLike: (songId: string) => void;
  reorderQueue: (newQueue: Song[]) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (songId: string) => void;
  addUserSong: (file: File) => Promise<void>;
  addUserSongs: (files: File[]) => Promise<void>;
  updateSongCover: (songId: string, file: File) => Promise<void>;
  deleteSong: (songId: string) => Promise<void>;
  removeSongs: (ids: string[]) => void;
  updateSongMetadata: (
    songId: string,
    metadata: Partial<Song>,
  ) => Promise<void>;
  setAudioQuality: (q: AudioQuality) => void;
  setCrossfadeSeconds: (s: number) => void;
  getAudioTime: () => number;
  setCurrentPlaylist: (songs: Song[]) => void;
  setQueue: (queue: Song[]) => void;
  setRemotePlayback: (active: boolean) => void;
}

const MusicPlayerContext = createContext<MusicPlayerState | undefined>(
  undefined,
);

async function searchItunesArtwork(
  title: string,
  artist: string,
): Promise<string | null> {
  try {
    const term = `${title} ${artist}`
      .replace(/unknown artist/i, "")
      .replace(/[^\w\s]/g, "")
      .trim();
    if (!term) return null;
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=musicTrack&limit=5&media=music`,
      { signal: AbortSignal.timeout(7000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results?.length > 0) {
      const art: string | undefined = data.results[0].artworkUrl100;
      return art ? art.replace("100x100bb", "600x600bb") : null;
    }
    return null;
  } catch {
    return null;
  }
}

function getAssetUrl(path: string): string {
  if (import.meta.env.DEV) return path;
  return `http://asset.localhost${path}`;
}

function makeBlobUrl(data: ArrayBuffer, mime: string): string {
  return URL.createObjectURL(new Blob([data], { type: mime }));
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueueState] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isShufflePlus, setIsShufflePlus] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isRepeatOne, setIsRepeatOne] = useState(false);
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());
  const [userSongs, setUserSongs] = useState<Song[]>([]);
  const [audioQuality, setAudioQualityState] = useState<AudioQuality>("high");
  const [crossfadeSeconds, setCrossfadeSecondsState] = useState(3);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [currentPlaylist, setCurrentPlaylist] = useState<Song[]>([]);
  const [isRemotePlayback, setIsRemotePlayback] = useState(false);

  const mainAudioRef = useRef<HTMLAudioElement | null>(null);
  const incomingAudioRef = useRef<HTMLAudioElement | null>(null);
  const skipAudioSetupRef = useRef(false);
  const isCrossfadingRef = useRef(false);
  const crossfadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const queueRef = useRef(queue);
  const currentSongRef = useRef(currentSong);
  const volumeRef = useRef(volume);
  const crossfadeSecondsRef = useRef(crossfadeSeconds);
  const isRepeatRef = useRef(isRepeat);
  const isRepeatOneRef = useRef(isRepeatOne);
  const isShuffleRef = useRef(isShuffle);
  const isShufflePlusRef = useRef(isShufflePlus);
  const currentPlaylistRef = useRef(currentPlaylist);
  const userSongsRef = useRef(userSongs);
  const failedSongRef = useRef<string | null>(null);
  const blobUrlsRef = useRef<Map<string, string[]>>(new Map());
  const lastPrevClickRef = useRef(0);

  const setRemotePlayback = useCallback((active: boolean) => {
    setIsRemotePlayback(active);
    if (mainAudioRef.current) mainAudioRef.current.muted = active;
    if (incomingAudioRef.current) incomingAudioRef.current.muted = active;
  }, []);

  // --- Funciones del reproductor ---
  const play = (song?: Song) => {
    if (song && song.id !== currentSong?.id) {
      setCurrentSong(song);
      setProgress(0);
      const activePlaylist =
        currentPlaylist.length > 0 ? currentPlaylist : userSongs;
      const currentIndex = activePlaylist.findIndex((s) => s.id === song.id);
      if (currentIndex !== -1) {
        const nextSongs = activePlaylist.slice(currentIndex + 1);
        setQueueState(nextSongs);
      } else {
        setQueueState([]);
      }
    }
    setIsPlaying(true);
  };

  const pause = () => setIsPlaying(false);
  const togglePlayPause = () => {
    const audio = mainAudioRef.current;
    if (
      !isPlaying &&
      audio &&
      (audio.ended ||
        (Number.isFinite(audio.duration) &&
          audio.duration > 0 &&
          audio.currentTime >= audio.duration - 0.15))
    ) {
      audio.currentTime = 0;
      setProgress(0);
    }
    setIsPlaying((playing) => !playing);
  };

  const next = () => {
    if (mainAudioRef.current) {
      mainAudioRef.current.onended = null;
      mainAudioRef.current.ontimeupdate = null;
    }
    stopCrossfade();
    doNext();
  };

  const prev = () => {
    if (mainAudioRef.current) {
      mainAudioRef.current.onended = null;
      mainAudioRef.current.ontimeupdate = null;
    }
    stopCrossfade();

    const now = Date.now();
    const timeSinceLastClick = now - lastPrevClickRef.current;
    lastPrevClickRef.current = now;
    const currentTime = mainAudioRef.current?.currentTime ?? 0;

    if (timeSinceLastClick < 500 || currentTime < 3) {
      const activePlaylist =
        currentPlaylist.length > 0 ? currentPlaylist : userSongs;
      const cur = currentSongRef.current;
      if (cur) {
        const currentIndex = activePlaylist.findIndex((s) => s.id === cur.id);
        if (currentIndex > 0) {
          const prevSong = activePlaylist[currentIndex - 1];
          setCurrentSong(prevSong);
          setProgress(0);
          setIsPlaying(true);
          const nextSongs = activePlaylist.slice(currentIndex);
          setQueueState(nextSongs.filter((s) => s.id !== prevSong.id));
          return;
        }
      }
    } else {
      setProgress(0);
      if (mainAudioRef.current) mainAudioRef.current.currentTime = 0;
    }
  };

  const seek = (time: number) => {
    setProgress(time);
    if (currentSong?.audioUrl && mainAudioRef.current)
      mainAudioRef.current.currentTime = time;
  };
  const setVolume = (vol: number) => setVolumeState(vol);

  const createShufflePlusQueue = (excludeId?: string) => {
    const candidates = userSongsRef.current.filter(
      (song) => song.id !== excludeId,
    );
    return [...candidates]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(12, candidates.length));
  };

  const toggleShuffle = () => {
    if (!isShuffleRef.current) {
      isShuffleRef.current = true;
      isShufflePlusRef.current = false;
      setIsShuffle(true);
      setIsShufflePlus(false);
    } else if (!isShufflePlusRef.current) {
      isShufflePlusRef.current = true;
      setIsShufflePlus(true);
      if (queueRef.current.length === 0) {
        const generatedQueue = createShufflePlusQueue(
          currentSongRef.current?.id,
        );
        queueRef.current = generatedQueue;
        setQueueState(generatedQueue);
      }
    } else {
      isShuffleRef.current = false;
      isShufflePlusRef.current = false;
      setIsShuffle(false);
      setIsShufflePlus(false);
    }
  };
  const toggleRepeat = () => {
    if (!isRepeatRef.current) {
      isRepeatRef.current = true;
      isRepeatOneRef.current = false;
      setIsRepeat(true);
      setIsRepeatOne(false);
    } else if (!isRepeatOneRef.current) {
      isRepeatOneRef.current = true;
      setIsRepeatOne(true);
    } else {
      isRepeatRef.current = false;
      isRepeatOneRef.current = false;
      setIsRepeat(false);
      setIsRepeatOne(false);
    }
  };
  const toggleLike = (songId: string) => {
    setLikedSongs((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };
  const addToQueue = (song: Song) => {
    if (!currentSong) play(song);
    else setQueueState((q) => [...q, song]);
  };

  const removeFromQueue = (songId: string) => {
    setQueueState((prev) => prev.filter((s) => s.id !== songId));
  };

  const reorderQueue = (newQueue: Song[]) => {
    setQueueState(newQueue);
  };

  const addUserSongs = async (files: File[]) => {
    for (const file of files) {
      await addUserSong(file);
    }
  };

  // --- Sincronización de refs ---
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    crossfadeSecondsRef.current = crossfadeSeconds;
  }, [crossfadeSeconds]);
  useEffect(() => {
    isRepeatRef.current = isRepeat;
  }, [isRepeat]);
  useEffect(() => {
    isRepeatOneRef.current = isRepeatOne;
  }, [isRepeatOne]);
  useEffect(() => {
    isShuffleRef.current = isShuffle;
    isShufflePlusRef.current = isShufflePlus;
  }, [isShuffle, isShufflePlus]);
  useEffect(() => {
    currentPlaylistRef.current = currentPlaylist;
  }, [currentPlaylist]);
  useEffect(() => {
    userSongsRef.current = userSongs;
  }, [userSongs]);

  // --- Cargar canciones desde IndexedDB ---
  useEffect(() => {
    dbGetAllSongs()
      .then((dbSongs) => {
        const songs: Song[] = dbSongs.map((dbSong) => {
          const audioUrl = makeBlobUrl(
            dbSong.audioData,
            dbSong.audioMime || "audio/mpeg",
          );
          let coverUrl = "/album1.png";
          if (dbSong.coverData && dbSong.coverMime) {
            coverUrl = makeBlobUrl(dbSong.coverData, dbSong.coverMime);
          } else if (dbSong.coverExtUrl) {
            coverUrl = dbSong.coverExtUrl;
          }
          blobUrlsRef.current.set(dbSong.id, [
            audioUrl,
            ...(coverUrl.startsWith("blob:") ? [coverUrl] : []),
          ]);
          return {
            id: dbSong.id,
            title: dbSong.title,
            artist: dbSong.artist,
            album: dbSong.album,
            genre: dbSong.genre || "",
            duration: dbSong.duration,
            coverUrl,
            audioUrl,
            isUserUploaded: true,
          };
        });
        if (songs.length > 0) setUserSongs(songs);
      })
      .catch(() => {})
      .finally(() => setIsLoadingLibrary(false));
  }, []);

  // --- Inicializar Audio ---
  useEffect(() => {
    mainAudioRef.current = new Audio();
    incomingAudioRef.current = new Audio();
    mainAudioRef.current.muted = isRemotePlayback;
    incomingAudioRef.current.muted = isRemotePlayback;
    return () => {
      mainAudioRef.current?.pause();
      incomingAudioRef.current?.pause();
      blobUrlsRef.current.forEach((urls) => urls.forEach(URL.revokeObjectURL));
    };
  }, []);

  // --- MediaSession: metadatos SIN descarga a archivo (usamos URL pública) ---
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    if (!currentSong) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }

    // Si la portada actual es una URL pública (http/https), la usamos directamente.
    // Si es blob o local, no mostramos imagen por ahora, pero programamos un reintento
    // porque la búsqueda en iTunes (asíncrona) actualizará coverUrl a una URL http.
    const artwork =
      currentSong.coverUrl && !currentSong.coverUrl.startsWith("blob:")
        ? [{ src: currentSong.coverUrl, sizes: "512x512", type: "image/jpeg" }]
        : [];

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title || "Sin título",
      artist: currentSong.artist || "Desconocido",
      album: currentSong.album || "",
      artwork: artwork,
    });

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    if (
      "setPositionState" in navigator.mediaSession &&
      currentSong.duration > 0
    ) {
      navigator.mediaSession.setPositionState({
        duration: currentSong.duration,
        playbackRate: 1.0,
        position: progress,
      });
    }

    // Si la carátula era blob, programar un reintento (la búsqueda en iTunes ya la habrá actualizado)
    if (currentSong?.coverUrl?.startsWith("blob:")) {
      const timer = setTimeout(() => {
        // Forzar una actualización: simplemente volvemos a establecer los metadatos
        if (currentSongRef.current) {
          const updatedArtwork =
            currentSongRef.current.coverUrl &&
            !currentSongRef.current.coverUrl.startsWith("blob:")
              ? [
                  {
                    src: currentSongRef.current.coverUrl,
                    sizes: "512x512",
                    type: "image/jpeg",
                  },
                ]
              : [];
          navigator.mediaSession.metadata = new MediaMetadata({
            title: currentSongRef.current.title || "Sin título",
            artist: currentSongRef.current.artist || "Desconocido",
            album: currentSongRef.current.album || "",
            artwork: updatedArtwork,
          });
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentSong, isPlaying, progress]);

  // --- Acciones de botones multimedia ---
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
    navigator.mediaSession.setActionHandler("pause", () => pause());
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("stop", () => {
      pause();
      if (mainAudioRef.current) {
        mainAudioRef.current.currentTime = 0;
        setProgress(0);
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("previoustrack", null);
      navigator.mediaSession.setActionHandler("nexttrack", null);
      navigator.mediaSession.setActionHandler("stop", null);
    };
  }, [togglePlayPause, pause, prev, next]);

  // --- Funciones de audio y crossfade (sin cambios) ---
  const doNext = () => {
    const q = queueRef.current;
    const cur = currentSongRef.current;
    const finishPlayback = () => {
      setIsPlaying(false);
      setProgress(0);
      if (mainAudioRef.current) {
        mainAudioRef.current.pause();
        mainAudioRef.current.currentTime = 0;
        mainAudioRef.current.onended = null;
        mainAudioRef.current.ontimeupdate = null;
      }
    };

    if (q.length > 0) {
      const nextIndex = isShuffleRef.current
        ? Math.floor(Math.random() * q.length)
        : 0;
      const nextSong = q[nextIndex];
      const remaining = q.filter((_, index) => index !== nextIndex);
      setQueueState(remaining);
      setCurrentSong(nextSong);
      setProgress(0);
      setIsPlaying(true);
      failedSongRef.current = null;
    } else if (isRepeatRef.current && !isRepeatOneRef.current) {
      const source =
        currentPlaylistRef.current.length > 0
          ? currentPlaylistRef.current
          : userSongsRef.current;
      if (source.length > 0) {
        const currentIndex = cur
          ? source.findIndex((song) => song.id === cur.id)
          : -1;
        const shuffledCandidates =
          source.length > 1 && cur
            ? source.filter((song) => song.id !== cur.id)
            : source;
        const nextSong = isShuffleRef.current
          ? shuffledCandidates[
              Math.floor(Math.random() * shuffledCandidates.length)
            ]
          : (source[(currentIndex + 1 + source.length) % source.length] ??
            source[0]);

        if (nextSong.id === cur?.id && mainAudioRef.current) {
          mainAudioRef.current.currentTime = 0;
          setProgress(0);
          setIsPlaying(true);
          failedSongRef.current = null;
          mainAudioRef.current.play().catch(() => {
            handlePlaybackFailure(cur);
          });
          return;
        }

        setCurrentSong(nextSong);
        setQueueState(source.filter((song) => song.id !== nextSong.id));
        setProgress(0);
        setIsPlaying(true);
        failedSongRef.current = null;
      } else {
        finishPlayback();
      }
    } else if (isShufflePlusRef.current) {
      const generatedQueue = createShufflePlusQueue(cur?.id);
      const nextSong = generatedQueue[0];
      if (nextSong) {
        setCurrentSong(nextSong);
        setQueueState(generatedQueue.slice(1));
        setProgress(0);
        setIsPlaying(true);
        failedSongRef.current = null;
      } else {
        finishPlayback();
      }
    } else {
      finishPlayback();
    }
  };

  const stopCrossfade = () => {
    if (crossfadeIntervalRef.current)
      clearInterval(crossfadeIntervalRef.current);
    isCrossfadingRef.current = false;
    if (incomingAudioRef.current) {
      incomingAudioRef.current.pause();
      incomingAudioRef.current.src = "";
    }
    if (mainAudioRef.current) {
      mainAudioRef.current.volume = volumeRef.current / 100;
    }
  };

  const startCrossfade = (nextSong: Song) => {
    if (isCrossfadingRef.current) return;
    const cfSecs = crossfadeSecondsRef.current;
    if (cfSecs === 0 || !nextSong.audioUrl) {
      doNext();
      return;
    }
    isCrossfadingRef.current = true;
    const incoming = incomingAudioRef.current!;
    incoming.src = nextSong.audioUrl;
    incoming.volume = 0;
    incoming.play().catch(() => {});
    const startTime = Date.now();
    const totalMs = cfSecs * 1000;
    const startVol = volumeRef.current / 100;
    if (crossfadeIntervalRef.current)
      clearInterval(crossfadeIntervalRef.current);
    crossfadeIntervalRef.current = setInterval(() => {
      const ratio = Math.min((Date.now() - startTime) / totalMs, 1);
      if (mainAudioRef.current)
        mainAudioRef.current.volume = startVol * (1 - ratio);
      incoming.volume = startVol * ratio;
      if (ratio >= 1) {
        if (crossfadeIntervalRef.current)
          clearInterval(crossfadeIntervalRef.current);
        isCrossfadingRef.current = false;
        mainAudioRef.current?.pause();
        const temp = mainAudioRef.current!;
        mainAudioRef.current = incomingAudioRef.current!;
        incomingAudioRef.current = temp;
        incomingAudioRef.current.pause();
        incomingAudioRef.current.src = "";
        mainAudioRef.current.volume = startVol;
        attachAudioListeners();
        skipAudioSetupRef.current = true;
        const q = queueRef.current;
        setQueueState(q.slice(1));
        setCurrentSong(nextSong);
        setProgress(Math.floor(mainAudioRef.current.currentTime));
        setIsPlaying(true);
      }
    }, 50);
  };

  const attachAudioListeners = () => {
    const audio = mainAudioRef.current;
    if (!audio) return;
    audio.onended = () => {
      if (!isCrossfadingRef.current) {
        if (isRepeatOneRef.current) {
          audio.currentTime = 0;
          setProgress(0);
          audio.play().catch(() => {
            handlePlaybackFailure(currentSongRef.current);
          });
        } else {
          doNext();
        }
      }
    };
    audio.onplaying = () => {
      failedSongRef.current = null;
    };
    audio.ontimeupdate = () => {
      if (!currentSongRef.current?.audioUrl) return;
      setProgress(Math.floor(audio.currentTime));
      const remaining = audio.duration - audio.currentTime;
      const cfSecs = crossfadeSecondsRef.current;
      if (
        cfSecs > 0 &&
        !isRepeatOneRef.current &&
        remaining <= cfSecs &&
        remaining > 0 &&
        !isCrossfadingRef.current
      ) {
        const q = queueRef.current;
        if (q.length > 0) startCrossfade(q[0]);
      }
    };
  };

  useEffect(() => {
    if (!mainAudioRef.current) return;
    if (skipAudioSetupRef.current) {
      skipAudioSetupRef.current = false;
      return;
    }
    if (isCrossfadingRef.current) return;
    const audio = mainAudioRef.current;
    if (crossfadeIntervalRef.current)
      clearInterval(crossfadeIntervalRef.current);
    isCrossfadingRef.current = false;
    incomingAudioRef.current!.pause();
    incomingAudioRef.current!.src = "";
    if (currentSong?.audioUrl) {
      audio.src = currentSong.audioUrl;
      audio.volume = volume / 100;
      audio.load();
      attachAudioListeners();
      if (isPlaying)
        audio.play().catch(() => {
          window.setTimeout(() => {
            audio.load();
            audio.play().catch(() => {
              handlePlaybackFailure(currentSongRef.current);
            });
          }, 180);
        });
    } else {
      audio.pause();
      audio.src = "";
      audio.onended = null;
      audio.ontimeupdate = null;
    }
  }, [currentSong]);

  useEffect(() => {
    if (!mainAudioRef.current || !currentSong?.audioUrl) return;
    const audio = mainAudioRef.current;
    if (isPlaying) {
      audio.play().catch(() => {
        window.setTimeout(() => {
          audio.load();
          audio.play().catch(() => {
            handlePlaybackFailure(currentSongRef.current);
          });
        }, 180);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (mainAudioRef.current) mainAudioRef.current.volume = volume / 100;
  }, [volume]);

  // --- Subida y gestión de canciones ---
  const addUserSong = async (file: File): Promise<void> => {
    const audioData = await file.arrayBuffer();
    const audioMime = file.type || "audio/mpeg";
    const audioUrl = makeBlobUrl(audioData, audioMime);
    const rawName = file.name.replace(/\.[^/.]+$/, "");
    let title = rawName;
    let artist = "Unknown Artist";
    let album = "Mis archivos";
    let year = "";
    let genre = "";

    const separator = rawName.indexOf(" - ");
    if (separator > 0) {
      artist = rawName.substring(0, separator).trim();
      title = rawName.substring(separator + 3).trim();
    }

    try {
      const metadata = await invoke<SongMetadata>(
        "fetch_metadata_from_musicbrainz",
        {
          title: title,
          artist: artist !== "Unknown Artist" ? artist : "",
        },
      );

      if (!title || title === rawName) title = metadata.title || title;
      if (artist === "Unknown Artist") artist = metadata.artist || artist;
      if (album === "Mis archivos") album = metadata.album || album;
      if (!year) year = metadata.year || "";
      if (!genre) genre = metadata.genre || "";
    } catch (err) {
      console.warn(
        "MusicBrainz no devolvió metadatos, se usarán los originales",
        err,
      );
    }

    return new Promise((resolve) => {
      const audio = new Audio(audioUrl);
      const finalize = async (dur: number) => {
        const id = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const newSong: Song = {
          id,
          title,
          artist,
          album,
          duration: Math.floor(dur) || 0,
          coverUrl: getAssetUrl("/album1.png"),
          audioUrl,
          isUserUploaded: true,
        };

        blobUrlsRef.current.set(id, [audioUrl]);

        await dbSaveSong({
          id,
          title,
          artist,
          album,
          duration: Math.floor(dur) || 0,
          audioData,
          audioMime,
          coverData: null,
          coverMime: null,
          coverExtUrl: null,
        }).catch(() => {});

        setUserSongs((prev) => [...prev, newSong]);
        addToQueue(newSong);
        resolve();

        searchItunesArtwork(title, artist).then(async (artUrl) => {
          if (!artUrl) return;
          const updater = (s: Song) =>
            s.id === id ? { ...s, coverUrl: artUrl } : s;
          setUserSongs((prev) => prev.map(updater));
          setCurrentSong((prev) =>
            prev?.id === id ? { ...prev, coverUrl: artUrl } : prev,
          );
          setQueueState((prev) => prev.map(updater));
          await dbUpdateExtCoverUrl(id, artUrl).catch(() => {});
        });
      };
      audio.addEventListener("loadedmetadata", () => finalize(audio.duration));
      audio.addEventListener("error", () => finalize(0));
    });
  };

  const updateSongCover = async (songId: string, file: File): Promise<void> => {
    const coverData = await file.arrayBuffer();
    const coverMime = file.type || "image/jpeg";
    const coverUrl = makeBlobUrl(coverData, coverMime);

    const existing = blobUrlsRef.current.get(songId) ?? [];
    blobUrlsRef.current.set(
      songId,
      [existing[0] ?? "", coverUrl].filter(Boolean),
    );

    const updater = (s: Song) => (s.id === songId ? { ...s, coverUrl } : s);
    setUserSongs((prev) => prev.map(updater));
    setCurrentSong((prev) =>
      prev?.id === songId ? { ...prev, coverUrl } : prev,
    );
    setQueueState((prev) => prev.map(updater));

    await dbUpdateCover(songId, coverData, coverMime).catch(() => {});
  };

  async function deleteSong(songId: string): Promise<void> {
    const urls = blobUrlsRef.current.get(songId) ?? [];
    urls.forEach(URL.revokeObjectURL);
    blobUrlsRef.current.delete(songId);

    const remainingSongs = userSongsRef.current.filter(
      (song) => song.id !== songId,
    );
    const remainingQueue = queueRef.current.filter(
      (song) => song.id !== songId,
    );
    const remainingPlaylist = currentPlaylistRef.current.filter(
      (song) => song.id !== songId,
    );
    userSongsRef.current = remainingSongs;
    queueRef.current = remainingQueue;
    currentPlaylistRef.current = remainingPlaylist;
    setUserSongs(remainingSongs);
    setQueueState(remainingQueue);
    setCurrentPlaylist(remainingPlaylist);
    if (currentSongRef.current?.id === songId) {
      doNext();
    }
    await dbDeleteSong(songId).catch(() => {});
    window.dispatchEvent(
      new CustomEvent("cloud-songs-removed", { detail: { ids: [songId] } }),
    );
  }

  const removeSongs = (ids: string[]) => {
    const removedIds = new Set(ids);
    ids.forEach((id) => {
      const urls = blobUrlsRef.current.get(id) ?? [];
      urls.forEach(URL.revokeObjectURL);
      blobUrlsRef.current.delete(id);
      dbDeleteSong(id).catch(() => {});
    });

    const remainingSongs = userSongsRef.current.filter(
      (song) => !removedIds.has(song.id),
    );
    const remainingQueue = queueRef.current.filter(
      (song) => !removedIds.has(song.id),
    );
    const remainingPlaylist = currentPlaylistRef.current.filter(
      (song) => !removedIds.has(song.id),
    );
    userSongsRef.current = remainingSongs;
    queueRef.current = remainingQueue;
    currentPlaylistRef.current = remainingPlaylist;
    setUserSongs(remainingSongs);
    setQueueState(remainingQueue);
    setCurrentPlaylist(remainingPlaylist);
    if (currentSong && ids.includes(currentSong.id)) {
      doNext();
    }
    window.dispatchEvent(
      new CustomEvent("cloud-songs-removed", { detail: { ids } }),
    );
  };

  function handlePlaybackFailure(song: Song | null) {
    if (!song || failedSongRef.current === song.id) return;
    failedSongRef.current = song.id;
    setIsPlaying(false);
    toast.error("Cloud no pudo reproducir esto", {
      description: "¿Deseas eliminar esta cancion de tu biblioteca?",
      duration: Infinity,
      action: {
        label: "Eliminar",
        onClick: () => {
          deleteSong(song.id).catch(() => {});
        },
      },
      cancel: {
        label: "Conservar",
        onClick: () => {
          failedSongRef.current = null;
        },
      },
    });
  }

  const updateSongMetadata = async (
    songId: string,
    metadata: Partial<Song>,
  ) => {
    const dbSong = await dbGetSongById(songId);
    if (!dbSong) return;

    const updatedDbSong = {
      ...dbSong,
      title: metadata.title ?? dbSong.title,
      artist: metadata.artist ?? dbSong.artist,
      album: metadata.album ?? dbSong.album,
      genre: metadata.genre ?? dbSong.genre,
    };

    if (metadata.customCoverUrl) {
      const blob = await fetch(metadata.customCoverUrl).then((r) => r.blob());
      const coverData = await blob.arrayBuffer();
      const coverMime = blob.type;
      updatedDbSong.coverData = coverData;
      updatedDbSong.coverMime = coverMime;
      delete (updatedDbSong as any).coverExtUrl;
    }

    await dbSaveSong(updatedDbSong);

    setUserSongs((prev) =>
      prev.map((s) => {
        if (s.id === songId) {
          const updatedSong = { ...s, ...metadata };
          if (metadata.customCoverUrl) {
            const oldUrls = blobUrlsRef.current.get(songId) ?? [];
            if (oldUrls.length > 1) URL.revokeObjectURL(oldUrls[1]);
            const newCoverUrl = makeBlobUrl(
              updatedDbSong.coverData!,
              updatedDbSong.coverMime!,
            );
            updatedSong.coverUrl = newCoverUrl;
            updatedSong.customCoverUrl = metadata.customCoverUrl;
            blobUrlsRef.current.set(songId, [oldUrls[0], newCoverUrl]);
          }
          return updatedSong;
        }
        return s;
      }),
    );

    if (currentSong?.id === songId) {
      setCurrentSong((prev) => (prev ? { ...prev, ...metadata } : null));
    }
  };

  const setAudioQuality = (q: AudioQuality) => setAudioQualityState(q);
  const setCrossfadeSeconds = (s: number) => setCrossfadeSecondsState(s);
  const getAudioTime = useCallback(
    () => mainAudioRef.current?.currentTime ?? 0,
    [],
  );
  const allSongs = [...userSongs];
  const setQueue = (newQueue: Song[]) => setQueueState(newQueue);

  return (
    <MusicPlayerContext.Provider
      value={{
        currentSong,
        queue,
        isPlaying,
        progress,
        volume,
        isShuffle,
        isShufflePlus,
        isRepeat,
        isRepeatOne,
        likedSongs,
        userSongs,
        allSongs,
        audioQuality,
        crossfadeSeconds,
        isLoadingLibrary,
        isRemotePlayback,
        play,
        pause,
        togglePlayPause,
        next,
        prev,
        seek,
        setVolume,
        toggleShuffle,
        toggleRepeat,
        toggleLike,
        reorderQueue,
        addToQueue,
        removeFromQueue,
        addUserSong,
        addUserSongs,
        updateSongCover,
        deleteSong,
        removeSongs,
        updateSongMetadata,
        setAudioQuality,
        setCrossfadeSeconds,
        getAudioTime,
        setCurrentPlaylist,
        setQueue,
        setRemotePlayback,
      }}
    >
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (!context)
    throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  return context;
}

export function useOptionalMusicPlayer() {
  return useContext(MusicPlayerContext);
}
