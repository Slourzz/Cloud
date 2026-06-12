import { useEffect, useMemo, useState } from "react";
import { useAppearance } from "@/providers/appearance-provider";

type HourScene = {
  id: string;
  background: string;
  overlay: string;
};

const HOUR_SCENES: Array<{
  from: number;
  to: number;
  scene: HourScene;
}> = [
  {
    from: 5,
    to: 7,
    scene: {
      id: "dawn",
      background:
        "linear-gradient(145deg, #253a67 0%, #8d668c 34%, #e89b7e 68%, #f5c892 100%)",
      overlay:
        "linear-gradient(115deg, rgba(23,31,57,0.22), rgba(255,211,154,0.08))",
    },
  },
  {
    from: 7,
    to: 11,
    scene: {
      id: "morning",
      background:
        "linear-gradient(145deg, #3979a9 0%, #66b8c7 38%, #d1d8b2 72%, #f1cfa2 100%)",
      overlay:
        "linear-gradient(115deg, rgba(19,63,99,0.18), rgba(255,255,255,0.08))",
    },
  },
  {
    from: 11,
    to: 15,
    scene: {
      id: "noon",
      background:
        "linear-gradient(145deg, #1f6ca7 0%, #58b9d2 45%, #d8d8b8 100%)",
      overlay:
        "linear-gradient(115deg, rgba(9,42,76,0.2), rgba(255,255,255,0.06))",
    },
  },
  {
    from: 15,
    to: 18,
    scene: {
      id: "afternoon",
      background:
        "linear-gradient(145deg, #345f91 0%, #8f81a3 45%, #d59683 76%, #e9bd84 100%)",
      overlay:
        "linear-gradient(115deg, rgba(25,44,74,0.22), rgba(255,192,126,0.06))",
    },
  },
  {
    from: 18,
    to: 20,
    scene: {
      id: "sunset",
      background:
        "linear-gradient(145deg, #283659 0%, #76577f 35%, #bd6b77 64%, #d99065 100%)",
      overlay:
        "linear-gradient(115deg, rgba(17,25,48,0.24), rgba(236,136,91,0.06))",
    },
  },
  {
    from: 20,
    to: 22,
    scene: {
      id: "dusk",
      background:
        "linear-gradient(145deg, #152344 0%, #3c345f 50%, #6b4568 100%)",
      overlay:
        "linear-gradient(115deg, rgba(4,10,28,0.32), rgba(142,93,135,0.05))",
    },
  },
  {
    from: 22,
    to: 24,
    scene: {
      id: "night",
      background:
        "linear-gradient(145deg, #090f22 0%, #111c36 48%, #24223f 100%)",
      overlay:
        "linear-gradient(115deg, rgba(0,0,0,0.28), rgba(91,102,160,0.04))",
    },
  },
  {
    from: 0,
    to: 5,
    scene: {
      id: "late-night",
      background:
        "linear-gradient(145deg, #050914 0%, #10172a 52%, #1d1a31 100%)",
      overlay:
        "linear-gradient(115deg, rgba(0,0,0,0.34), rgba(74,79,126,0.04))",
    },
  },
];

function getScene(hour: number) {
  return (
    HOUR_SCENES.find(({ from, to }) => hour >= from && hour < to)?.scene ??
    HOUR_SCENES[HOUR_SCENES.length - 1].scene
  );
}

export function CloudHourBackground() {
  const { settings } = useAppearance();
  const [now, setNow] = useState(() => new Date());
  const enabled =
    settings.interfaceTheme !== "simplyui" &&
    settings.backgroundTheme === "cloud-hour";

  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, [enabled]);

  const scene = useMemo(() => getScene(now.getHours()), [now]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        key={scene.id}
        className="cloud-hour-scene absolute -inset-[7%]"
        style={{
          background: scene.background,
        }}
      />
      <div className="absolute inset-0" style={{ background: scene.overlay }} />
      <div className="absolute inset-0 bg-black/18" />
      <style>{`
        @keyframes cloud-hour-arrive {
          from { opacity: 0; transform: scale(1.035); }
          to { opacity: 1; transform: scale(1); }
        }

        @keyframes cloud-hour-drift {
          0% { background-position: 0% 48%; }
          50% { background-position: 100% 52%; }
          100% { background-position: 0% 48%; }
        }

        .cloud-hour-scene {
          background-size: 180% 180% !important;
          animation:
            cloud-hour-arrive 1.2s cubic-bezier(0.16, 1, 0.3, 1) both,
            cloud-hour-drift 36s ease-in-out infinite;
          filter: saturate(1.08) contrast(1.03);
        }
      `}</style>
    </div>
  );
}
