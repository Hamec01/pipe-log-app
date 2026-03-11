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

  let createdLog: SupabaseLog
  try {
    console.info('[CreateLog] Step: creating log', {
      logNumber: params.logNumber,
      pressureBar: params.pressureBar,
      dateTimeIso: params.dateTimeIso,
    })

    createdLog = await createLog({
      logNumber: params.logNumber,
      pressureBar: params.pressureBar,
      dateTimeIso: params.dateTimeIso,
      notes: params.notes,
    })

    console.info('[CreateLog] Step complete: creating log', { logId: createdLog.id })
  } catch (error) {
    console.error('[CreateLog] Step failed: creating log', error)
    throw new Error('Failed at step: creating log')
  }

  for (const group of params.bundleGroups) {
    let bundle: { id: number; bundle_number: string }
    try {
      console.info('[CreateLog] Step: creating bundle', { bundleNumber: group.bundleNumber })
      bundle = await getOrCreateBundleByNumber(group.bundleNumber)
      console.info('[CreateLog] Step complete: creating bundle', {
        bundleId: bundle.id,
        bundleNumber: bundle.bundle_number,
      })
    } catch (error) {
      console.error('[CreateLog] Step failed: creating bundle', {
        bundleNumber: group.bundleNumber,
        error,
      })
      throw new Error('Failed at step: creating bundle')
    }

    const normalizedPipes = [...new Set(group.pipeNumbers.map((pipe) => pipe.trim()).filter((pipe) => pipe.length > 0))]
    const createdPipeIds: number[] = []

    try {
      console.info('[CreateLog] Step: creating pipes', {
        bundleId: bundle.id,
        pipeNumbers: normalizedPipes,
      })

      for (const pipeNumber of normalizedPipes) {
        const pipe = await getOrCreatePipeByNumber(pipeNumber)
        createdPipeIds.push(pipe.id)
      }

      console.info('[CreateLog] Step complete: creating pipes', {
        bundleId: bundle.id,
        pipeIds: createdPipeIds,
      })
    } catch (error) {
      console.error('[CreateLog] Step failed: creating pipes', {
        bundleId: bundle.id,
        pipeNumbers: normalizedPipes,
        error,
      })
      throw new Error('Failed at step: creating pipes')
    }

    try {
      console.info('[CreateLog] Step: creating bundle_pipes', {
        bundleId: bundle.id,
        pipeIds: createdPipeIds,
      })

      for (const pipeId of createdPipeIds) {
        await ensureBundlePipeRelation(bundle.id, pipeId)
      }

      console.info('[CreateLog] Step complete: creating bundle_pipes', {
        bundleId: bundle.id,
        pipeIds: createdPipeIds,
      })
    } catch (error) {
      console.error('[CreateLog] Step failed: creating bundle_pipes', {
        bundleId: bundle.id,
        pipeIds: createdPipeIds,
        error,
      })
      throw new Error('Failed at step: creating bundle_pipes')
    }

    try {
      console.info('[CreateLog] Step: creating log_pipes', {
        logId: createdLog.id,
        pipeIds: createdPipeIds,
      })

      for (const pipeId of createdPipeIds) {
        await ensureLogPipeRelation(createdLog.id, pipeId)
      }

      console.info('[CreateLog] Step complete: creating log_pipes', {
        logId: createdLog.id,
        pipeIds: createdPipeIds,
      })
    } catch (error) {
      console.error('[CreateLog] Step failed: creating log_pipes', {
        logId: createdLog.id,
        pipeIds: createdPipeIds,
        error,
      })
      throw new Error('Failed at step: creating log_pipes')
    }
  }

  try {
    console.info('[CreateLog] Step: uploading gauge photo to Supabase Storage', {
      logId: createdLog.id,
      fileName: params.gaugePhotoFile.name,
    })

    await uploadPhoto({
      logId: createdLog.id,
      type: 'gauge',
      file: params.gaugePhotoFile,
    })

    console.info('[CreateLog] Step complete: inserting photo metadata into photos table', {
      logId: createdLog.id,
      type: 'gauge',
      fileName: params.gaugePhotoFile.name,
    })
  } catch (error) {
    console.error('[CreateLog] Step failed: upload gauge photo / insert metadata', {
      logId: createdLog.id,
      fileName: params.gaugePhotoFile.name,
      error,
    })

    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('storage') || message.includes('bucket') || message.includes('object')) {
      throw new Error('Failed at step: upload gauge photo')
    }

    throw new Error('Failed at step: insert into photos table')
  }

  if (params.sitePhotoFile) {
    try {
      console.info('[CreateLog] Step: uploading site photo to Supabase Storage', {
        logId: createdLog.id,
        fileName: params.sitePhotoFile.name,
      })

      await uploadPhoto({
        logId: createdLog.id,
        type: 'site',
        file: params.sitePhotoFile,
      })

      console.info('[CreateLog] Step complete: inserting photo metadata into photos table', {
        logId: createdLog.id,
        type: 'site',
        fileName: params.sitePhotoFile.name,
      })
    } catch (error) {
      console.error('[CreateLog] Step failed: upload site photo / insert metadata', {
        logId: createdLog.id,
        fileName: params.sitePhotoFile.name,
        error,
      })

      const message = error instanceof Error ? error.message.toLowerCase() : ''
      if (message.includes('storage') || message.includes('bucket') || message.includes('object')) {
        throw new Error('Failed at step: upload site photo')
      }

      throw new Error('Failed at step: insert into photos table')
    }
  }

  return { log: createdLog }
}

export { getBundleGroupsForLog }
