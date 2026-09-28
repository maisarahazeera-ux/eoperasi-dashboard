import { useEffect, useMemo, useState } from "react";
import { fetchTeachers, ApiError, type Teacher } from "./api";
import { useAuth } from "../context/AuthContext";
import { sortEmploymentStatuses } from "./labels";

// The teacher list is ~8,700 records. Keep one copy in memory per login so
// switching between pages doesn't download it again every time.
let cache: { token: string; data: Teacher[] } | null = null;
let inFlight: { token: string; promise: Promise<Teacher[]> } | null = null;

function load(token: string): Promise<Teacher[]> {
  if (cache?.token === token) return Promise.resolve(cache.data);
  if (inFlight?.token === token) return inFlight.promise;
  const promise = fetchTeachers(token).then((data) => {
    cache = { token, data };
    inFlight = null;
    return data;
  }, (err) => {
    inFlight = null;
    throw err;
  });
  inFlight = { token, promise };
  return promise;
}

/**
 * Loads all teachers from the API.
 * `error` is "network" when the server can't be reached, otherwise the HTTP
 * status code as a string. A 401 is left to AuthContext (it logs the user out).
 */
export function useTeachers() {
  const { token } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[] | null>(
    cache && cache.token === token ? cache.data : null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    load(token)
      .then((data) => { if (!cancelled) setTeachers(data); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) return;
        setError(err instanceof ApiError ? String(err.status) : "network");
      });
    return () => { cancelled = true; };
  }, [token]);

  return { teachers, error };
}

/** Dropdown lists (school types, schools, subjects, ...) built from the real data. */
export function useTeacherLookups(teachers: Teacher[] | null) {
  return useMemo(() => {
    const list = teachers ?? [];
    const uniq = (xs: (string | null | undefined)[]) =>
      Array.from(new Set(xs.filter((v): v is string => !!v && v !== "Tiada"))).sort();

    const schoolsByType: Record<string, string[]> = {};
    for (const x of list) (schoolsByType[x.schoolType] ??= []).push(x.school);
    for (const k of Object.keys(schoolsByType)) schoolsByType[k] = uniq(schoolsByType[k]);

    return {
      schoolTypes: uniq(list.map((x) => x.schoolType)),
      schoolsByType,
      subjects: uniq(list.flatMap((x) => x.subjects.map((s) => s.name))),
      employmentStatuses: sortEmploymentStatuses(uniq(list.map((x) => x.employmentStatus))),
    };
  }, [teachers]);
}
