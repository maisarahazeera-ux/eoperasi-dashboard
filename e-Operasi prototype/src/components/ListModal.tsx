// Floating list window: opens over the page (page stays visible but blurred).
// Used when a summary card is clicked, e.g. "Jumlah Sekolah" → school list.
import { useEffect, useMemo, useState } from "react";
import "./ListModal.css";
import { X, Crown } from "lucide-react";
import { useLanguage, type DictKey } from "../context/LanguageContext";
import type { Teacher } from "../lib/api";
import type { Report, ReportTable } from "../lib/report";
import { shortSchoolName } from "../lib/schoolName";
import { schoolTypeChip, NAVY } from "../lib/colors";
import { pgbRole } from "../lib/pgb";
import ReportButton from "./ReportButton";
import { ListToolbar, ListFooter, usePager } from "./ListControls";
import { PillToggle, type Tone } from "./ui";
import { fixMonth } from "../lib/dates";

/* ------------------------------------------------------------------ shell */

export function ListModal({ title, sub, icon, tone = "blue", onClose, children }: {
  title: string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: Tone;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="list-overlay" onMouseDown={onClose}>
      <div className="list-modal" role="dialog" aria-modal="true" aria-labelledby="list-modal-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="list-modal-head">
          {icon && (
            <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: `var(--tint-${tone})`, color: `var(--ink-${tone})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {icon}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="list-modal-title" style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{title}</h2>
            {sub && <div style={{ fontSize: 12, color: "var(--soft-muted)", marginTop: 2 }}>{sub}</div>}
          </div>
          <button type="button" className="soft-pill icon-btn" onClick={onClose} aria-label={t("lsClose")} title={t("lsClose")} autoFocus>
            <X size={16} />
          </button>
        </div>
        <div className="list-modal-body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ teachers */

const YEAR_MS = 365.25 * 864e5;

/**
 * List of teachers behind a card ("Jumlah Guru", "Bersara Dalam 1 Tahun", ...).
 * kind "retire" adds the retirement date and time remaining.
 */
export function TeacherListModal({ title, sub, icon, tone, teachers, kind = "general", filters = [], onClose }: {
  title: string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: Tone;
  teachers: Teacher[];
  kind?: "general" | "retire";
  /** Page filters, written into the downloaded file. */
  filters?: string[];
  onClose: () => void;
}) {
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const [query, setQuery] = useState("");
  const now = useMemo(() => Date.now(), []);

  const yearsLeft = (x: Teacher) => (x.retirementDate ? (new Date(x.retirementDate).getTime() - now) / YEAR_MS : Infinity);
  const remaining = (y: number) => {
    if (y < 0) return t("psPastDate");
    if (y < 1) { const n = Math.max(1, Math.round(y * 12)); return `${n} ${n === 1 ? t("psMonth1") : t("psMonths")}`; }
    return `${y.toFixed(1)} ${t("psYears")}`;
  };
  const fmtDate = (d: string | null) =>
    d ? fixMonth(new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })) : "-";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = teachers.filter((x) => !q || [x.name, x.school, shortSchoolName(x.school), x.schoolCode, x.position, x.gredPenyandang]
      .some((v) => v?.toLowerCase().includes(q)));
    return kind === "retire"
      ? [...list].sort((a, b) => (a.retirementDate ?? "9").localeCompare(b.retirementDate ?? "9"))
      : [...list].sort((a, b) => a.school.localeCompare(b.school) || a.name.localeCompare(b.name));
  }, [teachers, query, kind]);
  const pager = usePager(rows.length, rows);

  const headers: DictKey[] = kind === "retire"
    ? ["psColName", "psColSchool", "psColType", "psColGrade", "psColPosition", "psColDate", "psColRemaining"]
    : ["psColName", "psColSchool", "psColType", "psColGrade", "psColPosition"];

  const buildReport = (): Report => {
    const table: ReportTable = {
      name: title.slice(0, 31), title: `${title} (${rows.length.toLocaleString(locale)})`,
      columns: [
        { header: t("psColName"), width: 36 }, { header: t("slColCode"), width: 11 }, { header: t("psColSchool"), width: 40 },
        { header: t("psColType"), width: 9 }, { header: t("psColGrade"), width: 9 }, { header: t("psColPosition"), width: 34 },
        ...(kind === "retire" ? [{ header: t("psColDate"), width: 13, format: "date" as const }, { header: t("psColRemaining"), width: 22 }] : []),
      ],
      rows: rows.map((x) => [
        x.name, x.schoolCode || null, x.school, x.schoolType, x.gredPenyandang, x.position,
        ...(kind === "retire" ? [x.retirementDate, remaining(yearsLeft(x))] : []),
      ]),
    };
    return { title, filters: [...(query.trim() ? [`${t("rpSearch")}: ${query.trim()}`] : []), ...filters], tables: [table] };
  };

  return (
    <ListModal title={title} sub={sub ?? `${teachers.length.toLocaleString(locale)} ${t("ovTeachersWord")}`} icon={icon} tone={tone} onClose={onClose}>
      <ListToolbar
        search={{ value: query, onChange: setQuery, placeholder: t("tlSearch") }}
        pager={pager}
        download={rows.length > 0 && <ReportButton formats={["excel", "csv"]} getReport={buildReport} title={t("rpThisList")} />}
      />
      <div className="list-modal-table">
        <table className="soft-table">
          <thead>
            <tr>{headers.map((h) => <th key={h}>{t(h)}</th>)}</tr>
          </thead>
          <tbody>
            {pager.slice(rows).map((x) => {
              const y = yearsLeft(x);
              const role = pgbRole(x);
              return (
                <tr key={x.id}>
                  <td style={{ fontWeight: 600, fontSize: 12.5 }}>{x.name}</td>
                  <td style={{ fontSize: 12, color: "var(--soft-muted)", whiteSpace: "nowrap" }} title={x.school}>
                    {x.schoolCode && <span style={{ fontFamily: "monospace", marginRight: 6 }}>{x.schoolCode}</span>}
                    {shortSchoolName(x.school)}
                  </td>
                  <td><span style={schoolTypeChip(x.schoolType)}>{x.schoolType}</span></td>
                  <td style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>{x.gredPenyandang || "-"}</td>
                  <td style={{ fontSize: 12, color: "var(--soft-text-2)", maxWidth: 240 }} title={x.position ?? ""}>
                    {role
                      ? <span className="tag tag-warn" style={{ whiteSpace: "nowrap" }}><Crown size={11} /> {role}</span>
                      : <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.position || "-"}</div>}
                  </td>
                  {kind === "retire" && <>
                    <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(x.retirementDate)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className={`tag ${y < 0 ? "tag-err" : y <= 1 ? "tag-warn" : "tag-info"}`}>{remaining(y)}</span>
                    </td>
                  </>}
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={headers.length} style={{ padding: 32, textAlign: "center", color: "var(--soft-faint)", fontSize: 13 }}>{t("cgNoRecords")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <ListFooter pager={pager} />
    </ListModal>
  );
}

/* ------------------------------------------------------------------ schools */

interface SchoolRow {
  code: string;
  name: string;
  type: string;
  teachers: number;
  head: Teacher | null;
}

/** Every school in the data: code, name, type, number of teachers, Pengetua / Guru Besar. */
export function SchoolListModal({ teachers, icon, filters = [], onClose }: {
  teachers: Teacher[];
  icon?: React.ReactNode;
  filters?: string[];
  onClose: () => void;
}) {
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const nf = (n: number) => n.toLocaleString(locale);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");

  const schools = useMemo(() => {
    const map = new Map<string, SchoolRow>();
    for (const x of teachers) {
      let s = map.get(x.school);
      if (!s) { s = { code: x.schoolCode || "", name: x.school, type: x.schoolType, teachers: 0, head: null }; map.set(x.school, s); }
      s.teachers++;
      if (!s.head && pgbRole(x)) s.head = x;
    }
    return [...map.values()].sort((a, b) => (a.code || "~").localeCompare(b.code || "~") || a.name.localeCompare(b.name));
  }, [teachers]);

  const types = useMemo(() => [...new Set(schools.map((s) => s.type))].sort(), [schools]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schools.filter((s) => (!type || s.type === type) &&
      (!q || [s.code, s.name, shortSchoolName(s.name), s.head?.name].some((v) => v?.toLowerCase().includes(q))));
  }, [schools, query, type]);
  const pager = usePager(rows.length, rows);

  const buildReport = (): Report => ({
    title: t("slTitle"),
    filters: [
      ...(type ? [`${t("psColType")}: ${type}`] : []),
      ...(query.trim() ? [`${t("rpSearch")}: ${query.trim()}`] : []),
      ...filters,
    ],
    tables: [{
      name: t("slTitle"), title: `${t("slTitle")} (${nf(rows.length)})`,
      columns: [
        { header: t("slColCode"), width: 11 }, { header: t("slColName"), width: 44 }, { header: t("psColType"), width: 9 },
        { header: t("slColTeachers"), width: 11, format: "int" }, { header: t("slColHead"), width: 36 }, { header: t("slColHeadRole"), width: 24 },
      ],
      rows: rows.map((s) => [s.code || null, s.name, s.type, s.teachers, s.head?.name ?? null, s.head ? pgbRole(s.head) : null]),
      totalColumns: [3],
    }],
  });

  return (
    <ListModal title={t("slTitle")} sub={`${nf(schools.length)} ${t("slSchoolsWord")} · ${nf(teachers.length)} ${t("ovTeachersWord")}`} icon={icon} tone="teal" onClose={onClose}>
      <ListToolbar
        search={{ value: query, onChange: setQuery, placeholder: t("slSearch") }}
        pager={pager}
        filters={
          <PillToggle<string>
            value={type}
            onChange={setType}
            options={[{ value: "", label: t("sjAll") }, ...types.map((ty) => ({ value: ty, label: ty }))]}
          />
        }
        download={rows.length > 0 && <ReportButton formats={["excel", "csv"]} getReport={buildReport} title={t("rpThisList")} />}
      />
      <div className="list-modal-table">
        <table className="soft-table">
          <thead>
            <tr>
              <th>{t("slColCode")}</th>
              <th>{t("slColName")}</th>
              <th>{t("psColType")}</th>
              <th style={{ textAlign: "right" }}>{t("slColTeachers")}</th>
              <th>{t("slColHead")}</th>
            </tr>
          </thead>
          <tbody>
            {pager.slice(rows).map((s) => (
              <tr key={s.name}>
                <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--soft-text-2)", whiteSpace: "nowrap" }}>{s.code || "-"}</td>
                <td style={{ fontWeight: 600, fontSize: 12.5 }}>{s.name}</td>
                <td><span style={schoolTypeChip(s.type)}>{s.type}</span></td>
                <td style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{nf(s.teachers)}</td>
                <td style={{ fontSize: 12 }}>
                  {s.head
                    ? <><div style={{ fontWeight: 600 }}>{s.head.name}</div><div style={{ color: "var(--soft-muted)", fontSize: 11.5 }}>{pgbRole(s.head)}</div></>
                    : <span style={{ color: "var(--soft-faint)" }}>{t("slNoHead")}</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--soft-faint)", fontSize: 13 }}>{t("cgNoRecords")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <ListFooter pager={pager} />
    </ListModal>
  );
}
