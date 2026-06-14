import { useEffect, useRef, useCallback } from "react";
import { LyricLine, type LyricsCredits } from "@/hooks/use-lyrics";
import { useMusicPlayer } from "@/hooks/use-music-player";
import { useAppearance } from "@/providers/appearance-provider";
import {
  DotGlowSpline,
  DotOpacitySpline,
  DotScaleSpline,
  DotYOffsetSpline,
  GlowSpline,
  getElementState,
  getLineGradientPosition,
  getProgressPercentage,
  getWordGradientPosition,
  LineGlowSpline,
  ScaleSpline,
  Spring,
  SpringSettings,
  YOffsetSpline,
} from "@/vendor/spicy-lyrics/engine";

export interface LyricsDisplayProps {
  lines: LyricLine[];
  currentTime: number;
  source: "ttml" | "plain" | "auto" | null;
  isPaused: boolean;
  coverUrl?: string;
  credits?: LyricsCredits;
}

export interface LyricsDisplayCoreProps extends LyricsDisplayProps {
  songId?: string;
  getPlaybackTime: () => number;
  seekTo: (time: number) => void;
  isSimplyUI: boolean;
  lyricsMotion: "animated" | "static";
  animationFormat: "line" | "letters" | "line-words";
  active?: boolean;
}

// ── Spring physics ────────────────────────────────────────────────────────────
// ── Spline ────────────────────────────────────────────────────────────────────
// ── Animation curves ──────────────────────────────────────────────────────────
const MIN_GAP_FOR_DOTS = 2.5; // seconds
const DOTS_LEAD_OUT_SECONDS = 0.32;
const PARENTHETICAL_SETTLE_SECONDS = 0.9;
const MANUAL_SCROLL_RELEASE_MS = 5000;
const SCROLL_STIFFNESS = 96;
const SCROLL_DAMPING = 17;

function splitParentheticalText(text: string) {
  const match = text.match(/^(.*?)(\s*\([^()]+\))\s*$/);
  if (!match) return { primary: text, parenthetical: "" };

  return {
    primary: match[1].trim(),
    parenthetical: match[2].trim(),
  };
}

function getLineVisualEnd(line: LyricLine) {
  return Math.max(
    line.end,
    ...(line.words?.map((word) => word.end) ?? [line.end]),
  );
}

function appendTimedWord(
  target: HTMLElement,
  wordText: string,
  word: LyricLine["words"][number],
  words: WordData[],
) {
  if (!wordText) return;

  if (target.childNodes.length > 0 && target.lastChild?.textContent !== "(") {
    const space = document.createElement("span");
    space.className = "sl-space";
    space.textContent = "\u00a0";
    target.appendChild(space);
  }

  const wordEl = document.createElement("span");
  wordEl.className = "sl-word";
  wordEl.textContent = wordText;
  target.appendChild(wordEl);
  words.push({
    HTMLElement: wordEl,
    StartTime: word.begin,
    EndTime: word.end,
    TotalTime: word.end - word.begin,
  });
}

function resetWordMotion(word: WordData) {
  word.AnimatorStore = undefined;
  word.HTMLElement.style.scale = "1";
  word.HTMLElement.style.transform = "translate3d(0, 0, 0)";
  word.HTMLElement.style.setProperty("--text-shadow-opacity", "0%");
  word.HTMLElement.style.setProperty("--text-shadow-blur", "4px");
}

function appendCredits(
  parent: HTMLElement,
  credits: LyricsCredits | undefined,
) {
  if (!credits) return;

  const footer = document.createElement("footer");
  footer.className = "sl-credits";

  const writerLine = document.createElement("p");
  writerLine.className = "sl-credit-line sl-credit-writers";
  writerLine.textContent = `Escrita por: ${
    credits.writers.length
      ? credits.writers.join(", ")
      : "Informacion no disponible"
  }`;
  footer.appendChild(writerLine);

  if (credits.provider) {
    const providerLine = document.createElement("p");
    providerLine.className = "sl-credit-line";
    providerLine.textContent = `Proporcionadas por: ${credits.provider}`;
    footer.appendChild(providerLine);
  }

  if (credits.community) {
    const communityLine = document.createElement("p");
    communityLine.className = "sl-credit-line";
    communityLine.textContent =
      "Estas letras fueron obtenidas de nuestra comunidad";
    footer.appendChild(communityLine);
  }

  if (credits.synchronizer?.name) {
    const synchronizerLine = document.createElement("p");
    synchronizerLine.className = "sl-credit-line";
    synchronizerLine.textContent = `Sincronizacion por: @${credits.synchronizer.name.replace(/^@/, "")}`;
    footer.appendChild(synchronizerLine);
  }

  parent.appendChild(footer);
}

// ── Data structures ───────────────────────────────────────────────────────────
interface WordData {
  HTMLElement: HTMLElement;
  StartTime: number;
  EndTime: number;
  TotalTime: number;
  Dot?: boolean;
  AnimatorStore?: {
    Scale: Spring;
    YOffset: Spring;
    Glow: Spring;
    Opacity?: Spring;
  };
}

