import { useState } from "react";
import { API_BASE } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import LiquidAuth from "../components/LiquidAuth";
import AuthLayout, { AuthHeading, AuthSwitch } from "../components/AuthLayout";


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

  async function handleSubmit(): Promise<string | null> {
    if (!fullName || !username || !email || !password) return t("errFillAll");
    if (password.length < 6) return t("errPassLen");
    if (password !== confirmPassword) return t("errPassMatch");
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, fullName, email }),
      });
      if (res.status === 409) {
        const body = await res.json().catch(() => null);
        return body?.message?.toLowerCase().includes("email") ? t("errEmailTaken") : t("errUsernameTaken");
      }
      if (!res.ok) return t("errRegisterFailed");
      window.setTimeout(onSwitchToLogin, 1200);
      return null;
    } catch {
      return t("errServer");
    }
  }

  return (
    <AuthLayout blurb={t("registerBlurb")}>
      <AuthHeading title={t("registerTitle")} subtitle={t("registerSubtitle")} />

      <LiquidAuth
        idleLabel={t("registerTitle")}
        successLabel={t("success")}
        submitLabel={t("hantar")}
        submittingLabel={t("pleaseWait")}
        onSubmit={handleSubmit}
        fields={[
          { id: "fullName", label: t("fieldNama"), value: fullName, onChange: setFullName },
          { id: "username", label: t("fieldUsername"), value: username, onChange: setUsername },
          { id: "email", label: t("fieldEmelReg"), type: "email", value: email, onChange: setEmail },
          { id: "password", label: t("fieldPassword"), type: "password", value: password, onChange: setPassword },
          { id: "confirm", label: t("fieldConfirmPassword"), type: "password", value: confirmPassword, onChange: setConfirmPassword },
        ]}
      />

      <AuthSwitch prompt={t("haveAccount")} action={t("loginLink")} onClick={onSwitchToLogin} />
    </AuthLayout>
  );
}
