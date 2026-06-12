import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

const CACHE_KEY_PREFIX = 'artist_img_';

function getFromLocalStorage(artist: string): string | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY_PREFIX + artist);
    if (cached) {
      const { url, timestamp } = JSON.parse(cached);
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - timestamp < THIRTY_DAYS) {
        console.log('📦 Cargada desde localStorage:', artist);
        return url;
      }
      localStorage.removeItem(CACHE_KEY_PREFIX + artist);
    }
  } catch {}
  return null;
}

function saveToLocalStorage(artist: string, url: string) {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + artist, JSON.stringify({ url, timestamp: Date.now() }));
  } catch {}
}

async function getFromDisk(artist: string): Promise<string | null> {
  try {
    const url = await invoke<string>('get_cached_artist_image', { artist });
    if (url) {
      console.log('💾 Cargada desde disco:', artist);
      return url;
    }
  } catch (e) {
    console.warn('⚠️ Error al cargar desde disco:', e);
  }
  return null;
}

async function saveToDisk(artist: string, url: string) {
  try {
    await invoke('cache_artist_image', { artist, imageUrl: url });
    console.log('💾 Guardada en disco:', artist);
  } catch (e) {
    console.warn('⚠️ Error al guardar en disco:', e);
  }
}

export function useArtistImage(artist: string, fallback?: string | null) {
  const [image, setImage] = useState<string | null>(fallback || null);

  useEffect(() => {
    if (!artist) return;

    let cancelled = false;

    const loadImage = async () => {
      // 1. Intentar desde disco (más persistente)
      const diskUrl = await getFromDisk(artist);
      if (!cancelled && diskUrl) {
        setImage(diskUrl);
        // También guardar en localStorage por redundancia
        saveToLocalStorage(artist, diskUrl);
        return;
      }

      // 2. Intentar desde localStorage
      const localUrl = getFromLocalStorage(artist);
      if (!cancelled && localUrl) {
        setImage(localUrl);
        // Guardar en disco para futuras sesiones
        await saveToDisk(artist, localUrl);
        return;
      }

      // 3. Si hay fallback (portada de canción), mostrarlo mientras buscamos
      if (fallback && !cancelled) {
        setImage(fallback);
      }

      // 4. Buscar nueva imagen desde las APIs (a través del backend)
      try {
        console.log('🔍 Buscando nueva imagen para:', artist);
        const newUrl = await invoke<string>('fetch_artist_image', { artist });
        if (!cancelled && newUrl) {
          setImage(newUrl);
          // Guardar en ambos cachés
          saveToLocalStorage(artist, newUrl);
          await saveToDisk(artist, newUrl);
        }
      } catch (err) {
        console.warn('❌ No se pudo obtener imagen para:', artist, err);
        if (!cancelled && !image && fallback) setImage(fallback);
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [artist]);

  return image;
}