import { useEffect, useMemo, useRef } from "react";
import { useAppearance } from "@/providers/appearance-provider";

export function CustomBackgroundLayer() {
  const { settings, customBackgroundUrl, customBackgroundKind } =
    useAppearance();
  const videoRef = useRef<HTMLVideoElement>(null);
  const isEnabled =
    settings.interfaceTheme !== "simplyui" &&
    (settings.backgroundTheme === "custom-background" ||
      settings.backgroundTheme === "custom-video") &&
    Boolean(customBackgroundUrl);

  const motionDuration = useMemo(
    () => Math.max(14, 72 - settings.customBackground.speed * 0.56),
    [settings.customBackground.speed],
  );

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = Math.max(
      0.35,
      Math.min(2, 0.35 + settings.customBackground.speed * 0.0165),
    );
  }, [settings.customBackground.speed, customBackgroundUrl]);

  if (!isEnabled || !customBackgroundUrl) return null;

  const mediaStyle = {
    filter: `blur(${settings.customBackground.blur}px) saturate(1.12) brightness(0.9)`,
    opacity: Math.max(
      0.18,
      Math.min(1, settings.customBackground.intensity / 100),
    ),
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#090909]">
      {customBackgroundKind === "video" ? (
        <video
          ref={videoRef}
          src={customBackgroundUrl}
          autoPlay
          muted
          loop
          playsInline
          className="cloud-custom-background-media cloud-custom-background-video h-full w-full object-cover"
          style={{
            ...mediaStyle,
            animationDuration: `${motionDuration}s`,
          }}
        />
      ) : (
        <img
          src={customBackgroundUrl}
          alt=""
          className="cloud-custom-background-media h-full w-full object-cover"
          style={{ ...mediaStyle, transform: "scale(1.04)" }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background: `rgba(5, 5, 7, ${0.18 + (100 - settings.customBackground.intensity) * 0.004})`,
        }}
      />
      <style>{`
        @keyframes cloud-custom-background-drift {
          0% { transform: scale(1.12) translate3d(-1.4%, -0.7%, 0); }
          50% { transform: scale(1.18) translate3d(1.5%, 0.9%, 0); }
          100% { transform: scale(1.12) translate3d(-1.4%, -0.7%, 0); }
        }

        .cloud-custom-background-media {
          will-change: transform, filter, opacity;
          transition:
            filter 420ms ease,
            opacity 420ms ease;
        }

        .cloud-custom-background-video {
          animation-name: cloud-custom-background-drift;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
      `}</style>
    </div>
  );
}
