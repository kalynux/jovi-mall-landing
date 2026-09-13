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
    // The stored theme lives in localStorage, which does not exist during the
    // server render — so it cannot be the useState initialiser without breaking SSR
    // or causing a hydration mismatch. The flash that would otherwise cause is
    // already handled by the pre-paint script in app/[locale]/layout.tsx, which sets
    // the class before first paint.
    //
    // ⚠ KNOWN EXCEPTION, NOT A DISMISSAL. The correct long-term form is
    //   useSyncExternalStore — a refactor of theme handling rather than a line
    //   change. Worth doing deliberately; not worth doing blind to satisfy a linter
    //   in the same change that put the site live.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
