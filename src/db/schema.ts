import type {
  BundlePipeRecord,
  BundleRecord,
  LogPipeRecord,
  LogRecord,
  PhotoRecord,
  PipeRecord,
} from '../models/types'

export interface AppDBSchema {
  bundles: BundleRecord
  logs: LogRecord
  pipes: PipeRecord
  bundle_pipes: BundlePipeRecord
  log_pipes: LogPipeRecord
  photos: PhotoRecord
}

export const DB_NAME = 'ardorpipe'
export const DB_VERSION = 5

export const schemaDefinitionV1: Record<keyof AppDBSchema, string> = {
  bundles: '++id,&bundle_number,created_at',
  logs: '++id,&log_number,date_time,pressure_bar,created_at',
  pipes: '++id,&pipe_number,created_at',
  bundle_pipes: '++id,bundle_id,pipe_id,[bundle_id+pipe_id],[pipe_id+bundle_id],created_at',
  log_pipes: '++id,log_id,pipe_id,[log_id+pipe_id],[pipe_id+log_id],created_at',
  photos: '++id,log_id,kind,created_at',
}

export const schemaDefinition: Record<keyof AppDBSchema, string> = {
  bundles: '++id,&bundle_number,created_at,updated_at,sync_status,remote_id',
  logs: '++id,&log_number,date_time,pressure_bar,created_at,updated_at,sync_status,remote_id',
  pipes: '++id,&pipe_number,created_at,updated_at,sync_status,remote_id',
  bundle_pipes:
    '++id,bundle_id,pipe_id,[bundle_id+pipe_id],[pipe_id+bundle_id],created_at,sync_status,remote_id',
  log_pipes:
    '++id,log_id,pipe_id,[log_id+pipe_id],[pipe_id+log_id],created_at,sync_status,remote_id',
  photos: '++id,log_id,kind,mime_type,file_name,created_at,sync_status,remote_id',
}
