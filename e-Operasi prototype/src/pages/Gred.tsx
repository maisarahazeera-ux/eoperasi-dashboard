import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import { Award as AwardIcon, Star, Loader2, AlertTriangle, TrendingUp, UserPlus } from "lucide-react";
import { StatTile, StatRow, CardTitle, PillToggle } from "../components/ui";
import FilterSidebar, { DEFAULT_FILTERS, describeFilters, type Filters } from "../lib/FilterSidebar";
import { countTable, type Report } from "../lib/report";
import { useTeachers, useTeacherLookups } from "../lib/useTeachers";
import { type Teacher } from "../lib/api";
import { NAVY, TEAL, ORANGE, CHART_COLORS, SCHOOL_TYPE_CHART_COLORS, CHART } from "../lib/colors";
import { clean } from "../lib/labels";
import { useLanguage, type DictKey } from "../context/LanguageContext";

type Basis = "penyandang" | "hakiki";

// The data uses the SSPA (2024) grade names: DG5–DG7 non-graduate,
// DG9–DG14 graduate. A few records still carry old-scheme grades (DG41/44/48).
const SENIOR_GRADES = ["DG13", "DG14"];
const ENTRY_GRADE = "DG9";
const TUGAS_TOP_N = 10;

function gradeNumber(g: string) {
  const n = parseInt(g.replace(/\D/g, ""), 10);
  return isNaN(n) ? 999 : n;
}

function gradeGroup(g: string): DictKey {
  // Only the DG (teacher) scheme is grouped; anything else (e.g. VU7) is "Other".
  if (!g.toUpperCase().startsWith("DG")) return "grGroupOther";
  const n = gradeNumber(g);
  if (n >= 5 && n <= 7) return "grGroupNonGrad";
  if (n >= 9 && n <= 14) return "grGroupGrad";
  if (n >= 41 && n <= 54) return "grGroupOld";
  return "grGroupOther";
}

// Acronyms that should stay in capitals when tidying up UPPERCASE field names.
const KEEP_UPPER = new Set(["MPEI", "PITO", "KPLI", "SPLI"]);

/** "BAHASA INGGERIS" -> "Bahasa Inggeris", "MPEI - SAINS" -> "MPEI - Sains". */
function titleCase(s: string) {
  return s.split(/(\s+)/).map((w) => {
    if (KEEP_UPPER.has(w.toUpperCase())) return w.toUpperCase();
    return w.replace(/\p{L}+/u, (m) => m[0].toUpperCase() + m.slice(1).toLowerCase());
  }).join("");
}

