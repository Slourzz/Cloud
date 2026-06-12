import { dbClearAllSongs, dbGetSongCount } from "@/hooks/use-song-db";

const CACHE_KEY_PREFIXES = ["artist_img_", "artist_bio_", "artist_color_"];

type NativeSystemStatus = {
  platform: string;
  osName: string;
  osVersion: string;
  architecture: string;
  appVersion: string;
  nativeCacheBytes: number;
  diskTotalBytes: number;
  diskAvailableBytes: number;
};

export type CloudSystemStatus = {
  online: boolean;
  runtime: string;
  platform: string;
  osName: string;
  osVersion: string;
  architecture: string;
  appVersion: string;
  songCount: number;
  storageUsed: number;
  storageQuota: number;
  cacheBytes: number;
  musicBytes: number;
  diskTotalBytes: number;
  diskAvailableBytes: number;
  diskUsedBytes: number;
  otherAppsBytes: number;
  localEntries: number;
};

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function getStringBytes(value: string) {
  return new Blob([value]).size;
}

function getLocalCacheBytes() {
  let bytes = 0;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      continue;
    }

    bytes += getStringBytes(key);
    bytes += getStringBytes(localStorage.getItem(key) ?? "");
  }

  return bytes;
}

async function getWebCacheBytes() {
  if (!("caches" in window)) return 0;

  let bytes = 0;
  const cacheNames = await caches.keys();

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      const contentLength = Number(response?.headers.get("content-length"));

      if (Number.isFinite(contentLength) && contentLength > 0) {
        bytes += contentLength;
      } else if (response) {
        bytes += (await response.clone().blob()).size;
      }
    }
  }

  return bytes;
}

async function invokeNative<T>(command: string): Promise<T | null> {
  if (!isTauriRuntime()) return null;

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(command);
  } catch (error) {
    console.warn(`No se pudo ejecutar ${command}:`, error);
    return null;
  }
}

async function getCacheBreakdown() {
  const [webBytes, nativeStatus] = await Promise.all([
    getWebCacheBytes().catch(() => 0),
    invokeNative<NativeSystemStatus>("get_system_status"),
  ]);
  const browserCacheBytes = getLocalCacheBytes() + webBytes;
  const nativeCacheBytes = nativeStatus?.nativeCacheBytes ?? 0;

  return {
    browserCacheBytes,
    nativeCacheBytes,
    totalBytes: browserCacheBytes + nativeCacheBytes,
  };
}

export async function getCloudSystemStatus(): Promise<CloudSystemStatus> {
  const [storage, songCount, cache, nativeStatus] = await Promise.all([
    navigator.storage?.estimate?.().catch(() => ({})) ?? Promise.resolve({}),
    dbGetSongCount().catch(() => 0),
    getCacheBreakdown(),
    invokeNative<NativeSystemStatus>("get_system_status"),
  ]);

  const storageUsed = storage.usage ?? 0;
  const cacheBytes = cache.totalBytes;
  const musicBytes = Math.max(0, storageUsed - cache.browserCacheBytes);
  const diskTotalBytes = nativeStatus?.diskTotalBytes ?? 0;
  const diskAvailableBytes = nativeStatus?.diskAvailableBytes ?? 0;
  const diskUsedBytes = Math.max(0, diskTotalBytes - diskAvailableBytes);
  const otherAppsBytes = Math.max(0, diskUsedBytes - musicBytes - cacheBytes);

  return {
    online: navigator.onLine,
    runtime: isTauriRuntime() ? "Tauri 2" : "Navegador",
    platform: nativeStatus?.platform ?? navigator.platform ?? "Desconocido",
    osName: nativeStatus?.osName ?? "Windows",
    osVersion: nativeStatus?.osVersion ?? "Web",
    architecture: nativeStatus?.architecture ?? "Web",
    appVersion: nativeStatus?.appVersion ?? "2.0.0",
    songCount,
    storageUsed,
    storageQuota: storage.quota ?? 0,
    cacheBytes,
    musicBytes,
    diskTotalBytes,
    diskAvailableBytes,
    diskUsedBytes,
    otherAppsBytes,
    localEntries: localStorage.length,
  };
}

export async function clearCloudCache() {
  const bytesBefore = (await getCacheBreakdown()).totalBytes;
  const keysToRemove: string[] = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  await invokeNative<number>("clear_app_cache");

  return {
    bytesFreed: bytesBefore,
    entriesRemoved: keysToRemove.length,
  };
}

export async function clearAllCloudData() {
  await dbClearAllSongs();
  await clearCloudCache();
  localStorage.clear();
  sessionStorage.clear();
}

export function formatStorageSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** unitIndex;

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}
