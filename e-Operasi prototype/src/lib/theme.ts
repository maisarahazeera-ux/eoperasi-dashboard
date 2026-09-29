import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "theme";

/** Saved choice, otherwise the computer's own light/dark setting. */
export function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* ignore */ }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

/** Current theme + a toggle. The choice is remembered in this browser. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}
