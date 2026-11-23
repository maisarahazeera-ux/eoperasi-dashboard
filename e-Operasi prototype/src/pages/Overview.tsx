import { useState, useMemo } from "react";
import { Loader2, AlertTriangle, Users, School, UserMinus, Cake } from "lucide-react";
import FilterSidebar, { DEFAULT_FILTERS, describeFilters, type Filters } from "../lib/FilterSidebar";
import { countTable, type Report } from "../lib/report";
import { useTeachers, useTeacherLookups } from "../lib/useTeachers";
import { CHART, GENDER_CHART_COLORS, EMPLOYMENT_CHART_COLORS, heatColor } from "../lib/colors";
import { shortSchoolName } from "../lib/schoolName";
import { employmentLabel, sortEmploymentStatuses } from "../lib/labels";
import { useLanguage } from "../context/LanguageContext";
import { TeacherListModal, SchoolListModal } from "../components/ListModal";

// 5-year age groups for the "Taburan Umur" chart.
const AGE_GROUPS = [
  { label: "20–24", min: 0,  max: 24 },
  { label: "25–29", min: 25, max: 29 },
  { label: "30–34", min: 30, max: 34 },
  { label: "35–39", min: 35, max: 39 },
  { label: "40–44", min: 40, max: 44 },
  { label: "45–49", min: 45, max: 49 },
  { label: "50–54", min: 50, max: 54 },
  { label: "55–59", min: 55, max: 59 },
  { label: "60+",   min: 60, max: 999 },
];

// School-type tiles: soft tint background + a stronger colour for the name and top stripe.
const TYPE_TILE: Record<string, { tint: string; ink: string }> = {
  "SMK":    { tint: "var(--tint-blue)",   ink: "var(--ink-blue)" },
  "SK":     { tint: "var(--tint-teal)",   ink: "var(--ink-teal)" },
  "SJK(C)": { tint: "var(--tint-amber)",  ink: "var(--ink-amber)" },
  "SRK":    { tint: "var(--tint-rose)",   ink: "var(--ink-rose)" },
  "SJK(T)": { tint: "var(--tint-violet)", ink: "var(--ink-violet)" },
};

const AGE_BAR = "#8FB0E8";
const AGE_BAR_PEAK = "#4C7FD6";

