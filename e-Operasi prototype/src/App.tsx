import { useAuth } from "./context/AuthContext";
import { useLanguage, DictKey } from "./context/LanguageContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import LanguageSwitch from "./components/LanguageSwitch";
import { LogOut, UserCircle2 } from "lucide-react";
import ConfirmDialog from "./components/ConfirmDialog";
import { useState } from "react";
import Overview from "./pages/Overview";
import CarianGuru from "./pages/CarianGuru";
import Demografi from "./pages/Demografi";
import Gred from "./pages/Gred";
import Subjek from "./pages/Subjek";
import Persaraan from "./pages/Persaraan";
import Profile from "./pages/Profile";
import {
  LayoutDashboard, Search, Users, Award, BookOpen, Building2, UserMinus,
} from "lucide-react";

const NAVY = "#1F3864";
const TEAL = "#0D9488";

type Page = "overview" | "carian-guru" | "demografi" | "gred" | "subjek" | "persaraan" | "profile";

const TABS: { id: Page; labelKey: DictKey; Icon: React.ElementType }[] = [
  { id: "overview",    labelKey: "navOverview",    Icon: LayoutDashboard },
  { id: "carian-guru", labelKey: "navCarianGuru",  Icon: Search },
  { id: "demografi",   labelKey: "navDemografi",   Icon: Users },
  { id: "gred",        labelKey: "navGred",        Icon: Award },
  { id: "subjek",      labelKey: "navSubjek",      Icon: BookOpen },
  { id: "persaraan",   labelKey: "navPersaraan",   Icon: UserMinus },
];

const PAGE_TITLE_KEYS: Record<Page, DictKey> = {
  "overview":    "titleOverview",
  "carian-guru": "titleCarianGuru",
  "demografi":   "titleDemografi",
  "gred":        "titleGred",
  "subjek":      "titleSubjek",
  "persaraan":   "titlePersaraan",
  "profile":     "titleProfile",
};

export default function App() {
  const { token, username, fullName, logout } = useAuth();
  const { t, lang } = useLanguage();
  const [activePage, setActivePage] = useState<Page>("overview");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot" | "reset">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("resetToken") ? "reset" : "login";
  });
  const [resetToken] = useState<string>(() => new URLSearchParams(window.location.search).get("resetToken") || "");

  if (!token) {
    if (authMode === "register") return <Register onSwitchToLogin={() => setAuthMode("login")} />;
    if (authMode === "forgot") return <ForgotPassword onBackToLogin={() => setAuthMode("login")} />;
    if (authMode === "reset") {
      return (
        <ResetPassword
          token={resetToken}
          onDone={() => {
            window.history.replaceState({}, "", window.location.pathname);
            setAuthMode("login");
          }}
        />
      );
    }
    return (
      <Login
        onSwitchToRegister={() => setAuthMode("register")}
        onForgotPassword={() => setAuthMode("forgot")}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#F5F5F5" }}>
      {/* Top navigation */}
      <nav style={{ background: NAVY, height: 54, display: "flex", alignItems: "stretch", flexShrink: 0, boxShadow: "0 2px 8px rgba(31,56,100,0.22)" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 18px", borderRight: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: TEAL, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={17} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.15 }}>e-Operasi</div>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)", lineHeight: 1 }}>PPD Johor Bahru</div>
          </div>
        </div>

        {/* Tabs */}
        {TABS.map(({ id, labelKey, Icon }) => (
          <button
            key={id}
            className={`nav-tab${activePage === id ? " active" : ""}`}
            onClick={() => setActivePage(id)}
            title={t(labelKey)}
            style={{ background: "none", border: "none" }}
          >
            <Icon size={14} style={{ flexShrink: 0 }} />
            <span className="nav-tab-label">{t(labelKey)}</span>
          </button>
        ))}

{/* Right — language switch + title + date */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", padding: "0 16px", gap: 12, flexShrink: 0 }}>
          <LanguageSwitch dark />
          <div className="nav-ministry" style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{t("ministry")}</div>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)" }}>{t("jpn")}</div>
          </div>
          {/* Name button opens the Profile page */}
          <button
            onClick={() => setActivePage("profile")}
            title={t("navProfile")}
            style={{ display: "flex", alignItems: "center", gap: 6, background: activePage === "profile" ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.1)", border: "none", borderRadius: 7, padding: "6px 12px", color: "#fff", fontSize: 11, cursor: "pointer" }}
          >
            <UserCircle2 size={14} style={{ flexShrink: 0 }} />
            <span className="nav-btn-label" style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName || username}</span>
          </button>
          <button
            onClick={() => setConfirmLogout(true)}
            title={t("logoutLabel")}
            style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 7, padding: "6px 9px", color: "#fff", cursor: "pointer" }}
          >
            <LogOut size={14} />
          </button>
        </div>
      </nav>


      {confirmLogout && (
        <ConfirmDialog
          title={t("logoutConfirmTitle")}
          message={t("logoutConfirmText")}
          confirmLabel={t("logoutLabel")}
          cancelLabel={t("cancel")}
          onConfirm={() => { setConfirmLogout(false); setActivePage("overview"); logout("manual"); }}
          onCancel={() => setConfirmLogout(false)}
        />
      )}

      {/* Sub-header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "9px 24px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, minHeight: 38 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: NAVY }}>{t(PAGE_TITLE_KEYS[activePage])}</span>
        <span style={{ fontSize: 11, color: "#9ca3af", background: "#f3f4f6", padding: "2px 8px", borderRadius: 4, flexShrink: 0 }}>PPD Johor Bahru</span>
      </div>

      {/* Page content */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {activePage === "overview"    && <Overview />}
        {activePage === "carian-guru" && <CarianGuru />}
        {activePage === "demografi"   && <Demografi />}
        {activePage === "gred"        && <Gred />}
        {activePage === "subjek"      && <Subjek />}
        {activePage === "persaraan"   && <Persaraan />}
        {activePage === "profile"     && <Profile />}
      </div>
    </div>
  );
}
