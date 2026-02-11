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
          vehicle_plate: string | null
          driver_name: string | null
          driver_phone: string | null
          cargo_notes: string | null
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
          vehicle_plate?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          cargo_notes?: string | null
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
          vehicle_plate?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          cargo_notes?: string | null
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
      dealer_favorites: {
        Row: {
          id: string
          dealer_id: string
          product_id: string
          created_at: string
        }
        Insert: {
          id?: string
          dealer_id: string
          product_id: string
          created_at?: string
        }
        Update: {
          id?: string
          dealer_id?: string
          product_id?: string
          created_at?: string
        }
      }
      transaction_types: {
        Row: {
          id: string
          code: string
          name: string
          balance_effect: 'debit' | 'credit'
          display_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          balance_effect: 'debit' | 'credit'
          display_order: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          balance_effect?: 'debit' | 'credit'
          display_order?: number
          is_active?: boolean
          created_at?: string
        }
      }
      dealer_transactions: {
        Row: {
          id: string
          dealer_id: string
          transaction_type_id: string
          amount: number
          reference_number: string | null
          order_id: string | null
          description: string
          notes: string | null
          transaction_date: string
          due_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dealer_id: string
          transaction_type_id: string
          amount: number
          reference_number?: string | null
          order_id?: string | null
          description: string
          notes?: string | null
          transaction_date?: string
          due_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dealer_id?: string
          transaction_type_id?: string
          amount?: number
          reference_number?: string | null
          order_id?: string | null
          description?: string
          notes?: string | null
          transaction_date?: string
          due_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      dealer_invoices: {
        Row: {
          id: string
          dealer_id: string
          transaction_id: string | null
          invoice_number: string
          invoice_date: string
          total_amount: number
          file_name: string
          file_path: string
          file_size: number
          mime_type: string
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          dealer_id: string
          transaction_id?: string | null
          invoice_number: string
          invoice_date: string
          total_amount: number
          file_name: string
          file_path: string
          file_size: number
          mime_type?: string
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          dealer_id?: string
          transaction_id?: string | null
          invoice_number?: string
          invoice_date?: string
          total_amount?: number
          file_name?: string
          file_path?: string
          file_size?: number
          mime_type?: string
          uploaded_by?: string | null
          created_at?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          title: string
          description: string | null
          image_url: string | null
          start_date: string
          end_date: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          image_url?: string | null
          start_date: string
          end_date: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          image_url?: string | null
          start_date?: string
          end_date?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      campaign_products: {
        Row: {
          id: string
          campaign_id: string
          product_id: string
          discount_percent: number | null
        }
        Insert: {
          id?: string
          campaign_id: string
          product_id: string
          discount_percent?: number | null
        }
        Update: {
          id?: string
          campaign_id?: string
          product_id?: string
          discount_percent?: number | null
        }
      }
      announcements: {
        Row: {
          id: string
          title: string
          content: string
          priority: number
          is_active: boolean
          published_at: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          priority?: number
          is_active?: boolean
          published_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          priority?: number
          is_active?: boolean
          published_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      announcement_reads: {
        Row: {
          id: string
          announcement_id: string
          dealer_id: string
          read_at: string
        }
        Insert: {
          id?: string
          announcement_id: string
          dealer_id: string
          read_at?: string
        }
        Update: {
          id?: string
          announcement_id?: string
          dealer_id?: string
          read_at?: string
        }
      }
      order_documents: {
        Row: {
          id: string
          order_id: string
          document_type: 'invoice' | 'irsaliye'
          file_name: string
          file_path: string
          file_size: number
          mime_type: string
          uploaded_by: string | null
          uploaded_at: string
        }
        Insert: {
          id?: string
          order_id: string
          document_type: 'invoice' | 'irsaliye'
          file_name: string
          file_path: string
          file_size: number
          mime_type?: string
          uploaded_by?: string | null
          uploaded_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          document_type?: 'invoice' | 'irsaliye'
          file_name?: string
          file_path?: string
          file_size?: number
          mime_type?: string
          uploaded_by?: string | null
          uploaded_at?: string
        }
      }
    }
    Views: {
      dealer_spending_summary: {
        Row: {
          dealer_id: string
          company_name: string
          month: string
          total_debit: number
          total_credit: number
          net_balance: number
        }
      }
    }
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
      get_dealer_balance: {
        Args: {
          p_dealer_id: string
        }
        Returns: number
      }
      get_dealer_balance_breakdown: {
        Args: {
          p_dealer_id: string
        }
        Returns: {
          total_debit: number
          total_credit: number
          net_balance: number
        }[]
      }
      get_top_products_for_dealer: {
        Args: {
          p_dealer_id: string
          p_limit?: number
        }
        Returns: {
          product_id: string
          product_name: string
          product_code: string
          total_quantity: number
          order_count: number
        }[]
      }
    }
    Enums: {}
  }
}
