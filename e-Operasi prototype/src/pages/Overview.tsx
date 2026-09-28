import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList,
} from "recharts";
import { Users, School, Briefcase, Loader2, AlertTriangle, UserMinus, Cake } from "lucide-react";
import FilterSidebar, { DEFAULT_FILTERS, type Filters } from "../lib/FilterSidebar";
import { useTeachers, useTeacherLookups } from "../lib/useTeachers";
import { NAVY, TEAL, ORANGE, CHART, SCHOOL_TYPE_CHART_COLORS, GENDER_CHART_COLORS, EMPLOYMENT_CHART_COLORS, heatColor, HEAT_GRADIENT_CSS } from "../lib/colors";
import { shortSchoolName } from "../lib/schoolName";
import { employmentLabel } from "../lib/labels";
import { useLanguage } from "../context/LanguageContext";

export default function Overview() {
  const { t, lang } = useLanguage();
  const tr = t; // alias for use inside callbacks where "t" is a teacher
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const { teachers, error } = useTeachers();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // Real lookup lists for the filter dropdowns, derived from the actual data.
  const { schoolTypes, schoolsByType, subjects, employmentStatuses } = useTeacherLookups(teachers);

  const filtered = useMemo(() => {
    if (!teachers) return [];
    return teachers.filter((t) => {
      if (filters.schoolType && t.schoolType !== filters.schoolType) return false;
      if (filters.schoolName && t.school !== filters.schoolName) return false;
      if (filters.gender && t.gender !== filters.gender) return false;
      if (filters.subject && !t.subjects.some((s) => s.name === filters.subject)) return false;
      if (filters.employmentStatus && t.employmentStatus !== filters.employmentStatus) return false;
      return true;
    });
  }, [teachers, filters]);

  const totalSchools = useMemo(() => new Set(filtered.map((t) => t.school)).size, [filtered]);

  // Teachers whose retirement date falls within the next 5 years (from today).
  const retiringSoon = useMemo(() => {
    const now = new Date();
    const limit = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate());
    return filtered.filter((x) => {
      if (!x.retirementDate) return false;
      const d = new Date(x.retirementDate);
      return d >= now && d <= limit;
    }).length;
  }, [filtered]);

  // Average age in years, based on date of birth.
  const avgAge = useMemo(() => {
    const now = Date.now();
    const ages = filtered
      .filter((x) => x.dateOfBirth)
      .map((x) => (now - new Date(x.dateOfBirth as string).getTime()) / (365.25 * 864e5));
    return ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
  }, [filtered]);

  const kodJawatanDiisi = useMemo(() => filtered.filter((t) => t.kodJawatanDiisi).length, [filtered]);
  const kodJawatanKosong = filtered.length - kodJawatanDiisi;

  const genderData = useMemo(() => [
    { name: t("genderL"), value: filtered.filter((x) => x.gender === "L").length },
    { name: t("genderP"), value: filtered.filter((x) => x.gender === "P").length },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [filtered, lang]);

  const topSchools = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => { map[t.school] = (map[t.school] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, count]) => ({ name: shortSchoolName(name), fullName: name, count }));
  }, [filtered]);

  const topMin = topSchools.length ? Math.min(...topSchools.map((d) => d.count)) : 0;
  const topMax = topSchools.length ? Math.max(...topSchools.map((d) => d.count)) : 0;

  const empStatusData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => {
      const key = t.employmentStatus || "";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).map(([key, value]) => ({
      name: key ? employmentLabel(key, tr) : tr("unknown"),
      value,
      fill: EMPLOYMENT_CHART_COLORS[key] ?? CHART.gray,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, lang]);

  const bySchoolType = useMemo(() => {
    return schoolTypes.map((type) => ({
      name: type,
      count: filtered.filter((t) => t.schoolType === type).length,
      fill: SCHOOL_TYPE_CHART_COLORS[type] ?? CHART.gray,
    })).filter((d) => d.count > 0);
  }, [filtered, schoolTypes]);

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 10, color: "#dc2626" }}>
        <AlertTriangle size={28} />
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
          {error === "network" ? t("ovErrServer") : `${t("ovErrLoad")} (${error}).`}
        </div>
      </div>
    );
  }

  if (!teachers) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 10, color: "#6b7280" }}>
        <Loader2 size={26} className="spin" />
        <div style={{ fontSize: 13 }}>{t("ovLoading")}</div>
      </div>
    );
  }

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
        <div className="page-container">
        {/* KPI row */}
        <div className="kpi-grid">
          <KpiCard icon={<Users size={22} color={NAVY} />} label={t("ovTotalTeachers")} value={filtered.length.toLocaleString(locale)} accent={NAVY} />
          <KpiCard icon={<School size={22} color={TEAL} />} label={t("ovTotalSchools")} value={totalSchools.toString()} accent={TEAL} />
          <KpiCard icon={<UserMinus size={22} color={ORANGE} />} label={t("ovRetiringSoon")} value={retiringSoon.toLocaleString(locale)} accent={ORANGE} />
          <KpiCard icon={<Cake size={22} color="#6366f1" />} label={t("ovAvgAge")} value={`${avgAge.toFixed(1)} ${t("ovYears")}`} accent="#6366f1" />
        </div>

        {/* Kod Jawatan status — reframed to what the real schema actually supports
            (a per-teacher KodJawatanDiisi flag), not a fabricated authorized/vacant
            post count that doesn't exist in the data. */}
        <div className="card" style={{ padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <Briefcase size={15} color={NAVY} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: NAVY }}>{t("ovKodJawatanTitle")}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16, marginBottom: 14 }}>
            <MiniStat label={t("ovKodJawatanFilled")} value={kodJawatanDiisi} color={TEAL} locale={locale} />
            <MiniStat label={t("ovKodJawatanVacant")} value={kodJawatanKosong} color={kodJawatanKosong > 0 ? "#dc2626" : TEAL} locale={locale} />
          </div>
          <div style={{ height: 10, borderRadius: 99, background: "#fee2e2", overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${filtered.length ? (kodJawatanDiisi / filtered.length) * 100 : 0}%`, background: TEAL }} />
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
            {filtered.length ? ((kodJawatanDiisi / filtered.length) * 100).toFixed(1) : "0"}% {t("ovKodJawatanPctSuffix")}
          </div>
        </div>

        {/* Charts 2×2 */}
        <div className="chart-grid">
          <ChartCard title={t("ovChartGender")}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={genderData} cx="50%" cy="50%" innerRadius={58} outerRadius={85} dataKey="value" paddingAngle={3}>
                  <Cell fill={GENDER_CHART_COLORS.L} />
                  <Cell fill={GENDER_CHART_COLORS.P} />
                </Pie>
                <Tooltip formatter={(v) => [Number(v).toLocaleString(locale), ""]} />
                <Legend formatter={(v) => <span style={{ color: "#374151", fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={t("ovChartEmployment")}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={empStatusData} cx="50%" cy="50%" outerRadius={85} dataKey="value" paddingAngle={3}>
                  {empStatusData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                </Pie>
                <Tooltip formatter={(v) => [Number(v).toLocaleString(locale), ""]} />
                <Legend formatter={(v) => <span style={{ color: "#374151", fontSize: 12 }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title={t("ovChartTopSchools")} wide>
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={topSchools} layout="vertical" margin={{ left: 12, right: 28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} interval={0} />
                <Tooltip
                  formatter={(v) => [Number(v).toLocaleString(locale), t("ovTeachersUnit")]}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName ?? label}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {topSchools.map((d) => <Cell key={d.fullName} fill={heatColor(d.count, topMin, topMax)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, fontSize: 11, color: "#6b7280", marginTop: 6 }}>
              <span>{t("ovFewer")} ({topMin})</span>
              <div style={{ width: 120, height: 8, borderRadius: 99, background: HEAT_GRADIENT_CSS }} />
              <span>{t("ovMore")} ({topMax})</span>
            </div>
          </ChartCard>

          <ChartCard title={t("ovChartSchoolType")} wide>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bySchoolType} margin={{ top: 20, left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [Number(v).toLocaleString(locale), t("ovTeachersUnit")]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {bySchoolType.map((d) => <Cell key={d.name} fill={d.fill} />)}
                  <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: "#374151" }} formatter={(v) => Number(v).toLocaleString(locale)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        </div>
      </main>
    </div>
  );
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div style={{ background: accent + "18", borderRadius: 8, padding: 8, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value, color, locale }: { label: string; value: number; color: string; locale: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value.toLocaleString(locale)}</div>
      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ChartCard({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="card" style={{ padding: "16px 18px", gridColumn: wide ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: NAVY, marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid #f3f4f6" }}>{title}</div>
      {children}
    </div>
  );
}
