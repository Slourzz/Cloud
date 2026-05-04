import React, { useState } from "react";
import { useMusicPlayer, DEMO_SONGS, Song } from "@/hooks/use-music-player";
import { Search, MoreVertical, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Library() {
  const { currentSong, play, isPlaying } = useMusicPlayer();
  const [search, setSearch] = useState("");

  const filteredSongs = DEMO_SONGS.filter(song => 
    song.title.toLowerCase().includes(search.toLowerCase()) || 
    song.artist.toLowerCase().includes(search.toLowerCase())
  );

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-full flex flex-col animate-in slide-in-from-bottom-4 duration-500 pb-24">
      {/* Header (Sticky) */}
      <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-md px-6 pt-12 pb-4 border-b border-outline-variant/30">
        <h1 className="text-3xl font-bold text-on-surface mb-6">Library</h1>
        
        {/* Search Bar M3 */}
        <div className="relative w-full h-14 bg-surface-high rounded-full flex items-center px-4 elevation-1 focus-within:elevation-2 transition-shadow">
          <Search className="w-6 h-6 text-on-surface-variant ml-1" />
          <input 
            type="text" 
            placeholder="Search songs, artists..."
            className="flex-1 bg-transparent border-none outline-none text-on-surface px-3 placeholder:text-on-surface-variant font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Song List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {filteredSongs.map((song, i) => {
          const isCurrent = currentSong?.id === song.id;
          
          return (
            <div 
              key={song.id}
              onClick={() => play(song)}
              className={cn(
                "flex items-center w-full p-2 rounded-[16px] cursor-pointer ripple group transition-colors duration-200 animate-in fade-in slide-in-from-bottom-2",
                isCurrent ? "bg-secondary-container" : "hover:bg-surface-container"
              )}
              style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
            >
              {/* Thumbnail */}
              <div className="relative w-14 h-14 rounded-[12px] overflow-hidden shrink-0">
                <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                {isCurrent && isPlaying && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-4 h-4 flex items-end justify-between px-0.5">
                      <div className="w-1 bg-white animate-pulse" style={{ height: "40%", animationDuration: "0.5s" }} />
                      <div className="w-1 bg-white animate-pulse" style={{ height: "100%", animationDuration: "0.7s" }} />
                      <div className="w-1 bg-white animate-pulse" style={{ height: "60%", animationDuration: "0.4s" }} />
                    </div>
                  </div>
                )}
                {!isCurrent && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-6 h-6 text-white fill-current" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 px-4">
                <h3 className={cn(
                  "text-base font-semibold truncate",
                  isCurrent ? "text-on-secondary-container" : "text-on-surface"
                )}>
                  {song.title}
                </h3>
                <p className={cn(
                  "text-sm truncate",
                  isCurrent ? "text-on-secondary-container/80" : "text-on-surface-variant"
                )}>
                  {song.artist}
                </p>
              </div>

              {/* Duration & More */}
              <div className="flex items-center gap-3 shrink-0 text-on-surface-variant px-2">
                <span className="text-sm font-medium">{formatTime(song.duration)}</span>
                <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-on-surface/10 ripple">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredSongs.length === 0 && (
          <div className="text-center py-20 text-on-surface-variant">
            <p className="text-lg">No songs found</p>
          </div>
        )}
      </div>
    </div>
  );
}
