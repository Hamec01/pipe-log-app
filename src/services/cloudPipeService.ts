import type { PipeRecord, SyncStatus } from '../models/types'
import { supabase } from '../lib/supabase'

interface CloudPipeRow {
  id: number
  pipe_number: string
  created_at: string
  updated_at: string | null
}

interface CloudLogPipeRow {
  id: number
  log_id: number
  pipe_id: number
  created_at: string
}

function toPipeRecord(row: CloudPipeRow): PipeRecord {
  const syncStatus: SyncStatus = 'synced'
  return {
    id: row.id,
    pipe_number: row.pipe_number,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    sync_status: syncStatus,
  }
}

export async function getOrCreateCloudPipes(bundleId: number, pipeNumbers: string[]): Promise<PipeRecord[]> {
  const normalized = [...new Set(pipeNumbers.map((value) => value.trim()).filter((value) => value.length > 0))]

  if (normalized.length === 0) {
    return []
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('pipes')
    .select('id,pipe_number,created_at,updated_at')
    .in('pipe_number', normalized)

  if (existingError) {
    throw new Error(existingError.message)
  }

  const existing = existingRows ?? []
  const existingSet = new Set(existing.map((row) => row.pipe_number))
  const missing = normalized.filter((pipeNumber) => !existingSet.has(pipeNumber))

  let inserted: CloudPipeRow[] = []
  if (missing.length > 0) {
    const { data: insertedRows, error: insertError } = await supabase
      .from('pipes')
      .insert(missing.map((pipe_number) => ({ pipe_number })))
      .select('id,pipe_number,created_at,updated_at')

    if (insertError) {
      throw new Error(insertError.message)
    }

    inserted = insertedRows ?? []
  }

  const all = [...existing, ...inserted]
  for (const pipe of all) {
    const { data: existingLink, error: existingLinkError } = await supabase
      .from('bundle_pipes')
      .select('id')
      .eq('bundle_id', bundleId)
      .eq('pipe_id', pipe.id)
      .maybeSingle()

    if (existingLinkError) {
      throw new Error(existingLinkError.message)
    }

    if (!existingLink) {
      const { error: linkError } = await supabase.from('bundle_pipes').insert({
        bundle_id: bundleId,
        pipe_id: pipe.id,
      })

      if (linkError) {
        throw new Error(linkError.message)
      }
    }
  }

  return all
    .map(toPipeRecord)
    .sort((a, b) => a.pipe_number.localeCompare(b.pipe_number))
}

export async function linkCloudPipesToLog(logId: number, pipeIds: number[]): Promise<void> {
  const uniqueIds = [...new Set(pipeIds)]
  if (uniqueIds.length === 0) {
    return
  }

  const { data: existing, error: existingError } = await supabase
    .from('log_pipes')
    .select('id,log_id,pipe_id,created_at')
    .eq('log_id', logId)
    .in('pipe_id', uniqueIds)

  if (existingError) {
    throw new Error(existingError.message)
  }

  const existingPairs = new Set((existing ?? []).map((row) => `${row.log_id}:${row.pipe_id}`))
  const toInsert = uniqueIds
    .filter((pipe_id) => !existingPairs.has(`${logId}:${pipe_id}`))
    .map((pipe_id) => ({ log_id: logId, pipe_id }))

  if (toInsert.length === 0) {
    return
  }

  const { error } = await supabase.from('log_pipes').insert(toInsert)
  if (error) {
    throw new Error(error.message)
  }
}

export async function listCloudPipesByLogId(logId: number): Promise<PipeRecord[]> {
  const { data: links, error: linksError } = await supabase
    .from('log_pipes')
    .select('id,log_id,pipe_id,created_at')
    .eq('log_id', logId)

  if (linksError) {
    throw new Error(linksError.message)
  }

  const typedLinks = (links ?? []) as CloudLogPipeRow[]
  const pipeIds = typedLinks.map((row) => row.pipe_id)

  if (pipeIds.length === 0) {
    return []
  }

  const { data: pipes, error: pipesError } = await supabase
    .from('pipes')
    .select('id,pipe_number,created_at,updated_at')
    .in('id', pipeIds)

  if (pipesError) {
    throw new Error(pipesError.message)
  }

  return (pipes ?? []).map(toPipeRecord).sort((a, b) => a.pipe_number.localeCompare(b.pipe_number))
}
