import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  coverUrl: string;
}

export const DEMO_SONGS: Song[] = [
  { id: "1", title: "Midnight City", artist: "Chilled Cow", album: "Lo-Fi Beats", duration: 184, coverUrl: "/album3.png" },
  { id: "2", title: "Neon Nights", artist: "Synthwave Collective", album: "Retro Future", duration: 245, coverUrl: "/album2.png" },
  { id: "3", title: "Golden Hour", artist: "Indie Souls", album: "Acoustic Afternoons", duration: 210, coverUrl: "/album5.png" },
  { id: "4", title: "Electric Pulse", artist: "DJ Vortex", album: "Club Bangers", duration: 195, coverUrl: "/album4.png" },
  { id: "5", title: "Ocean Breeze", artist: "Ambient Vibes", album: "Chill Tides", duration: 320, coverUrl: "/album6.png" },
  { id: "6", title: "Abstract Thoughts", artist: "Modern Art", album: "Geometric Sounds", duration: 175, coverUrl: "/album1.png" },
  { id: "7", title: "Sunset Drive", artist: "Chilled Cow", album: "Lo-Fi Beats", duration: 198, coverUrl: "/album3.png" },
  { id: "8", title: "Cyberpunk City", artist: "Synthwave Collective", album: "Retro Future", duration: 270, coverUrl: "/album2.png" },
  { id: "9", title: "Morning Dew", artist: "Indie Souls", album: "Acoustic Afternoons", duration: 185, coverUrl: "/album5.png" },
  { id: "10", title: "Bass Drop", artist: "DJ Vortex", album: "Club Bangers", duration: 215, coverUrl: "/album4.png" },
  { id: "11", title: "Deep Sea", artist: "Ambient Vibes", album: "Chill Tides", duration: 290, coverUrl: "/album6.png" },
  { id: "12", title: "Colors Collision", artist: "Modern Art", album: "Geometric Sounds", duration: 205, coverUrl: "/album1.png" },
];

interface MusicPlayerState {
  currentSong: Song | null;
  queue: Song[];
  isPlaying: boolean;
  progress: number;
  volume: number;
  isShuffle: boolean;
  isRepeat: boolean;
  likedSongs: Set<string>;
  
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
}

const MusicPlayerContext = createContext<MusicPlayerState | undefined>(undefined);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(DEMO_SONGS[0]);
  const [queue, setQueue] = useState<Song[]>(DEMO_SONGS.slice(1));
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set(["1", "4"]));

  // Simulate playback
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentSong) {
      interval = setInterval(() => {
        setProgress((p) => {
          if (p >= currentSong.duration) {
            if (isRepeat) {
              return 0; // loop
            } else {
              // auto next
              setTimeout(() => next(), 0);
              return p;
            }
          }
          return p + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentSong, isRepeat]);

  const play = (song?: Song) => {
    if (song) {
      setCurrentSong(song);
      setProgress(0);
    }
    setIsPlaying(true);
  };

  const pause = () => setIsPlaying(false);

  const togglePlayPause = () => setIsPlaying((p) => !p);

  const next = () => {
    if (queue.length > 0) {
      const nextSong = queue[0];
      setQueue((q) => [...q.slice(1), currentSong!]);
      setCurrentSong(nextSong);
      setProgress(0);
      if (!isPlaying) setIsPlaying(true);
    }
  };

  const prev = () => {
    if (progress > 3) {
      setProgress(0);
    } else {
      // Just restart current if queue is empty or for simplicity
      setProgress(0);
    }
  };

  const seek = (time: number) => setProgress(time);
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
    if (!currentSong) {
      play(song);
    } else {
      setQueue((q) => [...q, song]);
    }
  };

  return (
    <MusicPlayerContext.Provider
      value={{
        currentSong,
        queue,
        isPlaying,
        progress,
        volume,
        isShuffle,
        isRepeat,
        likedSongs,
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
        addToQueue
      }}
    >
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error("useMusicPlayer must be used within a MusicPlayerProvider");
  }
  return context;
}
