import { randomUUID } from "node:crypto";
import pg from "pg";
import { normalizeCatalogValue } from "./cover-contributions.js";

const { Pool } = pg;
const APPLE_HOSTS = new Set(["music.apple.com", "itunes.apple.com"]);
const REPORT_REASONS = new Set([
  "wrong_song",
  "wrong_version",
  "wrong_artist",
  "outdated",
  "other",
]);

export type ArtworkReportStatus = "pending" | "approved" | "rejected";
export type ArtworkReportReason =
  | "wrong_song"
  | "wrong_version"
  | "wrong_artist"
  | "outdated"
  | "other";

export type SongArtworkMapping = {
  songId: string;
  songTitle?: string;
  songArtist?: string;
  source: "apple";
  appleTrackId: number;
  appleCollectionId?: number;
  artworkUrl: string;
  appleMusicUrl: string;
  confidenceScore: number;
  coverVerified: boolean;
  verifiedByUserId?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ArtworkReport = {
  id: string;
  songId: string;
  reporterUserId: string;
  song: {
    title: string;
    artist: string;
    album?: string;
  };
  currentAppleTrackId?: number;
  currentArtworkUrl?: string;
  currentAppleMusicUrl?: string;
  suggestedAppleUrl?: string;
  reason: ArtworkReportReason;
  comment?: string;
  status: ArtworkReportStatus;
  reviewedByUserId?: string;
  reviewedAt?: string;
  discordReportsChannelId?: string;
  discordReportMessageId?: string;
  discordPublicChannelId?: string;
  discordPublicMessageId?: string;
  createdAt: string;
};

export type CreateArtworkReportInput = {
  songId: string;
  reporterUserId: string;
  title: string;
  artist: string;
  album?: string;
  currentAppleTrackId?: number;
  currentArtworkUrl?: string;
  currentAppleMusicUrl?: string;
  suggestedAppleUrl: string;
  reason: ArtworkReportReason;
  comment?: string;
};

export type ResolvedAppleTrack = {
  appleTrackId: number;
  appleCollectionId?: number;
  artworkUrl: string;
  appleMusicUrl: string;
};

export class ArtworkReportValidationError extends Error {}
export class ArtworkReportDuplicateError extends Error {}
export class ArtworkReportRateLimitError extends Error {}
export class ArtworkReportNotFoundError extends Error {}
export class ArtworkReportPermissionError extends Error {}
export class ArtworkReportAlreadyReviewedError extends Error {}

const databaseUrl = process.env.DATABASE_URL;
const useSsl = process.env.DATABASE_SSL === "true";
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 30_000,
    })
  : null;

const memoryReports = new Map<string, ArtworkReport>();
const memoryMappings = new Map<string, SongArtworkMapping>();

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (!cleaned) return undefined;
  if (cleaned.length > maxLength) {
    throw new ArtworkReportValidationError(
      `El texto no puede superar ${maxLength} caracteres.`,
    );
  }
  return cleaned;
}

export function isOfficialAppleUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && APPLE_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export function extractAppleTrackId(value: string) {
  if (!isOfficialAppleUrl(value)) return undefined;
  const url = new URL(value);
  const queryId = url.searchParams.get("i") || url.searchParams.get("id");
  if (queryId && /^\d+$/.test(queryId)) return Number(queryId);
  const pathMatch = url.pathname.match(/\/id(\d+)(?:\/|$)/i);
  if (pathMatch) return Number(pathMatch[1]);

  // Apple Music also emits canonical song links such as
  // /es/song/doyalike/1817377461, where the final path segment is the trackId.
  // Do not apply this rule to /album links because their final ID is usually a
  // collectionId unless the track is explicitly provided through ?i=.
  const songPathMatch = url.pathname.match(
    /\/song\/[^/]+\/(\d+)(?:\/)?$/i,
  );
  return songPathMatch ? Number(songPathMatch[1]) : undefined;
}

