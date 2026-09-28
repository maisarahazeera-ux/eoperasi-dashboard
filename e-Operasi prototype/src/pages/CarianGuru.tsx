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
import SearchableSelect from "../lib/SearchableSelect";
import { useLanguage, type DictKey } from "../context/LanguageContext";

const PAGE_SIZE = 15;

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
  return d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });
}

export default function CarianGuru() {
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const { teachers, error } = useTeachers();
  const { schoolTypes, schoolsByType, subjects, employmentStatuses } = useTeacherLookups(teachers);

  const [query, setQuery] = useState("");
  const [filterSchoolType, setFilterSchoolType] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [showIC, setShowIC] = useState(false);
  const [page, setPage] = useState(1);

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
      return true;
    });
  }, [teachers, query, filterSchoolType, filterSchool, filterSubject, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Every filter change goes back to page 1.
  const withReset = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  const isDirty = query || filterSchoolType || filterSchool || filterSubject || filterStatus;

  function clearAll() {
    setQuery(""); setFilterSchoolType(""); setFilterSchool("");
    setFilterSubject(""); setFilterStatus(""); setPage(1);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Filter bar */}
      <div style={{ padding: "12px 24px", background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
        <div style={{ position: "relative", minWidth: 230, flex: "1 1 230px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} color="#9ca3af" />
          <input type="text" placeholder={t("cgSearchPlaceholder")} value={query}
            onChange={(e) => withReset(setQuery)(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
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
        {isDirty && (
          <button onClick={clearAll}
            style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <X size={12} /> {t("cgClear")}
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
          {filtered.length.toLocaleString(locale)} {t("cgRecordsFound")}
        </span>
      </div>

      {/* Table + detail panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", background: "#F5F5F5", padding: 24 }}>
          <div className="card" style={{ overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: NAVY }}>
                  {(["", "cgColName", "cgColIc", "cgColSchool", "cgColType", "cgColPosition", "cgColGrade", "cgColSubject"] as (DictKey | "")[]).map((h, i) => (
                    <th key={i} style={{ padding: "9px 13px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap" }}>
                      {h ? t(h) : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((x, i) => (
                  <tr key={x.id} className="table-row-hover"
                    onClick={() => { setSelected(x); setShowIC(false); }}
                    style={{ background: selected?.id === x.id ? "#e0f2fe" : i % 2 === 0 ? "#fff" : "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "9px 13px" }}>
                      <Avatar gender={x.gender} size={32} />
                    </td>
                    <td style={{ padding: "9px 13px", fontSize: 13, fontWeight: 500, color: "#111827" }}>{x.name}</td>
                    <td style={{ padding: "9px 13px", fontSize: 11.5, color: "#6b7280", fontFamily: "monospace", whiteSpace: "nowrap" }}>{maskIC(x.icNumber)}</td>
                    <td style={{ padding: "9px 13px", fontSize: 12, color: "#374151", maxWidth: 200 }} title={x.school}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortSchoolName(x.school)}</div>
                    </td>
                    <td style={{ padding: "9px 13px" }}>
                      <span style={schoolTypeChip(x.schoolType)}>{x.schoolType}</span>
                    </td>
                    <td style={{ padding: "9px 13px", fontSize: 12, color: "#374151", maxWidth: 200 }} title={x.position ?? ""}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.position || "-"}</div>
                    </td>
                    <td style={{ padding: "9px 13px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: "#f3f4f6", color: NAVY, padding: "2px 7px", borderRadius: 4 }}>{x.gredHakiki || "-"}</span>
                    </td>
                    <td style={{ padding: "9px 13px", fontSize: 12, color: "#6b7280" }}>{x.subjects[0]?.name ?? "-"}</td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>{t("cgNoRecords")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 14 }}>
              <PageBtn label={t("cgPrev")} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} />
              <span style={{ fontSize: 12, color: "#6b7280" }}>{t("cgPage")} {page} / {totalPages}</span>
              <PageBtn label={t("cgNext")} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} />
            </div>
          )}
        </div>

        {selected && (
          <aside className="sidebar-slide" style={{ width: 390, background: "#fff", borderLeft: "1px solid #e5e7eb", overflowY: "auto", flexShrink: 0 }}>
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
    <div style={{ width: size, height: size, borderRadius: "50%", background: male ? "#dbeafe" : "#ccfbf1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <User size={size * 0.47} color={male ? "#2F62B5" : "#0F9488"} />
    </div>
  );
}

function PageBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, cursor: disabled ? "not-allowed" : "pointer", color: disabled ? "#9ca3af" : NAVY }}>
      {label}
    </button>
  );
}

function Panel({ teacher: x, showIC, setShowIC, onClose, locale }: {
  teacher: Teacher; showIC: boolean; setShowIC: (v: boolean) => void; onClose: () => void; locale: string;
}) {
  const { t, lang } = useLanguage();
  const age = yearsSince(x.dateOfBirth);
  const service = yearsSince(x.firstAppointmentDate);
  const yrs = lang === "en" ? "years" : "tahun";

  return (
    <div>
      <div style={{ background: NAVY, padding: "18px 18px 14px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            <Avatar gender={x.gender} size={50} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{x.name}</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>{x.position} · {x.gredHakiki}</div>
              <div style={{ marginTop: 6, display: "flex", gap: 5, flexWrap: "wrap" }}>
                <span style={{ ...schoolTypeChip(x.schoolType), background: "#fff" }}>{x.schoolType}</span>
                <Pill ok={x.employmentStatus === "Tetap"} text={valueLabel(x.employmentStatus, lang)} />
                <Pill ok={x.serviceStatus === "Aktif"} text={valueLabel(x.serviceStatus, lang)} />
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, padding: "4px 6px", cursor: "pointer", color: "#fff", display: "flex" }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{x.school}</div>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f9fafb" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{t("cgColIc")}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500, fontFamily: "monospace", color: "#111827" }}>{showIC ? x.icNumber : maskIC(x.icNumber)}</span>
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
          <PillRow label={t("cgServiceStatus")} ok={x.serviceStatus === "Aktif"} text={valueLabel(x.serviceStatus, lang)} />
          <PillRow label={t("cgInduction")} ok={x.statusInduksi === "Selesai"} text={valueLabel(x.statusInduksi, lang)} />
          <PillRow label={t("cgConfirmed")} ok={x.sahPerkhidmatan === "Disahkan"} text={valueLabel(x.sahPerkhidmatan, lang)} />
          <Row label={t("cgRetirement")} value={formatDate(x.retirementDate, locale)} />
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
            {x.subjects.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af" }}>{t("cgNoSubjects")}</div>}
            {x.subjects.map((s, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb", borderRadius: 7, padding: "7px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <BookOpen size={13} color={TEAL} />
                  <span style={{ fontSize: 12.5, color: "#111827", fontWeight: 500 }}>{s.name}</span>
                </div>
                <span style={{ fontSize: 11, color: "#6b7280" }}>{s.hours} {t("cgPeriodsPerWeek")}</span>
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
    <div style={{ borderBottom: "1px solid #f3f4f6" }}>
      <div style={{ padding: "11px 18px 3px" }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</span>
      </div>
      <div style={{ padding: "0 18px 10px" }}>{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "5px 0", borderBottom: "1px solid #f9fafb" }}>
      <span style={{ fontSize: 12, color: "#6b7280", minWidth: 130, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "#111827", textAlign: "right" }}>{value || "-"}</span>
    </div>
  );
}

function Pill({ ok, text }: { ok: boolean; text: string }) {
  if (!text) return null;
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: ok ? "#d1fae5" : "#fef3c7", color: ok ? "#065f46" : "#92400e" }}>
      {text}
    </span>
  );
}

function PillRow({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #f9fafb" }}>
      <span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span>
      {text ? <Pill ok={ok} text={text} /> : <span style={{ fontSize: 12.5 }}>-</span>}
    </div>
  );
}

function CRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
      <span style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.5 }}>{value || "-"}</span>
    </div>
  );
}
