import type { LogRecord, SyncStatus } from '../models/types'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from './authService'

interface CloudLogRow {
  id: number
  log_number: string
  pressure_bar: number
  date_time: string
  notes: string | null
  created_at: string
  updated_at: string | null
  created_by: string | null
}

function toLogRecord(row: CloudLogRow): LogRecord {
  const syncStatus: SyncStatus = 'synced'
  return {
    id: row.id,
    log_number: row.log_number,
    pressure_bar: row.pressure_bar,
    date_time: row.date_time,
    notes: row.notes ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    sync_status: syncStatus,
  }
}

export async function createCloudLog(input: {
  bundleId: number
  logNumber: string
  pressureBar: number
  dateTimeIso: string
  notes?: string
}): Promise<LogRecord> {
  const user = await getCurrentUser()

  const { data, error } = await supabase
    .from('logs')
    .insert({
      log_number: input.logNumber.trim(),
      pressure_bar: input.pressureBar,
      date_time: input.dateTimeIso,
      notes: input.notes?.trim() || null,
      created_by: user?.id ?? null,
    })
    .select('id,log_number,pressure_bar,date_time,notes,created_at,updated_at,created_by')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return toLogRecord(data)
}

export async function getCloudLogById(logId: number): Promise<LogRecord | undefined> {
  const { data, error } = await supabase
    .from('logs')
    .select('id,log_number,pressure_bar,date_time,notes,created_at,updated_at,created_by')
    .eq('id', logId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? toLogRecord(data) : undefined
}

export async function listCloudLogsByBundleId(bundleId: number): Promise<LogRecord[]> {
  const { data: bundlePipeRows, error: bundlePipeError } = await supabase
    .from('bundle_pipes')
    .select('pipe_id')
    .eq('bundle_id', bundleId)

  if (bundlePipeError) {
    throw new Error(bundlePipeError.message)
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
    .select('id,log_number,pressure_bar,date_time,notes,created_at,updated_at,created_by')
    .in('id', logIds)
    .order('date_time', { ascending: false })

  if (logsError) {
    throw new Error(logsError.message)
  }

  return (logs ?? []).map(toLogRecord)
}

export async function deleteCloudLog(logId: number): Promise<void> {
  const { error } = await supabase.from('logs').delete().eq('id', logId)
  if (error) {
    throw new Error(error.message)
  }
}
