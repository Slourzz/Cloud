/**
 * Keyboard Manager - Manejo de atajos de teclado
 * Inspirado en Spicetify.Keyboard
 */

import { GlobalEventBus, EVENTS } from "@/utils/global";
import { FullscreenManager } from "@/utils/fullscreen-manager";

export interface KeyboardShortcut {
  keys: string[];
  description: string;
  handler: (event: KeyboardEvent) => void;
  modifier?: "ctrl" | "alt" | "shift" | "meta";
}

class KeyboardManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private isListening = false;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  registerShortcut(
    keys: string[],
    description: string,
    handler: (event: KeyboardEvent) => void,
    modifier?: "ctrl" | "alt" | "shift" | "meta"
  ): void {
    const key = this.getShortcutKey(keys, modifier);
    this.shortcuts.set(key, {
      keys,
      description,
      handler,
      modifier,
    });

    if (!this.isListening) {
      this.startListening();
    }
  }

  unregisterShortcut(
    keys: string[],
    modifier?: "ctrl" | "alt" | "shift" | "meta"
  ): void {
    const key = this.getShortcutKey(keys, modifier);
    this.shortcuts.delete(key);
  }

  private startListening(): void {
    if (this.isListening) return;

    this.isListening = true;
    window.addEventListener("keydown", this.handleKeyDown);
  }

  private stopListening(): void {
    if (!this.isListening) return;

    this.isListening = false;
    window.removeEventListener("keydown", this.handleKeyDown);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    const modifierKey =
      event.ctrlKey || event.metaKey
        ? "ctrl"
        : event.altKey
          ? "alt"
          : event.shiftKey
            ? "shift"
            : undefined;

    // Shortcuts especiales (sin modifiers)
    if (event.key === "F11" || event.code === "F11") {
      event.preventDefault();
      FullscreenManager.toggle();
      return;
    }

    // Buscar shortcuts registrados
    for (const [, shortcut] of this.shortcuts) {
      if (
        shortcut.keys.includes(event.key.toLowerCase()) &&
        shortcut.modifier === modifierKey
      ) {
        event.preventDefault();
        shortcut.handler(event);
        GlobalEventBus.emit(EVENTS.KEYBOARD_SHORTCUT, {
          keys: shortcut.keys,
          description: shortcut.description,
        });
        break;
      }
    }
  }

  private getShortcutKey(
    keys: string[],
    modifier?: "ctrl" | "alt" | "shift" | "meta"
  ): string {
    return `${modifier || "none"}:${keys.join("+")}`;
  }

  destroy(): void {
    this.stopListening();
    this.shortcuts.clear();
  }
}

// Singleton
export const KeyboardManager = new KeyboardManager();

// Registrar shortcuts por defecto
export function initializeDefaultShortcuts(): void {
  KeyboardManager.registerShortcut(
    ["f"],
    "Toggle fullscreen",
    () => {
      FullscreenManager.toggle();
    },
    "alt"
  );
}
