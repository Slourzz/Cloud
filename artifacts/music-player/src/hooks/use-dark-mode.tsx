import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface DarkModeContextValue {
  isDark: boolean;
  toggleDark: () => void;
}

const DarkModeContext = createContext<DarkModeContextValue>({ isDark: false, toggleDark: () => {} });

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    try { return localStorage.getItem("soundscape-dark") === "1"; } catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try { localStorage.setItem("soundscape-dark", isDark ? "1" : "0"); } catch {}
  }, [isDark]);

  const toggleDark = () => setIsDark((d) => !d);

  return (
    <DarkModeContext.Provider value={{ isDark, toggleDark }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  return useContext(DarkModeContext);
}
