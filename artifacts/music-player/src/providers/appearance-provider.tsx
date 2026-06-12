import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type InterfaceTheme = "crystalized" | "simplyui";
export type BackgroundTheme =
  | "cloud-core"
  | "cloud-hour"
  | "weather"
  | "dynamic-background"
  | "custom-background"
  | "custom-video";
export type ColorTheme = "cloud-default" | "dynamic-colors" | "custom-colors";
export type LyricsMotion = "animated" | "static";
export type LyricsAnimationFormat = "line" | "letters" | "line-words";
export type CustomBackgroundKind = "image" | "video";

type ThemeTokens = Record<string, string>;

export type AppearanceSettings = {
  interfaceTheme: InterfaceTheme;
  backgroundTheme: BackgroundTheme;
  colorTheme: ColorTheme;
  lyricsMotion: LyricsMotion;
  lyricsAnimationFormat: LyricsAnimationFormat;
  dynamicColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  customColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  customBackground: {
    blur: number;
    intensity: number;
    speed: number;
  };
};

type AppearanceContextValue = {
  settings: AppearanceSettings;
  customBackgroundUrl: string | null;
  customBackgroundKind: CustomBackgroundKind | null;
  customVideoUrl: string | null;
  setInterfaceTheme: (theme: InterfaceTheme) => void;
  setBackgroundTheme: (theme: BackgroundTheme) => void;
  setCustomBackgroundMedia: (file: File | null) => Promise<void>;
  setCustomBackgroundVideo: (file: File | null) => Promise<void>;
  setCustomBackgroundSettings: (
    settings: Partial<AppearanceSettings["customBackground"]>,
  ) => void;
  setColorTheme: (theme: ColorTheme) => void;
  setLyricsMotion: (motion: LyricsMotion) => void;
  setLyricsAnimationFormat: (format: LyricsAnimationFormat) => void;
  setDynamicColors: (
    colors: Partial<AppearanceSettings["dynamicColors"]>,
  ) => void;
  setCustomColors: (
    colors: Partial<AppearanceSettings["customColors"]>,
  ) => void;
  resetAppearance: () => void;
};

const STORAGE_KEY = "cloud.appearance.v1";
const MEDIA_DB_NAME = "cloud-appearance-assets";
const MEDIA_STORE_NAME = "backgrounds";
const MEDIA_KEY = "custom-background";
const LEGACY_VIDEO_KEY = "custom-video";

const defaultSettings: AppearanceSettings = {
  interfaceTheme: "crystalized",
  backgroundTheme: "cloud-core",
  colorTheme: "cloud-default",
  lyricsMotion: "animated",
  lyricsAnimationFormat: "line-words",
  dynamicColors: {
    primary: "#d875ff",
    secondary: "#ff7aa8",
    accent: "#ffffff",
  },
  customColors: {
    primary: "#d875ff",
    secondary: "#ff7aa8",
    accent: "#ffffff",
  },
  customBackground: {
    blur: 12,
    intensity: 72,
    speed: 35,
  },
};

