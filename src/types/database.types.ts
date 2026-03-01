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
        Relationships: []
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
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "dealers_dealer_group_id_fkey"
            columns: ["dealer_group_id"]
            isOneToOne: false
            referencedRelation: "dealer_groups"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: []
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
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "dealer_prices_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: "orders_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "order_status_transitions_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_transitions_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "order_statuses"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      support_messages: {
        Row: {
          id: string
          dealer_id: string
          subject: string
          category: 'siparis' | 'urun' | 'odeme' | 'teknik' | 'diger'
          body: string
          status: 'pending' | 'answered'
          reply_body: string | null
          replied_at: string | null
          replied_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dealer_id: string
          subject: string
          category: 'siparis' | 'urun' | 'odeme' | 'teknik' | 'diger'
          body: string
          status?: 'pending' | 'answered'
          reply_body?: string | null
          replied_at?: string | null
          replied_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dealer_id?: string
          subject?: string
          category?: 'siparis' | 'urun' | 'odeme' | 'teknik' | 'diger'
          body?: string
          status?: 'pending' | 'answered'
          reply_body?: string | null
          replied_at?: string | null
          replied_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          }
        ]
      }
      faq_categories: {
        Row: {
          id: string
          name: string
          display_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          display_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          display_order?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          id: string
          category_id: string
          question: string
          answer: string
          display_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id: string
          question: string
          answer: string
          display_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          question?: string
          answer?: string
          display_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faq_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "faq_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      product_requests: {
        Row: {
          id: string
          dealer_id: string
          product_id: string | null
          product_name: string
          product_code: string | null
          requested_quantity: number
          notes: string | null
          status: 'open' | 'in_review' | 'fulfilled' | 'rejected'
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          dealer_id: string
          product_id?: string | null
          product_name: string
          product_code?: string | null
          requested_quantity?: number
          notes?: string | null
          status?: 'open' | 'in_review' | 'fulfilled' | 'rejected'
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          dealer_id?: string
          product_id?: string | null
          product_name?: string
          product_code?: string | null
          requested_quantity?: number
          notes?: string | null
          status?: 'open' | 'in_review' | 'fulfilled' | 'rejected'
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_requests_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: []
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

// ============================================
// Convenience type aliases for Phase 7 tables
// ============================================

export type SupportMessage = Database['public']['Tables']['support_messages']['Row']
export type SupportMessageInsert = Database['public']['Tables']['support_messages']['Insert']
export type SupportMessageUpdate = Database['public']['Tables']['support_messages']['Update']

export type FaqCategory = Database['public']['Tables']['faq_categories']['Row']
export type FaqCategoryInsert = Database['public']['Tables']['faq_categories']['Insert']
export type FaqCategoryUpdate = Database['public']['Tables']['faq_categories']['Update']

export type FaqItem = Database['public']['Tables']['faq_items']['Row']
export type FaqItemInsert = Database['public']['Tables']['faq_items']['Insert']
export type FaqItemUpdate = Database['public']['Tables']['faq_items']['Update']

export type ProductRequest = Database['public']['Tables']['product_requests']['Row']
export type ProductRequestInsert = Database['public']['Tables']['product_requests']['Insert']
export type ProductRequestUpdate = Database['public']['Tables']['product_requests']['Update']

// ============================================
// Composite types for common query patterns
// ============================================

// FAQ categories with nested items (used in dealer FAQ page)
export type FaqCategoryWithItems = FaqCategory & {
  faq_items: FaqItem[]
}

// Support message with dealer info (used in admin inbox)
export type SupportMessageWithDealer = SupportMessage & {
  dealers: { company_name: string }
}
