import { Pool, type QueryResultRow } from "pg";

export type SubmissionStatus = "pending" | "approved" | "rejected";

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

export type TTMLSubmission = {
  id: string;
  song: SongPayload;
  fileName: string;
  ttmlContent: string;
  status: SubmissionStatus;
  createdAt: number;
  messageId?: string;
  channelId?: string;
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
  moderator: TTMLSubmission["moderator"] | null;
};

const memorySubmissions = new Map<string, TTMLSubmission>();
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
    moderator: row.moderator ?? undefined,
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
      moderator JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

  console.log("PostgreSQL submission store connected");
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
        moderator,
        updated_at
      )
      VALUES ($1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET
        song = EXCLUDED.song,
        file_name = EXCLUDED.file_name,
        ttml_content = EXCLUDED.ttml_content,
        status = EXCLUDED.status,
        message_id = EXCLUDED.message_id,
        channel_id = EXCLUDED.channel_id,
        moderator = EXCLUDED.moderator,
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
      submission.moderator ? JSON.stringify(submission.moderator) : null,
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

export async function countSubmissions() {
  if (!pool) return memorySubmissions.size;

  const result = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM ttml_submissions",
  );
  return Number(result.rows[0]?.count ?? 0);
}

export function isDatabaseEnabled() {
  return Boolean(pool);
}

export async function closeSubmissionStore() {
  await pool?.end();
}
