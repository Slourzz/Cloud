import { useState, useEffect, useRef } from "react";

interface SplashScreenProps {
  onFinish: () => void;
  isLoading: boolean;
}

type Phase = "loading" | "freeze" | "expand" | "done";

export function SplashScreen({ onFinish, isLoading }: SplashScreenProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const startSoundRef = useRef<HTMLAudioElement | null>(null);
  const dotsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const rafRef = useRef<number>(0);
  const loadingStartTime = useRef(Date.now());

  const MIN_LOADING_TIME = 1.0;   // mínimo 1 s de pulsación
  const FREEZE_TIME = 0.3;
  const EXPAND_TIME = 3.0;        // duración del sonido

  // ── Animación JS de los puntos durante "loading" ────────
  useEffect(() => {
    if (phase !== "loading") return;

    const start = performance.now();
    const duration = 2; // segundos por ciclo
    const minScale = 1;
    const maxScale = 1.5;

    const animate = (now: number) => {
      const elapsed = (now - start) / 1000;
      dotsRef.current.forEach((dot, i) => {
        if (!dot) return;
        // cada punto lleva un desfase de 0.25s
        const offset = i * 0.25;
        const t = ((elapsed + offset) % duration) / duration; // 0 → 1
        // interpolación suave: sube y baja usando coseno
        const scale = minScale + (maxScale - minScale) * (0.5 - 0.5 * Math.cos(t * 2 * Math.PI));
        dot.style.transform = `scale(${scale})`;
        dot.style.opacity = `${0.6 + 0.4 * scale}`;
      });
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  // ── Transición de fases ─────────────────────────────────
  useEffect(() => {
    if (phase !== "loading") return;

    const elapsed = () => (Date.now() - loadingStartTime.current) / 1000;

    if (!isLoading && elapsed() >= MIN_LOADING_TIME) {
      startFinalSequence();
      return;
    }
    if (!isLoading && elapsed() < MIN_LOADING_TIME) {
      const remaining = (MIN_LOADING_TIME - elapsed()) * 1000;
      const timer = setTimeout(() => startFinalSequence(), remaining);
      return () => clearTimeout(timer);
    }
  }, [isLoading, phase]);

  const startFinalSequence = () => {
    setPhase("freeze");
    startSoundRef.current = new Audio("/sounds/startup.mp3");

    setTimeout(() => {
      setPhase("expand");
      startSoundRef.current?.play().catch(() => {});
    }, FREEZE_TIME * 1000);

    setTimeout(() => {
      setPhase("done");
      setTimeout(() => onFinish(), 200);
    }, (FREEZE_TIME + EXPAND_TIME) * 1000);
  };

  // ── Estilos según fase ──────────────────────────────────
  const getDotStyle = (i: number): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: "10px",
      height: "10px",
      borderRadius: "50%",
      backgroundColor: "white",
    };

    if (phase === "loading") {
      return {
        ...base,
        transition: "none", // JS controla el estilo
      };
    }
    if (phase === "freeze") {
      return {
        ...base,
        transform: "scale(1)",
        opacity: 0.9,
        transition: "transform 0.3s ease, opacity 0.3s ease",
      };
    }
    if (phase === "expand") {
      return {
        ...base,
        transform: "scale(20)",   // 10px → 200px
        opacity: 0,
        filter: "blur(12px)",
        transition: `transform ${EXPAND_TIME}s cubic-bezier(0.33, 0.1, 0.33, 1), opacity ${EXPAND_TIME * 0.6}s ease-in, filter ${EXPAND_TIME * 0.5}s ease-in`,
      };
    }
    return base;
  };

  // ── Fondo del contenedor ────────────────────────────────
  const containerStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 99999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: phase === "expand" || phase === "done" ? "transparent" : "black",
    transition: `background-color ${EXPAND_TIME * 0.8}s ease`,
    pointerEvents: phase === "done" ? "none" : "auto",
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", gap: "8px" }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            ref={(el) => { dotsRef.current[i] = el; }}
            style={getDotStyle(i)}
          />
        ))}
      </div>
    </div>
  );
}
