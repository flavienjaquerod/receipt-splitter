"use client";

import { useState, useEffect, createContext, useContext } from "react";

const DarkModeContext = createContext();

export function DarkModeProvider({ children }) {
  // null = not initialized yet
  const [isDarkMode, setIsDarkMode] = useState(null);

  // On mount, sync with localStorage or system preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("darkMode");
      let mode;
      if (saved !== null) {
        mode = JSON.parse(saved);
      } else {
        mode = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }
      setIsDarkMode(mode);

      // Apply immediately
      document.documentElement.classList.toggle("dark", mode);
    } catch (_) {
      setIsDarkMode(false);
    }
  }, []);

  // Keep in sync if toggled
  useEffect(() => {
    if (isDarkMode === null) return;
    document.documentElement.classList.toggle("dark", isDarkMode);
    localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error("useDarkMode must be used within a DarkModeProvider");
  }
  return context;
}
