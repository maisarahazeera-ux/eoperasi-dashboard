import { LayoutGrid, Search, Users, Award, BookOpen, UserMinus, LogOut, Building2, Moon, Sun, DatabaseZap, UserCog, ScrollText } from "lucide-react";
import { useTheme } from "../lib/theme";
import { useLanguage, type DictKey } from "../context/LanguageContext";

export type Page = "overview" | "carian-guru" | "demografi" | "gred" | "subjek" | "persaraan" | "profile" | "kemaskini-data" | "pengguna" | "log-aktiviti";

const TABS: { id: Page; labelKey: DictKey; Icon: React.ElementType }[] = [
  { id: "overview",    labelKey: "navOverview",   Icon: LayoutGrid },
  { id: "carian-guru", labelKey: "navCarianGuru", Icon: Search },
  { id: "demografi",   labelKey: "navDemografi",  Icon: Users },
  { id: "gred",        labelKey: "navGred",       Icon: Award },
  { id: "subjek",      labelKey: "navSubjek",     Icon: BookOpen },
  { id: "persaraan",   labelKey: "navPersaraan",  Icon: UserMinus },
];

// Shown only to admins (the API also refuses non-admins).
const ADMIN_TABS: typeof TABS = [
  { id: "pengguna",       labelKey: "navPengguna",      Icon: UserCog },
  { id: "kemaskini-data", labelKey: "navKemaskiniData", Icon: DatabaseZap },
  { id: "log-aktiviti",   labelKey: "navLogAktiviti",   Icon: ScrollText },
];

interface Props {
  active: Page;
  onNavigate: (p: Page) => void;
  onLogout: () => void;
  displayName: string;
  isAdmin?: boolean;
  /** Small red number on a tab, e.g. accounts waiting for approval. */
  badges?: Partial<Record<Page, number>>;
}

/** White top bar: logo on the left, pill tabs in the middle, language + profile on the right. */
export default function TopNav({ active, onNavigate, onLogout, displayName, isAdmin = false, badges = {} }: Props) {
  const { t, lang, setLang } = useLanguage();
  const { theme, toggle } = useTheme();
  const initial = (displayName.trim()[0] || "?").toUpperCase();

  return (
    <header className={`soft-topnav${isAdmin ? " admin" : ""}`}>
      <div className="soft-brand">
        <div className="soft-brand-icon"><Building2 size={20} /></div>
        <div className="soft-brand-text">
          <div style={{ fontSize: 16, fontWeight: 800 }}>e-Operasi</div>
          <div style={{ fontSize: 12, color: "var(--soft-muted)" }}>PPD Johor Bahru</div>
        </div>
      </div>

      <nav className="soft-tabs" aria-label="Menu">
        {(isAdmin ? [...TABS, ...ADMIN_TABS] : TABS).map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            type="button"
            className={`soft-tab${active === id ? " active" : ""}`}
            onClick={() => onNavigate(id)}
            aria-current={active === id ? "page" : undefined}
            title={t(labelKey)}
          >
            <Icon size={14} className="soft-tab-icon" />
            <span className="soft-tab-label">{t(labelKey)}</span>
            {!!badges[id] && (
              <span aria-label={`(${badges[id]})`} style={{
                minWidth: 17, height: 17, padding: "0 5px", borderRadius: 999, background: "#D93636", color: "#fff",
                fontSize: 10.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", marginLeft: 2,
              }}>{badges[id]}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="soft-topnav-right">
        <div role="group" aria-label="Bahasa / Language" className="soft-lang">
          <button type="button" className={lang === "ms" ? "on" : ""} onClick={() => setLang("ms")}>BM</button>
          <button type="button" className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
        <button
          type="button"
          className="soft-icon-btn theme"
          onClick={toggle}
          title={theme === "dark" ? t("themeLight") : t("themeDark")}
          aria-label={theme === "dark" ? t("themeLight") : t("themeDark")}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          type="button"
          className={`soft-avatar${active === "profile" ? " active" : ""}`}
          onClick={() => onNavigate("profile")}
          title={`${displayName} · ${t("macProfileSettings")}`}
          aria-label={t("macProfileSettings")}
        >
          {initial}
        </button>
        <button type="button" className="soft-icon-btn" onClick={onLogout} title={t("logoutLabel")} aria-label={t("logoutLabel")}>
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
