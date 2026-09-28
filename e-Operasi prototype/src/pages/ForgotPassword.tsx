import { useState } from "react";
import { API_BASE } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import { Users, GraduationCap, ClipboardList } from "lucide-react";
import ppdEmblem from "../assets/ppd-jb-emblem.png";
import authBg from "../assets/auth-bg.jpg";
import LiquidAuth from "../components/LiquidAuth";
import Footer from "../components/Footer";
import Header from "../components/Header";

const NAVY = "#0b3d66";
const NAVY_DEEP = "#082c49";

interface ForgotPasswordProps {
  onBackToLogin: () => void;
}

export default function ForgotPassword({ onBackToLogin }: ForgotPasswordProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(): Promise<string | null> {
    if (!email) return t("errFillAll");
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) return t("errRegisterFailed");
      setSent(true);
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
          filter: "blur(14px)",
          transform: "scale(1.1)",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.55)" }} />

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
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY_DEEP, marginBottom: 4 }}>{t("forgotTitle")}</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>{t("forgotSubtitle")}</div>

          {sent ? (
            <div style={{ fontSize: 13, color: "#0f8a5f", lineHeight: 1.6, background: "#f0fdf7", border: "1px solid #bbf0d8", borderRadius: 8, padding: "14px 16px" }}>
              {t("forgotSentNote")}
            </div>
          ) : (
            <LiquidAuth
              idleLabel={t("forgotTitle")}
              successLabel={t("forgotSuccessMsg")}
              submitLabel={t("hantar")}
              submittingLabel={t("pleaseWait")}
              onSubmit={handleSubmit}
              fields={[
                { id: "email", label: t("fieldEmelReg"), type: "email", value: email, onChange: setEmail },
              ]}
            />
          )}

          <div style={{ marginTop: 18, textAlign: "center", fontSize: 11.5, color: "#9ca3af" }}>
            {t("backToLoginPrompt")}{" "}
            <button type="button" onClick={onBackToLogin} style={{ background: "none", border: "none", color: NAVY, fontWeight: 600, cursor: "pointer", fontSize: 11.5, padding: 0 }}>
              {t("loginLink")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
