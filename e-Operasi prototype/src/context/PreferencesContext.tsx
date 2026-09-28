import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";
import {
  getProfile, updatePreferences, parseTextSize, type Profile,
  TEXT_SIZE_DEFAULT, TEXT_SIZE_MIN, TEXT_SIZE_MAX,
} from "../lib/api";

function applyTextSize(pct: number) {
  const root = document.documentElement;
  root.style.setProperty("--app-zoom", String(pct / 100));
  // Lets the CSS hide optional top-bar items sooner when text is large.
  root.dataset.textSize = pct >= 108 ? "large" : "normal";
  try { localStorage.setItem("textSize", String(pct)); } catch { /* ignore */ }
}

function cachedTextSize(): number {
  try { return parseTextSize(localStorage.getItem("textSize")) ?? TEXT_SIZE_DEFAULT; } catch { return TEXT_SIZE_DEFAULT; }
}

interface PreferencesState {
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  /** Percentage of normal size, e.g. 100 = normal, 115 = 15% bigger. */
  textSize: number;
  setTextSize: (pct: number) => void;
}

const PreferencesContext = createContext<PreferencesState | undefined>(undefined);

/**
 * Loads the user's profile after login and applies their saved preferences
 * (language + text size). Changes are saved back to the account, so they
 * follow the user to any computer. A copy is kept in this browser so the
 * page doesn't flash the default size while the profile is loading.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const { lang, setLang } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [textSize, setTextSizeState] = useState<number>(cachedTextSize);
  // Skip saving the language change that we ourselves make when applying the profile.
  const applyingRef = useRef(false);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => { applyTextSize(textSize); }, [textSize]);

  // Load the profile whenever someone logs in.
  useEffect(() => {
    if (!token) { setProfile(null); return; }
    let cancelled = false;
    getProfile(token).then((r) => {
      if (cancelled || !r.ok) return;
      setProfile(r.data);
      const saved = parseTextSize(r.data.textSize);
      if (saved != null) setTextSizeState(saved);
      if (r.data.preferredLanguage && r.data.preferredLanguage !== lang) {
        applyingRef.current = true;
        setLang(r.data.preferredLanguage);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Save the language to the account whenever the BM/EN switch is used.
  useEffect(() => {
    if (applyingRef.current) { applyingRef.current = false; return; }
    if (!token || !profile || profile.preferredLanguage === lang) return;
    updatePreferences(token, { preferredLanguage: lang }).then((r) => { if (r.ok) setProfile(r.data); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Apply immediately while the slider moves; save once the user stops (0.5s).
  function setTextSize(pct: number) {
    const v = Math.min(TEXT_SIZE_MAX, Math.max(TEXT_SIZE_MIN, Math.round(pct)));
    setTextSizeState(v);
    window.clearTimeout(saveTimer.current);
    if (!token) return;
    saveTimer.current = window.setTimeout(() => {
      updatePreferences(token, { textSize: v }).then((r) => { if (r.ok) setProfile(r.data); });
    }, 500);
  }

  return (
    <PreferencesContext.Provider value={{ profile, setProfile, textSize, setTextSize }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}
