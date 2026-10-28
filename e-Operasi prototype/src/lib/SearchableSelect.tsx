import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;                 // "" means nothing selected ("All")
  options: Option[];
  onChange: (value: string) => void;
  allLabel: string;              // text shown when nothing is selected, e.g. "Semua"
  searchPlaceholder: string;     // e.g. "Taip untuk cari..."
  noMatchLabel: string;          // e.g. "Tiada padanan"
  pill?: boolean;                // show as a rounded pill button (like the filter pills)
  icon?: React.ReactNode;        // icon shown inside the pill
}

// A dropdown you can type into to filter a long list (schools, subjects).
// Keyboard: ↑/↓ to move, Enter to pick, Esc to close.
export default function SearchableSelect({
  value, options, onChange, allLabel, searchPlaceholder, noMatchLabel, pill = false, icon,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  // Match against both the display label and the full value, so typing
  // either "SMK Mutiara" or "Sekolah Menengah" finds the school.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  // Close when clicking anywhere outside the component.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted row visible while using the arrow keys.
  useEffect(() => {
    const row = listRef.current?.children[highlight] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  function openList() {
    setOpen(true);
    setQuery("");
    setHighlight(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  function pick(v: string) {
    onChange(v);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matches[highlight]) pick(matches[highlight].value);
    } else if (e.key === "Escape") {
      close();
    }
  }

  const list = (
    <div
      ref={listRef}
      style={pill ? { maxHeight: 280, overflowY: "auto" } : {
        position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
        maxHeight: 240, overflowY: "auto", background: "var(--surface)",
        border: "1px solid var(--border)", borderRadius: 7,
        boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
      }}
    >
      {matches.length === 0 ? (
        <div style={{ padding: "8px 10px", fontSize: 12.5, color: "var(--soft-faint)" }}>{noMatchLabel}</div>
      ) : (
        matches.map((o, i) => (
          <div
            key={o.value}
            title={o.value}
            onMouseDown={(e) => { e.preventDefault(); pick(o.value); }}
            onMouseEnter={() => setHighlight(i)}
            style={{
              padding: "7px 10px", fontSize: 12.5, cursor: "pointer",
              background: i === highlight ? "var(--hover)" : o.value === value ? "var(--surface-2)" : "var(--surface)",
              color: o.value === value ? "#0D9488" : "var(--text-primary)",
              fontWeight: o.value === value ? 600 : 400,
            }}
          >
            {o.label}
          </div>
        ))
      )}
    </div>
  );

  const searchInput = (
    <input
      ref={inputRef}
      type="text"
      value={query}
      placeholder={searchPlaceholder}
      onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
      onKeyDown={onKeyDown}
    />
  );

  // Pill: the button stays put and the search box opens inside the drop-down panel.
  if (pill) {
    return (
      <div ref={wrapRef} style={{ position: "relative" }}>
        <button
          type="button"
          className={`soft-pill${selected ? " set" : ""}`}
          aria-pressed={!!selected}
          onClick={() => (open ? close() : openList())}
          title={selected?.value}
          style={{ maxWidth: 300 }}
        >
          {icon}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{selected ? selected.label : allLabel}</span>
          {selected ? (
            <X size={13} style={{ flexShrink: 0 }} aria-label="×"
              onClick={(e) => { e.stopPropagation(); onChange(""); close(); }} />
          ) : (
            <ChevronDown size={13} style={{ flexShrink: 0 }} />
          )}
        </button>
        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20, width: 320, maxWidth: "calc(100vw - 32px)",
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
            boxShadow: "0 8px 20px rgba(0,0,0,0.12)", padding: 6,
          }}>
            <div style={{ marginBottom: 4 }}>{searchInput}</div>
            {list}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {open ? searchInput : (
        <button
          type="button"
          onClick={openList}
          title={selected?.value}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 6,
            fontFamily: "inherit", fontSize: 13, color: "var(--text-primary)",
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 7,
            padding: "7px 10px", cursor: "pointer", textAlign: "left",
          }}
        >
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {selected ? selected.label : allLabel}
          </span>
          {selected ? (
            <X
              size={14}
              color="#6b7280"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              style={{ flexShrink: 0 }}
            />
          ) : (
            <ChevronDown size={14} color="#6b7280" style={{ flexShrink: 0 }} />
          )}
        </button>
      )}
      {open && list}
    </div>
  );
}
