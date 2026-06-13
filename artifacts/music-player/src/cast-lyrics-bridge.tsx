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

    const props: LyricsDisplayCoreProps = {
      lines: payload.lines,
      currentTime: getCastPlaybackTime(),
      source: "ttml",
      isPaused: payload.isPaused,
      coverUrl: undefined,
      credits: payload.credits,
      songId: payload.songId,
      getPlaybackTime: getCastPlaybackTime,
      seekTo: ignoreCastSeek,
      isSimplyUI: payload.interfaceTheme === "simplyui",
      lyricsMotion: payload.lyricMotion,
      animationFormat: payload.lyricFormat,
    };

    ensureRoot(element).render(<LyricsDisplayCore {...props} />);
  },
  clear() {
    lastRenderSignature = "";
    root?.render(null);
  },
};

window.dispatchEvent(new Event("cloud-lyrics-display-ready"));
