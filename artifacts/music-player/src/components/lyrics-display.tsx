import React, { useEffect, useRef, useCallback, memo } from "react";
import { LyricLine } from "@/hooks/use-lyrics";

interface LyricsDisplayProps {
  lines: LyricLine[];
  currentTime: number;
  source: "ttml" | "plain" | "auto" | null;
  isPaused: boolean;
}

interface IdleDotsProps {
  gapDuration: number;
  elapsed: number;
}

const IdleDots = memo(function IdleDots({ gapDuration, elapsed }: IdleDotsProps) {
  const period = Math.max(0.55, Math.min(gapDuration / 3, 1.1));
  const iterations = Math.max(1, Math.ceil(gapDuration / period));
  const progress = gapDuration > 0 ? elapsed / gapDuration : 0;

  return (
    <div
      className="flex items-end gap-[6px] py-6 px-1"
      style={{ opacity: Math.min(1, progress * 8) }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            width: "10px",
            height: "10px",
            background: `rgb(var(--dyn-v))`,
            animation: `lyric-dot-bounce ${period}s cubic-bezier(0.45,0,0.55,1) ${iterations} ${(i * period) / 3}s both`,
            boxShadow: `0 0 8px rgb(var(--dyn-v) / 0.7)`,
          }}
        />
      ))}
    </div>
  );
});

function WordSpan({ word, currentTime }: { word: { begin: number; end: number; text: string }; currentTime: number }) {
  const isActive = currentTime >= word.begin && currentTime < word.end + 0.5;
  const isPast = currentTime >= word.end + 0.5;

  return (
    <span
      className="inline-block"
      style={{
        marginRight: "0.22em",
        transition: "all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)",
        opacity: isActive ? 1 : isPast ? 0.55 : 0.28,
        transform: isActive ? "scale(1.04) translateY(-1px)" : "scale(1) translateY(0)",
        color: "white",
        textShadow: isActive
          ? `0 0 18px rgb(var(--dyn-v)), 0 0 40px rgb(var(--dyn-v) / 0.55), 0 0 70px rgb(var(--dyn-v) / 0.25)`
          : "none",
        fontWeight: isActive ? 900 : 700,
        willChange: "transform, opacity, text-shadow",
      }}
    >
      {word.text}
    </span>
  );
}

export function LyricsDisplay({ lines, currentTime, source, isPaused }: LyricsDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasTiming = source === "ttml" && lines.some((l) => l.begin > 0);

  const getCurrentIndex = useCallback(() => {
    if (!hasTiming) return -1;
    let best = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].begin <= currentTime) best = i;
      else break;
    }
    return best;
  }, [lines, currentTime, hasTiming]);

  const currentIndex = getCurrentIndex();

  // Smooth scroll to active line
  const lastScrolledIndex = useRef(-2);
  useEffect(() => {
    if (!hasTiming || currentIndex === lastScrolledIndex.current) return;
    lastScrolledIndex.current = currentIndex;
    const el = lineRefs.current[currentIndex];
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex, hasTiming]);

  if (lines.length === 0) return null;

  // Determine if we're in a "gap" between lines (idle dots)
  const currentLine = currentIndex >= 0 ? lines[currentIndex] : null;
  const nextLine = currentIndex < lines.length - 1 ? lines[currentIndex + 1] : null;
  const inGap =
    hasTiming &&
    currentLine !== null &&
    nextLine !== null &&
    currentTime > currentLine.end + 0.1 &&
    currentTime < nextLine.begin;
  const gapDuration = inGap && currentLine && nextLine ? nextLine.begin - currentLine.end : 0;
  const gapElapsed = inGap && currentLine ? currentTime - currentLine.end : 0;

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-8 py-16"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <style>{`
        @keyframes lyric-dot-bounce {
          0%   { transform: translateY(0px);   opacity: 0.5; }
          35%  { transform: translateY(-14px); opacity: 1;   }
          65%  { transform: translateY(-14px); opacity: 1;   }
          100% { transform: translateY(0px);   opacity: 0.5; }
        }
      `}</style>

      <div className="max-w-xl mx-auto pb-40 space-y-1">
        {lines.map((line, i) => {
          const isActive = hasTiming ? i === currentIndex : false;
          const isPast = hasTiming ? i < currentIndex : false;
          const isFuture = hasTiming ? i > currentIndex : false;
          const isNear = hasTiming ? i === currentIndex + 1 : false;

          // After active line: show idle dots before inserting next line
          const showDotsAfter = hasTiming && inGap && i === currentIndex;

          const fontSize = isActive ? "2.05rem" : isNear ? "1.65rem" : "1.45rem";
          const fontWeight = isActive ? 800 : 700;
          const opacity = isActive
            ? 1
            : isPast
            ? 0.28
            : isNear
            ? 0.55
            : isFuture
            ? 0.38
            : 1;

          return (
            <React.Fragment key={line.id}>
              <div
                ref={(el) => { lineRefs.current[i] = el; }}
                className="leading-snug cursor-default select-none"
                style={{
                  fontSize,
                  fontWeight,
                  opacity,
                  color: "white",
                  transition: "all 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  paddingTop: isActive ? "0.25rem" : "0.1rem",
                  paddingBottom: isActive ? "0.25rem" : "0.1rem",
                  lineHeight: 1.28,
                  letterSpacing: isActive ? "-0.01em" : "0",
                }}
              >
                {hasTiming && line.words && line.words.length > 0 ? (
                  <span>
                    {line.words.map((word, wi) => (
                      <WordSpan key={wi} word={word} currentTime={currentTime} />
                    ))}
                  </span>
                ) : (
                  line.text
                )}
              </div>

              {showDotsAfter && (
                <IdleDots gapDuration={gapDuration} elapsed={gapElapsed} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
