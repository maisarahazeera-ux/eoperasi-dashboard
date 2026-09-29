import { useState } from "react";
import { API_BASE } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import { CheckCircle2 } from "lucide-react";
import LiquidAuth from "../components/LiquidAuth";
import AuthLayout, { AuthHeading, AuthSwitch } from "../components/AuthLayout";


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
    <AuthLayout blurb={t("systemBlurb")}>
      <AuthHeading title={t("forgotTitle")} subtitle={t("forgotSubtitle")} />

      {sent ? (
        <div className="auth-note ok" style={{ alignItems: "flex-start", lineHeight: 1.6 }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
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

      <AuthSwitch prompt={t("backToLoginPrompt")} action={t("loginLink")} onClick={onBackToLogin} />
    </AuthLayout>
  );
}
