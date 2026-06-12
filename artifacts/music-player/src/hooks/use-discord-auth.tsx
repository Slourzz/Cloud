import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DiscordUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
};

type StoredDiscordSession = {
  token: string;
  user: DiscordUser;
  linkedAt?: string;
};

type DiscordAuthContextValue = {
  user: DiscordUser | null;
  token: string | null;
  linkedAt: string | null;
  isConnecting: boolean;
  error: string | null;
  login: () => Promise<DiscordUser>;
  logout: () => void;
  clearError: () => void;
};

const STORAGE_KEY = "cloud-discord-session-v1";
const DEFAULT_REVIEW_ENDPOINT =
  "https://cloud-production-4b12.up.railway.app/api/ttml/review";

function getServiceBaseUrl() {
  const reviewEndpoint =
    import.meta.env.VITE_TTML_REVIEW_ENDPOINT?.trim() ||
    DEFAULT_REVIEW_ENDPOINT;
  return reviewEndpoint.replace(/\/api\/ttml\/review\/?$/, "");
}

function readStoredSession(): StoredDiscordSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as Partial<StoredDiscordSession>;
    if (
      typeof session.token !== "string" ||
      !session.user ||
      typeof session.user.id !== "string" ||
      typeof session.user.displayName !== "string"
    ) {
      return null;
    }

    return session as StoredDiscordSession;
  } catch {
    return null;
  }
}

async function openExternal(url: string) {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

const DiscordAuthContext = createContext<DiscordAuthContextValue | null>(null);

export function DiscordAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredDiscordSession | null>(() =>
    readStoredSession(),
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveSession = useCallback(
    (nextSession: StoredDiscordSession | null) => {
      setSession(nextSession);
      if (nextSession) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    },
    [],
  );

  useEffect(() => {
    if (!session?.token) return;

    const validateSession = async () => {
      try {
        const response = await fetch(
          `${getServiceBaseUrl()}/api/auth/discord/me`,
          {
            headers: {
              Authorization: `Bearer ${session.token}`,
            },
          },
        );
        if (!response.ok) saveSession(null);
      } catch {
        // Keep the remembered session while the service is temporarily offline.
      }
    };

    void validateSession();
  }, [session?.token, saveSession]);

  const login = useCallback(async () => {
    if (session?.user) return session.user;

    setIsConnecting(true);
    setError(null);

    try {
      const startResponse = await fetch(
        `${getServiceBaseUrl()}/api/auth/discord/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      const startData = (await startResponse.json().catch(() => null)) as {
        state?: string;
        authorizeUrl?: string;
        error?: string;
      } | null;

      if (!startResponse.ok || !startData?.state || !startData.authorizeUrl) {
        if (
          startResponse.status === 503 &&
          startData?.error?.includes("Discord OAuth is not configured")
        ) {
          throw new Error(
            "La conexion con Discord aun no esta activada en el servidor de Cloud.",
          );
        }
        throw new Error(
          startData?.error || "No se pudo iniciar la conexion con Discord.",
        );
      }

      await openExternal(startData.authorizeUrl);

      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const response = await fetch(
          `${getServiceBaseUrl()}/api/auth/discord/session/${startData.state}`,
        );
        if (!response.ok) continue;

        const result = (await response.json()) as {
          status?: string;
          token?: string;
          user?: DiscordUser;
        };
        if (result.status === "complete" && result.token && result.user) {
          saveSession({
            token: result.token,
            user: result.user,
            linkedAt: new Date().toISOString(),
          });
          return result.user;
        }
      }

      throw new Error(
        "La conexion con Discord tardo demasiado. Intentalo nuevamente.",
      );
    } catch (loginError) {
      const message =
        loginError instanceof Error
          ? loginError.message
          : "No se pudo conectar Discord.";
      setError(message);
      throw new Error(message);
    } finally {
      setIsConnecting(false);
    }
  }, [session?.user, saveSession]);

  const logout = useCallback(() => {
    saveSession(null);
    setError(null);
  }, [saveSession]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo<DiscordAuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      linkedAt: session?.linkedAt ?? null,
      isConnecting,
      error,
      login,
      logout,
      clearError,
    }),
    [session, isConnecting, error, login, logout, clearError],
  );

  return (
    <DiscordAuthContext.Provider value={value}>
      {children}
    </DiscordAuthContext.Provider>
  );
}

export function useDiscordAuth() {
  const context = useContext(DiscordAuthContext);
  if (!context) {
    throw new Error("useDiscordAuth must be used inside DiscordAuthProvider");
  }
  return context;
}
