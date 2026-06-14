import React from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  LyricsDisplayCore,
  type LyricsDisplayCoreProps,
} from "@/components/lyrics-display";
import type { LyricLine, LyricsCredits } from "@/hooks/use-lyrics";

type CastLyricsPayload = {
  lines: LyricLine[];
  songId?: string;
  revision?: number;
  isPaused: boolean;
  interfaceTheme: "crystalized" | "simplyui";
  lyricMotion: "animated" | "static";
  lyricFormat: "line" | "letters" | "line-words";
  credits?: LyricsCredits;
};

declare global {
  interface Window {
    CloudLyricsDisplay?: {
      render: (element: HTMLElement, payload: CastLyricsPayload) => void;
      clear: () => void;
    };
    __cloudCastPlaybackTime?: () => number;
  }
}

let root: Root | null = null;
let mountedElement: HTMLElement | null = null;
let lastRenderSignature = "";

const getCastPlaybackTime = () => window.__cloudCastPlaybackTime?.() ?? 0;
const ignoreCastSeek = () => {};

function ensureRoot(element: HTMLElement) {
  if (root && mountedElement === element) return root;
  root?.unmount();
  mountedElement = element;
  root = createRoot(element);
  return root;
}

window.CloudLyricsDisplay = {
  render(element, payload) {
    const renderSignature = JSON.stringify({
      songId: payload.songId,
      revision: payload.revision,
      isPaused: payload.isPaused,
      interfaceTheme: payload.interfaceTheme,
      lyricMotion: payload.lyricMotion,
      lyricFormat: payload.lyricFormat,
      lineCount: payload.lines.length,
      firstLine: payload.lines[0]?.begin,
      lastLine: payload.lines.at(-1)?.end,
    });

    if (mountedElement === element && lastRenderSignature === renderSignature) {
      return;
    }
    lastRenderSignature = renderSignature;

    const commonProps = {
      lines: payload.lines,
      currentTime: getCastPlaybackTime(),
      source: "ttml" as const,
      isPaused: payload.isPaused,
      coverUrl: undefined,
      credits: payload.credits,
      songId: payload.songId,
      getPlaybackTime: getCastPlaybackTime,
      seekTo: ignoreCastSeek,
      isSimplyUI: payload.interfaceTheme === "simplyui",
    };
    const activeMode =
      payload.lyricMotion === "static" ? "static" : payload.lyricFormat;
    const modes: Array<{
      id: "static" | "line" | "letters" | "line-words";
      motion: LyricsDisplayCoreProps["lyricsMotion"];
      format: LyricsDisplayCoreProps["animationFormat"];
    }> = [
      { id: "static", motion: "static", format: "line" },
      { id: "line", motion: "animated", format: "line" },
      { id: "letters", motion: "animated", format: "letters" },
      { id: "line-words", motion: "animated", format: "line-words" },
    ];

    ensureRoot(element).render(
      <div className="cloud-cast-lyrics-deck">
        {modes.map((mode) => (
          <div
            className={`cloud-cast-lyrics-pane ${
              mode.id === activeMode ? "is-active" : ""
            }`}
            key={`${payload.songId ?? "song"}-${mode.id}`}
          >
            <LyricsDisplayCore
              {...commonProps}
              lyricsMotion={mode.motion}
              animationFormat={mode.format}
              active={mode.id === activeMode}
            />
          </div>
        ))}
      </div>,
    );
  },
  clear() {
    lastRenderSignature = "";
    root?.render(null);
  },
};

const style = document.createElement("style");
style.textContent = `
  .cloud-cast-lyrics-deck,
  .cloud-cast-lyrics-pane {
    width: 100%;
    height: 100%;
  }

  .cloud-cast-lyrics-deck {
    position: relative;
    overflow: hidden;
  }

  .cloud-cast-lyrics-pane {
    position: absolute;
    inset: 0;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translate3d(0, 10px, 0);
    transition:
      opacity 220ms ease,
      transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
      visibility 0s linear 260ms;
  }

  .cloud-cast-lyrics-pane.is-active {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translate3d(0, 0, 0);
    transition-delay: 0s;
  }
`;
document.head.appendChild(style);

window.dispatchEvent(new Event("cloud-lyrics-display-ready"));
