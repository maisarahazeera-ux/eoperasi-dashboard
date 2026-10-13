import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { GraduationCap, Loader2, AlertTriangle, Cake, BarChart3, Users } from "lucide-react";
import { StatTile, StatRow, CardTitle } from "../components/ui";
import FilterSidebar, { DEFAULT_FILTERS, describeFilters, type Filters } from "../lib/FilterSidebar";
import { countTable, type Report } from "../lib/report";
import { useTeachers, useTeacherLookups } from "../lib/useTeachers";
import { NAVY, TEAL, ORANGE, CHART_COLORS } from "../lib/colors";
import { valueLabel } from "../lib/labels";
import { useLanguage } from "../context/LanguageContext";

const AGE_BINS = ["≤25", "26–30", "31–35", "36–40", "41–45", "46–50", "51–55", "56+"];

// The real data has 24 race groups, most with fewer than 40 teachers.
// Show the biggest three and fold the rest into "Lain-lain".
const RACE_TOP_N = 3;

// Colours follow the entity, not its position, so a race keeps the same
// colour when a filter changes the ordering.
const RACE_COLORS: Record<string, string> = {
  Melayu: CHART_COLORS[0],
  Cina: CHART_COLORS[1],
  India: CHART_COLORS[2],
};
const RACE_OTHER_COLOR = CHART_COLORS[3];

// Official qualification names can be very long; show a short form in the
// legend and keep the full name in the tooltip.
const QUAL_SHORT: Record<string, string> = {
  "Diploma Perguruan (keluaran SPLI/KPLI/ KPLD)": "Diploma Perguruan (KPLI/KPLD)",
  "Diploma Perguruan Malaysia (keluaran KDPM)": "Diploma Perguruan Malaysia (KDPM)",
  "IJAZAH SARJANA MUDA (B.A.,B.Ec.,B.Sc.,B.Ed.)/ DIPLOMA LANJUTAN YANG SETARAF DAN DIIKTIRAF OLEH KERAJAAN MALAYSIA": "Ijazah Sarjana Muda (lain-lain)",
  "IJAZAH SARJANA LANJUTAN (M.A,.M.Ec.,M.Ed. M.Sc.)": "Ijazah Sarjana (lain-lain)",
  "Sijil Program Intervensi Tambah Opsyen (PITO)": "Sijil PITO",
};

function ageOf(dob: string | null, now: number): number | null {
  if (!dob) return null;
  const d = new Date(dob).getTime();
  return isNaN(d) ? null : Math.floor((now - d) / (365.25 * 864e5));
}

function ageBin(age: number) {
  if (age <= 25) return "≤25";
  if (age <= 30) return "26–30";
  if (age <= 35) return "31–35";
  if (age <= 40) return "36–40";
  if (age <= 45) return "41–45";
  if (age <= 50) return "46–50";
  if (age <= 55) return "51–55";
  return "56+";
}

