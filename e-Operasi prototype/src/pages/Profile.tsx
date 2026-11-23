import { useEffect, useRef, useState } from "react";
import { User, KeyRound, SlidersHorizontal, CheckCircle2, AlertTriangle, Loader2, Minus, Plus, RotateCcw, Camera, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage, type Lang } from "../context/LanguageContext";
import { usePreferences } from "../context/PreferencesContext";
import {
  updateProfile, changePassword, fetchProfilePhoto, uploadProfilePhoto, deleteProfilePhoto,
  TEXT_SIZE_MIN, TEXT_SIZE_MAX, TEXT_SIZE_DEFAULT,
} from "../lib/api";
import { NAVY, TEAL } from "../lib/colors";
import PageHero from "../components/PageHero";
import type { Tone } from "../components/ui";

type Msg = { kind: "ok" | "err"; text: string } | null;

export default function Profile() {
  const { t, lang, setLang } = useLanguage();
  const { token, setFullName } = useAuth();
  const { profile, setProfile, textSize, setTextSize } = usePreferences();

  // Account form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [jawatan, setJawatan] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [sektor, setSektor] = useState("");

  // Profile photo
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<Msg>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [savingAcc, setSavingAcc] = useState(false);
  const [accMsg, setAccMsg] = useState<Msg>(null);

  // Password form
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.fullName);
    setEmail(profile.email);
    setJawatan(profile.jawatan ?? "");
    setJabatan(profile.jabatanBahagian ?? "");
    setSektor(profile.sektor ?? "");
  }, [profile]);

  // Load the photo whenever the profile says there is one.
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    if (profile?.hasPhoto) {
      fetchProfilePhoto(token).then((u) => {
        if (cancelled) { if (u) URL.revokeObjectURL(u); return; }
        url = u;
        setPhotoUrl(u);
      });
    } else {
      setPhotoUrl(null);
    }
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [profile?.hasPhoto, profile, token]);

  if (!profile) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 10, color: "var(--soft-muted)" }}>
        <Loader2 size={26} className="spin" />
        <div style={{ fontSize: 13 }}>{t("pfLoading")}</div>
      </div>
    );
  }

  const accDirty =
    name.trim() !== profile.fullName ||
    email.trim() !== profile.email ||
    jawatan.trim() !== (profile.jawatan ?? "") ||
    jabatan.trim() !== (profile.jabatanBahagian ?? "") ||
    sektor.trim() !== (profile.sektor ?? "");

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    if (!file) return;
    setPhotoMsg(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setPhotoMsg({ kind: "err", text: t("pfPhotoType") });
    if (file.size > 2 * 1024 * 1024) return setPhotoMsg({ kind: "err", text: t("pfPhotoTooBig") });
    setPhotoBusy(true);
    const r = await uploadProfilePhoto(token, file);
    setPhotoBusy(false);
    if (!r.ok) return setPhotoMsg({ kind: "err", text: r.message === "network" ? t("errServer") : t("pfPhotoFailed") });
    setProfile({ ...r.data });
  }

  async function onRemovePhoto() {
    setPhotoBusy(true);
    const r = await deleteProfilePhoto(token);
    setPhotoBusy(false);
    if (r.ok) setProfile(r.data);
  }

  async function saveAccount() {
    setAccMsg(null);
    if (!name.trim()) return setAccMsg({ kind: "err", text: t("pfErrName") });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setAccMsg({ kind: "err", text: t("pfErrEmail") });
    setSavingAcc(true);
    const r = await updateProfile(token, {
      fullName: name.trim(), email: email.trim(),
      jawatan: jawatan.trim(), jabatanBahagian: jabatan.trim(), sektor: sektor.trim(),
    });
    setSavingAcc(false);
    if (!r.ok) {
      const text = r.status === 409 ? t("errEmailTaken") : r.message === "network" ? t("errServer") : t("pfErrGeneric");
      return setAccMsg({ kind: "err", text });
    }
    setProfile(r.data);
    setFullName(r.data.fullName);
    setAccMsg({ kind: "ok", text: t("pfSaved") });
  }

  async function savePassword() {
    setPwMsg(null);
    if (!current || !next || !confirm) return setPwMsg({ kind: "err", text: t("errFillAll") });
    if (next.length < 6) return setPwMsg({ kind: "err", text: t("errPassLen") });
    if (next !== confirm) return setPwMsg({ kind: "err", text: t("errPassMatch") });
    setSavingPw(true);
    const r = await changePassword(token, current, next);
    setSavingPw(false);
    if (!r.ok) {
      return setPwMsg({
        kind: "err",
        text: r.message.toLowerCase().includes("incorrect") ? t("errCurrentPasswordWrong") : t("errChangePasswordFailed"),
      });
    }
    setCurrent(""); setNext(""); setConfirm("");
    setPwMsg({ kind: "ok", text: t("changePasswordSuccessMsg") });
  }

  const initials = profile.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

  return (
    <main style={{ height: "100%", overflowY: "auto", background: "var(--mac-bg)", padding: "0 0 32px" }}>
      <PageHero title={t("titleProfile")} />
      <div style={{ maxWidth: 832, margin: "0 auto", padding: "0 32px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header card: summary (like e-Operasi) + photo */}
        <div className="card" style={{ padding: "22px 26px", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--soft-text)" }}>{profile.fullName || profile.username}</span>
              <span className="tag" style={{ background: profile.role === "admin" ? "var(--tint-violet)" : "var(--surface-3)", color: profile.role === "admin" ? "var(--ink-violet)" : "var(--soft-text-2)" }}>
                {profile.role === "admin" ? t("roleAdmin") : t("roleStaff")}
              </span>
            </div>
            <InfoRow label={t("pfJawatan")} value={profile.jawatan} empty={t("pfNotSet")} />
            <InfoRow label={t("pfJabatan")} value={profile.jabatanBahagian} empty={t("pfNotSet")} />
            <InfoRow label={t("pfSektor")} value={profile.sektor} empty={t("pfNotSet")} />
            <InfoRow label={t("pfEmail")} value={profile.email} empty={t("pfNotSet")} />
            <InfoRow
              label={t("pfLastLogin")}
              value={profile.previousLoginAt
                ? new Date(profile.previousLoginAt).toLocaleString(lang === "en" ? "en-GB" : "ms-MY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
                : null}
              empty={t("pfFirstLogin")}
              italic
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 150, flexShrink: 0 }}>
            <div style={{ width: 120, height: 150, borderRadius: 16, overflow: "hidden", background: "var(--tint-blue)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              {photoUrl
                ? <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: 34, fontWeight: 800, color: "var(--ink-blue)" }}>{initials}</span>}
              {photoBusy && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Loader2 size={22} className="spin" color={NAVY} />
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPickPhoto} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={photoBusy}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "var(--soft-accent)", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}>
              <Camera size={13} /> {t("pfUpdatePhoto")}
            </button>
            {profile.hasPhoto && (
              <button onClick={onRemovePhoto} disabled={photoBusy}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "var(--soft-faint)", fontSize: 11.5, cursor: "pointer", padding: 0 }}>
                <Trash2 size={12} /> {t("pfRemovePhoto")}
              </button>
            )}
            <div style={{ fontSize: 10.5, color: "var(--soft-faint)", textAlign: "center" }}>{t("pfPhotoHint")}</div>
            {photoMsg && <div style={{ fontSize: 11, color: photoMsg.kind === "ok" ? "var(--ok-ink)" : "var(--bad-ink)", textAlign: "center" }}>{photoMsg.text}</div>}
          </div>
        </div>

        {/* Account information */}
        <Section icon={<User size={18} />} tone="blue" title={t("pfAccount")} sub={t("pfAccountSub")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label={t("pfUsername")}><input type="text" value={profile.username} disabled style={{ background: "var(--surface-2)", color: "var(--soft-muted)" }} /></Field>
            <Field label={t("pfRole")}><input type="text" value={profile.role === "admin" ? t("roleAdmin") : t("roleStaff")} disabled style={{ background: "var(--surface-2)", color: "var(--soft-muted)" }} /></Field>
            <Field label={t("pfFullName")}><input type="text" value={name} onChange={(e) => { setName(e.target.value); setAccMsg(null); }} /></Field>
            <Field label={t("pfEmail")}><input type="text" value={email} onChange={(e) => { setEmail(e.target.value); setAccMsg(null); }} /></Field>
            <Field label={t("pfJawatan")}><input type="text" value={jawatan} maxLength={150} onChange={(e) => { setJawatan(e.target.value); setAccMsg(null); }} /></Field>
            <Field label={t("pfJabatan")}><input type="text" value={jabatan} maxLength={150} onChange={(e) => { setJabatan(e.target.value); setAccMsg(null); }} /></Field>
            <Field label={t("pfSektor")}><input type="text" value={sektor} maxLength={150} onChange={(e) => { setSektor(e.target.value); setAccMsg(null); }} /></Field>
          </div>
          <Footer msg={accMsg}>
            <PrimaryBtn onClick={saveAccount} disabled={!accDirty || savingAcc}>{savingAcc ? t("pfSaving") : t("pfSave")}</PrimaryBtn>
          </Footer>
        </Section>

        {/* Change password */}
        <Section icon={<KeyRound size={18} />} tone="amber" title={t("pfPassword")} sub={t("pfPasswordSub")}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <Field label={t("fieldCurrentPassword")}><input type="password" value={current} onChange={(e) => { setCurrent(e.target.value); setPwMsg(null); }} autoComplete="current-password" /></Field>
            <Field label={t("pfNewPassword")}><input type="password" value={next} onChange={(e) => { setNext(e.target.value); setPwMsg(null); }} autoComplete="new-password" /></Field>
            <Field label={t("pfConfirmPassword")}><input type="password" value={confirm} onChange={(e) => { setConfirm(e.target.value); setPwMsg(null); }} autoComplete="new-password" /></Field>
          </div>
          <Footer msg={pwMsg}>
            <PrimaryBtn onClick={savePassword} disabled={savingPw}>{savingPw ? t("pfSaving") : t("pfPassword")}</PrimaryBtn>
          </Footer>
        </Section>

        {/* Display settings */}
        <Section icon={<SlidersHorizontal size={18} />} tone="violet" title={t("pfDisplay")} sub={t("pfDisplaySub")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <SettingRow label={t("pfLanguage")}>
              <Segmented<Lang> value={lang} onChange={setLang} options={[["ms", "Bahasa Melayu"], ["en", "English"]]} />
            </SettingRow>
            <SettingRow label={t("pfTextSize")}>
              <TextSizeControl value={textSize} onChange={setTextSize} resetLabel={t("pfReset")} />
            </SettingRow>
            <div style={{ fontSize: 12, color: "var(--soft-muted)", marginTop: -4 }}>{t("pfTextSizeHint")}</div>
          </div>
        </Section>
      </div>
    </main>
  );
}