export default function Overview() {
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const fmt = (n: number) => n.toLocaleString(locale);
  const pct = (n: number, total: number) => (total ? (n / total) * 100 : 0);
  const pctText = (n: number, total: number) => `${pct(n, total).toFixed(1)}%`;

  const { teachers, error } = useTeachers();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  // List opened from a KPI card.
  const [openList, setOpenList] = useState<"teachers" | "schools" | "retiring" | null>(null);
  const { schoolTypes, schoolsByType, subjects, employmentStatuses } = useTeacherLookups(teachers);

  const filtered = useMemo(() => {
    if (!teachers) return [];
    return teachers.filter((x) => {
      if (filters.schoolType && x.schoolType !== filters.schoolType) return false;
      if (filters.schoolName && x.school !== filters.schoolName) return false;
      if (filters.gender && x.gender !== filters.gender) return false;
      if (filters.subject && !x.subjects.some((s) => s.name === filters.subject)) return false;
      if (filters.employmentStatus && x.employmentStatus !== filters.employmentStatus) return false;
      return true;
    });
  }, [teachers, filters]);

  const total = filtered.length;

  const stats = useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const limit = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate());

    const schools = new Set<string>();
    const types = new Set<string>();
    let retiring = 0;
    let ageSum = 0, ageCount = 0;
    let male = 0, female = 0;
    let kodDiisi = 0;
    const byEmployment: Record<string, number> = {};
    const bySchool: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const ageBuckets = AGE_GROUPS.map(() => 0);

    for (const x of filtered) {
      schools.add(x.school);
      types.add(x.schoolType);
      bySchool[x.school] = (bySchool[x.school] || 0) + 1;
      byType[x.schoolType] = (byType[x.schoolType] || 0) + 1;
      const emp = x.employmentStatus || "";
      byEmployment[emp] = (byEmployment[emp] || 0) + 1;
      if (x.gender === "L") male++;
      else if (x.gender === "P") female++;
      if (x.kodJawatanDiisi) kodDiisi++;

      if (x.retirementDate) {
        const d = new Date(x.retirementDate);
        if (d >= now && d <= limit) retiring++;
      }
      if (x.dateOfBirth) {
        const age = (nowMs - new Date(x.dateOfBirth).getTime()) / (365.25 * 864e5);
        if (!isNaN(age)) {
          ageSum += age; ageCount++;
          const whole = Math.floor(age);
          const i = AGE_GROUPS.findIndex((g) => whole >= g.min && whole <= g.max);
          if (i >= 0) ageBuckets[i]++;
        }
      }
    }

    const topSchools = Object.entries(bySchool).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, count]) => ({ name, short: shortSchoolName(name), count }));

    return {
      schools: schools.size,
      typeCount: types.size,
      retiring,
      avgAge: ageCount ? ageSum / ageCount : 0,
      male, female, kodDiisi,
      byEmployment, byType, topSchools, ageBuckets,
    };
  }, [filtered]);

  // Teachers behind the "Akan Bersara (5 Tahun)" card (same rule as the count).
  const retiringTeachers = useMemo(() => {
    const now = new Date();
    const limit = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate());
    return filtered.filter((x) => { if (!x.retirementDate) return false; const d = new Date(x.retirementDate); return d >= now && d <= limit; });
  }, [filtered]);

  if (error) {
    return (
      <Centered color="#B3261E">
        <AlertTriangle size={28} />
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
          {error === "network" ? t("ovErrServer") : `${t("ovErrLoad")} (${error}).`}
        </div>
      </Centered>
    );
  }
  if (!teachers) {
    return (
      <Centered color="var(--soft-muted)">
        <Loader2 size={26} className="spin" />
        <div style={{ fontSize: 13 }}>{t("ovLoading")}</div>
      </Centered>
    );
  }

  const permanent = stats.byEmployment["Tetap"] || 0;
  const topMin = stats.topSchools.length ? Math.min(...stats.topSchools.map((d) => d.count)) : 0;
  const topMax = stats.topSchools.length ? Math.max(...stats.topSchools.map((d) => d.count)) : 0;
  const ageMax = Math.max(1, ...stats.ageBuckets);

  const employmentRows = sortEmploymentStatuses(Object.keys(stats.byEmployment)).map((k) => ({
    label: k ? employmentLabel(k, t) : t("unknown"),
    count: stats.byEmployment[k],
    color: EMPLOYMENT_CHART_COLORS[k] ?? CHART.gray,
  }));
  const typeRows = schoolTypes
    .map((st) => ({ name: st, count: stats.byType[st] || 0, ...(TYPE_TILE[st] ?? { tint: "var(--tint-gray)", ink: "var(--ink-gray)" }) }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const kpis = [
    { label: t("ovTotalTeachers"), value: fmt(total), note: `${pctText(permanent, total)} ${t("ovPermanentShare")}`, Icon: Users, tint: "var(--tint-blue)", ink: "var(--ink-blue)", list: "teachers" as const },
    { label: t("ovTotalSchools"), value: fmt(stats.schools), note: `${stats.typeCount} ${t("ovSchoolTypesCount")}`, Icon: School, tint: "var(--tint-teal)", ink: "var(--ink-teal)", list: "schools" as const },
    { label: t("ovRetiringSoon"), value: fmt(stats.retiring), note: `${pctText(stats.retiring, total)} ${t("ovOfTotal")}`, Icon: UserMinus, tint: "var(--tint-amber)", ink: "var(--ink-amber)", list: "retiring" as const },
    { label: t("ovAvgAge"), value: `${stats.avgAge.toFixed(1)} ${t("ovYears")}`, note: t("ovFromDob"), Icon: Cake, tint: "var(--tint-violet)", ink: "var(--ink-violet)", list: null },
  ];


  const h = { count: t("rpColCount"), pct: t("rpColPct") };
  const buildReport = (): Report => ({
    title: t("titleOverview"),
    filters: describeFilters(filters, t),
    tables: [
      {
        name: t("rpSummary"), title: t("rpSummary"),
        columns: [{ header: t("rpColItem"), width: 34 }, { header: t("rpColValue"), width: 14, format: "dec" }],
        rows: [
          [t("ovTotalTeachers"), total],
          [t("ovTotalSchools"), stats.schools],
          [t("ovRetiringSoon"), stats.retiring],
          [`${t("ovAvgAge")} (${t("ovYears")})`, Math.round(stats.avgAge * 10) / 10],
          [t("ovKodJawatanFilled"), stats.kodDiisi],
          [t("ovKodJawatanVacant"), total - stats.kodDiisi],
        ],
      },
      {
        name: t("ovTopSchoolsTitle"), title: t("ovTopSchoolsTitle"),
        columns: [{ header: t("rpColRank"), width: 11, format: "int" }, { header: t("filterSchoolName"), width: 48 }, { header: h.count, format: "int", width: 15 }, { header: h.pct, format: "pct", width: 11 }],
        rows: stats.topSchools.map((s, i) => [i + 1, s.name, s.count, total ? s.count / total : 0]),
      },
      countTable(t("filterGender"), t("ovChartGender"), t("filterGender"), [[t("genderL"), stats.male], [t("genderP"), stats.female]], total, h),
      countTable(t("filterEmployment"), t("ovChartEmployment"), t("filterEmployment"), employmentRows.map((r) => [r.label, r.count]), total, h),
      countTable(t("filterSchoolType"), t("ovChartSchoolType"), t("filterSchoolType"), typeRows.map((r) => [r.name, r.count]), total, h),
      countTable(t("ovAgeDist"), t("ovAgeDist"), t("rpColAgeGroup"), AGE_GROUPS.map((g, i) => [g.label, stats.ageBuckets[i]]), total, h),
    ],
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <FilterSidebar
        title={t("titleOverview")}
        report={buildReport}
        filters={filters}
        onChange={setFilters}
        schoolTypes={schoolTypes}
        schoolsByType={schoolsByType}
        subjects={subjects}
        employmentStatuses={employmentStatuses}
      />

      <main className="mac-main">
        <div className="page-container" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            {kpis.map(({ label, value, note, Icon, tint, ink, list }) => {
              const Tag = list ? "button" : "div";
              return (
              <Tag key={label} type={list ? "button" : undefined} onClick={list ? () => setOpenList(list) : undefined}
                className={`card${list ? " stat-click" : ""}`}
                style={{ padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start", position: "relative", textAlign: "left", font: "inherit", color: "inherit", width: "100%" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: tint, color: ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--soft-muted)" }}>{label}</span>
                  <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1.1, whiteSpace: "nowrap" }}>{value}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: ink }}>{note}</span>
                </div>
                {list && <span className="stat-action">{t("lsViewList")} →</span>}
              </Tag>
              );
            })}
          </div>

          {openList === "teachers" && (
            <TeacherListModal title={t("ovTotalTeachers")} icon={<Users size={20} />} tone="blue"
              teachers={filtered} filters={describeFilters(filters, t)} onClose={() => setOpenList(null)} />
          )}
          {openList === "schools" && (
            <SchoolListModal teachers={filtered} icon={<School size={20} />} filters={describeFilters(filters, t)} onClose={() => setOpenList(null)} />
          )}
          {openList === "retiring" && (
            <TeacherListModal kind="retire" title={t("ovRetiringSoon")} icon={<UserMinus size={20} />} tone="amber"
              teachers={retiringTeachers} filters={describeFilters(filters, t)} onClose={() => setOpenList(null)} />
          )}

          <div className="ov-grid-main">
            {/* Top 10 schools */}
            <section className="card" style={{ padding: "20px 24px" }}>
              <h2 className="soft-card-title">{t("ovTopSchoolsTitle")}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {stats.topSchools.map((s, i) => (
                  <div key={s.name} title={s.name}
                    style={{ display: "grid", gridTemplateColumns: "26px minmax(140px, 200px) minmax(0, 1fr) 40px", alignItems: "center", gap: 12, fontSize: 13 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 8, background: "var(--surface-3)", color: "var(--soft-text-2)", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                    <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.short}</span>
                    <div style={{ height: 8, background: "var(--soft-track)", borderRadius: 999, overflow: "hidden" }}>
                      <div className="chart-mark" style={{ height: "100%", borderRadius: 999, width: `${pct(s.count, topMax)}%`, background: heatColor(s.count, topMin, topMax) }} />
                    </div>
                    <span style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(s.count)}</span>
                  </div>
                ))}
                {stats.topSchools.length === 0 && <Empty />}
              </div>
            </section>

            {/* Gender + employment status */}
            <section className="card" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <h2 className="soft-card-title" style={{ marginBottom: 0 }}>{t("ovComposition")}</h2>
              <Donut
                center={pctText(stats.female, total)}
                centerSub={t("genderP").toLowerCase()}
                rows={[
                  { label: t("genderL"), count: stats.male, color: GENDER_CHART_COLORS.L },
                  { label: t("genderP"), count: stats.female, color: GENDER_CHART_COLORS.P },
                ]}
                total={total}
                fmt={fmt}
              />
              <div style={{ height: 1, background: "var(--soft-line)" }} />
              <Donut
                center={pctText(permanent, total)}
                centerSub={t("ovPermanentShort")}
                rows={employmentRows}
                total={total}
                fmt={fmt}
              />
            </section>
          </div>

          <div className="ov-grid-bottom">
            {/* School types */}
            <section className="card" style={{ padding: "20px 24px" }}>
              <h2 className="soft-card-title">{t("ovTypesTitle")}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 10 }}>
                {typeRows.map((r) => (
                  <div key={r.name} style={{ borderRadius: 12, padding: 12, background: r.tint, borderTop: `4px solid ${r.ink}`, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: r.ink }}>{r.name}</span>
                    <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmt(r.count)}</span>
                    <span style={{ fontSize: 11, color: "var(--soft-text-2)" }}>{pctText(r.count, total)} {t("ovTeachersWord")}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Age distribution */}
            <section className="card" style={{ padding: "20px 24px", display: "flex", flexDirection: "column" }}>
              <h2 className="soft-card-title">{t("ovAgeDist")}</h2>
              <div style={{ height: 104, display: "flex", alignItems: "flex-end", gap: 10 }}>
                {stats.ageBuckets.map((n, i) => (
                  <div key={AGE_GROUPS[i].label} title={`${AGE_GROUPS[i].label}: ${fmt(n)}`}
                    style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--soft-text-2)", fontVariantNumeric: "tabular-nums" }}>{fmt(n)}</span>
                    <div className="chart-mark" style={{ width: "100%", borderRadius: 8, background: n === ageMax ? AGE_BAR_PEAK : AGE_BAR, height: `${Math.max(4, (n / ageMax) * 78)}px` }} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                {AGE_GROUPS.map((g) => (
                  <span key={g.label} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "var(--soft-muted)" }}>{g.label}</span>
                ))}
              </div>
            </section>
          </div>

          {/* Kod Jawatan — kept small until the supervisor confirms a proper data source */}
          <section className="card" style={{ padding: "14px 24px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", fontSize: 13 }}>
            <strong style={{ fontSize: 14 }}>{t("ovKodJawatanTitle")}</strong>
            <span>{t("ovKodJawatanFilled")}: <strong>{fmt(stats.kodDiisi)}</strong></span>
            <span>{t("ovKodJawatanVacant")}: <strong>{fmt(total - stats.kodDiisi)}</strong></span>
            <div style={{ flex: "1 1 200px", height: 8, borderRadius: 999, background: "var(--soft-track)", overflow: "hidden" }}>
              <div className="chart-mark" style={{ height: "100%", width: `${pct(stats.kodDiisi, total)}%`, background: CHART.teal }} />
            </div>
            <span style={{ color: "var(--soft-muted)", fontSize: 12 }}>{pctText(stats.kodDiisi, total)} {t("ovKodJawatanPctSuffix")}</span>
          </section>
        </div>
      </main>
    </div>
  );
}

