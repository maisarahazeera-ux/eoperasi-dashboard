// The same controls on every list, so all lists look and work alike:
//   [ search ] Show [10 ▾] [ filters ]           [ download icon ]
//   ...table...
//   1–10 of 985 records                    ← Previous  1/99  Next →
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { PagerButton } from "./ui";
import { registerList } from "../lib/keyboardNav";

export const PAGE_SIZES = [10, 50, 100] as const;

/**
 * Paging state for a list. Goes back to page 1 whenever `resetKey` changes
 * (e.g. a new search or filter) or the rows-per-page changes.
 */
export function usePager(total: number, resetKey: unknown = null, initialSize = 10) {
  const [page, setPage] = useState(1);
  const [size, setSizeState] = useState(initialSize);
  useEffect(() => { setPage(1); }, [resetKey]);
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(page, pages);
  return {
    page: current,
    pages,
    size,
    total,
    setPage,
    setSize: (n: number) => { setSizeState(n); setPage(1); },
    slice: <T,>(rows: T[]) => rows.slice((current - 1) * size, current * size),
  };
}
export type Pager = ReturnType<typeof usePager>;

/** "Papar [10 ▾]": rows per page, placed beside the search box. */
export function PageSizeSelect({ pager, disabled }: { pager: Pager; disabled?: boolean }) {
  const { t } = useLanguage();
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--soft-muted)", whiteSpace: "nowrap" }}>
      {t("lsShow")}
      <select className="soft-pill-select list-size" value={pager.size} disabled={disabled}
        aria-label={t("lsPerPage")} onChange={(e) => pager.setSize(Number(e.target.value))}>
        {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
}

/** Search box + rows per page + filters on the left, download icon on the right. */
export function ListToolbar({ search, pager, pagerDisabled, filters, download }: {
  search: { value: string; onChange: (v: string) => void; placeholder: string };
  pager?: Pager;
  pagerDisabled?: boolean;
  filters?: React.ReactNode;
  download?: React.ReactNode;
}) {
  return (
    <div className="list-toolbar">
      <label className="list-search">
        <Search size={14} />
        <input type="text" value={search.value} placeholder={search.placeholder} aria-label={search.placeholder}
          onChange={(e) => search.onChange(e.target.value)} />
        {search.value && (
          <button type="button" aria-label="×" onClick={() => search.onChange("")}><X size={13} /></button>
        )}
      </label>
      {pager && <PageSizeSelect pager={pager} disabled={pagerDisabled} />}
      {filters}
      {download && <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>{download}</div>}
    </div>
  );
}

/** "1–10 of 985 records" on the left; previous/next on the right. */
export function ListFooter({ pager, disabled }: { pager: Pager; disabled?: boolean }) {
  const { t, lang } = useLanguage();
  const nf = (n: number) => n.toLocaleString(lang === "en" ? "en-GB" : "ms-MY");

  // Keyboard: Home = previous page, End = next page (see lib/keyboardNav.ts).
  const elRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ pager, disabled });
  latest.current = { pager, disabled };
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    return registerList({
      el,
      prev: () => { const { pager: p, disabled: d } = latest.current; if (!d && p.page > 1) p.setPage(p.page - 1); },
      next: () => { const { pager: p, disabled: d } = latest.current; if (!d && p.page < p.pages) p.setPage(p.page + 1); },
    });
  }, [pager.total === 0]);

  if (pager.total === 0) return null;
  const from = (pager.page - 1) * pager.size + 1;
  const to = Math.min(pager.total, pager.page * pager.size);
  return (
    <div className="list-footer" ref={elRef}>
      <span>{t("lsRange").replace("{from}", nf(from)).replace("{to}", nf(to)).replace("{total}", nf(pager.total))}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {pager.pages > 1 && <>
          <PagerButton label={t("cgPrev")} title="Home" onClick={() => pager.setPage(Math.max(1, pager.page - 1))} disabled={pager.page === 1 || !!disabled} />
          <span style={{ whiteSpace: "nowrap" }}>{pager.page} / {pager.pages}</span>
          <PagerButton label={t("cgNext")} title="End" onClick={() => pager.setPage(Math.min(pager.pages, pager.page + 1))} disabled={pager.page === pager.pages || !!disabled} />
        </>}
      </div>
    </div>
  );
}
