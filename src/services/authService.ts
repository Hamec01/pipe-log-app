import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export async function signUp(email: string, password: string): Promise<User | null> {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) {
    throw new Error(error.message)
  }

  return data.user
}

export async function signIn(email: string, password: string): Promise<User | null> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(error.message)
  }

  return data.user
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) {
    throw new Error(error.message)
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error) {
    throw new Error(error.message)
  }

  return data.user
}
