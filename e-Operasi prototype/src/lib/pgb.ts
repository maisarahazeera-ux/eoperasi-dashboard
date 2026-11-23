import type { Teacher } from "./api";

/** Pengetua / Guru Besar (school heads). SEPADU lists them all as "PENGETUA/GURU BESAR". */
export type PgbRole = "Guru Besar" | "Pengetua" | "Pengetua Cemerlang / Kanan" | "Guru Besar Cemerlang / Kanan";

export function pgbRole(x: Teacher): PgbRole | null {
  const p = (x.position ?? "").toLowerCase();
  if (!p.includes("pengetua/guru besar")) return null;
  const secondary = x.schoolType === "SMK";           // secondary = Pengetua, primary = Guru Besar
  const senior = p.includes("cemerlang") || p.includes("kanan");
  if (secondary) return senior ? "Pengetua Cemerlang / Kanan" : "Pengetua";
  return senior ? "Guru Besar Cemerlang / Kanan" : "Guru Besar";
}

export const isPgb = (x: Teacher) => pgbRole(x) !== null;

/** Shown in the Jawatan column: the PGB role, otherwise the SEPADU position. */
export function jawatanLabel(x: Teacher): string {
  return pgbRole(x) ?? x.position ?? "";
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

/** Excel EDATE: same day n months later, or the month's last day if it doesn't exist. */
function addMonths(d: Date, n: number): Date {
  const y = d.getFullYear(), m = d.getMonth() + n;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(d.getDate(), last));
}

/**
 * Whole years, months and days from `from` to `to`, worked out exactly like the
 * formulas in PPD's "Senarai Pengetua dan Guru Besar" spreadsheet.
 */
export function ymd(from: Date, to: Date): { y: number; m: number; d: number } {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (to.getDate() < from.getDate() ? 1 : 0);
  const anchor = addMonths(from, months);
  const d = Math.round((to.getTime() - anchor.getTime()) / 864e5);
  return { y: Math.floor(months / 12), m: months % 12, d };
}

/** Words for "x tahun y bulan z hari". The *One forms are used for 1 ("1 year", not "1 years"). */
export interface DurationWords {
  year: string; month: string; day: string; retired: string;
  yearOne?: string; monthOne?: string; dayOne?: string;
}

export function durationText(fromIso: string | null | undefined, toIso: string | null | undefined, w: DurationWords, today = new Date()): string {
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const from = fromIso === "today" ? now : parse(fromIso);
  const to = toIso === "today" ? now : parse(toIso);
  if (!from || !to) return "";
  if (to < from) return toIso === "today" ? "" : w.retired;
  const { y, m, d } = ymd(from, to);
  const word = (n: number, many: string, one?: string) => `${n} ${n === 1 ? one ?? many : many}`;
  return `${word(y, w.year, w.yearOne)} ${word(m, w.month, w.monthOne)} ${word(d, w.day, w.dayOne)}`;
}

/** Length of service at the current school. */
export const tempohKhidmatSekolah = (x: Teacher, w: DurationWords) => durationText(x.tarikhKhidmatSekolahSemasa, "today", w);
/** Time in the current post. */
export const tempohLantikanJawatan = (x: Teacher, w: DurationWords) => durationText(x.tarikhLantikanJawatanSemasa, "today", w);
/** Time left until retirement ("Telah bersara" if the date has passed). */
export const bakiPerkhidmatan = (x: Teacher, w: DurationWords) => durationText("today", x.retirementDate, w);
