// Small building blocks shared by every page, so they all look like the Overview page.

export type Tone = "blue" | "teal" | "amber" | "violet" | "rose" | "gray";

/** KPI card: tinted icon tile + label + big number + optional coloured note. */
export function StatTile({ icon, label, value, note, tone = "blue" }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="card" style={{ padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start", minWidth: 0 }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: `var(--tint-${tone})`, color: `var(--ink-${tone})`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--soft-muted)" }}>{label}</span>
        <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</span>
        {note != null && <span style={{ fontSize: 12, fontWeight: 600, color: `var(--ink-${tone})` }}>{note}</span>}
      </div>
    </div>
  );
}

/** Grid of StatTiles. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
      {children}
    </div>
  );
}

/** Card heading with optional icon on the left and extra content on the right. */
export function CardTitle({ children, icon, right }: { children: React.ReactNode; icon?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
      {icon}
      <h2 className="soft-card-title" style={{ margin: 0 }}>{children}</h2>
      {right != null && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{right}</div>}
    </div>
  );
}

/** Pill toggle (filled blue when selected). */
export function PillToggle<T extends string>({ value, onChange, options, ariaLabel }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; title?: string }[];
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="soft-seg">
      {options.map((o) => (
        <button key={o.value} type="button" title={o.title}
          className={value === o.value ? "on" : ""}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Small coloured label: ok (green), warn (amber), err (red), info (blue), muted (grey). */
export function Tag({ kind, children, icon }: { kind: "ok" | "warn" | "err" | "info" | "muted"; children: React.ReactNode; icon?: React.ReactNode }) {
  return <span className={`tag tag-${kind}`}>{icon}{children}</span>;
}

/** Previous / next buttons. */
export function PagerButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button type="button" className="soft-pill small" onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
