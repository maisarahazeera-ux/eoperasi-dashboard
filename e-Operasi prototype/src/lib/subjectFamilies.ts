import type { Teacher } from "./api";

/**
 * OPSYEN ↔ SUBJEK MATCHING RULES
 * ------------------------------------------------------------------
 * SEPADU uses different wording for the same field, e.g. opsyen "TESL"
 * vs subject "Bahasa Inggeris". So instead of comparing names directly,
 * every opsyen and every subject is placed into a "bidang" (field) using
 * the keyword patterns below. A teacher is "Sepadan" when at least one
 * subject they teach shares a bidang with Opsyen 1 or Opsyen 2.
 *
 * TO CHANGE A RULE: edit the keywords of one bidang below. Keywords are
 * regular expressions matched against the UPPERCASE name.
 * These rules are a draft and should be confirmed by the supervisor.
 */
export const BIDANG_RULES: { bidang: string; keywords: string[] }[] = [
  { bidang: "Prasekolah", keywords: ["PRA ?-?SEKOLAH", "PRASEKOLAH", "AWAL KANAK-KANAK"] },
  { bidang: "Pendidikan Khas", keywords: ["KHAS", "MASALAH PEMBELAJARAN", "AUTISM", "PENGLIHATAN", "PENDENGARAN", "INKLUSIF", "INTEGRASI"] },
  { bidang: "Pemulihan", keywords: ["PEMULIHAN", "LINUS"] },
  { bidang: "Bimbingan & Kaunseling", keywords: ["KAUNSEL", "BIMBINGAN"] },
  { bidang: "Bahasa Inggeris", keywords: ["INGGERIS", "TESL", "TESOL", "ENGLISH", "LANGUAGE ARTS", "LITERATURE"] },
  { bidang: "Bahasa Melayu", keywords: ["MELAYU", "BAHASA KEBANGSAAN"] },
  { bidang: "Bahasa Cina", keywords: ["CINA", "MANDARIN", "CHINESE"] },
  { bidang: "Bahasa Tamil", keywords: ["TAMIL"] },
  { bidang: "Bahasa Arab", keywords: ["ARAB"] },
  { bidang: "Bahasa Asing", keywords: ["JEPUN", "JERMAN", "KOREA", "PERANCIS", "SEPANYOL"] },
  { bidang: "Pendidikan Islam", keywords: ["ISLAM", "QURAN", "TASMIK", "SYARIAH", "US+ULUDDIN", "DINI", "J-?QAF", "JAWI", "FARDU", "TAHFIZ", "SUNNAH", "HADIS", "AKIDAH", "TILAWAH", "KAFA", "QIRAAT"] },
  { bidang: "Pendidikan Moral", keywords: ["MORAL", "SIVIK", "KEWARGANEGARAAN"] },
  { bidang: "Matematik", keywords: ["MATEMATIK", "MATHEMATIC", "STATISTIK"] },
  { bidang: "Sains", keywords: ["SAINS(?! SUKAN| KOMPUTER| RUMAH)", "BIOLOGI", "KIMIA", "FIZIK", "SCIENCE", "CHEMISTRY", "PHYSICS", "BIOLOGY"] },
  { bidang: "Sains Komputer / TMK", keywords: ["KOMPUTER", "TMK", "ICT", "TEKNOLOGI MAKLUMAT", "DIGITAL", "MULTIMEDIA"] },
  { bidang: "RBT / Kemahiran Hidup / Vokasional", keywords: ["REKA ?BENTUK", "KEMAHIRAN HIDUP", "MPEI", "MPV", "PVMA", "KV -", "VOKASIONAL", "KEJURUTERAAN", "PERTANIAN", "SAINS RUMAH", "RUMAH TANGGA", "ELEKTRIK", "MEKANIKAL", "GRAFIK", "TEKNIKAL", "KERJA KAYU", "JAHITAN", "MASAKAN", "KATERING", "LANSKAP", "MEMESIN", "BINAAN", "REKA CIPTA", "AUTOMOTIF", "PERABOT", "DEKORASI", "PENYEDIAAN MAKANAN"] },
  { bidang: "Pendidikan Jasmani & Kesihatan", keywords: ["JASMANI", "KESIHATAN", "SUKAN"] },
  { bidang: "Seni & Muzik", keywords: ["SENI", "MUZIK", "VISUAL", "TARIAN", "TEATER", "MUSIC"] },
  { bidang: "Sejarah", keywords: ["SEJARAH", "HISTORY"] },
  { bidang: "Geografi", keywords: ["GEOGRAFI"] },
  { bidang: "Perniagaan / Ekonomi / Perakaunan", keywords: ["EKONOMI", "PERNIAGAAN", "PERAKAUNAN", "AKAUN", "PERDAGANGAN", "KEWANGAN", "KEUSAHAWANAN"] },
  { bidang: "Pengajian Am", keywords: ["PENGAJIAN AM"] },
];

/** Extra bidang a teacher's opsyen also covers (e.g. Pemulihan teaches BM and Maths). */
const OPSYEN_ALSO_COVERS: Record<string, string[]> = {
  "Pemulihan": ["Bahasa Melayu", "Matematik"],
};

/** Subjects that are not really a teaching subject and are ignored in matching. */
const IGNORED_SUBJECTS = [/KOKURIKULUM/, /KERJA KURSUS/];

const COMPILED = BIDANG_RULES.map((r) => ({ bidang: r.bidang, re: new RegExp(r.keywords.join("|")) }));

export function bidangOf(name: string | null | undefined): string[] {
  if (!name) return [];
  const up = name.trim().toUpperCase();
  if (!up || up === "TIADA") return [];
  return COMPILED.filter((c) => c.re.test(up)).map((c) => c.bidang);
}

export type MatchStatus = "Sepadan" | "Tidak Sepadan" | "Tidak Dapat Ditentukan";

export interface MatchResult {
  status: MatchStatus;
  /** Index of each taught subject that falls inside the teacher's opsyen bidang. */
  matchedSubjects: Set<number>;
  /** Which opsyen (1 and/or 2) is covered by at least one taught subject. */
  matchedOpsyen: Set<1 | 2>;
}

export function matchOpsyen(x: Teacher): MatchResult {
  const op1 = bidangOf(x.opsyen1);
  const op2 = bidangOf(x.opsyen2);
  const expand = (bs: string[]) => new Set(bs.flatMap((b) => [b, ...(OPSYEN_ALSO_COVERS[b] ?? [])]));
  const cover1 = expand(op1);
  const cover2 = expand(op2);

  const subjects = x.subjects
    .map((s, i) => ({ i, name: s.name }))
    .filter((s) => !IGNORED_SUBJECTS.some((re) => re.test(s.name.toUpperCase())));

  const matchedSubjects = new Set<number>();
  const matchedOpsyen = new Set<1 | 2>();
  subjects.forEach(({ i, name }) => {
    const b = bidangOf(name);
    if (b.some((v) => cover1.has(v))) { matchedSubjects.add(i); matchedOpsyen.add(1); }
    if (b.some((v) => cover2.has(v))) { matchedSubjects.add(i); matchedOpsyen.add(2); }
  });

  // Not enough information to judge: no subjects, or no recognisable opsyen.
  if (subjects.length === 0 || (cover1.size === 0 && cover2.size === 0)) {
    return { status: "Tidak Dapat Ditentukan", matchedSubjects, matchedOpsyen };
  }
  return {
    status: matchedSubjects.size > 0 ? "Sepadan" : "Tidak Sepadan",
    matchedSubjects,
    matchedOpsyen,
  };
}
