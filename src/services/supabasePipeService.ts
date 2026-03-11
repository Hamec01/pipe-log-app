import { supabase } from '../lib/supabase'

export interface SupabasePipe {
  id: number
  pipe_number: string
  created_at: string
  updated_at: string | null
}

export async function getPipeByNumber(pipeNumber: string): Promise<SupabasePipe | null> {
  const normalized = pipeNumber.trim()
  if (!normalized) {
    return null
  }

  const { data, error } = await supabase
    .from('pipes')
    .select('id,pipe_number,created_at,updated_at')
    .eq('pipe_number', normalized)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function createPipe(pipeNumber: string): Promise<SupabasePipe> {
  const normalized = pipeNumber.trim()
  if (!normalized) {
    throw new Error('Pipe number is required.')
  }

  const { data, error } = await supabase
    .from('pipes')
    .insert({ pipe_number: normalized })
    .select('id,pipe_number,created_at,updated_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getOrCreatePipeByNumber(pipeNumber: string): Promise<SupabasePipe> {
  const existing = await getPipeByNumber(pipeNumber)
  if (existing) {
    return existing
  }

  try {
    return await createPipe(pipeNumber)
  } catch (error) {
    const existingAfterRace = await getPipeByNumber(pipeNumber)
    if (existingAfterRace) {
      return existingAfterRace
    }
    throw error
  }
}

export async function ensureBundlePipeRelation(bundleId: number, pipeId: number): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from('bundle_pipes')
    .select('id')
    .eq('bundle_id', bundleId)
    .eq('pipe_id', pipeId)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing) {
    return
  }

  const { error } = await supabase.from('bundle_pipes').insert({ bundle_id: bundleId, pipe_id: pipeId })

  if (error) {
    throw new Error(error.message)
  }
}

export async function ensureLogPipeRelation(logId: number, pipeId: number): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from('log_pipes')
    .select('id')
    .eq('log_id', logId)
    .eq('pipe_id', pipeId)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing) {
    return
  }

  const { error } = await supabase.from('log_pipes').insert({ log_id: logId, pipe_id: pipeId })

  if (error) {
    throw new Error(error.message)
  }
}

export async function listPipesByBundle(bundleId: number): Promise<SupabasePipe[]> {
  const { data: links, error: linksError } = await supabase
    .from('bundle_pipes')
    .select('pipe_id')
    .eq('bundle_id', bundleId)

  if (linksError) {
    throw new Error(linksError.message)
  }

  const pipeIds = (links ?? []).map((row) => row.pipe_id)
  if (pipeIds.length === 0) {
    return []
  }

  const { data: pipes, error: pipesError } = await supabase
    .from('pipes')
    .select('id,pipe_number,created_at,updated_at')
    .in('id', pipeIds)
    .order('pipe_number', { ascending: true })

  if (pipesError) {
    throw new Error(pipesError.message)
  }

  return (pipes ?? []).sort((a, b) => a.pipe_number.localeCompare(b.pipe_number))
}

export async function listPipesByLog(logId: number): Promise<SupabasePipe[]> {
  const { data: links, error: linksError } = await supabase
    .from('log_pipes')
    .select('pipe_id')
    .eq('log_id', logId)

  if (linksError) {
    throw new Error(linksError.message)
  }

  const pipeIds = [...new Set((links ?? []).map((row) => row.pipe_id))]
  if (pipeIds.length === 0) {
    return []
  }

  const { data: pipes, error: pipesError } = await supabase
    .from('pipes')
    .select('id,pipe_number,created_at,updated_at')
    .in('id', pipeIds)
    .order('pipe_number', { ascending: true })

  if (pipesError) {
    throw new Error(pipesError.message)
  }

  return pipes ?? []
}

export async function getBundleGroupsForLog(logId: number): Promise<Array<{ bundleId: number; bundleNumber: string; pipeNumbers: string[] }>> {
  const pipes = await listPipesByLog(logId)
  if (pipes.length === 0) {
    return []
  }

  const pipeIds = pipes.map((pipe) => pipe.id)
  const pipeMap = new Map<number, SupabasePipe>()
  for (const pipe of pipes) {
    pipeMap.set(pipe.id, pipe)
  }

  const { data: bundleLinks, error: bundleLinkError } = await supabase
    .from('bundle_pipes')
    .select('bundle_id,pipe_id')
    .in('pipe_id', pipeIds)

  if (bundleLinkError) {
    throw new Error(bundleLinkError.message)
  }

  const bundleIds = [...new Set((bundleLinks ?? []).map((row) => row.bundle_id))]
  if (bundleIds.length === 0) {
    return []
  }

  const { data: bundles, error: bundleError } = await supabase
    .from('bundles')
    .select('id,bundle_number')
    .in('id', bundleIds)

  if (bundleError) {
    throw new Error(bundleError.message)
  }

  const bundleNumberMap = new Map<number, string>()
  for (const bundle of bundles ?? []) {
    bundleNumberMap.set(bundle.id, bundle.bundle_number)
  }

  const grouped = new Map<number, string[]>()
  for (const row of bundleLinks ?? []) {
    const pipe = pipeMap.get(row.pipe_id)
    if (!pipe) {
      continue
    }
    const current = grouped.get(row.bundle_id) ?? []
    current.push(pipe.pipe_number)
    grouped.set(row.bundle_id, current)
  }

  return [...grouped.entries()]
    .map(([bundleId, pipeNumbers]) => ({
      bundleId,
      bundleNumber: bundleNumberMap.get(bundleId) ?? `#${bundleId}`,
      pipeNumbers: [...new Set(pipeNumbers)].sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.bundleNumber.localeCompare(b.bundleNumber))
}
