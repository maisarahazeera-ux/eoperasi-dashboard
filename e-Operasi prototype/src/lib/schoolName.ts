// Shortens official school names for chart labels, e.g.
// "Sekolah Menengah Kebangsaan Taman Universiti" -> "SMK Taman Universiti".
// Order matters: longer prefixes must be checked first.
const PREFIXES: [string, string][] = [
  ["Sekolah Menengah Kebangsaan", "SMK"],
  ["Sekolah Jenis Kebangsaan (Cina)", "SJKC"],
  ["Sekolah Jenis Kebangsaan (Tamil)", "SJKT"],
  ["Sekolah Kebangsaan", "SK"],
];

export function shortSchoolName(name: string): string {
  for (const [full, short] of PREFIXES) {
    if (name.startsWith(full)) return short + name.slice(full.length);
  }
  return name;
}