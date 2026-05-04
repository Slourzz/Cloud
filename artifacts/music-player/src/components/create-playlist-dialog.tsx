import React, { useState, useRef } from "react";
import { usePlaylists, Playlist, COVER_TEMPLATES, SortBy, getPlaylistCoverStyle } from "@/hooks/use-playlists";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Check, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatePlaylistDialogProps {
  open: boolean;
  onClose: () => void;
  editPlaylist?: Playlist;
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "newest", label: "Más reciente" },
  { value: "az", label: "A-Z" },
  { value: "artist", label: "Por artista" },
];

export function CreatePlaylistDialog({ open, onClose, editPlaylist }: CreatePlaylistDialogProps) {
  const { createPlaylist, updatePlaylist } = usePlaylists();

  const [title, setTitle] = useState(editPlaylist?.title ?? "Mi playlist");
  const [coverTemplate, setCoverTemplate] = useState(editPlaylist?.coverTemplate ?? "tpl-purple");
  const [customCoverUrl, setCustomCoverUrl] = useState<string | undefined>(editPlaylist?.customCoverUrl);
  const [sortBy, setSortBy] = useState<SortBy>(editPlaylist?.sortBy ?? "newest");
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCustomCoverUrl(url);
    setCoverTemplate("custom");
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    if (editPlaylist) {
      updatePlaylist(editPlaylist.id, { title: title.trim(), coverTemplate, customCoverUrl, sortBy });
    } else {
      createPlaylist({ title: title.trim(), coverTemplate, customCoverUrl, songIds: [], sortBy });
    }
    onClose();
  };

  const previewStyle = customCoverUrl
    ? { backgroundImage: `url(${customCoverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: COVER_TEMPLATES.find((t) => t.id === coverTemplate)?.bg ?? COVER_TEMPLATES[0].bg };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-md border border-outline-variant/30"
        style={{ background: "hsl(var(--surface))", color: "hsl(var(--on-surface))" }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {editPlaylist ? "Editar playlist" : "Nueva playlist"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Preview + Title */}
          <div className="flex items-center gap-4">
            <div
              className="w-20 h-20 rounded-2xl shrink-0 flex items-center justify-center"
              style={previewStyle}
            >
              {!customCoverUrl && !coverTemplate.startsWith("tpl") && (
                <Music2 className="w-8 h-8 text-white/60" />
              )}
            </div>
            <div className="flex-1">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent border-0 border-b-2 border-outline-variant text-on-surface font-bold text-xl focus:outline-none focus:border-primary pb-1 transition-colors"
                placeholder="Nombre de la playlist"
                autoFocus
              />
              <p className="text-xs text-on-surface-variant mt-1">{title.trim().length}/50 caracteres</p>
            </div>
          </div>

          {/* Cover Templates */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              Portada
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {COVER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => { setCoverTemplate(tpl.id); setCustomCoverUrl(undefined); }}
                  className={cn(
                    "relative aspect-square rounded-2xl overflow-hidden transition-all",
                    coverTemplate === tpl.id && !customCoverUrl ? "ring-2 ring-primary ring-offset-2 ring-offset-surface scale-95" : "hover:scale-95"
                  )}
                  style={{ background: tpl.bg }}
                  title={tpl.label}
                >
                  {coverTemplate === tpl.id && !customCoverUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  )}
                </button>
              ))}
              {/* Custom image upload */}
              <label
                className={cn(
                  "aspect-square rounded-2xl flex items-center justify-center cursor-pointer border-2 border-dashed transition-all",
                  customCoverUrl
                    ? "border-primary"
                    : "border-outline-variant hover:border-primary/60"
                )}
                style={customCoverUrl ? { backgroundImage: `url(${customCoverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
              >
                {!customCoverUrl && <Upload className="w-5 h-5 text-on-surface-variant" />}
                {customCoverUrl && (
                  <div className="w-full h-full flex items-center justify-center bg-black/30 rounded-2xl">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
            </div>
          </section>

          {/* Sort order */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
              Ordenar canciones por
            </h3>
            <div className="flex gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-2xl text-sm font-semibold transition-all",
                    sortBy === opt.value
                      ? "bg-primary-container text-on-primary-container"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-surface-container text-on-surface-variant hover:text-on-surface font-semibold text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim()}
              className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40"
            >
              {editPlaylist ? "Guardar" : "Crear playlist"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
