import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import { useLanguage } from "./context/LanguageContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ConfirmDialog from "./components/ConfirmDialog";
import TopNav, { type Page } from "./components/TopNav";
import Overview from "./pages/Overview";
import CarianGuru from "./pages/CarianGuru";
import Demografi from "./pages/Demografi";
import Gred from "./pages/Gred";
import Subjek from "./pages/Subjek";
import Persaraan from "./pages/Persaraan";
import Profile from "./pages/Profile";
import KemaskiniData from "./pages/KemaskiniData";
import PengurusanPengguna from "./pages/PengurusanPengguna";
import LogAktiviti from "./pages/LogAktiviti";
import NewDataBanner from "./components/NewDataBanner";
import { getPendingCount } from "./lib/api";
import { useKeyboardNav } from "./lib/keyboardNav";

export default function App() {
  const { token, username, fullName, role, logout } = useAuth();
  const isAdmin = role === "admin";
  // Home / End = previous / next page of a list, PgUp / PgDn = scroll.
  useKeyboardNav();

  // Accounts waiting for approval (badge on the "Pengguna" tab). Checked every 2 minutes.
  const [pendingCount, setPendingCount] = useState(0);
  const refreshPending = useCallback(() => {
    if (!isAdmin || !token) return;
    getPendingCount(token).then((r) => { if (r.ok) setPendingCount(r.data.count); });
  }, [isAdmin, token]);
  useEffect(() => {
    refreshPending();
    if (!isAdmin) return;
    const id = window.setInterval(refreshPending, 120_000);
    return () => window.clearInterval(id);
  }, [refreshPending, isAdmin]);
  const { t } = useLanguage();
  const [activePage, setActivePage] = useState<Page>("overview");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot" | "reset" | "verify">(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("resetToken") ? "reset" : params.get("verifyToken") ? "verify" : "login";
  });
  const [resetToken] = useState<string>(() => new URLSearchParams(window.location.search).get("resetToken") || "");
  const [verifyToken] = useState<string>(() => new URLSearchParams(window.location.search).get("verifyToken") || "");

  if (!token) {
    if (authMode === "register") return <Register onSwitchToLogin={() => setAuthMode("login")} />;
    if (authMode === "forgot") return <ForgotPassword onBackToLogin={() => setAuthMode("login")} />;
    if (authMode === "verify") {
      return (
        <VerifyEmail
          token={verifyToken}
          onDone={() => {
            window.history.replaceState({}, "", window.location.pathname);
            setAuthMode("login");
          }}
        />
      );
    }
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
    <div className="soft-app">
      <TopNav
        active={activePage}
        onNavigate={setActivePage}
        onLogout={() => setConfirmLogout(true)}
        displayName={fullName || username || ""}
        isAdmin={isAdmin}
        badges={{ pengguna: pendingCount }}
      />

      <NewDataBanner />

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {activePage === "overview"    && <Overview />}
        {activePage === "carian-guru" && <CarianGuru />}
        {activePage === "demografi"   && <Demografi />}
        {activePage === "gred"        && <Gred />}
        {activePage === "subjek"      && <Subjek />}
        {activePage === "persaraan"   && <Persaraan />}
        {activePage === "profile"     && <Profile />}
        {activePage === "kemaskini-data" && isAdmin && <KemaskiniData />}
        {activePage === "pengguna" && isAdmin && <PengurusanPengguna onPendingChange={refreshPending} />}
        {activePage === "log-aktiviti" && isAdmin && <LogAktiviti />}
      </div>

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
    </div>
  );
}
