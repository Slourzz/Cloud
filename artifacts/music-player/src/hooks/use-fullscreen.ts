/**
 * useFullscreen Hook
 * Integración con FullscreenManager
 */

import { useEffect, useState } from "react";
import { FullscreenManager } from "@/utils/fullscreen-manager";
import { GlobalEventBus, EVENTS } from "@/utils/global";

export function useFullscreen() {
  const [isOpen, setIsOpen] = useState(FullscreenManager.isOpen);
  const [isAutoHiding, setIsAutoHiding] = useState(false);

  useEffect(() => {
    const unsubOpen = GlobalEventBus.on(EVENTS.FULLSCREEN_OPEN, () => {
      setIsOpen(true);
    });

    const unsubClose = GlobalEventBus.on(EVENTS.FULLSCREEN_CLOSE, () => {
      setIsOpen(false);
    });

    const unsubShowControls = GlobalEventBus.on(EVENTS.CONTROLS_SHOW, () => {
      setIsAutoHiding(false);
    });

    const unsubHideControls = GlobalEventBus.on(EVENTS.CONTROLS_HIDE, () => {
      setIsAutoHiding(true);
    });

    return () => {
      unsubOpen();
      unsubClose();
      unsubShowControls();
      unsubHideControls();
    };
  }, []);

  return {
    isOpen,
    isAutoHiding,
    open: () => FullscreenManager.open(),
    close: () => FullscreenManager.close(),
    toggle: () => FullscreenManager.toggle(),
  };
}
