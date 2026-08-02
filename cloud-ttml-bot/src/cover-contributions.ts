import type { SongPayload } from "./submission-store.js";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export const DEFAULT_COVER_MAX_BYTES = 8 * 1024 * 1024;
export const DEFAULT_COVER_MIN_DIMENSION = 500;

export type ContributionTitlePair = {
  part1: string;
  part2: string;
};

export type PngValidationResult = {
  width: number;
  height: number;
  byteLength: number;
  sha256?: string;
};

export class CoverContributionError extends Error {
  constructor(
    public readonly code:
      | "INVALID_TITLE"
      | "NO_IMAGE"
      | "INVALID_IMAGE_TYPE"
      | "IMAGE_TOO_LARGE"
      | "LOW_RESOLUTION"
      | "INVALID_PNG"
      | "NO_SONG_MATCH"
      | "AMBIGUOUS_SONG"
      | "ALREADY_APPROVED"
      | "CLOUD_REJECTED",
    message: string,
  ) {
    super(message);
    this.name = "CoverContributionError";
  }
}

export function normalizeCatalogValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function createExplicitCoverSong(
  artist: string,
  title: string,
): SongPayload {
  const normalizedArtist = artist.trim();
  const normalizedTitle = title.trim();
  if (!normalizedArtist || !normalizedTitle) {
    throw new CoverContributionError(
      "INVALID_TITLE",
      "Artista y cancion son obligatorios. No se actualizo ninguna portada.",
    );
  }

  return {
    id: `community-cover:${encodeURIComponent(normalizedArtist)}::${encodeURIComponent(normalizedTitle)}`,
    artist: normalizedArtist,
    title: normalizedTitle,
  };
}

export function splitContributionTitle(title: string): ContributionTitlePair[] {
  const pairs: ContributionTitlePair[] = [];
  const seen = new Set<string>();

  for (const match of title.matchAll(/[-—–|/]/g)) {
    const index = match.index;
    if (index === undefined) continue;

    const part1 = title.slice(0, index).trim();
    const part2 = title.slice(index + match[0].length).trim();
    if (!part1 || !part2) continue;

    const key = `${normalizeCatalogValue(part1)}::${normalizeCatalogValue(part2)}`;
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push({ part1, part2 });
    }
  }

  return pairs;
}

function dedupeSongs(songs: SongPayload[]) {
  const unique = new Map<string, SongPayload>();
  for (const song of songs) {
    const key = song.id || `${normalizeCatalogValue(song.artist)}::${normalizeCatalogValue(song.title)}`;
    if (!unique.has(key)) unique.set(key, song);
  }
  return [...unique.values()];
}

export async function resolveContributionTitle(
  title: string,
  findExact: (artist: string, songTitle: string) => Promise<SongPayload[]>,
) {
  const pairs = splitContributionTitle(title);
  if (pairs.length === 0) {
    throw new CoverContributionError(
      "INVALID_TITLE",
      "El titulo no contiene dos partes validas. Usa Artista - Cancion o Cancion - Artista.",
    );
  }

  const matches: SongPayload[] = [];
  const queryCache = new Map<string, Promise<SongPayload[]>>();
  const query = (artist: string, songTitle: string) => {
    const key = `${normalizeCatalogValue(artist)}::${normalizeCatalogValue(songTitle)}`;
    let pending = queryCache.get(key);
    if (!pending) {
      pending = findExact(artist, songTitle);
      queryCache.set(key, pending);
    }
    return pending;
  };

  for (const pair of pairs) {
    matches.push(...(await query(pair.part2, pair.part1)));
    matches.push(...(await query(pair.part1, pair.part2)));
  }

  return {
    pairs,
    exactMatches: dedupeSongs(matches),
  };
}

export function isPngAttachment(input: {
  name?: string | null;
  contentType?: string | null;
}) {
  return (
    input.contentType?.toLocaleLowerCase() === "image/png" ||
    input.name?.toLocaleLowerCase().endsWith(".png") === true
  );
}

export function validatePngBuffer(
  buffer: Buffer,
  options: {
    minDimension?: number;
    maxBytes?: number;
  } = {},
): PngValidationResult {
  const maxBytes = options.maxBytes ?? DEFAULT_COVER_MAX_BYTES;
  const minDimension = options.minDimension ?? DEFAULT_COVER_MIN_DIMENSION;

  if (buffer.byteLength > maxBytes) {
    throw new CoverContributionError(
      "IMAGE_TOO_LARGE",
      `La imagen supera el limite de ${Math.floor(maxBytes / 1024 / 1024)} MB.`,
    );
  }

  if (
    buffer.byteLength < 24 ||
    !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
    buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new CoverContributionError(
      "INVALID_PNG",
      "El archivo adjunto no es un PNG valido.",
    );
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (!width || !height) {
    throw new CoverContributionError(
      "INVALID_PNG",
      "El PNG no contiene dimensiones validas.",
    );
  }

  if (width < minDimension || height < minDimension) {
    throw new CoverContributionError(
      "LOW_RESOLUTION",
      `La imagen tiene baja resolucion (${width}x${height}). El minimo es ${minDimension}x${minDimension}.`,
    );
  }

  return { width, height, byteLength: buffer.byteLength };
}
