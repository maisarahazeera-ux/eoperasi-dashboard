import { useLanguage } from "../context/LanguageContext";

interface LanguageSwitchProps {
  dark?: boolean; // pass true when placed on a dark/navy background
}

export default function LanguageSwitch({ dark = false }: LanguageSwitchProps) {
  const { lang, setLang } = useLanguage();

  const trackBg = dark ? "rgba(255,255,255,0.12)" : "#eef0f2";
  const activeBg = dark ? "rgba(255,255,255,0.9)" : "#0b3d66";
  const activeText = dark ? "#082c49" : "#fff";
  const inactiveText = dark ? "rgba(255,255,255,0.65)" : "#6b7280";

  function Btn({ value, label }: { value: "ms" | "en"; label: string }) {
    const active = lang === value;
    return (
      <button
        type="button"
        onClick={() => setLang(value)}
        style={{
          border: "none",
          background: active ? activeBg : "transparent",
          color: active ? activeText : inactiveText,
          fontSize: 10.5,
          fontWeight: 700,
          padding: "4px 9px",
          borderRadius: 999,
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div style={{ display: "inline-flex", gap: 2, background: trackBg, borderRadius: 999, padding: 2 }}>
      <Btn value="ms" label="BM" />
      <Btn value="en" label="EN" />
    </div>
  );
}
