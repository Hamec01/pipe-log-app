import { supabase } from '../lib/supabase'
import { getOrCreateBundleByNumber } from './supabaseBundleService'
import { uploadPhoto } from './supabasePhotoService'
import {
  ensureBundlePipeRelation,
  ensureLogPipeRelation,
  getBundleGroupsForLog,
  getOrCreatePipeByNumber,
} from './supabasePipeService'

export interface CreateSupabaseLogParams {
  logNumber: string
  pressureBar: number
  dateTimeIso: string
  notes?: string
}

export interface BundlePipeGroupInput {
  bundleNumber: string
  pipeNumbers: string[]
}

export interface CreateLogWithGroupsParams {
  logNumber: string
  pressureBar: number
  dateTimeIso: string
  notes?: string
  bundleGroups: BundlePipeGroupInput[]
  gaugePhotoFile: File
  sitePhotoFile?: File
}

export interface SupabaseLog {
  id: number
  log_number: string
  pressure_bar: number
  date_time: string
  notes: string | null
  created_at: string
  updated_at: string | null
}

export async function createLog(params: CreateSupabaseLogParams): Promise<SupabaseLog> {
  const logNumber = params.logNumber.trim()
  if (!logNumber) {
    throw new Error('Log number is required.')
  }

  const { data, error } = await supabase
    .from('logs')
    .insert({
      log_number: logNumber,
      pressure_bar: params.pressureBar,
      date_time: params.dateTimeIso,
      notes: params.notes?.trim() || null,
    })
    .select('id,log_number,pressure_bar,date_time,notes,created_at,updated_at')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getLogById(logId: number): Promise<SupabaseLog | null> {
  const { data, error } = await supabase
    .from('logs')
    .select('id,log_number,pressure_bar,date_time,notes,created_at,updated_at')
    .eq('id', logId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function deleteLog(logId: number): Promise<void> {
  const { error } = await supabase.from('logs').delete().eq('id', logId)
  if (error) {
    throw new Error(error.message)
  }
}

export async function createLogWithBundleGroupsAndPhotos(params: CreateLogWithGroupsParams): Promise<{
  log: SupabaseLog
}> {
  if (!params.gaugePhotoFile) {
    throw new Error('Gauge photo is required.')
  }

  const createdLog = await createLog({
    logNumber: params.logNumber,
    pressureBar: params.pressureBar,
    dateTimeIso: params.dateTimeIso,
    notes: params.notes,
  })

  for (const group of params.bundleGroups) {
    const bundle = await getOrCreateBundleByNumber(group.bundleNumber)
    const normalizedPipes = [...new Set(group.pipeNumbers.map((pipe) => pipe.trim()).filter((pipe) => pipe.length > 0))]

    for (const pipeNumber of normalizedPipes) {
      const pipe = await getOrCreatePipeByNumber(pipeNumber)
      await ensureBundlePipeRelation(bundle.id, pipe.id)
      await ensureLogPipeRelation(createdLog.id, pipe.id)
    }
  }

  await uploadPhoto({
    logId: createdLog.id,
    type: 'gauge',
    file: params.gaugePhotoFile,
  })

  if (params.sitePhotoFile) {
    await uploadPhoto({
      logId: createdLog.id,
      type: 'site',
      file: params.sitePhotoFile,
    })
  }

  return { log: createdLog }
}

export { getBundleGroupsForLog }
