import React, { createContext, useContext, useState, ReactNode } from "react";

type Lang = "es" | "en";

interface Translations {
  appName: string;
  appTagline: string;
  loading: string;
  goodMorning: string;
  goodAfternoon: string;
  goodEvening: string;
  searchPlaceholder: string;
  whatToListen: (timeOfDay: string) => string;
  yourPlaylists: string;
  noPlaylistsYet: string;
  createFirstPlaylist: string;
  featuredArtists: string;
  songs: string;
  artists: string;
  playlists: string;
  tracks: string;
  home: string;
  explore: string;
  library: string;
  liked: string;
  navigation: string;
  settings: string;
  minimize: string;
  maximize: string;
  restore: string;
  close: string;
  playbackQueue: string;
  noSongsInQueue: string;
  dragToReorder: string;
  holdAndDrag: string;
  general: string;
  audio: string;
  playback: string;
  appearance: string;
  metadata: string;
  shortcuts: string;
  advanced: string;
  about: string;
  language: string;
  startWithWindows: string;
  soundQuality: string;
  normalizeVolume: string;
  audioDevice: string;
  crossfade: string;
  gaplessPlayback: string;
  autoplay: string;
  uploadMusic: string;
  theme: string;
  blurIntensity: string;
  transparency: string;
  scanFolders: string;
  autoImport: string;
  duplicateDetection: string;
  selectSongToEdit: string;
  editingMetadataOf: string;
  name: string;
  artist: string;
  genre: string;
  album: string;
  cover: string;
  changeImage: string;
  cancel: string;
  apply: string;
  save: string;
  delete: string;
  deletePlaylist: string;
  editPlaylist: string;
  addSongs: string;
  playPause: string;
  nextTrack: string;
  previousTrack: string;
  muteRestore: string;
  sidePanel: string;
  searchShortcut: string;
  settingsShortcut: string;
  queueShortcut: string;
  navigationMenu: string;
  fullscreenPlayer: string;
  shortcutsGlobal: string;
  noSongsAvailable: string;
  metadataUpdated: string;
  metadataUnavailable: string;
  deleteSelected: (count: number) => string;
  deleteAllSongs: string;
  confirmDeleteAll: string;
  confirmDeleteSelected: (count: number) => string;
  noSongsInLibrary: string;
  nowPlaying: string;
  noLyrics: string;
  uploadTTML: string;
  uploadPlainText: string;
  searchOnline: string;
  back: string;
  closePanel: string;
  menu: string;
  cloudMusicPlayer: string;
  madeWithLove: string;
  version: string;
}