interface LineData {
  HTMLElement: HTMLElement;
  StartTime: number;
  EndTime: number;
  Words: WordData[];
  DotLine?: boolean;
  PreservePreviousLine?: boolean;
  AnimatorStore?: {
    Glow: Spring;
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function LyricsDisplay({
  lines,
  currentTime,
  source,
  isPaused,
  coverUrl,
  credits,
}: LyricsDisplayProps) {
  const { currentSong, getAudioTime, seek } = useMusicPlayer();
  const { settings: appearance } = useAppearance();
  const isSimplyUI = appearance.interfaceTheme === "simplyui";
  const lyricsMotion = isSimplyUI ? "animated" : appearance.lyricsMotion;
  const animationFormat = isSimplyUI
    ? "line"
    : appearance.lyricsAnimationFormat;

  return (
    <LyricsDisplayCore
      lines={lines}
      currentTime={currentTime}
      source={source}
      isPaused={isPaused}
      coverUrl={coverUrl}
      credits={credits}
      songId={currentSong?.id}
      getPlaybackTime={getAudioTime}
      seekTo={seek}
      isSimplyUI={isSimplyUI}
      lyricsMotion={lyricsMotion}
      animationFormat={animationFormat}
    />
  );
}

export function LyricsDisplayCore({
  lines,
  source,
  isPaused,
  coverUrl,
  credits,
  songId,
  getPlaybackTime,
  seekTo,
  isSimplyUI,
  lyricsMotion,
  animationFormat,
  active = true,
}: LyricsDisplayCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const scrollRafRef = useRef<number>(0);
  const scrollTargetRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const scrollFrameTimeRef = useRef(0);
  const manualScrollRef = useRef(false);
  const autoScrollBlockedUntilRef = useRef(0);
  const manualScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastFrameTime = useRef(performance.now());
  const linesDataRef = useRef<LineData[]>([]);
  const lastActiveIndex = useRef(-1);
  const currentActiveIndexRef = useRef(-1);
  const lastPreservedIndexRef = useRef(-1);
  const kawarpRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const creditsRef = useRef(credits);
  const seekRef = useRef(seekTo);
  creditsRef.current = credits;
  seekRef.current = seekTo;

  const hasTiming = source === "ttml" && lines.some((l) => l.begin > 0);
  const creditsKey = [
    credits?.writers.join("\u001f") ?? "",
    credits?.community ? "1" : "0",
    credits?.provider ?? "",
    credits?.synchronizer?.id ?? "",
    credits?.synchronizer?.name ?? "",
    credits?.synchronizer?.avatarUrl ?? "",
  ].join("\u001e");

  // ── Build DOM ───────────────────────────────────────────────────────────────
  const buildLines = useCallback(() => {
    if (!scrollRef.current) return;
    scrollRef.current.innerHTML = "";
    linesDataRef.current = [];
    lastActiveIndex.current = -1;
    currentActiveIndexRef.current = -1;
    lastPreservedIndexRef.current = -1;
    manualScrollRef.current = false;
    if (manualScrollTimeoutRef.current) {
      clearTimeout(manualScrollTimeoutRef.current);
      manualScrollTimeoutRef.current = null;
    }

    const allLines: LineData[] = [];

    const appendDotLine = (
      dotStartTime: number,
      nextLineBegin: number,
      preservePreviousLine = false,
    ) => {
      const dotEndTime = Math.max(
        dotStartTime + 0.3,
        nextLineBegin - DOTS_LEAD_OUT_SECONDS,
      );
      const totalDotTime = dotEndTime - dotStartTime;
      const dotTime = totalDotTime / 3;

      const musicalLine = document.createElement("div");
      musicalLine.className = "sl-line sl-musical-line sl-not-sung";

      const dotGroup = document.createElement("div");
      dotGroup.className = "sl-dot-group";

      const dotWords: WordData[] = [];

      [0, 1, 2].forEach((i) => {
        const dotEl = document.createElement("span");
        dotEl.className = "sl-dot";
        dotEl.textContent = "•";
        dotGroup.appendChild(dotEl);

        dotWords.push({
          HTMLElement: dotEl,
          StartTime: dotStartTime + i * dotTime,
          EndTime: dotStartTime + (i + 1) * dotTime,
          TotalTime: dotTime,
          Dot: true,
        });
      });

      musicalLine.appendChild(dotGroup);
      scrollRef.current!.appendChild(musicalLine);

      allLines.push({
        HTMLElement: musicalLine,
        StartTime: dotStartTime,
        EndTime: dotEndTime,
        Words: dotWords,
        DotLine: true,
        PreservePreviousLine: preservePreviousLine,
      });
    };

    const firstLine = lines[0];
    if (hasTiming && firstLine?.begin >= MIN_GAP_FOR_DOTS) {
      appendDotLine(0, firstLine.begin);
    }

    lines.forEach((line, idx) => {
      // Check if we need dots before this line
      if (idx > 0 && hasTiming) {
        const prevLine = lines[idx - 1];
        const previousVisualEnd = getLineVisualEnd(prevLine);
        const gap = line.begin - previousVisualEnd;
        if (gap >= MIN_GAP_FOR_DOTS) {
          const previousHasParenthetical = Boolean(
            splitParentheticalText(prevLine.text).parenthetical ||
            prevLine.words?.some((word) => /[()]/.test(word.text)),
          );
          appendDotLine(
            previousVisualEnd,
            line.begin,
            previousHasParenthetical,
          );
        }
      }

      // Regular line
      const lineEl = document.createElement("div");
      lineEl.className = "sl-line sl-not-sung";
      lineEl.dataset.idx = String(idx);
      lineEl.tabIndex = 0;
      lineEl.setAttribute("role", "button");
      lineEl.setAttribute(
        "aria-label",
        `Ir a ${line.text} en ${line.begin.toFixed(2)} segundos`,
      );

      const seekToLine = () => {
        seekRef.current(Math.max(0, line.begin));
      };
      lineEl.addEventListener("click", seekToLine);
      lineEl.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        seekToLine();
      });

      const words: WordData[] = [];
      const parts = splitParentheticalText(line.text);
      const primaryGroup = document.createElement("span");
      primaryGroup.className = "sl-primary";
      const parentheticalGroup = document.createElement("span");
      parentheticalGroup.className = "sl-parenthetical";

      if (hasTiming && animationFormat === "line") {
        if (parts.primary) {
          primaryGroup.textContent = parts.primary;
          primaryGroup.classList.add("sl-word", "sl-line-chunk");
          words.push({
            HTMLElement: primaryGroup,
            StartTime: line.begin,
            EndTime: line.end,
            TotalTime: Math.max(0.001, line.end - line.begin),
          });
        }

        if (parts.parenthetical) {
          parentheticalGroup.textContent = parts.parenthetical;
          parentheticalGroup.classList.add("sl-word", "sl-line-chunk");
          words.push({
            HTMLElement: parentheticalGroup,
            StartTime: line.begin,
            EndTime: line.end,
            TotalTime: Math.max(0.001, line.end - line.begin),
          });
        }
      } else if (hasTiming && line.words && line.words.length > 0) {
        let insideParenthetical = false;
        line.words.forEach((word) => {
          const opensParenthetical = word.text.includes("(");
          const closesParenthetical = word.text.includes(")");

          if (opensParenthetical && !insideParenthetical) {
            insideParenthetical = true;
            const openParen = document.createElement("span");
            openParen.className = "sl-parenthesis";
            openParen.textContent = "(";
            parentheticalGroup.appendChild(openParen);
          }

          const cleanText = word.text.replace(/[()]/g, "").trim();
          const target = insideParenthetical
            ? parentheticalGroup
            : primaryGroup;
          appendTimedWord(target, cleanText, word, words);

          if (closesParenthetical && insideParenthetical) {
            const closeParen = document.createElement("span");
            closeParen.className = "sl-parenthesis";
            closeParen.textContent = ")";
            parentheticalGroup.appendChild(closeParen);
            insideParenthetical = false;
          }
        });
      } else {
        primaryGroup.textContent = parts.primary;
        parentheticalGroup.textContent = parts.parenthetical;
        lineEl.classList.add("sl-plain");
      }

      if (primaryGroup.textContent?.trim()) {
        lineEl.appendChild(primaryGroup);
      }
      if (parentheticalGroup.textContent?.trim()) {
        lineEl.appendChild(parentheticalGroup);
      }

      scrollRef.current!.appendChild(lineEl);
      allLines.push({
        HTMLElement: lineEl,
        StartTime: line.begin,
        EndTime: getLineVisualEnd(line),
        Words: words,
      });
    });

    appendCredits(scrollRef.current, creditsRef.current);
    linesDataRef.current = allLines;
  }, [lines, hasTiming, creditsKey, animationFormat]);

