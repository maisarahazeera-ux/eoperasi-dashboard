import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UploadCloud, FileText, X, CheckCircle2, AlertTriangle, XCircle, Loader2, History,
  Users, School, BookOpen, UserPlus, UserMinus, DatabaseZap, Info,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage, type DictKey } from "../context/LanguageContext";
import {
  previewData, importData, getDataHistory,
  type DataPreview, type DataIssue, type DataImportRecord,
} from "../lib/api";
import { setDataInfo } from "../lib/dataInfo";
import { clearTeachersCache } from "../lib/useTeachers";
import PageHero from "../components/PageHero";
import ConfirmDialog from "../components/ConfirmDialog";
import { StatTile, StatRow, type Tone } from "../components/ui";
import { ListToolbar, ListFooter, usePager } from "../components/ListControls";
import { fixMonth } from "../lib/dates";

const MAX_FILES = 4;
const ACCEPT = ".txt,.xlsx";

// Problem codes sent by the API (see SepaduParser.cs / DataController.cs).
const ERROR_CODES = ["noFiles", "tooManyFiles", "unsupportedType", "unreadable", "noRows", "missingColumns", "noTeachers", "noDataDate", "futureDataDate"];
const WARN_CODES = ["schoolTypeMissing", "skippedNoIc", "skippedNoName", "skippedNoSchool", "duplicateIc", "badDates", "missingOptionalColumns"];

