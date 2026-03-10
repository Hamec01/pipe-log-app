import Dexie, { type Table } from 'dexie'
import type {
  BundleRecord,
  LogPipeRecord,
  LogRecord,
  PhotoPipeRecord,
  PhotoRecord,
  PipeRecord,
} from '../models/types'

const DB_NAME = 'ardorpipe'
const DB_VERSION = 4

const schemaV1 = {
  bundles: '++id,&bundle_number,created_at',
  logs: '++id,bundle_id,log_number,[bundle_id+log_number],date_time,pressure_bar,created_at',
  pipes: '++id,bundle_id,pipe_number,[bundle_id+pipe_number],created_at',
  log_pipes: '++id,log_id,pipe_id,[log_id+pipe_id],[pipe_id+log_id],created_at',
  photos: '++id,log_id,type,mime_type,file_name,created_at',
  photo_pipes: '++id,photo_id,pipe_id,[photo_id+pipe_id],created_at',
}

const schemaV2 = {
  bundles: '++id,&bundle_number,created_at,updated_at',
  logs: '++id,bundle_id,log_number,[bundle_id+log_number],date_time,pressure_bar,created_at,updated_at',
  pipes: '++id,bundle_id,pipe_number,[bundle_id+pipe_number],created_at,updated_at',
  log_pipes: '++id,log_id,pipe_id,[log_id+pipe_id],[pipe_id+log_id],created_at',
  photos: '++id,log_id,bundle_id,type,mime_type,file_name,created_at',
  photo_pipes: '++id,photo_id,pipe_id,[photo_id+pipe_id],created_at',
}

const schemaV3 = {
  bundles: '++id,&bundle_number,created_at,updated_at,deleted_at,sync_status',
  logs: '++id,bundle_id,log_number,[bundle_id+log_number],date_time,pressure_bar,created_at,updated_at,deleted_at,sync_status',
  pipes: '++id,bundle_id,pipe_number,[bundle_id+pipe_number],created_at,updated_at,deleted_at,sync_status',
  log_pipes: '++id,log_id,pipe_id,[log_id+pipe_id],[pipe_id+log_id],created_at,updated_at,deleted_at,sync_status',
  photos:
    '++id,log_id,bundle_id,type,kind,mime_type,file_name,created_at,updated_at,deleted_at,sync_status',
  photo_pipes: '++id,photo_id,pipe_id,[photo_id+pipe_id],created_at,updated_at,deleted_at,sync_status',
}

const schemaV4 = {
  bundles: '++id,&bundle_number,created_at,updated_at,deleted_at,sync_status',
  logs: '++id,bundle_id,log_number,[bundle_id+log_number],date_time,pressure_bar,created_at,updated_at,deleted_at,sync_status',
  pipes: '++id,bundle_id,pipe_number,[bundle_id+pipe_number],created_at,updated_at,deleted_at,sync_status',
  log_pipes: '++id,log_id,pipe_id,[log_id+pipe_id],[pipe_id+log_id],created_at,updated_at,deleted_at,sync_status',
  photos:
    '++id,log_id,bundle_id,type,kind,mime_type,file_name,created_at,updated_at,deleted_at,sync_status',
  photo_pipes: '++id,photo_id,pipe_id,[photo_id+pipe_id],created_at,updated_at,deleted_at,sync_status',
}

export class ArdorPipeDB extends Dexie {
  bundles!: Table<BundleRecord, number>
  logs!: Table<LogRecord, number>
  pipes!: Table<PipeRecord, number>
  log_pipes!: Table<LogPipeRecord, number>
  photos!: Table<PhotoRecord, number>
  photo_pipes!: Table<PhotoPipeRecord, number>

  constructor() {
    super(DB_NAME)

    this.version(1).stores(schemaV1)

    this.version(2)
      .stores(schemaV2)
      .upgrade(async (tx) => {
        const now = new Date().toISOString()

        await tx.table('bundles').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
          item.updated_at = item.updated_at ?? item.created_at ?? now
        })

        await tx.table('logs').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
          item.updated_at = item.updated_at ?? item.created_at ?? now
        })

        await tx.table('pipes').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
          item.updated_at = item.updated_at ?? item.created_at ?? now
        })

        await tx.table('log_pipes').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
          item.created_at = item.created_at ?? now
        })

        await tx.table('photos').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
          item.bundle_id = item.bundle_id ?? 0
          item.type = item.type ?? item.kind ?? 'site'
          item.kind = item.kind ?? item.type
          item.created_at = item.created_at ?? now
        })

        await tx.table('photo_pipes').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
          item.created_at = item.created_at ?? now
        })
      })

    this.version(3)
      .stores(schemaV3)
      .upgrade(async (tx) => {
        const now = new Date().toISOString()

        await tx.table('bundles').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
          item.deleted_at = item.deleted_at ?? null
          item.sync_status = item.sync_status ?? 'local'
        })

        await tx.table('logs').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
          item.deleted_at = item.deleted_at ?? null
          item.sync_status = item.sync_status ?? 'local'
        })

        await tx.table('pipes').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
          item.deleted_at = item.deleted_at ?? null
          item.sync_status = item.sync_status ?? 'local'
        })

        await tx.table('log_pipes').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
          item.deleted_at = item.deleted_at ?? null
          item.sync_status = item.sync_status ?? 'local'
        })

        await tx.table('photos').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
          item.deleted_at = item.deleted_at ?? null
          item.sync_status = item.sync_status ?? 'local'
          item.bundle_id = item.bundle_id ?? 0
          item.type = item.type ?? item.kind ?? 'site'
          item.kind = item.kind ?? item.type
        })

        await tx.table('photo_pipes').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
          item.deleted_at = item.deleted_at ?? null
          item.sync_status = item.sync_status ?? 'local'
        })
      })

    this.version(DB_VERSION)
      .stores(schemaV4)
      .upgrade(async (tx) => {
        const now = new Date().toISOString()

        await tx.table('bundles').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
        })

        await tx.table('logs').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
        })

        await tx.table('pipes').toCollection().modify((item) => {
          item.updated_at = item.updated_at ?? item.created_at ?? now
        })

        await tx.table('photos').toCollection().modify((item) => {
          item.bundle_id = item.bundle_id ?? 0
          item.type = item.type ?? item.kind ?? 'site'
          item.kind = item.kind ?? item.type
        })
      })
  }
}

export const db = new ArdorPipeDB()

export async function hardResetDatabase(): Promise<void> {
  await db.delete()
  window.location.reload()
}
