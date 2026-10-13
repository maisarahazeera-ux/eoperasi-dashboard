import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users, Clock, UserCheck, ShieldCheck, Check, X, Ban, RotateCcw, ArrowUpCircle, ArrowDownCircle,
  CheckCircle2, XCircle, Loader2, MailCheck, UserX,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage, type DictKey } from "../context/LanguageContext";
import { listUsers, userAction, setUserRole, type AdminUser, type AccountStatus, type UserAction } from "../lib/api";
import PageHero from "../components/PageHero";
import ConfirmDialog from "../components/ConfirmDialog";
import { StatTile, StatRow, Tag } from "../components/ui";
import { ListToolbar, ListFooter, usePager } from "../components/ListControls";
import { fixMonth } from "../lib/dates";

type Filter = "all" | AccountStatus;
type Pending =
  | { kind: "action"; user: AdminUser; action: UserAction }
  | { kind: "role"; user: AdminUser; role: "admin" | "staff" };
type Banner = { kind: "ok" | "err"; text: string } | null;

const STATUS_TAG: Record<AccountStatus, "ok" | "warn" | "muted" | "err"> = {
  active: "ok",
  pending: "warn",
  unverified: "muted",
  deactivated: "err",
};

function fmt(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

/** Admin page: approve registrations, deactivate accounts, change roles. */
export default function PengurusanPengguna({ onPendingChange }: { onPendingChange?: () => void }) {
  const { token } = useAuth();
  const { t, lang } = useLanguage();
  const locale = lang === "en" ? "en-GB" : "ms-MY";

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const [banner, setBanner] = useState<Banner>(null);

  const load = useCallback(() => {
    listUsers(token).then((r) => {
      if (r.ok) { setUsers(r.data); setLoadError(false); }
      else setLoadError(true);
    });
  }, [token]);
  useEffect(load, [load]);

  // Open on "Menunggu kelulusan" when there is something to approve.
  const [autoFiltered, setAutoFiltered] = useState(false);
  useEffect(() => {
    if (!users || autoFiltered) return;
    if (users.some((u) => u.status === "pending")) setFilter("pending");
    setAutoFiltered(true);
  }, [users, autoFiltered]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, pending: 0, active: 0, unverified: 0, deactivated: 0 };
    for (const u of users ?? []) { c.all++; c[u.status]++; }
    return c;
  }, [users]);
  const adminCount = (users ?? []).filter((u) => u.role === "admin" && u.status === "active").length;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users ?? [])
      .filter((u) => filter === "all" || u.status === filter)
      .filter((u) => !q || [u.fullName, u.username, u.email, u.sektor, u.jawatan, u.jabatanBahagian]
        .some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => {
        // Waiting for approval first, then by name.
        const rank = (u: AdminUser) => (u.status === "pending" ? 0 : 1);
        return rank(a) - rank(b) || a.fullName.localeCompare(b.fullName);
      });
  }, [users, filter, query]);
  const pager = usePager(shown.length, `${filter}|${query}`);

  const dt = (iso: string | null) =>
    iso ? fixMonth(new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })) : null;

  function nameOf(u: AdminUser) { return u.fullName || u.username; }

  function errorText(code: string | undefined) {
    if (code === "self") return t("puErr_self");
    if (code === "lastAdmin") return t("puErr_lastAdmin");
    return t("puErr_generic");
  }

  async function run(p: Pending) {
    setConfirm(null);
    setBusyId(p.user.id);
    setBanner(null);
    const r = p.kind === "role"
      ? await setUserRole(token, p.user.id, p.role)
      : await userAction(token, p.user.id, p.action);
    setBusyId(null);

    const ok = r.status === 200 || r.status === 204;
    if (!ok) {
      setBanner({ kind: "err", text: r.status === 0 ? t("kdServerError") : errorText(r.data?.code) });
      load();
      return;
    }
    const doneKey = (p.kind === "role" ? "puDone_role" : `puDone_${p.action}`) as DictKey;
    setBanner({ kind: "ok", text: fmt(t(doneKey), { name: nameOf(p.user) }) });

    if (p.kind === "action" && p.action === "reject") {
      setUsers((list) => (list ?? []).filter((u) => u.id !== p.user.id));
    } else if (r.data) {
      const updated = r.data;
      setUsers((list) => (list ?? []).map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
    }
    onPendingChange?.();
  }

  // Approve / activate need no confirmation (easy to undo); the rest ask first.
  function ask(p: Pending) {
    if (p.kind === "action" && (p.action === "approve" || p.action === "activate")) run(p);
    else setConfirm(p);
  }

  const dialog = confirm && (() => {
    const name = nameOf(confirm.user);
    if (confirm.kind === "role") {
      const toAdmin = confirm.role === "admin";
      return {
        title: t(toAdmin ? "puRoleAdminTitle" : "puRoleStaffTitle"),
        message: fmt(t(toAdmin ? "puRoleAdminText" : "puRoleStaffText"), { name }),
        confirmLabel: t(toAdmin ? "puMakeAdmin" : "puMakeStaff"),
        icon: toAdmin ? <ArrowUpCircle size={22} /> : <ArrowDownCircle size={22} />,
        tone: "amber" as const,
      };
    }
    if (confirm.action === "reject") {
      return {
        title: t("puRejectTitle"),
        message: fmt(t("puRejectText"), { name, email: confirm.user.email }),
        confirmLabel: t("puReject"),
        icon: <UserX size={22} />,
        tone: "rose" as const,
      };
    }
    return {
      title: t("puDeactivateTitle"),
      message: fmt(t("puDeactivateText"), { name }),
      confirmLabel: t("puDeactivate"),
      icon: <Ban size={22} />,
      tone: "rose" as const,
    };
  })();

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: t("puAll") },
    { value: "pending", label: t("puStatus_pending") },
    { value: "active", label: t("puStatus_active") },
    { value: "unverified", label: t("puStatus_unverified") },
    { value: "deactivated", label: t("puStatus_deactivated") },
  ];

  return (
    <main style={{ height: "100%", overflowY: "auto", background: "var(--mac-bg)", padding: "0 0 32px" }}>
      <PageHero title={t("titlePengguna")} />
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 32px", display: "flex", flexDirection: "column", gap: 16 }}>

        <StatRow>
          <StatTile icon={<Users size={20} />} tone="blue" label={t("puTotal")} value={counts.all} />
          <StatTile icon={<Clock size={20} />} tone="amber" label={t("puPending")} value={counts.pending} />
          <StatTile icon={<UserCheck size={20} />} tone="teal" label={t("puActive")} value={counts.active} />
          <StatTile icon={<ShieldCheck size={20} />} tone="violet" label={t("puAdmins")} value={adminCount} />
        </StatRow>

        {banner && (
          <div className="card" role="status" style={{
            padding: "12px 18px", display: "flex", gap: 10, alignItems: "center", fontSize: 13, fontWeight: 600,
            background: banner.kind === "ok" ? "var(--ok-bg)" : "var(--bad-bg)",
            color: banner.kind === "ok" ? "var(--ok-ink)" : "var(--bad-ink)",
          }}>
            {banner.kind === "ok" ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
            <span style={{ flex: 1 }}>{banner.text}</span>
            <button type="button" onClick={() => setBanner(null)} aria-label="×" style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex" }}><X size={15} /></button>
          </div>
        )}

        <div className="card" style={{ padding: "18px 20px" }}>
          <ListToolbar
            search={{ value: query, onChange: setQuery, placeholder: t("puSearch") }}
            pager={pager}
            filters={
              <div role="group" aria-label={t("puColStatus")} className="soft-seg">
                {filters.map((f) => (
                  <button key={f.value} type="button" className={filter === f.value ? "on" : ""} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                    {f.label}
                  </button>
                ))}
              </div>
            }
          />

          {loadError ? (
            <div style={{ padding: 16, fontSize: 13, color: "var(--bad-ink)" }}>{t("puLoadError")}</div>
          ) : users === null ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Loader2 size={20} className="spin" color="var(--soft-accent)" /></div>
          ) : shown.length === 0 ? (
            <div style={{ padding: "24px 8px", fontSize: 13, color: "var(--soft-muted)", textAlign: "center" }}>{t("puEmpty")}</div>
          ) : (
            <div style={{ border: "1px solid var(--soft-line)", borderRadius: 12, overflowX: "auto" }}>
              <table className="soft-table" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>{t("puColUser")}</th>
                    <th>{t("puColWork")}</th>
                    <th>{t("puColRole")}</th>
                    <th>{t("puColStatus")}</th>
                    <th>{t("puColRegistered")} / {t("puColLastLogin")}</th>
                    <th style={{ textAlign: "right" }}>{t("puColActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pager.slice(shown).map((u) => (
                    <tr key={u.id} style={u.status === "pending" ? { background: "var(--warn-bg)" } : undefined}>
                      <td style={{ minWidth: 220 }}>
                        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          {nameOf(u)}
                          {u.isSelf && <Tag kind="info">{t("puYou")}</Tag>}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--soft-muted)" }}>@{u.username}</div>
                        <div style={{ fontSize: 11.5, color: "var(--soft-text-2)", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginTop: 2 }}>
                          {u.email}
                          {u.officialEmail && <span title={t("puOfficial")} style={{ color: "var(--ok-ink)", display: "inline-flex" }}><MailCheck size={13} /></span>}
                        </div>
                      </td>
                      <td style={{ minWidth: 180, fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{u.jawatan || "-"}</div>
                        {u.jabatanBahagian && <div style={{ color: "var(--soft-muted)" }}>{u.jabatanBahagian}</div>}
                        <div style={{ color: "var(--soft-muted)" }}>{u.sektor || ""}</div>
                      </td>
                      <td>
                        <span className="tag" style={{ background: u.role === "admin" ? "var(--tint-violet)" : "var(--surface-3)", color: u.role === "admin" ? "var(--ink-violet)" : "var(--soft-text-2)" }}>
                          {u.role === "admin" ? t("roleAdmin") : t("roleStaff")}
                        </span>
                      </td>
                      <td><Tag kind={STATUS_TAG[u.status]}>{t(`puStatus_${u.status}` as DictKey)}</Tag></td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>
                        <div>{dt(u.createdAt) ?? "-"}</div>
                        <div style={{ color: u.lastLoginAt ? "var(--soft-muted)" : "var(--soft-faint)" }}>{dt(u.lastLoginAt) ?? t("puNever")}</div>
                      </td>
                      <td style={{ textAlign: "right", width: 1 }}>
                        {busyId === u.id ? (
                          <Loader2 size={16} className="spin" color="var(--soft-accent)" />
                        ) : u.isSelf ? null : (
                          <RowActions u={u} t={t} onAsk={ask} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loadError && users !== null && <ListFooter pager={pager} />}
        </div>
      </div>

      {confirm && dialog && (
        <ConfirmDialog
          icon={dialog.icon}
          tone={dialog.tone}
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={t("cancel")}
          onConfirm={() => run(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </main>
  );
}

function RowActions({ u, t, onAsk }: { u: AdminUser; t: (k: DictKey) => string; onAsk: (p: Pending) => void }) {
  const btn = (label: string, icon: React.ReactNode, onClick: () => void, primary = false) => (
    <button type="button" className={`soft-pill small${primary ? " primary" : ""}`} onClick={onClick} style={{ whiteSpace: "nowrap", justifyContent: "center" }}>
      {icon} {label}
    </button>
  );
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6, minWidth: 150 }}>{inner()}</div>;

  function inner() {
  switch (u.status) {
    case "pending":
      return <>
        {btn(t("puReject"), <X size={13} />, () => onAsk({ kind: "action", user: u, action: "reject" }))}
        {btn(t("puApprove"), <Check size={13} />, () => onAsk({ kind: "action", user: u, action: "approve" }), true)}
      </>;
    case "unverified":
      return <>
        <span style={{ fontSize: 11, color: "var(--soft-faint)", textAlign: "center" }}>{t("puWaitingEmail")}</span>
        {btn(t("puReject"), <X size={13} />, () => onAsk({ kind: "action", user: u, action: "reject" }))}
      </>;
    case "deactivated":
      return btn(t("puActivate"), <RotateCcw size={13} />, () => onAsk({ kind: "action", user: u, action: "activate" }));
    default:
      return <>
        {u.role === "admin"
          ? btn(t("puMakeStaff"), <ArrowDownCircle size={13} />, () => onAsk({ kind: "role", user: u, role: "staff" }))
          : btn(t("puMakeAdmin"), <ArrowUpCircle size={13} />, () => onAsk({ kind: "role", user: u, role: "admin" }))}
        {btn(t("puDeactivate"), <Ban size={13} />, () => onAsk({ kind: "action", user: u, action: "deactivate" }))}
      </>;
  }
  }
}
