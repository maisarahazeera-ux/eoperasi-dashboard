import { useState, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Loader2, Search } from "lucide-react";
import FilterSidebar, { DEFAULT_FILTERS, type Filters } from "../lib/FilterSidebar";
import { useTeachers, useTeacherLookups } from "../lib/useTeachers";
import { type Teacher } from "../lib/api";
import { NAVY, TEAL, ORANGE, schoolTypeChip } from "../lib/colors";
import { shortSchoolName } from "../lib/schoolName";
import { clean } from "../lib/labels";
import { matchOpsyen, type MatchStatus, type MatchResult } from "../lib/subjectFamilies";
import { useLanguage, type DictKey } from "../context/LanguageContext";

type MatchFilter = "Semua" | MatchStatus;
type LoadKind = "all" | "high" | "low";

function totalWaktu(x: Teacher): number {
  return x.subjects.reduce((sum, s) => sum + s.hours, 0);
}

// Placeholder thresholds carried over from the prototype. Confirm the
// official normal teaching-load range with the supervisor.
const WAKTU_LOW = 12;
const WAKTU_HIGH = 28;
const SUBJECT_TOP_N = 20;
const PAGE_SIZE = 14;

const STATUS_KEY: Record<MatchStatus, DictKey> = {
  "Sepadan": "sjMatch",
  "Tidak Sepadan": "sjMismatch",
  "Tidak Dapat Ditentukan": "sjUnknown",
};