function Donut({ center, centerSub, rows, total, fmt }: {
  center: string;
  centerSub: string;
  rows: { label: string; count: number; color: string }[];
  total: number;
  fmt: (n: number) => string;
}) {
  // Ring drawn with a conic gradient: each slice starts where the last one ended.
  let acc = 0;
  const stops = rows.map((r) => {
    const from = acc;
    acc += total ? (r.count / total) * 100 : 0;
    return `${r.color} ${from}% ${acc}%`;
  });
  const ring = total ? `conic-gradient(${stops.join(", ")}, var(--soft-track) ${acc}% 100%)` : "var(--soft-track)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <div className="chart-mark" style={{ width: 100, height: 100, borderRadius: "50%", flexShrink: 0, background: ring, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="chart-hole" style={{ width: 70, height: 70, borderRadius: "50%", background: "var(--surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{center}</span>
          <span style={{ fontSize: 11, color: "var(--soft-muted)" }}>{centerSub}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, minWidth: 0 }}>
        {rows.map((r) => (
          <span key={r.label}>
            <span className="chart-mark" style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: r.color, marginRight: 8 }} />
            {r.label} · <strong>{fmt(r.count)}</strong>
          </span>
        ))}
      </div>
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

function Empty() {
  return <div style={{ padding: 16, fontSize: 13, color: "var(--soft-muted)" }}>—</div>;
}
