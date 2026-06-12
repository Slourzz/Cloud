
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
        const appWindow = mod.appWindow;
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

  // Estilo Liquid Glass igual al del resto de la app
  const pillStyle: React.CSSProperties = {
    background: "rgba(255, 255, 255, 0.15)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
    borderRadius: "9999px",
    padding: "2px 4px",
    display: "flex",
    alignItems: "center",
    gap: "2px",
  };

  const btnStyle: React.CSSProperties = {
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.8)",
    cursor: "pointer",
    transition: "all 150ms ease",
    padding: 0,
  };

  return (
    <div style={pillStyle} data-tauri-drag-region>
      <button
        onClick={handleMinimize}
        style={btnStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        title="Minimizar"
      >
        <Minus size={16} strokeWidth={1.5} />
      </button>

      <button
        onClick={handleMaximize}
        style={btnStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        title={isMaximized ? "Restaurar" : "Maximizar"}
      >
        {isMaximized ? <Copy size={14} strokeWidth={1.5} /> : <Square size={14} strokeWidth={1.5} />}
      </button>

      <button
        onClick={handleClose}
        style={btnStyle}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.6)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        title="Cerrar"
      >
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
