import { db } from '../db/db'
import type { BundleRecord, LogRecord, PhotoRecord, PipeRecord } from '../models/types'

export interface SearchFilters {
  pressureMin?: number
  pressureMax?: number
  dateFromIso?: string
  dateToIso?: string
}

export interface LogRef {
  id: number
  log_number: string
  pressure_bar: number
  date_time: string
}

export interface BundleRef {
  id: number
  bundle_number: string
}

export interface PipeRef {
  id: number
  pipe_number: string
  bundle?: BundleRef
}

export interface BundleSearchResult {
  id: number
  bundle_number: string
  pipes: PipeRef[]
  logs: LogRef[]
}

export interface LogSearchResult {
  id: number
  log_number: string
  pressure_bar: number
  date_time: string
  bundles: BundleRef[]
  pipes: PipeRef[]
  photo_count: number
}

export interface PipeSearchResult {
  id: number
  pipe_number: string
  bundle?: BundleRef
  logs: LogRef[]
  photos: Array<{ id: number; type: PhotoRecord['type']; file_name: string }>
}

export interface SearchAllResult {
  bundles: BundleSearchResult[]
  logs: LogSearchResult[]
  pipes: PipeSearchResult[]
}

function normalizeQuery(query: string): string {
  return query.trim()
}

function applyLogRangeFilters(rows: LogRecord[], filters?: SearchFilters): LogRecord[] {
  if (!filters) {
    return rows
  }

  const from = filters.dateFromIso ? new Date(filters.dateFromIso).getTime() : undefined
  const to = filters.dateToIso ? new Date(filters.dateToIso).getTime() : undefined

  return rows.filter((row) => {
    if (typeof filters.pressureMin === 'number' && row.pressure_bar < filters.pressureMin) {
      return false
    }

    if (typeof filters.pressureMax === 'number' && row.pressure_bar > filters.pressureMax) {
      return false
    }

    const rowTime = new Date(row.date_time).getTime()
    if (!Number.isNaN(rowTime)) {
      if (typeof from === 'number' && !Number.isNaN(from) && rowTime < from) {
        return false
      }
      if (typeof to === 'number' && !Number.isNaN(to) && rowTime > to) {
        return false
      }
    }

    return true
  })
}

async function getBundleById(bundleId: number): Promise<BundleRecord | undefined> {
  return db.bundles.get(bundleId)
}

async function getBundleForPipe(pipeId: number): Promise<BundleRecord | undefined> {
  const link = await db.bundle_pipes.where('pipe_id').equals(pipeId).first()
  if (!link) {
    return undefined
  }
  return getBundleById(link.bundle_id)
}

async function getPipesForLog(logId: number): Promise<PipeRecord[]> {
  const links = await db.log_pipes.where('log_id').equals(logId).toArray()
  if (links.length === 0) {
    return []
  }

  const pipes = await db.pipes.bulkGet([...new Set(links.map((link) => link.pipe_id))])
  return pipes.filter((pipe): pipe is PipeRecord => pipe != null)
}

async function getLogsForBundle(bundleId: number): Promise<LogRecord[]> {
  const bundleLinks = await db.bundle_pipes.where('bundle_id').equals(bundleId).toArray()
  if (bundleLinks.length === 0) {
    return []
  }

  const pipeIds = [...new Set(bundleLinks.map((link) => link.pipe_id))]
  const logLinks = await db.log_pipes.where('pipe_id').anyOf(pipeIds).toArray()
  if (logLinks.length === 0) {
    return []
  }

  const logs = await db.logs.bulkGet([...new Set(logLinks.map((link) => link.log_id))])
  return logs.filter((log): log is LogRecord => log != null).sort((a, b) => b.date_time.localeCompare(a.date_time))
}

async function getBundlesForLog(logId: number): Promise<BundleRecord[]> {
  const pipes = await getPipesForLog(logId)
  const bundleIds = new Set<number>()

  for (const pipe of pipes) {
    if (typeof pipe.id !== 'number') {
      continue
    }
    const link = await db.bundle_pipes.where('pipe_id').equals(pipe.id).first()
    if (link) {
      bundleIds.add(link.bundle_id)
    }
  }

  const bundles = await db.bundles.bulkGet([...bundleIds])
  return bundles
    .filter((bundle): bundle is BundleRecord => bundle != null)
    .sort((a, b) => a.bundle_number.localeCompare(b.bundle_number))
}

async function getLogsForPipe(pipeId: number): Promise<LogRecord[]> {
  const links = await db.log_pipes.where('pipe_id').equals(pipeId).toArray()
  if (links.length === 0) {
    return []
  }

  const logs = await db.logs.bulkGet([...new Set(links.map((link) => link.log_id))])
  return logs.filter((log): log is LogRecord => log != null).sort((a, b) => b.date_time.localeCompare(a.date_time))
}

