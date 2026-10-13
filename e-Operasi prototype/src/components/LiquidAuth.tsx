import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Check, Info } from "lucide-react";

// Colours follow the Clean & Soft theme (blue accent, green on success).
const NAVY = "#2F62B5";
const NAVY_DEEP = "#1F4FA0";
const GREEN = "#0F8A5F";

export interface LiquidField {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Shows a red "*" after the label. */
  required?: boolean;
  /** Small note shown under the pill, e.g. "At least 6 characters". */
  hint?: string;
  /** When true the hint turns green with a tick (rule satisfied). */
  hintOk?: boolean;
}

interface LiquidAuthProps {
  idleLabel: string;
  successLabel: string;
  fields: LiquidField[];
  onSubmit: () => Promise<string | null>;
  autoOpen?: boolean;
  submitLabel?: string;
  submittingLabel?: string;
  /** Legend shown beside the submit button when any field is required. */
  requiredNote?: string;
}

type Stage = "idle" | "open" | "submitting" | "success";

const PILL_H = 48;
const GAP = 24; // final gap between adjacent field-pills once fully open
const SNAP_GAP = 18; // gap (px) at which a neck pinches off — must stay below GAP
const NECK_VIEW_W = 280;
const SPRING_K = 55;
const SPRING_DAMPING = 11;
const REQUIRED_RED = "#FF6B6B"; // bright enough to read on the blue pill
const HINT_SPACE = 20; // extra room when the LAST field has a hint

function buildNeckPath(topEdgeY: number, bottomEdgeY: number): string {
  const gap = bottomEdgeY - topEdgeY;
  // Pills still fully overlapping — they already render as one clean pill on
  // their own; no filler shape needed (and one caused sharp-corner artifacts).
  if (gap <= 0) return "";
  if (gap >= SNAP_GAP) return "";

  const attachHalf = NECK_VIEW_W / 2 - 6;
  const waistT = gap / SNAP_GAP;
  const waistHalf = Math.max(0, attachHalf * (1 - waistT));
  const midY = (topEdgeY + bottomEdgeY) / 2;

  return `M ${-attachHalf},${topEdgeY}
    C ${-attachHalf},${midY} ${-waistHalf},${midY} ${-waistHalf},${midY}
    C ${-waistHalf},${midY} ${-attachHalf},${bottomEdgeY} ${-attachHalf},${bottomEdgeY}
    L ${attachHalf},${bottomEdgeY}
    C ${attachHalf},${midY} ${waistHalf},${midY} ${waistHalf},${midY}
    C ${waistHalf},${midY} ${attachHalf},${topEdgeY} ${attachHalf},${topEdgeY}
    Z`;
}

