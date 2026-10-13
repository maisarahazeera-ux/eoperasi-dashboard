export interface Subject {
  name: string;
  hours: number;
}

export interface Teacher {
  id: number;
  icNumber: string;
  name: string;
  gender: string;
  dateOfBirth: string | null;
  maritalStatus: string | null;
  race: string | null;
  religion: string | null;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;

  school: string;
  /** KOD SEKOLAH, e.g. JBA1001 (empty until data is uploaded again after this update). */
  schoolCode: string;
  schoolType: string;
  schoolDistrict: string;

  position: string | null;
  gredHakiki: string | null;
  gredPenyandang: string | null;
  employmentStatus: string | null;
  serviceStatus: string | null;
  firstAppointmentDate: string | null;
  /** Appointed to the current post. */
  tarikhLantikanJawatanSemasa: string | null;
  /** Started at the current school. */
  tarikhKhidmatSekolahSemasa: string | null;
  qualification: string | null;
  opsyen1: string | null;
  opsyen2: string | null;
  ikhtisas: boolean;
  statusInduksi: string | null;
  sahPerkhidmatan: string | null;
  retirementDate: string | null;
  tugasKhas: string | null;
  guruCemerlang: boolean;
  guruCemerlangBidang: string | null;
  kodJawatanDiisi: boolean;

  subjects: Subject[];
}

/**
 * Where the API lives.
 * - If VITE_API_URL is set in a .env file, that is used (e.g. a real server).
 * - Otherwise the API is assumed to run on the SAME computer as the page,
 *   on port 5276. So opening http://192.168.1.25:8443 from another PC
 *   automatically talks to http://192.168.1.25:5276 — no code change needed
 *   when the laptop's IP address changes.
 */
export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  `${window.location.protocol}//${window.location.hostname}:5276/api`;

// Called whenever the API says our token is no longer valid.
// AuthContext listens for this event and logs the user out.
function handleUnauthorized(res: Response) {
  if (res.status === 401) {
    window.dispatchEvent(new Event("auth:expired"));
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchTeachers(token: string | null): Promise<Teacher[]> {
  const res = await fetch(`${API_BASE}/teachers`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  handleUnauthorized(res);
  if (!res.ok) {
    throw new ApiError(res.status, `Failed to load teachers (${res.status})`);
  }
  return res.json();
}

export async function changePassword(
  token: string | null,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return { ok: false, message: body?.message || `Request failed (${res.status})` };
  }
  return { ok: true };
}

// ---------- Profile ----------

/** Text size as a percentage of normal (100). */
export const TEXT_SIZE_MIN = 80;
export const TEXT_SIZE_MAX = 130;
export const TEXT_SIZE_DEFAULT = 100;

/** The API stores text size as a string; older values may be "small"/"medium"/"large". */
export function parseTextSize(v: string | null | undefined): number | null {
  if (!v) return null;
  const legacy: Record<string, number> = { small: 90, medium: 100, large: 110 };
  const n = legacy[v] ?? parseInt(v, 10);
  if (isNaN(n)) return null;
  return Math.min(TEXT_SIZE_MAX, Math.max(TEXT_SIZE_MIN, n));
}

export interface Profile {
  username: string;
  fullName: string;
  email: string;
  role: string;
  jawatan: string | null;
  jabatanBahagian: string | null;
  sektor: string | null;
  hasPhoto: boolean;
  /** The login before the current one (shown as "Login Terakhir"). */
  previousLoginAt: string | null;
  preferredLanguage: "ms" | "en" | null;
  textSize: string | null;
}

type Result<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

async function profileRequest<T>(token: string | null, path: string, method: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    handleUnauthorized(res);
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      return { ok: false, status: res.status, message: b?.message || `Request failed (${res.status})` };
    }
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, status: 0, message: "network" };
  }
}

export const getProfile = (token: string | null) =>
  profileRequest<Profile>(token, "/profile", "GET");

export interface ProfileUpdate {
  fullName: string;
  email: string;
  jawatan: string;
  jabatanBahagian: string;
  sektor: string;
}

export const updateProfile = (token: string | null, data: ProfileUpdate) =>
  profileRequest<Profile>(token, "/profile", "PUT", data);

/** Downloads the profile photo (it needs the login token, so a plain <img src> can't be used). */
export async function fetchProfilePhoto(token: string | null): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/profile/photo`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    handleUnauthorized(res);
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}

export async function uploadProfilePhoto(token: string | null, file: File): Promise<Result<Profile>> {
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${API_BASE}/profile/photo`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    handleUnauthorized(res);
    if (!res.ok) {
      const b = await res.json().catch(() => null);
      return { ok: false, status: res.status, message: b?.message || `Request failed (${res.status})` };
    }
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, status: 0, message: "network" };
  }
}

export const deleteProfilePhoto = (token: string | null) =>
  profileRequest<Profile>(token, "/profile/photo", "DELETE");

export const updatePreferences = (
  token: string | null,
  prefs: { preferredLanguage?: "ms" | "en"; textSize?: number }
) => profileRequest<Profile>(token, "/profile/preferences", "PUT", {
  ...prefs,
  textSize: prefs.textSize === undefined ? undefined : String(prefs.textSize),
});

// ---------- SEPADU data (Kemas Kini Data) ----------

export interface DataInfo {
  /** Id of the latest upload; changes whenever an admin uploads new data. */
  importId: number | null;
  /** Date the current data was extracted from SEPADU (null = never uploaded through the Admin page). */
  dataDate: string | null;
  importedAt: string | null;
  importedByName: string | null;
  teacherCount: number;
}

