import { useEffect, useRef } from "react";
import { useLyrics } from "@/hooks/use-lyrics";
import { useMusicPlayer } from "@/hooks/use-music-player";

const TTML_API_BASE = "https://cloud-production-4b12.up.railway.app/api/ttml";
const LISTEN_THRESHOLD_MS = 10_000;

function createAnonymousPlayId() {
  return crypto.randomUUID().replaceAll("-", "");
}

export function TtmlPlayTracker() {
  const { currentSong, isPlaying } = useMusicPlayer();
  const { getLyrics } = useLyrics();
  const lyrics = currentSong ? getLyrics(currentSong.id) : null;
  const submissionId = lyrics?.cloudApproved
    ? lyrics.cloudSubmissionId
    : undefined;
  const activeKey = currentSong && submissionId
    ? `${currentSong.id}:${submissionId}`
    : "";
  const activeKeyRef = useRef("");
  const listenedMsRef = useRef(0);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (activeKeyRef.current === activeKey) return;
    activeKeyRef.current = activeKey;
    listenedMsRef.current = 0;
    recordedRef.current = false;
  }, [activeKey]);

  useEffect(() => {
    if (!activeKey || !submissionId || !isPlaying || recordedRef.current) {
      return;
    }

    const startedAt = performance.now();
    const timer = window.setTimeout(() => {
      listenedMsRef.current += performance.now() - startedAt;
      if (listenedMsRef.current < LISTEN_THRESHOLD_MS || recordedRef.current) {
        return;
      }
      recordedRef.current = true;
      void fetch(`${TTML_API_BASE}/${encodeURIComponent(submissionId)}/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playId: createAnonymousPlayId() }),
      }).catch(() => {
        recordedRef.current = false;
      });
    }, Math.max(0, LISTEN_THRESHOLD_MS - listenedMsRef.current));

    return () => {
      window.clearTimeout(timer);
      listenedMsRef.current += performance.now() - startedAt;
    };
  }, [activeKey, isPlaying, submissionId]);

  return null;
}
