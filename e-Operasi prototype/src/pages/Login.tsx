import { useState } from "react";
import { API_BASE } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { Users, GraduationCap, ClipboardList, Clock, CheckCircle2 } from "lucide-react";
import LiquidAuth from "../components/LiquidAuth";
import Footer from "../components/Footer";
import Header from "../components/Header";
import authBg from "../assets/auth-bg.jpg";
import ppdEmblem from "../assets/ppd-jb-emblem.png";

const NAVY = "#0b3d66";
const NAVY_DEEP = "#082c49";

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
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: "100%", overflow: "hidden", padding: "70px 0 90px" }}>
      <div
        style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${authBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(3px)",
          transform: "scale(1.1)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.30)" }} />

      <Header />
      <Footer />

      <div style={{ position: "relative", zIndex: 2, display: "flex", width: 680, maxWidth: "92vw", background: "#fff", borderRadius: 14, boxShadow: "0 20px 50px rgba(8,44,73,0.16)", overflow: "hidden" }}>
        <div style={{ width: "46%", background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)`, color: "#fff", padding: "34px 28px", display: "flex", flexDirection: "column" }}>
          <img src={ppdEmblem} alt="Lambang PPD Johor Bahru" style={{ width: 52, height: 52, objectFit: "contain", marginBottom: 14 }} />
          <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.25 }}>e-Operasi</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 18 }}>Pejabat Pendidikan Daerah Johor Bahru</div>
          <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.6, marginBottom: 22 }}>
            {t("systemBlurb")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Users size={15} style={{ opacity: 0.8, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)" }}>{t("bulletCarian")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <GraduationCap size={15} style={{ opacity: 0.8, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)" }}>{t("bulletGred")}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ClipboardList size={15} style={{ opacity: 0.8, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.8)" }}>{t("bulletPersaraan")}</span>
            </div>
          </div>
        </div>

        <div style={{ width: "54%", padding: "34px 32px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY_DEEP, marginBottom: 4 }}>{t("loginTitle")}</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: logoutReason ? 12 : 20 }}>{t("loginSubtitle")}</div>

          {logoutReason && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, fontSize: 12, borderRadius: 8, padding: "8px 12px", marginBottom: 16,
              background: logoutReason === "expired" ? "#fff7ed" : "#ecfdf5",
              border: `1px solid ${logoutReason === "expired" ? "#fdba74" : "#a7f3d0"}`,
              color: logoutReason === "expired" ? "#9a3412" : "#065f46",
            }}>
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

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151", cursor: "pointer" }}>
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              {t("rememberMe")}
            </label>
            <button type="button" onClick={onForgotPassword} style={{ background: "none", border: "none", fontSize: 11.5, color: NAVY, fontWeight: 600, cursor: "pointer", padding: 0 }}>
              {t("forgotPassword")}
            </button>
          </div>

          <div style={{ marginTop: 18, textAlign: "center", fontSize: 11.5, color: "#9ca3af" }}>
            {t("noAccount")}{" "}
            <button type="button" onClick={onSwitchToRegister} style={{ background: "none", border: "none", color: NAVY, fontWeight: 600, cursor: "pointer", fontSize: 11.5, padding: 0 }}>
              {t("registerLink")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
