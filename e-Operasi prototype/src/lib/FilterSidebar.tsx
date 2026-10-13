import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { useState } from "react";
import { SCHOOL_TYPES, SUBJECTS, EMPLOYMENT_STATUS, SCHOOLS_BY_TYPE } from "../data/mockData";
import { useLanguage } from "../context/LanguageContext";
import { employmentLabel } from "./labels";
import { shortSchoolName } from "./schoolName";
import SearchableSelect from "./SearchableSelect";
import PageHero from "../components/PageHero";
import ReportButton from "../components/ReportButton";
import type { Report } from "./report";
import type { DictKey } from "../context/LanguageContext";

export interface Filters {
  schoolType: string;
  schoolName: string;
  // Not shown in the UI: all schools sit under PPD Johor Bahru, and the source
  // "DAERAH SEMASA" column is the teacher's home district, not the school's.
  district: string;
  gender: string;
  subject: string;
  employmentStatus: string;
}

export const DEFAULT_FILTERS: Filters = {
  schoolType: "", schoolName: "", district: "", gender: "", subject: "", employmentStatus: "",
};

interface Props {
  /** Page title shown in the heading above the filters. */
  title: string;
  filters: Filters;
  onChange: (f: Filters) => void;
  schoolTypes?: readonly string[];
  schoolsByType?: Record<string, string[]>;
  subjects?: readonly string[];
  employmentStatuses?: readonly string[];
  /** When given, a "Muat Turun" button (PDF / Excel) is shown beside the filters. */
  report?: () => Report;
}

/** The filters in force as readable lines for a report, e.g. "Jenis Sekolah: SMK". */
export function describeFilters(f: Filters, t: (k: DictKey) => string): string[] {
  const out: string[] = [];
  if (f.schoolType) out.push(`${t("filterSchoolType")}: ${f.schoolType}`);
  if (f.schoolName) out.push(`${t("filterSchoolName")}: ${f.schoolName}`);
  if (f.employmentStatus) out.push(`${t("filterEmployment")}: ${employmentLabel(f.employmentStatus, t)}`);
  if (f.gender) out.push(`${t("filterGender")}: ${f.gender === "L" ? t("genderL") : t("genderP")}`);
  if (f.subject) out.push(`${t("filterSubject")}: ${f.subject}`);
  return out;
}

/**
 * Page heading + filters.
 * The three most-used filters are pill dropdowns beside the title; school and
 * subject open in a second row under "Tapisan lain".
 * The file keeps its old name so every page's import still works.
 */
export default function FilterSidebar({
  title, filters, onChange,
  schoolTypes = SCHOOL_TYPES,
  schoolsByType = SCHOOLS_BY_TYPE,
  subjects = SUBJECTS,
  employmentStatuses = EMPLOYMENT_STATUS,
  report,
}: Props) {
  const { t } = useLanguage();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });

  const schoolList = filters.schoolType
    ? (schoolsByType[filters.schoolType] || [])
    : Array.from(new Set(Object.values(schoolsByType).flat())).sort();
  const schoolOptions = schoolList.map((s) => ({ value: s, label: shortSchoolName(s) }));
  const subjectOptions = subjects.map((s) => ({ value: s, label: s }));

  const searchLabels = {
    allLabel: t("filterAll"),
    searchPlaceholder: t("filterSearchPlaceholder"),
    noMatchLabel: t("filterNoMatch"),
  };

  const moreCount = [filters.schoolName, filters.subject].filter(Boolean).length;
  const isDirty = Object.values(filters).some(Boolean);

  // Open/closed state is shared by every page and remembered in this browser.
  const [open, setOpenState] = useState<boolean>(() => {
    try { return localStorage.getItem("filterBarOpen") === "1"; } catch { return false; }
  });
  const setOpen = (v: boolean) => {
    setOpenState(v);
    try { localStorage.setItem("filterBarOpen", v ? "1" : "0"); } catch { /* ignore */ }
  };

  return (
    <div className="soft-filter-wrap">
      <PageHero title={title}>
        <select
          className={`soft-pill-select${filters.schoolType ? " set" : ""}`}
          aria-label={t("filterSchoolType")}
          value={filters.schoolType}
          onChange={(e) => onChange({ ...filters, schoolType: e.target.value, schoolName: "" })}
        >
          <option value="">{t("filterSchoolType")}: {t("filterAll")}</option>
          {schoolTypes.map((st) => <option key={st} value={st}>{st}</option>)}
        </select>

        <select
          className={`soft-pill-select${filters.employmentStatus ? " set" : ""}`}
          aria-label={t("filterEmployment")}
          value={filters.employmentStatus}
          onChange={(e) => set("employmentStatus", e.target.value)}
        >
          <option value="">{t("softStatus")}: {t("filterAll")}</option>
          {employmentStatuses.map((s) => <option key={s} value={s}>{employmentLabel(s, t)}</option>)}
        </select>

        <select
          className={`soft-pill-select${filters.gender ? " set" : ""}`}
          aria-label={t("filterGender")}
          value={filters.gender}
          onChange={(e) => set("gender", e.target.value)}
        >
          <option value="">{t("filterGender")}: {t("filterAll")}</option>
          <option value="L">{t("genderL")}</option>
          <option value="P">{t("genderP")}</option>
        </select>

        <button type="button" className={`soft-pill${open || moreCount ? " set" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          <SlidersHorizontal size={13} />
          {t("macMoreFilters")}
          {moreCount > 0 && <span className="soft-badge">{moreCount}</span>}
        </button>

        {isDirty && (
          <button type="button" className="soft-pill ghost" onClick={() => onChange(DEFAULT_FILTERS)}>
            <RotateCcw size={12} /> {t("filterReset")}
          </button>
        )}

        {report && <ReportButton getReport={report} />}
      </PageHero>

      {open && (
        <div className="soft-more-filters">
          <div className="soft-filter-field">
            <span>{t("filterSchoolName")}</span>
            <SearchableSelect value={filters.schoolName} options={schoolOptions}
              onChange={(v) => set("schoolName", v)} {...searchLabels} />
          </div>
          <div className="soft-filter-field">
            <span>{t("filterSubject")}</span>
            <SearchableSelect value={filters.subject} options={subjectOptions}
              onChange={(v) => set("subject", v)} {...searchLabels} />
          </div>
        </div>
      )}
    </div>
  );
}
