import { db } from '../db/db'

interface SyncCounts {
  bundles: number
  logs: number
  pipes: number
  bundle_pipes: number
  log_pipes: number
  photos: number
}

const PENDING_STATUSES = ['local', 'modified'] as const

type SyncTableName = 'bundles' | 'logs' | 'pipes' | 'bundle_pipes' | 'log_pipes' | 'photos'

export async function getPendingSyncCounts(): Promise<SyncCounts> {
  const [bundles, logs, pipes, bundle_pipes, log_pipes, photos] = await Promise.all([
    db.bundles.where('sync_status').anyOf(PENDING_STATUSES).count(),
    db.logs.where('sync_status').anyOf(PENDING_STATUSES).count(),
    db.pipes.where('sync_status').anyOf(PENDING_STATUSES).count(),
    db.bundle_pipes.where('sync_status').anyOf(PENDING_STATUSES).count(),
    db.log_pipes.where('sync_status').anyOf(PENDING_STATUSES).count(),
    db.photos.where('sync_status').anyOf(PENDING_STATUSES).count(),
  ])

  return { bundles, logs, pipes, bundle_pipes, log_pipes, photos }
}

export async function getDeletedSyncCounts(): Promise<SyncCounts> {
  const [bundles, logs, pipes, bundle_pipes, log_pipes, photos] = await Promise.all([
    db.bundles.where('sync_status').equals('deleted').count(),
    db.logs.where('sync_status').equals('deleted').count(),
    db.pipes.where('sync_status').equals('deleted').count(),
    db.bundle_pipes.where('sync_status').equals('deleted').count(),
    db.log_pipes.where('sync_status').equals('deleted').count(),
    db.photos.where('sync_status').equals('deleted').count(),
  ])

  return { bundles, logs, pipes, bundle_pipes, log_pipes, photos }
}

export async function markTableAsSynced(table: SyncTableName): Promise<number> {
  return db.table(table).where('sync_status').anyOf(PENDING_STATUSES).modify({
    sync_status: 'synced',
  })
}

export async function markAllAsSynced(): Promise<Record<SyncTableName, number>> {
  const result: Record<SyncTableName, number> = {
    bundles: 0,
    logs: 0,
    pipes: 0,
    bundle_pipes: 0,
    log_pipes: 0,
    photos: 0,
  }

  for (const table of Object.keys(result) as SyncTableName[]) {
    result[table] = await markTableAsSynced(table)
  }

  return result
}
