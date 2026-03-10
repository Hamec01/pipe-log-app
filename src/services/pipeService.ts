import { db } from '../db/db'
import type { LogPipeRecord, PipeRecord } from '../models/types'

function normalizePipeNumber(pipeNumber: string): string {
  return pipeNumber.trim()
}

export async function createPipe(bundleId: number, pipeNumber: string): Promise<PipeRecord> {
  const normalized = normalizePipeNumber(pipeNumber)
  if (!normalized) {
    throw new Error('Pipe number is required.')
  }

  const id = await db.pipes.add({
    bundle_id: bundleId,
    pipe_number: normalized,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'local',
  })

  if (typeof id !== 'number') {
    throw new Error('Could not create pipe.')
  }

  const created = await db.pipes.get(id)
  if (!created) {
    throw new Error('Could not load created pipe.')
  }

  return created
}

export async function getPipeById(pipeId: number): Promise<PipeRecord | undefined> {
  return db.pipes.get(pipeId)
}

export async function getPipeByNumberAndBundle(bundleId: number, pipeNumber: string): Promise<PipeRecord | undefined> {
  const normalized = normalizePipeNumber(pipeNumber)
  if (!normalized) {
    return undefined
  }

  return db.pipes
    .where('[bundle_id+pipe_number]')
    .equals([bundleId, normalized])
    .first()
}

export async function createPipeIfNotExists(bundleId: number, pipeNumber: string): Promise<PipeRecord> {
  const existing = await getPipeByNumberAndBundle(bundleId, pipeNumber)
  if (existing) {
    return existing
  }

  return createPipe(bundleId, pipeNumber)
}

export async function getOrCreatePipes(bundleId: number, pipeNumbers: string[]): Promise<PipeRecord[]> {
  const unique = new Set(
    pipeNumbers
      .map((value) => normalizePipeNumber(value))
      .filter((value) => value.length > 0),
  )

  const result: PipeRecord[] = []
  for (const pipeNumber of unique) {
    const pipe = await createPipeIfNotExists(bundleId, pipeNumber)
    result.push(pipe)
  }

  return result
}

export async function listPipesByBundleId(bundleId: number): Promise<PipeRecord[]> {
  return db.pipes.where('bundle_id').equals(bundleId).sortBy('pipe_number')
}

export async function listPipesByLogId(logId: number): Promise<PipeRecord[]> {
  const links = await listLogPipeLinksByLogId(logId)
  if (links.length === 0) {
    return []
  }

  const pipeIds = links.map((link) => link.pipe_id)
  const rows = await db.pipes.bulkGet(pipeIds)

  return rows
    .filter((row): row is PipeRecord => row != null)
    .sort((a, b) => a.pipe_number.localeCompare(b.pipe_number))
}

export async function updatePipe(pipeId: number, patch: Partial<Pick<PipeRecord, 'pipe_number'>>): Promise<PipeRecord> {
  const current = await db.pipes.get(pipeId)
  if (!current) {
    throw new Error('Pipe not found.')
  }

  const nextPipeNumber = patch.pipe_number ? normalizePipeNumber(patch.pipe_number) : current.pipe_number
  if (!nextPipeNumber) {
    throw new Error('Pipe number is required.')
  }

  await db.pipes.update(pipeId, {
    pipe_number: nextPipeNumber,
    updated_at: new Date().toISOString(),
    sync_status: 'modified',
  })

  const updated = await db.pipes.get(pipeId)
  if (!updated) {
    throw new Error('Could not update pipe.')
  }

  return updated
}

export async function deletePipe(pipeId: number): Promise<void> {
  await db.transaction('rw', db.pipes, db.log_pipes, db.photo_pipes, async () => {
    await db.log_pipes.where('pipe_id').equals(pipeId).delete()
    await db.photo_pipes.where('pipe_id').equals(pipeId).delete()
    await db.pipes.delete(pipeId)
  })
}

export async function linkPipeToLog(logId: number, pipeId: number): Promise<LogPipeRecord> {
  const existing = await db.log_pipes
    .where('[log_id+pipe_id]')
    .equals([logId, pipeId])
    .first()

  if (existing) {
    return existing
  }

  const id = await db.log_pipes.add({
    log_id: logId,
    pipe_id: pipeId,
    created_at: new Date().toISOString(),
    sync_status: 'local',
  })

  if (typeof id !== 'number') {
    throw new Error('Could not link pipe to log.')
  }

  const created = await db.log_pipes.get(id)
  if (!created) {
    throw new Error('Could not load created log-pipe link.')
  }

  return created
}

export async function linkMultiplePipesToLog(logId: number, pipeIds: number[]): Promise<LogPipeRecord[]> {
  const result: LogPipeRecord[] = []
  const uniquePipeIds = [...new Set(pipeIds)]

  for (const pipeId of uniquePipeIds) {
    const link = await linkPipeToLog(logId, pipeId)
    result.push(link)
  }

  return result
}

export async function listLogPipeLinksByLogId(logId: number): Promise<LogPipeRecord[]> {
  return db.log_pipes.where('log_id').equals(logId).toArray()
}

export async function unlinkPipeFromLog(logId: number, pipeId: number): Promise<void> {
  const links = await db.log_pipes
    .where('[log_id+pipe_id]')
    .equals([logId, pipeId])
    .toArray()

  for (const link of links) {
    if (typeof link.id === 'number') {
      await db.log_pipes.delete(link.id)
    }
  }
}

export async function clearLogPipeLinks(logId: number): Promise<void> {
  await db.log_pipes.where('log_id').equals(logId).delete()
}
