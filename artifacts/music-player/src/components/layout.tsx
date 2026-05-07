import React, { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { ListMusic, Heart, Settings, ChevronRight, Compass, Music2, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { useDarkMode } from "@/hooks/use-dark-mode";
import { TransportBar } from "@/components/transport-bar";
import { SettingsPanel } from "@/components/settings-panel";
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
  const { currentSong, play, userSongs } = useMusicPlayer();
  const { isDark, toggleDark } = useDarkMode();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-surface relative">
      {/* Dynamic ambient gradient */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 55% at 5% 0%, rgb(var(--dyn-v) / ${isDark ? "0.13" : "0.07"}) 0%, transparent 55%),
            radial-gradient(ellipse 65% 65% at 95% 100%, rgb(var(--dyn-m) / ${isDark ? "0.09" : "0.04"}) 0%, transparent 55%)
          `,
          transition: "background 2s ease",
        }}
      />

      {/* ── Sidebar ── */}
      <aside
        className="relative z-10 w-60 shrink-0 h-full flex flex-col border-r border-outline-variant/15"
        style={{
          background: isDark
            ? "hsl(var(--surface-container) / 0.88)"
            : "hsl(var(--surface-container) / 0.80)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <Link href="/">
            <div className="cursor-pointer select-none group">
              <h1
                className="text-lg font-bold text-on-surface tracking-tight leading-tight transition-opacity duration-200 group-hover:opacity-80"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Cloud
              </h1>
              <p className="text-[11px] text-on-surface-variant">Music Player</p>
            </div>
          </Link>

          <div className="flex items-center gap-0.5">
            <button
              onClick={toggleDark}
              title={isDark ? "Modo claro" : "Modo oscuro"}
              className="icon-btn w-8 h-8 ripple text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8"
            >
              <span className="transition-transform duration-300" style={{ transform: isDark ? "rotate(0deg)" : "rotate(180deg)" }}>
                {isDark
                  ? <Sun className="w-3.5 h-3.5" />
                  : <Moon className="w-3.5 h-3.5" />}
              </span>
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="icon-btn w-8 h-8 ripple text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8"
              title="Ajustes"
            >
              <Settings className="w-3.5 h-3.5 transition-transform duration-500 hover:rotate-45" />
            </button>
          </div>
        </div>

        <div className="px-3 pb-2">
          <div className="h-px bg-outline-variant/20" />
        </div>

        {/* Nav items */}
        <nav className="px-3 space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-3 py-1.5 select-none">
            Navegar
          </p>
          {NAV_ITEMS.map((item, idx) => {
            const isActive = location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-2xl cursor-pointer ripple select-none",
                    "stagger-item",
                    !isActive && "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5"
                  )}
                  style={{
                    animationDelay: `${idx * 40}ms`,
                    ...(isActive ? {
                      background: `rgb(var(--dyn-v) / 0.14)`,
                      color: `rgb(var(--dyn-v))`,
                      fontWeight: 600,
                    } : {}),
                    transition: "background-color 180ms ease, color 180ms ease, transform 120ms cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                >
                  <Icon
                    className="w-4 h-4 shrink-0 transition-transform duration-200"
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className="text-sm">{item.label}</span>
                  <ChevronRight
                    className="w-3 h-3 ml-auto transition-all duration-200"
                    style={{
                      opacity: isActive ? 0.6 : 0,
                      transform: isActive ? "translateX(0)" : "translateX(-4px)",
                    }}
                  />
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User songs list */}
        {userSongs.length > 0 && (
          <>
            <div className="px-3 pt-4 pb-1">
              <div className="h-px bg-outline-variant/20" />
            </div>
            <div className="px-3 pt-2 flex-1 min-h-0 overflow-y-auto scrollbar-hide">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-3 py-1.5 select-none">
                Mis archivos
              </p>
              <div className="space-y-0.5">
                {userSongs.map((song, idx) => {
                  const isActive = currentSong?.id === song.id;
                  return (
                    <div
                      key={song.id}
                      onClick={() => play(song)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer ripple stagger-item",
                        !isActive && "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5"
                      )}
                      style={{
                        animationDelay: `${(idx + NAV_ITEMS.length) * 30}ms`,
                        ...(isActive ? {
                          background: `rgb(var(--dyn-v) / 0.14)`,
                          color: `rgb(var(--dyn-v))`,
                          fontWeight: 600,
                        } : {}),
                        transition: "background-color 180ms ease, color 180ms ease",
                      }}
                    >
                      {isActive ? (
                        <div className="flex items-end gap-[2px] h-3 shrink-0">
                          {[1, 0.55, 0.8].map((h, j) => (
                            <div
                              key={j}
                              className="w-0.5 rounded-full"
                              style={{
                                height: `${h * 12}px`,
                                background: `rgb(var(--dyn-v))`,
                                animation: `waveform ${0.6 + j * 0.15}s ease-in-out ${j * 0.1}s infinite alternate`,
                              }}
                            />
                          ))}
                        </div>
                      ) : (
                        <Music2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                      )}
                      <span className="text-xs truncate">{song.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Now playing mini strip */}
        {currentSong && (
          <div className="mt-auto px-3 pb-24">
            <div className="h-px bg-outline-variant/20 mb-3" />
            <Link href="/">
              <div
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-2xl cursor-pointer ripple group"
                style={{
                  background: "hsl(var(--surface-high) / 0.9)",
                  transition: "background-color 200ms ease, transform 150ms cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                <div className="relative shrink-0">
                  <img
                    src={currentSong.coverUrl}
                    alt=""
                    className="w-8 h-8 rounded-xl object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
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

      {/* ── Main content ── */}
      <main
        key={location}
        className="relative z-10 flex-1 h-full overflow-y-auto pb-28 bg-background/50 page-enter"
      >
        {children}
      </main>

      {/* ── Transport bar ── */}
      <TransportBar onFullscreen={() => setFullscreenOpen(true)} />

      {/* ── Panels ── */}
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <FullscreenPlayer open={fullscreenOpen} onClose={() => setFullscreenOpen(false)} />
    </div>
  );
}
