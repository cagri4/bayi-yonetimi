import 'react-native-url-polyfill/auto'
import { openDatabaseSync } from 'expo-sqlite'
import { createClient } from '@supabase/supabase-js'

// Initialize SQLite storage for session persistence
const db = openDatabaseSync('supabase-storage.db')

// Create storage table if not exists
db.execSync(`
  CREATE TABLE IF NOT EXISTS storage (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`)

const ExpoStorage = {
  getItem: (key: string): string | null => {
    const result = db.getFirstSync<{ value: string }>(
      'SELECT value FROM storage WHERE key = ?',
      [key]
    )
    return result?.value ?? null
  },
  setItem: (key: string, value: string): void => {
    db.runSync(
      'INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?)',
      [key, value]
    )
  },
  removeItem: (key: string): void => {
    db.runSync('DELETE FROM storage WHERE key = ?', [key])
  },
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for mobile
  },
})