function InfoRow({ label, value, empty, italic }: { label: string; value: string | null; empty: string; italic?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 12px 1fr", fontSize: 12.5, padding: "3px 0", fontStyle: italic ? "italic" : undefined }}>
      <span style={{ fontWeight: 700, color: "var(--soft-text-2)", textTransform: "uppercase", fontSize: 11.5, letterSpacing: "0.03em", paddingTop: 1 }}>{label}</span>
      <span style={{ color: "var(--soft-faint)" }}>:</span>
      <span style={{ fontWeight: value ? 600 : 400, color: value ? "var(--soft-text)" : "var(--soft-faint)" }}>{value || empty}</span>
    </div>
  );
}

function Section({ icon, tone, title, sub, children }: { icon: React.ReactNode; tone: Tone; title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "22px 26px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: `var(--tint-${tone})`, color: `var(--ink-${tone})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--soft-text)" }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--soft-muted)", marginTop: 2 }}>{sub}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div className="filter-label">{label}</div>
      {children}
    </label>
  );
}

function Footer({ msg, children }: { msg: Msg; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
      {msg && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: msg.kind === "ok" ? "var(--ok-ink)" : "var(--bad-ink)", marginRight: "auto" }}>
          {msg.kind === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {msg.text}
        </span>
      )}
      {children}
    </div>
  );
}

function PrimaryBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" className="soft-pill primary" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--soft-text-2)" }}>{label}</span>
      {children}
    </div>
  );
}

/** Slider from 80% to 130% with −/+ buttons (5% steps) and a reset to 100%. */
function TextSizeControl({ value, onChange, resetLabel }: { value: number; onChange: (v: number) => void; resetLabel: string }) {
  const STEP = 5;
  // While dragging, only the % label follows the slider; the size is applied
  // when the slider is released (resizing the page mid-drag would move the slider).
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  const commit = () => { if (draft != null) { onChange(draft); setDraft(null); } };
  const iconBtn = (disabled: boolean) => ({
    width: 32, height: 32, borderRadius: 999, border: "1px solid var(--pill-border)", background: "var(--surface)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer", color: disabled ? "var(--soft-faint)" : "var(--soft-accent)",
  } as const);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button onClick={() => onChange(value - STEP)} disabled={value <= TEXT_SIZE_MIN} style={iconBtn(value <= TEXT_SIZE_MIN)} title="−">
        <Minus size={14} />
      </button>
      <input
        type="range" min={TEXT_SIZE_MIN} max={TEXT_SIZE_MAX} step={STEP} value={shown}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commit} onKeyUp={commit} onBlur={commit}
        style={{ width: 200, accentColor: "var(--soft-accent)", cursor: "pointer" }}
      />
      <button onClick={() => onChange(value + STEP)} disabled={value >= TEXT_SIZE_MAX} style={iconBtn(value >= TEXT_SIZE_MAX)} title="+">
        <Plus size={14} />
      </button>
      <span style={{ minWidth: 48, textAlign: "right", fontSize: 13.5, fontWeight: 600, color: "var(--soft-text)" }}>{shown}%</span>
      <button type="button" className="soft-pill small" onClick={() => onChange(TEXT_SIZE_DEFAULT)} disabled={value === TEXT_SIZE_DEFAULT}>
        <RotateCcw size={12} /> {resetLabel}
      </button>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="soft-seg">
      {options.map(([v, label]) => (
        <button key={v} type="button" className={value === v ? "on" : ""} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}
