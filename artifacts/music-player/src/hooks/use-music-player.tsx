import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import {
  dbSaveSong, dbGetAllSongs, dbUpdateCover, dbUpdateExtCoverUrl, dbDeleteSong,
} from "@/hooks/use-song-db";

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
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
  isRepeat: boolean;
  likedSongs: Set<string>;
  userSongs: Song[];
  allSongs: Song[];
  audioQuality: AudioQuality;
  crossfadeSeconds: number;
  isLoadingLibrary: boolean;
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
  addUserSong: (file: File) => Promise<void>;
  updateSongCover: (songId: string, file: File) => Promise<void>;
  deleteSong: (songId: string) => Promise<void>;
  setAudioQuality: (q: AudioQuality) => void;
  setCrossfadeSeconds: (s: number) => void;
}

const MusicPlayerContext = createContext<MusicPlayerState | undefined>(undefined);

async function searchItunesArtwork(title: string, artist: string): Promise<string | null> {
  try {
    const term = `${title} ${artist}`.replace(/unknown artist/i, "").replace(/[^\w\s]/g, "").trim();
    if (!term) return null;
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=musicTrack&limit=5&media=music`,
      { signal: AbortSignal.timeout(7000) }
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

function makeBlobUrl(data: ArrayBuffer, mime: string): string {
  return URL.createObjectURL(new Blob([data], { type: mime }));
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());
  const [userSongs, setUserSongs] = useState<Song[]>([]);
  const [audioQuality, setAudioQualityState] = useState<AudioQuality>("high");
  const [crossfadeSeconds, setCrossfadeSecondsState] = useState(3);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);

  const mainAudioRef = useRef<HTMLAudioElement | null>(null);
  const incomingAudioRef = useRef<HTMLAudioElement | null>(null);
  const skipAudioSetupRef = useRef(false);
  const isCrossfadingRef = useRef(false);
  const crossfadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queueRef = useRef(queue);
  const currentSongRef = useRef(currentSong);
  const volumeRef = useRef(volume);
  const crossfadeSecondsRef = useRef(crossfadeSeconds);
  const isRepeatRef = useRef(isRepeat);
  // Track blob URLs for cleanup
  const blobUrlsRef = useRef<Map<string, string[]>>(new Map());

  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { crossfadeSecondsRef.current = crossfadeSeconds; }, [crossfadeSeconds]);
  useEffect(() => { isRepeatRef.current = isRepeat; }, [isRepeat]);

  // Load songs from IndexedDB on startup
  useEffect(() => {
    dbGetAllSongs().then((dbSongs) => {
      const songs: Song[] = dbSongs.map((dbSong) => {
        const audioUrl = makeBlobUrl(dbSong.audioData, dbSong.audioMime || "audio/mpeg");
        let coverUrl = "/album1.png";
        if (dbSong.coverData && dbSong.coverMime) {
          coverUrl = makeBlobUrl(dbSong.coverData, dbSong.coverMime);
        } else if (dbSong.coverExtUrl) {
          coverUrl = dbSong.coverExtUrl;
        }
        blobUrlsRef.current.set(dbSong.id, [audioUrl, ...(coverUrl.startsWith("blob:") ? [coverUrl] : [])]);
        return {
          id: dbSong.id,
          title: dbSong.title,
          artist: dbSong.artist,
          album: dbSong.album,
          duration: dbSong.duration,
          coverUrl,
          audioUrl,
          isUserUploaded: true,
        };
      });
      if (songs.length > 0) setUserSongs(songs);
    }).catch(() => {}).finally(() => setIsLoadingLibrary(false));
  }, []);

  useEffect(() => {
    mainAudioRef.current = new Audio();
    incomingAudioRef.current = new Audio();
    return () => {
      mainAudioRef.current?.pause();
      incomingAudioRef.current?.pause();
      blobUrlsRef.current.forEach((urls) => urls.forEach(URL.revokeObjectURL));
    };
  }, []);

  const doNext = () => {
    const q = queueRef.current;
    const cur = currentSongRef.current;
    if (q.length > 0) {
      const nextSong = q[0];
      setQueue([...q.slice(1), ...(cur ? [cur] : [])]);
      setCurrentSong(nextSong);
      setProgress(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  };

  const startCrossfade = (nextSong: Song) => {
    if (isCrossfadingRef.current) return;
    const cfSecs = crossfadeSecondsRef.current;
    if (cfSecs === 0 || !nextSong.audioUrl) { doNext(); return; }
    isCrossfadingRef.current = true;
    const incoming = incomingAudioRef.current!;
    incoming.src = nextSong.audioUrl;
    incoming.volume = 0;
    incoming.play().catch(() => {});
    const startTime = Date.now();
    const totalMs = cfSecs * 1000;
    const startVol = volumeRef.current / 100;
    if (crossfadeIntervalRef.current) clearInterval(crossfadeIntervalRef.current);
    crossfadeIntervalRef.current = setInterval(() => {
      const ratio = Math.min((Date.now() - startTime) / totalMs, 1);
      if (mainAudioRef.current) mainAudioRef.current.volume = startVol * (1 - ratio);
      incoming.volume = startVol * ratio;
      if (ratio >= 1) {
        if (crossfadeIntervalRef.current) clearInterval(crossfadeIntervalRef.current);
        isCrossfadingRef.current = false;
        const cur = currentSongRef.current;
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
        setQueue([...q.slice(1), ...(cur ? [cur] : [])]);
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
        if (isRepeatRef.current) { audio.currentTime = 0; audio.play().catch(() => {}); }
        else doNext();
      }
    };
    audio.ontimeupdate = () => {
      if (!currentSongRef.current?.audioUrl) return;
      setProgress(Math.floor(audio.currentTime));
      const remaining = audio.duration - audio.currentTime;
      const cfSecs = crossfadeSecondsRef.current;
      if (cfSecs > 0 && remaining <= cfSecs && remaining > 0 && !isCrossfadingRef.current) {
        const q = queueRef.current;
        if (q.length > 0) startCrossfade(q[0]);
      }
    };
  };

  useEffect(() => {
    if (!mainAudioRef.current) return;
    if (skipAudioSetupRef.current) { skipAudioSetupRef.current = false; return; }
    if (isCrossfadingRef.current) return;
    const audio = mainAudioRef.current;
    if (crossfadeIntervalRef.current) clearInterval(crossfadeIntervalRef.current);
    isCrossfadingRef.current = false;
    incomingAudioRef.current!.pause();
    incomingAudioRef.current!.src = "";
    if (currentSong?.audioUrl) {
      audio.src = currentSong.audioUrl;
      audio.volume = volume / 100;
      attachAudioListeners();
      if (isPlaying) audio.play().catch(() => {});
    } else {
      audio.pause();
      audio.src = "";
      audio.onended = null;
      audio.ontimeupdate = null;
    }
  }, [currentSong]);

  useEffect(() => {
    if (!mainAudioRef.current || !currentSong?.audioUrl) return;
    if (isPlaying) mainAudioRef.current.play().catch(() => {});
    else mainAudioRef.current.pause();
  }, [isPlaying]);

  useEffect(() => {
    if (mainAudioRef.current) mainAudioRef.current.volume = volume / 100;
  }, [volume]);

  const play = (song?: Song) => {
    if (song && song.id !== currentSong?.id) {
      setCurrentSong(song);
      setProgress(0);
    }
    setIsPlaying(true);
  };

  const pause = () => setIsPlaying(false);
  const togglePlayPause = () => setIsPlaying((p) => !p);
  const next = () => doNext();
  const prev = () => {
    setProgress(0);
    if (currentSong?.audioUrl && mainAudioRef.current) mainAudioRef.current.currentTime = 0;
  };
  const seek = (time: number) => {
    setProgress(time);
    if (currentSong?.audioUrl && mainAudioRef.current) mainAudioRef.current.currentTime = time;
  };
  const setVolume = (vol: number) => setVolumeState(vol);
  const toggleShuffle = () => setIsShuffle((s) => !s);
  const toggleRepeat = () => setIsRepeat((r) => !r);
  const toggleLike = (songId: string) => {
    setLikedSongs((prev) => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };
  const reorderQueue = (newQueue: Song[]) => setQueue(newQueue);
  const addToQueue = (song: Song) => {
    if (!currentSong) play(song);
    else setQueue((q) => [...q, song]);
  };

  const addUserSong = async (file: File): Promise<void> => {
    const audioData = await file.arrayBuffer();
    const audioMime = file.type || "audio/mpeg";
    const audioUrl = makeBlobUrl(audioData, audioMime);
    const name = file.name.replace(/\.[^/.]+$/, "");

    return new Promise((resolve) => {
      const audio = new Audio(audioUrl);
      const finalize = async (dur: number) => {
        const id = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const newSong: Song = {
          id,
          title: name,
          artist: "Unknown Artist",
          album: "Mis archivos",
          duration: Math.floor(dur) || 0,
          coverUrl: "/album1.png",
          audioUrl,
          isUserUploaded: true,
        };

        blobUrlsRef.current.set(id, [audioUrl]);

        await dbSaveSong({
          id,
          title: name,
          artist: "Unknown Artist",
          album: "Mis archivos",
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

        // Auto-search album art
        searchItunesArtwork(name, "").then(async (artUrl) => {
          if (!artUrl) return;
          const updater = (s: Song) => s.id === id ? { ...s, coverUrl: artUrl } : s;
          setUserSongs((prev) => prev.map(updater));
          setCurrentSong((prev) => prev?.id === id ? { ...prev, coverUrl: artUrl } : prev);
          setQueue((prev) => prev.map(updater));
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

    // Revoke old cover blob if any
    const existing = blobUrlsRef.current.get(songId) ?? [];
    blobUrlsRef.current.set(songId, [existing[0] ?? "", coverUrl].filter(Boolean));

    const updater = (s: Song) => s.id === songId ? { ...s, coverUrl } : s;
    setUserSongs((prev) => prev.map(updater));
    setCurrentSong((prev) => prev?.id === songId ? { ...prev, coverUrl } : prev);
    setQueue((prev) => prev.map(updater));

    await dbUpdateCover(songId, coverData, coverMime).catch(() => {});
  };

  const deleteSong = async (songId: string): Promise<void> => {
    // Revoke blob URLs
    const urls = blobUrlsRef.current.get(songId) ?? [];
    urls.forEach(URL.revokeObjectURL);
    blobUrlsRef.current.delete(songId);

    setUserSongs((prev) => prev.filter((s) => s.id !== songId));
    setQueue((prev) => prev.filter((s) => s.id !== songId));
    if (currentSongRef.current?.id === songId) {
      doNext();
    }
    await dbDeleteSong(songId).catch(() => {});
  };

  const setAudioQuality = (q: AudioQuality) => setAudioQualityState(q);
  const setCrossfadeSeconds = (s: number) => setCrossfadeSecondsState(s);
  const allSongs = [...userSongs];

  return (
    <MusicPlayerContext.Provider value={{
      currentSong, queue, isPlaying, progress, volume,
      isShuffle, isRepeat, likedSongs, userSongs, allSongs,
      audioQuality, crossfadeSeconds, isLoadingLibrary,
      play, pause, togglePlayPause, next, prev,
      seek, setVolume, toggleShuffle, toggleRepeat, toggleLike,
      reorderQueue, addToQueue, addUserSong, updateSongCover, deleteSong,
      setAudioQuality, setCrossfadeSeconds,
    }}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (!context) throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  return context;
}
