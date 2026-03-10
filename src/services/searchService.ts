import { db } from '../db/db'

export interface SearchFilters {
  pressureMin?: number
  pressureMax?: number
  dateFromIso?: string
  dateToIso?: string
}

export interface BundleSearchResult {
  id: number
  bundle_number: string
  created_at: string
  logs_count: number
}

export interface LogSearchResult {
  id: number
  bundle_id: number
  bundle_number?: string
  log_number: string
  pressure_bar: number
  date_time: string
  pipe_count: number
  photo_count: number
}

export interface PipeSearchResult {
  id: number
  bundle_id: number
  bundle_number?: string
  pipe_number: string
  log_ids: number[]
}

export interface SearchAllResult {
  bundles: BundleSearchResult[]
  logs: LogSearchResult[]
  pipes: PipeSearchResult[]
}

function normalizeQuery(query: string): string {
  return query.trim()
}

function applyLogRangeFilters<T extends { pressure_bar: number; date_time: string }>(
  rows: T[],
  filters?: SearchFilters,
): T[] {
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

export async function searchBundles(query: string): Promise<BundleSearchResult[]> {
  const q = normalizeQuery(query)

  const bundles = q
    ? await db.bundles.where('bundle_number').startsWithIgnoreCase(q).toArray()
    : []

  return Promise.all(
    bundles
      .filter((bundle) => !bundle.deleted_at)
      .filter((bundle): bundle is typeof bundle & { id: number } => typeof bundle.id === 'number')
      .map(async (bundle) => ({
        id: bundle.id,
        bundle_number: bundle.bundle_number,
        created_at: bundle.created_at,
        logs_count: await db.logs
          .where('bundle_id')
          .equals(bundle.id)
          .toArray()
          .then((rows) => rows.filter((row) => !row.deleted_at).length),
      })),
  )
}

export async function searchLogs(query: string, filters?: SearchFilters): Promise<LogSearchResult[]> {
  const q = normalizeQuery(query)

  const baseLogs = q
    ? await db.logs.where('log_number').startsWithIgnoreCase(q).toArray()
    : await db.logs.toArray()

  const logs = applyLogRangeFilters(baseLogs, filters).filter((log) => !log.deleted_at)

  const bundles = await db.bundles.toArray()
  const bundleById = new Map<number, string>()
  for (const bundle of bundles) {
    if (typeof bundle.id === 'number' && !bundle.deleted_at) {
      bundleById.set(bundle.id, bundle.bundle_number)
    }
  }

  return Promise.all(
    logs
      .filter((log): log is typeof log & { id: number } => typeof log.id === 'number')
      .map(async (log) => ({
        id: log.id,
        bundle_id: log.bundle_id,
        bundle_number: bundleById.get(log.bundle_id),
        log_number: log.log_number,
        pressure_bar: log.pressure_bar,
        date_time: log.date_time,
        pipe_count: await db.log_pipes
          .where('log_id')
          .equals(log.id)
          .toArray()
          .then((rows) => rows.filter((row) => !row.deleted_at).length),
        photo_count: await db.photos
          .where('log_id')
          .equals(log.id)
          .toArray()
          .then((rows) => rows.filter((row) => !row.deleted_at).length),
      })),
  )
}

export async function searchPipes(query: string): Promise<PipeSearchResult[]> {
  const q = normalizeQuery(query)

  const pipes = q
    ? await db.pipes.where('pipe_number').startsWithIgnoreCase(q).toArray()
    : []

  const bundles = await db.bundles.toArray()
  const bundleById = new Map<number, string>()
  for (const bundle of bundles) {
    if (typeof bundle.id === 'number' && !bundle.deleted_at) {
      bundleById.set(bundle.id, bundle.bundle_number)
    }
  }

  return Promise.all(
    pipes
      .filter((pipe) => !pipe.deleted_at)
      .filter((pipe): pipe is typeof pipe & { id: number } => typeof pipe.id === 'number')
      .map(async (pipe) => {
        const links = (await db.log_pipes.where('pipe_id').equals(pipe.id).toArray()).filter((link) => !link.deleted_at)
        return {
          id: pipe.id,
          bundle_id: pipe.bundle_id,
          bundle_number: bundleById.get(pipe.bundle_id),
          pipe_number: pipe.pipe_number,
          log_ids: links.map((link) => link.log_id),
        }
      }),
  )
}

export async function searchAll(query: string, filters?: SearchFilters): Promise<SearchAllResult> {
  const q = normalizeQuery(query)

  const [bundles, logs, pipes] = await Promise.all([
    searchBundles(q),
    searchLogs(q, filters),
    searchPipes(q),
  ])

  return {
    bundles,
    logs,
    pipes,
  }
}