/** A problem found in the uploaded files. `code` is translated on the page. */
export interface DataIssue {
  code: string;
  file: string | null;
  count: number;
  details: string[];
}

export interface DataPreview {
  ok: boolean;
  files: { fileName: string; rows: number; schoolTypes: Record<string, number> }[];
  errors: DataIssue[];
  warnings: DataIssue[];
  detectedDataDate: string | null;
  teacherCount: number;
  schoolCount: number;
  subjectCount: number;
  currentTeacherCount: number;
  currentDataDate: string | null;
  newTeachers: number;
  removedTeachers: number;
  byType: { schoolType: string; current: number; incoming: number }[];
}

export interface DataImportRecord {
  id: number;
  dataDate: string;
  importedAt: string;
  importedBy: string;
  importedByName: string;
  fileNames: string;
  teacherCount: number;
  schoolCount: number;
  subjectCount: number;
}

export const getDataInfo = (token: string | null) =>
  profileRequest<DataInfo>(token, "/data/info", "GET");

export const getDataHistory = (token: string | null) =>
  profileRequest<DataImportRecord[]>(token, "/data/history", "GET");

/** Sends files as multipart/form-data. `status` is 0 when the server can't be reached. */
async function postFiles<T>(token: string | null, path: string, files: File[], fields: Record<string, string> = {}) {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    handleUnauthorized(res);
    const data = (await res.json().catch(() => null)) as T | null;
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null as T | null };
  }
}

/** Checks the files and compares them with the current data. Changes nothing. */
export const previewData = (token: string | null, files: File[]) =>
  postFiles<DataPreview>(token, "/data/preview", files);

/** Replaces ALL teacher data with the uploaded files. */
export const importData = (token: string | null, files: File[], dataDate: string) =>
  postFiles<{ preview: DataPreview; info: DataInfo | null }>(token, "/data/import", files, { dataDate });

// ---------- Accounts: email verification ----------

export type AccountStatus = "unverified" | "pending" | "active" | "deactivated";

/** Official KPM email: @moe.gov.my or a subdomain (same rule as the API). */
export function isOfficialEmail(email: string): boolean {
  const at = email.trim().lastIndexOf("@");
  if (at < 1) return false;
  const domain = email.trim().slice(at + 1).toLowerCase();
  return domain === "moe.gov.my" || domain.endsWith(".moe.gov.my");
}

async function postJson<T>(path: string, body: unknown, token?: string | null) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    if (token) handleUnauthorized(res);
    const data = (await res.json().catch(() => null)) as T | null;
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null as T | null };
  }
}

export const verifyEmail = (token: string) =>
  postJson<{ status?: AccountStatus; username?: string; code?: string }>("/auth/verify-email", { token });

/** `login` = username or email. Always answers the same, whether or not the account exists. */
export const resendVerification = (login: string) =>
  postJson<{ message: string }>("/auth/resend-verification", { login });

// ---------- Pengurusan Pengguna (admin) ----------

export interface AdminUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  officialEmail: boolean;
  role: "admin" | "staff" | string;
  status: AccountStatus;
  jawatan: string | null;
  jabatanBahagian: string | null;
  sektor: string | null;
  createdAt: string | null;
  lastLoginAt: string | null;
  statusUpdatedAt: string | null;
  statusUpdatedBy: string | null;
  isSelf: boolean;
}

export const listUsers = (token: string | null) =>
  profileRequest<AdminUser[]>(token, "/users", "GET");

export const getPendingCount = (token: string | null) =>
  profileRequest<{ count: number }>(token, "/users/pending-count", "GET");

export type UserAction = "approve" | "reject" | "deactivate" | "activate";

/** `code` explains a refusal: "self", "lastAdmin", "notPending", ... */
export async function userAction(token: string | null, id: number, action: UserAction) {
  return postJson<AdminUser & { code?: string }>(`/users/${id}/${action}`, {}, token);
}

export async function setUserRole(token: string | null, id: number, role: "admin" | "staff") {
  try {
    const res = await fetch(`${API_BASE}/users/${id}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ role }),
    });
    handleUnauthorized(res);
    return { status: res.status, data: (await res.json().catch(() => null)) as (AdminUser & { code?: string }) | null };
  } catch {
    return { status: 0, data: null };
  }
}

// ---------- Log Aktiviti ----------

export interface ActivityItem {
  id: number;
  at: string;
  username: string;
  fullName: string;
  action: string;
  detail: string;
  ipAddress: string | null;
}

export type ActivityCategory = "" | "login" | "download" | "data" | "users" | "account";

export function listActivity(token: string | null, p: { category: ActivityCategory; q: string; from: string; to: string; page: number; pageSize: number }) {
  const qs = new URLSearchParams();
  if (p.category) qs.set("category", p.category);
  if (p.q.trim()) qs.set("q", p.q.trim());
  if (p.from) qs.set("from", p.from);
  if (p.to) qs.set("to", p.to);
  qs.set("page", String(p.page));
  qs.set("pageSize", String(p.pageSize));
  return profileRequest<{ items: ActivityItem[]; total: number }>(token, `/activity?${qs}`, "GET");
}

/** Records a report download in Log Aktiviti. Best effort: a failure is ignored. */
export async function logDownload(token: string | null, d: { report: string; format: string; filters: string; rows: number }) {
  try {
    await fetch(`${API_BASE}/activity/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(d),
    });
  } catch { /* ignore */ }
}
