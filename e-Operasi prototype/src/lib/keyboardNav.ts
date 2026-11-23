// Keyboard shortcuts for lists and pages:
//   Home = previous page of the list (← Sebelum)
//   End  = next page of the list (Seterusnya →)
//   PgUp / PgDn = scroll up / down
// Not active while typing in a box or choosing in a dropdown.
import { useEffect } from "react";

interface ListEntry {
  el: HTMLElement;
  prev: () => void;
  next: () => void;
}

const lists = new Set<ListEntry>();

/** Called by ListFooter so Home / End can page that list. Returns the unregister function. */
export function registerList(entry: ListEntry) {
  lists.add(entry);
  return () => { lists.delete(entry); };
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** How much of an element is on screen (in pixels of height). */
function visibleHeight(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
}

/** The list Home / End should act on: the one in an open pop-up, else the one most on screen. */
function activeList(): ListEntry | null {
  const all = [...lists].filter((l) => l.el.isConnected);
  if (all.length === 0) return null;
  const inModal = all.filter((l) => l.el.closest(".list-overlay"));
  if (inModal.length) return inModal[inModal.length - 1];
  let best: ListEntry | null = null, bestH = 0;
  for (const l of all) {
    const box = (l.el.closest(".card") as HTMLElement | null) ?? l.el.parentElement ?? l.el;
    const h = visibleHeight(box);
    if (h > bestH) { best = l; bestH = h; }
  }
  return best;
}

/** The part of the page that scrolls (the pop-up's table when one is open). */
function scrollTarget(): HTMLElement | null {
  const modal = document.querySelector<HTMLElement>(".list-overlay .list-modal-table");
  if (modal) return modal;
  let el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight * 0.6) as HTMLElement | null;
  while (el && el !== document.body) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) return el;
    el = el.parentElement;
  }
  return document.scrollingElement as HTMLElement | null;
}

/** Turns the shortcuts on (used once, in the main layout). */
export function useKeyboardNav() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTyping(e.target)) return;
      if (e.key === "Home" || e.key === "End") {
        const list = activeList();
        if (!list) return;
        e.preventDefault();
        if (e.key === "Home") list.prev(); else list.next();
      } else if (e.key === "PageUp" || e.key === "PageDown") {
        const box = scrollTarget();
        if (!box) return;
        e.preventDefault();
        const step = Math.max(120, box.clientHeight * 0.85);
        box.scrollBy({ top: e.key === "PageUp" ? -step : step, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
