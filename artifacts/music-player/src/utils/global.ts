/**
 * Global Event System - Similar a Spicy Lyrics
 * Sistema centralizado de eventos y estado global
 */

type EventCallback<T = any> = (data: T) => void;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Retornar función para desuscribirse
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  off<T = any>(event: string, callback: EventCallback<T>): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit<T = any>(event: string, data: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for "${event}":`, error);
        }
      });
    }
  }

  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Estado global con notificaciones
class GlobalState {
  private state: Record<string, any> = {};
  private eventBus = new EventBus();

  set(key: string, value: any): void {
    this.state[key] = value;
    this.eventBus.emit(`state:${key}`, value);
  }

  get<T = any>(key: string, defaultValue?: T): T {
    return this.state[key] ?? defaultValue;
  }

  on<T = any>(key: string, callback: EventCallback<T>): () => void {
    return this.eventBus.on(`state:${key}`, callback);
  }

  clear(): void {
    this.state = {};
    this.eventBus.clear();
  }
}

// Singleton global
export const GlobalEventBus = new EventBus();
export const GlobalState = new GlobalState();

// Eventos disponibles
export const EVENTS = {
  // Fullscreen
  FULLSCREEN_OPEN: "fullscreen:open",
  FULLSCREEN_CLOSE: "fullscreen:close",
  FULLSCREEN_TOGGLE: "fullscreen:toggle",

  // Playback
  PLAYBACK_CHANGE: "playback:change",
  PLAYBACK_PROGRESS: "playback:progress",
  SONG_CHANGE: "song:change",

  // UI
  CONTROLS_SHOW: "controls:show",
  CONTROLS_HIDE: "controls:hide",
  BACKGROUND_UPDATE: "background:update",

  // Keyboard
  KEYBOARD_SHORTCUT: "keyboard:shortcut",
} as const;

export type EventKey = typeof EVENTS[keyof typeof EVENTS];
