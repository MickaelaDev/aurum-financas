import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'aurum.sqlite'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    username_norm TEXT NOT NULL UNIQUE,
    pin_hash TEXT NOT NULL,
    vault_salt TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS sync_records (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity TEXT NOT NULL,
    record_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(user_id, entity, record_id)
  );

  CREATE INDEX IF NOT EXISTS idx_sync_pull ON sync_records(user_id, seq);
  CREATE INDEX IF NOT EXISTS idx_sync_owner ON sync_records(user_id, entity, record_id);
`);

export type UserRow = {
  id: string;
  username: string;
  username_norm: string;
  pin_hash: string;
  vault_salt: string;
  created_at: number;
};

export type SyncRecordInput = {
  entity: string;
  id: string;
  updated_at: number;
  payload: string;
};

export type SyncRecordRow = {
  seq: number;
  entity: string;
  record_id: string;
  payload: string;
  updated_at: number;
};

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(pin, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const derived = scryptSync(pin, salt, 64);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function createUser(username: string, pinHash: string): UserRow {
  const user: UserRow = {
    id: randomUUID(),
    username: username.trim(),
    username_norm: normalizeUsername(username),
    pin_hash: pinHash,
    vault_salt: randomBytes(16).toString('base64'),
    created_at: Date.now(),
  };

  db.prepare(
    `INSERT INTO users (id, username, username_norm, pin_hash, vault_salt, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(user.id, user.username, user.username_norm, user.pin_hash, user.vault_salt, user.created_at);

  return user;
}

export function findUserByNorm(normalized: string): UserRow | null {
  const row = db
    .prepare('SELECT * FROM users WHERE username_norm = ?')
    .get(normalized) as UserRow | undefined;
  return row ?? null;
}

export function findUserById(id: string): UserRow | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row ?? null;
}

export function createSession(userId: string): string {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  ).run(sha256(token), userId, now, now + SESSION_TTL_MS);
  return token;
}

export function sessionUser(token: string): UserRow | null {
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(sha256(token), Date.now()) as UserRow | undefined;
  return row ?? null;
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function purgeExpiredSessions(): void {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
}

export function upsertSyncRecords(userId: string, records: SyncRecordInput[]): number {
  const find = db.prepare(
    'SELECT updated_at FROM sync_records WHERE user_id = ? AND entity = ? AND record_id = ?',
  );
  const remove = db.prepare(
    'DELETE FROM sync_records WHERE user_id = ? AND entity = ? AND record_id = ?',
  );
  const insert = db.prepare(
    `INSERT INTO sync_records (user_id, entity, record_id, payload, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  );

  let accepted = 0;

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const record of records) {
      const current = find.get(userId, record.entity, record.id) as
        | { updated_at: number }
        | undefined;
      if (current && current.updated_at > record.updated_at) continue;

      remove.run(userId, record.entity, record.id);
      insert.run(userId, record.entity, record.id, record.payload, record.updated_at);
      accepted += 1;
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return accepted;
}

export function pullSyncRecords(
  userId: string,
  since: number,
  limit: number,
): SyncRecordRow[] {
  return db
    .prepare(
      `SELECT seq, entity, record_id, payload, updated_at
       FROM sync_records
       WHERE user_id = ? AND seq > ?
       ORDER BY seq ASC
       LIMIT ?`,
    )
    .all(userId, since, limit) as SyncRecordRow[];
}
