import { useEffect } from "react";
import { LogOut } from "lucide-react";

interface Props {
  title: string;
  /** Defaults to the log-out icon in rose. */
  icon?: React.ReactNode;
  tone?: "rose" | "amber" | "blue";
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small yes/no popup (used for "Log keluar?"). Esc or clicking outside = cancel. */
export default function ConfirmDialog({ title, icon, tone = "rose", message, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div onClick={onCancel} className="soft-overlay">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="soft-dialog">
        <div style={{ width: 52, height: 52, borderRadius: 16, background: `var(--tint-${tone})`, color: `var(--ink-${tone})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          {icon ?? <LogOut size={22} />}
        </div>
        <h2 id="confirm-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, textAlign: "center" }}>{title}</h2>
        <p style={{ margin: "6px 0 22px", fontSize: 13, color: "var(--soft-muted)", textAlign: "center", lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" autoFocus onClick={onCancel} className="soft-pill" style={{ flex: 1, justifyContent: "center" }}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="soft-pill danger" style={{ flex: 1, justifyContent: "center" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