/** "20260902_sepadu_maklumat_guru-SK.txt" -> "2026-09-02" (same rule as the API). */
function dateFromFileName(name: string): string | null {
  const m = name.match(/(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d)/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  return isNaN(d.getTime()) ? null : `${m[1]}-${m[2]}-${m[3]}`;
}

function fmt(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type Banner = { kind: "ok" | "err"; text: string } | null;

export default function KemaskiniData() {
  const { token } = useAuth();
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const nf = (n: number) => n.toLocaleString(locale);
  const fmtDate = (iso: string | null) =>
    iso ? fixMonth(new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })) : "-";
  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString(locale, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const [files, setFiles] = useState<File[]>([]);
  const [dataDate, setDataDate] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<DataPreview | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [history, setHistory] = useState<DataImportRecord[] | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Local date (toISOString would give yesterday's date before 8 a.m. in Malaysia).
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const loadHistory = useCallback(() => {
    getDataHistory(token).then((r) => setHistory(r.ok ? r.data : []));
  }, [token]);
  useEffect(loadHistory, [loadHistory]);

  // Upload history list: search by uploader, file name or data date.
  const historyShown = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return (history ?? []).filter((h) => !q || [h.importedByName, h.importedBy, h.fileNames, h.dataDate, fmtDate(h.dataDate)]
      .some((v) => v?.toLowerCase().includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, historyQuery, locale]);
  const historyPager = usePager(historyShown.length, historyShown);
  const currentId = history?.[0]?.id;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    setFiles((prev) => {
      const byName = new Map(prev.map((f) => [f.name, f]));
      for (const f of picked) byName.set(f.name, f);
      return Array.from(byName.values()).slice(0, MAX_FILES);
    });
    // Fill the date from the file name, unless the admin already typed one.
    const found = picked.map((f) => dateFromFileName(f.name)).find(Boolean);
    if (found) setDataDate((d) => d || found);
    setPreview(null);
    setBanner(null);
  }

  function removeFile(name: string) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
    setPreview(null);
  }

  function clearAll() {
    setFiles([]);
    setDataDate("");
    setPreview(null);
    setBanner(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function check() {
    setChecking(true);
    setBanner(null);
    const r = await previewData(token, files);
    setChecking(false);
    if (r.status === 0 || !r.data) {
      setPreview(null);
      setBanner({ kind: "err", text: t("kdServerError") });
      return;
    }
    setPreview(r.data);
    if (!dataDate && r.data.detectedDataDate) setDataDate(r.data.detectedDataDate);
  }

  async function runImport() {
    setConfirming(false);
    setImporting(true);
    setBanner(null);
    const r = await importData(token, files, dataDate);
    setImporting(false);
    if (r.status === 200 && r.data?.info) {
      const info = r.data.info;
      setDataInfo(info);
      clearTeachersCache();
      setBanner({ kind: "ok", text: fmt(t("kdSuccess"), { count: nf(info.teacherCount), date: fmtDate(info.dataDate) }) });
      setFiles([]);
      setDataDate("");
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      loadHistory();
      return;
    }
    if (r.data?.preview) setPreview(r.data.preview);
    setBanner({ kind: "err", text: r.status === 0 ? t("kdServerError") : t("kdFailed") });
  }

  function issueText(issue: DataIssue, kind: "err" | "warn") {
    const codes = kind === "err" ? ERROR_CODES : WARN_CODES;
    if (!codes.includes(issue.code)) return issue.code;
    const key = `${kind === "err" ? "kdErr_" : "kdWarn_"}${issue.code}` as DictKey;
    return fmt(t(key), { file: issue.file ?? "", count: nf(issue.count), details: issue.details.join(", ") });
  }

  const busy = checking || importing;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(dataDate) && dataDate <= today;
  const canImport = !!preview?.ok && dateValid && !busy;

  return (
    <main style={{ height: "100%", overflowY: "auto", background: "var(--mac-bg)", padding: "0 0 32px" }}>
      <PageHero title={t("titleKemaskiniData")} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 32px", display: "flex", flexDirection: "column", gap: 16 }}>

        {banner && (
          <div className="card" role="status" style={{
            padding: "14px 18px", display: "flex", gap: 10, alignItems: "center", fontSize: 13.5, fontWeight: 600,
            background: banner.kind === "ok" ? "var(--ok-bg)" : "var(--bad-bg)",
            color: banner.kind === "ok" ? "var(--ok-ink)" : "var(--bad-ink)",
          }}>
            {banner.kind === "ok" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            {banner.text}
          </div>
        )}

        {/* 1. Upload */}
        <Section icon={<UploadCloud size={18} />} tone="blue" title={t("kdUploadTitle")} sub={t("kdUploadSub")}>
          <ol style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", listStyle: "none", margin: "0 0 14px", padding: "9px 12px", fontSize: 12, color: "var(--soft-text-2)", background: "var(--surface-2)", borderRadius: 10 }}>
            {(["kdStep1", "kdStep2", "kdStep3"] as const).map((k, i) => (
              <li key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 18, height: 18, borderRadius: 999, background: "var(--tint-blue)", color: "var(--ink-blue)", fontSize: 10.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                {t(k)}
              </li>
            ))}
          </ol>

          <div
            role="button"
            tabIndex={0}
            onClick={() => !busy && inputRef.current?.click()}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !busy) { e.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!busy) addFiles(e.dataTransfer.files); }}
            style={{
              border: `2px dashed ${dragOver ? "var(--soft-accent)" : "var(--soft-line)"}`,
              background: dragOver ? "var(--tint-blue)" : "var(--surface)",
              borderRadius: 14, padding: "26px 16px", textAlign: "center",
              cursor: busy ? "not-allowed" : "pointer", transition: "border-color .15s, background .15s",
            }}
          >
            <UploadCloud size={28} color="var(--soft-accent)" style={{ display: "block", margin: "0 auto" }} />
            <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 6, color: "var(--soft-text)" }}>{t("kdDrop")}</div>
            <div style={{ fontSize: 11.5, color: "var(--soft-muted)", marginTop: 3 }}>{t("kdDropHint")}</div>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPT} multiple onChange={(e) => addFiles(e.target.files)} style={{ display: "none" }} />

          {files.length > 0 && (
            <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {files.map((f) => {
                const summary = preview?.files.find((x) => x.fileName === f.name);
                return (
                  <li key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", border: "1px solid var(--soft-line)", borderRadius: 10, fontSize: 12.5 }}>
                    <FileText size={16} color="var(--ink-blue)" style={{ flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{f.name}</span>
                    <span style={{ color: "var(--soft-faint)", flexShrink: 0 }}>{fileSize(f.size)}</span>
                    {summary && (
                      <span style={{ color: "var(--soft-muted)", flexShrink: 0 }}>
                        · {nf(summary.rows)} {t("kdRows")} · {Object.keys(summary.schoolTypes).join(", ")}
                      </span>
                    )}
                    <button type="button" onClick={() => removeFile(f.name)} disabled={busy} title={t("kdRemove")} aria-label={`${t("kdRemove")} ${f.name}`}
                      style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--soft-muted)", display: "flex", padding: 2 }}>
                      <X size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div style={{ display: "flex", gap: 14, alignItems: "flex-end", marginTop: 16, flexWrap: "wrap" }}>
            <label style={{ display: "block", flex: "0 1 260px" }}>
              <div className="filter-label">{t("kdDataDate")} <span style={{ color: "var(--bad-ink)" }}>*</span></div>
              <input type="date" value={dataDate} max={today} onChange={(e) => setDataDate(e.target.value)} disabled={busy} />
            </label>
            <div style={{ fontSize: 11.5, color: "var(--soft-muted)", flex: "1 1 220px", paddingBottom: 8 }}>{t("kdDataDateHint")}</div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            {(files.length > 0 || dataDate) && (
              <button type="button" className="soft-pill" onClick={clearAll} disabled={busy}>{t("kdClear")}</button>
            )}
            <button type="button" className="soft-pill primary" onClick={check} disabled={files.length === 0 || busy}>
              {checking ? <><Loader2 size={14} className="spin" /> {t("kdChecking")}</> : t("kdCheck")}
            </button>
          </div>
        </Section>

        {/* 2. Check results */}
        {preview && (
          <Section
            icon={preview.ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            tone={preview.ok ? "teal" : "rose"}
            title={preview.ok ? t("kdPreviewTitle") : t("kdPreviewFailed")}
            sub={preview.ok ? t("kdPreviewSub") : ""}
          >
            {preview.errors.length > 0 && (
              <IssueList kind="err" items={preview.errors.map((e) => issueText(e, "err"))} />
            )}

            {preview.ok && (
              <>
                <StatRow>
                  <StatTile icon={<Users size={20} />} tone="blue" label={t("kdTeachers")} value={nf(preview.teacherCount)}
                    note={`${t("kdNowPrefix")} ${nf(preview.currentTeacherCount)}`} />
                  <StatTile icon={<School size={20} />} tone="violet" label={t("kdSchools")} value={nf(preview.schoolCount)} />
                  <StatTile icon={<BookOpen size={20} />} tone="amber" label={t("kdSubjects")} value={nf(preview.subjectCount)} />
                </StatRow>
                {preview.currentTeacherCount > 0 && (
                  <StatRow>
                    <StatTile icon={<UserPlus size={20} />} tone="teal" label={t("kdNewTeachers")} value={preview.newTeachers ? `+${nf(preview.newTeachers)}` : "0"} note={t("kdNewTeachersNote")} />
                    <StatTile icon={<UserMinus size={20} />} tone="rose" label={t("kdRemovedTeachers")} value={preview.removedTeachers ? `−${nf(preview.removedTeachers)}` : "0"} note={t("kdRemovedTeachersNote")} />
                  </StatRow>
                )}

                <div className="filter-label" style={{ marginTop: 4 }}>{t("kdByType")}</div>
                <div style={{ border: "1px solid var(--soft-line)", borderRadius: 12, overflow: "auto", marginBottom: 14 }}>
                  <table className="soft-table">
                    <thead>
                      <tr>
                        <th>{t("kdColType")}</th>
                        <th style={{ textAlign: "right" }}>{t("kdColNow")}</th>
                        <th style={{ textAlign: "right" }}>{t("kdColNew")}</th>
                        <th style={{ textAlign: "right" }}>{t("kdColDiff")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.byType.map((r) => {
                        const diff = r.incoming - r.current;
                        const dropped = r.current > 0 && r.incoming === 0;
                        return (
                          <tr key={r.schoolType} style={dropped ? { background: "var(--bad-bg)" } : undefined}>
                            <td style={{ fontWeight: 600 }}>{r.schoolType || "-"}</td>
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{nf(r.current)}</td>
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{nf(r.incoming)}</td>
                            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: diff < 0 ? "var(--bad-ink)" : diff > 0 ? "var(--ok-ink)" : "var(--soft-faint)" }}>
                              {diff > 0 ? `+${nf(diff)}` : diff < 0 ? `−${nf(-diff)}` : "0"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {preview.warnings.length > 0 && (
                  <IssueList kind="warn" title={t("kdWarnings")} items={preview.warnings.map((w) => issueText(w, "warn"))} />
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--soft-text-2)", marginRight: "auto" }}>
                    <Info size={14} style={{ flexShrink: 0 }} /> {t("kdReplaceNote")}
                  </span>
                  {!dateValid && <span style={{ fontSize: 12, color: "var(--bad-ink)" }}>{dataDate > today ? t("kdErr_futureDataDate") : t("kdErr_noDataDate")}</span>}
                  <button type="button" className="soft-pill primary" onClick={() => setConfirming(true)} disabled={!canImport}>
                    {importing ? <><Loader2 size={14} className="spin" /> {t("kdImporting")}</> : <><DatabaseZap size={14} /> {t("kdConfirmBtn")}</>}
                  </button>
                </div>
              </>
            )}
          </Section>
        )}

        {/* 3. History */}
        <Section icon={<History size={18} />} tone="violet" title={t("kdHistoryTitle")} sub={t("kdHistorySub")}>
          {history === null ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 16 }}><Loader2 size={18} className="spin" color="var(--soft-accent)" /></div>
          ) : history.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--soft-muted)", padding: "6px 0" }}>{t("kdHistoryEmpty")}</div>
          ) : (
            <>
            <ListToolbar search={{ value: historyQuery, onChange: setHistoryQuery, placeholder: t("kdSearchHistory") }} pager={historyPager} />
            <div style={{ border: "1px solid var(--soft-line)", borderRadius: 12, overflow: "auto" }}>
              <table className="soft-table">
                <thead>
                  <tr>
                    <th>{t("kdColDataDate")}</th>
                    <th>{t("kdColUploaded")}</th>
                    <th>{t("kdColBy")}</th>
                    <th style={{ textAlign: "right" }}>{t("kdTeachers")}</th>
                    <th>{t("kdColFiles")}</th>
                  </tr>
                </thead>
                <tbody>
                  {historyPager.slice(historyShown).map((h) => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                        {fmtDate(h.dataDate)}
                        {h.id === currentId && <span className="tag tag-ok" style={{ marginLeft: 8 }}>{lang === "en" ? "Current" : "Semasa"}</span>}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(h.importedAt)}</td>
                      <td>{h.importedByName || h.importedBy}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{nf(h.teacherCount)}</td>
                      <td style={{ fontSize: 11.5, color: "var(--soft-muted)", maxWidth: 280 }}>{h.fileNames}</td>
                    </tr>
                  ))}
                  {historyShown.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--soft-faint)", fontSize: 12.5 }}>{t("cgNoRecords")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <ListFooter pager={historyPager} />
            </>
          )}
        </Section>
      </div>

      {confirming && preview && (
        <ConfirmDialog
          icon={<DatabaseZap size={22} />}
          tone="amber"
          title={t("kdConfirmTitle")}
          message={fmt(t("kdConfirmText"), { old: nf(preview.currentTeacherCount), new: nf(preview.teacherCount), date: fmtDate(dataDate) })}
          confirmLabel={t("kdConfirmYes")}
          cancelLabel={t("cancel")}
          onConfirm={runImport}
          onCancel={() => setConfirming(false)}
        />
      )}
    </main>
  );
}

function Section({ icon, tone, title, sub, children }: { icon: React.ReactNode; tone: Tone; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "22px 26px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: `var(--tint-${tone})`, color: `var(--ink-${tone})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--soft-text)" }}>{title}</div>
          {sub && <div style={{ fontSize: 12, color: "var(--soft-muted)", marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function IssueList({ kind, title, items }: { kind: "err" | "warn"; title?: string; items: string[] }) {
  const err = kind === "err";
  return (
    <div style={{
      borderRadius: 12, padding: "12px 14px", marginBottom: 4,
      background: err ? "var(--err-bg)" : "var(--warn-bg)",
      border: `1px solid ${err ? "var(--err-line)" : "var(--warn-line)"}`,
      color: err ? "var(--err-ink)" : "var(--warn-ink)",
    }}>
      {title && <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={14} /> {title}</div>}
      <ul style={{ margin: 0, paddingLeft: title ? 20 : 0, listStyle: title ? "disc" : "none", display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, lineHeight: 1.5 }}>
        {items.map((text, i) => (
          <li key={i} style={title ? undefined : { display: "flex", gap: 7, alignItems: "flex-start" }}>
            {!title && <XCircle size={14} style={{ flexShrink: 0, marginTop: 3 }} />}
            <span style={{ wordBreak: "break-word" }}>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
