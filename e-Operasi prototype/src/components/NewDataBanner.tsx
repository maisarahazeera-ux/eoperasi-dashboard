import { useState } from "react";
import { RefreshCw, X, DatabaseZap } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useNewerDataInfo } from "../lib/dataInfo";
import { fixMonth } from "../lib/dates";

/**
 * Strip under the top menu when an admin has uploaded newer SEPADU data
 * than this page is showing. "Muat Semula" reloads the page with the new data.
 */
export default function NewDataBanner() {
  const { t, lang } = useLanguage();
  const newer = useNewerDataInfo();
  const [dismissedId, setDismissedId] = useState<number | null>(null);

  if (!newer || newer.importId === dismissedId) return null;

  const date = newer.dataDate
    ? fixMonth(new Date(`${newer.dataDate}T00:00:00`).toLocaleDateString(lang === "en" ? "en-GB" : "ms-MY", { day: "numeric", month: "short", year: "numeric" }))
    : "-";

  return (
    <div role="status" style={{
      display: "flex", alignItems: "center", gap: 10, padding: "9px 32px", flexShrink: 0,
      background: "var(--tint-blue)", color: "var(--ink-blue)", borderBottom: "1px solid var(--soft-line)", fontSize: 13, fontWeight: 600,
    }}>
      <DatabaseZap size={16} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{t("newDataBanner").replace("{date}", date)}</span>
      <button type="button" className="soft-pill small primary" onClick={() => window.location.reload()}>
        <RefreshCw size={13} /> {t("newDataReload")}
      </button>
      <button type="button" aria-label="×" onClick={() => setDismissedId(newer.importId)}
        style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex", padding: 4 }}>
        <X size={15} />
      </button>
    </div>
  );
}
