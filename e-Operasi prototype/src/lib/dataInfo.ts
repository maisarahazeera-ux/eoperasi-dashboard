import { useEffect, useState } from "react";
import { getDataInfo, type DataInfo } from "./api";
import { useAuth } from "../context/AuthContext";

// Fallback only: used until the first upload through Admin > Kemas Kini Data.
// After that, the date comes from the database (the latest upload).
export const DATA_DATE = "2026-09-02";

/** How often open pages check whether an admin uploaded new data. */
const CHECK_EVERY_MS = 2 * 60 * 1000;

let cached: DataInfo | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<(d: DataInfo) => void>();

/** Called on first load, and by the Kemas Kini Data page after a successful upload. */
export function setDataInfo(info: DataInfo) {
  cached = info;
  listeners.forEach((l) => l(info));
}

function loadOnce(token: string) {
  if (cached || inFlight) return;
  inFlight = getDataInfo(token).then((r) => {
    inFlight = null;
    if (r.ok) setDataInfo(r.data);
  });
}

/** Date of the SEPADU data currently in the system (yyyy-mm-dd). */
export function useDataDate(): string {
  const { token } = useAuth();
  const [info, setInfo] = useState<DataInfo | null>(cached);

  useEffect(() => {
    listeners.add(setInfo);
    if (token) loadOnce(token);
    return () => { listeners.delete(setInfo); };
  }, [token]);

  return info?.dataDate ?? DATA_DATE;
}

/**
 * Checks every 2 minutes, and whenever the user comes back to the tab, whether
 * newer data was uploaded than the data this page is showing. Returns the newer
 * upload's info, or null.
 */
export function useNewerDataInfo(): DataInfo | null {
  const { token } = useAuth();
  const [newer, setNewer] = useState<DataInfo | null>(null);

  useEffect(() => {
    if (!token) return;
    loadOnce(token);
    let lastCheck = Date.now();
    const check = async () => {
      if (!cached) return;
      lastCheck = Date.now();
      const r = await getDataInfo(token);
      if (r.ok && r.data.importId != null && r.data.importId !== cached.importId) setNewer(r.data);
    };
    const id = window.setInterval(check, CHECK_EVERY_MS);
    // Also check straight away when the user comes back to this tab
    // (at most once every 15 seconds, so switching tabs quickly costs nothing).
    const onBack = () => {
      if (document.visibilityState === "visible" && Date.now() - lastCheck > 15_000) check();
    };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    // After this tab's own upload, the cache already has the new id: hide the banner.
    const onChange = (d: DataInfo) => setNewer((n) => (n && n.importId === d.importId ? null : n));
    listeners.add(onChange);
    return () => {
      window.clearInterval(id);
      listeners.delete(onChange);
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("focus", onBack);
    };
  }, [token]);

  return newer;
}
