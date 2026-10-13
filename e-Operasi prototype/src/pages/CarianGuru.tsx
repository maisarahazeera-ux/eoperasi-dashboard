import { useState, useMemo } from "react";
import {
  Search, X, Eye, EyeOff, Phone, Mail, MapPin,
  BookOpen, User, Loader2, AlertTriangle,
} from "lucide-react";
import { type Teacher } from "../lib/api";
import { useTeachers, useTeacherLookups } from "../lib/useTeachers";
import { NAVY, TEAL, schoolTypeChip } from "../lib/colors";
import { shortSchoolName } from "../lib/schoolName";
import { valueLabel, clean } from "../lib/labels";
import { Tag } from "../components/ui";
import { ListFooter, PageSizeSelect, usePager } from "../components/ListControls";
import SearchableSelect from "../lib/SearchableSelect";
import PageHero from "../components/PageHero";
import ReportButton from "../components/ReportButton";
import type { Report } from "../lib/report";
import { useAuth } from "../context/AuthContext";
import { pgbRole, isPgb, jawatanLabel, tempohKhidmatSekolah, tempohLantikanJawatan, bakiPerkhidmatan, type DurationWords } from "../lib/pgb";
import { downloadTeacherListExcel } from "../lib/teacherListExcel";
import { useDataDate } from "../lib/dataInfo";
import { Crown, Info } from "lucide-react";
import { useLanguage, type DictKey } from "../context/LanguageContext";
import { fixMonth } from "../lib/dates";


function totalWaktu(x: Teacher) {
  return x.subjects.reduce((sum, s) => sum + s.hours, 0);
}

/** Full years between a date and today. */
function yearsSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 864e5));
}

/**
 * Hides the middle of an IC number, e.g. 850101-01-1234 -> 8501**-**-1234.
 * Some ICs in the source data have no dashes (or lost a leading zero), so this
 * works on the digits only and never assumes the dashed format.
 */
function maskIC(ic: string) {
  const digits = ic.replace(/\D/g, "");
  if (digits.length < 8) return "****";
  if (digits.length === 12) return `${digits.slice(0, 4)}**-**-${digits.slice(8)}`;
  return digits.slice(0, 4) + "*".repeat(digits.length - 8) + digits.slice(-4);
}

function formatDate(dateStr: string | null, locale: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return fixMonth(d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }));
}

