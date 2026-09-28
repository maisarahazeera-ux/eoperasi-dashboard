import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type LogoutReason = "manual" | "expired";

interface AuthState {
  token: string | null;
  username: string | null;
  role: string | null;
  fullName: string | null;
  login: (token: string, username: string, role: string, remember: boolean, fullName?: string) => void;
  /** "manual" = user clicked Log Keluar; "expired" = session ended on its own. */
  logout: (reason?: LogoutReason) => void;
  setFullName: (name: string) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function readStored(key: string) {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

// A JWT's middle part holds its expiry time ("exp", in seconds).
function isTokenExpired(token: string | null) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readStored("token"));
  const [username, setUsername] = useState<string | null>(readStored("username"));
  const [role, setRole] = useState<string | null>(readStored("role"));
  const [fullName, setFullName] = useState<string | null>(readStored("fullName"));

  function login(newToken: string, newUsername: string, newRole: string, remember: boolean, newFullName?: string) {
    const store = remember ? localStorage : sessionStorage;
    store.setItem("token", newToken);
    store.setItem("username", newUsername);
    store.setItem("role", newRole);
    if (newFullName) store.setItem("fullName", newFullName);
    setToken(newToken);
    setUsername(newUsername);
    setRole(newRole);
    setFullName(newFullName ?? null);
  }

  function logout(reason: LogoutReason = "manual") {
    // The Login page reads this once to explain why the user is there.
    try { sessionStorage.setItem("logoutReason", reason); } catch { /* ignore */ }
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    localStorage.removeItem("fullName");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("role");
    sessionStorage.removeItem("fullName");
    setToken(null);
    setUsername(null);
    setRole(null);
    setFullName(null);
  }

  // Update the name shown in the header after the user edits their profile.
  function updateFullName(name: string) {
    const store = localStorage.getItem("token") ? localStorage : sessionStorage;
    store.setItem("fullName", name);
    setFullName(name);
  }

  useEffect(() => {
    // 1. On page load: if the saved token already expired, log out straight away.
    if (token && isTokenExpired(token)) logout("expired");

    // 2. While using the app: any 401 from the API logs us out.
    const onExpired = () => logout("expired");
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, username, role, fullName, login, logout, setFullName: updateFullName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
