import { supabase } from '../lib/supabase'
import { getCurrentUser } from './authService'
import type { PhotoKind } from '../models/types'

const BUCKET_NAME = 'pipe-photos'

export interface CloudPhotoRecord {
  id: number
  log_id: number
  type: PhotoKind
  storage_path: string
  public_url: string | null
  file_name: string
  mime_type: string
  created_at: string
  uploaded_by: string | null
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function uploadCloudPhoto(params: {
  logId: number
  bundleId: number
  type: PhotoKind
  file: File
}): Promise<CloudPhotoRecord> {
  const user = await getCurrentUser()
  const safeName = sanitizeFileName(params.file.name)
  const storagePath = `${params.bundleId}/${params.logId}/${Date.now()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, params.file, {
      upsert: false,
      contentType: params.file.type || 'application/octet-stream',
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath)

  const { data, error } = await supabase
    .from('photos')
    .insert({
      log_id: params.logId,
      type: params.type,
      storage_path: storagePath,
      public_url: publicUrlData.publicUrl,
      file_name: params.file.name,
      mime_type: params.file.type || 'application/octet-stream',
      uploaded_by: user?.id ?? null,
    })
    .select('id,log_id,type,storage_path,public_url,file_name,mime_type,created_at,uploaded_by')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function listCloudPhotosByLogId(logId: number): Promise<CloudPhotoRecord[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('id,log_id,type,storage_path,public_url,file_name,mime_type,created_at,uploaded_by')
    .eq('log_id', logId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function deleteCloudPhoto(photoId: number): Promise<void> {
  const { data, error } = await supabase
    .from('photos')
    .select('id,storage_path')
    .eq('id', photoId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (data?.storage_path) {
    const { error: removeStorageError } = await supabase.storage.from(BUCKET_NAME).remove([data.storage_path])
    if (removeStorageError) {
      throw new Error(removeStorageError.message)
    }
  }

  const { error: deleteError } = await supabase.from('photos').delete().eq('id', photoId)
  if (deleteError) {
    throw new Error(deleteError.message)
  }
}
