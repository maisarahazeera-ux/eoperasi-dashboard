import { useState, useMemo, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Loader2, HeartHandshake } from "lucide-react";
import { CardTitle, PillToggle, Tag } from "../components/ui";
import { ListToolbar, ListFooter, usePager } from "../components/ListControls";
import FilterSidebar, { DEFAULT_FILTERS, describeFilters, type Filters } from "../lib/FilterSidebar";
import { countTable, type Report, type ReportTable } from "../lib/report";
import ReportButton from "../components/ReportButton";
import { useTeachers, useTeacherLookups } from "../lib/useTeachers";
import { type Teacher } from "../lib/api";
import { NAVY, TEAL, ORANGE, schoolTypeChip } from "../lib/colors";
import { shortSchoolName } from "../lib/schoolName";
import { clean } from "../lib/labels";
import { matchOpsyen, type MatchStatus, type MatchResult, type NotTeachingReason } from "../lib/subjectFamilies";
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

const STATUS_KEY: Record<MatchStatus, DictKey> = {
  "Sepadan": "sjMatch",
  "Tidak Sepadan": "sjMismatch",
  "Tidak Mengajar": "sjNotTeaching",
  "Tidak Dapat Ditentukan": "sjUnknown",
};

export default function Subjek() {
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const { teachers, error } = useTeachers();
  const { schoolTypes, schoolsByType, subjects, employmentStatuses } = useTeacherLookups(teachers);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("Semua");
  const [matchQuery, setMatchQuery] = useState("");
  const matchTableRef = useRef<HTMLDivElement>(null);

  // Unusual-load list controls
  const [loadQuery, setLoadQuery] = useState("");
  const [loadKind, setLoadKind] = useState<LoadKind>("all");

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
  const counsellorCount = useMemo(() => filtered.filter((x) => statusOf(x) === "Tidak Mengajar").length,
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
  const loadPager = usePager(loadRows.length, loadRows);
  const loadShown = loadPager.slice(loadRows);

  const tableRows = useMemo(() => {
    const q = matchQuery.trim().toLowerCase();
    return filtered.filter((x) => {
      if (matchFilter !== "Semua" && statusOf(x) !== matchFilter) return false;
      if (q && ![x.name, x.school, shortSchoolName(x.school), x.opsyen1, x.opsyen2, ...x.subjects.map((s) => s.name)]
        .some((v) => v?.toLowerCase().includes(q))) return false;
      return true;
    });
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, matchFilter, matchQuery, matchById]);

  const matchPager = usePager(tableRows.length, tableRows);
  const paginated = matchPager.slice(tableRows);

  function handleMatchFilter(f: MatchFilter) {
    setMatchFilter(f);
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

  // The two lists, shared by the full report and the per-table download buttons.
  const statusText = (x: Teacher) => {
    const m = matchById.get(x.id)!;
    return m.reason ? `${t(STATUS_KEY[m.status])} (${t(`sjReason_${m.reason}` as DictKey)})` : t(STATUS_KEY[m.status]);
  };
  const loadTable = (rows: Teacher[], title: string): ReportTable => ({
    name: t("rpShLoad"), title,
    columns: [{ header: t("sjColName"), width: 36 }, { header: t("sjColSchool"), width: 40 }, { header: t("sjColType"), width: 9 }, { header: t("cgTotalHours"), width: 13, format: "int" }, { header: "Status", width: 14 }],
    rows: rows.map((x) => [x.name, x.school, x.schoolType, totalWaktu(x), totalWaktu(x) > WAKTU_HIGH ? t("sjHigh") : t("sjLow")]),
  });
  const matchTable = (rows: Teacher[], title: string): ReportTable => ({
    name: t("rpShMatchList"), title,
    columns: [
      { header: t("sjColName"), width: 36 }, { header: t("sjColStatus"), width: 22 }, { header: t("sjColSchool"), width: 40 }, { header: t("sjColType"), width: 9 },
      { header: t("sjColOp1"), width: 26 }, { header: t("sjColOp2"), width: 26 },
      { header: t("sjColSub1"), width: 26 }, { header: t("sjColSub2"), width: 26 }, { header: t("sjColSub3"), width: 26 },
      { header: t("sjColHours"), width: 10, format: "int" },
    ],
    rows: rows.map((x) => [
      x.name, statusText(x), x.school, x.schoolType, clean(x.opsyen1) || null, clean(x.opsyen2) || null,
      x.subjects[0]?.name, x.subjects[1]?.name, x.subjects[2]?.name, totalWaktu(x),
    ]),
  });
  const loadTitle = `${t("sjLoadTitle")} · ${t("sjNormalRange")}: ${WAKTU_LOW}–${WAKTU_HIGH}`;

  // Only the matching list, as currently shown (e.g. only "Tidak Sepadan").
  const buildMatchOnly = (): Report => {
    const statusLabel = matchFilter === "Semua" ? t("sjAll") : t(STATUS_KEY[matchFilter]);
    return {
      title: `${t("sjMatchCheck")} - ${statusLabel}`,
      filters: [`${t("sjColStatus")}: ${statusLabel}`, ...(matchQuery.trim() ? [`${t("rpSearch")}: ${matchQuery.trim()}`] : []), ...describeFilters(filters, t)],
      tables: [matchTable(tableRows, `${t("sjMatchCheck")}: ${statusLabel} (${tableRows.length.toLocaleString(locale)})`)],
    };
  };
  // Only the unusual-load list, with its search and High/Low choice.
  const buildLoadOnly = (): Report => {
    const kindLabel = loadKind === "high" ? t("sjHigh") : loadKind === "low" ? t("sjLow") : t("sjLoadAll");
    return {
      title: `${t("rpShLoad")} - ${kindLabel}`,
      filters: [`Status: ${kindLabel}`, ...(loadQuery.trim() ? [`${t("rpSearch")}: ${loadQuery.trim()}`] : []), ...describeFilters(filters, t)],
      tables: [loadTable(loadRows, `${loadTitle} (${loadRows.length.toLocaleString(locale)})`)],
    };
  };

  const buildReport = (): Report => {
    const total = filtered.length;
    const h = { count: t("rpColCount"), pct: t("rpColPct") };
    // Every subject here (the chart shows the top 20 only).
    const subjAll: Record<string, number> = {};
    filtered.forEach((x) => new Set(x.subjects.map((s) => s.name)).forEach((name) => { subjAll[name] = (subjAll[name] || 0) + 1; }));
    const matchCount = total - mismatchCount - unknownCount - counsellorCount;
    return {
      title: t("titleSubjek"),
      filters: describeFilters(filters, t),
      tables: [
        countTable(t("sjMatchCheck"), t("sjMatchCheck"), t("sjColStatus"),
          [[t("sjMatch"), matchCount], [t("sjMismatch"), mismatchCount], [t("sjNotTeaching"), counsellorCount], [t("sjUnknown"), unknownCount]], total, h, 28),
        countTable(t("rpColSubject"), t("sjChartSubjects").replace(/\s*\(.*\)\s*$/, ""), t("rpColSubject"),
          Object.entries(subjAll).sort((a, b) => b[1] - a[1]), total, h, 46),
        loadTable(waktuAnomalies, loadTitle),
        matchTable(filtered, t("sjMatchCheck")),
      ],
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      <FilterSidebar
        title={t("titleSubjek")}
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
          {filtered.length.toLocaleString(locale)} {t("dmInView")}
        </p>

        {/* Alert banner */}
        {mismatchCount > 0 && (
          <div style={{ background: "var(--warn-bg)", border: "1px solid var(--warn-line)", borderRadius: 16, padding: "14px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flexShrink: 0, background: ORANGE + "26", borderRadius: 12, padding: 9, display: "flex" }}>
              <AlertTriangle size={20} color={ORANGE} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--warn-ink)" }}>
                {mismatchCount.toLocaleString(locale)} {t("sjMismatchBanner")}
              </span>
              <div style={{ fontSize: 12, color: "var(--warn-ink-2)", marginTop: 2 }}>
                {((mismatchCount / n) * 100).toFixed(1)}% {t("sjOfView")}
                {unknownCount > 0 && <> · {unknownCount.toLocaleString(locale)} {t("sjUndetermined")}</>}
              </div>
            </div>
            <button
              onClick={showMismatchList}
              style={{ padding: "8px 18px", borderRadius: 999, border: `1.5px solid ${ORANGE}`, background: matchFilter === "Tidak Sepadan" ? ORANGE : "transparent", color: matchFilter === "Tidak Sepadan" ? "#fff" : "var(--ink-amber)", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              {matchFilter === "Tidak Sepadan" ? t("sjShowAll") : t("sjShowList")}
            </button>
          </div>
        )}

        {/* Subject bar chart */}
        <div className="card soft-card" style={{ marginBottom: 16 }}>
          <CardTitle>{t("sjChartSubjects")}</CardTitle>
          <ResponsiveContainer width="100%" height={250}>
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
        <div className="card soft-card" style={{ marginBottom: 16 }}>
          <CardTitle
            icon={<Clock size={16} color={ORANGE} />}
            right={
              <span style={{ fontSize: 12, color: "var(--soft-muted)" }}>
                {t("sjAvgNow")}: <strong style={{ color: "var(--soft-text)" }}>{avgWaktu} {t("sjPerWeek")}</strong> · {t("sjNormalRange")}: {WAKTU_LOW}–{WAKTU_HIGH} {t("sjPerWeek")}
              </span>
            }
          >
            {t("sjLoadTitle")}
          </CardTitle>
          <ListToolbar
            search={{ value: loadQuery, onChange: setLoadQuery, placeholder: t("sjSearchLoad") }}
            pager={loadPager}
            filters={
              <PillToggle<LoadKind>
                value={loadKind}
                onChange={setLoadKind}
                options={([["all", t("sjLoadAll"), waktuAnomalies.length], ["high", t("sjHigh"), highCount], ["low", t("sjLow"), lowCount]] as [LoadKind, string, number][])
                  .map(([k, label, count]) => ({ value: k, label: `${label} (${count.toLocaleString(locale)})` }))}
              />
            }
            download={loadRows.length > 0 && <ReportButton formats={["excel", "csv"]} getReport={buildLoadOnly} title={t("rpThisList")} />}
          />
          {loadRows.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center", color: "var(--soft-faint)", fontSize: 12.5 }}>{t("sjNoAnomaly")}</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="soft-table">
                <thead>
                  <tr>
                    {(["sjColName", "sjColSchool", "cgTotalHours", "sjColStatus"] as DictKey[]).map((h) => (
                      <th key={h}>{h === "sjColStatus" ? "Status" : t(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadShown.map((x, i) => {
                    const w = totalWaktu(x);
                    const isHigh = w > WAKTU_HIGH;
                    return (
                      <tr key={x.id} data-i={i}>
                        <td style={{ padding: "7px 12px", fontSize: 12.5, fontWeight: 500, color: "var(--soft-text)" }}>{x.name}</td>
                        <td style={{ padding: "7px 12px", fontSize: 12, color: "var(--soft-muted)" }} title={x.school}>{shortSchoolName(x.school)}</td>
                        <td style={{ padding: "7px 12px", fontSize: 12.5, fontWeight: 700, color: "var(--soft-text)" }}>{w} {t("sjPerWeek")}</td>
                        <td style={{ padding: "7px 12px" }}>
                          <span className={`tag ${isHigh ? "tag-err" : "tag-warn"}`}>
                            {isHigh ? t("sjHigh") : t("sjLow")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <ListFooter pager={loadPager} />
        </div>

        {/* Matching table */}
        <div ref={matchTableRef} className="card soft-card" style={{ scrollMarginTop: 16 }}>
          <CardTitle>{t("sjMatchCheck")}</CardTitle>
          <ListToolbar
            search={{ value: matchQuery, onChange: setMatchQuery, placeholder: t("sjSearchMatch") }}
            pager={matchPager}
            filters={
              <PillToggle<MatchFilter>
                value={matchFilter}
                onChange={handleMatchFilter}
                options={(["Semua", "Sepadan", "Tidak Sepadan", "Tidak Mengajar", "Tidak Dapat Ditentukan"] as MatchFilter[]).map((opt) => ({
                  value: opt,
                  title: opt === "Tidak Dapat Ditentukan" ? t("sjUnknownHelp") : opt === "Tidak Mengajar" ? t("sjNotTeachingHelp") : undefined,
                  label: opt === "Semua" ? t("sjAll") : t(STATUS_KEY[opt]),
                }))}
              />
            }
            download={tableRows.length > 0 && (
              <ReportButton formats={["excel", "csv"]} getReport={buildMatchOnly}
                title={`${t("rpThisList")}: ${matchFilter === "Semua" ? t("sjAll") : t(STATUS_KEY[matchFilter])} (${tableRows.length.toLocaleString(locale)})`} />
            )}
          />

          {matchFilter === "Tidak Mengajar" && (
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--soft-line)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--soft-text-2)", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <HeartHandshake size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{t("sjNotTeachingHelp")}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {(["kaunseling", "pool", "tidakAktif", "lain"] as NotTeachingReason[]).map((r) => {
                  const n = tableRows.filter((x) => matchById.get(x.id)!.reason === r).length;
                  return n > 0 ? (
                    <span key={r} className="tag tag-info" style={{ fontSize: 11.5 }}>{t(`sjReason_${r}` as DictKey)}: <b>{n.toLocaleString(locale)}</b></span>
                  ) : null;
                })}
              </div>
            </div>
          )}
          {matchFilter === "Tidak Dapat Ditentukan" && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "var(--surface-2)", border: "1px solid var(--soft-line)", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--soft-text-2)", marginBottom: 12 }}>
              <HelpCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t("sjUnknownHelp")}</span>
            </div>
          )}

          <div style={{ overflowX: "auto" }}>
            <table className="soft-table">
              <thead>
                <tr>
                  {(["sjColName", "sjColStatus", "sjColSchool", "sjColType", "sjColOp1", "sjColOp2", "sjColSub1", "sjColSub2", "sjColSub3", "sjColHours"] as DictKey[]).map((h) => (
                    <th key={h}>
                      {t(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((x, i) => {
                  const m = matchById.get(x.id)!;
                  const w = totalWaktu(x);
                  const determinable = m.status === "Sepadan" || m.status === "Tidak Sepadan";
                  return (
                    <tr key={x.id} data-i={i}>
                      <td style={{ padding: "8px 12px", fontSize: 12.5, fontWeight: 500, color: "var(--soft-text)", whiteSpace: "nowrap" }}>{x.name}</td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                        <StatusPill status={m.status} label={t(STATUS_KEY[m.status])} />
                        {m.reason && <div style={{ fontSize: 11, color: "var(--soft-muted)", marginTop: 3 }}>{t(`sjReason_${m.reason}` as DictKey)}</div>}
                      </td>
                      <td style={{ padding: "8px 12px", fontSize: 11.5, color: "var(--soft-muted)", maxWidth: 160 }} title={x.school}>
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
                      <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: x.subjects.length && (w < WAKTU_LOW || w > WAKTU_HIGH) ? ORANGE : "var(--soft-text-2)" }}>
                        {w}
                      </td>
                    </tr>
                  );
                })}
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: 36, textAlign: "center", color: "var(--soft-faint)", fontSize: 13 }}>
                      {t("cgNoRecords")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <ListFooter pager={matchPager} />
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
  if (status === "Sepadan") return <Tag kind="ok" icon={<CheckCircle2 size={12} />}>{label}</Tag>;
  if (status === "Tidak Sepadan") return <Tag kind="warn" icon={<AlertTriangle size={12} />}>{label}</Tag>;
  if (status === "Tidak Mengajar") return <Tag kind="info" icon={<HeartHandshake size={12} />}>{label}</Tag>;
  return <Tag kind="muted" icon={<HelpCircle size={12} />}>{label}</Tag>;
}

function OpCell({ value, highlight }: { value: string; highlight: boolean }) {
  if (!value) return <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--soft-line)" }}>—</td>;
  return (
    <td style={{ padding: "8px 12px", maxWidth: 180 }} title={value}>
      <span style={{
        fontSize: 12, fontWeight: highlight ? 600 : 400,
        color: highlight ? "var(--ok-ink)" : "var(--soft-text-2)",
        background: highlight ? "var(--ok-bg)" : "transparent",
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
    return <td style={{ padding: "8px 12px", fontSize: 12, color: "var(--soft-line)" }}>—</td>;
  }
  const style = neutral
    ? { color: "var(--soft-text-2)", background: "var(--surface-3)" }
    : matched
      ? { color: "var(--ok-ink)", background: "var(--ok-bg)" }
      : { color: "var(--ink-amber)", background: "var(--tint-amber)" };
  return (
    <td style={{ padding: "8px 12px" }}>
      <span style={{ fontSize: 12, fontWeight: matched ? 600 : 400, padding: "2px 7px", borderRadius: 5, whiteSpace: "nowrap", ...style }}>
        {value}
      </span>
    </td>
  );
}
