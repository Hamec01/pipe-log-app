import Dexie, { type Table } from 'dexie'
import type {
  BundlePipeRecord,
  BundleRecord,
  LogPipeRecord,
  LogRecord,
  PhotoRecord,
  PipeRecord,
} from '../models/types'

const DB_NAME = 'ardorpipe_v2'
const DB_VERSION = 1

const schema = {
  bundles: '++id,&bundle_number,created_at,updated_at,sync_status',
  logs: '++id,&log_number,date_time,pressure_bar,created_at,updated_at,sync_status',
  pipes: '++id,&pipe_number,created_at,updated_at,sync_status',
  bundle_pipes: '++id,bundle_id,pipe_id,[bundle_id+pipe_id],[pipe_id+bundle_id],created_at,sync_status',
  log_pipes: '++id,log_id,pipe_id,[log_id+pipe_id],[pipe_id+log_id],created_at,sync_status',
  photos: '++id,log_id,type,mime_type,file_name,created_at,sync_status',
}

export class ArdorPipeDB extends Dexie {
  bundles!: Table<BundleRecord, number>
  logs!: Table<LogRecord, number>
  pipes!: Table<PipeRecord, number>
  bundle_pipes!: Table<BundlePipeRecord, number>
  log_pipes!: Table<LogPipeRecord, number>
  photos!: Table<PhotoRecord, number>

  constructor() {
    super(DB_NAME)
    this.version(DB_VERSION).stores(schema)
  }
}

export const db = new ArdorPipeDB()

export async function hardResetDatabase(): Promise<void> {
  await db.delete()
  window.location.reload()
}
