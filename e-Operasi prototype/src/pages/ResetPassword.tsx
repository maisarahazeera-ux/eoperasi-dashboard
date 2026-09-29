import { useState } from "react";
import { API_BASE } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import LiquidAuth from "../components/LiquidAuth";
import AuthLayout, { AuthHeading } from "../components/AuthLayout";


interface ResetPasswordProps {
  token: string;
  onDone: () => void;
}

export default function ResetPassword({ token, onDone }: ResetPasswordProps) {
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(): Promise<string | null> {
    if (!password) return t("errFillAll");
    if (password.length < 6) return t("errPassLen");
    if (password !== confirmPassword) return t("errPassMatch");
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (res.status === 400) return t("errResetInvalid");
      if (!res.ok) return t("errResetFailed");
      window.setTimeout(onDone, 1400);
      return null;
    } catch {
      return t("errServer");
    }
  }

  return (
    <AuthLayout blurb={t("systemBlurb")}>
      <AuthHeading title={t("resetTitle")} subtitle={t("resetSubtitle")} />

      <LiquidAuth
        idleLabel={t("resetSubmitLabel")}
        successLabel={t("resetSuccessMsg")}
        submitLabel={t("hantar")}
        submittingLabel={t("pleaseWait")}
        onSubmit={handleSubmit}
        fields={[
          { id: "password", label: t("fieldNewPassword"), type: "password", value: password, onChange: setPassword },
          { id: "confirm", label: t("fieldConfirmPassword"), type: "password", value: confirmPassword, onChange: setConfirmPassword },
        ]}
      />
    </AuthLayout>
  );
}
