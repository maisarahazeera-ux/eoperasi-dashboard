import { Filter, RotateCcw, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { SCHOOL_TYPES, SUBJECTS, EMPLOYMENT_STATUS, SCHOOLS_BY_TYPE } from "../data/mockData";
import { NAVY, TEAL } from "./colors";
import { useLanguage } from "../context/LanguageContext";
import { employmentLabel } from "./labels";
import { shortSchoolName } from "./schoolName";
import SearchableSelect from "./SearchableSelect";

export interface Filters {
  schoolType: string;
  schoolName: string;
  // Not shown in the UI: all schools sit under PPD Johor Bahru, and the source
  // "DAERAH SEMASA" column is the teacher's home district, not the school's.
  // Kept only so the not-yet-migrated mock pages still compile.
  district: string;
  gender: string;
  subject: string;
  employmentStatus: string;
}

export const DEFAULT_FILTERS: Filters = {
  schoolType: "", schoolName: "", district: "", gender: "", subject: "", employmentStatus: "",
};

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  // Optional real-data lookup lists. Falls back to the mock lists when not
  // supplied, so pages that haven't been wired to the real API yet keep
  // working exactly as before.
  schoolTypes?: readonly string[];
  schoolsByType?: Record<string, string[]>;
  subjects?: readonly string[];
  employmentStatuses?: readonly string[];
}

export default function FilterSidebar({
  filters, onChange,
  schoolTypes = SCHOOL_TYPES,
  schoolsByType = SCHOOLS_BY_TYPE,
  subjects = SUBJECTS,
  employmentStatuses = EMPLOYMENT_STATUS,
}: Props) {
  const { t } = useLanguage();
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    onChange({ ...filters, [k]: v });

  // With a school type chosen, only that type's schools; otherwise every school.
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

  const isDirty = Object.values(filters).some(Boolean);
  const activeCount = Object.values(filters).filter(Boolean).length;

  // Collapsed state is shared by every page and remembered in this browser.
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    try { return localStorage.getItem("filterSidebarCollapsed") === "1"; } catch { return false; }
  });
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try { localStorage.setItem("filterSidebarCollapsed", v ? "1" : "0"); } catch { /* ignore */ }
  };

  if (collapsed) {
    return (
      <aside style={{ width: 44, background: "#fff", borderRight: "1px solid #e5e7eb", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, gap: 10 }}>
        <button onClick={() => setCollapsed(false)} title={t("filterShow")}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 6, borderRadius: 6, color: NAVY, display: "flex" }}>
          <PanelLeftOpen size={18} />
        </button>
        <button onClick={() => setCollapsed(false)} title={t("filterShow")}
          style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 6, color: NAVY, display: "flex" }}>
          <Filter size={16} />
          {activeCount > 0 && (
            <span style={{ position: "absolute", top: 0, right: -2, background: TEAL, color: "#fff", borderRadius: 99, fontSize: 9.5, fontWeight: 700, minWidth: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
              {activeCount}
            </span>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside style={{ width: 216, background: "#fff", borderRight: "1px solid #e5e7eb", flexShrink: 0, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Filter size={13} color={NAVY} />
        <span style={{ fontSize: 11, fontWeight: 700, color: NAVY, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t("filterTitle")}</span>
        <button onClick={() => setCollapsed(true)} title={t("filterHide")}
          style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 6, color: "#6b7280", display: "flex" }}>
          <PanelLeftClose size={16} />
        </button>
      </div>

      <FilterField label={t("filterSchoolType")}>
        <select value={filters.schoolType} onChange={(e) => onChange({ ...filters, schoolType: e.target.value, schoolName: "" })}>
          <option value="">{t("filterAll")}</option>
          {schoolTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </FilterField>

      <FilterField label={t("filterSchoolName")}>
        <SearchableSelect
          value={filters.schoolName}
          options={schoolOptions}
          onChange={(v) => set("schoolName", v)}
          {...searchLabels}
        />
      </FilterField>

      <FilterField label={t("filterGender")}>
        <select value={filters.gender} onChange={(e) => set("gender", e.target.value)}>
          <option value="">{t("filterAll")}</option>
          <option value="L">{t("genderL")}</option>
          <option value="P">{t("genderP")}</option>
        </select>
      </FilterField>

      <FilterField label={t("filterSubject")}>
        <SearchableSelect
          value={filters.subject}
          options={subjectOptions}
          onChange={(v) => set("subject", v)}
          {...searchLabels}
        />
      </FilterField>

      <FilterField label={t("filterEmployment")}>
        <select value={filters.employmentStatus} onChange={(e) => set("employmentStatus", e.target.value)}>
          <option value="">{t("filterAll")}</option>
          {employmentStatuses.map((s) => <option key={s} value={s}>{employmentLabel(s, t)}</option>)}
        </select>
      </FilterField>

      {isDirty && (
        <button onClick={() => onChange(DEFAULT_FILTERS)}
          style={{ marginTop: 4, padding: "7px", borderRadius: 7, border: `1px solid ${TEAL}`, background: "transparent", color: TEAL, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <RotateCcw size={12} /> {t("filterReset")}
        </button>
      )}
    </aside>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="filter-label">{label}</div>
      {children}
    </div>
  );
}