export default function Subjek() {
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const { teachers, error } = useTeachers();
  const { schoolTypes, schoolsByType, subjects, employmentStatuses } = useTeacherLookups(teachers);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("Semua");
  const [tablePage, setTablePage] = useState(1);
  const matchTableRef = useRef<HTMLDivElement>(null);

  // Unusual-load list controls
  const [loadQuery, setLoadQuery] = useState("");
  const [loadKind, setLoadKind] = useState<LoadKind>("all");
  const [loadExpanded, setLoadExpanded] = useState(false);
  const [loadPage, setLoadPage] = useState(1);

  // Work out the match status once per teacher (not on every render).
  const matchById = useMemo(() => {
    const m = new Map<number, MatchResult>();
    (teachers ?? []).forEach((x) => m.set(x.id, matchOpsyen(x)));
    return m;
  }, [teachers]);
  const statusOf = (x: Teacher) => matchById.get(x.id)!.status;

  const filtered = useMemo(() => (teachers ?? []).filter((x) => {
    if (filters.schoolType && x.schoolType !== filters.schoolType) return false;
    if (filters.schoolName && x.school !== filters.schoolName) return false;
    if (filters.gender && x.gender !== filters.gender) return false;
    if (filters.subject && !x.subjects.some((s) => s.name === filters.subject)) return false;
    if (filters.employmentStatus && x.employmentStatus !== filters.employmentStatus) return false;
    return true;
  }), [teachers, filters]);

  const subjectChartData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((x) => {
      new Set(x.subjects.map((s) => s.name)).forEach((name) => { map[name] = (map[name] || 0) + 1; });
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, SUBJECT_TOP_N)
      .map(([name, count]) => ({ name, count }));
  }, [filtered]);

  const mismatchCount = useMemo(() => filtered.filter((x) => statusOf(x) === "Tidak Sepadan").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, matchById]);
  const unknownCount = useMemo(() => filtered.filter((x) => statusOf(x) === "Tidak Dapat Ditentukan").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, matchById]);

  const withSubjects = useMemo(() => filtered.filter((x) => x.subjects.length > 0), [filtered]);
  const avgWaktu = withSubjects.length
    ? Math.round(withSubjects.reduce((s, x) => s + totalWaktu(x), 0) / withSubjects.length)
    : 0;

  // Only teachers with at least one recorded subject; those with none are
  // usually administrators (e.g. Pengetua) and are not a load anomaly.
  const waktuAnomalies = useMemo(() =>
    withSubjects
      .filter((x) => totalWaktu(x) < WAKTU_LOW || totalWaktu(x) > WAKTU_HIGH)
      .sort((a, b) => totalWaktu(b) - totalWaktu(a)),
    [withSubjects]);

  const loadRows = useMemo(() => {
    const q = loadQuery.trim().toLowerCase();
    return waktuAnomalies.filter((x) => {
      const w = totalWaktu(x);
      if (loadKind === "high" && w <= WAKTU_HIGH) return false;
      if (loadKind === "low" && w >= WAKTU_LOW) return false;
      if (q && !x.name.toLowerCase().includes(q) && !x.school.toLowerCase().includes(q) && !shortSchoolName(x.school).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [waktuAnomalies, loadQuery, loadKind]);
  const highCount = waktuAnomalies.filter((x) => totalWaktu(x) > WAKTU_HIGH).length;
  const lowCount = waktuAnomalies.length - highCount;
  const loadPages = Math.max(1, Math.ceil(loadRows.length / PAGE_SIZE));
  const loadShown = loadExpanded
    ? loadRows.slice((loadPage - 1) * PAGE_SIZE, loadPage * PAGE_SIZE)
    : loadRows.slice(0, 8);

  const tableRows = useMemo(() =>
    filtered.filter((x) => matchFilter === "Semua" || statusOf(x) === matchFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, matchFilter, matchById]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const paginated = tableRows.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE);

  function handleMatchFilter(f: MatchFilter) {
    setMatchFilter(f);
    setTablePage(1);
  }

  // Banner button: filter the matching table AND jump down to it,
  // since the table sits at the bottom of the page.
  function showMismatchList() {
    const next = matchFilter === "Tidak Sepadan" ? "Semua" : "Tidak Sepadan";
    handleMatchFilter(next);
    if (next === "Tidak Sepadan") {
      setTimeout(() => matchTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  }

  if (error) {
    return (
      <Centered color="#dc2626">
        <AlertTriangle size={28} />
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
          {error === "network" ? t("ovErrServer") : `${t("ovErrLoad")} (${error}).`}
        </div>
      </Centered>
    );
  }
  if (!teachers) {
    return (
      <Centered color="#6b7280">
        <Loader2 size={26} className="spin" />
        <div style={{ fontSize: 13 }}>{t("ovLoading")}</div>
      </Centered>
    );
  }

  const n = filtered.length || 1;

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <FilterSidebar
        filters={filters}
        onChange={(f) => { setFilters(f); setTablePage(1); }}
        schoolTypes={schoolTypes}
        schoolsByType={schoolsByType}
        subjects={subjects}
        employmentStatuses={employmentStatuses}
      />

      <main style={{ flex: 1, overflowY: "auto", background: "#F5F5F5", padding: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: 0 }}>{t("sjTitle")}</h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
            {filtered.length.toLocaleString(locale)} {t("dmInView")}
          </p>
        </div>

        {/* Alert banner */}
        {mismatchCount > 0 && (
          <div style={{ background: "#fff7ed", border: "1px solid #fdba74", borderRadius: 10, padding: "12px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flexShrink: 0, background: ORANGE + "20", borderRadius: 8, padding: 8 }}>
              <AlertTriangle size={20} color={ORANGE} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "#92400e" }}>
                {mismatchCount.toLocaleString(locale)} {t("sjMismatchBanner")}
              </span>
              <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>
                {((mismatchCount / n) * 100).toFixed(1)}% {t("sjOfView")}
                {unknownCount > 0 && <> · {unknownCount.toLocaleString(locale)} {t("sjUndetermined")}</>}
              </div>
            </div>
            <button
              onClick={showMismatchList}
              style={{ padding: "6px 16px", borderRadius: 7, border: `1.5px solid ${ORANGE}`, background: matchFilter === "Tidak Sepadan" ? ORANGE : "transparent", color: matchFilter === "Tidak Sepadan" ? "#fff" : ORANGE, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
              {matchFilter === "Tidak Sepadan" ? t("sjShowAll") : t("sjShowList")}
            </button>
          </div>
        )}

        {/* Subject bar chart */}
        <div className="card" style={{ padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #f3f4f6" }}>
            {t("sjChartSubjects")}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={subjectChartData} margin={{ left: 60, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9.5 }} angle={-35} textAnchor="end" height={110} interval={0}
                tickFormatter={(v: string) => (v.length > 28 ? v.slice(0, 26) + "…" : v)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [Number(v).toLocaleString(locale), t("ovTeachersUnit")]} />
              <Bar dataKey="count" fill={TEAL} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Teaching load anomalies */}
        <div className="card" style={{ padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #f3f4f6" }}>
            <Clock size={14} color={ORANGE} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>{t("sjLoadTitle")}</span>
            <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#6b7280" }}>
              {t("sjAvgNow")}: <strong style={{ color: "#111827" }}>{avgWaktu} {t("sjPerWeek")}</strong> · {t("sjNormalRange")}: {WAKTU_LOW}–{WAKTU_HIGH} {t("sjPerWeek")}
            </span>
          </div>
          {/* Search + High/Low toggle */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 360 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} color="#9ca3af" />
              <input type="text" value={loadQuery} placeholder={t("sjSearchLoad")} style={{ paddingLeft: 30 }}
                onChange={(e) => { setLoadQuery(e.target.value); setLoadPage(1); }} />
            </div>
            <div style={{ display: "flex", borderRadius: 7, overflow: "hidden", border: "1px solid #e5e7eb" }}>
              {([["all", t("sjLoadAll"), waktuAnomalies.length], ["high", t("sjHigh"), highCount], ["low", t("sjLow"), lowCount]] as [LoadKind, string, number][]).map(([k, label, count], idx) => (
                <button key={k} onClick={() => { setLoadKind(k); setLoadPage(1); }}
                  style={{
                    padding: "5px 12px", fontSize: 11.5, fontWeight: 600, border: "none", cursor: "pointer",
                    borderRight: idx < 2 ? "1px solid #e5e7eb" : "none",
                    background: loadKind === k ? NAVY : "#fff", color: loadKind === k ? "#fff" : "#6b7280",
                  }}>
                  {label} ({count.toLocaleString(locale)})
                </button>
              ))}
            </div>
          </div>
          {loadRows.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center", color: "#9ca3af", fontSize: 12.5 }}>{t("sjNoAnomaly")}</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {(["sjColName", "sjColSchool", "cgTotalHours", "sjColStatus"] as DictKey[]).map((h) => (
                    <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>{h === "sjColStatus" ? "Status" : t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadShown.map((x, i) => {
                  const w = totalWaktu(x);
                  const isHigh = w > WAKTU_HIGH;
                  return (
                    <tr key={x.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "7px 12px", fontSize: 12.5, fontWeight: 500, color: "#111827" }}>{x.name}</td>
                      <td style={{ padding: "7px 12px", fontSize: 12, color: "#6b7280" }} title={x.school}>{shortSchoolName(x.school)}</td>
                      <td style={{ padding: "7px 12px", fontSize: 12.5, fontWeight: 700, color: "#111827" }}>{w} {t("sjPerWeek")}</td>
                      <td style={{ padding: "7px 12px" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99,
                          background: isHigh ? "#fee2e2" : "#fef3c7",
                          color: isHigh ? "#991b1b" : "#92400e",
                        }}>
                          {isHigh ? t("sjHigh") : t("sjLow")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {loadRows.length > 8 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              {loadExpanded ? (
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  {loadRows.length.toLocaleString(locale)} {t("sjRecords")} · {t("cgPage")} {loadPage} / {loadPages}
                </span>
              ) : (
                <span style={{ fontSize: 11.5, color: "#9ca3af" }}>+{(loadRows.length - 8).toLocaleString(locale)} {t("sjMoreAnomaly")}</span>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                {loadExpanded && loadPages > 1 && <>
                  <PageBtn label={t("cgPrev")} onClick={() => setLoadPage((p) => Math.max(1, p - 1))} disabled={loadPage === 1} />
                  <PageBtn label={t("cgNext")} onClick={() => setLoadPage((p) => Math.min(loadPages, p + 1))} disabled={loadPage === loadPages} />
                </>}
                <button onClick={() => { setLoadExpanded(!loadExpanded); setLoadPage(1); }}
                  style={{ padding: "5px 14px", borderRadius: 6, border: `1px solid ${TEAL}`, background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: TEAL }}>
                  {loadExpanded ? t("sjShowLess") : t("sjShowMore")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Matching table */}
        <div ref={matchTableRef} className="card" style={{ padding: "16px 18px", scrollMarginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #f3f4f6", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>{t("sjMatchCheck")}</span>
            <div style={{ display: "flex", gap: 0, borderRadius: 7, overflow: "hidden", border: "1px solid #e5e7eb" }}>
              {(["Semua", "Sepadan", "Tidak Sepadan", "Tidak Dapat Ditentukan"] as MatchFilter[]).map((opt, idx, arr) => (
                <button key={opt} onClick={() => handleMatchFilter(opt)}
                  title={opt === "Tidak Dapat Ditentukan" ? t("sjUnknownHelp") : undefined}
                  style={{
                    padding: "5px 14px", fontSize: 11.5, fontWeight: 600, border: "none", cursor: "pointer",
                    background: matchFilter === opt ? NAVY : "#fff",
                    color: matchFilter === opt ? "#fff" : "#6b7280",
                    borderRight: idx < arr.length - 1 ? "1px solid #e5e7eb" : "none",
                    transition: "all 0.12s",
                  }}>
                  {opt === "Semua" ? t("sjAll") : t(STATUS_KEY[opt])}
                  {opt === "Tidak Sepadan" && mismatchCount > 0 && (
                    <span style={{ marginLeft: 5, background: matchFilter === opt ? "rgba(255,255,255,0.25)" : "#fee2e2", color: matchFilter === opt ? "#fff" : "#dc2626", borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>
                      {mismatchCount.toLocaleString(locale)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {matchFilter === "Tidak Dapat Ditentukan" && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#4b5563", marginBottom: 12 }}>
              <HelpCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t("sjUnknownHelp")}</span>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: NAVY }}>
                  {(["sjColName", "sjColSchool", "sjColType", "sjColOp1", "sjColOp2", "sjColSub1", "sjColSub2", "sjColSub3", "sjColHours", "sjColStatus"] as DictKey[]).map((h) => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>
                      {t(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((x, i) => {
                  const m = matchById.get(x.id)!;
                  const w = totalWaktu(x);
                  const determinable = m.status !== "Tidak Dapat Ditentukan";
                  return (
                    <tr key={x.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 12px", fontSize: 12.5, fontWeight: 500, color: "#111827", whiteSpace: "nowrap" }}>{x.name}</td>
                      <td style={{ padding: "8px 12px", fontSize: 11.5, color: "#6b7280", maxWidth: 160 }} title={x.school}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortSchoolName(x.school)}</div>
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        <span style={schoolTypeChip(x.schoolType)}>{x.schoolType}</span>
                      </td>
                      <OpCell value={clean(x.opsyen1)} highlight={m.matchedOpsyen.has(1)} />
                      <OpCell value={clean(x.opsyen2)} highlight={m.matchedOpsyen.has(2)} />
                      {[0, 1, 2].map((k) => (
                        <SubCell key={k} value={x.subjects[k]?.name} matched={m.matchedSubjects.has(k)} neutral={!determinable} />
                      ))}
                      <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: x.subjects.length && (w < WAKTU_LOW || w > WAKTU_HIGH) ? ORANGE : "#374151" }}>
                        {w}
                      </td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                        <StatusPill status={m.status} label={t(STATUS_KEY[m.status])} />
                      </td>
                    </tr>
                  );
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: 36, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                      {t("cgNoRecords")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                {tableRows.length.toLocaleString(locale)} {t("sjRecords")} · {t("cgPage")} {tablePage} / {totalPages}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <PageBtn label={t("cgPrev")} onClick={() => setTablePage((p) => Math.max(1, p - 1))} disabled={tablePage === 1} />
                <PageBtn label={t("cgNext")} onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))} disabled={tablePage === totalPages} />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Centered({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 10, color }}>
      {children}
    </div>
  );
}

function StatusPill({ status, label }: { status: MatchStatus; label: string }) {
  const s = status === "Sepadan"
    ? { bg: "#d1fae5", fg: "#065f46", bd: "#6ee7b7", icon: <CheckCircle2 size={12} /> }
    : status === "Tidak Sepadan"
      ? { bg: "#fff7ed", fg: "#c2410c", bd: "#fdba74", icon: <AlertTriangle size={12} /> }
      : { bg: "#f3f4f6", fg: "#4b5563", bd: "#d1d5db", icon: <HelpCircle size={12} /> };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, background: s.bg, color: s.fg, border: `1px solid ${s.bd}`, padding: "3px 9px", borderRadius: 99 }}>
      {s.icon} {label}
    </span>
  );
}

function OpCell({ value, highlight }: { value: string; highlight: boolean }) {
  if (!value) return <td style={{ padding: "8px 12px", fontSize: 12, color: "#d1d5db" }}>—</td>;
  return (
    <td style={{ padding: "8px 12px", maxWidth: 180 }} title={value}>
      <span style={{
        fontSize: 12, fontWeight: highlight ? 600 : 400,
        color: highlight ? "#065f46" : "#374151",
        background: highlight ? "#d1fae5" : "transparent",
        padding: highlight ? "2px 7px" : undefined,
        borderRadius: highlight ? 5 : undefined,
        display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle",
      }}>
        {value}
      </span>
    </td>
  );
}

function SubCell({ value, matched, neutral }: { value?: string; matched: boolean; neutral: boolean }) {
  if (!value) {
    return <td style={{ padding: "8px 12px", fontSize: 12, color: "#d1d5db" }}>—</td>;
  }
  const style = neutral
    ? { color: "#374151", background: "#f3f4f6" }
    : matched
      ? { color: "#065f46", background: "#d1fae5" }
      : { color: "#c2410c", background: "#fff7ed" };
  return (
    <td style={{ padding: "8px 12px" }}>
      <span style={{ fontSize: 12, fontWeight: matched ? 600 : 400, padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap", ...style }}>
        {value}
      </span>
    </td>
  );
}

function PageBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "5px 14px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, cursor: disabled ? "not-allowed" : "pointer", color: disabled ? "#9ca3af" : NAVY }}>
      {label}
    </button>
  );
}
