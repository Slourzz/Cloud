import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  Repeat,
  FolderOpen,
  Palette,
  Disc,
  Zap,
  Cpu,
  Info,
  Sliders,
  Music,
  Play,
  SkipForward,
  SkipBack,
  Search,
  PanelRightOpen,
  ListMusic,
  Menu,
  Settings,
  Trash2,
  RotateCcw,
  Maximize2,
  Image,
  Sparkles,
  Check,
  ChevronRight,
  Github,
  Layers,
  Gem,
  Circle,
  Cloud,
  Clock3,
  CloudRain,
  Wand2,
  Paintbrush,
  Activity,
  Database,
  HardDrive,
  LoaderCircle,
  Wifi,
  WifiOff,
  UserRound,
  Link2,
  Unlink,
  CalendarDays,
  Captions,
  Rows3,
  WholeWord,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMusicPlayer, Song } from "@/hooks/use-music-player";
import { useTranslation } from "@/hooks/use-translations";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  useAppearance,
  type AppearanceSettings,
  type BackgroundTheme,
  type ColorTheme,
  type InterfaceTheme,
} from "@/providers/appearance-provider";
import { CustomScrollbar } from "@/components/CustomScrollbar";
import { useToast } from "@/hooks/use-toast";
import { useDiscordAuth, type DiscordUser } from "@/hooks/use-discord-auth";
import {
  clearAllCloudData,
  clearCloudCache,
  formatStorageSize,
  getCloudSystemStatus,
  type CloudSystemStatus,
} from "@/utils/app-maintenance";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  onNavigationChange?: (state: SettingsNavigationState) => void;
  backRequest?: number;
}

type CategoryId =
  | "general"
  | "playback"
  | "audio"
  | "library"
  | "metadata"
  | "appearance"
  | "shortcuts"
  | "advanced"
  | "account"
  | "about";

type SettingsNavigationState = {
  open: boolean;
  canGoBack: boolean;
  activeCategory: CategoryId | null;
};

type SettingsSubpage = "system-status" | "preferences";

type PlaybackPreferences = {
  normalizeVolume: boolean;
  gaplessPlayback: boolean;
  autoplay: boolean;
};

const PLAYBACK_PREFERENCES_KEY = "cloud-playback-preferences-v1";

function readPlaybackPreferences(): PlaybackPreferences {
  try {
    const stored = JSON.parse(
      localStorage.getItem(PLAYBACK_PREFERENCES_KEY) ?? "{}",
    ) as Partial<PlaybackPreferences>;
    return {
      normalizeVolume: stored.normalizeVolume ?? true,
      gaplessPlayback: stored.gaplessPlayback ?? true,
      autoplay: stored.autoplay ?? false,
    };
  } catch {
    return {
      normalizeVolume: true,
      gaplessPlayback: true,
      autoplay: false,
    };
  }
}

const SETTINGS_NAV_STATE_EVENT = "cloud-settings-nav-state";
const CLOUD_VERSION = "v2.0.0";
const DISCORD_URL = "https://discord.gg/CqdbkZzER2";
const TIKTOK_URL =
  "https://www.tiktok.com/@cloudapp_?is_from_webapp=1&sender_device=pc";
const GITHUB_URL = "https://github.com/Slourzz/Cloud";

const openExternalLink = async (url: string) => {
  try {
    await openUrl(url);
  } catch (error) {
    console.error("No se pudo abrir el enlace en el navegador externo:", error);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) window.location.assign(url);
  }
};

const emitSettingsNavigationState = (state: SettingsNavigationState) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SETTINGS_NAV_STATE_EVENT, { detail: state }),
  );
};

const panelGlass: React.CSSProperties = {
  background: "var(--cloud-app-bg)",
  backdropFilter: "var(--cloud-glass-filter)",
  WebkitBackdropFilter: "var(--cloud-glass-filter)",
  border: "0",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
};

const cardGlass: React.CSSProperties = {
  background: "var(--cloud-surface)",
  backdropFilter: "var(--cloud-glass-filter)",
  WebkitBackdropFilter: "var(--cloud-glass-filter)",
  border: "1px solid var(--cloud-border)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
};

const softInput =
  "bg-white/8 border border-white/10 rounded-2xl px-3 py-2 text-sm outline-none text-white placeholder-white/45 focus:bg-white/12 focus:border-white/28 transition";

