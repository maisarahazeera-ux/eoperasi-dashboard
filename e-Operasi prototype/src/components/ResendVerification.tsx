import { useState } from "react";
import { MailCheck } from "lucide-react";
import { resendVerification } from "../lib/api";
import { useLanguage } from "../context/LanguageContext";

/**
 * "Hantar semula emel pengesahan" link. `login` is the username or email;
 * when it isn't known (expired link page), a small input is shown first.
 */
export default function ResendVerification({ login: knownLogin }: { login?: string }) {
  const { t } = useLanguage();
  const [login, setLogin] = useState(knownLogin ?? "");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send() {
    if (!login.trim()) return;
    setState("sending");
    const r = await resendVerification(login.trim());
    setState(r.status === 200 ? "sent" : "error");
  }

  if (state === "sent") {
    return (
      <div className="auth-note ok" style={{ marginTop: 12 }}>
        <MailCheck size={14} style={{ flexShrink: 0 }} /> {t("resendDone")}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {knownLogin === undefined && (
        <input
          type="text"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder={t("verifyLoginPlaceholder")}
          style={{ flex: "1 1 200px", borderRadius: 999, padding: "9px 14px" }}
        />
      )}
      <button type="button" className="auth-link" onClick={send} disabled={state === "sending" || !login.trim()}
        style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <MailCheck size={14} /> {state === "sending" ? t("resendSending") : t("resendLink")}
      </button>
      {state === "error" && <span style={{ fontSize: 12, color: "var(--bad-ink)" }}>{t("errServer")}</span>}
    </div>
  );
}
