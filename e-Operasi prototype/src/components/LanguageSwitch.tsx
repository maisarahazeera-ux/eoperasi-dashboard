import { useLanguage } from "../context/LanguageContext";

interface LanguageSwitchProps {
  dark?: boolean; // pass true when placed on a dark/navy background
}

export default function LanguageSwitch({ dark = false }: LanguageSwitchProps) {
  const { lang, setLang } = useLanguage();

  const trackBg = dark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)";
  const activeBg = dark ? "rgba(255,255,255,0.9)" : "#fff";
  const activeText = dark ? "#082c49" : "#1D1D1F";
  const inactiveText = dark ? "rgba(255,255,255,0.65)" : "#6E6E73";

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
          borderRadius: dark ? 999 : 6,
          boxShadow: active && !dark ? "0 1px 2px rgba(0,0,0,0.14)" : "none",
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div style={{ display: "inline-flex", gap: 2, background: trackBg, borderRadius: dark ? 999 : 8, padding: 2 }}>
      <Btn value="ms" label="BM" />
      <Btn value="en" label="EN" />
    </div>
  );
}
