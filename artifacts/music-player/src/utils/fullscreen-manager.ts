/**
 * Fullscreen Manager - Inspirado en Spicy Lyrics
 * Manejo de pantalla completa con auto-hide de controles
 */

import { GlobalEventBus, EVENTS } from "@/utils/global";

interface FullscreenState {
  isOpen: boolean;
  isAutoHiding: boolean;
  lastMouseMoveTime: number;
}

class FullscreenManager {
  private state: FullscreenState = {
    isOpen: false,
    isAutoHiding: false,
    lastMouseMoveTime: Date.now(),
  };

  private hideControlsTimeout: NodeJS.Timeout | null = null;
  private abortController: AbortController | null = null;
  private autoHideDelay = 3000; // 3 segundos

  get isOpen(): boolean {
    return this.state.isOpen;
  }

  async open(): Promise<void> {
    if (this.state.isOpen) return;

    this.state.isOpen = true;
    this.setupEventListeners();

    // Intenta entrar a fullscreen del documento
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      }
    } catch (error) {
      console.warn("Could not request fullscreen:", error);
    }

    GlobalEventBus.emit(EVENTS.FULLSCREEN_OPEN, null);
    this.showControls();
  }

  close(): void {
    if (!this.state.isOpen) return;

    this.state.isOpen = false;
    this.cleanupEventListeners();

    // Salir de fullscreen del documento
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }

    GlobalEventBus.emit(EVENTS.FULLSCREEN_CLOSE, null);
    this.showControls();
  }

  toggle(): void {
    if (this.state.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private setupEventListeners(): void {
    // Crear AbortController para cleanup
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // Mouse move tracking para auto-hide
    document.addEventListener(
      "mousemove",
      () => this.onMouseMove(),
      { signal }
    );

    // Mouse leave de fullscreen container
    document.addEventListener(
      "mouseleave",
      () => this.onMouseLeave(),
      { signal }
    );

    // Escape key
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "F11" || e.code === "F11") {
          e.preventDefault();
          this.close();
        }
      },
      { signal }
    );

    this.scheduleControlsHide();
  }

  private cleanupEventListeners(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.hideControlsTimeout) {
      clearTimeout(this.hideControlsTimeout);
      this.hideControlsTimeout = null;
    }
  }

  private onMouseMove(): void {
    this.state.lastMouseMoveTime = Date.now();
    this.showControls();
    this.scheduleControlsHide();
  }

  private onMouseLeave(): void {
    this.scheduleControlsHide();
  }

  private showControls(): void {
    this.state.isAutoHiding = false;
    GlobalEventBus.emit(EVENTS.CONTROLS_SHOW, null);

    if (this.hideControlsTimeout) {
      clearTimeout(this.hideControlsTimeout);
    }
  }

  private hideControls(): void {
    if (!this.state.isOpen) return;

    this.state.isAutoHiding = true;
    GlobalEventBus.emit(EVENTS.CONTROLS_HIDE, null);
  }

  private scheduleControlsHide(): void {
    if (this.hideControlsTimeout) {
      clearTimeout(this.hideControlsTimeout);
    }

    this.hideControlsTimeout = setTimeout(
      () => this.hideControls(),
      this.autoHideDelay
    );
  }

  destroy(): void {
    this.close();
  }
}

// Singleton
export const FullscreenManager = new FullscreenManager();
