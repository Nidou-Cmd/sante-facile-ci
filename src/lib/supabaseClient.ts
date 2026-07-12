import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY manquantes. ' +
      'Copiez .env.example vers .env puis renseignez les clés de votre projet Supabase (Project Settings > API).',
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
