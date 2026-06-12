import { useEffect, useState } from "react";
import { X, GripVertical, Trash2, Music2 } from "lucide-react";
import { useMusicPlayer, Song } from "@/hooks/use-music-player";

interface QueuePanelProps {
  open: boolean;
  onClose: () => void;
}

export function QueuePanel({ open, onClose }: QueuePanelProps) {
  const { queue, play, removeFromQueue, reorderQueue } = useMusicPlayer();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false); // 👈 nuevo

  // Estados para animación de entrada/salida
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShow(true);
        });
      });
    } else {
      setShow(false);
      const timeout = setTimeout(() => {
        setMounted(false);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [open]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const handleDragStart = (e: React.DragEvent, songId: string, index: number) => {
    e.stopPropagation(); // 👈 evita que se active el onClick del padre
    e.dataTransfer.setData("text/plain", songId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(songId);
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedId && queue[index]?.id !== draggedId) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedId && queue[targetIndex]?.id !== draggedId) {
      const newQueue = [...queue];
      const draggedIndex = newQueue.findIndex(s => s.id === draggedId);
      if (draggedIndex !== -1) {
        const [removed] = newQueue.splice(draggedIndex, 1);
        newQueue.splice(targetIndex, 0, removed);
        if (reorderQueue) reorderQueue(newQueue);
      }
    }
    setDraggedId(null);
    setDragOverIndex(null);
    setIsDragging(false);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverIndex(null);
    setIsDragging(false);
  };

  const handlePlay = (song: Song) => {
    if (!isDragging) { // 👈 solo reproduce si no se está arrastrando
      play(song);
      onClose();
    }
  };

  const handleRemove = (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (removeFromQueue) removeFromQueue(songId);
  };

  // Estilos Liquid Glass
  const glassPanel = {
    background: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(20px)',
    borderLeft: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2)',
  };

  return (
    <>
      {/* Overlay con fade */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          show ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Panel lateral con deslizamiento */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-80 flex flex-col transform transition-transform duration-300 ease-out ${
          show ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={glassPanel}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/20 pt-8">
          <h2 className="text-lg font-semibold text-white">Cola de reproducción</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lista de canciones */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {queue.length === 0 ? (
            <p className="text-center text-white/50 py-8 text-sm">
              No hay canciones en la cola
            </p>
          ) : (
            queue.map((song, index) => (
              <div
                key={song.id}
                className={`flex items-center gap-3 p-2 rounded-xl transition-all group ${
                  dragOverIndex === index ? "bg-white/20" : "hover:bg-white/10"
                }`}
                onClick={() => handlePlay(song)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
              >
                {/* Manija de arrastre (siempre visible, arrastrable) */}
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, song.id, index)}
                  onDragEnd={handleDragEnd}
                  className="cursor-grab active:cursor-grabbing text-white/60 hover:text-white shrink-0"
                  title="Arrastrar para reordenar"
                >
                  <GripVertical className="w-4 h-4" />
                </div>

                {/* Miniatura */}
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                  {song.coverUrl && !song.coverUrl.startsWith('/album') ? (
                    <img src={song.coverUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <Music2 className="w-5 h-5 m-auto mt-2.5 text-white/60" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{song.title}</p>
                  <p className="text-xs text-white/70 truncate">{song.artist}</p>
                </div>

                {/* Botón eliminar */}
                <button
                  onClick={(e) => handleRemove(song.id, e)}
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-500/20 hover:text-red-300 transition shrink-0"
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Pie */}
        <div className="p-3 border-t border-white/20">
          <p className="text-[10px] text-white/50 text-center">
            Arrastra los puntos para reordenar
          </p>
        </div>
      </div>
    </>
  );
}
