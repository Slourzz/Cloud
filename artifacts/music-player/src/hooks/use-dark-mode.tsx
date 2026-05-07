import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface DarkModeContextValue {
  isDark: boolean;
  toggleDark: () => void;
}

const DarkModeContext = createContext<DarkModeContextValue>({ isDark: true, toggleDark: () => {} });

export function DarkModeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem("cloud-mode") !== "light";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    try {
      localStorage.setItem("cloud-mode", isDark ? "dark" : "light");
    } catch {}
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
