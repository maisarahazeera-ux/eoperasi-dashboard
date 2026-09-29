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
import { PagerButton, Tag } from "../components/ui";
import SearchableSelect from "../lib/SearchableSelect";
import PageHero from "../components/PageHero";
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

export default function CarianGuru({ initialQuery = "" }: { initialQuery?: string }) {
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";
  const { teachers, error } = useTeachers();
  const { schoolTypes, schoolsByType, subjects, employmentStatuses } = useTeacherLookups(teachers);

  const [query, setQuery] = useState(initialQuery);
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
      <PageHero title={t("titleCarianGuru")} />
      {/* Filter bar */}
      <div style={{ padding: "4px 32px 16px", background: "transparent", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", flexShrink: 0 }}>
        <div style={{ position: "relative", minWidth: 230, flex: "1 1 230px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} color="#9ca3af" />
          <input type="text" placeholder={t("cgSearchPlaceholder")} value={query}
            onChange={(e) => withReset(setQuery)(e.target.value)} style={{ paddingLeft: 32, height: 38, borderRadius: 999 }} />
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
            className="soft-pill small ghost">
            <X size={12} /> {t("cgClear")}
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--soft-muted)", whiteSpace: "nowrap" }}>
          {filtered.length.toLocaleString(locale)} {t("cgRecordsFound")}
        </span>
      </div>

      {/* Table + detail panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", background: "var(--mac-bg)", padding: "8px 32px 28px" }}>
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="soft-table">
              <thead>
                <tr>
                  {(["", "cgColName", "cgColIc", "cgColSchool", "cgColType", "cgColPosition", "cgColGrade", "cgColSubject"] as (DictKey | "")[]).map((h, i) => (
                    <th key={i}>
                      {h ? t(h) : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((x, i) => (
                  <tr key={x.id} className="table-row-hover"
                    onClick={() => { setSelected(x); setShowIC(false); }}
                    style={{ background: selected?.id === x.id ? "var(--hover)" : undefined }} data-i={i}>
                    <td style={{ padding: "9px 13px" }}>
                      <Avatar gender={x.gender} size={32} />
                    </td>
                    <td style={{ padding: "9px 13px", fontSize: 13, fontWeight: 500, color: "var(--soft-text)" }}>{x.name}</td>
                    <td style={{ padding: "9px 13px", fontSize: 11.5, color: "var(--soft-muted)", fontFamily: "monospace", whiteSpace: "nowrap" }}>{maskIC(x.icNumber)}</td>
                    <td style={{ padding: "9px 13px", fontSize: 12, color: "var(--soft-text-2)", maxWidth: 200 }} title={x.school}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{shortSchoolName(x.school)}</div>
                    </td>
                    <td style={{ padding: "9px 13px" }}>
                      <span style={schoolTypeChip(x.schoolType)}>{x.schoolType}</span>
                    </td>
                    <td style={{ padding: "9px 13px", fontSize: 12, color: "var(--soft-text-2)", maxWidth: 200 }} title={x.position ?? ""}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.position || "-"}</div>
                    </td>
                    <td style={{ padding: "9px 13px" }}>
                      <span className="tag tag-info">{x.gredHakiki || "-"}</span>
                    </td>
                    <td style={{ padding: "9px 13px", fontSize: 12, color: "var(--soft-muted)" }}>{x.subjects[0]?.name ?? "-"}</td>
                  </tr>
                ))}
                {paginated.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--soft-faint)", fontSize: 13 }}>{t("cgNoRecords")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 14 }}>
              <PageBtn label={t("cgPrev")} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} />
              <span style={{ fontSize: 12, color: "var(--soft-muted)" }}>{t("cgPage")} {page} / {totalPages}</span>
              <PageBtn label={t("cgNext")} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} />
            </div>
          )}
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

function PageBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return <PagerButton label={label} onClick={onClick} disabled={disabled} />;
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
      <div style={{ background: "var(--tint-blue)", padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            <Avatar gender={x.gender} size={50} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--soft-text)", lineHeight: 1.3 }}>{x.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--soft-text-2)", marginTop: 2 }}>{x.position} · {x.gredHakiki}</div>
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
        <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--soft-muted)" }}>{x.school}</div>
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
