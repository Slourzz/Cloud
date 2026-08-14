import { Pool, type QueryResultRow } from "pg";
import { normalizeCatalogValue } from "./cover-contributions.js";

export type SubmissionStatus = "pending" | "approved" | "rejected";
export type MaintenanceType = "lyrics" | "global";
export type MaintenanceStatus = "scheduled" | "active" | "ended" | "cancelled";

export type DailyWebStats = {
  day: string;
  visitors: number;
  pageViews: number;
};

export type SongPayload = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  coverUrl?: string;
  audioUrl?: string;
  submittedAt?: string;
};

export type DiscordIdentity = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  biography?: string;
};

export type TTMLSubmission = {
  id: string;
  song: SongPayload;
  fileName: string;
  ttmlContent: string;
  status: SubmissionStatus;
  createdAt: number;
  messageId?: string;
  channelId?: string;
  submitter?: DiscordIdentity;
  moderator?: {
    id: string;
    name: string;
    avatarUrl?: string;
    comment: string;
  };
};

export type CommunityCover = {
  id: string;
  song: SongPayload;
  songKey: string;
  width: number;
  height: number;
  byteLength: number;
  sha256: string;
  originalFileName: string;
  discordAttachmentId: string;
  threadId: string;
  forumId: string;
  submitter: DiscordIdentity;
  moderator: DiscordIdentity;
  createdAt: string;
  updatedAt: string;
  requestedSongKey?: string;
};

export type ArtistMediaKind = "avatar" | "banner";

export type ArtistReference = {
  id: string;
  name: string;
  referenceUrl: string;
  provider: string;
  genre?: string;
};

export type CommunityArtistMedia = {
  id: string;
  artist: ArtistReference;
  artistKey: string;
  kind: ArtistMediaKind;
  width: number;
  height: number;
  byteLength: number;
  sha256: string;
  originalFileName: string;
  discordAttachmentId: string;
  threadId: string;
  forumId: string;
  submitter: DiscordIdentity;
  moderator: DiscordIdentity;
  createdAt: string;
  updatedAt: string;
};

export class CommunityArtistMediaAlreadyApprovedError extends Error {
  constructor() {
    super("Esta contribucion de artista ya fue aprobada.");
    this.name = "CommunityArtistMediaAlreadyApprovedError";
  }
}

export class CommunityCoverAlreadyApprovedError extends Error {
  constructor() {
    super("Esta contribucion ya fue aprobada.");
    this.name = "CommunityCoverAlreadyApprovedError";
  }
}

type SubmissionRow = QueryResultRow & {
  id: string;
  song: SongPayload;
  file_name: string;
  ttml_content: string;
  status: SubmissionStatus;
  created_at: string;
  message_id: string | null;
  channel_id: string | null;
  submitter: DiscordIdentity | null;
  moderator: TTMLSubmission["moderator"] | null;
};

type AuthRequestRow = QueryResultRow & {
  state: string;
  status: "pending" | "complete";
  session_token: string | null;
  user_data: DiscordIdentity | null;
  created_at: string;
};

type AuthSessionRow = QueryResultRow & {
  user_data: DiscordIdentity;
  expires_at: string;
};

export type MaintenanceEvent = {
  id: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  startsAtUtc: string;
  endsAtUtc: string;
  reason?: string;
  createdBy?: DiscordIdentity;
  createdAtUtc: string;
  endedBy?: DiscordIdentity;
  endedAtUtc?: string;
};

type MaintenanceEventRow = QueryResultRow & {
  id: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  starts_at_utc: Date | string;
  ends_at_utc: Date | string;
  reason: string | null;
  created_by: DiscordIdentity | null;
  created_at_utc: Date | string;
  ended_by: DiscordIdentity | null;
  ended_at_utc: Date | string | null;
};

type CommunityCoverRow = QueryResultRow & {
  id: string;
  song: SongPayload;
  song_key: string;
  png_data?: Buffer;
  width: number;
  height: number;
  byte_length: number;
  sha256: string;
  original_file_name: string;
  discord_attachment_id: string;
  thread_id: string;
  forum_id: string;
  submitter: DiscordIdentity;
  moderator: DiscordIdentity;
  created_at: Date | string;
  updated_at: Date | string;
};

type CommunityArtistMediaRow = QueryResultRow & {
  id: string;
  artist: ArtistReference;
  artist_key: string;
  asset_kind: ArtistMediaKind;
  png_data?: Buffer;
  width: number;
  height: number;
  byte_length: number;
  sha256: string;
  original_file_name: string;
  discord_attachment_id: string;
  thread_id: string;
  forum_id: string;
  submitter: DiscordIdentity;
  moderator: DiscordIdentity;
  created_at: Date | string;
  updated_at: Date | string;
};

export type MaintenanceSnapshot = {
  nowUtc: string;
  lyrics: {
    active?: MaintenanceEvent;
    scheduled?: MaintenanceEvent;
  };
  global: {
    active?: MaintenanceEvent;
    scheduled?: MaintenanceEvent;
  };
};

function normalizeSongPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b(feat|ft|featuring)\b.*$/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

export function createSongKey(artist: string, title: string) {
  return `${normalizeSongPart(artist)}::${normalizeSongPart(title)}`;
}

function normalizeCatalogWords(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getBaseCatalogTitle(value: string) {
  return value
    .replace(
      /\s*[\[(]\s*(?:feat(?:uring)?|ft|with)\b[^\])]*[\])]\s*/giu,
      " ",
    )
    .replace(
      /\s+(?:feat(?:uring)?|ft|with)\.?\s+.+$/giu,
      " ",
    )
    .trim();
}

function getCatalogArtists(artist: string, title: string) {
  const collaborators = [...title.matchAll(
    /[\[(]\s*(?:feat(?:uring)?|ft|with)\.?\s+([^\])]+)[\])]/giu,
  )].flatMap((match) => match[1]?.split(/,|&|\band\b|\bx\b/giu) ?? []);
  return [...artist.split(/,|&|\band\b|\bx\b|feat(?:uring)?|ft\.?/giu), ...collaborators]
    .map(normalizeCatalogWords)
    .filter(Boolean);
}

const catalogVersionMarkers = [
  "remix",
  "live",
  "acoustic",
  "instrumental",
  "sped up",
  "slowed",
  "nightcore",
  "radio edit",
  "demo",
];

export function scoreSongIdentity(
  request: Pick<SongPayload, "artist" | "title" | "duration">,
  candidate: Pick<SongPayload, "artist" | "title" | "duration">,
) {
  const requestTitle = normalizeCatalogWords(request.title);
  const candidateTitle = normalizeCatalogWords(candidate.title);
  const requestBase = normalizeCatalogWords(getBaseCatalogTitle(request.title));
  const candidateBase = normalizeCatalogWords(getBaseCatalogTitle(candidate.title));
  if (!requestBase || requestBase !== candidateBase) return Number.NEGATIVE_INFINITY;

  const requestArtists = getCatalogArtists(request.artist, request.title);
  const candidateArtists = getCatalogArtists(candidate.artist, candidate.title);
  const sharedArtists = requestArtists.filter((value) =>
    candidateArtists.includes(value),
  );
  if (
    requestArtists.length > 0 &&
    candidateArtists.length > 0 &&
    sharedArtists.length === 0
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  const mismatchedVersion = catalogVersionMarkers.some((marker) => {
    const requestHas = requestTitle.includes(marker);
    const candidateHas = candidateTitle.includes(marker);
    return requestHas !== candidateHas;
  });
  if (mismatchedVersion) return Number.NEGATIVE_INFINITY;

  let score = requestTitle === candidateTitle ? 150 : 115;
  if (requestArtists[0] && requestArtists[0] === candidateArtists[0]) score += 70;
  score += Math.min(60, sharedArtists.length * 30);

  if (request.duration && candidate.duration) {
    const delta = Math.abs(request.duration - candidate.duration);
    if (delta > 12) return Number.NEGATIVE_INFINITY;
    score += delta <= 2 ? 35 : delta <= 5 ? 20 : 5;
  }
  return score;
}

function pickBestSongMatch<T extends { song: SongPayload }>(
  request: Pick<SongPayload, "artist" | "title" | "duration">,
  candidates: T[],
) {
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreSongIdentity(request, candidate.song),
    }))
    .filter(({ score }) => Number.isFinite(score) && score >= 185)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || (ranked[1] && best.score - ranked[1].score < 12)) return undefined;
  return best.candidate;
}

function normalizeCommunityCoverPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function createCommunityCoverKey(artist: string, title: string) {
  return `${normalizeCommunityCoverPart(artist)}::${normalizeCommunityCoverPart(title)}`;
}

export function createCommunityArtistMediaKey(
  artist: Pick<ArtistReference, "id" | "name" | "provider">,
  kind: ArtistMediaKind,
) {
  const identity = artist.id || normalizeCommunityCoverPart(artist.name);
  return `${normalizeCommunityCoverPart(artist.provider)}::${normalizeCommunityCoverPart(identity)}::${kind}`;
}

const memorySubmissions = new Map<string, TTMLSubmission>();
const memoryTtmlPlays = new Map<string, Set<string>>();
const memoryAuthRequests = new Map<
  string,
  {
    status: "pending" | "complete";
    sessionToken?: string;
    user?: DiscordIdentity;
    createdAt: number;
  }
>();
const memoryAuthSessions = new Map<
  string,
  { user: DiscordIdentity; expiresAt: number }
>();
const memoryProfileBiographies = new Map<string, string>();
const memoryMaintenanceEvents = new Map<string, MaintenanceEvent>();
const memoryMaintenanceAcknowledgements = new Map<string, number>();
const memoryDeleteBackups = new Map<string, TTMLSubmission[]>();
const memoryCommunityCovers = new Map<
  string,
  CommunityCover & { pngData: Buffer }
>();
const memoryApprovedCoverThreads = new Set<string>();
const memoryCommunityArtistMedia = new Map<
  string,
  CommunityArtistMedia & { pngData: Buffer }
>();
const memoryApprovedArtistMediaThreads = new Set<string>();
const memoryDailyWebVisitors = new Map<string, Map<string, number>>();
const databaseUrl = process.env.DATABASE_URL;
const useSsl = process.env.DATABASE_SSL === "true";

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 30_000,
    })
  : null;

const transientDatabaseErrorCodes = new Set([
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "08P01",
  "53300",
  "53400",
  "57P01",
  "57P02",
  "57P03",
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
]);

export function isTransientDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  if (
    "code" in error &&
    typeof error.code === "string" &&
    transientDatabaseErrorCodes.has(error.code)
  ) {
    return true;
  }

  if (
    "errors" in error &&
    Array.isArray(error.errors) &&
    error.errors.some(isTransientDatabaseError)
  ) {
    return true;
  }

  if ("cause" in error && isTransientDatabaseError(error.cause)) return true;

  const message = error instanceof Error ? error.message : "";
  return /database system is starting up|connection (?:refused|reset|terminated)|timed?\s*out/i.test(
    message,
  );
}

async function withDatabaseRetry<T>(
  label: string,
  operation: () => Promise<T>,
  attempts = 4,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= attempts || !isTransientDatabaseError(error)) throw error;
      const delayMs = Math.min(4_000, 750 * 2 ** (attempt - 1));
      console.warn(
        `Transient PostgreSQL error during ${label}; retrying ${attempt}/${attempts - 1} in ${delayMs}ms.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

function rowToSubmission(row: SubmissionRow): TTMLSubmission {
  return {
    id: row.id,
    song: row.song,
    fileName: row.file_name,
    ttmlContent: row.ttml_content,
    status: row.status,
    createdAt: Number(row.created_at),
    messageId: row.message_id ?? undefined,
    channelId: row.channel_id ?? undefined,
    submitter: row.submitter ?? undefined,
    moderator: row.moderator ?? undefined,
  };
}

function toIsoDate(value: Date | string | number) {
  return new Date(value).toISOString();
}

function rowToCommunityCover(row: CommunityCoverRow): CommunityCover {
  return {
    id: row.id,
    song: row.song,
    songKey: row.song_key,
    width: Number(row.width),
    height: Number(row.height),
    byteLength: Number(row.byte_length),
    sha256: row.sha256,
    originalFileName: row.original_file_name,
    discordAttachmentId: row.discord_attachment_id,
    threadId: row.thread_id,
    forumId: row.forum_id,
    submitter: row.submitter,
    moderator: row.moderator,
    createdAt: toIsoDate(row.created_at),
    updatedAt: toIsoDate(row.updated_at),
  };
}

function rowToCommunityArtistMedia(
  row: CommunityArtistMediaRow,
): CommunityArtistMedia {
  return {
    id: row.id,
    artist: row.artist,
    artistKey: row.artist_key,
    kind: row.asset_kind,
    width: Number(row.width),
    height: Number(row.height),
    byteLength: Number(row.byte_length),
    sha256: row.sha256,
    originalFileName: row.original_file_name,
    discordAttachmentId: row.discord_attachment_id,
    threadId: row.thread_id,
    forumId: row.forum_id,
    submitter: row.submitter,
    moderator: row.moderator,
    createdAt: toIsoDate(row.created_at),
    updatedAt: toIsoDate(row.updated_at),
  };
}

function rowToMaintenanceEvent(row: MaintenanceEventRow): MaintenanceEvent {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    startsAtUtc: toIsoDate(row.starts_at_utc),
    endsAtUtc: toIsoDate(row.ends_at_utc),
    reason: row.reason ?? undefined,
    createdBy: row.created_by ?? undefined,
    createdAtUtc: toIsoDate(row.created_at_utc),
    endedBy: row.ended_by ?? undefined,
    endedAtUtc: row.ended_at_utc ? toIsoDate(row.ended_at_utc) : undefined,
  };
}

function resolveMaintenanceStatus(event: MaintenanceEvent, now = Date.now()) {
  if (event.status === "ended" || event.status === "cancelled") {
    return event.status;
  }

  const startsAt = Date.parse(event.startsAtUtc);
  const endsAt = Date.parse(event.endsAtUtc);
  if (Number.isFinite(endsAt) && now >= endsAt) return "ended";
  if (Number.isFinite(startsAt) && now >= startsAt) return "active";
  return "scheduled";
}

function normalizeMaintenanceEvent(event: MaintenanceEvent): MaintenanceEvent {
  return {
    ...event,
    status: resolveMaintenanceStatus(event),
  };
}

export async function initializeSubmissionStore() {
  if (!pool) {
    console.warn(
      "DATABASE_URL is not configured. TTML reviews will use temporary memory storage.",
    );
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ttml_submissions (
      id TEXT PRIMARY KEY,
      song JSONB NOT NULL,
      file_name TEXT NOT NULL,
      ttml_content TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at BIGINT NOT NULL,
      message_id TEXT,
      channel_id TEXT,
      submitter JSONB,
      moderator JSONB,
      song_key TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE ttml_submissions
    ADD COLUMN IF NOT EXISTS song_key TEXT
  `);

  await pool.query(`
    ALTER TABLE ttml_submissions
    ADD COLUMN IF NOT EXISTS submitter JSONB
  `);

  await pool.query(`
    ALTER TABLE ttml_submissions
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'community'
  `);

  await pool.query(`
    ALTER TABLE ttml_submissions
    ADD CONSTRAINT IF NOT EXISTS ttml_submissions_source_check
    CHECK (source IN ('community', 'lyrically', 'paxsenix', 'lyrics_ovh', 'unknown'))
  `).catch(async () => {
    // PostgreSQL versions before 16 do not support IF NOT EXISTS for constraints.
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'ttml_submissions_source_check'
        ) THEN
          ALTER TABLE ttml_submissions
          ADD CONSTRAINT ttml_submissions_source_check
          CHECK (source IN ('community', 'lyrically', 'paxsenix', 'lyrics_ovh', 'unknown'));
        END IF;
      END $$;
    `);
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS maintenance_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('lyrics', 'global')),
      status TEXT NOT NULL CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')),
      starts_at_utc TIMESTAMPTZ NOT NULL,
      ends_at_utc TIMESTAMPTZ NOT NULL,
      reason TEXT,
      created_by JSONB,
      created_at_utc TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_by JSONB,
      ended_at_utc TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS maintenance_acknowledgements (
      event_id TEXT NOT NULL REFERENCES maintenance_events(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL,
      notice_type TEXT NOT NULL,
      acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (event_id, client_id, notice_type)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS maintenance_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      event_id TEXT,
      action TEXT NOT NULL,
      actor_discord_id TEXT,
      actor_name TEXT,
      details JSONB,
      success BOOLEAN NOT NULL DEFAULT TRUE,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ttml_delete_backups (
      batch_id TEXT NOT NULL,
      submission_id TEXT NOT NULL,
      row_data JSONB NOT NULL,
      actor_discord_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (batch_id, submission_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS discord_auth_requests (
      state TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('pending', 'complete')),
      session_token TEXT,
      user_data JSONB,
      created_at BIGINT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS discord_auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_data JSONB NOT NULL,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS discord_profile_settings (
      discord_id TEXT PRIMARY KEY,
      biography TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS web_daily_visitors (
      visit_day DATE NOT NULL,
      visitor_hash TEXT NOT NULL,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      page_views INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (visit_day, visitor_hash)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ttml_play_events (
      submission_id TEXT NOT NULL REFERENCES ttml_submissions(id) ON DELETE CASCADE,
      play_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (submission_id, play_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS ttml_play_events_submission_idx
    ON ttml_play_events (submission_id)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS web_daily_visitors_day_idx
    ON web_daily_visitors (visit_day DESC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_covers (
      song_key TEXT PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      song JSONB NOT NULL,
      png_data BYTEA NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      byte_length INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      original_file_name TEXT NOT NULL,
      discord_attachment_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      forum_id TEXT NOT NULL,
      submitter JSONB NOT NULL,
      moderator JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cover_contribution_approvals (
      thread_id TEXT PRIMARY KEY,
      cover_id TEXT NOT NULL,
      song_key TEXT NOT NULL,
      song JSONB NOT NULL,
      discord_attachment_id TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      submitter JSONB NOT NULL,
      moderator JSONB NOT NULL,
      approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS community_artist_media (
      artist_key TEXT PRIMARY KEY,
      id TEXT NOT NULL UNIQUE,
      artist JSONB NOT NULL,
      normalized_artist_name TEXT NOT NULL,
      asset_kind TEXT NOT NULL CHECK (asset_kind IN ('avatar', 'banner')),
      png_data BYTEA NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      byte_length INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      original_file_name TEXT NOT NULL,
      discord_attachment_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      forum_id TEXT NOT NULL,
      submitter JSONB NOT NULL,
      moderator JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (thread_id, asset_kind)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS ttml_submissions_status_idx
    ON ttml_submissions (status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS ttml_submissions_created_at_idx
    ON ttml_submissions (created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS ttml_submissions_song_key_idx
    ON ttml_submissions (song_key, status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS maintenance_events_type_status_idx
    ON maintenance_events (type, status, starts_at_utc, ends_at_utc)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS community_covers_updated_at_idx
    ON community_covers (updated_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS community_artist_media_name_idx
    ON community_artist_media (normalized_artist_name, asset_kind)
  `);

  const storedCovers = await pool.query<{
    song_key: string;
    song: SongPayload;
  }>("SELECT song_key, song FROM community_covers");
  for (const row of storedCovers.rows) {
    const exactKey = createCommunityCoverKey(
      row.song.artist,
      row.song.title,
    );
    if (exactKey === row.song_key) continue;
    await pool.query(
      "UPDATE cover_contribution_approvals SET song_key = $1 WHERE song_key = $2",
      [exactKey, row.song_key],
    );
    await pool.query(
      "UPDATE community_covers SET song_key = $1 WHERE song_key = $2",
      [exactKey, row.song_key],
    );
  }

  const missingKeys = await pool.query<{
    id: string;
    song: SongPayload;
  }>(`
    SELECT id, song
    FROM ttml_submissions
    WHERE song_key IS NULL
  `);

  for (const row of missingKeys.rows) {
    await pool.query(
      "UPDATE ttml_submissions SET song_key = $1 WHERE id = $2",
      [createSongKey(row.song.artist, row.song.title), row.id],
    );
  }

  console.log("PostgreSQL submission store connected");
}

