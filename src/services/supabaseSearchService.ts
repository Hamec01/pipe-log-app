import { supabase } from '../lib/supabase'
import { getPhotosByLog } from './supabasePhotoService'

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
  bundles: BundleRef[]
  logs: LogRef[]
  photos: Array<{ id: number; type: 'gauge' | 'site' | 'pipe'; file_name: string }>
}

export interface SearchAllResult {
  bundles: BundleSearchResult[]
  logs: LogSearchResult[]
  pipes: PipeSearchResult[]
}

function normalizeQuery(query: string): string {
  return query.trim()
}

function applyLogRangeFilters(rows: LogRef[], filters?: SearchFilters): LogRef[] {
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

async function listPipesByIds(pipeIds: number[]): Promise<Array<{ id: number; pipe_number: string }>> {
  if (pipeIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('pipes')
    .select('id,pipe_number')
    .in('id', pipeIds)

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

async function listBundlesByIds(bundleIds: number[]): Promise<Array<{ id: number; bundle_number: string }>> {
  if (bundleIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('bundles')
    .select('id,bundle_number')
    .in('id', bundleIds)

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

async function listLogsByIds(logIds: number[]): Promise<LogRef[]> {
  if (logIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('logs')
    .select('id,log_number,pressure_bar,date_time')
    .in('id', logIds)

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function searchBundles(query: string): Promise<BundleSearchResult[]> {
  const q = normalizeQuery(query)
  if (!q) {
    return []
  }

  const { data: bundles, error: bundlesError } = await supabase
    .from('bundles')
    .select('id,bundle_number')
    .ilike('bundle_number', `%${q}%`)
    .order('bundle_number', { ascending: true })

  if (bundlesError) {
    throw new Error(bundlesError.message)
  }

  const result: BundleSearchResult[] = []
  for (const bundle of bundles ?? []) {
    const { data: bundlePipeRows, error: bundlePipeError } = await supabase
      .from('bundle_pipes')
      .select('pipe_id')
      .eq('bundle_id', bundle.id)

    if (bundlePipeError) {
      throw new Error(bundlePipeError.message)
    }

    const pipeIds = [...new Set((bundlePipeRows ?? []).map((row) => row.pipe_id))]
    const pipes = await listPipesByIds(pipeIds)

    let logs: LogRef[] = []
    if (pipeIds.length > 0) {
      const { data: logPipeRows, error: logPipeError } = await supabase
        .from('log_pipes')
        .select('log_id')
        .in('pipe_id', pipeIds)

      if (logPipeError) {
        throw new Error(logPipeError.message)
      }

      const logIds = [...new Set((logPipeRows ?? []).map((row) => row.log_id))]
      logs = await listLogsByIds(logIds)
    }

    result.push({
      id: bundle.id,
      bundle_number: bundle.bundle_number,
      pipes: pipes
        .sort((a, b) => a.pipe_number.localeCompare(b.pipe_number))
        .map((pipe) => ({
          id: pipe.id,
          pipe_number: pipe.pipe_number,
          bundle: { id: bundle.id, bundle_number: bundle.bundle_number },
        })),
      logs: logs.sort((a, b) => b.date_time.localeCompare(a.date_time)),
    })
  }

  return result
}

export async function searchLogs(query: string, filters?: SearchFilters): Promise<LogSearchResult[]> {
  const q = normalizeQuery(query)

  let logsQuery = supabase
    .from('logs')
    .select('id,log_number,pressure_bar,date_time')
    .order('date_time', { ascending: false })

  if (q) {
    logsQuery = logsQuery.ilike('log_number', `%${q}%`)
  }

  const { data: baseLogs, error: logsError } = await logsQuery
  if (logsError) {
    throw new Error(logsError.message)
  }

  const filtered = applyLogRangeFilters(baseLogs ?? [], filters)
  const result: LogSearchResult[] = []

  for (const log of filtered) {
    const { data: logPipeRows, error: logPipeError } = await supabase
      .from('log_pipes')
      .select('pipe_id')
      .eq('log_id', log.id)

    if (logPipeError) {
      throw new Error(logPipeError.message)
    }

    const pipeIds = [...new Set((logPipeRows ?? []).map((row) => row.pipe_id))]
    const pipes = await listPipesByIds(pipeIds)

    let bundles: BundleRef[] = []
    if (pipeIds.length > 0) {
      const { data: bundlePipeRows, error: bundlePipeError } = await supabase
        .from('bundle_pipes')
        .select('bundle_id,pipe_id')
        .in('pipe_id', pipeIds)

      if (bundlePipeError) {
        throw new Error(bundlePipeError.message)
      }

      const bundleIds = [...new Set((bundlePipeRows ?? []).map((row) => row.bundle_id))]
      const bundleRows = await listBundlesByIds(bundleIds)
      bundles = bundleRows
        .map((bundle) => ({ id: bundle.id, bundle_number: bundle.bundle_number }))
        .sort((a, b) => a.bundle_number.localeCompare(b.bundle_number))
    }

    const photos = await getPhotosByLog(log.id)

    result.push({
      id: log.id,
      log_number: log.log_number,
      pressure_bar: log.pressure_bar,
      date_time: log.date_time,
      bundles,
      pipes: pipes
        .sort((a, b) => a.pipe_number.localeCompare(b.pipe_number))
        .map((pipe) => ({ id: pipe.id, pipe_number: pipe.pipe_number })),
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

  const { data: pipes, error: pipesError } = await supabase
    .from('pipes')
    .select('id,pipe_number')
    .ilike('pipe_number', `%${q}%`)
    .order('pipe_number', { ascending: true })

  if (pipesError) {
    throw new Error(pipesError.message)
  }

  const result: PipeSearchResult[] = []
  for (const pipe of pipes ?? []) {
    const { data: bundleLinks, error: bundleLinksError } = await supabase
      .from('bundle_pipes')
      .select('bundle_id')
      .eq('pipe_id', pipe.id)

    if (bundleLinksError) {
      throw new Error(bundleLinksError.message)
    }

    const bundleIds = [...new Set((bundleLinks ?? []).map((row) => row.bundle_id))]
    const bundleRows = await listBundlesByIds(bundleIds)

    const { data: logLinks, error: logLinksError } = await supabase
      .from('log_pipes')
      .select('log_id')
      .eq('pipe_id', pipe.id)

    if (logLinksError) {
      throw new Error(logLinksError.message)
    }

    const logIds = [...new Set((logLinks ?? []).map((row) => row.log_id))]
    const logs = await listLogsByIds(logIds)

    const photos: Array<{ id: number; type: 'gauge' | 'site' | 'pipe'; file_name: string }> = []
    for (const log of logs) {
      const logPhotos = await getPhotosByLog(log.id)
      for (const photo of logPhotos) {
        photos.push({
          id: photo.id,
          type: photo.type,
          file_name: photo.file_name,
        })
      }
    }

    result.push({
      id: pipe.id,
      pipe_number: pipe.pipe_number,
      bundles: bundleRows
        .map((bundle) => ({ id: bundle.id, bundle_number: bundle.bundle_number }))
        .sort((a, b) => a.bundle_number.localeCompare(b.bundle_number)),
      logs: logs.sort((a, b) => b.date_time.localeCompare(a.date_time)),
      photos,
    })
  }

  return result
}

export async function searchAll(query: string, filters?: SearchFilters): Promise<SearchAllResult> {
  const [bundles, logs, pipes] = await Promise.all([
    searchBundles(query),
    searchLogs(query, filters),
    searchPipes(query),
  ])

  return { bundles, logs, pipes }
}