const fallbackAppearanceContext: AppearanceContextValue = {
  settings: defaultSettings,
  customBackgroundUrl: null,
  customBackgroundKind: null,
  customVideoUrl: null,
  setInterfaceTheme: () => {},
  setBackgroundTheme: () => {},
  setCustomBackgroundMedia: async () => {},
  setCustomBackgroundVideo: async () => {},
  setCustomBackgroundSettings: () => {},
  setColorTheme: () => {},
  setLyricsMotion: () => {},
  setLyricsAnimationFormat: () => {},
  setDynamicColors: () => {},
  setCustomColors: () => {},
  resetAppearance: () => {},
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<AppearanceSettings>(() => {
    if (typeof window === "undefined") return defaultSettings;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return defaultSettings;
      const parsed = JSON.parse(stored) as Partial<AppearanceSettings>;
      return {
        ...defaultSettings,
        ...parsed,
        backgroundTheme:
          parsed.backgroundTheme === "custom-video"
            ? "custom-background"
            : (parsed.backgroundTheme ?? defaultSettings.backgroundTheme),
        customBackground: {
          ...defaultSettings.customBackground,
          ...parsed.customBackground,
        },
      };
    } catch {
      return defaultSettings;
    }
  });
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState<string | null>(
    null,
  );
  const [customBackgroundKind, setCustomBackgroundKind] =
    useState<CustomBackgroundKind | null>(null);
  const customBackgroundUrlRef = useRef<string | null>(null);

  const tokens = useMemo(() => buildThemeTokens(settings), [settings]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    let cancelled = false;

    loadCustomBackground()
      .then((blob) => {
        if (!blob || cancelled) return;
        const url = URL.createObjectURL(blob);
        customBackgroundUrlRef.current = url;
        setCustomBackgroundUrl(url);
        setCustomBackgroundKind(getCustomBackgroundKind(blob));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (customBackgroundUrlRef.current) {
        URL.revokeObjectURL(customBackgroundUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.cloudInterface = settings.interfaceTheme;
    root.dataset.cloudBackground = settings.backgroundTheme;
    root.dataset.cloudColors = settings.colorTheme;

    Object.entries(tokens).forEach(([name, value]) => {
      root.style.setProperty(`--${name}`, value);
    });
  }, [settings, tokens]);

  const setCustomBackgroundMedia = useCallback(async (file: File | null) => {
    if (customBackgroundUrlRef.current) {
      URL.revokeObjectURL(customBackgroundUrlRef.current);
      customBackgroundUrlRef.current = null;
    }

    if (!file) {
      await deleteCustomBackground();
      setCustomBackgroundUrl(null);
      setCustomBackgroundKind(null);
      return;
    }

    await saveCustomBackground(file);
    const url = URL.createObjectURL(file);
    customBackgroundUrlRef.current = url;
    setCustomBackgroundUrl(url);
    setCustomBackgroundKind(getCustomBackgroundKind(file));
  }, []);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      settings,
      customBackgroundUrl,
      customBackgroundKind,
      customVideoUrl:
        customBackgroundKind === "video" ? customBackgroundUrl : null,
      setInterfaceTheme: (theme) =>
        setSettings((current) => ({
          ...current,
          interfaceTheme: theme,
          ...(theme === "simplyui"
            ? {
                lyricsMotion: "animated" as const,
                lyricsAnimationFormat: "line" as const,
              }
            : {}),
        })),
      setBackgroundTheme: (theme) =>
        setSettings((current) =>
          current.interfaceTheme === "simplyui"
            ? current
            : { ...current, backgroundTheme: theme },
        ),
      setCustomBackgroundMedia,
      setCustomBackgroundVideo: setCustomBackgroundMedia,
      setCustomBackgroundSettings: (nextSettings) =>
        setSettings((current) => ({
          ...current,
          customBackground: {
            ...current.customBackground,
            ...nextSettings,
          },
        })),
      setColorTheme: (theme) =>
        setSettings((current) => ({ ...current, colorTheme: theme })),
      setLyricsMotion: (motion) =>
        setSettings((current) => ({
          ...current,
          lyricsMotion:
            current.interfaceTheme === "simplyui" ? "animated" : motion,
        })),
      setLyricsAnimationFormat: (format) =>
        setSettings((current) => ({
          ...current,
          lyricsAnimationFormat:
            current.interfaceTheme === "simplyui" ? "line" : format,
        })),
      setDynamicColors: (colors) =>
        setSettings((current) => ({
          ...current,
          dynamicColors: { ...current.dynamicColors, ...colors },
        })),
      setCustomColors: (colors) =>
        setSettings((current) => ({
          ...current,
          customColors: { ...current.customColors, ...colors },
        })),
      resetAppearance: () => setSettings(defaultSettings),
    }),
    [
      settings,
      customBackgroundUrl,
      customBackgroundKind,
      setCustomBackgroundMedia,
    ],
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

function openMediaDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(MEDIA_STORE_NAME)) {
        request.result.createObjectStore(MEDIA_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveCustomBackground(file: File) {
  const database = await openMediaDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(MEDIA_STORE_NAME, "readwrite");
    const store = transaction.objectStore(MEDIA_STORE_NAME);
    store.put(file, MEDIA_KEY);
    store.delete(LEGACY_VIDEO_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function loadCustomBackground() {
  const database = await openMediaDatabase();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const transaction = database.transaction(MEDIA_STORE_NAME, "readonly");
    const store = transaction.objectStore(MEDIA_STORE_NAME);
    const request = store.get(MEDIA_KEY);
    request.onsuccess = () => {
      if (request.result) {
        resolve(request.result as Blob);
        return;
      }

      const legacyRequest = store.get(LEGACY_VIDEO_KEY);
      legacyRequest.onsuccess = () =>
        resolve((legacyRequest.result as Blob) ?? null);
      legacyRequest.onerror = () => reject(legacyRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
  database.close();
  return blob;
}

async function deleteCustomBackground() {
  const database = await openMediaDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(MEDIA_STORE_NAME, "readwrite");
    const store = transaction.objectStore(MEDIA_STORE_NAME);
    store.delete(MEDIA_KEY);
    store.delete(LEGACY_VIDEO_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

function getCustomBackgroundKind(blob: Blob): CustomBackgroundKind {
  return blob.type.startsWith("video/") ? "video" : "image";
}

export function useAppearance() {
  return useContext(AppearanceContext) ?? fallbackAppearanceContext;
}

function buildThemeTokens(settings: AppearanceSettings): ThemeTokens {
  const accentColors = getAccentColors(settings);

  return {
    ...baseTokens,
    ...interfaceTokens[settings.interfaceTheme],
    ...getBackgroundTokens(settings),
    ...accentColors,
  };
}

const baseTokens: ThemeTokens = {
  "cloud-text": "#ffffff",
  "cloud-text-muted": "rgba(255,255,255,0.58)",
  "cloud-border": "rgba(255,255,255,0.14)",
  "cloud-radius-sm": "12px",
  "cloud-radius-md": "18px",
  "cloud-radius-lg": "28px",
  "cloud-progress-track": "rgba(255,255,255,0.22)",
  "cloud-progress-fill": "rgba(255,255,255,0.96)",
};

const interfaceTokens: Record<InterfaceTheme, ThemeTokens> = {
  crystalized: {
    "cloud-surface": "rgba(255,255,255,0.105)",
    "cloud-surface-strong": "rgba(255,255,255,0.18)",
    "cloud-surface-soft": "rgba(255,255,255,0.07)",
    "cloud-blur": "28px",
    "cloud-shadow": "0 24px 70px rgba(0,0,0,0.32)",
    "cloud-glass-filter": "blur(28px) saturate(165%)",
    "cloud-progress-track": "rgba(255,255,255,0.24)",
    "cloud-progress-fill": "rgba(255,255,255,0.96)",
  },
  simplyui: {
    "cloud-text": "#f5f5f5",
    "cloud-text-muted": "rgba(245,245,245,0.62)",
    "cloud-border": "rgba(255,255,255,0.10)",
    "cloud-surface": "#202020",
    "cloud-surface-strong": "#1d1d1f",
    "cloud-surface-soft": "#242424",
    "cloud-blur": "0px",
    "cloud-shadow": "none",
    "cloud-glass-filter": "none",
    "cloud-progress-track": "rgba(255,255,255,0.20)",
    "cloud-progress-fill": "#f5f5f5",
    background: "0 0% 8%",
    foreground: "0 0% 96%",
    surface: "0 0% 8%",
    "on-surface": "0 0% 96%",
    "surface-variant": "0 0% 18%",
    "on-surface-variant": "0 0% 70%",
    "surface-lowest": "0 0% 6%",
    "surface-low": "0 0% 10%",
    "surface-container": "0 0% 13%",
    "surface-high": "0 0% 16%",
    "surface-highest": "0 0% 20%",
    outline: "0 0% 56%",
    "outline-variant": "0 0% 24%",
    primary: "0 0% 96%",
    "primary-foreground": "0 0% 7%",
    "primary-container": "0 0% 92%",
    "on-primary-container": "0 0% 7%",
    "secondary-container": "0 0% 18%",
    "on-secondary-container": "0 0% 96%",
  },
};

function getBackgroundTokens(settings: AppearanceSettings): ThemeTokens {
  if (settings.interfaceTheme === "simplyui") {
    return {
      "cloud-app-bg": "#141414",
      "cloud-bg-overlay":
        "linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0))",
    };
  }

  if (settings.backgroundTheme === "cloud-hour") {
    return getHourBackgroundTokens();
  }

  if (settings.backgroundTheme === "dynamic-background") {
    return {
      "cloud-app-bg":
        "linear-gradient(135deg, #090a0b 0%, #101314 52%, #050505 100%)",
      "cloud-bg-overlay": "linear-gradient(135deg, transparent, transparent)",
    };
  }

  if (
    settings.backgroundTheme === "custom-background" ||
    settings.backgroundTheme === "custom-video"
  ) {
    return {
      "cloud-app-bg": "#090909",
      "cloud-bg-overlay":
        "linear-gradient(180deg, rgba(0,0,0,0.24), rgba(0,0,0,0.42))",
    };
  }

  if (settings.backgroundTheme === "weather") {
    return {
      "cloud-app-bg":
        "linear-gradient(135deg, #15191f 0%, #0c1015 58%, #090909 100%)",
      "cloud-bg-overlay":
        "linear-gradient(135deg, rgba(160,190,220,0.12), rgba(255,255,255,0.035))",
    };
  }

  return {
    "cloud-app-bg":
      "linear-gradient(135deg, #1f1820 0%, #171113 48%, #090807 100%)",
    "cloud-bg-overlay":
      "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015))",
  };
}

function getHourBackgroundTokens(): ThemeTokens {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) {
    return {
      "cloud-app-bg":
        "linear-gradient(135deg, #f0a77a 0%, #9d75cf 48%, #3f4f91 100%)",
      "cloud-bg-overlay":
        "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))",
    };
  }

  if (hour >= 12 && hour < 18) {
    return {
      "cloud-app-bg":
        "linear-gradient(135deg, #7bb4ff 0%, #a76ee9 48%, #e26da2 100%)",
      "cloud-bg-overlay":
        "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
    };
  }

  return {
    "cloud-app-bg":
      "linear-gradient(135deg, #21152b 0%, #14111e 50%, #07070b 100%)",
    "cloud-bg-overlay":
      "linear-gradient(135deg, rgba(140,90,255,0.11), rgba(255,255,255,0.025))",
  };
}

function getAccentColors(settings: AppearanceSettings): ThemeTokens {
  const source =
    settings.colorTheme === "dynamic-colors"
      ? settings.dynamicColors
      : settings.colorTheme === "custom-colors"
        ? settings.customColors
        : defaultSettings.customColors;

  return {
    "cloud-accent": source.primary,
    "cloud-accent-2": source.secondary,
    "cloud-accent-text": source.accent,
    "cloud-accent-soft": hexToRgba(source.primary, 0.18),
    "cloud-accent-ring": hexToRgba(source.primary, 0.36),
  };
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
