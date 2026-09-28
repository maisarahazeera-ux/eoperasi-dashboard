import ppdLogo from "../assets/ppd-jb-logo-transparent.png";
import LanguageSwitch from "./LanguageSwitch";
import { Home } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

const NAVY = "#0b3d66";
const NAVY_DEEP = "#082c49";

export default function Header() {
  const { t } = useLanguage();

  return (
    <div
      style={{
        position: "absolute", top: 0, left: 0, right: 0, zIndex: 3,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 24px",
        background: `linear-gradient(90deg, ${NAVY} 0%, ${NAVY_DEEP} 100%)`,
        boxShadow: "0 2px 12px rgba(8,44,73,0.18)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <img src={ppdLogo} alt="Jata PPD Johor Bahru" style={{ width: 38, height: 38, objectFit: "contain" }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
            PEJABAT PENDIDIKAN DAERAH
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
            JOHOR BAHRU
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <LanguageSwitch dark />
      </div>
    </div>
  );
}
