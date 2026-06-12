import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Moon, RotateCw, Sun } from "lucide-react";

type DayPhase = "day" | "night";

type PhaseConfig = {
  Icon: LucideIcon;
  label: string;
};

function getDayPhase(): DayPhase {
  const hour = new Date().getHours();
  return hour >= 5 && hour < 20 ? "day" : "night";
}

const phaseConfig: Record<DayPhase, PhaseConfig> = {
  day: {
    Icon: Sun,
    label: "Dia",
  },
  night: {
    Icon: Moon,
    label: "Noche",
  },
};

export default function TimeLogo() {
  const [targetPhase, setTargetPhase] = useState<DayPhase>(() => getDayPhase());
  const [displayedPhase, setDisplayedPhase] = useState<DayPhase>(() =>
    getDayPhase(),
  );
  const [visible, setVisible] = useState(true);
  const [testingMode, setTestingMode] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!testingMode) {
        setTargetPhase(getDayPhase());
      }
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [testingMode]);

  useEffect(() => {
    if (displayedPhase === targetPhase) return;

    setVisible(false);
    const timeoutId = window.setTimeout(() => {
      setDisplayedPhase(targetPhase);
      setVisible(true);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [displayedPhase, targetPhase]);

  const cyclePhase = () => {
    setTestingMode(true);
    setTargetPhase((phase) => (phase === "day" ? "night" : "day"));
  };

  const { Icon, label } = phaseConfig[displayedPhase];

  return (
    <div className="time-logo relative flex h-10 w-10 items-center justify-center">
      <Icon
        className={`time-logo-main time-logo-${displayedPhase} h-8 w-8 text-white transition-all duration-300 ${
          visible ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={2.2}
        aria-label={label}
        role="img"
      />

      <button
        type="button"
        onClick={cyclePhase}
        className="time-logo-test-button absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-white/82 transition-all hover:scale-110 hover:text-white"
        aria-label="Probar icono"
        title="Probar icono"
      >
        <RotateCw
          className="h-2.5 w-2.5"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      </button>

      <style>{`
        .time-logo-main {
          filter:
            drop-shadow(0 0 5px rgba(255,255,255,0.34))
            drop-shadow(0 1px 2px rgba(0,0,0,0.18));
          animation: time-logo-minimal-float 5.2s ease-in-out infinite;
        }

        .time-logo-test-button {
          background: rgba(255,255,255,0.14);
          border: 1px solid rgba(255,255,255,0.26);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.14);
        }

        .time-logo-test-button:hover {
          background: rgba(255,255,255,0.2);
          border-color: rgba(255,255,255,0.36);
        }

        @keyframes time-logo-minimal-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1.5px); }
        }
      `}</style>
    </div>
  );
}
