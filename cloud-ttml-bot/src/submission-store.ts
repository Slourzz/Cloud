import { Pool, type QueryResultRow } from "pg";

export type SubmissionStatus = "pending" | "approved" | "rejected";
export type MaintenanceType = "lyrics" | "global";
export type MaintenanceStatus = "scheduled" | "active" | "ended" | "cancelled";

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
    comment: string;
  };
};

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

const memorySubmissions = new Map<string, TTMLSubmission>();
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
const memoryMaintenanceEvents = new Map<string, MaintenanceEvent>();
const memoryMaintenanceAcknowledgements = new Map<string, number>();
const memoryDeleteBackups = new Map<string, TTMLSubmission[]>();
const databaseUrl = process.env.DATABASE_URL;
const useSsl = process.env.DATABASE_SSL === "true";

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null;

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

  if (!pool) {
    return [...memorySubmissions.values()]
      .filter(
        (submission) =>
          submission.status === "approved" &&
          createSongKey(submission.song.artist, submission.song.title) ===
            songKey,
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .find(
        (submission) =>
          !duration ||
          !submission.song.duration ||
          Math.abs(submission.song.duration - duration) <= 5,
      );
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
      WHERE song_key = $1
        AND status = 'approved'
      ORDER BY updated_at DESC
      LIMIT 10
    `,
    [songKey],
  );

  const submissions = result.rows.map(rowToSubmission);
  return submissions.find(
    (submission) =>
      !duration ||
      !submission.song.duration ||
      Math.abs(submission.song.duration - duration) <= 5,
  );
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

export async function getDiscordProfile(discordId: string) {
  if (!pool) {
    for (const session of memoryAuthSessions.values()) {
      if (session.expiresAt > Date.now() && session.user.id === discordId) return session.user;
    }
    return undefined;
  }

  const result = await pool.query<AuthSessionRow>(
    `
      SELECT user_data, expires_at
      FROM discord_auth_sessions
      WHERE user_data->>'id' = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [discordId],
  );

  return result.rows[0]?.user_data;
}

export function isDatabaseEnabled() {
  return Boolean(pool);
}

export async function closeSubmissionStore() {
  await pool?.end();
}