const translations: Record<Lang, Translations> = {
  es: {
    appName: "Cloud",
    appTagline: "Music Player",
    loading: "Cargando...",
    goodMorning: "Buenos días",
    goodAfternoon: "Buenas tardes",
    goodEvening: "Buenas noches",
    searchPlaceholder: "Buscar canciones, artistas o playlists...",
    whatToListen: (timeOfDay) => `¿Qué te gustaría escuchar esta ${timeOfDay}?`,
    yourPlaylists: "Tus Playlists",
    noPlaylistsYet: "Aún no tienes playlists",
    createFirstPlaylist: "Crear primera playlist",
    featuredArtists: "Artistas destacados",
    songs: "Canciones",
    artists: "Artistas",
    playlists: "Playlists",
    tracks: "canciones",
    home: "Inicio",
    explore: "Explorar",
    library: "Biblioteca",
    liked: "Me gusta",
    navigation: "Navegación",
    settings: "Ajustes",
    minimize: "Minimizar",
    maximize: "Maximizar",
    restore: "Restaurar",
    close: "Cerrar",
    playbackQueue: "Cola de reproducción",
    noSongsInQueue: "No hay canciones en la cola",
    dragToReorder: "Arrastra los puntos para reordenar",
    holdAndDrag: "Mantén presionado los puntos y arrastra para reordenar",
    general: "General",
    audio: "Audio",
    playback: "Reproducción",
    appearance: "Apariencia",
    metadata: "Metadatos",
    shortcuts: "Atajos",
    advanced: "Avanzado",
    about: "Acerca de",
    language: "Idioma",
    startWithWindows: "Iniciar con Windows",
    soundQuality: "Calidad de sonido",
    normalizeVolume: "Normalizar volumen",
    audioDevice: "Dispositivo de audio",
    crossfade: "Crossfade",
    gaplessPlayback: "Reproducción sin pausas",
    autoplay: "Autoplay",
    uploadMusic: "Subir música (MP3, FLAC, etc.)",
    theme: "Tema",
    blurIntensity: "Intensidad de blur",
    transparency: "Transparencia",
    scanFolders: "Escanear carpetas en busca de música",
    autoImport: "Importación automática",
    duplicateDetection: "Detección de duplicados",
    selectSongToEdit: "Selecciona una canción para editarla",
    editingMetadataOf: "Editando metadatos de",
    name: "Nombre",
    artist: "Artista",
    genre: "Género",
    album: "Álbum",
    cover: "Portada",
    changeImage: "Cambiar imagen",
    cancel: "Cancelar",
    apply: "Aplicar",
    save: "Guardar",
    delete: "Eliminar",
    deletePlaylist: "Eliminar playlist",
    editPlaylist: "Editar playlist",
    addSongs: "Añadir canciones",
    playPause: "Reproducir / Pausa",
    nextTrack: "Siguiente canción",
    previousTrack: "Anterior canción",
    muteRestore: "Silenciar / Restaurar",
    sidePanel: "Panel lateral (Sidebar)",
    searchShortcut: "Búsqueda (solo en Inicio)",
    settingsShortcut: "Ajustes",
    queueShortcut: "Cola de reproducción",
    navigationMenu: "Menú de navegación",
    fullscreenPlayer: "Reproductor completo",
    shortcutsGlobal: "Estos atajos funcionan globalmente.",
    noSongsAvailable: "No hay canciones disponibles.",
    metadataUpdated: "Metadatos actualizados correctamente.",
    metadataUnavailable: "Funcionalidad de actualización no disponible.",
    deleteSelected: (count) => `Eliminar seleccionadas (${count})`,
    deleteAllSongs: "Borrar todas las canciones",
    confirmDeleteAll: "¿Eliminar TODAS las canciones? Esta acción no se puede deshacer.",
    confirmDeleteSelected: (count) => `¿Eliminar ${count} canción(es)?`,
    noSongsInLibrary: "No hay canciones en la biblioteca.",
    nowPlaying: "Reproduciendo",
    noLyrics: "Sin letras",
    uploadTTML: "Subir TTML",
    uploadPlainText: "Subir texto plano",
    searchOnline: "Buscar en internet",
    back: "Volver",
    closePanel: "Cerrar",
    menu: "Menú",
    cloudMusicPlayer: "Cloud Music Player",
    madeWithLove: "Hecho con 💙 por Sam y Deep",
    version: "Cloud Music Player v1.0",
  },
  en: {
    appName: "Cloud",
    appTagline: "Music Player",
    loading: "Loading...",
    goodMorning: "Good morning",
    goodAfternoon: "Good afternoon",
    goodEvening: "Good evening",
    searchPlaceholder: "Search songs, artists or playlists...",
    whatToListen: (timeOfDay) => `What would you like to listen to this ${timeOfDay}?`,
    yourPlaylists: "Your Playlists",
    noPlaylistsYet: "You don't have any playlists yet",
    createFirstPlaylist: "Create your first playlist",
    featuredArtists: "Featured Artists",
    songs: "Songs",
    artists: "Artists",
    playlists: "Playlists",
    tracks: "tracks",
    home: "Home",
    explore: "Explore",
    library: "Library",
    liked: "Liked",
    navigation: "Navigation",
    settings: "Settings",
    minimize: "Minimize",
    maximize: "Maximize",
    restore: "Restore",
    close: "Close",
    playbackQueue: "Playback Queue",
    noSongsInQueue: "No songs in queue",
    dragToReorder: "Drag the dots to reorder",
    holdAndDrag: "Hold the dots and drag to reorder",
    general: "General",
    audio: "Audio",
    playback: "Playback",
    appearance: "Appearance",
    metadata: "Metadata",
    shortcuts: "Shortcuts",
    advanced: "Advanced",
    about: "About",
    language: "Language",
    startWithWindows: "Start with Windows",
    soundQuality: "Sound Quality",
    normalizeVolume: "Normalize Volume",
    audioDevice: "Audio Device",
    crossfade: "Crossfade",
    gaplessPlayback: "Gapless Playback",
    autoplay: "Autoplay",
    uploadMusic: "Upload Music (MP3, FLAC, etc.)",
    theme: "Theme",
    blurIntensity: "Blur Intensity",
    transparency: "Transparency",
    scanFolders: "Scan folders for music",
    autoImport: "Auto Import",
    duplicateDetection: "Duplicate Detection",
    selectSongToEdit: "Select a song to edit",
    editingMetadataOf: "Editing metadata of",
    name: "Name",
    artist: "Artist",
    genre: "Genre",
    album: "Album",
    cover: "Cover",
    changeImage: "Change Image",
    cancel: "Cancel",
    apply: "Apply",
    save: "Save",
    delete: "Delete",
    deletePlaylist: "Delete Playlist",
    editPlaylist: "Edit Playlist",
    addSongs: "Add Songs",
    playPause: "Play / Pause",
    nextTrack: "Next Track",
    previousTrack: "Previous Track",
    muteRestore: "Mute / Restore",
    sidePanel: "Side Panel (Sidebar)",
    searchShortcut: "Search (Home only)",
    settingsShortcut: "Settings",
    queueShortcut: "Playback Queue",
    navigationMenu: "Navigation Menu",
    fullscreenPlayer: "Fullscreen Player",
    shortcutsGlobal: "These shortcuts work globally.",
    noSongsAvailable: "No songs available.",
    metadataUpdated: "Metadata updated successfully.",
    metadataUnavailable: "Update functionality not available.",
    deleteSelected: (count) => `Delete selected (${count})`,
    deleteAllSongs: "Delete All Songs",
    confirmDeleteAll: "Delete ALL songs? This action cannot be undone.",
    confirmDeleteSelected: (count) => `Delete ${count} song(s)?`,
    noSongsInLibrary: "No songs in library.",
    nowPlaying: "Now Playing",
    noLyrics: "No Lyrics",
    uploadTTML: "Upload TTML",
    uploadPlainText: "Upload Plain Text",
    searchOnline: "Search Online",
    back: "Back",
    closePanel: "Close",
    menu: "Menu",
    cloudMusicPlayer: "Cloud Music Player",
    madeWithLove: "Made with 💙 by Sam & Deep",
    version: "Cloud Music Player v1.0",
  },
};

interface TranslationContextValue {
  t: Translations;
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const TranslationContext = createContext<TranslationContextValue>({
  t: translations.es,
  lang: "es",
  setLang: () => {},
});

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem("cloud-lang") as Lang) || "es";
  });

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem("cloud-lang", newLang);
  };

  return (
    <TranslationContext.Provider value={{ t: translations[lang], lang, setLang }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(TranslationContext);
  if (!ctx) throw new Error("useTranslation must be used within TranslationProvider");
  return ctx;
}
