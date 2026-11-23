import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { UserMinus, Loader2, AlertTriangle, CalendarClock, CalendarRange } from "lucide-react";
import { StatTile, StatRow, CardTitle } from "../components/ui";
import FilterSidebar, { DEFAULT_FILTERS, describeFilters, type Filters } from "../lib/FilterSidebar";
import { countTable, type Report, type ReportTable } from "../lib/report";
import ReportButton from "../components/ReportButton";
import { ListToolbar, ListFooter, usePager } from "../components/ListControls";
import { useTeachers, useTeacherLookups } from "../lib/useTeachers";
import { NAVY, TEAL, ORANGE, CHART_COLORS, SCHOOL_TYPE_CHART_COLORS, CHART, schoolTypeChip } from "../lib/colors";
import { shortSchoolName } from "../lib/schoolName";
import { useLanguage, type DictKey } from "../context/LanguageContext";
import { fixMonth } from "../lib/dates";

const YEAR_MS = 365.25 * 864e5;

function gradeNumber(g: string) {
  const n = parseInt(g.replace(/\D/g, ""), 10);
  return isNaN(n) ? 999 : n;
}

export default function Persaraan() {
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const { teachers, error } = useTeachers();
  const { schoolTypes, schoolsByType, subjects, employmentStatuses } = useTeacherLookups(teachers);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState("");

  // Real "today", recalculated each time the page is opened.
  const now = useMemo(() => Date.now(), []);
  const thisYear = new Date(now).getFullYear();
  const yearsUntil = (dateStr: string | null) =>
    dateStr ? (new Date(dateStr).getTime() - now) / YEAR_MS : Number.POSITIVE_INFINITY;

  const filtered = useMemo(() => (teachers ?? []).filter((x) => {
    if (filters.schoolType && x.schoolType !== filters.schoolType) return false;
    if (filters.schoolName && x.school !== filters.schoolName) return false;
    if (filters.gender && x.gender !== filters.gender) return false;
    if (filters.subject && !x.subjects.some((s) => s.name === filters.subject)) return false;
    if (filters.employmentStatus && x.employmentStatus !== filters.employmentStatus) return false;
    return true;
  }), [teachers, filters]);

  const withYears = useMemo(
    () => filtered.map((x) => ({ x, y: yearsUntil(x.retirementDate) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered]);

  const within = (max: number) => withYears.filter(({ y }) => y >= 0 && y <= max);
  const within1 = useMemo(() => within(1), [withYears]); // eslint-disable-line react-hooks/exhaustive-deps
  const within3 = useMemo(() => within(3), [withYears]); // eslint-disable-line react-hooks/exhaustive-deps
  const within5 = useMemo(() => within(5), [withYears]); // eslint-disable-line react-hooks/exhaustive-deps
  // Still listed as active even though the retirement date is already behind us.
  const pastDate = useMemo(() => withYears.filter(({ y }) => y < 0), [withYears]);

  // Fixed colour per grade across the whole dataset.
  const allGrades = useMemo(() => {
    const set = new Set<string>();
    (teachers ?? []).forEach((x) => { if (x.gredPenyandang) set.add(x.gredPenyandang); });
    return Array.from(set).sort((a, b) => gradeNumber(a) - gradeNumber(b));
  }, [teachers]);
  const gradeColor = (g: string) => CHART_COLORS[Math.max(0, allGrades.indexOf(g)) % CHART_COLORS.length];

  const byGred = useMemo(() =>
    allGrades
      .map((g) => ({ name: g, count: within5.filter(({ x }) => x.gredPenyandang === g).length }))
      .filter((d) => d.count > 0),
    [within5, allGrades]);

  const byType = useMemo(() =>
    schoolTypes
      .map((ty) => ({ name: ty, count: within5.filter(({ x }) => x.schoolType === ty).length }))
      .filter((d) => d.count > 0),
    [within5, schoolTypes]);

  const byYear = useMemo(() => {
    const map: Record<string, number> = {};
    withYears.forEach(({ x, y }) => {
      if (y < 0 || y > 10 || !x.retirementDate) return;
      const label = String(new Date(x.retirementDate).getFullYear());
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
  }, [withYears]);

  // Teachers retiring within 3 years (plus any already past their date), with the search applied.
  const tableRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...pastDate, ...within3]
      .filter(({ x }) => !q || [x.name, x.school, shortSchoolName(x.school), x.position, x.gredPenyandang].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => a.y - b.y);
  }, [pastDate, within3, query]);
  const pager = usePager(tableRows.length, tableRows);

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

  const fmtDate = (d: string | null) =>
    d ? fixMonth(new Date(d).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })) : "-";

  const remaining = (y: number) => {
    if (y < 0) return t("psPastDate");
    if (y < 1) { const n = Math.max(1, Math.round(y * 12)); return `${n} ${n === 1 ? t("psMonth1") : t("psMonths")}`; }
    return `${y.toFixed(1)} ${t("psYears")}`;
  };

  const tip = (v: unknown) => [Number(v).toLocaleString(locale), t("ovTeachersUnit")];

  const retireTable = (): ReportTable => ({
    name: t("rpShRetireList"), title: `${t("psList")} (${tableRows.length})`,
    columns: [
      { header: t("psColName"), width: 36 }, { header: t("psColSchool"), width: 40 }, { header: t("psColType"), width: 9 },
      { header: t("psColGrade"), width: 9 }, { header: t("psColPosition"), width: 34 }, { header: t("psColDate"), width: 13, format: "date" },
      { header: t("psColRemaining"), width: 22 },
    ],
    rows: tableRows.map(({ x, y }) => [x.name, x.school, x.schoolType, x.gredPenyandang, x.position, x.retirementDate, remaining(y)]),
  });
  // Only the retirement list (the per-table download button).
  const buildListOnly = (): Report => ({
    title: t("psList"),
    filters: [...(query.trim() ? [`${t("rpSearch")}: ${query.trim()}`] : []), ...describeFilters(filters, t)],
    tables: [retireTable()],
  });

  const buildReport = (): Report => {
    const h = { count: t("rpColCount"), pct: t("rpColPct") };
    return {
      title: t("titlePersaraan"),
      filters: describeFilters(filters, t),
      tables: [
        {
          name: t("rpSummary"), title: t("rpSummary"),
          columns: [{ header: t("rpColItem"), width: 44 }, { header: h.count, width: 15, format: "int" }],
          rows: [
            [t("ovTotalTeachers"), filtered.length],
            [t("psWithin1"), within1.length],
            [t("psWithin3"), within3.length],
            [t("psWithin5"), within5.length],
            [t("rpPastDateCount"), pastDate.length],
          ],
        },
        countTable(t("rpColYear"), t("psByYear"), t("rpColYear"), byYear.map((d) => [d.name, d.count]), filtered.length, h, 12),
        countTable(t("grColGrade"), t("psByGrade"), t("grColGrade"), byGred.map((d) => [d.name, d.count]), within5.length, h, 12),
        countTable(t("filterSchoolType"), t("psByType"), t("filterSchoolType"), byType.map((d) => [d.name, d.count]), within5.length, h, 16),
        retireTable(),
      ],
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <FilterSidebar
        title={t("titlePersaraan")}
        report={buildReport}
        filters={filters}
        onChange={setFilters}
        schoolTypes={schoolTypes}
        schoolsByType={schoolsByType}
        subjects={subjects}
        employmentStatuses={employmentStatuses}
      />

      <main className="mac-main">
        <p style={{ fontSize: 13, color: "var(--soft-muted)", margin: "0 0 14px" }}>
          {t("psBasedOn")} · {filtered.length.toLocaleString(locale)} {t("dmInView")}
        </p>

        {/* Stat strip */}
        <StatRow>
          <StatTile icon={<CalendarClock size={20} />} tone="amber" label={t("psWithin1")} value={within1.length.toLocaleString(locale)} note={t("ovTeachersWord")} />
          <StatTile icon={<CalendarRange size={20} />} tone="teal" label={t("psWithin3")} value={within3.length.toLocaleString(locale)} note={t("ovTeachersWord")} />
          <StatTile icon={<UserMinus size={20} />} tone="blue" label={t("psWithin5")} value={within5.length.toLocaleString(locale)} note={t("ovTeachersWord")} />
        </StatRow>


        {pastDate.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--err-bg)", border: "1px solid var(--err-line)", color: "var(--err-ink)", borderRadius: 12, padding: "10px 14px", fontSize: 12.5, marginBottom: 16 }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span><b>{pastDate.length}</b> {t("psPastNote")}</span>
          </div>
        )}

        <div className="soft-grid">
          {/* Timeline by year */}
          <div className="card soft-card wide">
            <ChartTitle>{t("psByYear")}</ChartTitle>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={byYear} margin={{ left: 0, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={tip} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {byYear.map((d) => {
                    const gap = Number(d.name) - thisYear;
                    return <Cell key={d.name} fill={gap <= 1 ? ORANGE : gap <= 3 ? TEAL : NAVY} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, fontSize: 11, color: "var(--soft-muted)", marginTop: 6 }}>
              <Swatch color={ORANGE} label={t("psLegend1")} />
              <Swatch color={TEAL} label={t("psLegend3")} />
              <Swatch color={NAVY} label={t("psLegendLater")} />
            </div>
          </div>

          {/* By grade */}
          <div className="card soft-card">
            <ChartTitle>{t("psByGrade")}</ChartTitle>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={byGred} margin={{ left: 0, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={tip} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {byGred.map((d) => <Cell key={d.name} fill={gradeColor(d.name)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By school type */}
          <div className="card soft-card">
            <ChartTitle>{t("psByType")}</ChartTitle>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={byType} margin={{ left: 0, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={tip} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {byType.map((d) => <Cell key={d.name} fill={SCHOOL_TYPE_CHART_COLORS[d.name] ?? CHART.gray} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table — teachers retiring within 3 years (plus any already past their date) */}
          <div className="card soft-card wide">
            <CardTitle>{t("psList")} ({within3.length.toLocaleString(locale)})</CardTitle>
            <ListToolbar
              search={{ value: query, onChange: setQuery, placeholder: t("psSearch") }}
              pager={pager}
              download={tableRows.length > 0 && <ReportButton formats={["excel", "csv"]} getReport={buildListOnly} title={t("rpThisList")} />}
            />
            <div style={{ overflowX: "auto" }}>
              <table className="soft-table">
                <thead>
                  <tr>
                    {(["psColName", "psColSchool", "psColType", "psColGrade", "psColPosition", "psColDate", "psColRemaining"] as DictKey[]).map((h) => (
                      <th key={h}>{t(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pager.slice(tableRows).map(({ x, y }, i) => (
                    <tr key={x.id} data-i={i}>
                      <td style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 500, color: "var(--soft-text)" }}>{x.name}</td>
                      <td style={{ padding: "7px 14px", fontSize: 12, color: "var(--soft-muted)", whiteSpace: "nowrap" }} title={x.school}>{shortSchoolName(x.school)}</td>
                      <td style={{ padding: "7px 14px" }}><span style={schoolTypeChip(x.schoolType)}>{x.schoolType}</span></td>
                      <td style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, color: NAVY }}>{x.gredPenyandang || "-"}</td>
                      <td style={{ padding: "7px 14px", fontSize: 12, color: "var(--soft-text-2)", maxWidth: 240 }} title={x.position ?? ""}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.position || "-"}</div>
                      </td>
                      <td style={{ padding: "7px 14px", fontSize: 12, color: "var(--soft-text-2)", whiteSpace: "nowrap" }}>{fmtDate(x.retirementDate)}</td>
                      <td style={{ padding: "7px 14px", whiteSpace: "nowrap" }}>
                        <span className={`tag ${y < 0 ? "tag-err" : y <= 1 ? "tag-warn" : "tag-info"}`}>
                          {remaining(y)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {tableRows.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--soft-faint)", fontSize: 13 }}>{query.trim() ? t("cgNoRecords") : t("psNone")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <ListFooter pager={pager} />
          </div>
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

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

function ChartTitle({ children }: { children: React.ReactNode }) {
  return <CardTitle>{children}</CardTitle>;
}