export default function LiquidAuth({
  idleLabel,
  successLabel,
  fields,
  onSubmit,
  autoOpen = false,
  submitLabel = "Hantar",
  submittingLabel = "Sila tunggu...",
  requiredNote,
}: LiquidAuthProps) {
  const [stage, setStage] = useState<Stage>(autoOpen ? "open" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [showCheck, setShowCheck] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});

  const isOpen = stage === "open" || stage === "submitting";
  const isSuccess = stage === "success";
  const barColor = isSuccess ? GREEN : NAVY;
  const N = fields.length;

  const openSpan = N * PILL_H + Math.max(N - 1, 1) * GAP;
  const closedSpan = PILL_H;
  const targetSpan = isOpen ? openSpan : closedSpan;

  const spanRef = useRef(targetSpan);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [renderSpan, setRenderSpan] = useState(targetSpan);

  useEffect(() => {
    let last = performance.now();
    function step(now: number) {
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      const displacement = spanRef.current - targetSpan;
      const accel = -SPRING_K * displacement - SPRING_DAMPING * velocityRef.current;
      velocityRef.current += accel * dt;
      spanRef.current += velocityRef.current * dt;
      setRenderSpan(spanRef.current);

      if (Math.abs(displacement) > 0.3 || Math.abs(velocityRef.current) > 0.3) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        spanRef.current = targetSpan;
        velocityRef.current = 0;
        setRenderSpan(targetSpan);
        rafRef.current = null;
      }
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSpan]);

  function openStage() {
    if (stage !== "idle") return;
    setStage("open");
  }

  async function handleSubmit() {
    if (stage !== "open") return;
    setError(null);
    setStage("submitting");
    const result = await onSubmit();
    if (result) {
      setError(result);
      setStage("open");
      return;
    }
    setStage("success");
    window.setTimeout(() => setShowCheck(true), 480);
  }

  const t = Math.max(0, Math.min(1, (renderSpan - closedSpan) / (openSpan - closedSpan || 1)));
  const centers = fields.map((_, i) => PILL_H / 2 + t * i * (PILL_H + GAP));
  const revealed = t > 0.55;
  const lastHasHint = !!fields[N - 1]?.hint;
  const boxH = Math.max(renderSpan, PILL_H) + (lastHasHint ? t * HINT_SPACE : 0);
  const anyRequired = fields.some((f) => f.required);

  return (
    <div>
      <div style={{ position: "relative", height: boxH }}>
        {/* Necks only — real HTML divs (below) handle the pills themselves,
            so their border-radius is never at the mercy of SVG viewBox scaling. */}
        <svg
          width="100%"
          height={Math.max(renderSpan, PILL_H)}
          viewBox={`${-NECK_VIEW_W / 2} 0 ${NECK_VIEW_W} ${Math.max(renderSpan, PILL_H)}`}
          preserveAspectRatio="none"
          style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            opacity: revealed ? 0 : 1,
            transition: "opacity .15s ease",
          }}
        >
          {centers.slice(0, -1).map((cy, i) => {
            const nextCy = centers[i + 1];
            const d = buildNeckPath(cy + PILL_H / 2, nextCy - PILL_H / 2);
            return d ? <path key={`neck-${i}`} d={d} fill={barColor} /> : null;
          })}
        </svg>

        {stage === "idle" && (
          <div
            onClick={openStage}
            role="button"
            tabIndex={0}
            aria-label={typeof idleLabel === "string" ? idleLabel : undefined}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStage(); } }}
            style={{ position: "absolute", inset: 0, cursor: "pointer", zIndex: 4 }}
          />
        )}

        {/* Idle / success label, pinned to the top slot */}
        <div
          style={{
            position: "absolute", left: 0, right: 0, top: 0, height: PILL_H,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 13.5, fontWeight: 700, gap: 7,
            pointerEvents: "none", zIndex: 3,
            opacity: isOpen ? 0 : 1, transition: "opacity .25s ease",
          }}
        >
          {isSuccess && showCheck ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {successLabel}
            </>
          ) : isSuccess ? null : (
            idleLabel
          )}
        </div>

        {/* Each field IS a pill — plain div with real CSS border-radius, so rounding is never in question */}
        {fields.map((f, i) => (
          <div
            key={f.id}
            style={{
              position: "absolute", left: 0, right: 0, top: centers[i] - PILL_H / 2, height: PILL_H,
              borderRadius: 999,
              background: barColor,
              transition: "background .3s ease",
              zIndex: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "100%", height: "100%", display: "flex", alignItems: "center", padding: "0 20px",
                opacity: revealed ? 1 : 0,
                transition: "opacity .2s ease",
                pointerEvents: revealed ? "auto" : "none",
              }}
            >
              <div style={{ width: "100%" }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 1 }}>
                  {f.label}
                  {f.required && <span style={{ color: REQUIRED_RED, marginLeft: 3, fontSize: 11 }}>*</span>}
                </div>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <input
                    className="liquid-input"
                    type={f.type === "password" && visibleFields[f.id] ? "text" : f.type ?? "text"}
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                    // Enter = submit (same as clicking the button).
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
                    placeholder={f.placeholder}
                    style={{
                      width: "100%", border: "none", outline: "none", fontSize: 13.5, color: "#fff",
                      background: "transparent", padding: 0,
                      paddingRight: f.type === "password" ? 26 : 0,
                    }}
                  />
                  {f.type === "password" && (
                    <button
                      type="button"
                      onClick={() => setVisibleFields((v) => ({ ...v, [f.id]: !v[f.id] }))}
                      style={{
                        position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", padding: 0, margin: 0,
                        display: "flex", alignItems: "center", cursor: "pointer",
                        color: "rgba(255,255,255,0.7)",
                      }}
                      tabIndex={-1}
                    >
                      {visibleFields[f.id] ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Hints sit in the gap under their pill, only once the form is open */}
        {fields.map((f, i) => f.hint ? (
          <div
            key={`hint-${f.id}`}
            style={{
              position: "absolute", left: 20, right: 0, top: centers[i] + PILL_H / 2 + 4,
              fontSize: 11, lineHeight: "14px", display: "flex", alignItems: "center", gap: 4,
              color: f.hintOk ? "var(--ok-ink)" : "var(--soft-text-2)",
              opacity: revealed ? 0.9 : 0, transition: "opacity .2s ease, color .2s ease",
              pointerEvents: "none",
            }}
          >
            {f.hintOk ? <Check size={12} strokeWidth={3} /> : <Info size={12} />}
            {f.hint}
          </div>
        ) : null)}
      </div>

      {error && <div style={{ color: "var(--bad-ink)", fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{error}</div>}

      <div
        style={{
          display: "flex", justifyContent: anyRequired && requiredNote ? "space-between" : "flex-end", alignItems: "center",
          marginTop: isOpen ? 14 : 0,
          maxHeight: isOpen ? 60 : 0,
          overflow: "hidden",
          opacity: isOpen ? 1 : 0,
          transition: "opacity .2s ease .1s, margin-top .2s ease, max-height .2s ease",
        }}
      >
        {anyRequired && requiredNote && (
          <span style={{ fontSize: 11.5, color: "var(--soft-text-2)" }}>
            <span style={{ color: "var(--bad-ink)", fontWeight: 700 }}>*</span> {requiredNote}
          </span>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={stage === "submitting"}
          style={{
            border: "none", background: NAVY_DEEP, color: "#fff", fontSize: 12.5, fontWeight: 700,
            padding: "10px 22px", borderRadius: 999, cursor: "pointer",
          }}
        >
          {stage === "submitting" ? submittingLabel : submitLabel}
        </button>
      </div>
    </div>
  );
}
