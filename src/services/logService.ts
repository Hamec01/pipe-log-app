import { db } from '../db/db'
import type { BundleRecord, LogRecord } from '../models/types'
import { getOrCreateBundleByNumber } from './bundleService'
import { getOrCreatePipes, linkMultiplePipesToLog } from './pipeService'
import { savePhotoBlob } from './photoService'

interface CreateLogInput {
  bundleId: number
  logNumber: string
  pressureBar: number
  dateTimeIso: string
  notes?: string
}

export interface LogSummary {
  log: LogRecord
  pipesCount: number
  photosCount: number
}

export interface CreateLogWithAssetsInput {
  bundle?: BundleRecord
  bundleNumber?: string
  logNumber: string
  pressureBar: number
  dateTimeIso: string
  notes?: string
  pipeNumbers?: string[]
  pipeIds?: number[]
  gaugePhotoFile: File
  sitePhotoFile?: File
}

export interface CreateLogWithAssetsResult {
  log: LogRecord
  linkedPipeCount: number
  photosSavedCount: number
}

function normalizeLogNumber(logNumber: string): string {
  return logNumber.trim()
}

export async function createLog(input: CreateLogInput): Promise<LogRecord> {
  const normalizedLogNumber = normalizeLogNumber(input.logNumber)

  if (!normalizedLogNumber) {
    throw new Error('Log number is required.')
  }

  if (!Number.isFinite(input.pressureBar)) {
    throw new Error('Pressure must be a number.')
  }

  const id = await db.logs.add({
    bundle_id: input.bundleId,
    log_number: normalizedLogNumber,
    pressure_bar: input.pressureBar,
    date_time: input.dateTimeIso,
    notes: input.notes?.trim() || undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'local',
  })

  if (typeof id !== 'number') {
    throw new Error('Could not create log.')
  }

  const created = await db.logs.get(id)
  if (!created) {
    throw new Error('Could not load created log.')
  }

  return created
}

export async function getLogById(logId: number): Promise<LogRecord | undefined> {
  return db.logs.get(logId)
}

export async function listLogs(): Promise<LogRecord[]> {
  const rows = await db.logs.toArray()
  return rows.sort((a, b) => b.date_time.localeCompare(a.date_time))
}

export async function listLogsByBundleId(bundleId: number): Promise<LogRecord[]> {
  const rows = await db.logs.where('bundle_id').equals(bundleId).toArray()
  return rows.sort((a, b) => b.date_time.localeCompare(a.date_time))
}

export async function getLogsByBundle(bundleId: number): Promise<LogRecord[]> {
  return listLogsByBundleId(bundleId)
}

export async function updateLog(logId: number, patch: Partial<Pick<LogRecord, 'log_number' | 'pressure_bar' | 'date_time' | 'notes'>>): Promise<LogRecord> {
  const current = await db.logs.get(logId)
  if (!current) {
    throw new Error('Log not found.')
  }

  const nextLogNumber = patch.log_number ? normalizeLogNumber(patch.log_number) : current.log_number
  if (!nextLogNumber) {
    throw new Error('Log number is required.')
  }

  const nextPressure = typeof patch.pressure_bar === 'number' ? patch.pressure_bar : current.pressure_bar
  if (!Number.isFinite(nextPressure)) {
    throw new Error('Pressure must be a number.')
  }

  await db.logs.update(logId, {
    log_number: nextLogNumber,
    pressure_bar: nextPressure,
    date_time: patch.date_time ?? current.date_time,
    notes: patch.notes ?? current.notes,
    updated_at: new Date().toISOString(),
    sync_status: 'modified',
  })

  const updated = await db.logs.get(logId)
  if (!updated) {
    throw new Error('Could not update log.')
  }

  return updated
}

export async function deleteLog(logId: number): Promise<void> {
  await db.transaction('rw', db.logs, db.log_pipes, db.photos, db.photo_pipes, async () => {
    const photos = await db.photos.where('log_id').equals(logId).toArray()
    const photoIds = photos
      .map((photo) => photo.id)
      .filter((id): id is number => typeof id === 'number')

    await db.log_pipes.where('log_id').equals(logId).delete()
    await db.photos.where('log_id').equals(logId).delete()

    if (photoIds.length > 0) {
      await db.photo_pipes.where('photo_id').anyOf(photoIds).delete()
    }

    await db.logs.delete(logId)
  })
}