export async function writeAuditLog(input: {
  action: string;
  actor?: DiscordIdentity;
  eventId?: string;
  details?: Record<string, unknown>;
  success?: boolean;
  error?: string;
}) {
  if (!pool) return;

  await pool.query(
    `
      INSERT INTO maintenance_audit_logs (
        event_id,
        action,
        actor_discord_id,
        actor_name,
        details,
        success,
        error
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
    `,
    [
      input.eventId ?? null,
      input.action,
      input.actor?.id ?? null,
      input.actor?.displayName ?? input.actor?.username ?? null,
      input.details ? JSON.stringify(input.details) : null,
      input.success ?? true,
      input.error ?? null,
    ],
  );
}

export async function createMaintenanceEvent(input: {
  id: string;
  type: MaintenanceType;
  startsAtUtc: string;
  endsAtUtc: string;
  reason?: string;
  createdBy?: DiscordIdentity;
}) {
  const event = normalizeMaintenanceEvent({
    id: input.id,
    type: input.type,
    status: "scheduled",
    startsAtUtc: input.startsAtUtc,
    endsAtUtc: input.endsAtUtc,
    reason: input.reason,
    createdBy: input.createdBy,
    createdAtUtc: new Date().toISOString(),
  });

  memoryMaintenanceEvents.set(event.id, event);

  if (!pool) return event;

  await pool.query(
    `
      INSERT INTO maintenance_events (
        id,
        type,
        status,
        starts_at_utc,
        ends_at_utc,
        reason,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      event.id,
      event.type,
      event.status,
      event.startsAtUtc,
      event.endsAtUtc,
      event.reason ?? null,
      event.createdBy ? JSON.stringify(event.createdBy) : null,
    ],
  );
  await writeAuditLog({
    action: `maintenance_${event.type}_created`,
    actor: event.createdBy,
    eventId: event.id,
    details: {
      startsAtUtc: event.startsAtUtc,
      endsAtUtc: event.endsAtUtc,
      reason: event.reason,
    },
  });
  return event;
}

export async function endMaintenanceEvent(
  type: MaintenanceType,
  actor?: DiscordIdentity,
) {
  const snapshot = await getMaintenanceSnapshot();
  const event = snapshot[type].active ?? snapshot[type].scheduled;
  if (!event) return undefined;

  const endedEvent: MaintenanceEvent = {
    ...event,
    status: "ended",
    endedBy: actor,
    endedAtUtc: new Date().toISOString(),
  };
  memoryMaintenanceEvents.set(endedEvent.id, endedEvent);

  if (pool) {
    await pool.query(
      `
        UPDATE maintenance_events
        SET status = 'ended',
            ended_by = $3::jsonb,
            ended_at_utc = NOW()
        WHERE id = $1
          AND type = $2
          AND status IN ('scheduled', 'active')
      `,
      [event.id, type, actor ? JSON.stringify(actor) : null],
    );
    await writeAuditLog({
      action: `maintenance_${type}_ended`,
      actor,
      eventId: event.id,
    });
  }

  return endedEvent;
}

export async function getMaintenanceSnapshot(): Promise<MaintenanceSnapshot> {
  const now = Date.now();
  const nowUtc = new Date(now).toISOString();

  if (!pool) {
    const events = [...memoryMaintenanceEvents.values()]
      .map((event) => normalizeMaintenanceEvent(event))
      .filter((event) => event.status === "active" || event.status === "scheduled")
      .sort((a, b) => Date.parse(a.startsAtUtc) - Date.parse(b.startsAtUtc));

    return {
      nowUtc,
      lyrics: {
        active: events.find((event) => event.type === "lyrics" && event.status === "active"),
        scheduled: events.find((event) => event.type === "lyrics" && event.status === "scheduled"),
      },
      global: {
        active: events.find((event) => event.type === "global" && event.status === "active"),
        scheduled: events.find((event) => event.type === "global" && event.status === "scheduled"),
      },
    };
  }

  await pool.query(
    `
      UPDATE maintenance_events
      SET status = 'ended',
          ended_at_utc = COALESCE(ended_at_utc, NOW())
      WHERE status IN ('scheduled', 'active')
        AND ends_at_utc <= NOW()
    `,
  );
  await pool.query(
    `
      UPDATE maintenance_events
      SET status = 'active'
      WHERE status = 'scheduled'
        AND starts_at_utc <= NOW()
        AND ends_at_utc > NOW()
    `,
  );

  const result = await pool.query<MaintenanceEventRow>(
    `
      SELECT
        id,
        type,
        status,
        starts_at_utc,
        ends_at_utc,
        reason,
        created_by,
        created_at_utc,
        ended_by,
        ended_at_utc
      FROM maintenance_events
      WHERE status IN ('scheduled', 'active')
      ORDER BY starts_at_utc ASC
    `,
  );

  const events = result.rows.map(rowToMaintenanceEvent);
  return {
    nowUtc,
    lyrics: {
      active: events.find((event) => event.type === "lyrics" && event.status === "active"),
      scheduled: events.find((event) => event.type === "lyrics" && event.status === "scheduled"),
    },
    global: {
      active: events.find((event) => event.type === "global" && event.status === "active"),
      scheduled: events.find((event) => event.type === "global" && event.status === "scheduled"),
    },
  };
}

export async function acknowledgeMaintenanceNotice(input: {
  eventId: string;
  clientId: string;
  noticeType: string;
}) {
  const key = `${input.eventId}:${input.clientId}:${input.noticeType}`;
  memoryMaintenanceAcknowledgements.set(key, Date.now());

  if (!pool) return;

  await pool.query(
    `
      INSERT INTO maintenance_acknowledgements (
        event_id,
        client_id,
        notice_type
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (event_id, client_id, notice_type) DO UPDATE SET
        acknowledged_at = NOW()
    `,
    [input.eventId, input.clientId, input.noticeType],
  );
}

export async function deleteAllCommunityTtmlsWithBackup(input: {
  batchId: string;
  actor: DiscordIdentity;
}) {
  if (!pool) {
    const submissions = [...memorySubmissions.values()];
    const count = submissions.length;
    memoryDeleteBackups.set(input.batchId, submissions);
    memorySubmissions.clear();
    return { deletedCount: count, backupBatchId: input.batchId };
  }

  await pool.query("BEGIN");
  try {
    const candidates = await pool.query<QueryResultRow>(
      `
        SELECT to_jsonb(ttml_submissions.*) AS row_data, id
        FROM ttml_submissions
        WHERE source = 'community'
      `,
    );

    for (const row of candidates.rows) {
      await pool.query(
        `
          INSERT INTO ttml_delete_backups (
            batch_id,
            submission_id,
            row_data,
            actor_discord_id
          )
          VALUES ($1, $2, $3::jsonb, $4)
        `,
        [
          input.batchId,
          row.id,
          JSON.stringify(row.row_data),
          input.actor.id,
        ],
      );
    }

    const deleted = await pool.query<{ count: string }>(
      `
        WITH deleted AS (
          DELETE FROM ttml_submissions
          WHERE source = 'community'
          RETURNING id
        )
        SELECT COUNT(*)::text AS count FROM deleted
      `,
    );

    await pool.query(
      `
        INSERT INTO maintenance_audit_logs (
          action,
          actor_discord_id,
          actor_name,
          details,
          success
        )
        VALUES ($1, $2, $3, $4::jsonb, TRUE)
      `,
      [
        "delete_all_community_ttmls",
        input.actor.id,
        input.actor.displayName || input.actor.username,
        JSON.stringify({
          batchId: input.batchId,
          deletedCount: Number(deleted.rows[0]?.count ?? 0),
        }),
      ],
    );

    await pool.query("COMMIT");
    return {
      deletedCount: Number(deleted.rows[0]?.count ?? 0),
      backupBatchId: input.batchId,
    };
  } catch (error) {
    await pool.query("ROLLBACK");
    await writeAuditLog({
      action: "delete_all_community_ttmls",
      actor: input.actor,
      details: { batchId: input.batchId },
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function findCommunityTtmls(artist: string, title: string) {
  const songKey = createSongKey(artist, title);
  if (!pool) {
    return [...memorySubmissions.values()]
      .filter(
        (submission) =>
          createSongKey(submission.song.artist, submission.song.title) === songKey,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  const result = await pool.query<SubmissionRow>(
    `
      SELECT
        id,
        song,
        file_name,
        ttml_content,
        status,
        created_at,
        message_id,
        channel_id,
        submitter,
        moderator
      FROM ttml_submissions
      WHERE source = 'community'
        AND song_key = $1
      ORDER BY updated_at DESC
    `,
    [songKey],
  );
  return result.rows.map(rowToSubmission);
}

export async function deleteCommunityTtmlsWithBackup(input: {
  batchId: string;
  actor: DiscordIdentity;
  artist: string;
  title: string;
}) {
  const songKey = createSongKey(input.artist, input.title);
  if (!pool) {
    const matches = await findCommunityTtmls(input.artist, input.title);
    memoryDeleteBackups.set(input.batchId, matches);
    matches.forEach((submission) => memorySubmissions.delete(submission.id));
    return { deletedCount: matches.length, backupBatchId: input.batchId };
  }

  await pool.query("BEGIN");
  try {
    const candidates = await pool.query<QueryResultRow>(
      `
        SELECT to_jsonb(ttml_submissions.*) AS row_data, id
        FROM ttml_submissions
        WHERE source = 'community'
          AND song_key = $1
      `,
      [songKey],
    );

    for (const row of candidates.rows) {
      await pool.query(
        `
          INSERT INTO ttml_delete_backups (
            batch_id,
            submission_id,
            row_data,
            actor_discord_id
          )
          VALUES ($1, $2, $3::jsonb, $4)
          ON CONFLICT (batch_id, submission_id) DO NOTHING
        `,
        [input.batchId, row.id, JSON.stringify(row.row_data), input.actor.id],
      );
    }

    const deleted = await pool.query<{ count: string }>(
      `
        WITH deleted AS (
          DELETE FROM ttml_submissions
          WHERE source = 'community'
            AND song_key = $1
          RETURNING id
        )
        SELECT COUNT(*)::text AS count FROM deleted
      `,
      [songKey],
    );
    const deletedCount = Number(deleted.rows[0]?.count ?? 0);
    await writeAuditLog({
      action: "delete_community_ttml",
      actor: input.actor,
      details: {
        batchId: input.batchId,
        artist: input.artist,
        title: input.title,
        deletedCount,
      },
    });
    await pool.query("COMMIT");
    return { deletedCount, backupBatchId: input.batchId };
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

export async function restoreLatestCommunityTtmlBackup(input: {
  actor: DiscordIdentity;
  batchId?: string;
}) {
  if (!pool) {
    const batchId = input.batchId || [...memoryDeleteBackups.keys()].at(-1);
    if (!batchId) return { restoredCount: 0, backupBatchId: undefined };
    const submissions = memoryDeleteBackups.get(batchId) ?? [];
    submissions.forEach((submission) =>
      memorySubmissions.set(submission.id, submission),
    );
    return { restoredCount: submissions.length, backupBatchId: batchId };
  }

  const batchId = input.batchId || (
    await pool.query<{ batch_id: string }>(
      `
        SELECT batch_id
        FROM ttml_delete_backups
        GROUP BY batch_id
        ORDER BY MAX(created_at) DESC
        LIMIT 1
      `,
    )
  ).rows[0]?.batch_id;
  if (!batchId) return { restoredCount: 0, backupBatchId: undefined };

  const restored = await pool.query<{ count: string }>(
    `
      WITH restored AS (
        INSERT INTO ttml_submissions (
          id,
          song,
          file_name,
          ttml_content,
          status,
          created_at,
          message_id,
          channel_id,
          submitter,
          moderator,
          song_key,
          updated_at,
          source
        )
        SELECT
          row_data->>'id',
          row_data->'song',
          row_data->>'file_name',
          row_data->>'ttml_content',
          row_data->>'status',
          (row_data->>'created_at')::BIGINT,
          NULLIF(row_data->>'message_id', ''),
          NULLIF(row_data->>'channel_id', ''),
          row_data->'submitter',
          row_data->'moderator',
          COALESCE(row_data->>'song_key', ''),
          COALESCE((row_data->>'updated_at')::TIMESTAMPTZ, NOW()),
          COALESCE(NULLIF(row_data->>'source', ''), 'community')
        FROM ttml_delete_backups
        WHERE batch_id = $1
        ON CONFLICT (id) DO UPDATE SET
          song = EXCLUDED.song,
          file_name = EXCLUDED.file_name,
          ttml_content = EXCLUDED.ttml_content,
          status = EXCLUDED.status,
          submitter = EXCLUDED.submitter,
          moderator = EXCLUDED.moderator,
          song_key = EXCLUDED.song_key,
          updated_at = NOW(),
          source = EXCLUDED.source
        RETURNING id
      )
      SELECT COUNT(*)::text AS count FROM restored
    `,
    [batchId],
  );
  const restoredCount = Number(restored.rows[0]?.count ?? 0);
  await writeAuditLog({
    action: "restore_community_ttml_backup",
    actor: input.actor,
    details: { batchId, restoredCount },
  });
  return { restoredCount, backupBatchId: batchId };
}

export async function saveSubmission(submission: TTMLSubmission) {
  memorySubmissions.set(submission.id, submission);

  if (!pool) return;

  await pool.query(
    `
      INSERT INTO ttml_submissions (
        id,
        song,
        file_name,
        ttml_content,
        status,
        created_at,
        message_id,
        channel_id,
        submitter,
        moderator,
        song_key,
        updated_at
      )
      VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, NOW())
      ON CONFLICT (id) DO UPDATE SET
        song = EXCLUDED.song,
        file_name = EXCLUDED.file_name,
        ttml_content = EXCLUDED.ttml_content,
        status = EXCLUDED.status,
        message_id = EXCLUDED.message_id,
        channel_id = EXCLUDED.channel_id,
        submitter = EXCLUDED.submitter,
        moderator = EXCLUDED.moderator,
        song_key = EXCLUDED.song_key,
        updated_at = NOW()
    `,
    [
      submission.id,
      JSON.stringify(submission.song),
      submission.fileName,
      submission.ttmlContent,
      submission.status,
      submission.createdAt,
      submission.messageId ?? null,
      submission.channelId ?? null,
      submission.submitter ? JSON.stringify(submission.submitter) : null,
      submission.moderator ? JSON.stringify(submission.moderator) : null,
      createSongKey(submission.song.artist, submission.song.title),
    ],
  );
}

export async function getSubmission(id: string) {
  if (!pool) {
    return memorySubmissions.get(id);
  }

  const result = await pool.query<SubmissionRow>(
    `
      SELECT
        id,
        song,
        file_name,
        ttml_content,
        status,
        created_at,
        message_id,
        channel_id,
        submitter,
        moderator
      FROM ttml_submissions
      WHERE id = $1
    `,
    [id],
  );

  const row = result.rows[0];
  if (!row) return undefined;

  const submission = rowToSubmission(row);
  memorySubmissions.set(submission.id, submission);
  return submission;
}

export async function getPendingSubmissions() {
  if (!pool) {
    return [...memorySubmissions.values()].filter(
      (submission) => submission.status === "pending",
    );
  }

  const result = await pool.query<SubmissionRow>(`
    SELECT
      id,
      song,
      file_name,
      ttml_content,
      status,
      created_at,
      message_id,
      channel_id,
      submitter,
      moderator
    FROM ttml_submissions
    WHERE status = 'pending'
    ORDER BY created_at ASC
  `);

  return result.rows.map(rowToSubmission);
}

export async function countSubmissions() {
  if (!pool) return memorySubmissions.size;

  const result = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM ttml_submissions",
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function getApprovedSubmission(
  artist: string,
  title: string,
  duration?: number,
) {
  const songKey = createSongKey(artist, title);
  const request = { artist, title, duration };

  if (!pool) {
    const approved = [...memorySubmissions.values()]
      .filter(
        (submission) => submission.status === "approved",
      )
      .sort((a, b) => b.createdAt - a.createdAt);
    const exact = approved.find(
      (submission) =>
        createSongKey(submission.song.artist, submission.song.title) === songKey &&
        (!duration ||
          !submission.song.duration ||
          Math.abs(submission.song.duration - duration) <= 5),
    );
    return exact ?? pickBestSongMatch(request, approved);
  }

  const exactResult = await pool.query<SubmissionRow>(
    `
      SELECT
        id,
        song,
        file_name,
        ttml_content,
        status,
        created_at,
        message_id,
        channel_id,
        submitter,
        moderator
      FROM ttml_submissions
      WHERE song_key = $1
        AND status = 'approved'
      ORDER BY updated_at DESC
      LIMIT 10
    `,
    [songKey],
  );

  const exact = exactResult.rows.map(rowToSubmission).find(
    (submission) =>
      !duration ||
      !submission.song.duration ||
      Math.abs(submission.song.duration - duration) <= 5,
  );
  if (exact) return exact;

  const fallbackResult = await pool.query<SubmissionRow>(
    `
      SELECT
        id,
        song,
        file_name,
        ttml_content,
        status,
        created_at,
        message_id,
        channel_id,
        submitter,
        moderator
      FROM ttml_submissions
      WHERE status = 'approved'
      ORDER BY updated_at DESC
      LIMIT 250
    `,
  );
  return pickBestSongMatch(request, fallbackResult.rows.map(rowToSubmission));
}

export async function createDiscordAuthRequest(state: string) {
  const createdAt = Date.now();
  memoryAuthRequests.set(state, {
    status: "pending",
    createdAt,
  });

  if (!pool) return;

  await pool.query(
    `
      INSERT INTO discord_auth_requests (
        state,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, 'pending', $2, NOW())
      ON CONFLICT (state) DO UPDATE SET
        status = 'pending',
        session_token = NULL,
        user_data = NULL,
        created_at = EXCLUDED.created_at,
        updated_at = NOW()
    `,
    [state, createdAt],
  );
}

export async function completeDiscordAuthRequest(
  state: string,
  sessionToken: string,
  tokenHash: string,
  user: DiscordIdentity,
  expiresAt: number,
) {
  memoryAuthRequests.set(state, {
    status: "complete",
    sessionToken,
    user,
    createdAt: Date.now(),
  });
  memoryAuthSessions.set(tokenHash, { user, expiresAt });

  if (!pool) return;

  await pool.query("BEGIN");
  try {
    await pool.query(
      `
        UPDATE discord_auth_requests
        SET
          status = 'complete',
          session_token = $2,
          user_data = $3::jsonb,
          updated_at = NOW()
        WHERE state = $1
      `,
      [state, sessionToken, JSON.stringify(user)],
    );
    await pool.query(
      `
        INSERT INTO discord_auth_sessions (
          token_hash,
          user_data,
          created_at,
          expires_at
        )
        VALUES ($1, $2::jsonb, $3, $4)
        ON CONFLICT (token_hash) DO UPDATE SET
          user_data = EXCLUDED.user_data,
          expires_at = EXCLUDED.expires_at
      `,
      [tokenHash, JSON.stringify(user), Date.now(), expiresAt],
    );
    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

export async function getDiscordAuthRequest(state: string) {
  const maxAge = 10 * 60 * 1000;

  if (!pool) {
    const request = memoryAuthRequests.get(state);
    if (!request || Date.now() - request.createdAt > maxAge) return undefined;
    return request;
  }

  const result = await pool.query<AuthRequestRow>(
    `
      SELECT state, status, session_token, user_data, created_at
      FROM discord_auth_requests
      WHERE state = $1
    `,
    [state],
  );
  const row = result.rows[0];
  if (!row || Date.now() - Number(row.created_at) > maxAge) return undefined;

  return {
    status: row.status,
    sessionToken: row.session_token ?? undefined,
    user: row.user_data ?? undefined,
    createdAt: Number(row.created_at),
  };
}

export async function getDiscordSession(tokenHash: string) {
  if (!pool) {
    const session = memoryAuthSessions.get(tokenHash);
    if (!session || session.expiresAt <= Date.now()) return undefined;
    return session.user;
  }

  const result = await pool.query<AuthSessionRow>(
    `
      SELECT user_data, expires_at
      FROM discord_auth_sessions
      WHERE token_hash = $1
        AND expires_at > $2
    `,
    [tokenHash, Date.now()],
  );

  return result.rows[0]?.user_data;
}

export async function getApprovedSubmissionsByContributor(
  discordId: string,
  limit = 50,
) {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));

  if (!pool) {
    return [...memorySubmissions.values()]
      .filter(
        (submission) =>
          submission.status === "approved" &&
          (submission.submitter?.id === discordId ||
            submission.moderator?.id === discordId),
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, safeLimit);
  }

  const result = await pool.query<SubmissionRow>(
    `
      SELECT
        id,
        song,
        file_name,
        ttml_content,
        status,
        created_at,
        message_id,
        channel_id,
        submitter,
        moderator
      FROM ttml_submissions
      WHERE status = 'approved'
        AND (
          submitter->>'id' = $1
          OR moderator->>'id' = $1
        )
      ORDER BY updated_at DESC
      LIMIT $2
    `,
    [discordId, safeLimit],
  );

  return result.rows.map(rowToSubmission);
}

export async function recordTtmlPlay(submissionId: string, playId: string) {
  if (!pool) {
    const submission = memorySubmissions.get(submissionId);
    if (!submission || submission.status !== "approved") return null;
    const plays = memoryTtmlPlays.get(submissionId) ?? new Set<string>();
    plays.add(playId);
    memoryTtmlPlays.set(submissionId, plays);
    return plays.size;
  }

  const inserted = await pool.query(
    `
      INSERT INTO ttml_play_events (submission_id, play_id)
      SELECT id, $2
      FROM ttml_submissions
      WHERE id = $1 AND status = 'approved'
      ON CONFLICT DO NOTHING
      RETURNING submission_id
    `,
    [submissionId, playId],
  );
  if (!inserted.rowCount) {
    const exists = await pool.query(
      "SELECT 1 FROM ttml_submissions WHERE id = $1 AND status = 'approved'",
      [submissionId],
    );
    if (!exists.rowCount) return null;
  }

  const count = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM ttml_play_events WHERE submission_id = $1",
    [submissionId],
  );
  return Number(count.rows[0]?.count ?? 0);
}

export async function getTtmlPlayCounts(submissionIds: string[]) {
  if (submissionIds.length === 0) return new Map<string, number>();
  if (!pool) {
    return new Map(
      submissionIds.map((id) => [id, memoryTtmlPlays.get(id)?.size ?? 0]),
    );
  }

  const result = await pool.query<{ submission_id: string; count: string }>(
    `
      SELECT submission_id, COUNT(*)::text AS count
      FROM ttml_play_events
      WHERE submission_id = ANY($1::text[])
      GROUP BY submission_id
    `,
    [submissionIds],
  );
  return new Map(
    result.rows.map((row) => [row.submission_id, Number(row.count)]),
  );
}

export async function getDiscordProfile(discordId: string) {
  if (!pool) {
    for (const session of memoryAuthSessions.values()) {
      if (session.expiresAt > Date.now() && session.user.id === discordId) {
        return {...session.user, biography: memoryProfileBiographies.get(discordId) ?? ''};
      }
    }
    return undefined;
  }

  const result = await pool.query<AuthSessionRow>(
    `
      SELECT s.user_data || jsonb_build_object(
        'biography', COALESCE(p.biography, '')
      ) AS user_data, s.expires_at
      FROM discord_auth_sessions s
      LEFT JOIN discord_profile_settings p
        ON p.discord_id = s.user_data->>'id'
      WHERE s.user_data->>'id' = $1
      ORDER BY s.created_at DESC
      LIMIT 1
    `,
    [discordId],
  );

  return result.rows[0]?.user_data;
}

export async function updateDiscordBiography(discordId: string, biography: string) {
  if (!pool) {
    memoryProfileBiographies.set(discordId, biography);
    return;
  }

  await pool.query(
    `
      INSERT INTO discord_profile_settings (discord_id, biography, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (discord_id) DO UPDATE SET
        biography = EXCLUDED.biography,
        updated_at = NOW()
    `,
    [discordId, biography],
  );
}

export async function recordDailyWebVisit(input: {
  day: string;
  visitorHash: string;
}) {
  const visitors = memoryDailyWebVisitors.get(input.day) ?? new Map<string, number>();
  visitors.set(input.visitorHash, (visitors.get(input.visitorHash) ?? 0) + 1);
  memoryDailyWebVisitors.set(input.day, visitors);

  if (!pool) return;

  await pool.query(
    `
      INSERT INTO web_daily_visitors (
        visit_day,
        visitor_hash,
        first_seen_at,
        last_seen_at,
        page_views
      )
      VALUES ($1::date, $2, NOW(), NOW(), 1)
      ON CONFLICT (visit_day, visitor_hash) DO UPDATE SET
        last_seen_at = NOW(),
        page_views = web_daily_visitors.page_views + 1
    `,
    [input.day, input.visitorHash],
  );
}

export async function getDailyWebStats(days = 14): Promise<DailyWebStats[]> {
  const safeDays = Math.max(1, Math.min(90, Math.trunc(days)));

  if (!pool) {
    return [...memoryDailyWebVisitors.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .slice(0, safeDays)
      .map(([day, visitors]) => ({
        day,
        visitors: visitors.size,
        pageViews: [...visitors.values()].reduce((total, count) => total + count, 0),
      }));
  }

  const result = await pool.query<
    QueryResultRow & {
      day: string;
      visitors: string;
      page_views: string;
    }
  >(
    `
      SELECT
        visit_day::text AS day,
        COUNT(*)::text AS visitors,
        COALESCE(SUM(page_views), 0)::text AS page_views
      FROM web_daily_visitors
      GROUP BY visit_day
      ORDER BY visit_day DESC
      LIMIT $1
    `,
    [safeDays],
  );

  return result.rows.map((row) => ({
    day: row.day,
    visitors: Number(row.visitors),
    pageViews: Number(row.page_views),
  }));
}

function isExactSongMatch(song: SongPayload, artist: string, title: string) {
  return (
    normalizeCatalogValue(song.artist) === normalizeCatalogValue(artist) &&
    normalizeCatalogValue(song.title) === normalizeCatalogValue(title)
  );
}

export async function findCatalogSongsExact(artist: string, title: string) {
  const songKey = createSongKey(artist, title);
  const coverSongKey = createCommunityCoverKey(artist, title);
  const songs: SongPayload[] = [];

  if (!pool) {
    const cover = memoryCommunityCovers.get(coverSongKey);
    if (cover) songs.push(cover.song);
    for (const submission of memorySubmissions.values()) {
      if (submission.status === "approved") songs.push(submission.song);
    }
  } else {
    const result = await withDatabaseRetry("cover catalog lookup", () =>
      pool.query<{ song: SongPayload }>(
        `
          SELECT song
          FROM community_covers
          WHERE song_key = $1
          UNION ALL
          SELECT song
          FROM ttml_submissions
          WHERE song_key = $2 AND status = 'approved'
        `,
        [coverSongKey, songKey],
      ),
    );
    songs.push(...result.rows.map((row) => row.song));
  }

  const unique = new Map<string, SongPayload>();
  for (const song of songs) {
    if (!isExactSongMatch(song, artist, title)) continue;
    unique.set(song.id || createSongKey(song.artist, song.title), song);
  }
  return [...unique.values()];
}

export async function isCoverThreadApproved(threadId: string) {
  if (!pool) return memoryApprovedCoverThreads.has(threadId);
  const result = await withDatabaseRetry("cover approval lookup", () =>
    pool.query(
      "SELECT 1 FROM cover_contribution_approvals WHERE thread_id = $1 LIMIT 1",
      [threadId],
    ),
  );
  return result.rowCount !== 0;
}

export async function saveCommunityCover(input: {
  id: string;
  song: SongPayload;
  pngData: Buffer;
  width: number;
  height: number;
  sha256: string;
  originalFileName: string;
  discordAttachmentId: string;
  threadId: string;
  forumId: string;
  submitter: DiscordIdentity;
  moderator: DiscordIdentity;
}) {
  const songKey = createCommunityCoverKey(input.song.artist, input.song.title);

  if (!pool) {
    if (memoryApprovedCoverThreads.has(input.threadId)) {
      throw new CommunityCoverAlreadyApprovedError();
    }
    const now = new Date().toISOString();
    const previous = memoryCommunityCovers.get(songKey);
    const cover: CommunityCover & { pngData: Buffer } = {
      id: input.id,
      song: input.song,
      songKey,
      pngData: input.pngData,
      width: input.width,
      height: input.height,
      byteLength: input.pngData.byteLength,
      sha256: input.sha256,
      originalFileName: input.originalFileName,
      discordAttachmentId: input.discordAttachmentId,
      threadId: input.threadId,
      forumId: input.forumId,
      submitter: input.submitter,
      moderator: input.moderator,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    memoryApprovedCoverThreads.add(input.threadId);
    memoryCommunityCovers.set(songKey, cover);
    return cover;
  }

  return withDatabaseRetry("community cover save", async () => {
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      const approved = await connection.query(
        "SELECT 1 FROM cover_contribution_approvals WHERE thread_id = $1 FOR UPDATE",
        [input.threadId],
      );
      if (approved.rowCount) throw new CommunityCoverAlreadyApprovedError();

      await connection.query(
        `
          INSERT INTO cover_contribution_approvals (
            thread_id, cover_id, song_key, song, discord_attachment_id,
            sha256, submitter, moderator
          )
          VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8::jsonb)
        `,
        [
          input.threadId,
          input.id,
          songKey,
          JSON.stringify(input.song),
          input.discordAttachmentId,
          input.sha256,
          JSON.stringify(input.submitter),
          JSON.stringify(input.moderator),
        ],
      );

      const result = await connection.query<CommunityCoverRow>(
        `
          INSERT INTO community_covers (
            song_key, id, song, png_data, width, height, byte_length, sha256,
            original_file_name, discord_attachment_id, thread_id, forum_id,
            submitter, moderator
          )
          VALUES (
            $1, $2, $3::jsonb, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13::jsonb, $14::jsonb
          )
          ON CONFLICT (song_key) DO UPDATE SET
            id = EXCLUDED.id,
            song = EXCLUDED.song,
            png_data = EXCLUDED.png_data,
            width = EXCLUDED.width,
            height = EXCLUDED.height,
            byte_length = EXCLUDED.byte_length,
            sha256 = EXCLUDED.sha256,
            original_file_name = EXCLUDED.original_file_name,
            discord_attachment_id = EXCLUDED.discord_attachment_id,
            thread_id = EXCLUDED.thread_id,
            forum_id = EXCLUDED.forum_id,
            submitter = EXCLUDED.submitter,
            moderator = EXCLUDED.moderator,
            updated_at = NOW()
          RETURNING *
        `,
        [
          songKey,
          input.id,
          JSON.stringify(input.song),
          input.pngData,
          input.width,
          input.height,
          input.pngData.byteLength,
          input.sha256,
          input.originalFileName,
          input.discordAttachmentId,
          input.threadId,
          input.forumId,
          JSON.stringify(input.submitter),
          JSON.stringify(input.moderator),
        ],
      );
      await connection.query("COMMIT");
      return rowToCommunityCover(result.rows[0]);
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => {});
      if (
        error instanceof CommunityCoverAlreadyApprovedError ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505")
      ) {
        throw new CommunityCoverAlreadyApprovedError();
      }
      throw error;
    } finally {
      connection.release();
    }
  });
}

export async function getCommunityCover(artist: string, title: string) {
  const songKey = createCommunityCoverKey(artist, title);
  if (!pool) {
    const cover =
      memoryCommunityCovers.get(songKey) ??
      pickBestSongMatch(
        { artist, title },
        [...memoryCommunityCovers.values()].map((candidate) => ({
          ...candidate,
          song: candidate.song,
        })),
      );
    if (!cover) return undefined;
    const { pngData: _pngData, ...metadata } = cover;
    return { ...metadata, requestedSongKey: songKey };
  }

  const exactResult = await withDatabaseRetry("community cover lookup", () =>
    pool.query<CommunityCoverRow>(
      "SELECT * FROM community_covers WHERE song_key = $1",
      [songKey],
    ),
  );
  if (exactResult.rows[0]) {
    return {
      ...rowToCommunityCover(exactResult.rows[0]),
      requestedSongKey: songKey,
    };
  }

  const fallbackResult = await withDatabaseRetry(
    "community cover flexible lookup",
    () =>
      pool.query<CommunityCoverRow>(`
        SELECT
          id, song, song_key, width, height, byte_length, sha256,
          original_file_name, discord_attachment_id, thread_id, forum_id,
          submitter, moderator, created_at, updated_at
        FROM community_covers
        ORDER BY updated_at DESC
        LIMIT 500
      `),
  );
  const matched = pickBestSongMatch(
    { artist, title },
    fallbackResult.rows.map(rowToCommunityCover),
  );
  return matched ? { ...matched, requestedSongKey: songKey } : undefined;
}

export async function getCommunityCoversBatch(
  songs: Array<{ artist: string; title: string }>,
) {
  const requests = [
    ...new Map(
      songs.map((song) => [
        createCommunityCoverKey(song.artist, song.title),
        song,
      ]),
    ).entries(),
  ];
  const keys = requests.map(([key]) => key);
  if (keys.length === 0) return [];

  if (!pool) {
    const allCovers = [...memoryCommunityCovers.values()];
    return requests.flatMap(([requestedSongKey, song]) => {
      const exact = memoryCommunityCovers.get(requestedSongKey);
      const matched =
        exact ??
        pickBestSongMatch(
          song,
          allCovers.map((cover) => ({ ...cover, song: cover.song })),
        );
      if (!matched) return [];
      const { pngData: _pngData, ...metadata } = matched;
      return [{ ...metadata, requestedSongKey }];
    });
  }

  const exactResult = await withDatabaseRetry("community cover batch lookup", () =>
    pool.query<CommunityCoverRow>(
      "SELECT * FROM community_covers WHERE song_key = ANY($1::text[])",
      [keys],
    ),
  );
  const exactByKey = new Map(
    exactResult.rows.map((row) => [row.song_key, rowToCommunityCover(row)]),
  );
  const missing = requests.filter(([key]) => !exactByKey.has(key));
  let fallbackCandidates: CommunityCover[] = [];
  if (missing.length > 0) {
    const fallbackResult = await withDatabaseRetry(
      "community cover flexible batch lookup",
      () =>
        pool.query<CommunityCoverRow>(`
          SELECT
            id, song, song_key, width, height, byte_length, sha256,
            original_file_name, discord_attachment_id, thread_id, forum_id,
            submitter, moderator, created_at, updated_at
          FROM community_covers
          ORDER BY updated_at DESC
          LIMIT 500
        `),
    );
    fallbackCandidates = fallbackResult.rows.map(rowToCommunityCover);
  }

  return requests.flatMap(([requestedSongKey, song]) => {
    const cover =
      exactByKey.get(requestedSongKey) ??
      pickBestSongMatch(
        song,
        fallbackCandidates.map((candidate) => ({
          ...candidate,
          song: candidate.song,
        })),
      );
    return cover ? [{ ...cover, requestedSongKey }] : [];
  });
}

export async function getCommunityCoverImage(songKey: string) {
  if (!pool) {
    const cover = memoryCommunityCovers.get(songKey);
    return cover
      ? { pngData: cover.pngData, sha256: cover.sha256, updatedAt: cover.updatedAt }
      : undefined;
  }

  const result = await withDatabaseRetry("community cover image lookup", () =>
    pool.query<{
      png_data: Buffer;
      sha256: string;
      updated_at: Date | string;
    }>(
      "SELECT png_data, sha256, updated_at FROM community_covers WHERE song_key = $1",
      [songKey],
    ),
  );
  const row = result.rows[0];
  return row
    ? { pngData: row.png_data, sha256: row.sha256, updatedAt: toIsoDate(row.updated_at) }
    : undefined;
}

export async function isArtistMediaThreadApproved(
  threadId: string,
  kind: ArtistMediaKind,
) {
  const approvalKey = `${threadId}:${kind}`;
  if (!pool) return memoryApprovedArtistMediaThreads.has(approvalKey);
  const result = await withDatabaseRetry("artist media approval lookup", () =>
    pool.query(
      `SELECT 1 FROM community_artist_media
       WHERE thread_id = $1 AND asset_kind = $2 LIMIT 1`,
      [threadId, kind],
    ),
  );
  return result.rowCount !== 0;
}

export async function saveCommunityArtistMedia(input: {
  id: string;
  artist: ArtistReference;
  kind: ArtistMediaKind;
  pngData: Buffer;
  width: number;
  height: number;
  sha256: string;
  originalFileName: string;
  discordAttachmentId: string;
  threadId: string;
  forumId: string;
  submitter: DiscordIdentity;
  moderator: DiscordIdentity;
}) {
  const artistKey = createCommunityArtistMediaKey(input.artist, input.kind);
  const approvalKey = `${input.threadId}:${input.kind}`;
  const normalizedArtistName = normalizeCommunityCoverPart(input.artist.name);

  if (!pool) {
    if (memoryApprovedArtistMediaThreads.has(approvalKey)) {
      throw new CommunityArtistMediaAlreadyApprovedError();
    }
    const now = new Date().toISOString();
    const previous = memoryCommunityArtistMedia.get(artistKey);
    const media: CommunityArtistMedia & { pngData: Buffer } = {
      id: input.id,
      artist: input.artist,
      artistKey,
      kind: input.kind,
      pngData: input.pngData,
      width: input.width,
      height: input.height,
      byteLength: input.pngData.byteLength,
      sha256: input.sha256,
      originalFileName: input.originalFileName,
      discordAttachmentId: input.discordAttachmentId,
      threadId: input.threadId,
      forumId: input.forumId,
      submitter: input.submitter,
      moderator: input.moderator,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    };
    memoryApprovedArtistMediaThreads.add(approvalKey);
    memoryCommunityArtistMedia.set(artistKey, media);
    return media;
  }

  return withDatabaseRetry("community artist media save", async () => {
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      const approved = await connection.query(
        `SELECT 1 FROM community_artist_media
         WHERE thread_id = $1 AND asset_kind = $2 FOR UPDATE`,
        [input.threadId, input.kind],
      );
      if (approved.rowCount) {
        throw new CommunityArtistMediaAlreadyApprovedError();
      }

      const result = await connection.query<CommunityArtistMediaRow>(
        `
          INSERT INTO community_artist_media (
            artist_key, id, artist, normalized_artist_name, asset_kind,
            png_data, width, height, byte_length, sha256,
            original_file_name, discord_attachment_id, thread_id, forum_id,
            submitter, moderator
          )
          VALUES (
            $1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15::jsonb, $16::jsonb
          )
          ON CONFLICT (artist_key) DO UPDATE SET
            id = EXCLUDED.id,
            artist = EXCLUDED.artist,
            normalized_artist_name = EXCLUDED.normalized_artist_name,
            png_data = EXCLUDED.png_data,
            width = EXCLUDED.width,
            height = EXCLUDED.height,
            byte_length = EXCLUDED.byte_length,
            sha256 = EXCLUDED.sha256,
            original_file_name = EXCLUDED.original_file_name,
            discord_attachment_id = EXCLUDED.discord_attachment_id,
            thread_id = EXCLUDED.thread_id,
            forum_id = EXCLUDED.forum_id,
            submitter = EXCLUDED.submitter,
            moderator = EXCLUDED.moderator,
            updated_at = NOW()
          RETURNING *
        `,
        [
          artistKey,
          input.id,
          JSON.stringify(input.artist),
          normalizedArtistName,
          input.kind,
          input.pngData,
          input.width,
          input.height,
          input.pngData.byteLength,
          input.sha256,
          input.originalFileName,
          input.discordAttachmentId,
          input.threadId,
          input.forumId,
          JSON.stringify(input.submitter),
          JSON.stringify(input.moderator),
        ],
      );
      await connection.query("COMMIT");
      return rowToCommunityArtistMedia(result.rows[0]);
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => {});
      if (
        error instanceof CommunityArtistMediaAlreadyApprovedError ||
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505")
      ) {
        throw new CommunityArtistMediaAlreadyApprovedError();
      }
      throw error;
    } finally {
      connection.release();
    }
  });
}

export async function getCommunityArtistMedia(
  artistName: string,
  kind: ArtistMediaKind,
) {
  const normalizedArtistName = normalizeCommunityCoverPart(artistName);
  if (!pool) {
    return [...memoryCommunityArtistMedia.values()]
      .filter(
        (media) =>
          media.kind === kind &&
          normalizeCommunityCoverPart(media.artist.name) === normalizedArtistName,
      )
      .map(({ pngData: _pngData, ...metadata }) => metadata);
  }

  const result = await withDatabaseRetry("community artist media lookup", () =>
    pool.query<CommunityArtistMediaRow>(
      `SELECT * FROM community_artist_media
       WHERE normalized_artist_name = $1 AND asset_kind = $2
       ORDER BY updated_at DESC`,
      [normalizedArtistName, kind],
    ),
  );
  return result.rows.map(rowToCommunityArtistMedia);
}

export async function getCommunityArtistMediaImage(artistKey: string) {
  if (!pool) {
    const media = memoryCommunityArtistMedia.get(artistKey);
    return media
      ? { pngData: media.pngData, sha256: media.sha256, updatedAt: media.updatedAt }
      : undefined;
  }

  const result = await withDatabaseRetry("community artist media image lookup", () =>
    pool.query<{
      png_data: Buffer;
      sha256: string;
      updated_at: Date | string;
    }>(
      `SELECT png_data, sha256, updated_at
       FROM community_artist_media WHERE artist_key = $1`,
      [artistKey],
    ),
  );
  const row = result.rows[0];
  return row
    ? { pngData: row.png_data, sha256: row.sha256, updatedAt: toIsoDate(row.updated_at) }
    : undefined;
}

export function isDatabaseEnabled() {
  return Boolean(pool);
}

export async function closeSubmissionStore() {
  await pool?.end();
}
