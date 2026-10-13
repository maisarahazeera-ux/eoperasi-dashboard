import { useState } from "react";
import { MailCheck, AlertTriangle, Info } from "lucide-react";
import { API_BASE, isOfficialEmail } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import LiquidAuth from "../components/LiquidAuth";
import AuthLayout, { AuthHeading, AuthSwitch } from "../components/AuthLayout";
import ResendVerification from "../components/ResendVerification";


interface RegisterProps {
  onSwitchToLogin: () => void;
}

export default function Register({ onSwitchToLogin }: RegisterProps) {
  const { t } = useLanguage();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [jawatan, setJawatan] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [sektor, setSektor] = useState("");
  // Set after a successful registration: shows "check your email" instead of the form.
  const [done, setDone] = useState<{ email: string; username: string; official: boolean; emailSent: boolean } | null>(null);

  const emailTyped = /@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const official = isOfficialEmail(email);

  async function handleSubmit(): Promise<string | null> {
    if (!fullName.trim() || !username.trim() || !email.trim() || !password || !jawatan.trim() || !sektor.trim()) return t("errFillRequired");
    if (!emailTyped) return t("errInvalidEmail");
    if (password.length < 6) return t("errPassLen");
    if (password !== confirmPassword) return t("errPassMatch");
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, fullName, email, jawatan, jabatanBahagian: jabatan, sektor }),
      });
      if (res.status === 409) {
        const body = await res.json().catch(() => null);
        return body?.message?.toLowerCase().includes("email") ? t("errEmailTaken") : t("errUsernameTaken");
      }
      if (res.status === 400) {
        const body = await res.json().catch(() => null);
        if (body?.code === "invalidEmail") return t("errInvalidEmail");
        if (body?.code === "passwordTooShort") return t("errPassLen");
      }
      if (!res.ok) return t("errRegisterFailed");
      const body = await res.json().catch(() => null);
      const result = { email: email.trim(), username, official: !!body?.officialEmail, emailSent: body?.emailSent !== false };
      window.setTimeout(() => setDone(result), 900); // let the success animation play first
      return null;
    } catch {
      return t("errServer");
    }
  }

  return (
    <AuthLayout blurb={t("registerBlurb")}>
      <AuthHeading title={t("registerTitle")} subtitle={t("registerSubtitle")} />

      {done ? (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--ok-bg)", color: "var(--ok-ink)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <MailCheck size={20} />
            </span>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{t("regDoneTitle")}</div>
          </div>
          {done.emailSent ? (
            <div className="auth-note ok" style={{ alignItems: "flex-start", lineHeight: 1.6 }}>
              {t("regDoneSent").replace("{email}", done.email)}
            </div>
          ) : (
            <div className="auth-note warn" style={{ alignItems: "flex-start", lineHeight: 1.6 }}>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 3 }} /> {t("regDoneNotSent")}
            </div>
          )}
          {!done.official && (
            <div className="auth-note warn" style={{ alignItems: "flex-start", lineHeight: 1.6, marginTop: 10 }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 3 }} /> {t("regDoneApproval")}
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--soft-muted)", marginTop: 12 }}>{t("regDoneSpam")}</div>
          <ResendVerification login={done.username} />
        </div>
      ) : (
      <LiquidAuth
        idleLabel={t("registerTitle")}
        successLabel={t("success")}
        submitLabel={t("hantar")}
        submittingLabel={t("pleaseWait")}
        onSubmit={handleSubmit}
        requiredNote={t("requiredNote")}
        fields={[
          { id: "fullName", label: t("fieldNama"), value: fullName, onChange: setFullName, required: true },
          { id: "username", label: t("fieldUsername"), value: username, onChange: setUsername, required: true },
          {
            id: "email", label: t("fieldEmelReg"), type: "email", value: email, onChange: setEmail, required: true,
            placeholder: "nama@moe.gov.my",
            hint: emailTyped && !official ? t("hintEmailOther") : t("hintEmailOfficial"), hintOk: official,
          },
          { id: "jawatan", label: t("pfJawatan"), value: jawatan, onChange: setJawatan, required: true, placeholder: t("phJawatan") },
          { id: "jabatan", label: t("pfJabatan"), value: jabatan, onChange: setJabatan, placeholder: t("phJabatan") },
          { id: "sektor", label: t("pfSektor"), value: sektor, onChange: setSektor, required: true, placeholder: t("phSektor") },
          {
            id: "password", label: t("fieldPassword"), type: "password", value: password, onChange: setPassword, required: true,
            hint: t("hintPassLen"), hintOk: password.length >= 6,
          },
          {
            id: "confirm", label: t("fieldConfirmPassword"), type: "password", value: confirmPassword, onChange: setConfirmPassword, required: true,
            hint: t("hintPassMatch"), hintOk: confirmPassword.length > 0 && confirmPassword === password,
          },
        ]}
      />
      )}

      <AuthSwitch prompt={t("haveAccount")} action={t("loginLink")} onClick={onSwitchToLogin} />
    </AuthLayout>
  );
}