export default function Demografi() {
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const { teachers, error } = useTeachers();
  const { schoolTypes, schoolsByType, subjects, employmentStatuses } = useTeacherLookups(teachers);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const filtered = useMemo(() => (teachers ?? []).filter((x) => {
    if (filters.schoolType && x.schoolType !== filters.schoolType) return false;
    if (filters.schoolName && x.school !== filters.schoolName) return false;
    if (filters.gender && x.gender !== filters.gender) return false;
    if (filters.subject && !x.subjects.some((s) => s.name === filters.subject)) return false;
    if (filters.employmentStatus && x.employmentStatus !== filters.employmentStatus) return false;
    return true;
  }), [teachers, filters]);

  const ages = useMemo(() => {
    const now = Date.now();
    return filtered.map((x) => ageOf(x.dateOfBirth, now)).filter((a): a is number => a != null);
  }, [filtered]);

  const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : 0;
  const medAge = useMemo(() => {
    if (!ages.length) return 0;
    const s = [...ages].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }, [ages]);

  const n = filtered.length || 1;
  const pctFemale = Math.round((filtered.filter((x) => x.gender === "P").length / n) * 100);
  const ikhtisasCount = filtered.filter((x) => x.ikhtisas).length;
  const pctIkhtisas = Math.round((ikhtisasCount / n) * 100);

  const ageData = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(AGE_BINS.map((b) => [b, 0]));
    ages.forEach((a) => { counts[ageBin(a)]++; });
    return AGE_BINS.map((name) => ({ name, count: counts[name] }));
  }, [ages]);

  const raceData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((x) => { const k = x.race || "-"; map[k] = (map[k] || 0) + 1; });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, RACE_TOP_N).map(([key, count]) => ({
      name: valueLabel(key, lang), count, fill: RACE_COLORS[key] ?? RACE_OTHER_COLOR,
    }));
    const rest = sorted.slice(RACE_TOP_N).reduce((s, [, c]) => s + c, 0);
    return rest > 0 ? [...top, { name: t("dmOthers"), count: rest, fill: RACE_OTHER_COLOR }] : top;
  }, [filtered, lang, t]);

  // Each qualification gets a fixed colour based on its rank in the FULL
  // dataset, so filtering never repaints the same qualification.
  const qualColor = useMemo(() => {
    const map: Record<string, number> = {};
    (teachers ?? []).forEach((x) => {
      const k = x.qualification && x.qualification !== "Tiada" ? x.qualification : "-";
      map[k] = (map[k] || 0) + 1;
    });
    const order = Object.entries(map).sort((a, b) => b[1] - a[1]).map(([k]) => k);
    return (k: string) => CHART_COLORS[Math.max(0, order.indexOf(k)) % CHART_COLORS.length];
  }, [teachers]);

  const qualData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((x) => {
      const k = x.qualification && x.qualification !== "Tiada" ? x.qualification : "-";
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([full, value]) => {
        const name = full === "-" ? t("unknown") : QUAL_SHORT[full] ?? full;
        return { name, fullName: full === "-" ? name : full, value, fill: qualColor(full) };
      });
  }, [filtered, t, qualColor]);

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

  const buildReport = (): Report => {
    const total = filtered.length;
    const h = { count: t("rpColCount"), pct: t("rpColPct") };
    // Full race list here (the chart folds small groups into "Lain-lain").
    const raceAll: Record<string, number> = {};
    filtered.forEach((x) => { const k = x.race || "-"; raceAll[k] = (raceAll[k] || 0) + 1; });
    return {
      title: t("titleDemografi"),
      filters: describeFilters(filters, t),
      tables: [
        {
          name: t("rpSummary"), title: t("rpSummary"),
          columns: [{ header: t("rpColItem"), width: 34 }, { header: t("rpColValue"), width: 14 }],
          rows: [
            [t("ovTotalTeachers"), total],
            [`${t("dmAvgAge")} (${t("dmYears")})`, avgAge],
            [`${t("dmMedianAge")} (${t("dmYears")})`, medAge],
            [t("dmPctFemale"), `${pctFemale}%`],
            [t("dmPctIkhtisas"), `${pctIkhtisas}%`],
          ],
        },
        countTable(t("dmChartAge"), t("dmChartAgeHist"), t("rpColAgeGroup"), ageData.map((d) => [d.name, d.count]), total, h),
        countTable(t("dmChartRace"), t("dmChartRace"), t("cgRace"),
          Object.entries(raceAll).sort((a, b) => b[1] - a[1]).map(([k, c]) => [k === "-" ? t("unknown") : valueLabel(k, lang), c]), total, h),
        countTable(t("dmChartQual"), t("dmChartQualProfile"), t("cgQualification"), qualData.map((d) => [d.fullName, d.value]), total, h, 70),
        countTable(t("dmChartIkhtisas"), t("dmChartIkhtisas"), t("rpColCategory"),
          [[t("rpYes"), ikhtisasCount], [t("rpNo"), total - ikhtisasCount]], total, h),
      ],
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <FilterSidebar
        title={t("titleDemografi")}
        report={buildReport}
        filters={filters}
        onChange={setFilters}
        schoolTypes={schoolTypes}
        schoolsByType={schoolsByType}
        subjects={subjects}
        employmentStatuses={employmentStatuses}
      />

      <main className="mac-main">
        <p style={{ fontSize: 13, color: "var(--soft-muted)", margin: "0 0 14px" }}>{filtered.length.toLocaleString(locale)} {t("dmInView")}</p>

        {/* Stat row */}
        <StatRow>
          <StatTile icon={<Cake size={20} />} tone="blue" label={t("dmAvgAge")} value={`${avgAge} ${t("dmYears")}`} />
          <StatTile icon={<BarChart3 size={20} />} tone="teal" label={t("dmMedianAge")} value={`${medAge} ${t("dmYears")}`} />
          <StatTile icon={<Users size={20} />} tone="rose" label={t("dmPctFemale")} value={`${pctFemale}%`} />
        </StatRow>

        <div className="soft-grid">
          {/* Age histogram — full width */}
          <ChartCard title={t("dmChartAgeHist")} wide>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ageData} margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [Number(v).toLocaleString(locale), t("ovTeachersUnit")]} cursor={{ fill: "var(--hover)" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {ageData.map((_, i) => <Cell key={i} fill={i < 2 ? TEAL : i < 5 ? NAVY : ORANGE} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 11, color: "var(--soft-faint)", marginTop: 8, textAlign: "center" }}>{t("dmAgeAxis")}</div>
          </ChartCard>

          {/* Race bar */}
          <ChartCard title={t("dmChartRace")}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={raceData} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [Number(v).toLocaleString(locale), t("ovTeachersUnit")]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {raceData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Qualification profile */}
          <ChartCard title={t("dmChartQualProfile")}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <ResponsiveContainer width="45%" height={230}>
                <PieChart>
                  <Pie data={qualData} cx="50%" cy="50%" innerRadius={48} outerRadius={80} dataKey="value" nameKey="fullName" paddingAngle={2}>
                    {qualData.map((d) => <Cell key={d.fullName} fill={d.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${Number(v).toLocaleString(locale)} (${((Number(v) / n) * 100).toFixed(1)}%)`, ""]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
                {qualData.map((d) => (
                  <div key={d.fullName} title={d.fullName} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: d.fill, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--soft-text-2)", flex: 1 }}>{d.name}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--soft-text)" }}>{((d.value / n) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>

          {/* Ikhtisas */}
          <ChartCard title={t("dmChartIkhtisas")}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "10px 4px" }}>
              <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[{ name: "Ikhtisas", value: pctIkhtisas }, { name: "Tiada", value: 100 - pctIkhtisas }]}
                      cx="50%" cy="50%" innerRadius={44} outerRadius={62} dataKey="value" startAngle={90} endAngle={-270}
                    >
                      <Cell fill={TEAL} />
                      <Cell fill="#E4E9F1" className="pie-track" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>{pctIkhtisas}%</span>
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  <GraduationCap size={16} color={TEAL} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--soft-text)" }}>
                    {ikhtisasCount.toLocaleString(locale)} {t("dmIkhtisasCount")}
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: "var(--soft-muted)", margin: 0, lineHeight: 1.5, maxWidth: 240 }}>
                  {t("dmIkhtisasDesc")} {filtered.length.toLocaleString(locale)} {t("dmTeachersWord")}.
                </p>
              </div>
            </div>
          </ChartCard>
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

function ChartCard({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`card soft-card${wide ? " wide" : ""}`}>
      <CardTitle>{title}</CardTitle>
      {children}
    </div>
  );
}
