import type { SchoolType } from "../data/mockData";

// Main accent (macOS-style blue). Was #1F3864 navy before the redesign.
export const NAVY = "#2F62B5";
export const TEAL = "#0D9488";
export const ORANGE = "#E5930A";
// Calm palette for charts that need many colours (no neon lime/cyan).
export const CHART_COLORS = ["#2F62B5", "#0F9488", "#E5930A", "#7866D6", "#D9577F", "#5B8DEF", "#3FB5A8", "#C27A06", "#9B8CE6", "#E07FA0"];

// ---------- Chart palette ("Biru PPD") ----------
// Validated for colour-blind safety. Colours follow the ENTITY, never its
// position, so SMK is always the same blue on every chart and every filter.
export const CHART = {
  blue:   "#2F62B5",
  teal:   "#0F9488",
  amber:  "#E5930A",
  violet: "#7866D6",
  rose:   "#D9577F",
  red:    "#D1453B",
  gray:   "#9CA3AF",
};

export const SCHOOL_TYPE_CHART_COLORS: Record<string, string> = {
  "SMK":    CHART.blue,
  "SK":     CHART.teal,
  "SJK(C)": CHART.amber,
  "SJK(T)": CHART.violet,
  "SRK":    CHART.rose,
};

/** Small pill for a school type, tinted with that type's chart colour. */
export function schoolTypeChip(type: string) {
  const c = SCHOOL_TYPE_CHART_COLORS[type] ?? CHART.gray;
  return {
    background: c + "1A",
    color: c,
    border: `1px solid ${c}55`,
    borderRadius: 99,
    fontSize: 10.5,
    fontWeight: 700,
    padding: "2px 8px",
    display: "inline-block",
    whiteSpace: "nowrap" as const,
  };
}

export const GENDER_CHART_COLORS: Record<string, string> = {
  L: CHART.blue,
  P: CHART.rose,
};

export const EMPLOYMENT_CHART_COLORS: Record<string, string> = {
  Tetap:    CHART.blue,
  Kontrak:  CHART.amber,
  Sandaran: CHART.violet,
};

// ---------- Heat scale: fewer = teal/green, more = red ----------
// Pure green→red is unreadable for red-green colour-blind users (the two ends
// look identical), so the scale runs teal → amber → red instead.
const HEAT_STOPS = [CHART.teal, CHART.amber, CHART.red];

function hexToRgb(h: string) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

/** Colour for `value` on a min→max scale (min = teal, max = red). */
export function heatColor(value: number, min: number, max: number): string {
  const t = max === min ? 1 : Math.min(1, Math.max(0, (value - min) / (max - min)));
  return t < 0.5 ? mix(HEAT_STOPS[0], HEAT_STOPS[1], t * 2) : mix(HEAT_STOPS[1], HEAT_STOPS[2], (t - 0.5) * 2);
}

export const HEAT_GRADIENT_CSS = `linear-gradient(to right, ${HEAT_STOPS.join(", ")})`;

export const SCHOOL_TYPE_COLORS: Record<SchoolType, { bg: string; text: string; border: string }> = {
  SK:               { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  SMK:              { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  SBP:              { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  SABK:             { bg: "#f3e8ff", text: "#6b21a8", border: "#c4b5fd" },
  "Sekolah Sukan":  { bg: "#ffedd5", text: "#9a3412", border: "#fdba74" },
  "Sekolah Seni":   { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4" },
  "Pendidikan Khas":{ bg: "#e0f2fe", text: "#075985", border: "#7dd3fc" },
};

export function schoolTypeBadge(type: SchoolType) {
  const c = SCHOOL_TYPE_COLORS[type];
  return {
    background: c.bg,
    color: c.text,
    border: `1px solid ${c.border}`,
    borderRadius: 99,
    fontSize: 10.5,
    fontWeight: 700,
    padding: "2px 8px",
    display: "inline-block",
    whiteSpace: "nowrap" as const,
  };
}

export const EMP_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Tetap:    { bg: "#d1fae5", text: "#065f46" },
  Kontrak:  { bg: "#fef3c7", text: "#92400e" },
  Sandaran: { bg: "#f3e8ff", text: "#6b21a8" },
};
