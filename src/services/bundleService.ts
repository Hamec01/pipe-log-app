import { db } from '../db/db'
import type { BundleRecord, LogRecord, PipeRecord } from '../models/types'
import { listPipesByBundleId } from './pipeService'

export interface BundleSummary {
  bundle: BundleRecord
  logsCount: number
}

function normalizeBundleNumber(bundleNumber: string): string {
  return bundleNumber.trim()
}

export async function createBundle(bundleNumber: string): Promise<BundleRecord> {
  const normalized = normalizeBundleNumber(bundleNumber)
  if (!normalized) {
    throw new Error('Bundle number is required.')
  }

  const id = await db.bundles.add({
    bundle_number: normalized,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'local',
  })

  const created = await db.bundles.get(id)
  if (!created) {
    throw new Error('Could not create bundle.')
  }

  return created
}

export async function getBundleById(bundleId: number): Promise<BundleRecord | undefined> {
  return db.bundles.get(bundleId)
}

export async function getBundleByNumber(bundleNumber: string): Promise<BundleRecord | undefined> {
  const normalized = normalizeBundleNumber(bundleNumber)
  if (!normalized) {
    return undefined
  }

  return db.bundles.where('bundle_number').equals(normalized).first()
}

export async function createBundleIfNotExists(bundleNumber: string): Promise<BundleRecord> {
  const existing = await getBundleByNumber(bundleNumber)
  if (existing) {
    return existing
  }

  return createBundle(bundleNumber)
}

export async function getOrCreateBundleByNumber(bundleNumber: string): Promise<BundleRecord> {
  return createBundleIfNotExists(bundleNumber)
}

export async function listBundles(): Promise<BundleRecord[]> {
  return db.bundles.orderBy('bundle_number').toArray()
}

export async function getAllBundles(): Promise<BundleRecord[]> {
  return listBundles()
}

export async function getLogsByBundle(bundleId: number): Promise<LogRecord[]> {
  const bundleLinks = await db.bundle_pipes.where('bundle_id').equals(bundleId).toArray()
  if (bundleLinks.length === 0) {
    return []
  }

  const pipeIds = [...new Set(bundleLinks.map((link) => link.pipe_id))]
  const logLinks = await db.log_pipes.where('pipe_id').anyOf(pipeIds).toArray()
  const logIds = [...new Set(logLinks.map((link) => link.log_id))]
  if (logIds.length === 0) {
    return []
  }

  const logs = await db.logs.bulkGet(logIds)
  return logs
    .filter((log): log is LogRecord => log != null)
    .sort((a, b) => b.date_time.localeCompare(a.date_time))
}

export async function getPipesByBundle(bundleId: number): Promise<PipeRecord[]> {
  return listPipesByBundleId(bundleId)
}

export async function updateBundle(bundleId: number, patch: Partial<Pick<BundleRecord, 'bundle_number'>>): Promise<BundleRecord> {
  const current = await db.bundles.get(bundleId)
  if (!current) {
    throw new Error('Bundle not found.')
  }

  const nextBundleNumber = patch.bundle_number ? normalizeBundleNumber(patch.bundle_number) : current.bundle_number
  if (!nextBundleNumber) {
    throw new Error('Bundle number is required.')
  }

  await db.bundles.update(bundleId, {
    bundle_number: nextBundleNumber,
    updated_at: new Date().toISOString(),
    sync_status: 'modified',
  })

  const updated = await db.bundles.get(bundleId)
  if (!updated) {
    throw new Error('Could not update bundle.')
  }

  return updated
}

export async function deleteBundle(bundleId: number): Promise<void> {
  await db.transaction('rw', db.bundles, db.bundle_pipes, async () => {
    await db.bundle_pipes.where('bundle_id').equals(bundleId).delete()
    await db.bundles.delete(bundleId)
  })
}

export async function listBundleSummaries(): Promise<BundleSummary[]> {
  const bundles = await listBundles()

  return Promise.all(
    bundles.map(async (bundle) => {
      if (typeof bundle.id !== 'number') {
        return { bundle, logsCount: 0 }
      }

      const logs = await getLogsByBundle(bundle.id)
      return { bundle, logsCount: logs.length }
    }),
  )
}
