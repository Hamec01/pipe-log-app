import type { PhotoKind } from '../models/types'
import { supabase } from '../lib/supabase'

const BUCKET_NAME = 'pipe-photos'

export interface UploadPhotoParams {
  logId: number
  type: PhotoKind
  file: File
}

export interface SupabasePhoto {
  id: number
  log_id: number
  type: PhotoKind
  storage_path: string
  file_name: string
  mime_type: string
  created_at: string
  public_url: string | null
}

function extensionFromFile(file: File): string {
  if (file.name.includes('.')) {
    return file.name.split('.').pop() || 'jpg'
  }

  if (file.type === 'image/png') {
    return 'png'
  }

  return 'jpg'
}

export async function uploadPhoto(params: UploadPhotoParams): Promise<SupabasePhoto> {
  const extension = extensionFromFile(params.file)
  const storagePath = `logs/${params.logId}/${params.type}-${Date.now()}.${extension}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, params.file, {
      contentType: params.file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(uploadError.message)
  }

  const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath)

  const { data, error } = await supabase
    .from('photos')
    .insert({
      log_id: params.logId,
      type: params.type,
      storage_path: storagePath,
      public_url: publicData.publicUrl,
      file_name: params.file.name,
      mime_type: params.file.type || 'application/octet-stream',
    })
    .select('id,log_id,type,storage_path,file_name,mime_type,created_at,public_url')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function getPhotosByLog(logId: number): Promise<SupabasePhoto[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('id,log_id,type,storage_path,file_name,mime_type,created_at,public_url')
    .eq('log_id', logId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return data ?? []
}

export async function deletePhoto(photoId: number): Promise<void> {
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

export function getPhotoUrl(photo: SupabasePhoto): string {
  if (photo.public_url) {
    return photo.public_url
  }

  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(photo.storage_path)
  return data.publicUrl
}
