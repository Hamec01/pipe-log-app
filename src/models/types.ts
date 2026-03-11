export type PhotoKind = 'gauge' | 'site' | 'pipe'
export type SyncStatus = 'local' | 'synced' | 'modified' | 'deleted'

export interface BundleRecord {
  id?: number
  bundle_number: string
  created_at: string
  updated_at: string
  sync_status: SyncStatus
}

export interface LogRecord {
  id?: number
  log_number: string
  pressure_bar: number
  date_time: string
  notes?: string
  created_at: string
  updated_at: string
  sync_status: SyncStatus
}

export interface PipeRecord {
  id?: number
  pipe_number: string
  created_at: string
  updated_at: string
  sync_status: SyncStatus
}

export interface BundlePipeRecord {
  id?: number
  bundle_id: number
  pipe_id: number
  created_at: string
  sync_status: SyncStatus
}

export interface LogPipeRecord {
  id?: number
  log_id: number
  pipe_id: number
  created_at: string
  sync_status: SyncStatus
}

export interface PhotoRecord {
  id?: number
  log_id: number
  type: PhotoKind
  blob: Blob
  mime_type: string
  file_name: string
  created_at: string
  kind: PhotoKind
  sync_status: SyncStatus
}
