import React, { useState, useEffect } from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { Slider } from "@/components/ui/slider";
import { 
  Play, Pause, SkipBack, SkipForward, 
  Repeat, Shuffle, Heart, Volume2 
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const { 
    currentSong, isPlaying, progress, volume, 
    isShuffle, isRepeat, likedSongs,
    togglePlayPause, next, prev, seek, 
    setVolume, toggleShuffle, toggleRepeat, toggleLike 
  } = useMusicPlayer();

  if (!currentSong) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const isLiked = likedSongs.has(currentSong.id);

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <span className="text-sm font-medium tracking-wide uppercase text-on-surface-variant">
          Playing from {currentSong.album}
        </span>
      </div>

      {/* Album Art Hero */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-[320px] mx-auto">
        <div 
          className={cn(
            "relative w-full aspect-square rounded-[28px] overflow-hidden elevation-3 mb-10 transition-transform duration-1000",
            isPlaying ? "scale-100" : "scale-95 shadow-md"
          )}
        >
          <img 
            src={currentSong.coverUrl} 
            alt={currentSong.album} 
            className="w-full h-full object-cover"
          />
        </div>

        {/* Song Info & Like */}
        <div className="w-full flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-on-surface tracking-tight mb-1 truncate max-w-[240px]">
              {currentSong.title}
            </h1>
            <p className="text-base text-on-surface-variant truncate max-w-[240px]">
              {currentSong.artist}
            </p>
          </div>
          <button 
            onClick={() => toggleLike(currentSong.id)}
            className="w-12 h-12 rounded-full flex items-center justify-center ripple text-primary hover:bg-primary/10 transition-colors"
          >
            <Heart className="w-7 h-7" fill={isLiked ? "currentColor" : "none"} strokeWidth={isLiked ? 0 : 2} />
          </button>
        </div>

        {/* Scrubber */}
        <div className="w-full mb-6">
          <Slider 
            value={[progress]} 
            max={currentSong.duration} 
            step={1}
            onValueChange={(val) => seek(val[0])}
            className="w-full h-4 group cursor-pointer"
          />
          <div className="flex items-center justify-between mt-2 text-xs font-medium text-on-surface-variant tabular-nums">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(currentSong.duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="w-full flex items-center justify-between mb-8">
          <button 
            onClick={toggleShuffle}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center ripple transition-colors",
              isShuffle ? "text-primary bg-primary-container" : "text-on-surface-variant hover:bg-on-surface/5"
            )}
          >
            <Shuffle className="w-5 h-5" strokeWidth={2.5} />
          </button>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={prev}
              className="w-14 h-14 rounded-full flex items-center justify-center ripple text-on-surface hover:bg-on-surface/5 transition-colors"
            >
              <SkipBack className="w-7 h-7 fill-current" />
            </button>
            
            <button 
              onClick={togglePlayPause}
              className="w-20 h-20 rounded-[24px] bg-primary text-primary-foreground flex items-center justify-center ripple elevation-2 hover:elevation-3 hover:bg-primary/90 transition-all"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-1" />
              )}
            </button>

            <button 
              onClick={next}
              className="w-14 h-14 rounded-full flex items-center justify-center ripple text-on-surface hover:bg-on-surface/5 transition-colors"
            >
              <SkipForward className="w-7 h-7 fill-current" />
            </button>
          </div>

          <button 
            onClick={toggleRepeat}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center ripple transition-colors",
              isRepeat ? "text-primary bg-primary-container" : "text-on-surface-variant hover:bg-on-surface/5"
            )}
          >
            <Repeat className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Volume */}
        <div className="w-full flex items-center gap-4 px-2 text-on-surface-variant">
          <Volume2 className="w-5 h-5" />
          <Slider 
            value={[volume]} 
            max={100} 
            step={1}
            onValueChange={(val) => setVolume(val[0])}
            className="flex-1 opacity-70 hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </div>
  );
}
