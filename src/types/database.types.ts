export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // Will be populated after schema migration
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
