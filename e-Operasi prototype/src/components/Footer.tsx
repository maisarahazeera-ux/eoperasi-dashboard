import { useLanguage } from "../context/LanguageContext";

const NAVY_DEEP = "#082c49";
const NAVY = "#0b3d66";

export default function Footer() {
  const { t } = useLanguage();

  return (
    <div
      style={{
        position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 3,
        background: `linear-gradient(90deg, ${NAVY_DEEP} 0%, ${NAVY} 100%)`,
        padding: "10px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)" }}>
        {t("footerCopyright")} &nbsp;·&nbsp; {t("footerContactLabel")}{" "}
        <a href="mailto:helpeoperasi@moe.gov.my" style={{ color: "#fff", fontWeight: 600, textDecoration: "none" }}>
          helpeoperasi@moe.gov.my
        </a>
      </div>
      <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.45)", lineHeight: 1.5, marginTop: 4, maxWidth: 620, marginLeft: "auto", marginRight: "auto" }}>
        {t("footerDisclaimer")}
      </div>
    </div>
  );
}
