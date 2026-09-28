import { useState } from "react";
import { X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { changePassword } from "../lib/api";
import LiquidAuth from "./LiquidAuth";

const NAVY_DEEP = "#082c49";

interface ChangePasswordModalProps {
  onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  async function handleSubmit(): Promise<string | null> {
    if (!current || !next) return t("errFillAll");
    if (next.length < 6) return t("errPassLen");
    if (next !== confirm) return t("errPassMatch");

    const result = await changePassword(token, current, next);
    if (!result.ok) {
      return result.message.toLowerCase().includes("incorrect")
        ? t("errCurrentPasswordWrong")
        : t("errChangePasswordFailed");
    }
    window.setTimeout(onClose, 1400);
    return null;
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(8,44,73,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative", width: 420, maxWidth: "100%",
          background: "#fff", borderRadius: 14,
          boxShadow: "0 20px 50px rgba(8,44,73,0.3)",
          padding: "28px 26px",
        }}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}
        >
          <X size={18} />
        </button>

        <div style={{ fontSize: 16, fontWeight: 700, color: NAVY_DEEP, marginBottom: 4 }}>{t("changePasswordTitle")}</div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>{t("changePasswordSubtitle")}</div>

        <LiquidAuth
          idleLabel={t("changePasswordTitle")}
          successLabel={t("success")}
          submitLabel={t("hantar")}
          submittingLabel={t("pleaseWait")}
          onSubmit={handleSubmit}
          fields={[
            { id: "current", label: t("fieldCurrentPassword"), type: "password", value: current, onChange: setCurrent },
            { id: "new", label: t("fieldNewPassword"), type: "password", value: next, onChange: setNext },
            { id: "confirm", label: t("fieldConfirmPassword"), type: "password", value: confirm, onChange: setConfirm },
          ]}
        />
      </div>
    </div>
  );
}
