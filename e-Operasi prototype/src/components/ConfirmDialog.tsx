import { useEffect } from "react";
import { LogOut } from "lucide-react";

const NAVY = "#1F3864";

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small yes/no popup. Esc or clicking outside = cancel. */
export default function ConfirmDialog({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div onClick={onCancel}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(8,44,73,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ width: 360, maxWidth: "100%", background: "#fff", borderRadius: 14, boxShadow: "0 20px 50px rgba(8,44,73,0.3)", padding: "22px 22px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "#fee2e2", color: "#b91c1c", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LogOut size={16} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{title}</div>
        </div>
        <div style={{ fontSize: 13, color: "#4b5563", marginBottom: 20 }}>{message}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancel} autoFocus
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#b91c1c", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
