import type { DictKey } from "../context/LanguageContext";

// Data values stay in Malay (as stored in the database); only the
// displayed label changes with the language toggle.
const EMPLOYMENT_KEYS: Record<string, DictKey> = {
  Tetap: "empTetap",
  Kontrak: "empKontrak",
  Sandaran: "empSandaran",
};

export function employmentLabel(value: string, t: (k: DictKey) => string): string {
  const key = EMPLOYMENT_KEYS[value];
  return key ? t(key) : value;
}

// English display names for common Malay values stored in the data.
// Anything not listed here (school names, subjects, grades) is shown as-is.
const VALUE_EN: Record<string, string> = {
  Aktif: "Active",
  "Tidak Aktif": "Inactive",
  Disahkan: "Confirmed",
  "Belum Disahkan": "Not Confirmed",
  Selesai: "Completed",
  "Dalam Tempoh Induksi": "In Induction",
  Berkahwin: "Married",
  "Belum Berkahwin": "Single",
  Janda: "Divorced / Widowed (F)",
  Balu: "Widowed",
  Duda: "Divorced / Widowed (M)",
  Melayu: "Malay",
  Cina: "Chinese",
  India: "Indian",
  "Lain-Lain": "Others",
  Kristian: "Christian",
  "Tiada Agama": "No Religion",
  Tetap: "Permanent",
  Kontrak: "Contract",
  Sandaran: "Secondment",
};

export function valueLabel(value: string | null | undefined, lang: "ms" | "en"): string {
  if (!value) return "";
  return lang === "en" ? VALUE_EN[value] ?? value : value;
}

/** Treats the data's "Tiada"/"TIADA" placeholders as empty. */
export function clean(value: string | null | undefined): string {
  if (!value) return "";
  return value.trim().toUpperCase() === "TIADA" ? "" : value;
}

// Show the biggest / most common status first instead of alphabetical order.
const EMPLOYMENT_ORDER = ["Tetap", "Kontrak", "Sandaran"];

export function sortEmploymentStatuses(values: string[]): string[] {
  const rank = (v: string) => {
    const i = EMPLOYMENT_ORDER.indexOf(v);
    return i === -1 ? EMPLOYMENT_ORDER.length : i;
  };
  return [...values].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
