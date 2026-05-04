import React, { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { ListMusic, Heart, Settings, ChevronRight, Compass, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { TransportBar } from "@/components/transport-bar";
import { SettingsPanel } from "@/components/settings-panel";
import { CornerControls } from "@/components/corner-controls";
import { FullscreenPlayer } from "@/components/fullscreen-player";

const NAV_ITEMS = [
  { href: "/playlists", icon: Compass, label: "Explorar" },
  { href: "/library", icon: ListMusic, label: "Biblioteca" },
  { href: "/liked", icon: Heart, label: "Me gusta" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const { userSongs, currentSong, play } = useMusicPlayer();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-surface relative">
      {/* Dynamic ambient background — colors animated by RAF in use-theme-colors */}
      <div
        className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-500"
        style={{
          background: `
            radial-gradient(ellipse 90% 60% at 5% 0%, rgb(var(--dyn-v) / 0.09) 0%, transparent 55%),
            radial-gradient(ellipse 60% 70% at 95% 100%, rgb(var(--dyn-m) / 0.06) 0%, transparent 55%)
          `,
        }}
      />

      {/* Sidebar */}
      <aside className="relative z-10 w-60 shrink-0 h-full flex flex-col border-r border-outline-variant/20"
        style={{ background: "hsl(var(--surface-container) / 0.85)", backdropFilter: "blur(20px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <Link href="/">
            <div className="cursor-pointer">
              <h1 className="text-lg font-bold text-on-surface tracking-tight leading-tight" style={{ fontFamily: "var(--font-heading)" }}>
                Soundscape
              </h1>
              <p className="text-[11px] text-on-surface-variant">Music Player</p>
            </div>
          </Link>
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
            const isActive = location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer ripple transition-all select-none",
                    isActive
                      ? "font-semibold"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5"
                  )}
                  style={isActive ? {
                    background: `rgb(var(--dyn-v) / 0.15)`,
                    color: `rgb(var(--dyn-v))`,
                  } : {}}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                  <span className="text-sm">{item.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
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
                        isActive ? "font-semibold" : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5"
                      )}
                      style={isActive ? { background: `rgb(var(--dyn-v) / 0.15)`, color: `rgb(var(--dyn-v))` } : {}}
                    >
                      <Music2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                      <span className="text-xs truncate">{song.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Now playing mini indicator */}
        {currentSong && (
          <div className="mt-auto px-3 pb-24">
            <div className="h-px bg-outline-variant/30 mb-3" />
            <Link href="/">
              <div className="flex items-center gap-2 px-2 py-2 rounded-2xl bg-surface-high cursor-pointer hover:bg-surface-highest transition-colors">
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
            </Link>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="relative z-10 flex-1 h-full overflow-y-auto pb-28 bg-background/60">
        {children}
      </main>

      {/* Corner Controls (above transport bar) */}
      <CornerControls onFullscreen={() => setFullscreenOpen(true)} />

      {/* Floating Transport Bar */}
      <TransportBar />

      {/* Settings Panel */}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Fullscreen Player */}
      <FullscreenPlayer open={fullscreenOpen} onClose={() => setFullscreenOpen(false)} />
    </div>
  );
}
