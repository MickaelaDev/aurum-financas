import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { ENTITIES, ENTITY_COLUMNS, ENTITY_TABLE, SCHEMA } from './schema';
import type { Entity } from './types';

type SqlJsStatic = Awaited<ReturnType<typeof initSqlJs>>;

let sqlPromise: Promise<SqlJsStatic> | null = null;

export async function loadSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({ locateFile: () => wasmUrl });
  }
  return sqlPromise;
}

export async function createDatabase(bytes?: Uint8Array): Promise<Database> {
  const SQL = await loadSql();
  const db = new SQL.Database(bytes);
  db.exec(SCHEMA);
  return db;
}

export function all<T>(db: Database, sql: string, params: SqlValue[] = []): T[] {
  const statement = db.prepare(sql);
  try {
    if (params.length > 0) statement.bind(params);
    const rows: T[] = [];
    while (statement.step()) {
      rows.push(statement.getAsObject() as unknown as T);
    }
    return rows;
  } finally {
    statement.free();
  }
}

export function one<T>(db: Database, sql: string, params: SqlValue[] = []): T | null {
  const rows = all<T>(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function run(db: Database, sql: string, params: SqlValue[] = []): void {
  db.run(sql, params);
}

export function getMeta(db: Database, key: string): string | null {
  const row = one<{ value: string }>(db, 'SELECT value FROM _meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

export function setMeta(db: Database, key: string, value: string): void {
  run(db, 'INSERT OR REPLACE INTO _meta (key, value) VALUES (?, ?)', [key, value]);
}

export function nextTimestamp(db: Database): number {
  const current = getMeta(db, 'last_ts');
  const last = current ? Number(current) : 0;
  const timestamp = Math.max(Date.now(), last + 1);
  setMeta(db, 'last_ts', String(timestamp));
  return timestamp;
}

function normalizeValue(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) return value;
  return String(value);
}

function markChange(db: Database, entity: Entity, recordId: string, updatedAt: number): void {
  run(
    db,
    'INSERT OR REPLACE INTO _changes (entity, record_id, updated_at) VALUES (?, ?, ?)',
    [entity, recordId, updatedAt],
  );
}

export function putRecord<T extends { id: string }>(
  db: Database,
  entity: Entity,
  record: T,
): T & { updated_at: number } {
  const columns = ENTITY_COLUMNS[entity];
  const timestamp = nextTimestamp(db);
  const enriched = {
    ...record,
    deleted: 0,
    updated_at: timestamp,
  } as T & { updated_at: number; deleted: number };

  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((column) =>
    normalizeValue((enriched as Record<string, unknown>)[column]),
  );

  run(
    db,
    `INSERT OR REPLACE INTO ${ENTITY_TABLE[entity]} (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
  markChange(db, entity, record.id, timestamp);
  return enriched;
}

export function applyRecord(db: Database, entity: Entity, record: Record<string, unknown>): void {
  const columns = ENTITY_COLUMNS[entity];
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((column) => normalizeValue(record[column]));
  run(
    db,
    `INSERT OR REPLACE INTO ${ENTITY_TABLE[entity]} (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
}

export function softDelete(db: Database, entity: Entity, id: string): void {
  const timestamp = nextTimestamp(db);
  run(db, `UPDATE ${ENTITY_TABLE[entity]} SET deleted = 1, updated_at = ? WHERE id = ?`, [
    timestamp,
    id,
  ]);
  markChange(db, entity, id, timestamp);
}

export function getRecordForSync(
  db: Database,
  entity: Entity,
  id: string,
): Record<string, unknown> | null {
  const columns = ENTITY_COLUMNS[entity];
  const row = one<Record<string, unknown>>(
    db,
    `SELECT ${columns.join(', ')} FROM ${ENTITY_TABLE[entity]} WHERE id = ?`,
    [id],
  );
  return row ?? null;
}

export function pendingChanges(
  db: Database,
  limit = 120,
): Array<{ entity: Entity; record_id: string; updated_at: number }> {
  return all<{ entity: Entity; record_id: string; updated_at: number }>(
    db,
    'SELECT entity, record_id, updated_at FROM _changes ORDER BY updated_at ASC LIMIT ?',
    [limit],
  );
}

export function hasPendingChange(db: Database, entity: Entity, id: string): boolean {
  const row = one<{ record_id: string }>(
    db,
    'SELECT record_id FROM _changes WHERE entity = ? AND record_id = ?',
    [entity, id],
  );
  return row !== null;
}

export function removeChanges(
  db: Database,
  entries: Array<{ entity: Entity; record_id: string; updated_at: number }>,
): void {
  for (const entry of entries) {
    run(
      db,
      'DELETE FROM _changes WHERE entity = ? AND record_id = ? AND updated_at <= ?',
      [entry.entity, entry.record_id, entry.updated_at],
    );
  }
}

export function pendingCount(db: Database): number {
  const row = one<{ total: number }>(db, 'SELECT COUNT(*) AS total FROM _changes');
  return row?.total ?? 0;
}

export function markEverythingDirty(db: Database): void {
  for (const entity of ENTITIES) {
    const rows = all<{ id: string }>(
      db,
      `SELECT id FROM ${ENTITY_TABLE[entity]} WHERE deleted = 0`,
    );
    for (const row of rows) {
      const timestamp = nextTimestamp(db);
      run(db, `UPDATE ${ENTITY_TABLE[entity]} SET updated_at = ? WHERE id = ?`, [
        timestamp,
        row.id,
      ]);
      markChange(db, entity, row.id, timestamp);
    }
  }
}

export function exportData(db: Database): Record<string, unknown> {
  const data: Record<string, unknown[]> = {};
  for (const entity of ENTITIES) {
    data[entity] = all<Record<string, unknown>>(
      db,
      `SELECT * FROM ${ENTITY_TABLE[entity]} WHERE deleted = 0 ORDER BY created_at ASC`,
    );
  }
  return {
    app: 'Aurum',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}
