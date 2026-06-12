import React, {
  ReactNode,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  ListMusic,
  Heart,
  Settings,
  ChevronRight,
  Music2,
  Disc3,
  PanelRightOpen,
  Maximize2,
  Minus,
  Square,
  X,
  Copy,
  Menu,
  User,
  ArrowLeft,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Clock3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { usePlaylists } from "@/hooks/use-playlists";
import { useDiscordAuth } from "@/hooks/use-discord-auth";
import { TransportBar } from "@/components/transport-bar";
import { SettingsPanel } from "@/components/settings-panel";
import { FullscreenPlayer } from "@/components/fullscreen-player";
import { SidePlayer, type SidePlayerMode } from "@/components/SidePlayer";
import { HomeDynamicBackground } from "@/components/HomeDynamicBackground";
import { CloudHourBackground } from "@/components/CloudHourBackground";
import { CustomBackgroundLayer } from "@/components/CustomBackgroundLayer";
import { CustomScrollbar } from "@/components/CustomScrollbar";
import { useAppearance } from "@/providers/appearance-provider";
import {
  CloudNotification,
  useCloudNotifications,
} from "@/hooks/use-cloud-notifications";

type SettingsNavigationState = {
  open: boolean;
  canGoBack: boolean;
  activeCategory: string | null;
};

function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindowRef = useRef<any>(null);

  useEffect(() => {
    import("@tauri-apps/api/window")
      .then((mod) => {
        const appWindow = mod.getCurrentWindow();
        appWindowRef.current = appWindow;
        appWindow.isMaximized().then(async (maximized) => {
          if (!maximized) {
            await appWindow.maximize().catch(() => {});
          }
          setIsMaximized(await appWindow.isMaximized());
        });
        const unlisten = appWindow.onResized(() => {
          appWindow.isMaximized().then(setIsMaximized);
        });
        return () => {
          unlisten.then((fn: any) => fn());
        };
      })
      .catch(() => {});
  }, []);

  const handleMinimize = () => appWindowRef.current?.minimize();
  const handleMaximize = () => appWindowRef.current?.toggleMaximize();
  const handleClose = () => appWindowRef.current?.close();

  const btnClass =
    "h-7 w-7 flex items-center justify-center rounded-full text-white hover:bg-white/20 transition-all";

  return (
    <div className="flex items-center gap-1">
      <button onClick={handleMinimize} className={btnClass} title="Minimizar">
        <Minus className="h-4 w-4" />
      </button>
      <button
        onClick={handleMaximize}
        className={btnClass}
        title={isMaximized ? "Restaurar" : "Maximizar"}
      >
        {isMaximized ? (
          <Copy className="h-3.5 w-3.5" />
        ) : (
          <Square className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        onClick={handleClose}
        className={`${btnClass} hover:bg-red-500/70`}
        title="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function SettingsContextButton({
  mode,
  onClick,
}: {
  mode: "back" | "close";
  onClick: () => void;
}) {
  const isBack = mode === "back";

  return (
    <button
      onClick={onClick}
      className="group relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-white transition-all duration-300 hover:bg-white/20 active:scale-95"
      title={isBack ? "Volver" : "Cerrar ajustes"}
      data-tauri-drag-region="false"
    >
      <span className="relative block h-4 w-4">
        <ArrowLeft
          className={cn(
            "absolute inset-0 h-4 w-4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            isBack
              ? "translate-x-0 rotate-0 scale-100 opacity-100"
              : "-translate-x-2 -rotate-45 scale-75 opacity-0",
          )}
        />
        <X
          className={cn(
            "absolute inset-0 h-4 w-4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            isBack
              ? "translate-x-2 rotate-45 scale-75 opacity-0"
              : "translate-x-0 rotate-0 scale-100 opacity-100",
          )}
        />
      </span>
    </button>
  );
}

function NotificationIcon({ type }: { type: CloudNotification["type"] }) {
  if (type === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (type === "warning") return <AlertTriangle className="h-4 w-4" />;
  if (type === "pending") return <Clock3 className="h-4 w-4" />;
  return <Bell className="h-4 w-4" />;
}

function NotificationsPanel({
  notifications,
  onClear,
}: {
  notifications: CloudNotification[];
  onClear: () => void;
}) {
  return (
    <div className="notification-panel absolute left-0 top-12 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[24px] text-white">
      <div className="flex items-center justify-between gap-3 border-b border-white/12 px-4 py-3">
        <div>
          <p className="text-sm font-black">Notificaciones</p>
          <p className="text-xs font-medium text-white/56">
            Revisiones y respuestas de Cloud
          </p>
        </div>
        {notifications.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full px-3 py-1 text-xs font-bold text-white/68 transition hover:bg-white/12 hover:text-white"
          >
            Limpiar
          </button>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Bell className="mx-auto h-7 w-7 text-white/36" />
          <p className="mt-3 text-sm font-bold text-white/72">
            Nada nuevo por ahora
          </p>
          <p className="mt-1 text-xs text-white/48">
            Aqui apareceran respuestas de TTML y avisos importantes.
          </p>
        </div>
      ) : (
        <div className="h-[min(420px,calc(100vh-8rem))] overflow-hidden">
          <CustomScrollbar
            className="h-full"
            size="small"
            barWidth="6px"
            scrollbarOffsetX={5}
            idleTimeout={1400}
            variant="liquid"
          >
            <div className="space-y-2 py-3 pl-3 pr-5">
              {notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={cn(
                    "rounded-[18px] border px-3 py-3 transition",
                    notification.read
                      ? "border-white/10 bg-white/[0.045]"
                      : "border-white/20 bg-white/[0.09]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        notification.type === "success" &&
                          "bg-emerald-400/18 text-emerald-100",
                        notification.type === "warning" &&
                          "bg-amber-400/18 text-amber-100",
                        notification.type === "pending" &&
                          "bg-sky-400/18 text-sky-100",
                        notification.type === "info" &&
                          "bg-white/12 text-white",
                      )}
                    >
                      <NotificationIcon type={notification.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black leading-tight text-white">
                        {notification.title}
                      </p>
                      <p className="mt-1 text-xs font-medium leading-relaxed text-white/70">
                        {notification.message}
                      </p>
                      {notification.detail ? (
                        <p className="mt-2 rounded-xl bg-black/16 px-3 py-2 text-xs leading-relaxed text-white/72">
                          "{notification.detail}"
                        </p>
                      ) : null}
                      {notification.author ? (
                        <p className="mt-2 text-[11px] font-semibold text-white/48">
                          — {notification.author}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </CustomScrollbar>
        </div>
      )}
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/home", icon: Home, label: "Como accediste aqui XD" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBackRequest, setSettingsBackRequest] = useState(0);
  const [settingsNavState, setSettingsNavState] =
    useState<SettingsNavigationState>({
      open: false,
      canGoBack: false,
      activeCategory: null,
    });
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [sidePlayerOpen, setSidePlayerOpen] = useState(false);
  const [sidePlayerMode, setSidePlayerMode] =
    useState<SidePlayerMode>("player");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(true);
  const [showArtists, setShowArtists] = useState(false);
  const [showAlbums, setShowAlbums] = useState(false);
  const {
    currentSong,
    play,
    allSongs,
    userSongs,
    togglePlayPause,
    next,
    prev,
    setVolume,
    volume,
  } = useMusicPlayer();
  const { playlists } = usePlaylists();
  const { user: discordUser } = useDiscordAuth();
  const { settings: appearance } = useAppearance();
  const isSimplyUI = appearance.interfaceTheme === "simplyui";
  const { notifications, unreadCount, markAllRead, clearNotifications } =
    useCloudNotifications();

  const sidePlayerStateBeforeFullscreen = useRef(false);
  const lastVolume = useRef(volume);
  const wasMaximizedBeforeFullscreen = useRef(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const openSettings = useCallback(() => {
    setSettingsOpen(true);
    setMenuOpen(false);
    setNotificationsOpen(false);
    setShowPlaylists(false);
    setShowArtists(false);
    setShowAlbums(false);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setSettingsNavState({
      open: false,
      canGoBack: false,
      activeCategory: null,
    });
  }, []);

  const handleSettingsContextAction = useCallback(() => {
    if (settingsNavState.canGoBack) {
      setSettingsBackRequest((value) => value + 1);
      return;
    }

    closeSettings();
  }, [settingsNavState.canGoBack, closeSettings]);

  const handleFullscreen = () => {
    sidePlayerStateBeforeFullscreen.current = sidePlayerOpen;
    if (sidePlayerOpen) setSidePlayerOpen(false);
    if (notificationsOpen) setNotificationsOpen(false);
    setFullscreenOpen(true);
  };

  const toggleNotifications = useCallback(() => {
    setNotificationsOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) {
        markAllRead();
        setMenuOpen(false);
      }
      return nextOpen;
    });
  }, [markAllRead]);

  const handleFullscreenClose = () => {
    setSidePlayerOpen(sidePlayerStateBeforeFullscreen.current);
    setFullscreenOpen(false);
  };

  useEffect(() => {
    if (volume > 0) lastVolume.current = volume;
  }, [volume]);

  const toggleSystemFullscreen = useCallback(async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const currentlyFullscreen = await win.isFullscreen();

      if (!currentlyFullscreen) {
        wasMaximizedBeforeFullscreen.current = await win.isMaximized();

        if (wasMaximizedBeforeFullscreen.current) {
          await win.unmaximize();
          await new Promise((resolve) => setTimeout(resolve, 80));
        }

        await win.setFullscreen(true);
        setIsFullscreen(true);
      } else {
        await win.setFullscreen(false);
        setIsFullscreen(false);

        await new Promise((resolve) => setTimeout(resolve, 80));

        if (wasMaximizedBeforeFullscreen.current) {
          await win.maximize();
        }
      }

      window.dispatchEvent(new Event("resize"));

      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 100);

      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 300);
    } catch (error) {
      console.error("Error al cambiar pantalla completa:", error);
    }
  }, []);

  const isHomePage = location === "/home" || location === "/";
  const isPlaylistDetail =
    location.startsWith("/playlists/") && location !== "/playlists";
  const isLibraryPage = location === "/library";
  const isArtistPage = location.startsWith("/artist/");
  const hideSidebar =
    isHomePage || isPlaylistDetail || isLibraryPage || isArtistPage;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.key === "F11") {
        e.preventDefault();
        toggleSystemFullscreen();
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlayPause();
          break;
        case "ArrowRight":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prev();
          break;
        case "m":
        case "M":
          e.preventDefault();
          if (volume > 0) {
            setVolume(0);
          } else {
            setVolume(lastVolume.current > 0 ? lastVolume.current : 50);
          }
          break;
        case "l":
        case "L":
          e.preventDefault();
          setSidePlayerOpen((prev) => !prev);
          break;
        case "s":
        case "S":
          e.preventDefault();
          if (location === "/home")
            document.getElementById("home-search-input")?.focus();
          break;
        case "c":
        case "C":
          e.preventDefault();
          openSettings();
          break;
        case "r":
        case "R":
          e.preventDefault();
          setSidePlayerMode("queue");
          setSidePlayerOpen(true);
          break;
        case "n":
        case "N":
          e.preventDefault();
          setMenuOpen((prev) => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    togglePlayPause,
    next,
    prev,
    setVolume,
    volume,
    location,
    toggleSystemFullscreen,
    openSettings,
  ]);

  const glassStyle: React.CSSProperties = {
    background: "var(--cloud-surface-strong)",
    backdropFilter: "var(--cloud-glass-filter)",
    WebkitBackdropFilter: "var(--cloud-glass-filter)",
    border: "1px solid var(--cloud-border)",
    boxShadow: "var(--cloud-shadow), inset 0 1px 0 rgba(255,255,255,0.22)",
  };

  const navigationItems = [{ href: "/home", icon: Home, label: "Inicio" }];

  const sortedPlaylists = [...playlists].sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  const uniqueArtists = [...new Set(allSongs.map((s) => s.artist))].sort(
    (a, b) => a.localeCompare(b),
  );
  const uniqueAlbums = [
    ...new Set(allSongs.map((song) => song.album).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  const handleNavigate = (href: string) => {
    setLocation(href);
  };

  return (
    <div
      className="cloud-theme-root fixed inset-0 flex flex-col overflow-hidden text-white"
      style={{
        width: "100vw",
        height: "100dvh",
        minHeight: "100dvh",
        background: "var(--cloud-app-bg)",
      }}
    >
      <HomeDynamicBackground />
      <CloudHourBackground />
      <CustomBackgroundLayer />
      {!isFullscreen && !fullscreenOpen && (
        <>
          <div
            className="fixed left-1 right-1 z-[9999] flex flex-col"
            style={{
              top: "4px",
              marginLeft: "8px",
              marginRight: "8px",
            }}
          >
            <div
              className="flex h-10 items-center rounded-t-[20px] px-3"
              style={{
                ...glassStyle,
                borderBottomLeftRadius: "20px",
                borderBottomRightRadius: "20px",
              }}
              data-tauri-drag-region
            >
              <div
                className="flex items-center gap-2"
                data-tauri-drag-region="false"
              >
                {settingsOpen ? (
                  <SettingsContextButton
                    mode={settingsNavState.canGoBack ? "back" : "close"}
                    onClick={handleSettingsContextAction}
                  />
                ) : isPlaylistDetail ? (
                  <SettingsContextButton
                    mode="back"
                    onClick={() => setLocation("/home")}
                  />
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setMenuOpen(!menuOpen);
                        setShowPlaylists(false);
                        setShowArtists(false);
                        setNotificationsOpen(false);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-white transition-all hover:bg-white/20 active:scale-95"
                    >
                      <Menu className="h-4 w-4" />
                    </button>
                    <button
                      onClick={openSettings}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-white transition-all hover:bg-white/20 active:scale-95"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={toggleNotifications}
                      className={cn(
                        "relative flex h-7 w-7 items-center justify-center rounded-full text-white transition-all hover:bg-white/20 active:scale-95",
                        notificationsOpen && "bg-white/18",
                      )}
                      title="Notificaciones"
                    >
                      <Bell className="h-4 w-4" />
                      {unreadCount > 0 ? (
                        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-black leading-none text-black">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      ) : null}
                    </button>
                  </>
                )}
              </div>

              <div
                className="h-full flex-1 cursor-grab"
                data-tauri-drag-region
                onDoubleClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const mod = await import("@tauri-apps/api/window");
                    const win = mod.getCurrentWindow();
                    win.toggleMaximize();
                  } catch {}
                }}
              />

              <div data-tauri-drag-region="false">
                <WindowControls />
              </div>
            </div>

            {false && menuOpen && (
              <div
                className="app-navigation-menu flex flex-col overflow-hidden rounded-b-[20px]"
                style={{
                  ...glassStyle,
                  borderTop: "none",
                  borderTopLeftRadius: 0,
                  borderTopRightRadius: 0,
                  width: "280px",
                  height: "calc(100dvh - 56px)",
                }}
              >
                <div className="app-navigation-scroll flex-1 overflow-y-auto px-3 py-4">
                  <div className="mb-6">
                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
                      Navegacion
                    </p>
                    <div className="space-y-1">
                      {navigationItems.map((item) => {
                        const isActive = location === item.href;
                        return (
                          <button
                            key={item.href}
                            onClick={() => handleNavigate(item.href)}
                            className={cn(
                              "app-nav-item flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-all",
                              isActive
                                ? "bg-white/20 text-white shadow-md"
                                : "text-white/70 hover:bg-white/10 hover:text-white",
                            )}
                          >
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="text-sm font-medium">
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
                      Biblioteca
                    </p>
                    <div className="space-y-1">
                      <button
                        onClick={() => handleNavigate("/liked")}
                        className={cn(
                          "app-nav-item flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-all",
                          location === "/liked"
                            ? "bg-white/20 text-white"
                            : "text-white/70 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <Heart className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium">Me gusta</span>
                      </button>

                      <button
                        onClick={() => handleNavigate("/library")}
                        className={cn(
                          "app-nav-item flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-all",
                          location === "/library"
                            ? "bg-white/20 text-white"
                            : "text-white/70 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <Music2 className="h-4 w-4 shrink-0" />
                        <span className="text-sm font-medium">Canciones</span>
                      </button>

                      <div>
                        <button
                          onClick={() => setShowArtists(!showArtists)}
                          className="app-nav-item flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-white/70 transition-all hover:bg-white/10 hover:text-white"
                        >
                          <User className="h-4 w-4 shrink-0" />
                          <span className="flex-1 text-sm font-medium">
                            Artistas
                          </span>
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 transition-transform",
                              showArtists ? "rotate-90" : "",
                            )}
                          />
                        </button>
                        {showArtists && (
                          <div className="ml-6 mt-1 space-y-1 border-l border-white/20 pl-3">
                            {uniqueArtists.map((artist) => (
                              <button
                                key={artist}
                                onClick={() =>
                                  handleNavigate(
                                    `/artist/${encodeURIComponent(artist)}`,
                                  )
                                }
                                className="app-nav-subitem flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
                              >
                                <User className="h-4 w-4 shrink-0 opacity-60" />
                                <span className="truncate">{artist}</span>
                              </button>
                            ))}
                            {uniqueArtists.length === 0 && (
                              <p className="px-3 py-1 text-xs text-white/40">
                                No hay artistas disponibles
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <button
                          onClick={() => setShowPlaylists(!showPlaylists)}
                          className="app-nav-item flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-white/70 transition-all hover:bg-white/10 hover:text-white"
                        >
                          <ListMusic className="h-4 w-4 shrink-0" />
                          <span className="flex-1 text-sm font-medium">
                            Playlists
                          </span>
                          <ChevronRight
                            className={cn(
                              "h-4 w-4 transition-transform",
                              showPlaylists ? "rotate-90" : "",
                            )}
                          />
                        </button>
                        {showPlaylists && (
                          <div className="ml-6 mt-1 space-y-1 border-l border-white/20 pl-3">
                            {sortedPlaylists.map((pl) => (
                              <button
                                key={pl.id}
                                onClick={() =>
                                  handleNavigate(`/playlists/${pl.id}`)
                                }
                                className="app-nav-subitem flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
                              >
                                <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg bg-white/10">
                                  {pl.customCoverUrl ? (
                                    <img
                                      src={pl.customCoverUrl}
                                      alt={pl.title}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <Music2 className="m-auto mt-2 h-4 w-4 opacity-60" />
                                  )}
                                </div>
                                <span className="truncate">{pl.title}</span>
                              </button>
                            ))}
                            {sortedPlaylists.length === 0 && (
                              <p className="px-3 py-1 text-xs text-white/40">
                                No tienes playlists
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="app-navigation-footer border-t border-white/10 p-3">
                  <p className="text-center text-[10px] text-white/40">
                    Cloud Music Player
                  </p>
                </div>
              </div>
            )}

            {notificationsOpen && (
              <NotificationsPanel
                notifications={notifications}
                onClear={clearNotifications}
              />
            )}
          </div>
        </>
      )}

      <div
        className={cn(
          "cloud-workspace relative z-10 flex min-h-0 flex-1 overflow-hidden",
          isFullscreen && "cloud-system-fullscreen",
        )}
      >
        <aside
          className={cn(
            "cloud-library-column relative z-20 h-full shrink-0 overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            menuOpen ? "pointer-events-auto" : "pointer-events-none",
          )}
          style={{
            width: menuOpen ? "clamp(220px, 20vw, 272px)" : "0px",
          }}
          aria-hidden={!menuOpen}
        >
          <div
            className={cn(
              "cloud-library-panel relative flex h-full w-full min-w-[230px] flex-col overflow-hidden border-r text-white transition-[transform,opacity,filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
              menuOpen
                ? "translate-x-0 opacity-100 blur-0"
                : "-translate-x-full opacity-0 blur-sm",
            )}
          >
            <div
              className={cn(
                "relative z-10 flex items-center border-b border-white/10 px-4 pb-4",
                isFullscreen ? "pt-4" : "pt-14",
              )}
            >
              <h2 className="truncate text-lg font-black tracking-tight">
                Biblioteca
              </h2>
            </div>

            <CustomScrollbar
              className="relative z-10 min-h-0 flex-1"
              size="small"
              barWidth="5px"
              variant="liquid"
            >
              <nav className="space-y-2 px-2 pb-24 pt-3">
                <div className="space-y-1">
                  {navigationItems.map((item) => {
                    const active =
                      location === item.href ||
                      (item.href !== "/home" && location.startsWith(item.href));
                    return (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => handleNavigate(item.href)}
                        className={cn(
                          "cloud-library-item flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition",
                          active
                            ? "bg-white/14 text-white"
                            : "text-white/68 hover:bg-white/8 hover:text-white",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate text-sm font-semibold">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <section>
                  <div className="cloud-library-category flex w-full items-center rounded-md text-white/78 transition hover:bg-white/8 hover:text-white">
                    <button
                      type="button"
                      onClick={() => setShowPlaylists((open) => !open)}
                      className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left"
                    >
                      <ListMusic className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-sm font-bold">
                        Playlists
                      </span>
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-300",
                          showPlaylists && "rotate-90",
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNavigate("/playlists")}
                      className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/58 transition hover:bg-white/12 hover:text-white"
                      title="Administrar playlists"
                    >
                      <span className="text-base leading-none">+</span>
                    </button>
                  </div>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows,opacity] duration-300",
                      showPlaylists
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-0.5 pb-1 pl-5">
                        <button
                          type="button"
                          onClick={() => handleNavigate("/liked")}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs font-semibold transition",
                            location === "/liked"
                              ? "bg-white/12 text-white"
                              : "text-white/64 hover:bg-white/8 hover:text-white",
                          )}
                        >
                          <Heart className="h-3.5 w-3.5" />
                          Canciones favoritas
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNavigate("/playlists")}
                          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-white/64 transition hover:bg-white/8 hover:text-white"
                        >
                          <ListMusic className="h-3.5 w-3.5" />
                          Todas las playlists
                        </button>
                        {sortedPlaylists.map((playlist) => (
                          <button
                            key={playlist.id}
                            type="button"
                            onClick={() =>
                              handleNavigate(`/playlists/${playlist.id}`)
                            }
                            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-white/58 transition hover:bg-white/8 hover:text-white"
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/9">
                              {playlist.customCoverUrl ? (
                                <img
                                  src={playlist.customCoverUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Music2 className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <span className="truncate">{playlist.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <button
                    type="button"
                    onClick={() => setShowArtists((open) => !open)}
                    className="cloud-library-category flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-white/78 transition hover:bg-white/8 hover:text-white"
                  >
                    <User className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-sm font-bold">Artistas</span>
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-300",
                        showArtists && "rotate-90",
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows,opacity] duration-300",
                      showArtists
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-0.5 pb-1 pl-5">
                        {uniqueArtists.slice(0, 12).map((artist) => (
                          <button
                            key={artist}
                            type="button"
                            onClick={() =>
                              handleNavigate(
                                `/artist/${encodeURIComponent(artist)}`,
                              )
                            }
                            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-white/58 transition hover:bg-white/8 hover:text-white"
                          >
                            <User className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{artist}</span>
                          </button>
                        ))}
                        {uniqueArtists.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-white/38">
                            Aun no hay artistas
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <button
                    type="button"
                    onClick={() => setShowAlbums((open) => !open)}
                    className="cloud-library-category flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-white/78 transition hover:bg-white/8 hover:text-white"
                  >
                    <Disc3 className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-sm font-bold">Albumes</span>
                    <ChevronRight
                      className={cn(
                        "h-3.5 w-3.5 transition-transform duration-300",
                        showAlbums && "rotate-90",
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      "grid transition-[grid-template-rows,opacity] duration-300",
                      showAlbums
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-0.5 pb-1 pl-5">
                        {uniqueAlbums.slice(0, 12).map((album) => (
                          <button
                            key={album}
                            type="button"
                            onClick={() => {
                              const albumSong = allSongs.find(
                                (song) => song.album === album,
                              );
                              if (!albumSong) return;
                              handleNavigate(
                                `/album/${encodeURIComponent(
                                  albumSong.artist,
                                )}/${encodeURIComponent(album)}`,
                              );
                            }}
                            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-white/58 transition hover:bg-white/8 hover:text-white"
                          >
                            <Disc3 className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{album}</span>
                          </button>
                        ))}
                        {uniqueAlbums.length === 0 ? (
                          <p className="px-2 py-2 text-xs text-white/38">
                            Aun no hay albumes
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </section>
              </nav>
            </CustomScrollbar>

            <div className="relative z-10 mt-auto border-t border-white/10 px-3 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/12">
                  {discordUser?.avatarUrl ? (
                    <img
                      src={discordUser.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4 text-white/72" />
                  )}
                </div>
                <span className="truncate text-xs font-bold text-white/82">
                  {discordUser?.displayName ?? "Cloud"}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {false && !hideSidebar && (
          <aside
            className="relative z-10 flex h-full w-64 shrink-0 flex-col"
            style={{
              background: "var(--cloud-surface-soft)",
              backdropFilter: "var(--cloud-glass-filter)",
              WebkitBackdropFilter: "var(--cloud-glass-filter)",
              borderRight: "1px solid var(--cloud-border)",
            }}
          >
            <div className="flex items-center justify-between px-5 pb-4 pt-5">
              <Link href="/home">
                <div className="group cursor-pointer select-none">
                  <h1 className="text-xl font-bold leading-tight tracking-tight text-white transition-opacity duration-200 group-hover:opacity-80">
                    Cloud
                  </h1>
                  <p className="text-[10px] text-white/70">Music Player</p>
                </div>
              </Link>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={openSettings}
                  className="rounded-full p-1.5 text-white/70 transition-all hover:bg-white/10 hover:text-white"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setSidePlayerOpen((prev) => !prev)}
                  className="rounded-full p-1.5 text-white/70 transition-all hover:bg-white/10 hover:text-white"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </button>
                <button
                  onClick={toggleSystemFullscreen}
                  className="rounded-full p-1.5 text-white/70 transition-all hover:bg-white/10 hover:text-white"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="px-3 pb-2">
              <div className="h-px bg-white/20" />
            </div>

            <nav className="flex-1 space-y-1 px-3">
              {NAV_ITEMS.map((item) => {
                const isActive =
                  location === item.href ||
                  (item.href !== "/home" && location.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-all duration-200",
                        isActive
                          ? "bg-white/20 text-white shadow-md"
                          : "text-white/70 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon
                        className="h-4 w-4 shrink-0"
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      <span className="text-sm font-medium">{item.label}</span>
                      {isActive && (
                        <ChevronRight className="ml-auto h-3 w-3 opacity-60" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>

            {userSongs.length > 0 && (
              <>
                <div className="px-3 pb-1 pt-4">
                  <div className="h-px bg-white/20" />
                </div>
                <div className="min-h-0 flex-1 px-3 pt-2">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
                    Mis archivos
                  </p>
                  <CustomScrollbar className="h-full">
                    <div className="space-y-1">
                      {userSongs.slice(0, 10).map((song) => {
                        const isActive = currentSong?.id === song.id;
                        return (
                          <div
                            key={song.id}
                            onClick={() => play(song)}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 transition-all",
                              isActive
                                ? "bg-white/20 text-white"
                                : "text-white/70 hover:bg-white/10 hover:text-white",
                            )}
                          >
                            {isActive ? (
                              <div className="flex h-3 shrink-0 items-end gap-[2px]">
                                {[1, 0.55, 0.8].map((h, j) => (
                                  <div
                                    key={j}
                                    className="w-0.5 rounded-full bg-white"
                                    style={{
                                      height: `${h * 12}px`,
                                      animation: `waveform ${0.6 + j * 0.15}s ease-in-out ${j * 0.1}s infinite alternate`,
                                    }}
                                  />
                                ))}
                              </div>
                            ) : (
                              <Music2 className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span className="truncate text-xs">
                              {song.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CustomScrollbar>
                </div>
              </>
            )}

            {currentSong && (
              <div className="mt-auto px-3 pb-6">
                <div className="mb-3 h-px bg-white/20" />
                <Link href="/home">
                  <div className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-white/10 px-2.5 py-2 backdrop-blur-sm transition-all hover:bg-white/20">
                    <img
                      src={currentSong.coverUrl}
                      alt=""
                      className="h-8 w-8 rounded-lg object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-white">
                        {currentSong.title}
                      </p>
                      <p className="truncate text-[10px] text-white/60">
                        {currentSong.artist}
                      </p>
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </aside>
        )}

        <main
          className={`cloud-app-main relative z-10 h-full min-h-0 min-w-0 flex-1 bg-transparent p-0 transition-[width] duration-500 ${
            hideSidebar ? "w-full" : ""
          }`}
        >
          <CustomScrollbar className="h-full min-h-0">
            {children}
          </CustomScrollbar>
        </main>

        <aside
          className={cn(
            "cloud-sideplayer-column relative z-20 h-full shrink-0 overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            sidePlayerOpen ? "pointer-events-auto" : "pointer-events-none",
          )}
          style={{
            width: sidePlayerOpen ? "clamp(300px, 31vw, 420px)" : "0px",
          }}
        >
          <SidePlayer
            open={sidePlayerOpen}
            mode={sidePlayerMode}
            onModeChange={setSidePlayerMode}
            isSystemFullscreen={isFullscreen}
          />
        </aside>
      </div>

      <TransportBar
        onFullscreen={handleFullscreen}
        onSidebarToggle={() => {
          setSidePlayerMode("player");
          setSidePlayerOpen((prev) => !prev);
        }}
        onQueueToggle={() => {
          setSidePlayerMode("queue");
          setSidePlayerOpen(true);
        }}
        sidebarVisible={sidePlayerOpen}
        queueVisible={sidePlayerOpen && sidePlayerMode === "queue"}
        libraryVisible={menuOpen}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={closeSettings}
        onNavigationChange={setSettingsNavState}
        backRequest={settingsBackRequest}
      />
      <FullscreenPlayer open={fullscreenOpen} onClose={handleFullscreenClose} />
      <style>{`
        .cloud-library-panel {
          background:
            linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025)),
            var(--cloud-surface);
          border-color: var(--cloud-border);
          box-shadow:
            18px 0 50px rgba(0,0,0,0.12),
            inset -1px 0 0 rgba(255,255,255,0.08);
          backdrop-filter: var(--cloud-glass-filter);
          -webkit-backdrop-filter: var(--cloud-glass-filter);
        }

        html[data-cloud-interface="simplyui"] .cloud-library-panel {
          background: #2b2a2a;
          border-color: rgba(255,255,255,0.08);
          box-shadow: none;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
        }

        html[data-cloud-interface="simplyui"] .cloud-library-category,
        html[data-cloud-interface="simplyui"] .cloud-library-item {
          border-radius: 4px;
        }

        .cloud-library-item {
          position: relative;
        }

        .cloud-library-item::before {
          content: "";
          position: absolute;
          left: 0;
          top: 50%;
          width: 2px;
          height: 0;
          border-radius: 999px;
          background: white;
          transform: translateY(-50%);
          opacity: 0;
          transition: height 220ms ease, opacity 220ms ease;
        }

        .cloud-library-item.bg-white\\/14::before {
          height: 55%;
          opacity: 0.9;
        }

        .cloud-sideplayer-column {
          border-left: 1px solid var(--cloud-border);
          box-shadow: -18px 0 50px rgba(0,0,0,0.12);
        }

        .cloud-app-main {
          container-type: inline-size;
        }

        .cloud-system-fullscreen .home-page {
          padding-top: 1rem;
        }

        .cloud-system-fullscreen .home-greeting {
          padding-top: 0.4rem;
        }

        .notification-panel {
          background:
            linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.055)),
            var(--cloud-surface);
          border: 1px solid var(--cloud-border);
          box-shadow:
            0 24px 70px rgba(0,0,0,0.28),
            inset 0 1px 0 rgba(255,255,255,0.26);
          backdrop-filter: var(--cloud-glass-filter);
          -webkit-backdrop-filter: var(--cloud-glass-filter);
          animation: notification-panel-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes notification-panel-in {
          from {
            opacity: 0;
            transform: translate3d(0, -8px, 0) scale(0.985);
            filter: blur(8px);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
            filter: blur(0);
          }
        }
      `}</style>
    </div>
  );
}
