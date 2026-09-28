import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import { Award as AwardIcon, Star, Loader2, AlertTriangle } from "lucide-react";
import FilterSidebar, { DEFAULT_FILTERS, type Filters } from "../lib/FilterSidebar";
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

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <FilterSidebar
        filters={filters}
        onChange={setFilters}
        schoolTypes={schoolTypes}
        schoolsByType={schoolsByType}
        subjects={subjects}
        employmentStatuses={employmentStatuses}
      />

      <main style={{ flex: 1, overflowY: "auto", background: "#F5F5F5", padding: 24 }}>
        <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: NAVY, margin: 0 }}>{t("grTitle")}</h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
              {filtered.length.toLocaleString(locale)} {t("dmInView")}
            </p>
          </div>
          {/* Hakiki = substantive grade on appointment; Penyandang = grade currently held */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{t("grBasis")}:</span>
            <div style={{ display: "flex", background: "#e5e7eb", borderRadius: 8, padding: 3 }}>
              {(["penyandang", "hakiki"] as Basis[]).map((b) => (
                <button key={b} onClick={() => setBasis(b)}
                  style={{
                    border: "none", cursor: "pointer", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600,
                    background: basis === b ? "#fff" : "transparent", color: basis === b ? NAVY : "#6b7280",
                    boxShadow: basis === b ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
                  }}>
                  {t(b === "hakiki" ? "grHakiki" : "grPenyandang")}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stat strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
          <StatCard label={t("grTopGrade")} value={topGred.name} sub={`${topGred.count.toLocaleString(locale)} ${t("grTeachersWord")}`} accent={NAVY} />
          <StatCard label={t("grSenior")} value={seniorCount.toLocaleString(locale)} sub={t("grTeachersWord")} accent={TEAL} />
          <StatCard label={t("grEntry")} value={entryCount.toLocaleString(locale)} sub={t("grTeachersWord")} accent={ORANGE} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Chart 1 — bar by grade */}
          <div className="card" style={{ padding: "16px 18px" }}>
            <ChartTitle>{t("grChartByGrade")}</ChartTitle>
            <ResponsiveContainer width="100%" height={280}>
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
          <div className="card" style={{ padding: "16px 18px" }}>
            <ChartTitle>{t("grChartByType")}</ChartTitle>
            <ResponsiveContainer width="100%" height={280}>
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
          <div className="card" style={{ padding: "16px 18px", gridColumn: "1 / -1" }}>
            <ChartTitle>{t("grSummary")}</ChartTitle>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {(["grColGrade", "grColCount", "grColPct", "grColGroup"] as DictKey[]).map((h) => (
                    <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
                      {t(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byGred.map((d, i) => {
                  const pct = ((d.count / n) * 100).toFixed(1);
                  return (
                    <tr key={d.name} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 14px" }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700, background: "#f3f4f6", color: NAVY, padding: "2px 9px", borderRadius: 4 }}>
                          {d.name}
                        </span>
                      </td>
                      <td style={{ padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#111827" }}>
                        {d.count.toLocaleString(locale)}
                      </td>
                      <td style={{ padding: "8px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 99, overflow: "hidden", maxWidth: 120 }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: gradeColor(d.name), borderRadius: 99 }} />
                          </div>
                          <span style={{ fontSize: 12, color: "#6b7280", minWidth: 36 }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding: "8px 14px", fontSize: 12, color: "#6b7280" }}>{t(gradeGroup(d.name))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Recognition & special duties */}
          <div className="card" style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #f3f4f6" }}>
              <Star size={14} color={ORANGE} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>{t("grCemerlang")}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: ORANGE }}>
                {cemerlangTeachers.length.toLocaleString(locale)} {t("grTeachersWord")}
              </span>
            </div>
            {cemerlangByBidang.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "#9ca3af", fontSize: 12.5 }}>{t("grNoCemerlang")}</div>
            ) : (
              <BarList items={cemerlangByBidang} total={cemerlangTeachers.length} colorOffset={0} labelWidth={170} />
            )}
          </div>

          <div className="card" style={{ padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #f3f4f6" }}>
              <AwardIcon size={14} color={NAVY} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: NAVY }}>{t("grTugasKhas")}</span>
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: NAVY }}>
                {withDuty.length.toLocaleString(locale)} {t("grTeachersWord")}
              </span>
            </div>
            {tugasKhasCounts.length === 0 ? (
              <div style={{ padding: "20px 0", textAlign: "center", color: "#9ca3af", fontSize: 12.5 }}>{t("grNoTugasKhas")}</div>
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
          <span style={{ fontSize: 11.5, color: "#374151", width: labelWidth, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
          <div style={{ flex: 1, height: 8, background: "#f3f4f6", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ width: `${(d.count / max) * 100}%`, height: "100%", background: CHART_COLORS[(i + colorOffset) % CHART_COLORS.length], borderRadius: 99 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#111827", minWidth: 36, textAlign: "right" }}>{d.count.toLocaleString()}</span>
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

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="card" style={{ padding: "16px 20px", borderLeft: `4px solid ${accent}` }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#111827" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>{sub}</div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>{label}</div>
    </div>
  );
}

function ChartTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #f3f4f6" }}>
      {children}
    </div>
  );
}
