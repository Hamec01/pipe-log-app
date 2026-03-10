import { db } from '../db/db'
import type { PhotoKind, PhotoPipeRecord, PhotoRecord } from '../models/types'

interface CreatePhotoInput {
  logId: number
  bundleId: number
  file: Blob
  type: PhotoKind
  fileName: string
  mimeType?: string
  pipeId?: number
}

export async function createPhoto(input: CreatePhotoInput): Promise<PhotoRecord> {
  const id = await db.photos.add({
    log_id: input.logId,
    bundle_id: input.bundleId,
    pipe_id: input.pipeId,
    type: input.type,
    kind: input.type,
    blob: input.file,
    file_name: input.fileName,
    mime_type: input.mimeType || 'application/octet-stream',
    created_at: new Date().toISOString(),
    sync_status: 'local',
  })

  if (typeof id !== 'number') {
    throw new Error('Could not create photo.')
  }

  const created = await db.photos.get(id)
  if (!created) {
    throw new Error('Could not load created photo.')
  }

  return created
}

export async function getPhotoById(photoId: number): Promise<PhotoRecord | undefined> {
  return db.photos.get(photoId)
}

export async function listPhotosByLogId(logId: number): Promise<PhotoRecord[]> {
  const rows = await db.photos.where('log_id').equals(logId).toArray()
  return rows
    .map((row) => ({
      ...row,
      kind: row.kind ?? row.type,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function updatePhoto(photoId: number, patch: Partial<Pick<PhotoRecord, 'type' | 'pipe_id' | 'file_name'>>): Promise<PhotoRecord> {
  const current = await db.photos.get(photoId)
  if (!current) {
    throw new Error('Photo not found.')
  }

  await db.photos.update(photoId, {
    type: patch.type ?? current.type,
    kind: patch.type ?? current.kind ?? current.type,
    pipe_id: patch.pipe_id ?? current.pipe_id,
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
  await db.transaction('rw', db.photos, db.photo_pipes, async () => {
    await db.photo_pipes.where('photo_id').equals(photoId).delete()
    await db.photos.delete(photoId)
  })
}

export async function createPhotoPipeLink(photoId: number, pipeId: number): Promise<PhotoPipeRecord> {
  const existing = await db.photo_pipes
    .where('[photo_id+pipe_id]')
    .equals([photoId, pipeId])
    .first()

  if (existing) {
    return existing
  }

  const id = await db.photo_pipes.add({
    photo_id: photoId,
    pipe_id: pipeId,
    created_at: new Date().toISOString(),
    sync_status: 'local',
  })

  if (typeof id !== 'number') {
    throw new Error('Could not create photo-pipe link.')
  }

  const created = await db.photo_pipes.get(id)
  if (!created) {
    throw new Error('Could not load created photo-pipe link.')
  }

  return created
}

export async function listPhotoPipeLinksByPhotoId(photoId: number): Promise<PhotoPipeRecord[]> {
  return db.photo_pipes.where('photo_id').equals(photoId).toArray()
}

export async function deletePhotoPipeLink(photoId: number, pipeId: number): Promise<void> {
  const rows = await db.photo_pipes
    .where('[photo_id+pipe_id]')
    .equals([photoId, pipeId])
    .toArray()

  for (const row of rows) {
    if (typeof row.id === 'number') {
      await db.photo_pipes.delete(row.id)
    }
  }
}

export async function savePhotoBlob(params: {
  logId: number
  file: File
  kind: PhotoKind
  pipeId?: number
}): Promise<PhotoRecord> {
  return db.transaction('rw', db.photos, async () => {
    const log = await db.logs.get(params.logId)
    if (!log) {
      throw new Error('Log not found for photo save.')
    }

    const blobValue: Blob = params.file

    const photo = await createPhoto({
      logId: params.logId,
      bundleId: log.bundle_id,
      file: blobValue,
      type: params.kind,
      fileName: params.file.name,
      mimeType: params.file.type || 'application/octet-stream',
      pipeId: params.pipeId,
    })

    return photo
  })
}

export async function savePhoto(input: {
  logId: number
  file: File
  kind: PhotoKind
  pipeId?: number
}): Promise<PhotoRecord> {
  return savePhotoBlob(input)
}

export function createPhotoObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}
