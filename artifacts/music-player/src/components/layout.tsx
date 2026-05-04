import React, { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Music, ListMusic, ListVideo, Heart,
  Settings, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { TransportBar } from "@/components/transport-bar";
import { SettingsPanel } from "@/components/settings-panel";

const NAV_ITEMS = [
  { href: "/", icon: Music, label: "Reproduciendo" },
  { href: "/library", icon: ListMusic, label: "Biblioteca" },
  { href: "/queue", icon: ListVideo, label: "Cola" },
  { href: "/liked", icon: Heart, label: "Me gusta" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { userSongs, currentSong, play, allSongs, likedSongs } = useMusicPlayer();

  const likedSongsList = allSongs.filter((s) => likedSongs.has(s.id));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-surface">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 h-full flex flex-col bg-surface-container border-r border-outline-variant/20 z-10">
        {/* Header: app name + settings button */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <div>
            <h1
              className="text-lg font-bold text-on-surface tracking-tight"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Soundscape
            </h1>
            <p className="text-[11px] text-on-surface-variant">Music Player</p>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full bg-surface-high flex items-center justify-center ripple text-on-surface-variant hover:text-on-surface hover:bg-secondary-container transition-colors elevation-1"
            title="Ajustes"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        <div className="px-3 pb-2">
          <div className="h-px bg-outline-variant/30" />
        </div>

        {/* Nav */}
        <nav className="px-3 space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-3 py-1.5">
            Navegar
          </p>
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer ripple transition-all select-none",
                    isActive
                      ? "bg-secondary-container text-on-secondary-container font-semibold"
                      : "text-on-surface-variant hover:bg-on-surface/5 hover:text-on-surface"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-sm">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="w-3 h-3 ml-auto opacity-60" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User uploaded songs */}
        {userSongs.length > 0 && (
          <>
            <div className="px-3 pt-4 pb-1">
              <div className="h-px bg-outline-variant/30" />
            </div>
            <div className="px-3 pt-2 flex-1 min-h-0 overflow-y-auto">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-3 py-1.5">
                Mis archivos
              </p>
              <div className="space-y-0.5">
                {userSongs.map((song) => {
                  const isActive = currentSong?.id === song.id;
                  return (
                    <div
                      key={song.id}
                      onClick={() => play(song)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer ripple transition-all",
                        isActive
                          ? "bg-primary-container text-on-primary-container"
                          : "text-on-surface-variant hover:bg-on-surface/5 hover:text-on-surface"
                      )}
                    >
                      <Music className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                      <span className="text-xs truncate">{song.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Now playing mini indicator in sidebar */}
        {currentSong && (
          <div className="mt-auto px-3 pb-24">
            <div className="h-px bg-outline-variant/30 mb-3" />
            <div className="flex items-center gap-2 px-2 py-2 rounded-2xl bg-surface-high">
              <img
                src={currentSong.coverUrl}
                alt=""
                className="w-8 h-8 rounded-lg object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-on-surface truncate leading-tight">
                  {currentSong.title}
                </p>
                <p className="text-[10px] text-on-surface-variant truncate leading-tight">
                  {currentSong.artist}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto pb-28 bg-background">
        {children}
      </main>

      {/* Floating Transport Bar */}
      <TransportBar />

      {/* Settings Panel */}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
