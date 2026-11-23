import { Users, GraduationCap, ClipboardList, Moon, Sun } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../lib/theme";
import ppdLogo from "../assets/ppd-jb-logo-transparent.png";
import ppdEmblem from "../assets/ppd-jb-emblem.png";
import authBg from "../assets/auth-bg.jpg";

/**
 * Shared frame for Log Masuk, Daftar, Lupa Kata Laluan and Set Semula Kata Laluan
 * in the "Clean & Soft" style: white top bar, soft background, rounded card.
 */
export default function AuthLayout({ blurb, children }: { blurb: string; children: React.ReactNode }) {
  const { t, lang, setLang } = useLanguage();
  const { theme, toggle } = useTheme();

  const bullets = [
    { Icon: Users, text: t("bulletCarian"), tone: "blue" },
    { Icon: GraduationCap, text: t("bulletGred"), tone: "teal" },
    { Icon: ClipboardList, text: t("bulletPersaraan"), tone: "amber" },
  ];

  return (
    <div className="auth-page">
      {/* Background photo (blurred) with a soft colour wash on top */}
      <div className="auth-bg" style={{ backgroundImage: `url(${authBg})` }} aria-hidden />
      <div className="auth-bg-wash" aria-hidden />

      <header className="soft-topnav auth-topnav">
        <div className="soft-brand">
          <img src={ppdLogo} alt="Jata PPD Johor Bahru" style={{ width: 40, height: 40, objectFit: "contain", flexShrink: 0 }} />
          <div className="soft-brand-text">
            <div style={{ fontSize: 14, fontWeight: 800 }}>Pejabat Pendidikan Daerah</div>
            <div style={{ fontSize: 12, color: "var(--soft-muted)" }}>Johor Bahru</div>
          </div>
        </div>
        <div className="soft-topnav-right">
          <div role="group" aria-label="Bahasa / Language" className="soft-lang">
            <button type="button" className={lang === "ms" ? "on" : ""} onClick={() => setLang("ms")}>BM</button>
            <button type="button" className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
          </div>
          <button type="button" className="soft-icon-btn theme" onClick={toggle}
            title={theme === "dark" ? t("themeLight") : t("themeDark")}
            aria-label={theme === "dark" ? t("themeLight") : t("themeDark")}>
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      <main className="auth-main">
        <div className="auth-card">
          <section className="auth-side">
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(21,32,51,0.08)" }}>
              <img src={ppdEmblem} alt="Lambang PPD Johor Bahru" style={{ width: 40, height: 40, objectFit: "contain" }} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>e-Operasi</div>
              <div style={{ fontSize: 13, color: "var(--soft-muted)", marginTop: 2 }}>Pejabat Pendidikan Daerah Johor Bahru</div>
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--soft-text-2)" }}>{blurb}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
              {bullets.map(({ Icon, text, tone }) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: `var(--tint-${tone})`, color: `var(--ink-${tone})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={15} />
                  </span>
                  <span style={{ fontSize: 12.5, color: "var(--soft-text-2)" }}>{text}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="auth-form">{children}</section>
        </div>
      </main>

      <footer className="auth-footer">
        <div>
          {t("footerCopyright")} · {t("footerContactLabel")}{" "}
          <a href="mailto:helpeoperasi@moe.gov.my">helpeoperasi@moe.gov.my</a>
        </div>
        <div className="auth-disclaimer">{t("footerDisclaimer")}</div>
      </footer>
    </div>
  );
}

/** Title + subtitle at the top of the form side. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>{title}</h1>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--soft-muted)" }}>{subtitle}</p>
    </div>
  );
}

/** "Belum ada akaun? Daftar" style line under the form. */
export function AuthSwitch({ prompt, action, onClick }: { prompt: string; action: string; onClick: () => void }) {
  return (
    <div style={{ marginTop: 20, textAlign: "center", fontSize: 12.5, color: "var(--soft-muted)" }}>
      {prompt}{" "}
      <button type="button" className="auth-link" onClick={onClick}>{action}</button>
    </div>
  );
}
