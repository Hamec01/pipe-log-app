import { db } from '../db/db'
import type { SyncStatus } from '../models/types'

interface PendingSyncResult {
  bundles: number
  logs: number
  pipes: number
  log_pipes: number
  photos: number
  photo_pipes: number
}

const PENDING_STATUSES: SyncStatus[] = ['local', 'modified', 'deleted']

export async function getPendingSyncItems(): Promise<PendingSyncResult> {
  const [bundles, logs, pipes, log_pipes, photos, photo_pipes] = await Promise.all([
    db.bundles.where('sync_status').anyOf(PENDING_STATUSES).count(),
    db.logs.where('sync_status').anyOf(PENDING_STATUSES).count(),
    db.pipes.where('sync_status').anyOf(PENDING_STATUSES).count(),
    db.log_pipes.where('sync_status').anyOf(PENDING_STATUSES).count(),
    db.photos.where('sync_status').anyOf(PENDING_STATUSES).count(),
    db.photo_pipes.where('sync_status').anyOf(PENDING_STATUSES).count(),
  ])

  return {
    bundles,
    logs,
    pipes,
    log_pipes,
    photos,
    photo_pipes,
  }
}

export async function getSoftDeletedItems(): Promise<PendingSyncResult> {
  const [bundles, logs, pipes, log_pipes, photos, photo_pipes] = await Promise.all([
    db.bundles.where('sync_status').equals('deleted').count(),
    db.logs.where('sync_status').equals('deleted').count(),
    db.pipes.where('sync_status').equals('deleted').count(),
    db.log_pipes.where('sync_status').equals('deleted').count(),
    db.photos.where('sync_status').equals('deleted').count(),
    db.photo_pipes.where('sync_status').equals('deleted').count(),
  ])

  return {
    bundles,
    logs,
    pipes,
    log_pipes,
    photos,
    photo_pipes,
  }
}

type SyncTableName = 'bundles' | 'logs' | 'pipes' | 'log_pipes' | 'photos' | 'photo_pipes'

export async function markAsSynced(table: SyncTableName, id: number, remoteId?: string): Promise<void> {
  const now = new Date().toISOString()
  const target = db[table]

  // Dexie table access is dynamic here because sync worker may target any entity.
  await target.update(id, {
    sync_status: 'synced',
    remote_id: remoteId,
    updated_at: now,
    deleted_at: null,
  } as never)
}
