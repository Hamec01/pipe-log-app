import { db } from '../db/db'
import type { BundleRecord, LogPipeRecord, PipeRecord } from '../models/types'

function normalizePipeNumber(pipeNumber: string): string {
  return pipeNumber.trim()
}

export async function createPipe(pipeNumber: string): Promise<PipeRecord> {
  const normalized = normalizePipeNumber(pipeNumber)
  if (!normalized) {
    throw new Error('Pipe number is required.')
  }

  const id = await db.pipes.add({
    pipe_number: normalized,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    sync_status: 'local',
  })

  const created = await db.pipes.get(id)
  if (!created) {
    throw new Error('Could not create pipe.')
  }

  return created
}

export async function getPipeById(pipeId: number): Promise<PipeRecord | undefined> {
  return db.pipes.get(pipeId)
}

export async function getPipeByNumber(pipeNumber: string): Promise<PipeRecord | undefined> {
  const normalized = normalizePipeNumber(pipeNumber)
  if (!normalized) {
    return undefined
  }

  return db.pipes.where('pipe_number').equals(normalized).first()
}

export async function createPipeIfNotExists(pipeNumber: string): Promise<PipeRecord> {
  const existing = await getPipeByNumber(pipeNumber)
  if (existing) {
    return existing
  }

  return createPipe(pipeNumber)
}

export async function linkPipeToBundle(bundleId: number, pipeId: number): Promise<void> {
  const existing = await db.bundle_pipes.where('[bundle_id+pipe_id]').equals([bundleId, pipeId]).first()
  if (existing) {
    return
  }

  await db.bundle_pipes.add({
    bundle_id: bundleId,
    pipe_id: pipeId,
    created_at: new Date().toISOString(),
    sync_status: 'local',
  })
}

export async function getOrCreatePipeForBundle(bundleId: number, pipeNumber: string): Promise<PipeRecord> {
  const pipe = await createPipeIfNotExists(pipeNumber)
  if (typeof pipe.id !== 'number') {
    throw new Error('Pipe ID is missing.')
  }

  const existingLinks = await db.bundle_pipes.where('pipe_id').equals(pipe.id).toArray()
  const linkedBundleIds = new Set(existingLinks.map((row) => row.bundle_id))

  if (linkedBundleIds.size > 0 && !linkedBundleIds.has(bundleId)) {
    throw new Error(`Pipe ${pipe.pipe_number} is already linked to another bundle.`)
  }

  await linkPipeToBundle(bundleId, pipe.id)
  return pipe
}

export async function listPipesByBundleId(bundleId: number): Promise<PipeRecord[]> {
  const links = await db.bundle_pipes.where('bundle_id').equals(bundleId).toArray()
  if (links.length === 0) {
    return []
  }

  const ids = links.map((link) => link.pipe_id)
  const pipes = await db.pipes.bulkGet(ids)
  return pipes.filter((pipe): pipe is PipeRecord => pipe != null).sort((a, b) => a.pipe_number.localeCompare(b.pipe_number))
}

export async function listPipesByLogId(logId: number): Promise<PipeRecord[]> {
  const links = await db.log_pipes.where('log_id').equals(logId).toArray()
  if (links.length === 0) {
    return []
  }

  const ids = [...new Set(links.map((link) => link.pipe_id))]
  const pipes = await db.pipes.bulkGet(ids)
  return pipes.filter((pipe): pipe is PipeRecord => pipe != null).sort((a, b) => a.pipe_number.localeCompare(b.pipe_number))
}

export async function getBundleByPipeId(pipeId: number): Promise<BundleRecord | undefined> {
  const link = await db.bundle_pipes.where('pipe_id').equals(pipeId).first()
  if (!link) {
    return undefined
  }

  return db.bundles.get(link.bundle_id)
}

export async function listBundlesByPipeId(pipeId: number): Promise<BundleRecord[]> {
  const links = await db.bundle_pipes.where('pipe_id').equals(pipeId).toArray()
  if (links.length === 0) {
    return []
  }

  const bundles = await db.bundles.bulkGet(links.map((row) => row.bundle_id))
  return bundles
    .filter((bundle): bundle is BundleRecord => bundle != null)
    .sort((a, b) => a.bundle_number.localeCompare(b.bundle_number))
}

export async function linkPipeToLog(logId: number, pipeId: number): Promise<LogPipeRecord> {
  const existing = await db.log_pipes.where('[log_id+pipe_id]').equals([logId, pipeId]).first()
  if (existing) {
    return existing
  }

  const id = await db.log_pipes.add({
    log_id: logId,
    pipe_id: pipeId,
    created_at: new Date().toISOString(),
    sync_status: 'local',
  })

  const created = await db.log_pipes.get(id)
  if (!created) {
    throw new Error('Could not link pipe to log.')
  }

  return created
}

export async function linkMultiplePipesToLog(logId: number, pipeIds: number[]): Promise<LogPipeRecord[]> {
  const unique = [...new Set(pipeIds)]
  const result: LogPipeRecord[] = []

  for (const pipeId of unique) {
    result.push(await linkPipeToLog(logId, pipeId))
  }

  return result
}

export async function listLogPipeLinksByLogId(logId: number): Promise<LogPipeRecord[]> {
  return db.log_pipes.where('log_id').equals(logId).toArray()
}

export async function listLogsByPipeId(pipeId: number): Promise<number[]> {
  const links = await db.log_pipes.where('pipe_id').equals(pipeId).toArray()
  return [...new Set(links.map((link) => link.log_id))]
}

export async function listBundlePipeGroupsByLogId(logId: number): Promise<Array<{ bundle: BundleRecord; pipes: PipeRecord[] }>> {
  const pipes = await listPipesByLogId(logId)
  const grouped = new Map<number, PipeRecord[]>()

  for (const pipe of pipes) {
    if (typeof pipe.id !== 'number') {
      continue
    }

    const bundles = await listBundlesByPipeId(pipe.id)
    const primaryBundle = bundles[0]
    if (!primaryBundle?.id) {
      continue
    }

    const list = grouped.get(primaryBundle.id) ?? []
    list.push(pipe)
    grouped.set(primaryBundle.id, list)
  }

  const result: Array<{ bundle: BundleRecord; pipes: PipeRecord[] }> = []
  for (const [bundleId, groupedPipes] of grouped) {
    const bundle = await db.bundles.get(bundleId)
    if (!bundle) {
      continue
    }

    result.push({
      bundle,
      pipes: groupedPipes.sort((a, b) => a.pipe_number.localeCompare(b.pipe_number)),
    })
  }

  return result.sort((a, b) => a.bundle.bundle_number.localeCompare(b.bundle.bundle_number))
}
