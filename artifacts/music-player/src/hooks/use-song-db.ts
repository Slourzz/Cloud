const DB_NAME = "cloud-music-db";
const DB_VERSION = 1;
const STORE = "songs";

export interface DBSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  audioData: ArrayBuffer;
  audioMime: string;
  coverData: ArrayBuffer | null;
  coverMime: string | null;
  coverExtUrl: string | null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbSaveSong(song: DBSong): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(song);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbGetAllSongs(): Promise<DBSong[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as DBSong[]);
    req.onerror = () => reject(req.error);
  });
}

export async function dbUpdateCover(
  id: string,
  coverData: ArrayBuffer,
  coverMime: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const song = req.result as DBSong | undefined;
      if (!song) { reject(new Error("Song not found")); return; }
      store.put({ ...song, coverData, coverMime, coverExtUrl: null });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbUpdateExtCoverUrl(id: string, url: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => {
      const song = req.result as DBSong | undefined;
      if (!song) { resolve(); return; }
      if (!song.coverData) {
        store.put({ ...song, coverExtUrl: url });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbDeleteSong(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
