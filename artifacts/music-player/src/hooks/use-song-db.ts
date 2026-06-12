const DB_NAME = "cloud-player-db";
const DB_VERSION = 1;
const STORE_NAME = "songs";

export interface SongDB {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre?: string;
  duration: number;
  audioData: ArrayBuffer;
  audioMime: string;
  coverData: ArrayBuffer | null;
  coverMime: string | null;
  coverExtUrl: string | null;
}

function openMusicDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function dbSaveSong(song: SongDB): Promise<void> {
  const db = await openMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(song);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbGetAllSongs(): Promise<SongDB[]> {
  const db = await openMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result || []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function dbGetSongCount(): Promise<number> {
  const db = await openMusicDB();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .count();
    request.onsuccess = () => {
      db.close();
      resolve(request.result);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function dbClearAllSongs(): Promise<void> {
  const db = await openMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function dbGetSongById(id: string): Promise<SongDB | undefined> {
  const db = await openMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbUpdateCover(
  songId: string,
  coverData: ArrayBuffer,
  coverMime: string,
): Promise<void> {
  const db = await openMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(songId);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (existing) {
        existing.coverData = coverData;
        existing.coverMime = coverMime;
        store.put(existing);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbUpdateExtCoverUrl(
  songId: string,
  coverExtUrl: string,
): Promise<void> {
  const db = await openMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(songId);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (existing) {
        existing.coverExtUrl = coverExtUrl;
        store.put(existing);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbDeleteSong(id: string): Promise<void> {
  const db = await openMusicDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
