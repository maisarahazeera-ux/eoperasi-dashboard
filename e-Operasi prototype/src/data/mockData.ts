export const SCHOOL_TYPES = ["SK", "SMK", "SBP", "SABK", "Sekolah Sukan", "Sekolah Seni", "Pendidikan Khas"] as const;
export type SchoolType = typeof SCHOOL_TYPES[number];

export const SCHOOLS_BY_TYPE: Record<SchoolType, string[]> = {
  SK: [
    "SK Taman Universiti", "SK Taman Pelangi", "SK Larkin Tengah",
    "SK Johor Jaya", "SK Pandan", "SK Tampoi", "SK Bukit Mewah",
    "SK Taman Daya", "SK Sungai Tiram", "SK Pengkalan Rinting",
    "SK Kempas Baru", "SK Taman Abad",
  ],
  SMK: [
    "SMK Taman Universiti", "SMK Taman Pelangi", "SMK Dato Jaafar",
    "SMK Johor Jaya", "SMK Infant Jesus Convent", "SMK Taman Daya",
    "SMK Permas Jaya", "SMK Bukit Indah", "SMK Taman Molek", "SMK Larkin",
  ],
  SBP: [
    "Sekolah Dato' Abdul Razak", "Sekolah Tun Fatimah",
  ],
  SABK: [
    "SABK Maahad Johor", "SABK Pondok Ledang",
  ],
  "Sekolah Sukan": [
    "Sekolah Sukan Tun Abdul Razak",
  ],
  "Sekolah Seni": [
    "Sekolah Seni Malaysia Johor",
  ],
  "Pendidikan Khas": [
    "Sekolah Kebangsaan Pendidikan Khas Johor Bahru",
    "Program Pendidikan Khas Integrasi Johor Bahru",
  ],
};

export const ALL_SCHOOLS = Object.entries(SCHOOLS_BY_TYPE).flatMap(([type, schools]) =>
  schools.map((name) => ({ name, type: type as SchoolType }))
);

export const SUBJECTS = [
  "Bahasa Malaysia", "Bahasa Inggeris", "Matematik", "Sains",
  "Sejarah", "Geografi", "Pendidikan Islam", "Pendidikan Jasmani",
  "Seni Visual", "Muzik", "Kemahiran Hidup", "Biologi", "Fizik", "Kimia",
  "Matematik Tambahan", "Ekonomi", "Perniagaan", "Pendidikan Moral",
  "Pendidikan Khas", "Sains Sukan",
];

export const GRADS = ["DG41", "DG44", "DG48", "DG52", "DG54", "DS45", "DS49", "DS52", "DS54"];
export const RACES = ["Melayu", "Cina", "India", "Lain-lain"];
export const RELIGIONS = ["Islam", "Buddha", "Hindu", "Kristian", "Lain-lain"];
export const MARITAL = ["Berkahwin", "Bujang", "Duda/Janda"];
export const QUALIFICATIONS = [
  "Sarjana Muda Pendidikan", "Sarjana Pendidikan", "Diploma Pendidikan",
  "Sarjana Muda + DPLI", "PhD Pendidikan",
];
export const EMPLOYMENT_STATUS = ["Tetap", "Kontrak", "Sandaran"];
export const VACCINE_TYPES = ["Pfizer-BioNTech", "AstraZeneca", "Sinovac", "Moderna"];
export const DISTRICTS = [
  "Johor Bahru Tengah", "Johor Bahru Selatan", "Johor Bahru Utara",
  "Iskandar Puteri", "Pulai", "Kempas",
];
export const TUGAS_KHAS_LIST = [
  "Ketua Panitia", "GKMP", "Setiausaha Peperiksaan", "Penyelaras Kokurikulum",
  "Penyelaras Disiplin", "Guru Data", "Guru Penasihat PIBG",
];
export const RETIREMENT_AGE = 60;

const FIRST_NAMES_M = [
  "Ahmad", "Muhammad", "Mohd", "Azman", "Hafiz", "Faizal", "Rizal", "Amirul",
  "Zulkifli", "Hasrul", "Nazri", "Razif", "Fadzli", "Ismail", "Rahim",
];
const FIRST_NAMES_F = [
  "Siti", "Nor", "Noor", "Azizah", "Faridah", "Noraini", "Hafizah", "Zuraida",
  "Rohana", "Suraya", "Azlina", "Norhayati", "Salina", "Aisyah", "Ramlah",
];
const LAST_NAMES = [
  "bin Abdullah", "bin Ahmad", "binti Ismail", "bin Hassan", "binti Mohd Noor",
  "bin Othman", "binti Razali", "bin Ibrahim", "binti Kamaruddin", "bin Yusof",
  "binti Hamid", "bin Roslan", "binti Zainal", "bin Bakar", "binti Salleh",
];

function randItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randDate(year: number): string {
  const m = String(randInt(1, 12)).padStart(2, "0");
  const d = String(randInt(1, 28)).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export interface Teacher {
  id: number;
  name: string;
  gender: "L" | "P";
  icNumber: string;
  school: string;
  schoolType: SchoolType;
  position: string;
  gredHakiki: string;
  gredPenyandang: string;
  employmentStatus: string;
  serviceStatus: "Aktif" | "Tidak Aktif";
  dateOfBirth: string;
  maritalStatus: string;
  race: string;
  religion: string;
  nationality: string;
  firstAppointmentDate: string;
  qualification: string;
  opsyen1: string;
  opsyen2: string;
  subjects: { name: string; hours: number }[];
  phone: string;
  email: string;
  address: string;
  vaccinated: boolean;
  vaccineType: string;
  vaccineDose1: string;
  vaccineDose2: string;
  salary: number;
  age: number;
  district: string;
  retirementDate: string;
  ikhtisas: boolean;
  statusInduksi: "Dalam Tempoh Induksi" | "Selesai";
  sahPerkhidmatan: "Disahkan" | "Belum Disahkan";
  guruCemerlang: boolean;
  guruCemerlangBidang: string;
  tugasKhas: string;
  kodJawatanDiisi: boolean;
}

const POSITIONS_BY_TYPE: Record<string, string[]> = {
  SK: ["Guru Besar", "Penolong Kanan", "Guru"],
  SMK: ["Pengetua", "Penolong Kanan", "Guru Kanan", "Guru"],
  SBP: ["Pengetua", "Penolong Kanan", "Guru Kanan", "Guru"],
  SABK: ["Pengetua", "Penolong Kanan", "Guru"],
  "Sekolah Sukan": ["Pengetua", "Guru Sukan", "Guru"],
  "Sekolah Seni": ["Pengetua", "Guru Seni", "Guru"],
  "Pendidikan Khas": ["Guru Besar", "Guru Pendidikan Khas", "Guru"],
};

const COUNTS_BY_TYPE: Record<string, [number, number]> = {
  SK: [28, 55],
  SMK: [35, 70],
  SBP: [40, 60],
  SABK: [25, 40],
  "Sekolah Sukan": [20, 30],
  "Sekolah Seni": [20, 30],
  "Pendidikan Khas": [15, 25],
};

let _teachers: Teacher[] | null = null;

export function generateTeachers(): Teacher[] {
  if (_teachers) return _teachers;
  const seeded = mulberry32(42);

  const teachers: Teacher[] = [];
  let id = 1;

  for (const { name: schoolName, type } of ALL_SCHOOLS) {
    const [lo, hi] = COUNTS_BY_TYPE[type] ?? [20, 40];
    const count = lo + Math.floor(seeded() * (hi - lo + 1));
    const positions = POSITIONS_BY_TYPE[type] ?? ["Guru"];

    for (let i = 0; i < count; i++) {
      const gender = seeded() > 0.38 ? "P" : ("L" as "L" | "P");
      const firstName = randItemSeeded(gender === "L" ? FIRST_NAMES_M : FIRST_NAMES_F, seeded);
      const lastName = randItemSeeded(LAST_NAMES, seeded);
      const name = `${firstName} ${lastName}`;
      const birthYear = 1965 + Math.floor(seeded() * 34);
      const age = 2026 - birthYear;
      const dob = randDate(birthYear);
      const icYear = String(birthYear).slice(2);
      const icNum = `${icYear}${String(1 + Math.floor(seeded() * 12)).padStart(2, "0")}${String(1 + Math.floor(seeded() * 28)).padStart(2, "0")}${String(10 + Math.floor(seeded() * 89))}-${String(10 + Math.floor(seeded() * 5))}-${String(1000 + Math.floor(seeded() * 9000))}`;

      const gredIdx = Math.floor(seeded() * GRADS.length);
      const gred = GRADS[gredIdx];
      const gredPenyandang = GRADS[Math.min(gredIdx + 1 + Math.floor(seeded() * 3), GRADS.length - 1)];

      const empYears = Math.max(1, age - 22 - Math.floor(seeded() * 6));
      const firstApptYear = Math.max(2000, 2026 - empYears);
      const firstAppt = randDate(firstApptYear);

      const op1 = randItemSeeded(SUBJECTS, seeded);
      let op2 = randItemSeeded(SUBJECTS, seeded);
      while (op2 === op1) op2 = randItemSeeded(SUBJECTS, seeded);

      const subjectCount = 1 + Math.floor(seeded() * 3);
      const subjs: { name: string; hours: number }[] = [];
      const used = new Set<string>();
      for (let s = 0; s < subjectCount; s++) {
        let sub: string;
        if (s === 0 && seeded() > 0.25) {
          sub = seeded() > 0.5 ? op1 : op2;
        } else {
          sub = randItemSeeded(SUBJECTS, seeded);
        }
        if (used.has(sub)) sub = randItemSeeded(SUBJECTS, seeded);
        used.add(sub);
        subjs.push({ name: sub, hours: 4 + Math.floor(seeded() * 7) });
      }

      const vaccinated = seeded() > 0.08;
      const empStatus = seeded() > 0.2 ? "Tetap" : seeded() > 0.5 ? "Kontrak" : "Sandaran";
      const serviceStatus: "Aktif" | "Tidak Aktif" = seeded() > 0.05 ? "Aktif" : "Tidak Aktif";

      const baseSalary: Record<string, number> = {
        DG41: 3000, DG44: 3800, DG48: 4600, DG52: 5500, DG54: 6400,
        DS45: 4000, DS49: 4900, DS52: 5600, DS54: 6600,
      };
      const salary = (baseSalary[gred] ?? 4000) + Math.floor((seeded() - 0.5) * 800);

      const retireYear = birthYear + RETIREMENT_AGE;
      const retirementDate = `${retireYear}-${dob.slice(5)}`;

      const ikhtisas = seeded() > 0.12;
      const statusInduksi: "Dalam Tempoh Induksi" | "Selesai" = empYears >= 1 ? "Selesai" : "Dalam Tempoh Induksi";
      const sahPerkhidmatan: "Disahkan" | "Belum Disahkan" = empYears >= 2 ? "Disahkan" : "Belum Disahkan";
      const guruCemerlang = seeded() > 0.9;
      const guruCemerlangBidang = guruCemerlang ? (seeded() > 0.5 ? op1 : op2) : "";
      const tugasKhas = seeded() > 0.75 ? randItemSeeded(TUGAS_KHAS_LIST, seeded) : "Tiada";
      const kodJawatanDiisi = true; // every generated record represents a filled post

      teachers.push({
        id: id++,
        name,
        gender,
        icNumber: icNum,
        school: schoolName,
        schoolType: type,
        position: i === 0 ? positions[0] : i < 3 ? positions[Math.min(1, positions.length - 1)] : positions[positions.length - 1],
        gredHakiki: gred,
        gredPenyandang,
        employmentStatus: empStatus,
        serviceStatus,
        dateOfBirth: dob,
        maritalStatus: randItemSeeded(MARITAL, seeded),
        race: seeded() > 0.35 ? "Melayu" : randItemSeeded(RACES, seeded),
        religion: seeded() > 0.35 ? "Islam" : randItemSeeded(RELIGIONS, seeded),
        nationality: "Malaysia",
        firstAppointmentDate: firstAppt,
        qualification: randItemSeeded(QUALIFICATIONS, seeded),
        opsyen1: op1,
        opsyen2: op2,
        subjects: subjs,
        phone: `011-${String(1000 + Math.floor(seeded() * 9000))} ${String(1000 + Math.floor(seeded() * 9000))}`,
        email: `${firstName.toLowerCase().replace(/ /g, ".")}${Math.floor(seeded() * 90) + 10}@moe.gov.my`,
        address: `No ${Math.floor(seeded() * 200) + 1}, Jalan ${randItemSeeded(["Harmoni", "Bahagia", "Damai", "Maju", "Indah"], seeded)} ${Math.floor(seeded() * 10) + 1}, Taman ${randItemSeeded(["Universiti", "Pelangi", "Daya", "Molek"], seeded)}, ${80000 + Math.floor(seeded() * 2000)} Johor Bahru, Johor`,
        vaccinated,
        vaccineType: vaccinated ? randItemSeeded(VACCINE_TYPES, seeded) : "",
        vaccineDose1: vaccinated ? randDate(2021) : "",
        vaccineDose2: vaccinated ? randDate(2022) : "",
        salary,
        age,
        district: randItemSeeded(DISTRICTS, seeded),
        retirementDate,
        ikhtisas,
        statusInduksi,
        sahPerkhidmatan,
        guruCemerlang,
        guruCemerlangBidang,
        tugasKhas,
        kodJawatanDiisi,
      });
    }
  }

  _teachers = teachers;
  return teachers;
}

export interface PostEstablishment {
  school: string;
  schoolType: SchoolType;
  filled: number;
  vacant: number;
  authorized: number;
}

let _posts: PostEstablishment[] | null = null;

/** Mock "Perjawatan" (post establishment) per school: filled posts come from
 * generated teacher records; a small extra vacancy count is layered on to
 * simulate unfilled authorized posts (Kod Jawatan without a Pengisian). */
export function generatePostEstablishment(): PostEstablishment[] {
  if (_posts) return _posts;
  const teachers = generateTeachers();
  const rng = mulberry32(7);
  const bySchool = new Map<string, { schoolType: SchoolType; filled: number }>();
  teachers.forEach((t) => {
    const cur = bySchool.get(t.school) ?? { schoolType: t.schoolType, filled: 0 };
    cur.filled += 1;
    bySchool.set(t.school, cur);
  });
  _posts = Array.from(bySchool.entries()).map(([school, { schoolType, filled }]) => {
    const vacant = Math.round(filled * (0.02 + rng() * 0.1));
    return { school, schoolType, filled, vacant, authorized: filled + vacant };
  });
  return _posts;
}

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6d2b79f5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function randItemSeeded<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}