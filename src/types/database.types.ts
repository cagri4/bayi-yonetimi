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
      users: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'dealer'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role: 'admin' | 'dealer'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'dealer'
          created_at?: string
          updated_at?: string
        }
      }
      dealer_groups: {
        Row: {
          id: string
          name: string
          discount_percent: number
          min_order_amount: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          discount_percent?: number
          min_order_amount?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          discount_percent?: number
          min_order_amount?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      dealers: {
        Row: {
          id: string
          user_id: string | null
          company_name: string
          email: string
          phone: string | null
          address: string | null
          dealer_group_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          company_name: string
          email: string
          phone?: string | null
          address?: string | null
          dealer_group_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          company_name?: string
          email?: string
          phone?: string | null
          address?: string | null
          dealer_group_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          parent_id: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          parent_id?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          parent_id?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      brands: {
        Row: {
          id: string
          name: string
          slug: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          is_active?: boolean
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          code: string
          name: string
          description: string | null
          base_price: number
          stock_quantity: number
          low_stock_threshold: number
          image_url: string | null
          category_id: string | null
          brand_id: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          description?: string | null
          base_price: number
          stock_quantity?: number
          low_stock_threshold?: number
          image_url?: string | null
          category_id?: string | null
          brand_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          description?: string | null
          base_price?: number
          stock_quantity?: number
          low_stock_threshold?: number
          image_url?: string | null
          category_id?: string | null
          brand_id?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      dealer_prices: {
        Row: {
          id: string
          dealer_id: string
          product_id: string
          custom_price: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dealer_id: string
          product_id: string
          custom_price: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dealer_id?: string
          product_id?: string
          custom_price?: number
          created_at?: string
          updated_at?: string
        }
      }
      order_statuses: {
        Row: {
          id: string
          code: string
          name: string
          display_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          display_order: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          display_order?: number
          is_active?: boolean
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          order_number: string
          dealer_id: string
          status_id: string
          subtotal: number
          discount_amount: number
          total_amount: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number: string
          dealer_id: string
          status_id: string
          subtotal: number
          discount_amount?: number
          total_amount: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_number?: string
          dealer_id?: string
          status_id?: string
          subtotal?: number
          discount_amount?: number
          total_amount?: number
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          product_code: string
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          product_code: string
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          product_code?: string
          product_name?: string
          quantity?: number
          unit_price?: number
          total_price?: number
          created_at?: string
        }
      }
      order_status_history: {
        Row: {
          id: string
          order_id: string
          status_id: string
          changed_by: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          status_id: string
          changed_by?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          status_id?: string
          changed_by?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      order_status_transitions: {
        Row: {
          id: string
          from_status_id: string | null
          to_status_id: string | null
        }
        Insert: {
          id?: string
          from_status_id?: string | null
          to_status_id?: string | null
        }
        Update: {
          id?: string
          from_status_id?: string | null
          to_status_id?: string | null
        }
      }
    }
    Views: {}
    Functions: {
      generate_order_number: {
        Args: Record<string, never>
        Returns: string
      }
      get_dealer_price: {
        Args: {
          p_product_id: string
          p_dealer_id: string
        }
        Returns: number
      }
    }
    Enums: {}
  }
}