export async function createLogWithPipesAndPhotos(input: CreateLogWithAssetsInput): Promise<CreateLogWithAssetsResult> {
  if (!input.gaugePhotoFile) {
    throw new Error('Gauge photo is required.')
  }

  return db.transaction('rw', [db.bundles, db.logs, db.pipes, db.log_pipes, db.photos], async () => {
    let bundle: BundleRecord | undefined = input.bundle

    if (!bundle) {
      const bundleNumber = input.bundleNumber?.trim()
      if (!bundleNumber) {
        throw new Error('Bundle number is required.')
      }

      console.log('[save] creating/reusing bundle', { bundleNumber })
      bundle = await getOrCreateBundleByNumber(bundleNumber)
    } else {
      console.log('[save] creating/reusing bundle', { bundleNumber: bundle.bundle_number })
    }

    if (typeof bundle.id !== 'number') {
      throw new Error('Bundle ID is missing.')
    }

    console.log('[save] creating log', { bundleId: bundle.id, logNumber: input.logNumber })
    const log = await createLog({
      bundleId: bundle.id,
      logNumber: input.logNumber,
      pressureBar: input.pressureBar,
      dateTimeIso: input.dateTimeIso,
      notes: input.notes,
    })

    if (typeof log.id !== 'number') {
      throw new Error('Log ID is missing after creation.')
    }

    const incomingPipeIds = input.pipeIds ?? []
    let resolvedPipeIds = incomingPipeIds

    if (resolvedPipeIds.length === 0 && input.pipeNumbers && input.pipeNumbers.length > 0) {
      console.log('[save] saving pipes', { count: input.pipeNumbers.length })
      const pipes = await getOrCreatePipes(bundle.id, input.pipeNumbers)
      resolvedPipeIds = pipes
        .map((pipe) => pipe.id)
        .filter((id): id is number => typeof id === 'number')
    } else {
      console.log('[save] saving pipes', { count: resolvedPipeIds.length })
    }

    console.log('[save] saving log_pipes', { count: resolvedPipeIds.length })
    const links = await linkMultiplePipesToLog(log.id, resolvedPipeIds)

    console.log('[save] saving photos', { gauge: true, site: Boolean(input.sitePhotoFile) })
    await savePhotoBlob({
      logId: log.id,
      file: input.gaugePhotoFile,
      kind: 'gauge',
    })

    let photosSavedCount = 1

    if (input.sitePhotoFile) {
      await savePhotoBlob({
        logId: log.id,
        file: input.sitePhotoFile,
        kind: 'site',
      })
      photosSavedCount += 1
    }

    return {
      log,
      linkedPipeCount: links.length,
      photosSavedCount,
    }
  })
}

export async function createLogWithPipesAndGaugePhoto(input: {
  bundle: BundleRecord
  logNumber: string
  pressureBar: number
  dateTimeIso: string
  notes?: string
  pipeNumbers: string[]
  gaugePhotoFile: File
}): Promise<{ log: LogRecord; linkedPipeCount: number }> {
  if (typeof input.bundle.id !== 'number') {
    throw new Error('Bundle ID is missing.')
  }

  const result = await createLogWithPipesAndPhotos({
    bundle: input.bundle,
    logNumber: input.logNumber,
    pressureBar: input.pressureBar,
    dateTimeIso: input.dateTimeIso,
    notes: input.notes,
    pipeNumbers: input.pipeNumbers,
    gaugePhotoFile: input.gaugePhotoFile,
  })

  return {
    log: result.log,
    linkedPipeCount: result.linkedPipeCount,
  }
}

export async function listLogSummariesByBundleId(bundleId: number): Promise<LogSummary[]> {
  const logs = await listLogsByBundleId(bundleId)

  return Promise.all(
    logs.map(async (log) => {
      const logId = log.id
      if (typeof logId !== 'number') {
        return {
          log,
          pipesCount: 0,
          photosCount: 0,
        }
      }

      const [pipesCount, photosCount] = await Promise.all([
        db.log_pipes.where('log_id').equals(logId).count(),
        db.photos.where('log_id').equals(logId).count(),
      ])

      return {
        log,
        pipesCount,
        photosCount,
      }
    }),
  )
}
