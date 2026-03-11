import type { BundleRecord, SyncStatus } from '../models/types'
import { supabase } from '../lib/supabase'
import { getCurrentUser } from './authService'

interface CloudBundleRow {
  id: number
  bundle_number: string
  created_at: string
  updated_at: string | null
  created_by: string | null
}

function toBundleRecord(row: CloudBundleRow): BundleRecord {
  const syncStatus: SyncStatus = 'synced'
  return {
    id: row.id,
    bundle_number: row.bundle_number,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    sync_status: syncStatus,
  }
}

export async function listCloudBundles(): Promise<BundleRecord[]> {
  const { data, error } = await supabase
    .from('bundles')
    .select('id,bundle_number,created_at,updated_at,created_by')
    .order('bundle_number', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(toBundleRecord)
}

export async function getCloudBundleById(bundleId: number): Promise<BundleRecord | undefined> {
  const { data, error } = await supabase
    .from('bundles')
    .select('id,bundle_number,created_at,updated_at,created_by')
    .eq('id', bundleId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? toBundleRecord(data) : undefined
}

export async function getOrCreateCloudBundleByNumber(bundleNumber: string): Promise<BundleRecord> {
  const normalized = bundleNumber.trim()
  if (!normalized) {
    throw new Error('Bundle number is required.')
  }

  const { data: existing, error: fetchError } = await supabase
    .from('bundles')
    .select('id,bundle_number,created_at,updated_at,created_by')
    .eq('bundle_number', normalized)
    .maybeSingle()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  if (existing) {
    return toBundleRecord(existing)
  }

  const user = await getCurrentUser()

  const { data, error } = await supabase
    .from('bundles')
    .insert({
      bundle_number: normalized,
      created_by: user?.id ?? null,
    })
    .select('id,bundle_number,created_at,updated_at,created_by')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return toBundleRecord(data)
}

export async function deleteCloudBundle(bundleId: number): Promise<void> {
  const { error } = await supabase.from('bundles').delete().eq('id', bundleId)
  if (error) {
    throw new Error(error.message)
  }
}
