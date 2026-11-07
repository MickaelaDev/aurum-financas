import type { Database } from 'sql.js';
import { ApiError, api } from './api';
import { decryptText, encryptText } from './crypto';
import {
  applyRecord,
  getMeta,
  getRecordForSync,
  hasPendingChange,
  markEverythingDirty,
  pendingChanges,
  pendingCount,
  removeChanges,
  setMeta,
} from './db';
import { ENTITIES } from './schema';
import type { Entity, SyncState } from './types';

const ENTITY_SET = new Set<string>(ENTITIES);

type RemoteRecord = {
  seq: number;
  entity: string;
  id: string;
  payload: string;
  updatedAt: number;
};

async function applyRemoteRecords(
  db: Database,
  key: CryptoKey,
  records: RemoteRecord[],
): Promise<number> {
  let applied = 0;

  for (const record of records) {
    if (!ENTITY_SET.has(record.entity)) continue;
    const entity = record.entity as Entity;
    if (hasPendingChange(db, entity, record.id)) continue;

    const json = await decryptText(key, record.payload);
    const payload = JSON.parse(json) as unknown;
    if (!payload || typeof payload !== 'object') continue;

    const local = getRecordForSync(db, entity, record.id);
    if (local && Number(local.updated_at ?? 0) >= record.updatedAt) continue;

    applyRecord(db, entity, payload as Record<string, unknown>);
    applied += 1;
  }

  return applied;
}

export async function pullInitial(db: Database, key: CryptoKey): Promise<number> {
  let cursor = Number(getMeta(db, 'sync_cursor') ?? 0) || 0;
  let applied = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await api.pull(cursor, 400);
    applied += await applyRemoteRecords(db, key, response.records);
    cursor = response.cursor;
    setMeta(db, 'sync_cursor', String(cursor));
    hasMore = response.hasMore;
  }

  return applied;
}

type SyncEngineOptions = {
  db: Database;
  key: CryptoKey;
  onState: (state: SyncState) => void;
  onApplied: () => void;
};

export class SyncEngine {
  private db: Database;
  private key: CryptoKey;
  private onState: (state: SyncState) => void;
  private onApplied: () => void;
  private cursor: number;
  private lastSyncAt: number | null;
  private running = false;
  private queued = false;
  private stopped = true;
  private timer: number | null = null;
  private pollTimer: number | null = null;

  constructor(options: SyncEngineOptions) {
    this.db = options.db;
    this.key = options.key;
    this.onState = options.onState;
    this.onApplied = options.onApplied;
    this.cursor = Number(getMeta(options.db, 'sync_cursor') ?? 0) || 0;
    const stored = Number(getMeta(options.db, 'last_sync_at') ?? 0);
    this.lastSyncAt = stored > 0 ? stored : null;
  }

  start(): void {
    this.stopped = false;
    this.emit('idle');
    this.schedule(500);
    this.pollTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') this.schedule(0);
    }, 120_000);
    window.addEventListener('online', this.handleOnline);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pollTimer) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    window.removeEventListener('online', this.handleOnline);
  }

  schedule(delay = 1200): void {
    if (this.stopped) return;
    if (!navigator.onLine) {
      this.emit('offline');
      return;
    }
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      void this.sync();
    }, delay);
  }

  async syncNow(): Promise<void> {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    await this.sync();
  }

  async resyncAll(): Promise<void> {
    markEverythingDirty(this.db);
    setMeta(this.db, 'sync_cursor', '0');
    this.cursor = 0;
    await this.syncNow();
  }

  private handleOnline = (): void => {
    this.schedule(300);
  };

  private emit(status: SyncState['status'], message?: string): void {
    this.onState({
      status,
      lastSyncAt: this.lastSyncAt,
      pending: pendingCount(this.db),
      message,
    });
  }

  private async sync(): Promise<void> {
    if (this.stopped) return;
    if (this.running) {
      this.queued = true;
      return;
    }
    if (!navigator.onLine) {
      this.emit('offline');
      return;
    }

    this.running = true;
    this.emit('syncing');
    let applied = false;

    try {
      for (;;) {
        const changes = pendingChanges(this.db, 100);
        if (changes.length === 0) break;

        const payloads: Array<{
          entity: string;
          id: string;
          updatedAt: number;
          payload: string;
        }> = [];
        const sent: Array<{ entity: Entity; record_id: string; updated_at: number }> = [];

        for (const change of changes) {
          if (!ENTITY_SET.has(change.entity)) {
            removeChanges(this.db, [change]);
            continue;
          }
          const record = getRecordForSync(this.db, change.entity, change.record_id);
          if (!record) {
            removeChanges(this.db, [change]);
            continue;
          }
          const updatedAt = Number(record.updated_at ?? change.updated_at);
          const payload = await encryptText(this.key, JSON.stringify(record));
          payloads.push({
            entity: change.entity,
            id: change.record_id,
            updatedAt,
            payload,
          });
          sent.push({
            entity: change.entity,
            record_id: change.record_id,
            updated_at: updatedAt,
          });
        }

        if (payloads.length === 0) break;
        await api.push(payloads);
        removeChanges(this.db, sent);
      }

      let hasMore = true;
      while (hasMore) {
        const response = await api.pull(this.cursor, 400);
        const count = await applyRemoteRecords(this.db, this.key, response.records);
        if (count > 0) applied = true;
        this.cursor = response.cursor;
        setMeta(this.db, 'sync_cursor', String(this.cursor));
        hasMore = response.hasMore;
      }

      this.lastSyncAt = Date.now();
      setMeta(this.db, 'last_sync_at', String(this.lastSyncAt));
      if (applied) this.onApplied();
      this.emit('idle');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.offline) this.emit('offline');
        else if (error.status === 401) this.emit('auth');
        else this.emit('error', error.message);
      } else {
        this.emit('error', 'Não foi possível sincronizar agora.');
      }
    } finally {
      this.running = false;
      if (this.queued && !this.stopped) {
        this.queued = false;
        this.schedule(700);
      }
    }
  }
}
