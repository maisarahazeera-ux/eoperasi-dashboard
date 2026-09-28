import { ReactNode, useEffect, useRef, useState } from "react";

const NAVY = "#0b3d66";
const GREEN = "#0f8a5f";

export type PanelStage = "idle" | "open" | "submitting" | "success";

interface LiquidPanelProps {
  stage: PanelStage;
  idleLabel: string;
  successLabel: string;
  formHeight: number;
  onOpen: () => void;
  children: ReactNode;
}

const SPRING_K = 55;
const SPRING_DAMPING = 11;
const PILL_H = 48;

export default function LiquidPanel({
  stage, idleLabel, successLabel, formHeight, onOpen, children,
}: LiquidPanelProps) {
  const isOpen = stage === "open" || stage === "submitting";
  const isSuccess = stage === "success";
  const targetHeight = isOpen ? formHeight : PILL_H;
  const color = isSuccess ? GREEN : NAVY;

  const heightRef = useRef(targetHeight);
  const velocityRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [renderHeight, setRenderHeight] = useState(targetHeight);
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    let last = performance.now();
    function step(now: number) {
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      const displacement = heightRef.current - targetHeight;
      const accel = -SPRING_K * displacement - SPRING_DAMPING * velocityRef.current;
      velocityRef.current += accel * dt;
      heightRef.current += velocityRef.current * dt;
      setRenderHeight(heightRef.current);

      if (Math.abs(displacement) > 0.4 || Math.abs(velocityRef.current) > 0.4) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        heightRef.current = targetHeight;
        velocityRef.current = 0;
        setRenderHeight(targetHeight);
        rafRef.current = null;
      }
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetHeight]);

  useEffect(() => {
    if (isSuccess) {
      const id = window.setTimeout(() => setShowCheck(true), 480);
      return () => window.clearTimeout(id);
    }
    setShowCheck(false);
  }, [isSuccess]);

  const h = Math.max(renderHeight, PILL_H);
  const radius = Math.min(h / 2, 22);
  const revealed = h > formHeight * 0.6;

  return (
    <div
      style={{
        position: "relative", width: "100%", height: h,
        borderRadius: radius,
        background: revealed ? "#fff" : color,
        boxShadow: "0 20px 50px rgba(8,44,73,0.16)",
        overflow: "hidden",
        transition: "background .25s ease, border-radius .1s linear",
      }}
    >
      {stage === "idle" && (
        <div
          onClick={onOpen}
          style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#fff", fontSize: 14, fontWeight: 700,
          }}
        >
          {idleLabel}
        </div>
      )}

      {!revealed && stage !== "idle" && (
        <div
          style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 14, fontWeight: 700, gap: 7,
            opacity: isSuccess ? 1 : 0, transition: "opacity .2s ease",
          }}
        >
          {isSuccess && showCheck && (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {successLabel}
            </>
          )}
        </div>
      )}

      <div
        style={{
          opacity: revealed ? 1 : 0,
          transition: "opacity .25s ease .12s",
          pointerEvents: revealed ? "auto" : "none",
          padding: "30px 34px",
          height: "100%",
          overflow: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