export default function CarianGuru({ initialQuery = "" }: { initialQuery?: string }) {
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const { teachers, error } = useTeachers();
  const { schoolTypes, schoolsByType, subjects, employmentStatuses } = useTeacherLookups(teachers);

  const [query, setQuery] = useState(initialQuery);
  const [filterSchoolType, setFilterSchoolType] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  // Pengetua & Guru Besar only (like PPD's "Senarai PGB").
  const [filterPgb, setFilterPgb] = useState(false);
  const dataDate = useDataDate();
  const words: DurationWords = { year: t("cgDurYear"), month: t("cgDurMonth"), day: t("cgDurDay"), retired: t("cgRetired"), yearOne: t("cgDurYear1"), monthOne: t("cgDurMonth1"), dayOne: t("cgDurDay1") };
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [showIC, setShowIC] = useState(false);

  const schoolOptions = useMemo(() => {
    const list = filterSchoolType
      ? schoolsByType[filterSchoolType] ?? []
      : Array.from(new Set(Object.values(schoolsByType).flat())).sort();
    return list.map((s) => ({ value: s, label: shortSchoolName(s) }));
  }, [filterSchoolType, schoolsByType]);

  const subjectOptions = useMemo(() => subjects.map((s) => ({ value: s, label: s })), [subjects]);

  const filtered = useMemo(() => {
    if (!teachers) return [];
    const q = query.toLowerCase().trim();
    const qDigits = q.replace(/\D/g, "");
    return teachers.filter((x) => {
      if (q) {
        const nameHit = x.name.toLowerCase().includes(q);
        const icHit = qDigits.length >= 4 && x.icNumber.replace(/\D/g, "").includes(qDigits);
        if (!nameHit && !icHit) return false;
      }
      if (filterSchoolType && x.schoolType !== filterSchoolType) return false;
      if (filterSchool && x.school !== filterSchool) return false;
      if (filterSubject && !x.subjects.some((s) => s.name === filterSubject)) return false;
      if (filterStatus && x.employmentStatus !== filterStatus) return false;
      if (filterPgb && !isPgb(x)) return false;
      return true;
    }).sort((a, b) =>
      // By school code (like the PPD list), the school head first, then by name.
      (a.schoolCode || "~").localeCompare(b.schoolCode || "~") || a.school.localeCompare(b.school) ||
      Number(isPgb(b)) - Number(isPgb(a)) || a.name.localeCompare(b.name));
  }, [teachers, query, filterSchoolType, filterSchool, filterSubject, filterStatus, filterPgb]);

  const pgbCounts = useMemo(() => {
    const c = { total: 0, gb: 0, pengetua: 0, cemerlang: 0 };
    for (const x of filtered) {
      const r = pgbRole(x);
      if (!r) continue;
      c.total++;
      if (r.startsWith("Guru Besar")) c.gb++; else c.pengetua++;
      if (r.includes("Cemerlang")) c.cemerlang++;
    }
    return c;
  }, [filtered]);
  const missingNewFields = !!teachers?.length && teachers.every((x) => !x.schoolCode);

  const pager = usePager(filtered.length, filtered);
  const setPage = pager.setPage;
  const paginated = pager.slice(filtered);

  // Every filter change goes back to page 1.
  const withReset = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  const isDirty = query || filterSchoolType || filterSchool || filterSubject || filterStatus || filterPgb;

  function clearAll() {
    setQuery(""); setFilterSchoolType(""); setFilterSchool("");
    setFilterSubject(""); setFilterStatus(""); setFilterPgb(false); setPage(1);
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

  const searchLabels = {
    searchPlaceholder: t("filterSearchPlaceholder"),
    noMatchLabel: t("filterNoMatch"),
  };

  // Teacher list in the layout of PPD's "Senarai Pengetua dan Guru Besar" file.
  // It has IC numbers and addresses, so the download is for admins only.
  const listHeaders = [
    t("cgKodSek"), t("cgNamaSek"), t("cgNama"), t("cgNoKp"), t("cgJawatan"), t("cgGred"),
    t("cgLantikanJawatan"), t("cgKhidmatSekolah"), t("cgTarikhBersara"), t("cgSubjekAjar"), t("cgAlamat"),
    t("cgTempohKhidmatSek"), t("cgTempohLantikan"), t("cgBaki"),
  ];
  const buildReport = (): Report => {
    const filtersText = [
      query && `${t("rpSearch")}: ${query}`,
      filterPgb && t("cgPgbFilter"),
      filterSchoolType && `${t("filterSchoolType")}: ${filterSchoolType}`,
      filterSchool && `${t("filterSchoolName")}: ${filterSchool}`,
      filterSubject && `${t("filterSubject")}: ${filterSubject}`,
      filterStatus && `${t("filterEmployment")}: ${valueLabel(filterStatus, lang)}`,
    ].filter((v): v is string => !!v);
    const yn = (b: boolean) => (b ? t("rpYes") : t("rpNo"));
    const title = filterPgb ? t("xlTitlePgb") : t("xlTitleAll");
    const dataDateText = new Date(`${dataDate}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
    const summary: [string, number][] = filterPgb
      ? [[t("cgPgbTotal"), pgbCounts.total], [t("cgGuruBesar"), pgbCounts.gb], [t("cgPengetua"), pgbCounts.pengetua], [t("cgPgbCemerlang"), pgbCounts.cemerlang]]
      : [[t("ovTotalTeachers"), filtered.length], [t("cgPgbTotal"), pgbCounts.total]];
    const fullHeaders = [
      t("cgKodSek"), t("cgColName"), t("cgColIc"), t("cgGender"), t("cgDob"), t("cgAge"), t("cgRace"), t("cgReligion"), t("cgMarital"),
      t("cgNationality"), t("cgColSchool"), t("cgColType"), t("cgColPosition"), t("cgGredHakiki"), t("cgGredPenyandang"),
      t("cgEmployment"), t("cgServiceStatus"), t("cgFirstAppt"), t("cgLantikanJawatan"), t("cgKhidmatSekolah"), t("cgRetirement"),
      t("cgQualification"), t("cgOpsyen1"), t("cgOpsyen2"), t("rpColSubjects"), t("cgTotalHours"), t("cgTugasKhas"),
      t("cgCemerlang"), t("rpColPhone"), t("rpColEmail"), t("rpColAddress"),
    ];
    const fullRow = (x: Teacher) => [
      x.schoolCode || null, x.name, x.icNumber, x.gender === "L" ? t("genderL") : x.gender === "P" ? t("genderP") : x.gender,
      x.dateOfBirth, yearsSince(x.dateOfBirth), valueLabel(x.race ?? "", lang) || null, valueLabel(x.religion ?? "", lang) || null,
      valueLabel(x.maritalStatus ?? "", lang) || null, x.nationality,
      x.school, x.schoolType, x.position, x.gredHakiki, x.gredPenyandang, x.employmentStatus ? valueLabel(x.employmentStatus, lang) : null,
      x.serviceStatus ? valueLabel(x.serviceStatus, lang) : null, x.firstAppointmentDate, x.tarikhLantikanJawatanSemasa,
      x.tarikhKhidmatSekolahSemasa, x.retirementDate, clean(x.qualification) || null,
      clean(x.opsyen1) || null, clean(x.opsyen2) || null, x.subjects.map((s) => `${s.name} (${s.hours})`).join("; ") || null,
      totalWaktu(x), clean(x.tugasKhas) || null, yn(x.guruCemerlang), x.phone, x.email, x.address,
    ];
    return {
      title,
      filters: filtersText,
      // CSV: the same 14 columns, with the periods worked out as of today.
      tables: [{
        name: title, title: `${title} (${filtered.length.toLocaleString(locale)})`,
        columns: listHeaders.map((h, i) => ({ header: h, format: i >= 6 && i <= 8 ? "date" as const : undefined })),
        rows: filtered.map((x) => [
          x.schoolCode || null, x.school, x.name, x.icNumber, jawatanLabel(x), x.gredPenyandang,
          x.tarikhLantikanJawatanSemasa, x.tarikhKhidmatSekolahSemasa, x.retirementDate,
          x.subjects.map((s) => s.name).join("; ") || null, x.address,
          tempohKhidmatSekolah(x, words) || null, tempohLantikanJawatan(x, words) || null, bakiPerkhidmatan(x, words) || null,
        ]),
      }],
      // Excel: the PPD layout, with live formulas.
      excel: (meta) => downloadTeacherListExcel(filtered, {
        title,
        source: t("xlSource").replace("{date}", dataDateText),
        calcDate: t("xlCalcDate"),
        note: t("xlNote"),
        filters: filtersText.length ? `${t("rpFilters")}: ${filtersText.join(" · ")}` : null,
        summary,
        headers: listHeaders,
        words: { year: t("cgDurYear"), month: t("cgDurMonth"), day: t("cgDurDay"), retired: t("cgRetired"), yearOne: t("cgDurYear1"), monthOne: t("cgDurMonth1"), dayOne: t("cgDurDay1") },
        fullSheet: t("xlFullSheet"),
        fullHeaders,
        confidential: meta.labels.confidential,
      }, `e-Operasi_${title.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "")}_${meta.dataDate}.xlsx`, fullRow),
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PageHero title={t("titleCarianGuru")} />
      {/* Filter bar */}
      <div style={{ padding: "4px 32px 16px", background: "transparent", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
        <label className="list-search" style={{ minWidth: 230 }}>
          <Search size={14} />
          <input type="text" placeholder={t("cgSearchPlaceholder")} aria-label={t("cgSearchPlaceholder")} value={query}
            onChange={(e) => withReset(setQuery)(e.target.value)} />
          {query && <button type="button" aria-label="×" onClick={() => withReset(setQuery)("")}><X size={13} /></button>}
        </label>
        <PageSizeSelect pager={pager} />
        <div style={{ minWidth: 130 }}>
          <select value={filterSchoolType}
            onChange={(e) => { setFilterSchoolType(e.target.value); setFilterSchool(""); setPage(1); }}>
            <option value="">{t("cgAllTypes")}</option>
            {schoolTypes.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 200, flex: "1 1 200px" }}>
          <SearchableSelect value={filterSchool} options={schoolOptions}
            onChange={withReset(setFilterSchool)} allLabel={t("cgAllSchools")} {...searchLabels} />
        </div>
        <div style={{ minWidth: 170 }}>
          <SearchableSelect value={filterSubject} options={subjectOptions}
            onChange={withReset(setFilterSubject)} allLabel={t("cgAllSubjects")} {...searchLabels} />
        </div>
        <div style={{ minWidth: 125 }}>
          <select value={filterStatus} onChange={(e) => withReset(setFilterStatus)(e.target.value)}>
            <option value="">{t("cgAllStatus")}</option>
            {employmentStatuses.map((s) => <option key={s} value={s}>{valueLabel(s, lang)}</option>)}
          </select>
        </div>
        <button type="button" className={`soft-pill${filterPgb ? " set" : ""}`} aria-pressed={filterPgb}
          onClick={() => { setFilterPgb(!filterPgb); setPage(1); }}>
          <Crown size={13} /> {t("cgPgbFilter")}
        </button>
        {isDirty && (
          <button onClick={clearAll}
            className="soft-pill small ghost">
            <X size={12} /> {t("cgClear")}
          </button>
        )}
        {isAdmin && filtered.length > 0 && (
          <span style={{ marginLeft: "auto" }}><ReportButton getReport={buildReport} formats={["excel", "csv"]} title={`${t("rpThisList")} · ${t("rpAdminOnly")}`} /></span>
        )}
      </div>

      {(filterPgb || missingNewFields) && (
        <div style={{ padding: "0 32px 12px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
          {filterPgb && ([
            [t("cgPgbTotal"), pgbCounts.total, "blue"], [t("cgGuruBesar"), pgbCounts.gb, "teal"],
            [t("cgPengetua"), pgbCounts.pengetua, "violet"], [t("cgPgbCemerlang"), pgbCounts.cemerlang, "amber"],
          ] as [string, number, string][]).map(([label, n, tone]) => (
            <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "8px 14px", borderRadius: 12, background: `var(--tint-${tone})`, color: `var(--ink-${tone})` }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
              <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{n.toLocaleString(locale)}</span>
            </div>
          ))}
          {missingNewFields && isAdmin && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--warn-ink)", background: "var(--warn-bg)", border: "1px solid var(--warn-line)", borderRadius: 10, padding: "7px 12px" }}>
              <Info size={14} style={{ flexShrink: 0 }} /> {t("cgNeedReupload")}
            </div>
          )}
        </div>
      )}

      {/* Table + detail panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", background: "var(--mac-bg)", padding: "8px 32px 28px" }}>
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="soft-table" style={{ minWidth: 1180 }}>
              <thead>
                <tr>
                  {(["cgKodSek", "cgNamaSek", "cgNama", "cgNoKp", "cgJawatan", "cgGred", "cgLantikanJawatan", "cgKhidmatSekolah", "cgTarikhBersara", "cgBaki"] as DictKey[]).map((h) => (
                    <th key={h} style={{ whiteSpace: h.startsWith("cgLantikan") || h.startsWith("cgKhidmat") ? "normal" : "nowrap", minWidth: h === "cgLantikanJawatan" || h === "cgKhidmatSekolah" ? 96 : undefined }}>
                      {t(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((x, i) => (
                  <tr key={x.id} className="table-row-hover"
                    onClick={() => { setSelected(x); setShowIC(false); }}
                    style={{ background: selected?.id === x.id ? "var(--hover)" : undefined }} data-i={i}>
                    <td style={{ padding: "9px 12px", fontSize: 12, fontFamily: "monospace", color: "var(--soft-text-2)", whiteSpace: "nowrap" }}>{x.schoolCode || "-"}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: "var(--soft-text-2)", maxWidth: 210 }} title={x.school}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortSchoolName(x.school)}</div>
                      <span style={{ ...schoolTypeChip(x.schoolType), marginTop: 3, display: "inline-block" }}>{x.schoolType}</span>
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 500, color: "var(--soft-text)", minWidth: 180 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar gender={x.gender} size={26} />
                        <span>{x.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: 11.5, color: "var(--soft-muted)", fontFamily: "monospace", whiteSpace: "nowrap" }}>{maskIC(x.icNumber)}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: "var(--soft-text-2)", maxWidth: 190 }} title={x.position ?? ""}>
                      {pgbRole(x)
                        ? <span className="tag tag-warn" style={{ whiteSpace: "nowrap" }}><Crown size={11} /> {pgbRole(x)}</span>
                        : <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.position || "-"}</div>}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <span className="tag tag-info">{x.gredPenyandang || "-"}</span>
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: "var(--soft-text-2)", whiteSpace: "nowrap" }}>{formatDate(x.tarikhLantikanJawatanSemasa, locale) || "-"}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: "var(--soft-text-2)", whiteSpace: "nowrap" }}>{formatDate(x.tarikhKhidmatSekolahSemasa, locale) || "-"}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: "var(--soft-text-2)", whiteSpace: "nowrap" }}>{formatDate(x.retirementDate, locale) || "-"}</td>
                    <td style={{ padding: "9px 12px", fontSize: 12, color: "var(--soft-text-2)", whiteSpace: "nowrap" }}>{bakiPerkhidmatan(x, words) || "-"}</td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: "var(--soft-faint)", fontSize: 13 }}>{t("cgNoRecords")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <ListFooter pager={pager} />
        </div>

        {selected && (
          <aside className="sidebar-slide" style={{ width: 390, background: "var(--surface)", borderLeft: "1px solid var(--soft-line)", overflowY: "auto", flexShrink: 0 }}>
            <Panel teacher={selected} showIC={showIC} setShowIC={setShowIC} onClose={() => setSelected(null)} locale={locale} />
          </aside>
        )}
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

function Avatar({ gender, size }: { gender: string; size: number }) {
  const male = gender === "L";
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: male ? "var(--tint-blue)" : "var(--tint-rose)", color: male ? "var(--ink-blue)" : "var(--ink-rose)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <User size={size * 0.47} />
    </div>
  );
}


function Panel({ teacher: x, showIC, setShowIC, onClose, locale }: {
  teacher: Teacher; showIC: boolean; setShowIC: (v: boolean) => void; onClose: () => void; locale: string;
}) {
  const { t, lang } = useLanguage();
  const age = yearsSince(x.dateOfBirth);
  const service = yearsSince(x.firstAppointmentDate);
  const yrs = lang === "en" ? "years" : "tahun";
  const words: DurationWords = { year: t("cgDurYear"), month: t("cgDurMonth"), day: t("cgDurDay"), retired: t("cgRetired"), yearOne: t("cgDurYear1"), monthOne: t("cgDurMonth1"), dayOne: t("cgDurDay1") };

  return (
    <div>
      <div style={{ background: "var(--tint-blue)", padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            <Avatar gender={x.gender} size={50} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--soft-text)", lineHeight: 1.3 }}>{x.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--soft-text-2)", marginTop: 2 }}>{jawatanLabel(x)} · {x.gredPenyandang}</div>
              <div style={{ marginTop: 6, display: "flex", gap: 5, flexWrap: "wrap" }}>
                <span style={{ ...schoolTypeChip(x.schoolType), background: "var(--surface)" }}>{x.schoolType}</span>
                <Pill ok={x.employmentStatus === "Tetap"} text={valueLabel(x.employmentStatus, lang)} />
                <Pill ok={x.serviceStatus === "Aktif"} text={valueLabel(x.serviceStatus, lang)} />
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Tutup" style={{ background: "var(--surface)", border: "none", borderRadius: 999, padding: 6, cursor: "pointer", color: "var(--soft-text-2)", display: "flex" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--soft-muted)" }}>{x.schoolCode ? `${x.schoolCode} · ` : ""}{x.school}</div>
      </div>

      <div style={{ paddingBottom: 24 }}>
        <Section title={t("cgSecPersonal")}>
          <Row label={t("cgGender")} value={x.gender === "L" ? t("genderL") : t("genderP")} />
          <Row label={t("cgDob")} value={formatDate(x.dateOfBirth, locale)} />
          <Row label={t("cgAge")} value={age != null ? `${age} ${yrs}` : ""} />
          <Row label={t("cgMarital")} value={valueLabel(x.maritalStatus, lang)} />
          <Row label={t("cgRace")} value={valueLabel(x.race, lang)} />
          <Row label={t("cgReligion")} value={valueLabel(x.religion, lang)} />
          <Row label={t("cgNationality")} value={x.nationality ?? ""} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--surface-2)" }}>
            <span style={{ fontSize: 12, color: "var(--soft-muted)" }}>{t("cgColIc")}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, fontFamily: "monospace", color: "var(--soft-text)" }}>{showIC ? x.icNumber : maskIC(x.icNumber)}</span>
              <button onClick={() => setShowIC(!showIC)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: TEAL }}>
                {showIC ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
        </Section>

        <Section title={t("cgSecService")}>
          <Row label={t("cgGredHakiki")} value={x.gredHakiki ?? ""} />
          <Row label={t("cgGredPenyandang")} value={x.gredPenyandang ?? ""} />
          <Row label={t("cgEmployment")} value={valueLabel(x.employmentStatus, lang)} />
          <Row label={t("cgFirstAppt")} value={formatDate(x.firstAppointmentDate, locale)} />
          <Row label={t("cgServiceLength")} value={service != null ? `${service} ${yrs}` : ""} />
          <Row label={t("cgLantikanJawatan")} value={formatDate(x.tarikhLantikanJawatanSemasa, locale)} />
          <Row label={t("cgTempohLantikan")} value={tempohLantikanJawatan(x, words)} />
          <Row label={t("cgKhidmatSekolah")} value={formatDate(x.tarikhKhidmatSekolahSemasa, locale)} />
          <Row label={t("cgTempohKhidmatSek")} value={tempohKhidmatSekolah(x, words)} />
          <PillRow label={t("cgServiceStatus")} ok={x.serviceStatus === "Aktif"} text={valueLabel(x.serviceStatus, lang)} />
          <PillRow label={t("cgInduction")} ok={x.statusInduksi === "Selesai"} text={valueLabel(x.statusInduksi, lang)} />
          <PillRow label={t("cgConfirmed")} ok={x.sahPerkhidmatan === "Disahkan"} text={valueLabel(x.sahPerkhidmatan, lang)} />
          <Row label={t("cgRetirement")} value={formatDate(x.retirementDate, locale)} />
          <Row label={t("cgBaki")} value={bakiPerkhidmatan(x, words)} />
          <Row label={t("cgTugasKhas")} value={clean(x.tugasKhas)} />
          <Row label={t("cgCemerlang")} value={x.guruCemerlang ? `${t("yes")}${x.guruCemerlangBidang ? ` (${x.guruCemerlangBidang})` : ""}` : t("no")} />
          <Row label={t("cgTotalHours")} value={`${totalWaktu(x)} ${t("cgPeriods")}`} />
        </Section>

        <Section title={t("cgSecAcademic")}>
          <Row label={t("cgQualification")} value={x.qualification ?? ""} />
          <Row label={t("cgOpsyen1")} value={clean(x.opsyen1)} />
          <Row label={t("cgOpsyen2")} value={clean(x.opsyen2)} />
        </Section>

        <Section title={t("cgSecSubjects")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingTop: 4 }}>
            {x.subjects.length === 0 && <div style={{ fontSize: 12, color: "var(--soft-faint)" }}>{t("cgNoSubjects")}</div>}
            {x.subjects.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-2)", borderRadius: 7, padding: "7px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <BookOpen size={13} color={TEAL} />
                  <span style={{ fontSize: 12.5, color: "var(--soft-text)", fontWeight: 500 }}>{s.name}</span>
                </div>
                <span style={{ fontSize: 11, color: "var(--soft-muted)" }}>{s.hours} {t("cgPeriodsPerWeek")}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title={t("cgSecContact")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
            <CRow icon={<Phone size={13} color={TEAL} />} value={x.phone ?? ""} />
            <CRow icon={<Mail size={13} color={TEAL} />} value={x.email ?? ""} />
            <CRow icon={<MapPin size={13} color={TEAL} />} value={x.address ?? ""} />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "1px solid var(--surface-3)" }}>
      <div style={{ padding: "11px 18px 3px" }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--soft-text)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</span>
      </div>
      <div style={{ padding: "0 18px 10px" }}>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "5px 0", borderBottom: "1px solid var(--surface-2)" }}>
      <span style={{ fontSize: 12, color: "var(--soft-muted)", minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--soft-text)", textAlign: "right" }}>{value || "-"}</span>
    </div>
  );
}

function Pill({ ok, text }: { ok: boolean; text: string }) {
  if (!text) return null;
  return (
    <Tag kind={ok ? "ok" : "warn"}>{text}</Tag>
  );
}

function PillRow({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--surface-2)" }}>
      <span style={{ fontSize: 12, color: "var(--soft-muted)" }}>{label}</span>
      {text ? <Pill ok={ok} text={text} /> : <span style={{ fontSize: 12.5 }}>-</span>}
    </div>
  );
}

function CRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
      <span style={{ fontSize: 12.5, color: "var(--soft-text-2)", lineHeight: 1.5 }}>{value || "-"}</span>
    </div>
  );
}