export function SettingsPanel({
  open,
  onClose,
  onNavigationChange,
  backRequest,
}: SettingsPanelProps) {
  const { t, lang, setLang } = useTranslation();
  const {
    settings: appearance,
    customBackgroundUrl,
    customBackgroundKind,
    setInterfaceTheme,
    setBackgroundTheme,
    setColorTheme,
    setLyricsMotion,
    setLyricsAnimationFormat,
    setCustomBackgroundMedia,
    setCustomBackgroundSettings,
  } = useAppearance();
  const backgroundMediaInputRef = useRef<HTMLInputElement>(null);
  const backgroundPreviewVideoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();
  const {
    user: discordUser,
    linkedAt: discordLinkedAt,
    isConnecting: discordConnecting,
    error: discordError,
    login: connectDiscord,
    logout: disconnectDiscord,
    clearError: clearDiscordError,
  } = useDiscordAuth();

  const CATEGORIES = [
    {
      id: "general",
      label: t.general,
      icon: Sliders,
      note: "Base",
      description: "Selecciona idioma, inicio y preferencias generales.",
    },
    {
      id: "playback",
      label: t.playback,
      icon: Repeat,
      note: "Flujo",
      description: "Controla crossfade, autoplay y continuidad.",
    },
    {
      id: "audio",
      label: t.audio,
      icon: Volume2,
      note: "Sonido",
      description: "Ajusta calidad, salida y normalizacion de volumen.",
    },
    {
      id: "library",
      label: t.library,
      icon: FolderOpen,
      note: "Activa",
      description: "Organiza, revisa y elimina canciones guardadas.",
    },
    {
      id: "metadata",
      label: t.metadata,
      icon: Disc,
      note: "Activa",
      description: "Edita nombre, artista, album, genero y portada.",
    },
    {
      id: "appearance",
      label: t.appearance,
      icon: Palette,
      note: "Visual",
      description: "Configura el estilo, blur y transparencia.",
    },
    {
      id: "shortcuts",
      label: t.shortcuts,
      icon: Zap,
      note: "Teclas",
      description: "Consulta los atajos globales del reproductor.",
    },
    {
      id: "advanced",
      label: t.advanced,
      icon: Cpu,
      note: "Sistema",
      description: "Herramientas de mantenimiento y diagnostico.",
    },
    {
      id: "account",
      label: "Cuenta",
      icon: UserRound,
      note: "Discord",
      description: "Consulta y administra tu cuenta vinculada.",
    },
    {
      id: "about",
      label: t.about,
      icon: Info,
      note: "Cloud",
      description: "Version, creditos e informacion de la app.",
    },
  ] as const;

  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null);
  const [activeSubpage, setActiveSubpage] = useState<SettingsSubpage | null>(
    null,
  );
  const [visible, setVisible] = useState(false);
  const [audioQuality, setAudioQuality] = useState("alta");
  const [crossfade, setCrossfade] = useState(0);
  const [playbackPreferences, setPlaybackPreferences] =
    useState<PlaybackPreferences>(readPlaybackPreferences);
  const { normalizeVolume, gaplessPlayback, autoplay } = playbackPreferences;
  const [maintenanceBusy, setMaintenanceBusy] = useState<
    "cache" | "data" | "status" | null
  >(null);
  const [showDeleteDataConfirm, setShowDeleteDataConfirm] = useState(false);
  const [systemStatus, setSystemStatus] = useState<CloudSystemStatus | null>(
    null,
  );
  const [systemStatusError, setSystemStatusError] = useState<string | null>(
    null,
  );
  const lastBackRequestRef = useRef(backRequest);

  const updatePlaybackPreference = (
    preference: keyof PlaybackPreferences,
    value: boolean,
  ) => {
    setPlaybackPreferences((current) => ({
      ...current,
      [preference]: value,
    }));
  };

  useEffect(() => {
    localStorage.setItem(
      PLAYBACK_PREFERENCES_KEY,
      JSON.stringify(playbackPreferences),
    );
  }, [playbackPreferences]);

  const activeMeta =
    CATEGORIES.find((cat) => cat.id === activeCategory) ?? CATEGORIES[0];
  const activePreferencesCount = [
    normalizeVolume,
    gaplessPlayback,
    autoplay,
    appearance.interfaceTheme === "crystalized",
    appearance.backgroundTheme === "dynamic-background",
    appearance.colorTheme === "dynamic-colors",
    appearance.lyricsMotion === "animated",
  ].filter(Boolean).length;

  useEffect(() => {
    if (open) {
      setVisible(true);
      setActiveCategory(null);
      setActiveSubpage(null);
      return;
    }

    const timer = setTimeout(() => setVisible(false), 420);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const state: SettingsNavigationState = {
      open,
      canGoBack: open && activeCategory !== null,
      activeCategory: open ? activeCategory : null,
    };

    onNavigationChange?.(state);
    emitSettingsNavigationState(state);
  }, [open, activeCategory, onNavigationChange]);

  useEffect(() => {
    if (backRequest === undefined) return;
    if (lastBackRequestRef.current === backRequest) return;

    lastBackRequestRef.current = backRequest;
    if (!open) return;

    if (activeSubpage === "preferences") {
      setActiveSubpage("system-status");
      return;
    }

    if (activeSubpage === "system-status") {
      setActiveSubpage(null);
      return;
    }

    if (activeCategory !== null) {
      setActiveCategory(null);
      return;
    }

    onClose();
  }, [backRequest, open, activeCategory, activeSubpage, onClose]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    const previewVideo = backgroundPreviewVideoRef.current;
    if (!previewVideo || customBackgroundKind !== "video") return;

    previewVideo.playbackRate = Math.max(
      0.35,
      Math.min(2, 0.35 + appearance.customBackground.speed * 0.0165),
    );
  }, [
    appearance.customBackground.speed,
    customBackgroundKind,
    customBackgroundUrl,
  ]);

  if (!visible) return null;

  const handleClearCache = async () => {
    if (maintenanceBusy) return;
    setMaintenanceBusy("cache");

    try {
      const result = await clearCloudCache();
      toast({
        title: "Cache eliminada",
        description:
          result.bytesFreed > 0
            ? `Cloud libero ${formatStorageSize(result.bytesFreed)} de datos temporales.`
            : "La cache ya estaba limpia.",
      });
    } catch (error) {
      console.error("No se pudo limpiar la cache:", error);
      toast({
        variant: "destructive",
        title: "No se pudo limpiar la cache",
        description: "Cierra archivos en uso e intentalo nuevamente.",
      });
    } finally {
      setMaintenanceBusy(null);
    }
  };

  const handleOpenSystemStatus = async () => {
    if (maintenanceBusy) return;

    setActiveSubpage("system-status");
    setSystemStatus(null);
    setSystemStatusError(null);
    setMaintenanceBusy("status");

    try {
      setSystemStatus(await getCloudSystemStatus());
    } catch (error) {
      console.error("No se pudo leer el estado del sistema:", error);
      setSystemStatusError(
        "Cloud no pudo completar el diagnostico. Intenta abrirlo nuevamente.",
      );
    } finally {
      setMaintenanceBusy(null);
    }
  };

  const renderSubpage = () => {
    if (activeSubpage === "system-status") {
      return (
        <SystemStatusView
          status={systemStatus}
          error={systemStatusError}
          loading={maintenanceBusy === "status"}
          activePreferences={activePreferencesCount}
          onOpenPreferences={() => setActiveSubpage("preferences")}
          onRefresh={handleOpenSystemStatus}
        />
      );
    }

    if (activeSubpage === "preferences") {
      return (
        <PreferencesView
          preferences={playbackPreferences}
          onPreferenceChange={updatePlaybackPreference}
          appearance={appearance}
          setInterfaceTheme={setInterfaceTheme}
          setBackgroundTheme={setBackgroundTheme}
          setColorTheme={setColorTheme}
        />
      );
    }

    return null;
  };

  const handleDeleteAllData = async () => {
    if (maintenanceBusy) return;
    setMaintenanceBusy("data");

    try {
      await clearAllCloudData();
      setShowDeleteDataConfirm(false);
      window.setTimeout(() => window.location.reload(), 180);
    } catch (error) {
      console.error("No se pudieron borrar los datos de Cloud:", error);
      toast({
        variant: "destructive",
        title: "No se pudieron borrar los datos",
        description: "La operacion se detuvo sin reiniciar Cloud.",
      });
      setMaintenanceBusy(null);
    }
  };

  const handleConnectDiscord = async () => {
    clearDiscordError();
    try {
      const user = await connectDiscord();
      toast({
        title: "Discord vinculado",
        description: `Cloud recordara tu cuenta como ${user.displayName}.`,
      });
    } catch {
      // The provider exposes the specific error inside the account view.
    }
  };

  const renderCategory = () => {
    switch (activeCategory) {
      case "general":
        return (
          <SettingsSection
            title={t.general}
            description="Preferencias basicas de la aplicacion."
            icon={<Sliders className="w-5 h-5" />}
          >
            <SettingCard delay={0}>
              <SettingRow
                title={t.language}
                description="Cambia el idioma principal de la interfaz."
              >
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as "es" | "en")}
                  className={softInput}
                >
                  <option value="es">Espanol</option>
                  <option value="en">English</option>
                </select>
              </SettingRow>
            </SettingCard>

            <SettingCard delay={80}>
              <SettingRow
                title={t.startWithWindows}
                description="Opcion preparada para arranque automatico."
                badge="Pendiente"
              >
                <Toggle defaultChecked={false} />
              </SettingRow>
            </SettingCard>
          </SettingsSection>
        );

      case "audio":
        return (
          <SettingsSection
            title={t.audio}
            description="Controles de salida y tratamiento de sonido."
            icon={<Volume2 className="w-5 h-5" />}
          >
            <SettingCard delay={0}>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/50 mb-4">
                {t.soundQuality}
              </p>
              <div className="settings-option-grid settings-option-grid-compact grid gap-2">
                {["baja", "normal", "alta", "lossless"].map((q) => (
                  <button
                    key={q}
                    onClick={() => setAudioQuality(q)}
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm font-bold capitalize transition-all hover:scale-[1.02] active:scale-[0.98]",
                      audioQuality === q
                        ? "bg-white text-black shadow-lg"
                        : "bg-white/12 text-white/72 hover:bg-white/18 hover:text-white",
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </SettingCard>

            <SettingCard delay={80}>
              <SettingRow
                title={t.normalizeVolume}
                description="Mantiene niveles mas consistentes entre canciones."
              >
                <Toggle
                  checked={normalizeVolume}
                  onChange={(value) =>
                    updatePlaybackPreference("normalizeVolume", value)
                  }
                />
              </SettingRow>
            </SettingCard>

            <SettingCard delay={160}>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/50 mb-3">
                {t.audioDevice}
              </p>
              <select className={cn(softInput, "w-full")}>
                <option>Altavoces (Realtek)</option>
                <option>Auriculares (Bluetooth)</option>
              </select>
            </SettingCard>
          </SettingsSection>
        );

      case "playback":
        return (
          <SettingsSection
            title={t.playback}
            description="Preferencias de continuidad y reproduccion."
            icon={<Repeat className="w-5 h-5" />}
          >
            <SettingCard delay={0}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-base font-bold text-white">
                    {t.crossfade}
                  </p>
                  <p className="text-sm text-white/52">
                    Transicion suave entre canciones.
                  </p>
                </div>
                <span className="text-sm font-black text-white/72 tabular-nums">
                  {crossfade}s
                </span>
              </div>
              <GlassSlider
                value={crossfade}
                onChange={setCrossfade}
                max={12}
                step={1}
              />
            </SettingCard>

            <SettingCard delay={80}>
              <SettingRow
                title={t.gaplessPlayback}
                description="Evita pausas entre pistas compatibles."
              >
                <Toggle
                  checked={gaplessPlayback}
                  onChange={(value) =>
                    updatePlaybackPreference("gaplessPlayback", value)
                  }
                />
              </SettingRow>
            </SettingCard>

            <SettingCard delay={160}>
              <SettingRow
                title={t.autoplay}
                description="Continua con musica relacionada al terminar."
                badge="Pendiente"
              >
                <Toggle
                  checked={autoplay}
                  onChange={(value) =>
                    updatePlaybackPreference("autoplay", value)
                  }
                />
              </SettingRow>
            </SettingCard>
          </SettingsSection>
        );

      case "appearance":
        return (
          <SettingsSection
            title={t.appearance}
            description="Personaliza Cloud por capas visuales."
            icon={<Palette className="w-5 h-5" />}
          >
            <AppearanceLayer
              delay={0}
              icon={<Layers className="w-5 h-5" />}
              title="Interfaz"
              description="Cambia la apariencia general de Cloud."
            >
              <div className="settings-option-grid grid gap-3">
                <AppearanceChoice
                  icon={<Gem className="w-5 h-5" />}
                  title="Crystalized"
                  description="Liquid Glass, transparencias, blur, gradientes y aspecto premium."
                  selected={appearance.interfaceTheme === "crystalized"}
                  onSelect={() => setInterfaceTheme("crystalized")}
                  features={[
                    "Liquid Glass",
                    "Transparencias",
                    "Blur",
                    "Gradientes",
                    "Aspecto premium",
                  ]}
                />
                <AppearanceChoice
                  icon={<Circle className="w-5 h-5" />}
                  title="SimplyUI"
                  description="Minimalista, oscuro y enfocado en claridad visual."
                  selected={appearance.interfaceTheme === "simplyui"}
                  onSelect={() => setInterfaceTheme("simplyui")}
                  features={["Minimalista", "Oscuro", "Menos efectos visuales"]}
                />
              </div>
            </AppearanceLayer>

            <AppearanceLayer
              delay={90}
              icon={<Cloud className="w-5 h-5" />}
              title="Fondo"
              description="Cambia el fondo de la aplicacion."
              unavailableReason={
                appearance.interfaceTheme === "simplyui"
                  ? "No disponible en el tema actual"
                  : undefined
              }
            >
              <div className="settings-option-grid settings-option-grid-wide grid gap-3">
                <AppearanceChoice
                  icon={<Cloud className="w-5 h-5" />}
                  title="Cloud Core"
                  description="Fondo clasico de Cloud."
                  selected={appearance.backgroundTheme === "cloud-core"}
                  disabled={appearance.interfaceTheme === "simplyui"}
                  onSelect={() => setBackgroundTheme("cloud-core")}
                />
                <AppearanceChoice
                  icon={<Clock3 className="w-5 h-5" />}
                  title="Cloud Hour"
                  description="Cambia segun la hora del dia."
                  selected={appearance.backgroundTheme === "cloud-hour"}
                  disabled={appearance.interfaceTheme === "simplyui"}
                  onSelect={() => setBackgroundTheme("cloud-hour")}
                />
                <AppearanceChoice
                  icon={<CloudRain className="w-5 h-5" />}
                  title="Weather"
                  description="Cambia segun el clima."
                  selected={appearance.backgroundTheme === "weather"}
                  disabled={appearance.interfaceTheme === "simplyui"}
                  onSelect={() => setBackgroundTheme("weather")}
                />
                <AppearanceChoice
                  icon={<Music className="w-5 h-5" />}
                  title="Dynamic Background"
                  description="Basado en la cancion actual."
                  selected={appearance.backgroundTheme === "dynamic-background"}
                  disabled={appearance.interfaceTheme === "simplyui"}
                  onSelect={() => setBackgroundTheme("dynamic-background")}
                />
                <AppearanceChoice
                  icon={
                    customBackgroundKind === "video" ? (
                      <Video className="w-5 h-5" />
                    ) : (
                      <Image className="w-5 h-5" />
                    )
                  }
                  title="Fondo personalizado"
                  description="Selecciona una imagen o un video local."
                  selected={
                    appearance.backgroundTheme === "custom-background" ||
                    appearance.backgroundTheme === "custom-video"
                  }
                  disabled={appearance.interfaceTheme === "simplyui"}
                  onSelect={() => backgroundMediaInputRef.current?.click()}
                />
                <input
                  ref={backgroundMediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    await setCustomBackgroundMedia(file);
                    setBackgroundTheme(
                      file.type.startsWith("video/")
                        ? "custom-video"
                        : "custom-background",
                    );
                    event.target.value = "";
                  }}
                />
              </div>

              {customBackgroundUrl &&
              (appearance.backgroundTheme === "custom-background" ||
                appearance.backgroundTheme === "custom-video") ? (
                <div
                  className={cn(
                    "mt-4 rounded-2xl border border-white/10 bg-black/10 p-4 transition-opacity",
                    appearance.interfaceTheme === "simplyui" && "opacity-45",
                  )}
                >
                  <div className="relative mb-4 h-36 overflow-hidden rounded-2xl border border-white/12 bg-black/20">
                    {customBackgroundKind === "video" ? (
                      <video
                        ref={backgroundPreviewVideoRef}
                        src={customBackgroundUrl}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="settings-custom-preview-video h-full w-full object-cover transition-all duration-300"
                        style={{
                          filter: `blur(${appearance.customBackground.blur * 0.45}px) saturate(1.12)`,
                          opacity: appearance.customBackground.intensity / 100,
                          animationDuration: `${Math.max(
                            4,
                            18 - appearance.customBackground.speed * 0.14,
                          )}s`,
                        }}
                      />
                    ) : (
                      <img
                        src={customBackgroundUrl}
                        alt="Vista previa del fondo personalizado"
                        className="h-full w-full object-cover transition-all duration-300"
                        style={{
                          filter: `blur(${appearance.customBackground.blur * 0.45}px) saturate(1.12)`,
                          opacity: appearance.customBackground.intensity / 100,
                          transform: "scale(1.04)",
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-black/18" />
                    <span className="absolute bottom-3 left-3 rounded-full border border-white/14 bg-black/24 px-3 py-1 text-[10px] font-black uppercase text-white backdrop-blur-xl">
                      Vista previa
                    </span>
                  </div>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-white">
                        Ajuste de fondo custom
                      </p>
                      <p className="mt-1 text-xs font-semibold text-white/48">
                        {customBackgroundKind === "video"
                          ? "Video local en bucle"
                          : "Imagen local estatica"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => backgroundMediaInputRef.current?.click()}
                      disabled={appearance.interfaceTheme === "simplyui"}
                      className="rounded-xl border border-white/12 bg-white/8 px-3 py-2 text-xs font-black text-white/78 transition hover:bg-white/14"
                    >
                      Cambiar archivo
                    </button>
                  </div>

                  <div
                    className={cn(
                      "grid gap-5",
                      customBackgroundKind === "video"
                        ? "lg:grid-cols-3"
                        : "lg:grid-cols-2",
                    )}
                  >
                    <CustomBackgroundControl
                      label="Desenfoque"
                      value={appearance.customBackground.blur}
                      suffix="px"
                      max={36}
                      disabled={appearance.interfaceTheme === "simplyui"}
                      onChange={(blur) => setCustomBackgroundSettings({ blur })}
                    />
                    <CustomBackgroundControl
                      label="Intensidad"
                      value={appearance.customBackground.intensity}
                      suffix="%"
                      min={20}
                      disabled={appearance.interfaceTheme === "simplyui"}
                      onChange={(intensity) =>
                        setCustomBackgroundSettings({ intensity })
                      }
                    />
                    {customBackgroundKind === "video" ? (
                      <CustomBackgroundControl
                        label="Velocidad"
                        value={appearance.customBackground.speed}
                        suffix="%"
                        min={5}
                        disabled={appearance.interfaceTheme === "simplyui"}
                        onChange={(speed) =>
                          setCustomBackgroundSettings({ speed })
                        }
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
            </AppearanceLayer>

            <AppearanceLayer
              delay={180}
              icon={<Paintbrush className="w-5 h-5" />}
              title="Colores"
              description="Cambia la paleta de colores."
            >
              <div className="settings-option-grid grid gap-3">
                <AppearanceChoice
                  icon={<Wand2 className="w-5 h-5" />}
                  title="Dynamic Colors"
                  description="Colores extraidos de la portada."
                  selected={appearance.colorTheme === "dynamic-colors"}
                  onSelect={() => setColorTheme("dynamic-colors")}
                />
                <AppearanceChoice
                  icon={<Paintbrush className="w-5 h-5" />}
                  title="Custom Colors"
                  description="Colores elegidos por el usuario."
                  selected={appearance.colorTheme === "custom-colors"}
                  onSelect={() => setColorTheme("custom-colors")}
                />
                <AppearanceChoice
                  icon={<Palette className="w-5 h-5" />}
                  title="Cloud Default"
                  description="Colores oficiales de Cloud."
                  selected={appearance.colorTheme === "cloud-default"}
                  onSelect={() => setColorTheme("cloud-default")}
                />
              </div>
            </AppearanceLayer>

            <AppearanceLayer
              delay={270}
              icon={<Captions className="w-5 h-5" />}
              title="Personalizacion de letras"
              description="Elige el movimiento y la forma de resaltar cada sincronizacion."
              unavailableReason={
                appearance.interfaceTheme === "simplyui"
                  ? "SimplyUI usa Line-by-Line animado"
                  : undefined
              }
            >
              <div className="space-y-5">
                <div>
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/48">
                    Movimiento
                  </p>
                  <div className="settings-option-grid grid gap-3">
                    <AppearanceChoice
                      icon={<Sparkles className="w-5 h-5" />}
                      title="Letras animadas"
                      description="Mantiene desplazamiento, brillo y transiciones sincronizadas."
                      selected={appearance.lyricsMotion === "animated"}
                      disabled={appearance.interfaceTheme === "simplyui"}
                      onSelect={() => setLyricsMotion("animated")}
                    />
                    <AppearanceChoice
                      icon={<Captions className="w-5 h-5" />}
                      title="Letras estaticas"
                      description="Sigue la cancion sin escalados ni movimiento en las palabras."
                      selected={appearance.lyricsMotion === "static"}
                      disabled={appearance.interfaceTheme === "simplyui"}
                      onSelect={() => setLyricsMotion("static")}
                    />
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/48">
                    Formato de animacion
                  </p>
                  <div className="settings-option-grid settings-option-grid-wide grid gap-3">
                    <AppearanceChoice
                      icon={<Rows3 className="w-5 h-5" />}
                      title="Line-by-Line"
                      description="Avanza frase por frase, de arriba hacia abajo."
                      selected={appearance.lyricsAnimationFormat === "line"}
                      disabled={appearance.interfaceTheme === "simplyui"}
                      onSelect={() => setLyricsAnimationFormat("line")}
                    />
                    <AppearanceChoice
                      icon={<WholeWord className="w-5 h-5" />}
                      title="Word-by-Word"
                      description="Ilumina cada palabra de izquierda a derecha."
                      selected={appearance.lyricsAnimationFormat === "letters"}
                      disabled={appearance.interfaceTheme === "simplyui"}
                      onSelect={() => setLyricsAnimationFormat("letters")}
                    />
                    <AppearanceChoice
                      icon={<Captions className="w-5 h-5" />}
                      title="Lineal por palabras"
                      description="Conserva el formato sincronizado actual de Cloud."
                      selected={
                        appearance.lyricsAnimationFormat === "line-words"
                      }
                      disabled={appearance.interfaceTheme === "simplyui"}
                      onSelect={() => setLyricsAnimationFormat("line-words")}
                    />
                  </div>
                </div>
              </div>
            </AppearanceLayer>
          </SettingsSection>
        );

      case "library":
        return <LibraryManager />;

      case "metadata":
        return <MetadataEditor />;

      case "shortcuts":
        return (
          <SettingsSection
            title={t.shortcuts}
            description="Mapa rapido de controles globales."
            icon={<Zap className="w-5 h-5" />}
          >
            <SettingCard delay={0}>
              <div className="grid gap-3">
                <ShortcutRow
                  icon={<Play className="w-5 h-5" />}
                  label={t.playPause}
                  keys="Space"
                />
                <ShortcutRow
                  icon={<SkipForward className="w-5 h-5" />}
                  label={t.nextTrack}
                  keys="Right"
                />
                <ShortcutRow
                  icon={<SkipBack className="w-5 h-5" />}
                  label={t.previousTrack}
                  keys="Left"
                />
                <ShortcutRow
                  icon={<Volume2 className="w-5 h-5" />}
                  label={t.muteRestore}
                  keys="M"
                />
                <ShortcutRow
                  icon={<PanelRightOpen className="w-5 h-5" />}
                  label={t.sidePanel}
                  keys="L"
                />
                <ShortcutRow
                  icon={<Search className="w-5 h-5" />}
                  label={t.searchShortcut}
                  keys="S"
                />
                <ShortcutRow
                  icon={<Settings className="w-5 h-5" />}
                  label={t.settingsShortcut}
                  keys="C"
                />
                <ShortcutRow
                  icon={<ListMusic className="w-5 h-5" />}
                  label={t.queueShortcut}
                  keys="R"
                />
                <ShortcutRow
                  icon={<Menu className="w-5 h-5" />}
                  label={t.navigationMenu}
                  keys="N"
                />
                <ShortcutRow
                  icon={<Maximize2 className="w-5 h-5" />}
                  label={t.fullscreenPlayer}
                  keys="F"
                />
              </div>
              <p className="text-sm text-white/48 mt-5">{t.shortcutsGlobal}</p>
            </SettingCard>
          </SettingsSection>
        );

      case "advanced":
        return (
          <SettingsSection
            title={t.advanced}
            description="Herramientas de mantenimiento y diagnostico."
            icon={<Cpu className="w-5 h-5" />}
          >
            <SettingCard delay={0}>
              <ActionRow
                icon={<HardDrive className="w-5 h-5" />}
                title="Limpiar cache"
                description="Elimina portadas, colores y archivos temporales sin tocar tu biblioteca."
                tone="neutral"
                onClick={handleClearCache}
                busy={maintenanceBusy === "cache"}
                disabled={maintenanceBusy !== null}
              />
            </SettingCard>
            <SettingCard delay={80}>
              <ActionRow
                icon={<Trash2 className="w-5 h-5" />}
                title="Borrar todos los datos"
                description="Elimina canciones, playlists, ajustes, sesiones y notificaciones de este equipo."
                tone="danger"
                onClick={() => setShowDeleteDataConfirm(true)}
                busy={maintenanceBusy === "data"}
                disabled={maintenanceBusy !== null}
              />
            </SettingCard>
            <SettingCard delay={160}>
              <ActionRow
                icon={<Activity className="w-5 h-5" />}
                title="Estado del sistema"
                description="Consulta almacenamiento, conexion, entorno y estado de la biblioteca."
                tone="neutral"
                onClick={handleOpenSystemStatus}
                busy={maintenanceBusy === "status"}
                disabled={maintenanceBusy !== null}
              />
            </SettingCard>
          </SettingsSection>
        );

      case "account":
        return (
          <AccountView
            user={discordUser}
            linkedAt={discordLinkedAt}
            connecting={discordConnecting}
            error={discordError}
            onConnect={handleConnectDiscord}
            onDisconnect={disconnectDiscord}
          />
        );

      case "about":
        return (
          <SettingsSection
            title={t.about}
            description="Informacion de la aplicacion."
            icon={<Info className="w-5 h-5" />}
          >
            <ProjectSupport delay={0} />
          </SettingsSection>
        );

      default:
        return null;
    }
  };

  const renderOverview = () => (
    <div className="settings-content-in w-full max-w-none space-y-7">
      <div>
        <h1 className="settings-title-font text-white">Configuracion</h1>
      </div>

      <div className="space-y-2.5">
        {CATEGORIES.map((cat, index) => {
          const Icon = cat.icon;

          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveSubpage(null);
                setActiveCategory(cat.id);
              }}
              className="settings-category-row flex w-full items-center gap-4 rounded-[10px] px-5 py-4 text-left transition-all hover:bg-white/12 active:scale-[0.995]"
              style={{ ...cardGlass, animationDelay: `${index * 45}ms` }}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/78">
                <Icon className="w-5 h-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-black text-white">
                  {cat.label}
                </span>
                <span className="mt-1 block truncate text-sm font-semibold text-white/48">
                  {cat.description}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-white/70" />
            </button>
          );
        })}
      </div>

      <ProjectSupport delay={CATEGORIES.length * 45} />
    </div>
  );

  return (
    <>
      <div
        className={cn(
          "settings-panel-root fixed inset-0 z-[251] flex overflow-hidden text-white transition-[transform,opacity,filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          open
            ? "translate-y-0 opacity-100 blur-0"
            : "translate-y-6 opacity-0 blur-sm pointer-events-none",
        )}
        style={{
          ...panelGlass,
          background:
            appearance.interfaceTheme === "simplyui"
              ? "#141414"
              : "rgba(7, 7, 9, 0.38)",
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/18" />

        <main className="relative z-10 min-h-0 min-w-0 flex-1">
          <CustomScrollbar
            className="h-full"
            size="normal"
            barWidth="9px"
            scrollbarOffsetX={10}
            idleTimeout={1400}
            variant="liquid"
          >
            <div className="settings-scroll min-h-full px-5 pb-10 pt-16 md:px-8 md:pb-12 md:pt-20">
              {activeCategory === null ? (
                renderOverview()
              ) : (
                <div
                  key={`${activeCategory}-${activeSubpage ?? "root"}`}
                  className="settings-content-in min-h-full w-full max-w-none space-y-7"
                >
                  <div
                    className={cn(
                      "settings-title-font settings-breadcrumb flex w-full items-center justify-start gap-3 text-white",
                      activeSubpage && "settings-breadcrumb-deep",
                    )}
                  >
                    <button
                      onClick={() => {
                        setActiveSubpage(null);
                        setActiveCategory(null);
                      }}
                      className="m-0 p-0 font-[inherit] leading-[inherit] tracking-[inherit] text-[inherit] transition hover:text-white/70"
                    >
                      Configuracion
                    </button>
                    <ChevronRight className="mt-1 h-[0.72em] w-[0.72em] shrink-0 text-white/55" />
                    {activeSubpage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setActiveSubpage(null)}
                          className="m-0 min-w-0 truncate p-0 font-[inherit] leading-[inherit] tracking-[inherit] text-[inherit] transition hover:text-white/70"
                        >
                          {activeMeta.label}
                        </button>
                        <ChevronRight className="mt-1 h-[0.72em] w-[0.72em] shrink-0 text-white/55" />
                        {activeSubpage === "preferences" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setActiveSubpage("system-status")}
                              className="m-0 min-w-0 truncate p-0 font-[inherit] leading-[inherit] tracking-[inherit] text-[inherit] transition hover:text-white/70"
                            >
                              Estado del sistema
                            </button>
                            <ChevronRight className="mt-1 h-[0.72em] w-[0.72em] shrink-0 text-white/55" />
                            <span className="min-w-0 truncate font-[inherit] leading-[inherit] tracking-[inherit] text-[inherit]">
                              Preferencias
                            </span>
                          </>
                        ) : (
                          <span className="min-w-0 truncate font-[inherit] leading-[inherit] tracking-[inherit] text-[inherit]">
                            Estado del sistema
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="min-w-0 truncate font-[inherit] leading-[inherit] tracking-[inherit] text-[inherit]">
                        {activeMeta.label}
                      </span>
                    )}
                  </div>
                  {activeSubpage ? renderSubpage() : renderCategory()}
                </div>
              )}
            </div>
          </CustomScrollbar>
        </main>
      </div>

      {showDeleteDataConfirm && (
        <MaintenanceDialog
          title="Borrar todos los datos"
          description="Esta accion elimina permanentemente la biblioteca local, playlists, ajustes, inicio de sesion de Discord y notificaciones de este equipo."
          confirmLabel="Borrar y reiniciar"
          tone="danger"
          busy={maintenanceBusy === "data"}
          onCancel={() => setShowDeleteDataConfirm(false)}
          onConfirm={handleDeleteAllData}
        />
      )}

      <style>{`
        .settings-panel-root {
          container-type: inline-size;
        }

        @keyframes settings-custom-preview-drift {
          0%,
          100% {
            transform: scale(1.08) translate3d(-1.5%, -0.8%, 0);
          }
          50% {
            transform: scale(1.14) translate3d(1.5%, 0.8%, 0);
          }
        }

        .settings-custom-preview-video {
          animation-name: settings-custom-preview-drift;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          will-change: transform;
        }

        .settings-scroll {
          padding-inline: clamp(1.25rem, 2.1cqw, 2rem);
        }

        .settings-content-in,
        .settings-section-root,
        .settings-card-stable,
        .settings-layer-card,
        .settings-support-in {
          min-width: 0;
        }

        .settings-category-row {
          animation: settings-slide-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
          display: grid !important;
          grid-template-columns: 2.5rem minmax(0, 1fr) auto;
          align-items: center;
          min-height: 4.75rem;
        }

        .settings-content-in {
          animation: settings-content-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .settings-title-font {
          font-family: inherit;
          font-size: clamp(2rem, 3.1vw, 2.75rem);
          font-weight: 900;
          line-height: 1;
          letter-spacing: 0;
        }

        .settings-breadcrumb,
        .settings-breadcrumb button {
          font-family: inherit;
          letter-spacing: 0;
        }

        .settings-card-in {
          animation: settings-card-in 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .settings-section-header,
        .settings-layer-header,
        .settings-row {
          min-width: 0;
        }

        .settings-section-title {
          line-height: 1.04;
        }

        .settings-card-stable,
        .settings-layer-card {
          min-height: 5.25rem;
        }

        .settings-option-grid {
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }

        .settings-option-grid-wide {
          grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));
        }

        .settings-option-grid-compact {
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        }

        .settings-status-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .settings-storage-legend {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .settings-breadcrumb-deep {
          font-size: clamp(1.45rem, 2.4vw, 2.2rem);
        }

        .settings-choice-card {
          min-width: 0;
          min-height: 9rem;
        }

        .settings-support-in {
          animation: settings-support-in 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        @keyframes settings-slide-in {
          from { opacity: 0; transform: translateX(-12px); filter: blur(6px); }
          to { opacity: 1; transform: translateX(0); filter: blur(0); }
        }

        @keyframes settings-content-in {
          from { opacity: 0; transform: translateY(14px) scale(0.99); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }

        @keyframes settings-card-in {
          from { opacity: 0; transform: translateY(18px); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        @keyframes settings-support-in {
          from { opacity: 0; transform: translateY(12px); filter: blur(6px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        @container (max-width: 820px) {
          .settings-scroll {
            padding-top: 4.5rem;
            padding-inline: 1.1rem;
          }

          .settings-title-font {
            font-size: clamp(1.7rem, 8cqw, 2.35rem);
          }

          .settings-category-row {
            grid-template-columns: 2.35rem minmax(0, 1fr) auto;
            gap: 0.8rem;
            min-height: 4.35rem;
            padding-inline: 1rem;
          }

          .settings-section-header {
            align-items: flex-start;
          }

          .settings-section-icon {
            width: 3rem;
            height: 3rem;
            border-radius: 1rem;
          }

          .settings-section-title {
            font-size: 1.75rem;
          }

          .settings-row {
            align-items: flex-start;
            flex-direction: column;
            gap: 0.9rem;
          }

          .settings-row > div:last-child {
            align-self: stretch;
          }

          .settings-option-grid,
          .settings-option-grid-wide {
            grid-template-columns: repeat(auto-fit, minmax(168px, 1fr));
          }

          .settings-status-grid {
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          }

          .settings-choice-card {
            min-height: 8.4rem;
          }
        }

        @container (max-width: 560px) {
          .settings-card-stable,
          .settings-layer-card {
            padding: 1rem;
            border-radius: 1.25rem;
          }

          .settings-layer-header {
            align-items: flex-start;
            gap: 0.75rem;
          }

          .settings-option-grid,
          .settings-option-grid-wide,
          .settings-option-grid-compact,
          .settings-status-grid,
          .settings-storage-legend {
            grid-template-columns: 1fr;
          }
        }

      `}</style>
    </>
  );
}

function SettingsSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-section-root min-h-[calc(100vh-8rem)] space-y-5">
      <div className="settings-section-header flex items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="settings-section-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="settings-section-title text-3xl font-black text-white">
              {title}
            </h2>
            <p className="mt-1 text-sm font-semibold text-white/50">
              {description}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function SettingCard({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="settings-card-in settings-card-stable rounded-[28px] p-5"
      style={{ ...cardGlass, animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function ProjectSupport({ delay = 0 }: { delay?: number }) {
  return (
    <section
      className="settings-support-in pt-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-5 h-px w-full bg-gradient-to-r from-white/22 via-white/8 to-transparent" />
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-white/72">
            <Sparkles className="h-4 w-4" />
            <span className="text-xs font-black uppercase tracking-[0.18em]">
              Acerca de esta app
            </span>
          </div>
          <p className="text-xl font-black text-white">Cloud {CLOUD_VERSION}</p>
          <p className="mt-2 text-sm font-semibold text-white/58">
            Hecho con ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â¤ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â por Sam
          </p>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <p className="text-sm font-black text-white/86">Apoya el Proyecto!</p>
          <div className="flex items-center gap-2">
            <ProjectLink href={DISCORD_URL} label="Discord">
              <DiscordLogo className="h-5 w-5" />
            </ProjectLink>
            <ProjectLink href={TIKTOK_URL} label="TikTok">
              <TikTokLogo className="h-5 w-5" />
            </ProjectLink>
            <ProjectLink href={GITHUB_URL} label="GitHub">
              <Github className="h-5 w-5" />
            </ProjectLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function AppearanceLayer({
  title,
  description,
  icon,
  children,
  delay = 0,
  unavailableReason,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  unavailableReason?: string;
}) {
  const isUnavailable = Boolean(unavailableReason);

  return (
    <section
      className={cn(
        "settings-card-in settings-layer-card rounded-[28px] p-5 transition-all duration-300",
        isUnavailable && "opacity-[0.55] grayscale",
      )}
      style={{ ...cardGlass, animationDelay: `${delay}ms` }}
    >
      <div className="settings-layer-header mb-5 flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-xl font-black text-white">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-white/50">
            {description}
          </p>
        </div>
        {unavailableReason && (
          <span className="ml-auto shrink-0 rounded-full border border-white/16 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-white/70">
            {unavailableReason}
          </span>
        )}
      </div>
      <div className={cn(isUnavailable && "pointer-events-none select-none")}>
        {children}
      </div>
    </section>
  );
}

function AppearanceChoice({
  title,
  description,
  icon,
  selected,
  onSelect,
  features,
  disabled = false,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
  features?: string[];
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      className={cn(
        "settings-choice-card group flex h-full min-h-[118px] w-full flex-col rounded-2xl border p-4 text-left transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0",
        selected
          ? "border-white/36 bg-white/18 text-white shadow-[0_14px_34px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.20)]"
          : "border-white/10 bg-white/7 text-white/70 hover:border-white/22 hover:bg-white/12 hover:text-white",
        disabled &&
          "cursor-not-allowed hover:translate-y-0 hover:border-white/10 hover:bg-white/7",
      )}
    >
      <span className="mb-4 flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
          {icon}
        </span>
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border transition-all",
            selected
              ? "border-white bg-white text-black"
              : "border-white/20 bg-white/5 text-transparent group-hover:text-white/45",
          )}
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      </span>
      <span className="block text-base font-black text-white">{title}</span>
      <span className="mt-1 block text-sm font-semibold leading-5 text-white/52">
        {description}
      </span>
      {features && (
        <span className="mt-4 flex flex-wrap gap-1.5">
          {features.map((feature) => (
            <span
              key={feature}
              className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black text-white/56"
            >
              {feature}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}

function ProjectLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => openExternalLink(href)}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 items-center justify-center rounded-full text-white/72 transition-all hover:-translate-y-0.5 hover:bg-white/10 hover:text-white hover:shadow-[0_10px_28px_rgba(255,255,255,0.08)] active:translate-y-0"
    >
      {children}
    </button>
  );
}

function DiscordLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19.54 5.24A17.1 17.1 0 0 0 15.32 4a11.9 11.9 0 0 0-.54 1.12 15.9 15.9 0 0 0-4.69 0A10.5 10.5 0 0 0 9.55 4 17.4 17.4 0 0 0 5.32 5.25C2.65 9.2 1.93 13.06 2.29 16.86a17.2 17.2 0 0 0 5.18 2.6c.42-.56.79-1.15 1.1-1.77a10.4 10.4 0 0 1-1.73-.83l.42-.33a12.3 12.3 0 0 0 10.48 0l.42.33c-.55.33-1.13.61-1.74.83.32.62.69 1.21 1.1 1.77a17.1 17.1 0 0 0 5.19-2.6c.42-4.41-.72-8.23-3.17-11.62ZM9.27 14.52c-1.01 0-1.84-.93-1.84-2.08 0-1.14.81-2.08 1.84-2.08 1.04 0 1.86.95 1.84 2.08 0 1.15-.81 2.08-1.84 2.08Zm5.46 0c-1.01 0-1.84-.93-1.84-2.08 0-1.14.81-2.08 1.84-2.08 1.04 0 1.86.95 1.84 2.08 0 1.15-.8 2.08-1.84 2.08Z" />
    </svg>
  );
}

function TikTokLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M16.6 5.82a5.1 5.1 0 0 0 3.03 1.01v3.15a8.26 8.26 0 0 1-3.03-.58v5.65a5.7 5.7 0 1 1-5.7-5.7c.32 0 .64.03.95.08v3.2a2.58 2.58 0 1 0 1.8 2.46V3.5h2.95c.13.92.49 1.72 1 2.32Z" />
    </svg>
  );
}

function SettingRow({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-row flex items-center justify-between gap-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-base font-black text-white">{title}</p>
          {badge && (
            <span className="rounded-full border border-white/16 bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white/52">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm font-medium text-white/48">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ActionRow({
  icon,
  title,
  description,
  tone,
  onClick,
  busy = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: "danger" | "neutral";
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-wait disabled:opacity-55 disabled:hover:scale-100",
        tone === "danger"
          ? "bg-red-500/14 hover:bg-red-500/22"
          : "bg-white/10 hover:bg-white/16",
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
          tone === "danger"
            ? "bg-red-500/18 text-red-100"
            : "bg-white/12 text-white",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-black text-white">{title}</span>
        <span className="mt-0.5 block text-sm font-medium text-white/48">
          {description}
        </span>
      </span>
      {busy ? (
        <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-white/70" />
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-white/48" />
      )}
    </button>
  );
}

function MaintenanceDialog({
  title,
  description,
  confirmLabel,
  tone,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  tone: "danger" | "neutral";
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[340] flex items-center justify-center bg-black/52 p-5 backdrop-blur-xl"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-dialog-title"
        className="w-full max-w-md rounded-[28px] border border-white/18 p-6 text-white shadow-[0_28px_90px_rgba(0,0,0,0.42)]"
        style={panelGlass}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={cn(
            "mb-5 flex h-12 w-12 items-center justify-center rounded-2xl",
            tone === "danger"
              ? "bg-red-500/18 text-red-100"
              : "bg-white/12 text-white",
          )}
        >
          <Trash2 className="h-5 w-5" />
        </div>

        <h3 id="maintenance-dialog-title" className="text-xl font-black">
          {title}
        </h3>
        <p className="mt-2 text-sm font-medium leading-6 text-white/62">
          {description}
        </p>
        {tone === "danger" && (
          <p className="mt-4 text-xs font-bold uppercase text-red-100/72">
            Esta accion no se puede deshacer.
          </p>
        )}

        <div className="mt-7 flex justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/16 disabled:opacity-45"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cn(
              "flex min-w-36 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-black text-white transition disabled:cursor-wait disabled:opacity-65",
              tone === "danger"
                ? "bg-red-500/72 hover:bg-red-500/88"
                : "bg-white/18 hover:bg-white/24",
            )}
          >
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {busy ? "Borrando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SystemStatusView({
  status,
  error,
  loading,
  activePreferences,
  onOpenPreferences,
  onRefresh,
}: {
  status: CloudSystemStatus | null;
  error: string | null;
  loading: boolean;
  activePreferences: number;
  onOpenPreferences: () => void;
  onRefresh: () => void;
}) {
  return (
    <SettingsSection
      title="Estado del sistema"
      description="Diagnostico local de Cloud, su biblioteca y almacenamiento."
      icon={<Activity className="h-5 w-5" />}
    >
      {loading && !status ? (
        <SettingCard>
          <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-white/62">
            <LoaderCircle className="h-8 w-8 animate-spin" />
            <p className="text-sm font-bold">Analizando Cloud...</p>
          </div>
        </SettingCard>
      ) : error ? (
        <SettingCard>
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <Activity className="h-9 w-9 text-red-200" />
            <p className="mt-4 max-w-md text-sm font-bold leading-6 text-red-100">
              {error}
            </p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-6 flex items-center gap-2 rounded-2xl bg-white/12 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/18"
            >
              <RotateCcw className="h-4 w-4" />
              Intentar de nuevo
            </button>
          </div>
        </SettingCard>
      ) : status ? (
        <>
          <div className="settings-status-grid grid gap-3">
            <SystemMetricCard
              icon={
                status.online ? (
                  <Wifi className="h-5 w-5" />
                ) : (
                  <WifiOff className="h-5 w-5" />
                )
              }
              label="Conexion"
              value={status.online ? "En linea" : "Sin conexion"}
              detail={status.online ? "Servicios disponibles" : "Modo local"}
              delay={0}
            />
            <SystemMetricCard
              icon={<Music className="h-5 w-5" />}
              label="Biblioteca"
              value={`${status.songCount}`}
              detail={
                status.songCount === 1 ? "cancion local" : "canciones locales"
              }
              delay={70}
            />
            <SystemMetricCard
              icon={<HardDrive className="h-5 w-5" />}
              label="Cache"
              value={formatStorageSize(status.cacheBytes)}
              detail="datos temporales"
              delay={140}
            />
          </div>

          <StorageBreakdown status={status} />

          <SettingCard delay={190}>
            <div className="divide-y divide-white/10">
              <StatusRow
                icon={<Cpu className="h-5 w-5" />}
                label="Entorno"
                value={`${status.osName} ${status.osVersion} · ${formatArchitecture(status.architecture)}`}
              />
              <StatusRow
                icon={<Database className="h-5 w-5" />}
                label="Datos internos de Cloud"
                value={formatStorageSize(status.storageUsed)}
              />
              <StatusRow
                icon={<Info className="h-5 w-5" />}
                label="Version tecnica"
                value={`Cloud ${status.appVersion}`}
              />
              <button
                type="button"
                onClick={onOpenPreferences}
                className="flex w-full items-center gap-4 py-3.5 text-left transition hover:bg-white/[0.045]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white/76">
                  <Settings className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-white">
                    Preferencias
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-white/48">
                    {activePreferences} activadas · {status.localEntries} datos
                    guardados
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-white/52" />
              </button>
            </div>
          </SettingCard>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-2 rounded-2xl bg-white/12 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/18 disabled:cursor-wait disabled:opacity-55"
            >
              <RotateCcw className={cn("h-4 w-4", loading && "animate-spin")} />
              Actualizar diagnostico
            </button>
          </div>
        </>
      ) : null}
    </SettingsSection>
  );
}

function StorageBreakdown({ status }: { status: CloudSystemStatus }) {
  const hasDiskInformation = status.diskTotalBytes > 0;
  const items = [
    {
      label: "Otras aplicaciones",
      value: status.otherAppsBytes,
      color: "#f472b6",
    },
    {
      label: "Musica de Cloud",
      value: status.musicBytes,
      color: "#67e8f9",
    },
    {
      label: "Cache de Cloud",
      value: status.cacheBytes,
      color: "#c084fc",
    },
    {
      label: "Disponible",
      value: status.diskAvailableBytes,
      color: "rgba(255,255,255,0.24)",
    },
  ];

  return (
    <div
      className="settings-card-in settings-card-stable rounded-[28px] p-5 md:p-6"
      style={{ ...cardGlass, animationDelay: "175ms" }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-white">Almacenamiento</h3>
          <p className="mt-1 text-sm font-semibold text-white/48">
            {hasDiskInformation
              ? `${formatStorageSize(status.diskUsedBytes)} usados de ${formatStorageSize(status.diskTotalBytes)}`
              : "La informacion completa del disco esta disponible en Cloud Desktop."}
          </p>
        </div>
        {hasDiskInformation && (
          <span className="text-sm font-black text-white/72">
            {formatStorageSize(status.diskAvailableBytes)} libres
          </span>
        )}
      </div>

      {hasDiskInformation ? (
        <>
          <div
            className="mt-5 flex h-3.5 w-full overflow-hidden rounded-full bg-white/8"
            aria-label="Distribucion del almacenamiento"
          >
            {items.map((item) =>
              item.value > 0 ? (
                <span
                  key={item.label}
                  title={`${item.label}: ${formatStorageSize(item.value)}`}
                  className="h-full transition-[flex-grow] duration-700"
                  style={{
                    backgroundColor: item.color,
                    flexGrow: item.value,
                    flexBasis: 0,
                    minWidth: "2px",
                  }}
                />
              ) : null,
            )}
          </div>

          <div className="settings-storage-legend mt-6 grid gap-x-8 gap-y-4">
            {items.map((item) => (
              <div
                key={item.label}
                className="flex min-w-0 items-center justify-between gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate text-sm font-bold text-white/76">
                    {item.label}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-black text-white">
                  {formatStorageSize(item.value)}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3 text-sm font-semibold text-white/58">
          <HardDrive className="h-5 w-5 shrink-0" />
          Abre esta seccion desde la aplicacion instalada para consultar el
          disco.
        </div>
      )}
    </div>
  );
}

function PreferencesView({
  preferences,
  onPreferenceChange,
  appearance,
  setInterfaceTheme,
  setBackgroundTheme,
  setColorTheme,
}: {
  preferences: PlaybackPreferences;
  onPreferenceChange: (
    preference: keyof PlaybackPreferences,
    value: boolean,
  ) => void;
  appearance: AppearanceSettings;
  setInterfaceTheme: (theme: InterfaceTheme) => void;
  setBackgroundTheme: (theme: BackgroundTheme) => void;
  setColorTheme: (theme: ColorTheme) => void;
}) {
  const isSimplyUi = appearance.interfaceTheme === "simplyui";

  return (
    <SettingsSection
      title="Preferencias"
      description="Activa o desactiva el comportamiento general de Cloud."
      icon={<Settings className="h-5 w-5" />}
    >
      <SettingCard delay={0}>
        <div className="divide-y divide-white/10">
          <PreferenceToggleRow
            title="Normalizar volumen"
            description="Mantiene un nivel mas consistente entre canciones."
            checked={preferences.normalizeVolume}
            onChange={(value) => onPreferenceChange("normalizeVolume", value)}
          />
          <PreferenceToggleRow
            title="Reproduccion sin pausas"
            description="Reduce silencios entre pistas compatibles."
            checked={preferences.gaplessPlayback}
            onChange={(value) => onPreferenceChange("gaplessPlayback", value)}
          />
          <PreferenceToggleRow
            title="Autoplay"
            description="Continua con contenido relacionado al terminar la cola."
            checked={preferences.autoplay}
            onChange={(value) => onPreferenceChange("autoplay", value)}
          />
        </div>
      </SettingCard>

      <SettingCard delay={90}>
        <div className="divide-y divide-white/10">
          <PreferenceToggleRow
            title="Liquid Glass"
            description="Usa transparencias, blur y superficies Crystalized."
            checked={!isSimplyUi}
            onChange={(value) =>
              setInterfaceTheme(value ? "crystalized" : "simplyui")
            }
          />
          <PreferenceToggleRow
            title="Fondo dinamico"
            description={
              isSimplyUi
                ? "No disponible mientras SimplyUI esta activo."
                : "Adapta el fondo a la cancion que se reproduce."
            }
            checked={
              !isSimplyUi && appearance.backgroundTheme === "dynamic-background"
            }
            disabled={isSimplyUi}
            onChange={(value) =>
              setBackgroundTheme(value ? "dynamic-background" : "cloud-core")
            }
          />
          <PreferenceToggleRow
            title="Colores dinamicos"
            description="Extrae la paleta visual de la portada actual."
            checked={appearance.colorTheme === "dynamic-colors"}
            onChange={(value) =>
              setColorTheme(value ? "dynamic-colors" : "cloud-default")
            }
          />
        </div>
      </SettingCard>
    </SettingsSection>
  );
}

function PreferenceToggleRow({
  title,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-5 py-4 first:pt-0 last:pb-0",
        disabled && "opacity-45",
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-black text-white">{title}</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-white/48">
          {description}
        </p>
      </div>
      <Toggle checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  );
}

function AccountView({
  user,
  linkedAt,
  connecting,
  error,
  onConnect,
  onDisconnect,
}: {
  user: DiscordUser | null;
  linkedAt: string | null;
  connecting: boolean;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <SettingsSection
      title="Cuenta"
      description="Administra la identidad de Discord usada en Cloud."
      icon={<UserRound className="h-5 w-5" />}
    >
      {user ? (
        <>
          <SettingCard delay={0}>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={`Avatar de ${user.displayName}`}
                  className="h-24 w-24 shrink-0 rounded-[24px] object-cover shadow-[0_18px_50px_rgba(0,0,0,0.28)]"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[24px] bg-white/12 text-3xl font-black text-white">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-2xl font-black text-white">
                    {user.displayName}
                  </h3>
                  <span className="rounded-full bg-emerald-400/14 px-2.5 py-1 text-[11px] font-black text-emerald-100">
                    Vinculada
                  </span>
                </div>
                <p className="mt-1 truncate text-sm font-semibold text-white/52">
                  @{user.username}
                </p>
                <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-white/58">
                  <CalendarDays className="h-4 w-4" />
                  {linkedAt
                    ? `Vinculada desde el ${formatLinkedDate(linkedAt)}`
                    : "Vinculada desde una sesion anterior"}
                </p>
              </div>
            </div>
          </SettingCard>

          <SettingCard delay={90}>
            <button
              type="button"
              onClick={onDisconnect}
              className="flex w-full items-center justify-between gap-4 rounded-2xl bg-red-500/12 px-4 py-3 text-left text-red-50 transition hover:bg-red-500/20"
            >
              <span className="flex items-center gap-3 font-black">
                <Unlink className="h-5 w-5" />
                Desvincular cuenta
              </span>
              <ChevronRight className="h-5 w-5 text-red-100/58" />
            </button>
          </SettingCard>
        </>
      ) : (
        <SettingCard>
          <div className="flex min-h-80 flex-col items-center justify-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-white/10 text-white">
              <UserRound className="h-8 w-8" />
            </div>
            <h3 className="mt-6 text-2xl font-black text-white">
              Vincula tu cuenta de Discord
            </h3>
            <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-white/52">
              Cloud usara tu nombre y avatar para identificar tus contribuciones
              TTML.
            </p>
            {error && (
              <p className="mt-4 max-w-md text-sm font-bold text-red-100">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={connecting}
              onClick={onConnect}
              className="mt-7 flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-black transition hover:bg-white/88 disabled:cursor-wait disabled:opacity-65"
            >
              {connecting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {connecting ? "Conectando..." : "Vincular Discord"}
            </button>
          </div>
        </SettingCard>
      )}
    </SettingsSection>
  );
}

function formatArchitecture(architecture: string) {
  const normalized = architecture.toLowerCase();
  if (
    normalized.includes("64") ||
    normalized.includes("x86_64") ||
    normalized.includes("aarch64")
  ) {
    return "64 bits";
  }
  if (normalized.includes("86") || normalized.includes("32")) return "32 bits";
  return architecture;
}

function formatLinkedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "fecha desconocida";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function SystemMetricCard({
  icon,
  label,
  value,
  detail,
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  delay: number;
}) {
  return (
    <div
      className="settings-card-in settings-card-stable min-w-0 rounded-[24px] p-5"
      style={{ ...cardGlass, animationDelay: `${delay}ms` }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white/78">
        {icon}
      </div>
      <p className="mt-5 text-xs font-black uppercase text-white/42">{label}</p>
      <p className="mt-1 truncate text-2xl font-black text-white">{value}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white/48">
        {detail}
      </p>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 py-3.5 first:pt-0 last:pb-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white/76">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-sm font-black text-white">{label}</span>
          <span className="break-all text-right text-sm font-semibold text-white/58">
            {value}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function ChevronGhost() {
  return <Check className="h-4 w-4 text-white/50" />;
}

function ShortcutRow({
  icon,
  label,
  keys,
}: {
  icon: React.ReactNode;
  label: string;
  keys: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/8 px-4 py-3 transition-all hover:bg-white/12">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white/80">
          {icon}
        </div>
        <span className="truncate text-sm font-bold text-white">{label}</span>
      </div>
      <span className="rounded-xl bg-white/14 px-3 py-1.5 font-mono text-xs font-black text-white/70">
        {keys}
      </span>
    </div>
  );
}

function LibraryManager() {
  const { t } = useTranslation();
  const { allSongs, addUserSongs, removeSongs, isLoadingLibrary } =
    useMusicPlayer();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"selected" | "all">("selected");
  const musicInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;

    addUserSongs(Array.from(files));
    event.target.value = "";
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const confirmDelete = () => {
    if (deleteMode === "all") {
      removeSongs(allSongs.map((s) => s.id));
    } else {
      removeSongs(Array.from(selectedIds));
    }
    setSelectedIds(new Set());
    setShowDeleteModal(false);
  };

  const buttonStyle =
    "flex items-center gap-2 rounded-2xl bg-red-500/16 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-500/28 disabled:opacity-40";

  if (isLoadingLibrary) {
    return <LibraryLoader />;
  }

  return (
    <SettingsSection
      title={t.library}
      description="Administra las canciones guardadas en tu biblioteca."
      icon={<FolderOpen className="w-5 h-5" />}
    >
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => musicInputRef.current?.click()}
          className="flex items-center gap-2 rounded-2xl bg-white/14 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/22"
        >
          <FolderOpen className="w-4 h-4" />
          Subir musica
        </button>
        <input
          ref={musicInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
        <button
          onClick={() => {
            setDeleteMode("selected");
            setShowDeleteModal(true);
          }}
          disabled={selectedIds.size === 0}
          className={buttonStyle}
        >
          <Trash2 className="w-4 h-4" />
          {t.deleteSelected(selectedIds.size)}
        </button>
        <button
          onClick={() => {
            setDeleteMode("all");
            setShowDeleteModal(true);
          }}
          disabled={allSongs.length === 0}
          className={buttonStyle}
        >
          <Trash2 className="w-4 h-4" />
          {t.deleteAllSongs}
        </button>
      </div>

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/42 backdrop-blur-md"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="w-80 rounded-[28px] p-6 text-center"
            style={panelGlass}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-6 text-sm text-white/80">
              {deleteMode === "all"
                ? t.confirmDeleteAll
                : t.confirmDeleteSelected(selectedIds.size)}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-2xl bg-white/14 px-4 py-2 text-white transition hover:bg-white/22"
              >
                {t.cancel}
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-2xl bg-red-500/70 px-4 py-2 text-white transition hover:bg-red-600"
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingCard>
        <div className="settings-scroll max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {allSongs.length === 0 ? (
            <p className="text-sm text-white/50">{t.noSongsInLibrary}</p>
          ) : (
            allSongs.map((song) => (
              <label
                key={song.id}
                className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 transition hover:bg-white/16"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(song.id)}
                  onChange={() => toggleSelect(song.id)}
                  className="h-4 w-4 accent-white"
                />
                <Music className="w-5 h-5 text-white/58" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-white">
                    {song.title}
                  </p>
                  <p className="truncate text-xs font-medium text-white/52">
                    {song.artist}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>
      </SettingCard>
    </SettingsSection>
  );
}

function LibraryLoader() {
  const text = "Cargando canciones";
  const [charIndex, setCharIndex] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let start: number | null = null;
    const duration = 500;
    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = elapsed / duration;
      if (progress >= 1) {
        start = timestamp;
        setCharIndex(0);
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      const idx = Math.floor(progress * text.length);
      setCharIndex(idx);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [text]);

  return (
    <div className="flex h-64 flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block h-2 w-2 rounded-full bg-white"
            style={{
              animation: `dotPulse 1.5s ease-in-out ${i * 0.25}s infinite`,
            }}
          />
        ))}
      </div>
      <p className="text-sm font-medium text-white/80">
        {text.split("").map((ch, i) => (
          <span
            key={i}
            style={{
              textShadow:
                i === charIndex
                  ? "0 0 8px rgba(255,255,255,0.9), 0 0 16px rgba(255,255,255,0.5)"
                  : "none",
              transition: "text-shadow 0.05s ease",
            }}
          >
            {ch}
          </span>
        ))}
      </p>
      <style>{`
        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50%      { transform: scale(1.5); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function MetadataLoader() {
  return (
    <div className="flex min-h-[calc(100vh-18rem)] w-full items-start justify-center pt-[12vh]">
      <div className="flex flex-col items-center justify-center gap-5 text-center">
        <div className="flex items-center gap-3">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.42)]"
              style={{
                animation: `metadataDotPulse 1.35s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </div>
        <p className="text-lg font-black text-white/82">Cargando canciones</p>
      </div>
      <style>{`
        @keyframes metadataDotPulse {
          0%, 100% {
            transform: translateY(0) scale(0.82);
            opacity: 0.48;
          }
          50% {
            transform: translateY(-6px) scale(1.28);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

function MetadataEditor() {
  const { t } = useTranslation();
  const { allSongs, updateSongMetadata } = useMusicPlayer();
  const [step, setStep] = useState<"loading" | "select" | "edit">("loading");
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [form, setForm] = useState({
    title: "",
    artist: "",
    genre: "",
    album: "",
    customCoverUrl: "",
  });
  const [coverPreview, setCoverPreview] = useState("");
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setStep("select"), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSelectSong = (song: Song) => {
    setSelectedSong(song);
    setForm({
      title: song.title,
      artist: song.artist,
      genre: song.genre || "",
      album: song.album || "",
      customCoverUrl: song.customCoverUrl || "",
    });
    setCoverPreview(song.customCoverUrl || song.coverUrl || "");
    setStep("edit");
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setCoverPreview(dataUrl);
      setForm({ ...form, customCoverUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleApply = () => {
    if (!selectedSong) return;
    if (updateSongMetadata) {
      updateSongMetadata(selectedSong.id, {
        title: form.title,
        artist: form.artist,
        genre: form.genre,
        album: form.album,
        customCoverUrl: form.customCoverUrl || undefined,
      });
      alert(t.metadataUpdated);
    } else {
      alert(t.metadataUnavailable);
    }
    setStep("select");
    setSelectedSong(null);
  };

  if (step === "loading") {
    return <MetadataLoader />;
  }

  if (step === "select") {
    return (
      <SettingsSection
        title={t.metadata}
        description="Selecciona una cancion para editar sus datos."
        icon={<Disc className="w-5 h-5" />}
      >
        <SettingCard>
          <p className="mb-4 text-sm font-semibold text-white/62">
            {t.selectSongToEdit}
          </p>
          <div className="settings-scroll h-[calc(100vh-22rem)] min-h-[560px] space-y-2 overflow-y-auto pr-1">
            {allSongs.length === 0 ? (
              <p className="text-sm text-white/50">{t.noSongsAvailable}</p>
            ) : (
              allSongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => handleSelectSong(song)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-left transition hover:bg-white/16"
                >
                  <Music className="w-5 h-5 text-white/58" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-white">
                      {song.title}
                    </p>
                    <p className="truncate text-xs font-medium text-white/52">
                      {song.artist}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </SettingCard>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title={`${t.editingMetadataOf} ${selectedSong?.title}`}
      description="Actualiza nombre, artista, genero, album y portada."
      icon={<Disc className="w-5 h-5" />}
    >
      <SettingCard>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
          <div className="grid gap-4">
            <MetadataInput
              label={t.name}
              value={form.title}
              onChange={(value) => setForm({ ...form, title: value })}
            />
            <MetadataInput
              label={t.artist}
              value={form.artist}
              onChange={(value) => setForm({ ...form, artist: value })}
            />
            <MetadataInput
              label={t.genre}
              value={form.genre}
              onChange={(value) => setForm({ ...form, genre: value })}
            />
            <MetadataInput
              label={t.album}
              value={form.album}
              onChange={(value) => setForm({ ...form, album: value })}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-white/48">
              {t.cover}
            </label>
            <div className="overflow-hidden rounded-[26px] bg-white/10 ring-1 ring-white/16">
              <div className="aspect-square">
                {coverPreview ? (
                  <img
                    src={coverPreview}
                    alt="Portada"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Music className="w-8 h-8 text-white/50" />
                  </div>
                )}
              </div>
              <label className="flex cursor-pointer items-center justify-center gap-2 bg-white/10 px-3 py-3 text-sm font-bold text-white transition hover:bg-white/16">
                <Image className="w-4 h-4" />
                {t.changeImage}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverChange}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setStep("select")}
            className="flex-1 rounded-2xl bg-white/12 py-3 text-sm font-black text-white transition hover:bg-white/18"
          >
            {t.cancel}
          </button>
          <button
            onClick={handleApply}
            className="flex-1 rounded-2xl bg-white py-3 text-sm font-black text-black transition hover:bg-white/88"
          >
            {t.apply}
          </button>
        </div>
      </SettingCard>
    </SettingsSection>
  );
}

function MetadataInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-black uppercase tracking-[0.18em] text-white/48">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(softInput, "w-full")}
      />
    </div>
  );
}

function GlassSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const latestValueRef = useRef(value);
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const updateFromMouse = (clientX: number) => {
    if (disabled || !trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const raw = min + (x / rect.width) * (max - min);
    const stepped = Math.round(raw / step) * step;
    const next = Math.min(max, Math.max(min, stepped));

    latestValueRef.current = next;
    onChange(next);
  };

  const handleMouseMove = (e: MouseEvent) => {
    updateFromMouse(e.clientX);
  };

  const handleMouseUp = () => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    updateFromMouse(e.clientX);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={trackRef}
      onMouseDown={handleMouseDown}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-white/14",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <div
        className="absolute left-0 top-0 h-full rounded-full bg-white transition-[width] duration-75"
        style={{
          width: `${Math.min(100, Math.max(0, percent))}%`,
          boxShadow: "0 0 18px rgba(255,255,255,0.22)",
        }}
      />
    </div>
  );
}

function CustomBackgroundControl({
  label,
  value,
  suffix,
  onChange,
  min = 0,
  max = 100,
  disabled = false,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase text-white/58">
          {label}
        </span>
        <span className="text-xs font-black text-white">
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <GlassSlider
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}

function Toggle({
  checked: externalChecked,
  defaultChecked = false,
  disabled = false,
  onChange,
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isControlled = externalChecked !== undefined;
  const current = isControlled ? externalChecked : internalChecked;

  const toggle = () => {
    if (disabled) return;
    const newValue = !current;
    if (!isControlled) setInternalChecked(newValue);
    onChange?.(newValue);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      className={cn(
        "relative h-7 w-12 rounded-full border transition-all duration-300 disabled:cursor-not-allowed",
        current
          ? "border-white/32 bg-white/28 shadow-[0_0_24px_rgba(255,255,255,0.18)]"
          : "border-white/16 bg-white/10",
      )}
    >
      <div
        className={cn(
          "absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300",
          current ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