function toLogRef(log: LogRecord): LogRef {
  return {
    id: log.id ?? 0,
    log_number: log.log_number,
    pressure_bar: log.pressure_bar,
    date_time: log.date_time,
  }
}

function toBundleRef(bundle: BundleRecord): BundleRef {
  return {
    id: bundle.id ?? 0,
    bundle_number: bundle.bundle_number,
  }
}

export async function searchBundles(query: string): Promise<BundleSearchResult[]> {
  const q = normalizeQuery(query)
  if (!q) {
    return []
  }

  const bundles = await db.bundles.where('bundle_number').startsWithIgnoreCase(q).toArray()

  const result: BundleSearchResult[] = []
  for (const bundle of bundles) {
    if (typeof bundle.id !== 'number') {
      continue
    }

    const pipes = await db.bundle_pipes.where('bundle_id').equals(bundle.id).toArray()
    const pipeRows = await db.pipes.bulkGet([...new Set(pipes.map((row) => row.pipe_id))])
    const logs = await getLogsForBundle(bundle.id)

    result.push({
      id: bundle.id,
      bundle_number: bundle.bundle_number,
      pipes: pipeRows
        .filter((pipe): pipe is PipeRecord => pipe != null)
        .sort((a, b) => a.pipe_number.localeCompare(b.pipe_number))
        .map((pipe) => ({ id: pipe.id ?? 0, pipe_number: pipe.pipe_number, bundle: toBundleRef(bundle) })),
      logs: logs.map(toLogRef),
    })
  }

  return result
}

export async function searchLogs(query: string, filters?: SearchFilters): Promise<LogSearchResult[]> {
  const q = normalizeQuery(query)

  const baseLogs = q ? await db.logs.where('log_number').startsWithIgnoreCase(q).toArray() : await db.logs.toArray()
  const logs = applyLogRangeFilters(baseLogs, filters)

  const result: LogSearchResult[] = []
  for (const log of logs) {
    if (typeof log.id !== 'number') {
      continue
    }

    const bundles = await getBundlesForLog(log.id)
    const pipes = await getPipesForLog(log.id)
    const photos = await db.photos.where('log_id').equals(log.id).toArray()

    const pipesWithBundles: PipeRef[] = []
    for (const pipe of pipes) {
      if (typeof pipe.id !== 'number') {
        continue
      }
      const bundle = await getBundleForPipe(pipe.id)
      pipesWithBundles.push({
        id: pipe.id,
        pipe_number: pipe.pipe_number,
        bundle: bundle ? toBundleRef(bundle) : undefined,
      })
    }

    result.push({
      id: log.id,
      log_number: log.log_number,
      pressure_bar: log.pressure_bar,
      date_time: log.date_time,
      bundles: bundles.map(toBundleRef),
      pipes: pipesWithBundles.sort((a, b) => a.pipe_number.localeCompare(b.pipe_number)),
      photo_count: photos.length,
    })
  }

  return result.sort((a, b) => b.date_time.localeCompare(a.date_time))
}

export async function searchPipes(query: string): Promise<PipeSearchResult[]> {
  const q = normalizeQuery(query)
  if (!q) {
    return []
  }

  const pipes = await db.pipes.where('pipe_number').startsWithIgnoreCase(q).toArray()

  const result: PipeSearchResult[] = []
  for (const pipe of pipes) {
    if (typeof pipe.id !== 'number') {
      continue
    }

    const bundle = await getBundleForPipe(pipe.id)
    const logs = await getLogsForPipe(pipe.id)
    const photos: Array<{ id: number; type: PhotoRecord['type']; file_name: string }> = []

    for (const log of logs) {
      if (typeof log.id !== 'number') {
        continue
      }

      const logPhotos = await db.photos.where('log_id').equals(log.id).toArray()
      for (const photo of logPhotos) {
        if (typeof photo.id !== 'number') {
          continue
        }
        photos.push({ id: photo.id, type: photo.type, file_name: photo.file_name })
      }
    }

    result.push({
      id: pipe.id,
      pipe_number: pipe.pipe_number,
      bundle: bundle ? toBundleRef(bundle) : undefined,
      logs: logs.map(toLogRef),
      photos,
    })
  }

  return result.sort((a, b) => a.pipe_number.localeCompare(b.pipe_number))
}

export async function searchAll(query: string, filters?: SearchFilters): Promise<SearchAllResult> {
  const [bundles, logs, pipes] = await Promise.all([
    searchBundles(query),
    searchLogs(query, filters),
    searchPipes(query),
  ])

  return { bundles, logs, pipes }
}
