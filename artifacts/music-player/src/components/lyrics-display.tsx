import React, { useEffect, useRef, useCallback } from "react";
import { LyricLine } from "@/hooks/use-lyrics";
import { cn } from "@/lib/utils";

interface LyricsDisplayProps {
  lines: LyricLine[];
  currentTime: number;
  source: "ttml" | "plain" | "auto" | null;
  isPaused: boolean;
}

export function LyricsDisplay({ lines, currentTime, source, isPaused }: LyricsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasTiming = source === "ttml" && lines.some((l) => l.begin > 0);

  const getCurrentIndex = useCallback(() => {
    if (!hasTiming) return -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].begin <= currentTime) return i;
    }
    return -1;
  }, [lines, currentTime, hasTiming]);

  const currentIndex = getCurrentIndex();

  useEffect(() => {
    if (!hasTiming) return;
    const el = lineRefs.current[currentIndex];
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex, hasTiming]);

  if (lines.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto scrollbar-hide px-8 py-20"
      style={{ scrollbarWidth: "none" }}
    >
      <div className="max-w-xl mx-auto space-y-6 pb-32">
        {lines.map((line, i) => {
          const isActive = hasTiming ? i === currentIndex : false;
          const isPast = hasTiming ? i < currentIndex : false;
          const isFuture = hasTiming ? i > currentIndex : false;
          const isNearFuture = hasTiming ? i === currentIndex + 1 || i === currentIndex + 2 : false;

          return (
            <div
              key={line.id}
              ref={(el) => { lineRefs.current[i] = el; }}
              className={cn(
                "text-left leading-tight cursor-default select-none transition-all duration-700",
                isActive && "scale-100",
                !isActive && "scale-[0.97]"
              )}
              style={{
                fontSize: isActive ? "2rem" : isNearFuture ? "1.6rem" : "1.4rem",
                fontWeight: isActive ? 800 : 700,
                opacity: isActive ? 1 : isPast ? 0.3 : isFuture ? (isNearFuture ? 0.55 : 0.4) : 1,
                color: "white",
                transition: "all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
                lineHeight: 1.25,
              }}
            >
              {line.words && isActive ? (
                <span>
                  {line.words.map((word, wi) => (
                    <span
                      key={wi}
                      className="inline-block"
                      style={{
                        opacity: currentTime >= word.begin ? 1 : 0.3,
                        transition: "opacity 0.2s ease",
                        marginRight: "0.25em",
                      }}
                    >
                      {word.text}
                    </span>
                  ))}
                </span>
              ) : (
                line.text
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
