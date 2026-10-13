import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { verifyEmail } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";
import AuthLayout, { AuthHeading } from "../components/AuthLayout";
import ResendVerification from "../components/ResendVerification";

type Result = "checking" | "active" | "pending" | "invalid" | "network";

/** Opened from the link in the verification email (?verifyToken=...). */
export default function VerifyEmail({ token, onDone }: { token: string; onDone: () => void }) {
  const { t } = useLanguage();
  const [result, setResult] = useState<Result>("checking");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // the link works only once, so never call twice (React StrictMode)
    started.current = true;
    verifyEmail(token).then((r) => {
      if (r.status === 0) setResult("network");
      else if (r.status === 200 && r.data?.status === "active") setResult("active");
      else if (r.status === 200 && r.data?.status === "pending") setResult("pending");
      else setResult("invalid");
    });
  }, [token]);

  return (
    <AuthLayout blurb={t("systemBlurb")}>
      <AuthHeading title={t("verifyTitle")} subtitle={t("verifySubtitle")} />

      {result === "checking" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--soft-muted)" }}>
          <Loader2 size={16} className="spin" /> {t("verifyChecking")}
        </div>
      )}
      {result === "active" && (
        <div className="auth-note ok" style={{ alignItems: "flex-start", lineHeight: 1.6 }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} /> {t("verifyActive")}
        </div>
      )}
      {result === "pending" && (
        <div className="auth-note warn" style={{ alignItems: "flex-start", lineHeight: 1.6 }}>
          <Clock size={16} style={{ flexShrink: 0, marginTop: 2 }} /> {t("verifyPending")}
        </div>
      )}
      {(result === "invalid" || result === "network") && (
        <>
          <div className="auth-note warn" style={{ alignItems: "flex-start", lineHeight: 1.6, marginBottom: 4 }}>
            <XCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> {result === "network" ? t("errServer") : t("verifyInvalid")}
          </div>
          {result === "invalid" && <ResendVerification />}
        </>
      )}

      {result !== "checking" && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
          <button type="button" className="soft-pill primary" onClick={onDone}>{t("loginLink")}</button>
        </div>
      )}
    </AuthLayout>
  );
}
