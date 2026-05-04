import React from "react";
import { Maximize2, ListVideo } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface CornerControlsProps {
  onFullscreen: () => void;
}

export function CornerControls({ onFullscreen }: CornerControlsProps) {
  const [location, setLocation] = useLocation();
  const queueActive = location === "/queue";

  const handleQueueToggle = () => {
    setLocation(queueActive ? "/" : "/queue");
  };

  return (
    <div className="fixed right-6 bottom-28 z-40 flex flex-col gap-2 items-center">
      {/* Queue button */}
      <button
        onClick={handleQueueToggle}
        title="Cola"
        className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 text-white elevation-2"
        style={{
          background: queueActive
            ? `rgb(var(--dyn-v))`
            : `rgb(var(--dyn-m) / 0.5)`,
          boxShadow: queueActive ? `0 4px 20px rgb(var(--dyn-v) / 0.45)` : undefined,
          backdropFilter: "blur(8px)",
        }}
      >
        <ListVideo className="w-4 h-4" />
      </button>

      {/* Fullscreen button */}
      <button
        onClick={onFullscreen}
        title="Pantalla completa"
        className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 text-white elevation-2"
        style={{
          background: `linear-gradient(135deg, rgb(var(--dyn-v) / 0.9), rgb(var(--dyn-m) / 0.9))`,
          boxShadow: `0 4px 20px rgb(var(--dyn-v) / 0.4)`,
        }}
      >
        <Maximize2 className="w-4 h-4" />
      </button>
    </div>
  );
}
