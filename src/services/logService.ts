import { db } from '../db/db'
import type { LogRecord } from '../models/types'
import { getOrCreateBundleByNumber } from './bundleService'
import { savePhotoBlob } from './photoService'
import { getOrCreatePipeForBundle, linkMultiplePipesToLog, listBundlePipeGroupsByLogId } from './pipeService'

interface CreateLogInput {
  logNumber: string
  pressureBar: number
  dateTimeIso: string
  notes?: string
}

export interface BundlePipeGroupInput {
  bundleNumber: string
  pipeNumbers: string[]
}

export interface CreateLogWithAssetsInput {
  logNumber: string
  pressureBar: number
  dateTimeIso: string
  notes?: string
  bundleGroups: BundlePipeGroupInput[]
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

function normalizePipeNumbers(pipeNumbers: string[]): string[] {
  return [...new Set(pipeNumbers.map((value) => value.trim()).filter((value) => value.length > 0))]
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
    log_number: normalizedLogNumber,
    pressure_bar: input.pressureBar,
    date_time: input.dateTimeIso,
    notes: input.notes?.trim() || undefined,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'local',
  })

  const created = await db.logs.get(id)
  if (!created) {
    throw new Error('Could not create log.')
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

export async function deleteLog(logId: number): Promise<void> {
  await db.transaction('rw', db.logs, db.log_pipes, db.photos, async () => {
    await db.log_pipes.where('log_id').equals(logId).delete()
    await db.photos.where('log_id').equals(logId).delete()
    await db.logs.delete(logId)
  })
}

export async function createLogWithBundleGroupsAndPhotos(input: CreateLogWithAssetsInput): Promise<CreateLogWithAssetsResult> {
  if (!input.gaugePhotoFile) {
    throw new Error('Gauge photo is required.')
  }

  if (input.bundleGroups.length === 0) {
    throw new Error('Add at least one bundle group.')
  }

  return db.transaction('rw', [db.bundles, db.pipes, db.bundle_pipes, db.logs, db.log_pipes, db.photos], async () => {
    const log = await createLog({
      logNumber: input.logNumber,
      pressureBar: input.pressureBar,
      dateTimeIso: input.dateTimeIso,
      notes: input.notes,
    })

    if (typeof log.id !== 'number') {
      throw new Error('Log ID is missing.')
    }

    const allPipeIds: number[] = []

    for (const group of input.bundleGroups) {
      const bundleNumber = group.bundleNumber.trim()
      if (!bundleNumber) {
        throw new Error('Bundle number is required in every group.')
      }

      const parsedPipeNumbers = normalizePipeNumbers(group.pipeNumbers)
      if (parsedPipeNumbers.length === 0) {
        throw new Error(`Bundle ${bundleNumber} has no valid pipe numbers.`)
      }

      const bundle = await getOrCreateBundleByNumber(bundleNumber)
      if (typeof bundle.id !== 'number') {
        throw new Error(`Bundle ${bundleNumber} has no ID.`)
      }

      for (const pipeNumber of parsedPipeNumbers) {
        const pipe = await getOrCreatePipeForBundle(bundle.id, pipeNumber)
        if (typeof pipe.id !== 'number') {
          throw new Error(`Pipe ${pipeNumber} has no ID.`)
        }

        allPipeIds.push(pipe.id)
      }
    }

    const links = await linkMultiplePipesToLog(log.id, allPipeIds)

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

export async function getBundleGroupsForLog(logId: number): Promise<Array<{ bundleId: number; bundleNumber: string; pipeNumbers: string[] }>> {
  const groups = await listBundlePipeGroupsByLogId(logId)

  return groups.map((group) => ({
    bundleId: group.bundle.id ?? 0,
    bundleNumber: group.bundle.bundle_number,
    pipeNumbers: group.pipes.map((pipe) => pipe.pipe_number),
  }))
}