  useEffect(() => {
    buildLines();
  }, [buildLines]);

  useEffect(() => {
    const container = containerRef.current;
    autoScrollBlockedUntilRef.current = performance.now() + 500;
    cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = 0;
    scrollTargetRef.current = 0;
    scrollVelocityRef.current = 0;
    scrollFrameTimeRef.current = 0;
    manualScrollRef.current = false;
    currentActiveIndexRef.current = -1;
    lastActiveIndex.current = -1;
    lastPreservedIndexRef.current = -1;

    if (manualScrollTimeoutRef.current) {
      clearTimeout(manualScrollTimeoutRef.current);
      manualScrollTimeoutRef.current = null;
    }

    if (container) {
      container.scrollTop = 0;
    }
  }, [songId]);

  // ── Kawarp ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isSimplyUI || !canvasRef.current || !coverUrl) return;
    let kawarp: any = null;
    import("@kawarp/core")
      .then(({ default: Kawarp }) => {
        kawarp = new Kawarp(canvasRef.current!, {
          warpIntensity: 1,
          blurPasses: 8,
          animationSpeed: 0.08,
          saturation: 1.5,
          dithering: 0.008,
          transitionDuration: 1000,
          tintIntensity: 0,
          scale: 1,
        });
        kawarpRef.current = kawarp;
        kawarp.loadImage(coverUrl).then(() => kawarp.start());
      })
      .catch(() => {});
    return () => {
      kawarp?.stop();
      kawarpRef.current = null;
    };
  }, [coverUrl, isSimplyUI]);

  useEffect(() => {
    kawarpRef.current?.setOptions?.({ animationSpeed: isPaused ? 0.02 : 0.08 });
  }, [isPaused]);

  // ── Scroll ──────────────────────────────────────────────────────────────────
  const animateScroll = useCallback((timestamp: number) => {
    const container = containerRef.current;
    if (!container) {
      scrollRafRef.current = 0;
      return;
    }

    if (scrollFrameTimeRef.current === 0) {
      scrollFrameTimeRef.current = timestamp;
    }

    const dt = Math.min(
      Math.max((timestamp - scrollFrameTimeRef.current) / 1000, 0),
      0.034,
    );
    scrollFrameTimeRef.current = timestamp;

    const displacement = scrollTargetRef.current - container.scrollTop;
    scrollVelocityRef.current += displacement * SCROLL_STIFFNESS * dt;
    scrollVelocityRef.current *= Math.exp(-SCROLL_DAMPING * dt);
    container.scrollTop += scrollVelocityRef.current * dt;

    if (
      Math.abs(displacement) < 0.35 &&
      Math.abs(scrollVelocityRef.current) < 2
    ) {
      container.scrollTop = scrollTargetRef.current;
      scrollVelocityRef.current = 0;
      scrollFrameTimeRef.current = 0;
      scrollRafRef.current = 0;
      return;
    }

    scrollRafRef.current = requestAnimationFrame(animateScroll);
  }, []);

  const scrollToLine = useCallback(
    (index: number) => {
      const container = containerRef.current;
      const lineEl = linesDataRef.current[index]?.HTMLElement;
      if (!container || !lineEl) return;

      const targetScrollTop =
        lineEl.offsetTop -
        (container.clientHeight / 2 - lineEl.clientHeight / 2) +
        30;
      const maxScrollTop = Math.max(
        0,
        container.scrollHeight - container.clientHeight,
      );
      scrollTargetRef.current = Math.min(
        Math.max(targetScrollTop, 0),
        maxScrollTop,
      );

      if (lyricsMotion === "static") {
        cancelAnimationFrame(scrollRafRef.current);
        container.scrollTop = scrollTargetRef.current;
        scrollVelocityRef.current = 0;
        scrollFrameTimeRef.current = 0;
        scrollRafRef.current = 0;
        return;
      }

      if (scrollRafRef.current === 0) {
        scrollFrameTimeRef.current = 0;
        scrollRafRef.current = requestAnimationFrame(animateScroll);
      }
    },
    [animateScroll, lyricsMotion],
  );

  const suspendAutoScroll = useCallback(() => {
    manualScrollRef.current = true;
    cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = 0;
    scrollVelocityRef.current = 0;
    scrollFrameTimeRef.current = 0;

    if (manualScrollTimeoutRef.current) {
      clearTimeout(manualScrollTimeoutRef.current);
    }

    manualScrollTimeoutRef.current = setTimeout(() => {
      manualScrollRef.current = false;
      manualScrollTimeoutRef.current = null;

      if (currentActiveIndexRef.current >= 0) {
        scrollToLine(currentActiveIndexRef.current);
      }
    }, MANUAL_SCROLL_RELEASE_MS);
  }, [scrollToLine]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !hasTiming) return;

    const handleWheel = () => suspendAutoScroll();
    const handleTouch = () => suspendAutoScroll();
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button === 1) suspendAutoScroll();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(
          event.key,
        )
      ) {
        suspendAutoScroll();
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: true });
    container.addEventListener("touchstart", handleTouch, { passive: true });
    container.addEventListener("touchmove", handleTouch, { passive: true });
    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouch);
      container.removeEventListener("touchmove", handleTouch);
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasTiming, suspendAutoScroll]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(scrollRafRef.current);
      if (manualScrollTimeoutRef.current) {
        clearTimeout(manualScrollTimeoutRef.current);
      }
    };
  }, []);

  // ── Blur by distance ────────────────────────────────────────────────────────
  const applyBlur = useCallback(
    (activeIndex: number, preservedIndex = -1) => {
      linesDataRef.current.forEach((line, i) => {
        const dist = Math.abs(i - activeIndex);
        const blur =
          i === preservedIndex
            ? 0
            : lyricsMotion === "animated" && dist > 0
              ? Math.min(3.5 * dist, 18)
              : 0;
        line.HTMLElement.style.setProperty("--BlurAmount", `${blur}px`);
      });
    },
    [lyricsMotion],
  );

  // ── RAF loop ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasTiming || !active) return;

    lastFrameTime.current = performance.now();
    lastActiveIndex.current = -1;
    currentActiveIndexRef.current = -1;
    lastPreservedIndexRef.current = -1;
    autoScrollBlockedUntilRef.current = 0;

    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - lastFrameTime.current) / 1000, 0.05);
      lastFrameTime.current = now;

      const t = getPlaybackTime();
      const arr = linesDataRef.current;

      // Find active line
      let activeIndex = -1;
      for (let i = 0; i < arr.length; i++) {
        if (t >= arr[i].StartTime && t <= arr[i].EndTime) {
          activeIndex = i;
          break;
        }
        if (t >= arr[i].StartTime) activeIndex = i;
      }

      if (
        activeIndex >= 0 &&
        arr[activeIndex].DotLine &&
        t > arr[activeIndex].EndTime
      ) {
        activeIndex = -1;
      }

      currentActiveIndexRef.current = activeIndex;
      const activeLine = activeIndex >= 0 ? arr[activeIndex] : undefined;
      const preservedIndex =
        activeLine?.DotLine &&
        activeLine.PreservePreviousLine &&
        activeIndex > 0 &&
        t <
          Math.min(
            activeLine.EndTime,
            activeLine.StartTime + PARENTHETICAL_SETTLE_SECONDS,
          )
          ? activeIndex - 1
          : -1;

      // Update classes when active line changes
      if (
        activeIndex !== lastActiveIndex.current ||
        preservedIndex !== lastPreservedIndexRef.current
      ) {
        lastActiveIndex.current = activeIndex;
        lastPreservedIndexRef.current = preservedIndex;
        if (activeIndex >= 0) {
          applyBlur(activeIndex, preservedIndex);
          if (
            !manualScrollRef.current &&
            performance.now() >= autoScrollBlockedUntilRef.current
          ) {
            scrollToLine(activeIndex);
          }
        }
        arr.forEach((line, i) => {
          const el = line.HTMLElement;
          const base = line.DotLine ? "sl-line sl-musical-line" : "sl-line";
          if (i === preservedIndex)
            el.className = `${base} sl-sung sl-transition-hold`;
          else if (i < activeIndex) el.className = `${base} sl-sung`;
          else if (i === activeIndex) el.className = `${base} sl-active`;
          else el.className = `${base} sl-not-sung`;

          if (i !== activeIndex && i !== preservedIndex) {
            line.Words.forEach(resetWordMotion);
          }
        });
      }

      // Animate active line words/dots
      if (activeIndex >= 0) {
        const line = arr[activeIndex];
        const isDotLine = line.DotLine;
        const lineState = getElementState(t, line.StartTime, line.EndTime);
        const lineProgress = getProgressPercentage(
          t,
          line.StartTime,
          line.EndTime,
        );

        if (
          lyricsMotion === "animated" &&
          animationFormat === "line" &&
          !isDotLine
        ) {
          if (!line.AnimatorStore) {
            line.AnimatorStore = {
              Glow: new Spring(
                LineGlowSpline.at(0),
                SpringSettings.lineGlow.frequency,
                SpringSettings.lineGlow.damping,
              ),
            };
            line.AnimatorStore.Glow.SetGoal(LineGlowSpline.at(0), true);
          }

          line.AnimatorStore.Glow.SetGoal(LineGlowSpline.at(lineProgress));
          const currentGlow = line.AnimatorStore.Glow.Step(dt);
          const gradientPosition = getLineGradientPosition(
            lineState,
            lineProgress,
          );

          line.Words.forEach((word) => {
            resetWordMotion(word);
            word.HTMLElement.style.setProperty(
              "--gradient-position",
              `${gradientPosition}%`,
            );
            word.HTMLElement.style.setProperty(
              "--text-shadow-blur",
              `${4 + 8 * currentGlow}px`,
            );
            word.HTMLElement.style.setProperty(
              "--text-shadow-opacity",
              `${currentGlow * 50}%`,
            );
          });
        } else {
          line.Words.forEach((word) => {
            const state = getElementState(t, word.StartTime, word.EndTime);
            const pct = getProgressPercentage(t, word.StartTime, word.EndTime);

            if (lyricsMotion === "static") {
              resetWordMotion(word);
              word.HTMLElement.style.setProperty(
                "--gradient-position",
                state === "NotSung" ? "-20%" : "100%",
              );
            } else if (animationFormat === "letters" && !isDotLine) {
              if (!word.AnimatorStore) {
                word.AnimatorStore = {
                  Scale: new Spring(
                    ScaleSpline.at(0),
                    SpringSettings.scale.frequency,
                    SpringSettings.scale.damping,
                  ),
                  YOffset: new Spring(
                    YOffsetSpline.at(0),
                    SpringSettings.yOffset.frequency,
                    SpringSettings.yOffset.damping,
                  ),
                  Glow: new Spring(
                    GlowSpline.at(0),
                    SpringSettings.glow.frequency,
                    SpringSettings.glow.damping,
                  ),
                };
                word.AnimatorStore.Scale.SetGoal(ScaleSpline.at(0), true);
                word.AnimatorStore.YOffset.SetGoal(YOffsetSpline.at(0), true);
                word.AnimatorStore.Glow.SetGoal(GlowSpline.at(0), true);
              }

              const s = word.AnimatorStore;
              s.Scale.SetGoal(ScaleSpline.at(pct));
              s.YOffset.SetGoal(YOffsetSpline.at(pct));
              s.Glow.SetGoal(GlowSpline.at(pct));

              const scale = s.Scale.Step(dt);
              const yOff = s.YOffset.Step(dt);
              const glow = s.Glow.Step(dt);
              const el = word.HTMLElement;

              el.style.scale = `${scale}`;
              el.style.transform = `translate3d(0, calc(var(--sl-size) * ${yOff}), 0)`;
              el.style.setProperty(
                "--gradient-position",
                `${getWordGradientPosition(state, pct, true)}%`,
              );
              el.style.setProperty(
                "--text-shadow-opacity",
                `${Math.min(glow * 35, 100)}%`,
              );
              el.style.setProperty("--text-shadow-blur", `${4 + 2 * glow}px`);
            } else if (isDotLine) {
              if (!word.AnimatorStore) {
                word.AnimatorStore = {
                  Scale: new Spring(
                    DotScaleSpline.at(0),
                    SpringSettings.scale.frequency,
                    SpringSettings.scale.damping,
                  ),
                  YOffset: new Spring(
                    DotYOffsetSpline.at(0),
                    SpringSettings.yOffset.frequency,
                    SpringSettings.yOffset.damping,
                  ),
                  Glow: new Spring(
                    DotGlowSpline.at(0),
                    SpringSettings.glow.frequency,
                    SpringSettings.glow.damping,
                  ),
                  Opacity: new Spring(DotOpacitySpline.at(0), 1, 0.5),
                };
              }

              const s = word.AnimatorStore;
              s.Scale.SetGoal(DotScaleSpline.at(pct));
              s.YOffset.SetGoal(DotYOffsetSpline.at(pct));
              s.Glow.SetGoal(DotGlowSpline.at(pct));
              s.Opacity!.SetGoal(DotOpacitySpline.at(pct));

              const scale = s.Scale.Step(dt);
              const yOff = s.YOffset.Step(dt);
              const glow = s.Glow.Step(dt);
              const opacity = s.Opacity!.Step(dt);
              const el = word.HTMLElement;

              el.style.scale = `${scale}`;
              el.style.transform = `translate3d(0, calc(var(--sl-size) * ${yOff}), 0)`;
              el.style.opacity = `${opacity}`;
              el.style.setProperty("--text-shadow-opacity", `${glow * 90}%`);
              el.style.setProperty("--text-shadow-blur", `${4 + 6 * glow}px`);
            } else {
              if (!word.AnimatorStore) {
                word.AnimatorStore = {
                  Scale: new Spring(
                    ScaleSpline.at(0),
                    SpringSettings.scale.frequency,
                    SpringSettings.scale.damping,
                  ),
                  YOffset: new Spring(
                    YOffsetSpline.at(0),
                    SpringSettings.yOffset.frequency,
                    SpringSettings.yOffset.damping,
                  ),
                  Glow: new Spring(
                    GlowSpline.at(0),
                    SpringSettings.glow.frequency,
                    SpringSettings.glow.damping,
                  ),
                };
                word.AnimatorStore.Scale.SetGoal(ScaleSpline.at(0), true);
                word.AnimatorStore.YOffset.SetGoal(YOffsetSpline.at(0), true);
                word.AnimatorStore.Glow.SetGoal(GlowSpline.at(0), true);
              }

              const s = word.AnimatorStore;
              s.Scale.SetGoal(ScaleSpline.at(pct));
              s.YOffset.SetGoal(YOffsetSpline.at(pct));
              s.Glow.SetGoal(GlowSpline.at(pct));

              const scale = s.Scale.Step(dt);
              const yOff = s.YOffset.Step(dt);
              const glow = s.Glow.Step(dt);
              const el = word.HTMLElement;

              el.style.scale = `${scale}`;
              el.style.transform = `translate3d(0, calc(var(--sl-size) * ${yOff}), 0)`;
              el.style.setProperty(
                "--gradient-position",
                `${getWordGradientPosition(state, pct, false)}%`,
              );
              el.style.setProperty(
                "--text-shadow-opacity",
                `${Math.min(glow * 35, 100)}%`,
              );
              el.style.setProperty("--text-shadow-blur", `${4 + 2 * glow}px`);
            }
          });
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [
    hasTiming,
    getPlaybackTime,
    applyBlur,
    scrollToLine,
    lyricsMotion,
    animationFormat,
    active,
  ]);

  // ── Plain text ──────────────────────────────────────────────────────────────
  if (!hasTiming) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {!isSimplyUI ? (
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              zIndex: 0,
            }}
          />
        ) : null}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            height: "100%",
            overflowY: "auto",
            padding: "2rem",
            scrollbarWidth: "none",
          }}
        >
          {lines.map((line) => {
            const parts = splitParentheticalText(line.text);
            return (
              <div key={line.id} className="mb-2 text-white">
                {parts.primary ? (
                  <p className="text-[1.35rem] font-bold leading-[1.4] opacity-75">
                    {parts.primary}
                  </p>
                ) : null}
                {parts.parenthetical ? (
                  <p className="mt-0.5 text-[1rem] font-semibold leading-[1.35] opacity-60">
                    {parts.parenthetical}
                  </p>
                ) : null}
              </div>
            );
          })}
          <div className="mt-20 max-w-4xl border-t border-white/20 pb-24 pt-8 text-[clamp(1rem,1.45vw,1.35rem)] font-bold leading-[1.4] text-white/62">
            <p className="sl-credit-line text-[clamp(1.15rem,1.8vw,1.6rem)] font-black text-white/70">
              Escrita por:{" "}
              {credits?.writers.length
                ? credits.writers.join(", ")
                : "Informacion no disponible"}
            </p>
            {credits?.provider ? (
              <p className="sl-credit-line mt-2">
                Proporcionadas por: {credits.provider}
              </p>
            ) : null}
            {credits?.community ? (
              <p className="sl-credit-line mt-2">
                Estas letras fueron obtenidas de nuestra comunidad
              </p>
            ) : null}
            {credits?.synchronizer?.name ? (
              <p className="sl-credit-line mt-2">
                Sincronizacion por: @
                {credits.synchronizer.name.replace(/^@/, "")}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // ── TTML render ─────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {!isSimplyUI ? (
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 0,
          }}
        />
      ) : null}

      <style>{`
        @property --SLM_GradientPosition {
          syntax: "<percentage>";
          inherits: false;
          initial-value: -50%;
        }
        .sl-container {
          position: relative;
          z-index: 1;
          height: 100%;
          overflow-y: auto;
          scrollbar-width: none;
          padding: 0 clamp(2.5rem, 4vw, 5rem);
          -webkit-mask-image: linear-gradient(180deg, transparent 0, rgba(0,0,0,0.1) 40px, black 80px, black calc(100% - 80px), rgba(0,0,0,0.1) calc(100% - 40px), transparent 100%);
          mask-image: linear-gradient(180deg, transparent 0, rgba(0,0,0,0.1) 40px, black 80px, black calc(100% - 80px), rgba(0,0,0,0.1) calc(100% - 40px), transparent 100%);
        }
        .sl-scroll {
          padding-top: 30vh;
          padding-bottom: 45vh;
          display: flex;
          flex-direction: column;
        }
        .sl-line {
          --sl-size: clamp(1.85rem, 5cqw, 3.5rem);
          font-size: var(--sl-size);
          font-weight: 700;
          line-height: 1.12;
          width: 100%;
          box-sizing: border-box;
          margin: clamp(0.04rem, 0.3cqw, 0.18rem) 0;
          padding: 0.16em 0;
          cursor: pointer;
          user-select: none;
          display: block;
          text-align: left;
          text-indent: 0;
          transform: translate3d(0, 0, 0);
          transition: opacity 0.2s cubic-bezier(0.61,1,0.88,1), filter 0.2s ease, transform 0.28s cubic-bezier(0.16,1,0.3,1);
          filter: blur(var(--BlurAmount, 0px));
        }
        .sl-primary,
        .sl-parenthetical {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
          align-items: baseline;
          width: 100%;
          max-width: 100%;
          margin: 0;
          padding: 0;
          text-align: left;
          text-indent: 0;
        }
        .sl-parenthetical {
          margin-top: 0.08em;
          font-size: 0.62em;
          font-weight: 650;
          line-height: 1.16;
          opacity: 0.82;
        }
        .sl-parenthesis {
          display: inline-block;
          font-weight: 650;
        }
        .sl-line.sl-plain { display: block; }
        .sl-line.sl-not-sung { opacity: 0.51; }
        .sl-line.sl-sung { opacity: 0.497; }
        .sl-line.sl-active { opacity: 1; --BlurAmount: 0px !important; }
        .sl-line.sl-transition-hold {
          opacity: 1;
          --BlurAmount: 0px !important;
        }
        .sl-line:hover { opacity: 1 !important; filter: blur(0px) !important; }
        .sl-motion-animated.sl-format-line .sl-line:not(.sl-active) {
          transform: translate3d(0, 0.04em, 0);
        }
        .sl-motion-animated.sl-format-line .sl-line.sl-active {
          transform: translate3d(0, -0.035em, 0);
        }
        .sl-motion-static .sl-line {
          filter: none !important;
          transform: none !important;
          transition: opacity 0.12s linear;
        }
        .sl-motion-static .sl-line.sl-not-sung { opacity: 0.42; }
        .sl-motion-static .sl-line.sl-sung { opacity: 0.5; }
        .sl-motion-static .sl-line.sl-active { opacity: 1; }
        .sl-motion-static .sl-word {
          scale: 1 !important;
          transform: none !important;
          text-shadow: none !important;
        }
        .sl-format-letters .sl-line {
          transition:
            opacity 0.24s cubic-bezier(0.61, 1, 0.88, 1),
            filter 0.24s ease,
            transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sl-format-letters .sl-word {
          --SLM_GradientPosition: -50%;
          --gradient-position: var(--SLM_GradientPosition, -50%);
          --gradient-offset: 30%;
          --gradient-alpha: 1;
          --gradient-alpha-end: 0.3;
          --gradient-degrees: 90deg;
        }

        /* Musical line (dots) */
        .sl-musical-line {
          margin: 0 !important;
          line-height: 0 !important;
          z-index: -1;
          align-items: center;
        }
        .sl-musical-line.sl-active {
          line-height: var(--sl-size) !important;
          margin: clamp(0.2rem, 1cqw, 0.6rem) 0 !important;
        }
        .sl-dot-group {
          display: flex;
          flex-direction: row;
          gap: clamp(0.005rem, 1.7cqw, 0.18rem);
          align-items: center;
          height: 0;
          overflow: hidden;
          transition: height 0.2s ease;
        }
        .sl-musical-line.sl-active .sl-dot-group {
          height: calc(var(--sl-size) * 1.3);
        }
        .sl-dot {
          --sl-size: clamp(1.85rem, 5cqw, 3.5rem);
          font-size: calc(var(--sl-size) * 1.3);
          display: inline-block;
          opacity: 0.35;
          scale: 0.75;
          color: white;
          -webkit-text-fill-color: white;
          text-shadow: 0 0 var(--text-shadow-blur, 4px) rgba(255,255,255,var(--text-shadow-opacity, 0%));
          will-change: transform, scale, opacity;
          transform-origin: center center;
        }

        /* Words */
        .sl-word {
          display: inline-block;
          font-weight: 700;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          -webkit-background-clip: text;
          --gradient-position: -20%;
          --gradient-offset: 0%;
          --gradient-alpha: 0.85;
          --gradient-alpha-end: 0.35;
          --gradient-degrees: 180deg;
          --text-shadow-opacity: 0%;
          --text-shadow-blur: 4px;
          background-image: linear-gradient(
            var(--gradient-degrees),
            rgba(255,255,255,var(--gradient-alpha)) var(--gradient-position),
            rgba(255,255,255,var(--gradient-alpha-end)) calc(var(--gradient-position) + 20% + var(--gradient-offset))
          );
          text-shadow: 0 0 var(--text-shadow-blur) rgba(255,255,255,var(--text-shadow-opacity));
          transform-origin: center center;
          will-change: transform, scale;
        }
        .sl-primary > .sl-word:first-child,
        .sl-parenthetical > .sl-word:first-child {
          transform-origin: left center;
        }
        .sl-motion-static .sl-line.sl-active .sl-word {
          --gradient-position: 100% !important;
        }
        .sl-line.sl-not-sung .sl-word {
          --gradient-position: -20% !important;
          --text-shadow-opacity: 0% !important;
        }
        .sl-format-letters .sl-line.sl-not-sung .sl-word {
          --gradient-position: -50% !important;
        }
        .sl-line.sl-sung .sl-word { --gradient-position: 100% !important; }
        .sl-space { display: inline-block; width: 0.25em; }
        .sl-credits {
          width: min(100%, 980px);
          margin-top: clamp(5rem, 13vh, 9rem);
          padding: clamp(1.8rem, 3vh, 2.6rem) 0 clamp(9rem, 30vh, 20rem);
          border-top: 1px solid rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.62);
          font-size: clamp(1rem, 1.5cqw, 1.35rem);
          font-weight: 750;
          line-height: 1.42;
        }
        .sl-credit-line + .sl-credit-line {
          margin-top: 0.5rem;
        }
        .sl-credit-writers {
          color: rgba(255,255,255,0.72);
          font-size: clamp(1.2rem, 1.9cqw, 1.7rem);
          font-weight: 900;
        }
      `}</style>

      <div
        className={`sl-container sl-motion-${lyricsMotion} sl-format-${animationFormat}`}
        ref={containerRef}
      >
        <div className="sl-scroll" ref={scrollRef} />
      </div>
    </div>
  );
}
