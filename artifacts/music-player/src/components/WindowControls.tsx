
import React, { ReactNode, useState, useRef, useEffect } from "react";
import { Minus, Square, X, Copy } from "lucide-react";

// ── Controles de ventana para Tauri ────────────────────────
function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindowRef = useRef<any>(null);

  useEffect(() => {
    // Intentar cargar la API de Tauri directamente
    import("@tauri-apps/api/window")
      .then((mod) => {
        const appWindow = mod.getCurrentWindow();
        appWindowRef.current = appWindow;
        // Obtener estado inicial
        appWindow.isMaximized().then(setIsMaximized);
        // Escuchar cambios
        appWindow.onResized(() => {
          appWindow.isMaximized().then(setIsMaximized);
        });
        console.log("✅ API de Tauri cargada, controles activos.");
      })
      .catch((err) => {
        console.log("ℹ️ No se pudo cargar la API de Tauri:", err.message);
      });
  }, []);

  const handleMinimize = () => appWindowRef.current?.minimize();
  const handleMaximize = () => appWindowRef.current?.toggleMaximize();
  const handleClose = () => appWindowRef.current?.close();

  const btnClass =
    "h-7 w-7 flex items-center justify-center rounded-full text-white hover:bg-white/20 transition-all";

  return (
    <div className="flex items-center gap-1">
      <button onClick={handleMinimize} className={btnClass} title="Minimizar">
        <Minus className="w-4 h-4" />
      </button>
      <button
        onClick={handleMaximize}
        className={btnClass}
        title={isMaximized ? "Restaurar" : "Maximizar"}
      >
        {isMaximized ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={handleClose}
        className={`${btnClass} hover:bg-red-500/70`}
        title="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

