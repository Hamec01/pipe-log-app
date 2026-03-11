import { supabase } from '../lib/supabase'

export interface SupabaseBundle {
  id: number
  bundle_number: string
  created_at: string
  updated_at: string | null
}

export interface SupabaseBundleSummary {
  bundle: SupabaseBundle
  logsCount: number
}

export interface SupabaseLogSummary {
  id: number
  log_number: string
  pressure_bar: number
  date_time: string
  notes: string | null
  created_at: string
}

export async function getBundleByNumber(bundleNumber: string): Promise<SupabaseBundle | null> {
  const normalized = bundleNumber.trim()
  if (!normalized) {
    return null
  }

  const { data, error } = await supabase
    .from('bundles')
    .select('id,bundle_number,created_at,updated_at')
    .eq('bundle_number', normalized)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function createBundle(bundleNumber: string): Promise<SupabaseBundle> {
  const normalized = bundleNumber.trim()
  if (!normalized) {
    throw new Error('Bundle number is required.')
  }

  const { data, error } = await supabase
    .from('bundles')
    .insert({ bundle_number: normalized })
    .select('id,bundle_number,created_at,updated_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getOrCreateBundleByNumber(bundleNumber: string): Promise<SupabaseBundle> {
  const existing = await getBundleByNumber(bundleNumber)
  if (existing) {
    return existing
  }

  try {
    return await createBundle(bundleNumber)
  } catch (error) {
    const existingAfterRace = await getBundleByNumber(bundleNumber)
    if (existingAfterRace) {
      return existingAfterRace
    }
    throw error
  }
}

export async function getBundleById(bundleId: number): Promise<SupabaseBundle | null> {
  const { data, error } = await supabase
    .from('bundles')
    .select('id,bundle_number,created_at,updated_at')
    .eq('id', bundleId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function listBundles(): Promise<SupabaseBundle[]> {
  const { data, error } = await supabase
    .from('bundles')
    .select('id,bundle_number,created_at,updated_at')
    .order('bundle_number', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function listBundlePipes(bundleId: number): Promise<Array<{ id: number; pipe_number: string }>> {
  const { data: bundlePipeRows, error: linkError } = await supabase
    .from('bundle_pipes')
    .select('pipe_id')
    .eq('bundle_id', bundleId)

  if (linkError) {
    throw new Error(linkError.message)
  }

  const pipeIds = [...new Set((bundlePipeRows ?? []).map((row) => row.pipe_id))]
  if (pipeIds.length === 0) {
    return []
  }

  const { data: pipes, error: pipesError } = await supabase
    .from('pipes')
    .select('id,pipe_number')
    .in('id', pipeIds)
    .order('pipe_number', { ascending: true })

  if (pipesError) {
    throw new Error(pipesError.message)
  }

  return pipes ?? []
}

export async function listBundleLogs(bundleId: number): Promise<SupabaseLogSummary[]> {
  const { data: bundlePipeRows, error: linkError } = await supabase
    .from('bundle_pipes')
    .select('pipe_id')
    .eq('bundle_id', bundleId)

  if (linkError) {
    throw new Error(linkError.message)
  }

  const pipeIds = [...new Set((bundlePipeRows ?? []).map((row) => row.pipe_id))]
  if (pipeIds.length === 0) {
    return []
  }

  const { data: logPipeRows, error: logPipeError } = await supabase
    .from('log_pipes')
    .select('log_id')
    .in('pipe_id', pipeIds)

  if (logPipeError) {
    throw new Error(logPipeError.message)
  }

  const logIds = [...new Set((logPipeRows ?? []).map((row) => row.log_id))]
  if (logIds.length === 0) {
    return []
  }

  const { data: logs, error: logsError } = await supabase
    .from('logs')
    .select('id,log_number,pressure_bar,date_time,notes,created_at')
    .in('id', logIds)
    .order('date_time', { ascending: false })

  if (logsError) {
    throw new Error(logsError.message)
  }

  return logs ?? []
}

export async function listBundleSummaries(): Promise<SupabaseBundleSummary[]> {
  const bundles = await listBundles()
  const summaries: SupabaseBundleSummary[] = []

  for (const bundle of bundles) {
    const logs = await listBundleLogs(bundle.id)
    summaries.push({
      bundle,
      logsCount: logs.length,
    })
  }

  return summaries
}

export async function deleteBundle(bundleId: number): Promise<void> {
  const { error } = await supabase.from('bundles').delete().eq('id', bundleId)
  if (error) {
    throw new Error(error.message)
  }
}