export default function Gred() {
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const { teachers, error } = useTeachers();
  const { schoolTypes, schoolsByType, subjects, employmentStatuses } = useTeacherLookups(teachers);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [basis, setBasis] = useState<Basis>("penyandang");

  const gradeOf = (x: Teacher) => (basis === "hakiki" ? x.gredHakiki : x.gredPenyandang) || "";

  const filtered = useMemo(() => (teachers ?? []).filter((x) => {
    if (filters.schoolType && x.schoolType !== filters.schoolType) return false;
    if (filters.schoolName && x.school !== filters.schoolName) return false;
    if (filters.gender && x.gender !== filters.gender) return false;
    if (filters.subject && !x.subjects.some((s) => s.name === filters.subject)) return false;
    if (filters.employmentStatus && x.employmentStatus !== filters.employmentStatus) return false;
    return true;
  }), [teachers, filters]);

  // Every grade that exists in the full data (both columns), in numeric order.
  // Its position gives each grade a fixed colour that never changes with filters.
  const allGrades = useMemo(() => {
    const set = new Set<string>();
    (teachers ?? []).forEach((x) => {
      if (x.gredHakiki) set.add(x.gredHakiki);
      if (x.gredPenyandang) set.add(x.gredPenyandang);
    });
    return Array.from(set).sort((a, b) => gradeNumber(a) - gradeNumber(b));
  }, [teachers]);
  const gradeColor = (g: string) => CHART_COLORS[Math.max(0, allGrades.indexOf(g)) % CHART_COLORS.length];

  /* Chart 1 — count by grade */
  const byGred = useMemo(() =>
    allGrades
      .map((g) => ({ name: g, count: filtered.filter((x) => gradeOf(x) === g).length }))
      .filter((d) => d.count > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, allGrades, basis]);

  /* Chart 2 — stacked by school type */
  const presentTypes = schoolTypes.filter((type) => filtered.some((x) => x.schoolType === type));
  const stackedByType = useMemo(() =>
    byGred.map(({ name }) => {
      const row: Record<string, string | number> = { name };
      presentTypes.forEach((type) => {
        row[type] = filtered.filter((x) => gradeOf(x) === name && x.schoolType === type).length;
      });
      return row;
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [byGred, filtered, presentTypes.join("|"), basis]);

  const topGred = byGred.reduce((a, b) => (b.count > a.count ? b : a), { name: "-", count: 0 });
  const seniorCount = filtered.filter((x) => SENIOR_GRADES.includes(gradeOf(x))).length;
  const entryCount = filtered.filter((x) => gradeOf(x) === ENTRY_GRADE).length;

  /* Recognition & special duties */
  const cemerlangTeachers = useMemo(() => filtered.filter((x) => x.guruCemerlang), [filtered]);
  const cemerlangByBidang = useMemo(() => {
    const map: Record<string, number> = {};
    cemerlangTeachers.forEach((x) => {
      const b = clean(x.guruCemerlangBidang) ? titleCase(x.guruCemerlangBidang!) : t("grNotStated");
      map[b] = (map[b] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [cemerlangTeachers, t]);

  const withDuty = useMemo(() => filtered.filter((x) => clean(x.tugasKhas)), [filtered]);
  const tugasKhasCounts = useMemo(() => {
    const map: Record<string, number> = {};
    withDuty.forEach((x) => { map[x.tugasKhas!] = (map[x.tugasKhas!] || 0) + 1; });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, TUGAS_TOP_N).map(([name, count]) => ({ name, count }));
    const rest = sorted.slice(TUGAS_TOP_N).reduce((s, [, c]) => s + c, 0);
    return rest > 0 ? [...top, { name: `${t("grOthersDuty")} (${sorted.length - TUGAS_TOP_N})`, count: rest }] : top;
  }, [withDuty, t]);

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

  const buildReport = (): Report => {
    const total = filtered.length;
    const h = { count: t("rpColCount"), pct: t("rpColPct") };
    const basisLabel = basis === "hakiki" ? t("grHakiki") : t("grPenyandang");
    // Full special-duty list here (the chart shows the top 10 only).
    const dutyAll: Record<string, number> = {};
    withDuty.forEach((x) => { dutyAll[x.tugasKhas!] = (dutyAll[x.tugasKhas!] || 0) + 1; });
    return {
      title: `${t("titleGred")} (${basisLabel})`,
      filters: [`${t("grBasis")}: ${basisLabel}`, ...describeFilters(filters, t)],
      tables: [
        {
          name: t("grColGrade"), title: `${t("grSummary")} (${basisLabel})`,
          columns: [{ header: t("grColGrade"), width: 12 }, { header: h.count, format: "int", width: 15 }, { header: h.pct, format: "pct", width: 11 }, { header: t("grColGroup"), width: 34 }],
          rows: byGred.map((d) => [d.name, d.count, total ? d.count / total : 0, t(gradeGroup(d.name))]),
          totalColumns: [1],
        },
        {
          name: t("filterSchoolType"), title: t("grChartByType"),
          columns: [{ header: t("grColGrade"), width: 12 }, ...presentTypes.map((ty) => ({ header: ty, format: "int" as const, width: 11 })), { header: t("rpTotal"), format: "int", width: 11 }],
          rows: stackedByType.map((r) => [r.name as string, ...presentTypes.map((ty) => r[ty] as number), presentTypes.reduce((s, ty) => s + (r[ty] as number), 0)]),
          totalColumns: [...presentTypes.map((_, i) => i + 1), presentTypes.length + 1],
        },
        countTable(t("cgCemerlang"), t("grCemerlang"), t("rpColBidang"), cemerlangByBidang.map((d) => [d.name, d.count]), cemerlangTeachers.length, h, 40),
        countTable(t("cgTugasKhas"), t("grTugasKhas"), t("cgTugasKhas"),
          Object.entries(dutyAll).sort((a, b) => b[1] - a[1]), withDuty.length, h, 50),
      ],
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <FilterSidebar
        title={t("titleGred")}
        report={buildReport}
        filters={filters}
        onChange={setFilters}
        schoolTypes={schoolTypes}
        schoolsByType={schoolsByType}
        subjects={subjects}
        employmentStatuses={employmentStatuses}
      />

      <main className="mac-main">
        <div style={{ marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <p style={{ fontSize: 13, color: "var(--soft-muted)", margin: 0 }}>
            {filtered.length.toLocaleString(locale)} {t("dmInView")}
          </p>
          {/* Hakiki = substantive grade on appointment; Penyandang = grade currently held */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--soft-muted)" }}>{t("grBasis")}:</span>
            <PillToggle<Basis>
              ariaLabel={t("grBasis")}
              value={basis}
              onChange={setBasis}
              options={[
                { value: "penyandang", label: t("grPenyandang") },
                { value: "hakiki", label: t("grHakiki") },
              ]}
            />
          </div>
        </div>

        {/* Stat strip */}
        <StatRow>
          <StatTile icon={<AwardIcon size={20} />} tone="blue" label={t("grTopGrade")} value={topGred.name} note={`${topGred.count.toLocaleString(locale)} ${t("grTeachersWord")}`} />
          <StatTile icon={<TrendingUp size={20} />} tone="teal" label={t("grSenior")} value={seniorCount.toLocaleString(locale)} note={t("grTeachersWord")} />
          <StatTile icon={<UserPlus size={20} />} tone="amber" label={t("grEntry")} value={entryCount.toLocaleString(locale)} note={t("grTeachersWord")} />
        </StatRow>

        <div className="soft-grid">
          {/* Chart 1 — bar by grade */}
          <div className="card soft-card">
            <ChartTitle>{t("grChartByGrade")}</ChartTitle>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={byGred} margin={{ left: 0, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [Number(v).toLocaleString(locale), t("ovTeachersUnit")]} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {byGred.map((d) => <Cell key={d.name} fill={gradeColor(d.name)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Chart 2 — stacked by school type */}
          <div className="card soft-card">
            <ChartTitle>{t("grChartByType")}</ChartTitle>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={stackedByType} margin={{ left: 0, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => Number(v).toLocaleString(locale)} />
                <Legend wrapperStyle={{ fontSize: 10.5, paddingTop: 8 }} />
                {presentTypes.map((type) => (
                  <Bar key={type} dataKey={type} stackId="a" fill={SCHOOL_TYPE_CHART_COLORS[type] ?? CHART.gray} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary table — full width */}
          <div className="card soft-card wide">
            <ChartTitle>{t("grSummary")}</ChartTitle>
            <table className="soft-table">
              <thead>
                <tr>
                  {(["grColGrade", "grColCount", "grColPct", "grColGroup"] as DictKey[]).map((h) => (
                    <th key={h}>
                      {t(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byGred.map((d, i) => {
                  const pct = ((d.count / n) * 100).toFixed(1);
                  return (
                    <tr key={d.name} data-i={i}>
                      <td style={{ padding: "8px 14px" }}>
                        <span className="tag tag-info" style={{ fontSize: 12 }}>
                          {d.name}
                        </span>
                      </td>
                      <td style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "var(--soft-text)" }}>
                        {d.count.toLocaleString(locale)}
                      </td>
                      <td style={{ padding: "8px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, height: 6, background: "var(--soft-line)", borderRadius: 99, overflow: "hidden", maxWidth: 120 }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: gradeColor(d.name), borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 12, color: "var(--soft-muted)", minWidth: 36 }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 14px", fontSize: 12, color: "var(--soft-muted)" }}>{t(gradeGroup(d.name))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Recognition & special duties */}
          <div className="card soft-card">
            <CardTitle
              icon={<Star size={16} color={ORANGE} />}
              right={<span className="tag tag-warn">{cemerlangTeachers.length.toLocaleString(locale)} {t("grTeachersWord")}</span>}
            >
              {t("grCemerlang")}
            </CardTitle>
            {cemerlangByBidang.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--soft-faint)", fontSize: 12.5 }}>{t("grNoCemerlang")}</div>
            ) : (
              <BarList items={cemerlangByBidang} total={cemerlangTeachers.length} colorOffset={0} labelWidth={170} />
            )}
          </div>

          <div className="card soft-card">
            <CardTitle
              icon={<AwardIcon size={16} color={NAVY} />}
              right={<span className="tag tag-info">{withDuty.length.toLocaleString(locale)} {t("grTeachersWord")}</span>}
            >
              {t("grTugasKhas")}
            </CardTitle>
            {tugasKhasCounts.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "var(--soft-faint)", fontSize: 12.5 }}>{t("grNoTugasKhas")}</div>
            ) : (
              <BarList items={tugasKhasCounts} total={withDuty.length} colorOffset={2} labelWidth={200} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function BarList({ items, total, colorOffset, labelWidth }: {
  items: { name: string; count: number }[]; total: number; colorOffset: number; labelWidth: number;
}) {
  const max = Math.max(...items.map((d) => d.count), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {items.map((d, i) => (
        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10 }} title={`${d.name}: ${d.count} (${((d.count / (total || 1)) * 100).toFixed(1)}%)`}>
          <span style={{ fontSize: 11.5, color: "var(--soft-text-2)", width: labelWidth, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
          <div style={{ flex: 1, height: 8, background: "var(--surface-3)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${(d.count / max) * 100}%`, height: "100%", background: CHART_COLORS[(i + colorOffset) % CHART_COLORS.length], borderRadius: 99 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--soft-text)", minWidth: 36, textAlign: "right" }}>{d.count.toLocaleString()}</span>
        </div>
      ))}
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

function ChartTitle({ children }: { children: React.ReactNode }) {
  return <CardTitle>{children}</CardTitle>;
}
