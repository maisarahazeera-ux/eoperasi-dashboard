import { useEffect, useState } from "react";
import { getDataInfo, type DataInfo } from "./api";
import { useAuth } from "../context/AuthContext";

// Fallback only: used until the first upload through Admin > Kemas Kini Data.
// After that, the date comes from the database (the latest upload).
export const DATA_DATE = "2026-09-02";

let cached: DataInfo | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<(d: DataInfo) => void>();

/** Called by the Kemas Kini Data page after a successful upload. */
export function setDataInfo(info: DataInfo) {
  cached = info;
  listeners.forEach((l) => l(info));
}

/** Date of the SEPADU data currently in the system (yyyy-mm-dd). */
export function useDataDate(): string {
  const { token } = useAuth();
  const [info, setInfo] = useState<DataInfo | null>(cached);

  useEffect(() => {
    listeners.add(setInfo);
    if (!cached && token && !inFlight) {
      inFlight = getDataInfo(token).then((r) => {
        inFlight = null;
        if (r.ok) setDataInfo(r.data);
      });
    }
    return () => { listeners.delete(setInfo); };
  }, [token]);

  return info?.dataDate ?? DATA_DATE;
}
