import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type PhotoType = 'gauge' | 'site' | 'pipe'

export interface Database {
  public: {
    Tables: {
      bundles: {
        Row: {
          id: number
          bundle_number: string
          created_at: string
          updated_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: never
          bundle_number: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          bundle_number?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      logs: {
        Row: {
          id: number
          log_number: string
          pressure_bar: number
          date_time: string
          notes: string | null
          created_at: string
          updated_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: never
          log_number: string
          pressure_bar: number
          date_time: string
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          log_number?: string
          pressure_bar?: number
          date_time?: string
          notes?: string | null
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      pipes: {
        Row: {
          id: number
          pipe_number: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: never
          pipe_number: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          pipe_number?: string
          updated_at?: string
        }
        Relationships: []
      }
      bundle_pipes: {
        Row: {
          id: number
          bundle_id: number
          pipe_id: number
          created_at: string
        }
        Insert: {
          id?: never
          bundle_id: number
          pipe_id: number
          created_at?: string
        }
        Update: {
          bundle_id?: number
          pipe_id?: number
        }
        Relationships: []
      }
      log_pipes: {
        Row: {
          id: number
          log_id: number
          pipe_id: number
          created_at: string
        }
        Insert: {
          id?: never
          log_id: number
          pipe_id: number
          created_at?: string
        }
        Update: {
          log_id?: number
          pipe_id?: number
        }
        Relationships: []
      }
      photos: {
        Row: {
          id: number
          log_id: number
          type: PhotoType
          storage_path: string
          public_url: string | null
          file_name: string
          mime_type: string
          created_at: string
          uploaded_by: string | null
        }
        Insert: {
          id?: never
          log_id: number
          type: PhotoType
          storage_path: string
          public_url?: string | null
          file_name: string
          mime_type: string
          created_at?: string
          uploaded_by?: string | null
        }
        Update: {
          public_url?: string | null
          file_name?: string
          mime_type?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.',
  )
}

export const supabase: SupabaseClient<Database> = createClient<Database>(supabaseUrl, supabaseAnonKey)
export const isCloudModeEnabled = true