export function validateCreateArtworkReport(
  input: CreateArtworkReportInput,
): CreateArtworkReportInput {
  const songId = cleanOptionalText(input.songId, 240);
  const reporterUserId = cleanOptionalText(input.reporterUserId, 100);
  const title = cleanOptionalText(input.title, 300);
  const artist = cleanOptionalText(input.artist, 300);
  if (!songId || !reporterUserId || !title || !artist) {
    throw new ArtworkReportValidationError(
      "La canción, el artista y la sesión son obligatorios.",
    );
  }
  if (!REPORT_REASONS.has(input.reason)) {
    throw new ArtworkReportValidationError("El motivo no es válido.");
  }
  const suggestedAppleUrl = cleanOptionalText(input.suggestedAppleUrl, 2_000);
  if (!suggestedAppleUrl || !isOfficialAppleUrl(suggestedAppleUrl)) {
    throw new ArtworkReportValidationError(
      "El enlace sugerido es obligatorio y debe usar HTTPS con un dominio oficial de Apple.",
    );
  }
  const currentAppleMusicUrl = cleanOptionalText(
    input.currentAppleMusicUrl,
    2_000,
  );
  if (currentAppleMusicUrl && !isOfficialAppleUrl(currentAppleMusicUrl)) {
    throw new ArtworkReportValidationError(
      "La asociación actual de Apple no es válida.",
    );
  }
  return {
    ...input,
    songId,
    reporterUserId,
    title,
    artist,
    album: cleanOptionalText(input.album, 300),
    currentArtworkUrl: cleanOptionalText(input.currentArtworkUrl, 2_000),
    currentAppleMusicUrl,
    suggestedAppleUrl,
    comment: cleanOptionalText(input.comment, 500),
  };
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function reportFromRow(row: any): ArtworkReport {
  return {
    id: row.id,
    songId: row.song_id,
    reporterUserId: row.reporter_user_id,
    song: row.song,
    currentAppleTrackId:
      row.current_apple_track_id == null
        ? undefined
        : Number(row.current_apple_track_id),
    currentArtworkUrl: row.current_artwork_url ?? undefined,
    currentAppleMusicUrl: row.current_apple_music_url ?? undefined,
    suggestedAppleUrl: row.suggested_apple_url ?? undefined,
    reason: row.reason,
    comment: row.comment ?? undefined,
    status: row.status,
    reviewedByUserId: row.reviewed_by_user_id ?? undefined,
    reviewedAt: row.reviewed_at ? toIso(row.reviewed_at) : undefined,
    discordReportsChannelId: row.discord_reports_channel_id ?? undefined,
    discordReportMessageId: row.discord_report_message_id ?? undefined,
    discordPublicChannelId: row.discord_public_channel_id ?? undefined,
    discordPublicMessageId: row.discord_public_message_id ?? undefined,
    createdAt: toIso(row.created_at),
  };
}

function mappingFromRow(row: any): SongArtworkMapping {
  return {
    songId: row.song_id,
    songTitle: row.song_title ?? undefined,
    songArtist: row.song_artist ?? undefined,
    source: "apple",
    appleTrackId: Number(row.apple_track_id),
    appleCollectionId:
      row.apple_collection_id == null
        ? undefined
        : Number(row.apple_collection_id),
    artworkUrl: row.artwork_url,
    appleMusicUrl: row.apple_music_url,
    confidenceScore: Number(row.confidence_score),
    coverVerified: Boolean(row.cover_verified),
    verifiedByUserId: row.verified_by_user_id ?? undefined,
    verifiedAt: row.verified_at ? toIso(row.verified_at) : undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function initializeArtworkReportStore() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS song_artwork_mappings (
      song_id TEXT PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'apple' CHECK (source = 'apple'),
      apple_track_id BIGINT NOT NULL,
      apple_collection_id BIGINT,
      artwork_url TEXT NOT NULL,
      apple_music_url TEXT NOT NULL,
      confidence_score DOUBLE PRECISION NOT NULL,
      cover_verified BOOLEAN NOT NULL DEFAULT FALSE,
      verified_by_user_id TEXT,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artwork_reports (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL,
      reporter_user_id TEXT NOT NULL,
      song JSONB NOT NULL,
      current_apple_track_id BIGINT,
      current_artwork_url TEXT,
      current_apple_music_url TEXT,
      suggested_apple_url TEXT,
      reason TEXT NOT NULL CHECK (
        reason IN ('wrong_song', 'wrong_version', 'wrong_artist', 'outdated', 'other')
      ),
      comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 500),
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      reviewed_by_user_id TEXT,
      reviewed_at TIMESTAMPTZ,
      discord_reports_channel_id TEXT,
      discord_report_message_id TEXT,
      discord_public_channel_id TEXT,
      discord_public_message_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE artwork_reports
      ADD COLUMN IF NOT EXISTS discord_reports_channel_id TEXT,
      ADD COLUMN IF NOT EXISTS discord_report_message_id TEXT,
      ADD COLUMN IF NOT EXISTS discord_public_channel_id TEXT,
      ADD COLUMN IF NOT EXISTS discord_public_message_id TEXT
  `);
  await pool.query(`
    ALTER TABLE song_artwork_mappings
      ADD COLUMN IF NOT EXISTS song_title TEXT,
      ADD COLUMN IF NOT EXISTS song_artist TEXT,
      ADD COLUMN IF NOT EXISTS normalized_title TEXT,
      ADD COLUMN IF NOT EXISTS normalized_artist TEXT
  `);
  const legacyMappings = await pool.query(`
    SELECT m.song_id, report.song
    FROM song_artwork_mappings m
    JOIN LATERAL (
      SELECT ar.song
      FROM artwork_reports ar
      WHERE ar.song_id = m.song_id AND ar.status = 'approved'
      ORDER BY ar.reviewed_at DESC NULLS LAST, ar.created_at DESC
      LIMIT 1
    ) report ON TRUE
    WHERE m.normalized_title IS NULL OR m.normalized_artist IS NULL
  `);
  for (const row of legacyMappings.rows) {
    const title = typeof row.song?.title === "string" ? row.song.title : "";
    const artist = typeof row.song?.artist === "string" ? row.song.artist : "";
    if (!title || !artist) continue;
    await pool.query(
      `UPDATE song_artwork_mappings
       SET song_title = $2, song_artist = $3,
           normalized_title = $4, normalized_artist = $5,
           updated_at = NOW()
       WHERE song_id = $1`,
      [
        row.song_id,
        title,
        artist,
        normalizeCatalogValue(title),
        normalizeCatalogValue(artist),
      ],
    );
  }
  await pool.query(
    "CREATE INDEX IF NOT EXISTS song_artwork_mappings_song_id_idx ON song_artwork_mappings (song_id)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS song_artwork_mappings_apple_track_id_idx ON song_artwork_mappings (apple_track_id)",
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS song_artwork_mappings_identity_idx
     ON song_artwork_mappings (normalized_title, normalized_artist)`,
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS artwork_reports_song_id_idx ON artwork_reports (song_id)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS artwork_reports_status_idx ON artwork_reports (status, created_at DESC)",
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS artwork_reports_reporter_idx ON artwork_reports (reporter_user_id, created_at DESC)",
  );
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS artwork_reports_one_pending_idx
    ON artwork_reports (song_id, reporter_user_id)
    WHERE status = 'pending'
  `);
}

export async function createArtworkReport(input: CreateArtworkReportInput) {
  const valid = validateCreateArtworkReport(input);
  const now = new Date().toISOString();
  if (!pool) {
    const reports = [...memoryReports.values()];
    if (
      reports.some(
        (report) =>
          report.songId === valid.songId &&
          report.reporterUserId === valid.reporterUserId &&
          report.status === "pending",
      )
    ) {
      throw new ArtworkReportDuplicateError(
        "Ya tienes un reporte pendiente para esta canción.",
      );
    }
    const today = Date.now() - 24 * 60 * 60 * 1_000;
    if (
      reports.filter(
        (report) =>
          report.reporterUserId === valid.reporterUserId &&
          Date.parse(report.createdAt) >= today,
      ).length >= 5
    ) {
      throw new ArtworkReportRateLimitError(
        "Alcanzaste el límite de cinco reportes diarios.",
      );
    }
    const report: ArtworkReport = {
      id: randomUUID(),
      songId: valid.songId,
      reporterUserId: valid.reporterUserId,
      song: {
        title: valid.title,
        artist: valid.artist,
        album: valid.album,
      },
      currentAppleTrackId: valid.currentAppleTrackId,
      currentArtworkUrl: valid.currentArtworkUrl,
      currentAppleMusicUrl: valid.currentAppleMusicUrl,
      suggestedAppleUrl: valid.suggestedAppleUrl,
      reason: valid.reason,
      comment: valid.comment,
      status: "pending",
      createdAt: now,
    };
    memoryReports.set(report.id, report);
    return report;
  }

  const daily = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM artwork_reports
     WHERE reporter_user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'`,
    [valid.reporterUserId],
  );
  if (Number(daily.rows[0]?.count ?? 0) >= 5) {
    throw new ArtworkReportRateLimitError(
      "Alcanzaste el límite de cinco reportes diarios.",
    );
  }
  try {
    const result = await pool.query(
      `INSERT INTO artwork_reports (
        id, song_id, reporter_user_id, song, current_apple_track_id,
        current_artwork_url, current_apple_music_url, suggested_apple_url,
        reason, comment, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
      RETURNING *`,
      [
        randomUUID(),
        valid.songId,
        valid.reporterUserId,
        JSON.stringify({
          title: valid.title,
          artist: valid.artist,
          album: valid.album,
        }),
        valid.currentAppleTrackId ?? null,
        valid.currentArtworkUrl ?? null,
        valid.currentAppleMusicUrl ?? null,
        valid.suggestedAppleUrl ?? null,
        valid.reason,
        valid.comment ?? null,
      ],
    );
    return reportFromRow(result.rows[0]);
  } catch (error: any) {
    if (error?.code === "23505") {
      throw new ArtworkReportDuplicateError(
        "Ya tienes un reporte pendiente para esta canción.",
      );
    }
    throw error;
  }
}

export async function getArtworkReportStatus(
  songId: string,
  reporterUserId: string,
) {
  if (!pool) {
    return (
      [...memoryReports.values()]
        .filter(
          (report) =>
            report.songId === songId &&
            report.reporterUserId === reporterUserId,
        )
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ??
      null
    );
  }
  const result = await pool.query(
    `SELECT * FROM artwork_reports
     WHERE song_id = $1 AND reporter_user_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [songId, reporterUserId],
  );
  return result.rows[0] ? reportFromRow(result.rows[0]) : null;
}

export async function getSongArtworkMapping(
  songId: string,
  identity?: { title?: string; artist?: string },
) {
  if (!pool) {
    const exact = memoryMappings.get(songId);
    if (exact) return exact;
    const title = normalizeCatalogValue(identity?.title ?? "");
    const artist = normalizeCatalogValue(identity?.artist ?? "");
    if (!title || !artist) return null;
    return (
      [...memoryMappings.values()].find(
        (mapping) =>
          normalizeCatalogValue(mapping.songTitle ?? "") === title &&
          normalizeCatalogValue(mapping.songArtist ?? "") === artist,
      ) ?? null
    );
  }
  const normalizedTitle = normalizeCatalogValue(identity?.title ?? "");
  const normalizedArtist = normalizeCatalogValue(identity?.artist ?? "");
  const result = await pool.query(
    `SELECT * FROM song_artwork_mappings
     WHERE song_id = $1
        OR ($2 <> '' AND $3 <> '' AND normalized_title = $2 AND normalized_artist = $3)
     ORDER BY CASE WHEN song_id = $1 THEN 0 ELSE 1 END, verified_at DESC NULLS LAST
     LIMIT 1`,
    [songId, normalizedTitle, normalizedArtist],
  );
  return result.rows[0] ? mappingFromRow(result.rows[0]) : null;
}

export async function listArtworkReports(
  status: ArtworkReportStatus = "pending",
) {
  if (!pool) {
    return [...memoryReports.values()]
      .filter((report) => report.status === status)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
  const result = await pool.query(
    "SELECT * FROM artwork_reports WHERE status = $1 ORDER BY created_at DESC",
    [status],
  );
  return result.rows.map(reportFromRow);
}

export async function getArtworkReport(reportId: string) {
  if (!pool) return memoryReports.get(reportId) ?? null;
  const result = await pool.query(
    "SELECT * FROM artwork_reports WHERE id = $1",
    [reportId],
  );
  return result.rows[0] ? reportFromRow(result.rows[0]) : null;
}

export async function setArtworkReportDiscordMessage(input: {
  reportId: string;
  channelId: string;
  messageId: string;
}) {
  if (!pool) {
    const report = memoryReports.get(input.reportId);
    if (!report) throw new ArtworkReportNotFoundError("Reporte no encontrado.");
    const updated = {
      ...report,
      discordReportsChannelId: input.channelId,
      discordReportMessageId: input.messageId,
    };
    memoryReports.set(updated.id, updated);
    return updated;
  }
  const result = await pool.query(
    `UPDATE artwork_reports
     SET discord_reports_channel_id = $2, discord_report_message_id = $3
     WHERE id = $1
     RETURNING *`,
    [input.reportId, input.channelId, input.messageId],
  );
  if (!result.rows[0]) {
    throw new ArtworkReportNotFoundError("Reporte no encontrado.");
  }
  return reportFromRow(result.rows[0]);
}

export async function setArtworkReportPublicMessage(input: {
  reportId: string;
  channelId: string;
  messageId: string;
}) {
  if (!pool) {
    const report = memoryReports.get(input.reportId);
    if (!report) throw new ArtworkReportNotFoundError("Reporte no encontrado.");
    const updated = {
      ...report,
      discordPublicChannelId: input.channelId,
      discordPublicMessageId: input.messageId,
    };
    memoryReports.set(updated.id, updated);
    return updated;
  }
  const result = await pool.query(
    `UPDATE artwork_reports
     SET discord_public_channel_id = $2, discord_public_message_id = $3
     WHERE id = $1
     RETURNING *`,
    [input.reportId, input.channelId, input.messageId],
  );
  if (!result.rows[0]) {
    throw new ArtworkReportNotFoundError("Reporte no encontrado.");
  }
  return reportFromRow(result.rows[0]);
}

export async function listArtworkReportsForDiscordRecovery() {
  if (!pool) {
    return [...memoryReports.values()]
      .filter(
        (report) =>
          report.status === "pending" ||
          (report.status === "approved" && !report.discordPublicMessageId) ||
          Boolean(
            report.reviewedAt &&
              Date.parse(report.reviewedAt) >=
                Date.now() - 7 * 24 * 60 * 60 * 1_000,
          ),
      )
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }
  const result = await pool.query(
    `SELECT * FROM artwork_reports
     WHERE status = 'pending'
        OR (status = 'approved' AND discord_public_message_id IS NULL)
        OR reviewed_at >= NOW() - INTERVAL '7 days'
     ORDER BY created_at ASC
     LIMIT 250`,
  );
  return result.rows.map(reportFromRow);
}

export async function reviewArtworkReport(input: {
  reportId: string;
  reviewerUserId: string;
  status: Exclude<ArtworkReportStatus, "pending">;
  resolvedTrack?: ResolvedAppleTrack;
  allowSelfReview?: boolean;
}) {
  if (input.status === "approved" && !input.resolvedTrack) {
    throw new ArtworkReportValidationError(
      "No se pudo confirmar la canción en Apple.",
    );
  }
  if (!pool) {
    const report = memoryReports.get(input.reportId);
    if (!report) throw new ArtworkReportNotFoundError("Reporte no encontrado.");
    if (report.status !== "pending") {
      throw new ArtworkReportAlreadyReviewedError(
        "Este reporte ya fue revisado.",
      );
    }
    if (
      report.reporterUserId === input.reviewerUserId &&
      !input.allowSelfReview
    ) {
      throw new ArtworkReportPermissionError(
        "No puedes revisar tu propio reporte.",
      );
    }
    const updated: ArtworkReport = {
      ...report,
      status: input.status,
      reviewedByUserId: input.reviewerUserId,
      reviewedAt: new Date().toISOString(),
    };
    memoryReports.set(updated.id, updated);
    if (input.status === "approved" && input.resolvedTrack) {
      const existing = memoryMappings.get(report.songId);
      const now = new Date().toISOString();
      memoryMappings.set(report.songId, {
        songId: report.songId,
        songTitle: report.song.title,
        songArtist: report.song.artist,
        source: "apple",
        ...input.resolvedTrack,
        confidenceScore: 1_000,
        coverVerified: true,
        verifiedByUserId: input.reviewerUserId,
        verifiedAt: now,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
    }
    return {
      report: updated,
      mapping: await getSongArtworkMapping(report.songId),
    };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const selected = await client.query(
      "SELECT * FROM artwork_reports WHERE id = $1 FOR UPDATE",
      [input.reportId],
    );
    if (!selected.rows[0]) {
      throw new ArtworkReportNotFoundError("Reporte no encontrado.");
    }
    const report = reportFromRow(selected.rows[0]);
    if (report.status !== "pending") {
      throw new ArtworkReportAlreadyReviewedError(
        "Este reporte ya fue revisado.",
      );
    }
    if (
      report.reporterUserId === input.reviewerUserId &&
      !input.allowSelfReview
    ) {
      throw new ArtworkReportPermissionError(
        "No puedes revisar tu propio reporte.",
      );
    }

    let mapping: SongArtworkMapping | null = null;
    if (input.status === "approved" && input.resolvedTrack) {
      const mapped = await client.query(
        `INSERT INTO song_artwork_mappings (
          song_id, song_title, song_artist, normalized_title, normalized_artist,
          source, apple_track_id, apple_collection_id, artwork_url,
          apple_music_url, confidence_score, cover_verified,
          verified_by_user_id, verified_at
        ) VALUES ($1,$2,$3,$4,$5,'apple',$6,$7,$8,$9,1000,TRUE,$10,NOW())
        ON CONFLICT (song_id) DO UPDATE SET
          song_title = EXCLUDED.song_title,
          song_artist = EXCLUDED.song_artist,
          normalized_title = EXCLUDED.normalized_title,
          normalized_artist = EXCLUDED.normalized_artist,
          source = 'apple',
          apple_track_id = EXCLUDED.apple_track_id,
          apple_collection_id = EXCLUDED.apple_collection_id,
          artwork_url = EXCLUDED.artwork_url,
          apple_music_url = EXCLUDED.apple_music_url,
          confidence_score = EXCLUDED.confidence_score,
          cover_verified = TRUE,
          verified_by_user_id = EXCLUDED.verified_by_user_id,
          verified_at = NOW(),
          updated_at = NOW()
        RETURNING *`,
        [
          report.songId,
          report.song.title,
          report.song.artist,
          normalizeCatalogValue(report.song.title),
          normalizeCatalogValue(report.song.artist),
          input.resolvedTrack.appleTrackId,
          input.resolvedTrack.appleCollectionId ?? null,
          input.resolvedTrack.artworkUrl,
          input.resolvedTrack.appleMusicUrl,
          input.reviewerUserId,
        ],
      );
      mapping = mappingFromRow(mapped.rows[0]);
    }
    const reviewed = await client.query(
      `UPDATE artwork_reports
       SET status = $2, reviewed_by_user_id = $3, reviewed_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [input.reportId, input.status, input.reviewerUserId],
    );
    await client.query("COMMIT");
    return { report: reportFromRow(reviewed.rows[0]), mapping };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function lookupAppleTrack(
  trackIdOrUrl: number | string,
  signal?: AbortSignal,
): Promise<ResolvedAppleTrack> {
  const trackId =
    typeof trackIdOrUrl === "number"
      ? trackIdOrUrl
      : extractAppleTrackId(trackIdOrUrl);
  if (!trackId || !Number.isSafeInteger(trackId)) {
    throw new ArtworkReportValidationError(
      "El enlace no contiene un trackId válido de Apple.",
    );
  }
  const params = new URLSearchParams({
    id: String(trackId),
    entity: "song",
    country: "MX",
  });
  const response = await fetch(
    `https://itunes.apple.com/lookup?${params.toString()}`,
    { signal, headers: { Accept: "application/json" } },
  );
  if (!response.ok) {
    throw new ArtworkReportValidationError(
      "Apple no pudo confirmar la canción propuesta.",
    );
  }
  const data = (await response.json()) as {
    results?: Array<{
      trackId?: number;
      collectionId?: number;
      artworkUrl100?: string;
      trackViewUrl?: string;
    }>;
  };
  const track = data.results?.find(
    (item) =>
      item.trackId === trackId &&
      item.artworkUrl100 &&
      isOfficialAppleUrl(item.trackViewUrl),
  );
  if (!track?.trackId || !track.artworkUrl100 || !track.trackViewUrl) {
    throw new ArtworkReportValidationError(
      "Apple no devolvió una canción válida para esa asociación.",
    );
  }
  return {
    appleTrackId: track.trackId,
    appleCollectionId: track.collectionId,
    artworkUrl: track.artworkUrl100.replace(
      /\/\d+x\d+(?:bb)?\.(jpg|png|webp)$/i,
      "/1200x1200bb.$1",
    ),
    appleMusicUrl: track.trackViewUrl,
  };
}

export async function closeArtworkReportStore() {
  await pool?.end();
}

export function resetArtworkReportMemoryForTests() {
  memoryReports.clear();
  memoryMappings.clear();
}
