import { db } from '../db/db'
import type { BundleRecord } from '../models/types'

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

  const createdId = await db.bundles.add({
    bundle_number: normalized,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'local',
  })

  if (typeof createdId !== 'number') {
    throw new Error('Could not create bundle.')
  }

  const created = await db.bundles.get(createdId)
  if (!created) {
    throw new Error('Could not load created bundle.')
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
  await db.transaction('rw', [db.bundles, db.logs, db.pipes, db.log_pipes, db.photos, db.photo_pipes], async () => {
    const logs = await db.logs.where('bundle_id').equals(bundleId).toArray()
    const logIds = logs.map((log) => log.id).filter((id): id is number => typeof id === 'number')

    if (logIds.length > 0) {
      const photos = await db.photos.where('log_id').anyOf(logIds).toArray()
      const photoIds = photos.map((photo) => photo.id).filter((id): id is number => typeof id === 'number')

      await db.log_pipes.where('log_id').anyOf(logIds).delete()
      await db.photos.where('log_id').anyOf(logIds).delete()

      if (photoIds.length > 0) {
        await db.photo_pipes.where('photo_id').anyOf(photoIds).delete()
      }

      await db.logs.where('bundle_id').equals(bundleId).delete()
    }

    await db.pipes.where('bundle_id').equals(bundleId).delete()
    await db.bundles.delete(bundleId)
  })
}

export async function listBundleSummaries(): Promise<BundleSummary[]> {
  const bundles = await listBundles()

  return Promise.all(
    bundles.map(async (bundle) => {
      const bundleId = bundle.id
      if (typeof bundleId !== 'number') {
        return { bundle, logsCount: 0 }
      }

      const logsCount = await db.logs.where('bundle_id').equals(bundleId).count()
      return { bundle, logsCount }
    }),
  )
}
