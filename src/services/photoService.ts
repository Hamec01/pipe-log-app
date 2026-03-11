import { db } from '../db/db'
import type { PhotoKind, PhotoRecord } from '../models/types'

interface CreatePhotoInput {
  logId: number
  file: Blob
  type: PhotoKind
  fileName: string
  mimeType?: string
}

export async function createPhoto(input: CreatePhotoInput): Promise<PhotoRecord> {
  const id = await db.photos.add({
    log_id: input.logId,
    type: input.type,
    kind: input.type,
    blob: input.file,
    file_name: input.fileName,
    mime_type: input.mimeType || 'application/octet-stream',
    created_at: new Date().toISOString(),
    sync_status: 'local',
  })

  const created = await db.photos.get(id)
  if (!created) {
    throw new Error('Could not create photo.')
  }

  return created
}

export async function getPhotoById(photoId: number): Promise<PhotoRecord | undefined> {
  return db.photos.get(photoId)
}

export async function listPhotosByLogId(logId: number): Promise<PhotoRecord[]> {
  const rows = await db.photos.where('log_id').equals(logId).toArray()
  return rows
    .map((row) => ({ ...row, kind: row.kind ?? row.type }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function updatePhoto(photoId: number, patch: Partial<Pick<PhotoRecord, 'type' | 'file_name'>>): Promise<PhotoRecord> {
  const current = await db.photos.get(photoId)
  if (!current) {
    throw new Error('Photo not found.')
  }

  await db.photos.update(photoId, {
    type: patch.type ?? current.type,
    kind: patch.type ?? current.kind ?? current.type,
    file_name: patch.file_name ?? current.file_name,
    sync_status: 'modified',
  })

  const updated = await db.photos.get(photoId)
  if (!updated) {
    throw new Error('Could not update photo.')
  }

  return updated
}

export async function deletePhoto(photoId: number): Promise<void> {
  await db.photos.delete(photoId)
}

export async function savePhotoBlob(params: { logId: number; file: File; kind: PhotoKind }): Promise<PhotoRecord> {
  const log = await db.logs.get(params.logId)
  if (!log) {
    throw new Error('Log not found for photo save.')
  }

  return createPhoto({
    logId: params.logId,
    file: params.file,
    type: params.kind,
    fileName: params.file.name,
    mimeType: params.file.type || 'application/octet-stream',
  })
}

export async function savePhoto(input: { logId: number; file: File; kind: PhotoKind }): Promise<PhotoRecord> {
  return savePhotoBlob(input)
}

export function createPhotoObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
