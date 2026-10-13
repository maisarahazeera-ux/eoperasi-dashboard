import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage, type DictKey } from "../context/LanguageContext";
import { listActivity, type ActivityItem, type ActivityCategory } from "../lib/api";
import PageHero from "../components/PageHero";
import { ListToolbar, ListFooter, usePager } from "../components/ListControls";

const ACTION_TAG: Record<string, "ok" | "warn" | "err" | "info" | "muted"> = {
  login: "ok",
  login_failed: "err",
  register: "info",
  verify_email: "info",
  password_change: "muted",
  password_reset: "muted",
  data_import: "warn",
  report_download: "info",
  user_approve: "ok",
  user_reject: "err",
  user_deactivate: "err",
  user_activate: "ok",
  user_role: "warn",
};

// The API writes a few fixed English phrases into "detail"; show them in BM too.
const DETAIL_MS: [RegExp, string][] = [
  [/\bWrong password\b/, "Kata laluan salah"],
  [/\bUnknown username\b/, "Username tidak wujud"],
  [/\bAccount unverified\b/, "Emel belum disahkan"],
  [/\bAccount pending\b/, "Menunggu kelulusan"],
  [/\bAccount deactivated\b/, "Akaun dinyahaktif"],
  [/\bNow active\b/, "Kini aktif"],
  [/\bNow pending\b/, "Kini menunggu kelulusan"],
  [/\bVia email link\b/, "Melalui pautan emel"],
  [/\bofficial email\b/, "emel rasmi"],
  [/\bother email\b/, "emel lain"],
  [/\bteachers\b/, "guru"],
  [/\brows\b/, "baris"],
];

/** Admin page: who did what, and when. */
export default function LogAktiviti() {
  const { token } = useAuth();
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";

  const [category, setCategory] = useState<ActivityCategory>("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<{ items: ActivityItem[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Search waits until typing pauses.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  // Paging is done by the server; the pager only keeps page / rows-per-page.
  const pager = usePager(data?.total ?? 0, `${category}|${debounced}|${from}|${to}`, 10);
  const { page, size } = pager;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listActivity(token, { category, q: debounced, from, to, page, pageSize: size }).then((r) => {
      if (cancelled) return;
      setLoading(false);
      if (r.ok) { setData(r.data); setLoadError(false); } else setLoadError(true);
    });
    return () => { cancelled = true; };
  }, [token, category, debounced, from, to, page, size]);

  const dirty = category || query || from || to;

  const detailText = (d: string) => (lang === "en" ? d : DETAIL_MS.reduce((s, [re, ms]) => s.replace(re, ms), d));
  // Only known actions have a label (an unknown key would break t()).
  const actionLabel = (a: string) => (a in ACTION_TAG ? t(`la_${a}` as DictKey) : a);

  const cats: { value: ActivityCategory; label: string }[] = [
    { value: "", label: t("laCatAll") },
    { value: "login", label: t("laCatLogin") },
    { value: "download", label: t("laCatDownload") },
    { value: "data", label: t("laCatData") },
    { value: "users", label: t("laCatUsers") },
    { value: "account", label: t("laCatAccount") },
  ];

  return (
    <main style={{ height: "100%", overflowY: "auto", background: "var(--mac-bg)", padding: "0 0 32px" }}>
      <PageHero title={t("titleLogAktiviti")} />
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px" }}>
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 12.5, color: "var(--soft-muted)", marginBottom: 14 }}>{t("laSub")}</div>

          <ListToolbar
            search={{ value: query, onChange: setQuery, placeholder: t("laSearch") }}
            pager={pager}
            pagerDisabled={loading}
            filters={
              <div role="group" aria-label={t("laColAction")} className="soft-seg">
                {cats.map((c) => (
                  <button key={c.value || "all"} type="button" className={category === c.value ? "on" : ""} aria-pressed={category === c.value} onClick={() => setCategory(c.value)}>
                    {c.label}
                  </button>
                ))}
              </div>
            }
          />
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
            <label style={{ width: 160 }}>
              <div className="filter-label">{t("laFrom")}</div>
              <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label style={{ width: 160 }}>
              <div className="filter-label">{t("laTo")}</div>
              <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </label>
            {dirty && (
              <button type="button" className="soft-pill small ghost" onClick={() => { setCategory(""); setQuery(""); setFrom(""); setTo(""); }}>
                <X size={12} /> {t("laClear")}
              </button>
            )}
            {loading && <Loader2 size={14} className="spin" color="var(--soft-accent)" style={{ marginBottom: 10 }} />}
          </div>

          {loadError ? (
            <div style={{ padding: 16, fontSize: 13, color: "var(--bad-ink)" }}>{t("laLoadError")}</div>
          ) : data === null ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Loader2 size={20} className="spin" color="var(--soft-accent)" /></div>
          ) : data.items.length === 0 ? (
            <div style={{ padding: "24px 8px", fontSize: 13, color: "var(--soft-muted)", textAlign: "center" }}>{t("laEmpty")}</div>
          ) : (
            <div style={{ border: "1px solid var(--soft-line)", borderRadius: 12, overflowX: "auto", opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
              <table className="soft-table" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th style={{ width: 150 }}>{t("laColTime")}</th>
                    <th style={{ width: 200 }}>{t("laColUser")}</th>
                    <th style={{ width: 190 }}>{t("laColAction")}</th>
                    <th>{t("laColDetail")}</th>
                    <th style={{ width: 120 }}>{t("laColIp")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((a) => (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                        {new Date(a.at).toLocaleString(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>{a.fullName || a.username || "-"}</div>
                        {a.username && <div style={{ fontSize: 11, color: "var(--soft-muted)" }}>@{a.username}</div>}
                      </td>
                      <td><span className={`tag tag-${ACTION_TAG[a.action] ?? "muted"}`}>{actionLabel(a.action)}</span></td>
                      <td style={{ fontSize: 12, color: "var(--soft-text-2)", wordBreak: "break-word" }}>{detailText(a.detail) || "-"}</td>
                      <td style={{ fontSize: 11.5, color: "var(--soft-muted)", fontVariantNumeric: "tabular-nums" }}>{a.ipAddress || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && <ListFooter pager={pager} disabled={loading} />}
        </div>
      </div>
    </main>
  );
}
