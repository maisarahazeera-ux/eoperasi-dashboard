import { useState } from "react";
import { API_BASE } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { Clock, CheckCircle2 } from "lucide-react";
import LiquidAuth from "../components/LiquidAuth";
import AuthLayout, { AuthHeading, AuthSwitch } from "../components/AuthLayout";


interface LoginProps {
  onSwitchToRegister: () => void;
  onForgotPassword: () => void;
}

export default function Login({ onSwitchToRegister, onForgotPassword }: LoginProps) {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [username, setUsername] = useState(() => localStorage.getItem("rememberedUsername") || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  // Why the user landed here (set by AuthContext on logout); shown once.
  const [logoutReason] = useState<string | null>(() => {
    try {
      const r = sessionStorage.getItem("logoutReason");
      sessionStorage.removeItem("logoutReason");
      return r;
    } catch { return null; }
  });

  async function handleSubmit(): Promise<string | null> {
    if (!username || !password) return t("errFillLogin");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) return t("errBadLogin");
      const data = await res.json();
      localStorage.setItem("rememberedUsername", username);
      window.setTimeout(() => login(data.token, data.username, data.role, rememberMe, data.fullName), 900);
      return null;
    } catch {
      return t("errServer");
    }
  }

  return (
    <AuthLayout blurb={t("systemBlurb")}>
      <AuthHeading title={t("loginTitle")} subtitle={t("loginSubtitle")} />

      {logoutReason && (
        <div className={`auth-note ${logoutReason === "expired" ? "warn" : "ok"}`}>
          {logoutReason === "expired" ? <Clock size={14} style={{ flexShrink: 0 }} /> : <CheckCircle2 size={14} style={{ flexShrink: 0 }} />}
          {logoutReason === "expired" ? t("sessionExpiredMsg") : t("loggedOutMsg")}
        </div>
      )}

      <LiquidAuth
        idleLabel={t("loginIdle")}
        successLabel={t("success")}
        submitLabel={t("hantar")}
        submittingLabel={t("pleaseWait")}
        onSubmit={handleSubmit}
        fields={[
          { id: "username", label: t("fieldUsername"), value: username, onChange: setUsername },
          {
            id: "password", label: t("fieldPassword"), type: "password",
            value: password, onChange: setPassword,
          },
        ]}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 12, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--soft-text-2)", cursor: "pointer" }}>
          <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ accentColor: "var(--soft-accent)" }} />
          {t("rememberMe")}
        </label>
        <button type="button" className="auth-link" style={{ fontSize: 12.5 }} onClick={onForgotPassword}>
          {t("forgotPassword")}
        </button>
      </div>

      <AuthSwitch prompt={t("noAccount")} action={t("registerLink")} onClick={onSwitchToRegister} />
    </AuthLayout>
  );
}
