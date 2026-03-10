import type {
  BundleRecord,
  LogPipeRecord,
  LogRecord,
  PhotoPipeRecord,
  PhotoRecord,
  PipeRecord,
} from '../models/types'

export interface AppDBSchema {
  bundles: BundleRecord
  logs: LogRecord
  pipes: PipeRecord
  log_pipes: LogPipeRecord
  photos: PhotoRecord
  photo_pipes: PhotoPipeRecord
}

export const DB_NAME = 'ardorpipe'
export const DB_VERSION = 3

export const schemaDefinitionV1: Record<keyof AppDBSchema, string> = {
  bundles: '++id,&bundle_number,created_at',
  logs: '++id,bundle_id,log_number,[bundle_id+log_number],date_time,pressure_bar,created_at',
  pipes: '++id,bundle_id,pipe_number,[bundle_id+pipe_number],created_at',
  log_pipes: '++id,log_id,pipe_id,[log_id+pipe_id],[pipe_id+log_id],created_at',
  photos: '++id,log_id,pipe_id,kind,created_at',
  photo_pipes: '++id,photo_id,pipe_id,[photo_id+pipe_id],created_at',
}

export const schemaDefinition: Record<keyof AppDBSchema, string> = {
  bundles: '++id,&bundle_number,created_at,updated_at,deleted_at,sync_status,remote_id',
  logs:
    '++id,bundle_id,log_number,[bundle_id+log_number],date_time,pressure_bar,created_at,updated_at,deleted_at,sync_status,remote_id',
  pipes:
    '++id,bundle_id,pipe_number,[bundle_id+pipe_number],created_at,updated_at,deleted_at,sync_status,remote_id',
  log_pipes:
    '++id,log_id,pipe_id,[log_id+pipe_id],[pipe_id+log_id],created_at,updated_at,deleted_at,sync_status,remote_id',
  photos:
    '++id,log_id,bundle_id,pipe_id,kind,created_at,updated_at,deleted_at,sync_status,remote_id',
  photo_pipes:
    '++id,photo_id,pipe_id,[photo_id+pipe_id],created_at,updated_at,deleted_at,sync_status,remote_id',
}
