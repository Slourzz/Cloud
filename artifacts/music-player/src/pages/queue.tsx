import React from "react";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { GripVertical, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Queue() {
  const { currentSong, queue, play, isPlaying } = useMusicPlayer();

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-full flex flex-col animate-in slide-in-from-bottom-4 duration-500 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface/90 backdrop-blur-md px-6 pt-12 pb-4 border-b border-outline-variant/30">
        <h1 className="text-3xl font-bold text-on-surface mb-2">Queue</h1>
        <p className="text-on-surface-variant text-sm font-medium">
          {queue.length} songs upcoming
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        
        {/* Now Playing Section */}
        {currentSong && (
          <section>
            <h2 className="text-sm font-bold text-primary uppercase tracking-wider mb-3 px-2">
              Now Playing
            </h2>
            <div className="flex items-center w-full p-2 rounded-[16px] bg-primary-container text-on-primary-container elevation-1 mb-4">
              <div className="relative w-14 h-14 rounded-[12px] overflow-hidden shrink-0">
                <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full object-cover" />
                {isPlaying && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-4 h-4 flex items-end justify-between px-0.5">
                      <div className="w-1 bg-white animate-pulse" style={{ height: "40%", animationDuration: "0.5s" }} />
                      <div className="w-1 bg-white animate-pulse" style={{ height: "100%", animationDuration: "0.7s" }} />
                      <div className="w-1 bg-white animate-pulse" style={{ height: "60%", animationDuration: "0.4s" }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 px-4">
                <h3 className="text-base font-semibold truncate">{currentSong.title}</h3>
                <p className="text-sm truncate opacity-80">{currentSong.artist}</p>
              </div>
              <div className="px-3 font-medium text-sm">
                {formatTime(currentSong.duration)}
              </div>
            </div>
          </section>
        )}

        {/* Up Next Section */}
        <section>
          <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mb-3 px-2">
            Up Next
          </h2>
          <div className="space-y-2">
            {queue.map((song, i) => (
              <div 
                key={`${song.id}-${i}`}
                className="flex items-center w-full p-2 rounded-[16px] m3-card cursor-pointer group"
                onClick={() => play(song)}
              >
                <div className="px-2 cursor-grab text-outline-variant hover:text-on-surface transition-colors">
                  <GripVertical className="w-5 h-5" />
                </div>
                
                <div className="relative w-12 h-12 rounded-[8px] overflow-hidden shrink-0 ml-1">
                  <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-5 h-5 text-white fill-current" />
                  </div>
                </div>

                <div className="flex-1 min-w-0 px-4">
                  <h3 className="text-base font-semibold text-on-surface truncate">{song.title}</h3>
                  <p className="text-sm text-on-surface-variant truncate">{song.artist}</p>
                </div>

                <div className="px-3 font-medium text-sm text-on-surface-variant">
                  {formatTime(song.duration)}
                </div>
              </div>
            ))}
            
            {queue.length === 0 && (
              <div className="text-center py-10 text-on-surface-variant">
                <p>Queue is empty</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
