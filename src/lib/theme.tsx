"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type Theme = "light" | "dark";

const THEME_KEY = "wi-mall-theme";
const PRE_RENAME_THEME_KEY = "wimall-theme";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "light", toggle: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  // On mount: read from localStorage or system preference
  useEffect(() => {
    // THEME_KEY moved with the rename; PRE_RENAME_THEME_KEY is read once so a
    // returning visitor keeps the theme they chose, then dropped. The pre-paint
    // script in app/[locale]/layout.tsx reads the same pair — keep them in step.
    const stored = (localStorage.getItem(THEME_KEY) ??
      localStorage.getItem(PRE_RENAME_THEME_KEY)) as Theme | null;
    localStorage.removeItem(PRE_RENAME_THEME_KEY);
    const preferred: Theme =
      stored ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    setTheme(preferred);
    document.documentElement.classList.toggle("dark", preferred === "dark");
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      localStorage.setItem(THEME_KEY, next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
