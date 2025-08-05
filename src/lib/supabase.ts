import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface RectifierData {
  id: number
  slave_id: number
  voltage: number | null
  current: number | null
  status_code: string | null
  timestamp: string
}

export interface WorkData {
  id: number
  pid: string
  starttime: string
  endtime: string | null
  created_at: string
}
