# Architecture Research: v2.0 Integration

**Project:** B2B Bayi Siparis Yonetim Sistemi
**Research Date:** 2026-02-08
**Research Focus:** Architectural integration of v2.0 dealer experience and financial tracking features into existing Supabase/Next.js infrastructure
**Confidence Level:** HIGH

## Summary

v2.0 features integrate seamlessly into the existing multi-tenant Supabase architecture using established patterns:

**Database:** 7 new tables with standard RLS policies following existing multi-tenant security model
**Storage:** 2 new buckets (financial-documents, order-attachments) with dealer-scoped RLS
**API:** Extend existing Server Actions pattern in `src/lib/actions/` with new domains
**Components:** New route groups under `(dealer)/` following existing layout structure
**Realtime:** Optional subscriptions for campaigns/announcements using existing postgres_changes pattern

**Key architectural decision:** All new features follow the established "dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())" RLS pattern, maintaining security consistency across all tables.

## New Database Tables

### 1. dealer_transactions

**Purpose:** Financial transaction ledger for ERP-ready dealer account tracking (borç/alacak)

**Key columns:**
```sql
CREATE TABLE dealer_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('invoice', 'payment', 'credit_note', 'debit_note')),
  amount DECIMAL(10,2) NOT NULL,
  balance_effect TEXT NOT NULL CHECK (balance_effect IN ('debit', 'credit')), -- debit = borç, credit = alacak
  description TEXT NOT NULL,
  reference_number TEXT, -- Fatura no, makbuz no
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  document_url TEXT, -- Supabase Storage path to PDF
  created_by UUID REFERENCES users(id), -- Admin who entered it
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dealer_transactions_dealer_id ON dealer_transactions(dealer_id);
CREATE INDEX idx_dealer_transactions_date ON dealer_transactions(transaction_date DESC);
CREATE INDEX idx_dealer_transactions_type ON dealer_transactions(transaction_type);
```

**Relationships:**
- `dealer_id` → `dealers(id)` (CASCADE DELETE)
- `created_by` → `users(id)` (admin who entered the transaction)
- `document_url` → Supabase Storage path (`financial-documents/{dealer_id}/{file}`)

**RLS Policy:**
```sql
-- Dealers can read own transactions
CREATE POLICY "Dealers can read own transactions"
  ON dealer_transactions FOR SELECT
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = auth.uid()
    )
  );

-- Admins can manage all transactions
CREATE POLICY "Admins can manage dealer transactions"
  ON dealer_transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = id AND role = 'admin'
    )
  );
```

**Business Logic:**
- Current balance calculation: `SELECT SUM(CASE WHEN balance_effect = 'debit' THEN amount ELSE -amount END) FROM dealer_transactions WHERE dealer_id = $1`
- ERP-ready schema: When ERP integration happens, this becomes the sync target (ERP writes transactions here)
- Admin manually enters transactions in v2.0; automated sync deferred to later milestone

---

### 2. favorite_products

**Purpose:** Dealer-specific favorite products for quick access

**Key columns:**
```sql
CREATE TABLE favorite_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(dealer_id, product_id)
);

CREATE INDEX idx_favorite_products_dealer_id ON favorite_products(dealer_id);
CREATE INDEX idx_favorite_products_product_id ON favorite_products(product_id);
```

**Relationships:**
- `dealer_id` → `dealers(id)` (CASCADE DELETE)
- `product_id` → `products(id)` (CASCADE DELETE)
- Composite unique constraint ensures one favorite per dealer-product pair

**RLS Policy:**
```sql
-- Dealers can manage own favorites
CREATE POLICY "Dealers can manage own favorites"
  ON favorite_products FOR ALL
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = auth.uid()
    )
  );
```

**Query Pattern:**
```typescript
// Get dealer's favorites with product details
const { data } = await supabase
  .from('favorite_products')
  .select(`
    id,
    created_at,
    product:products(
      id, code, name, base_price, stock_quantity, image_url,
      category:categories(name),
      brand:brands(name)
    )
  `)
  .eq('dealer_id', dealerId)
  .order('created_at', { ascending: false })
```

---

### 3. campaigns

**Purpose:** Admin-created marketing campaigns with optional product discounts

**Key columns:**
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('discount', 'announcement', 'promotion')),
  discount_percent DECIMAL(5,2), -- NULL if type = 'announcement'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  target_dealer_groups UUID[], -- NULL = all groups, array of dealer_group_ids = specific groups
  image_url TEXT, -- Optional campaign image
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_date >= start_date),
  CHECK (campaign_type = 'announcement' OR discount_percent IS NOT NULL)
);

CREATE INDEX idx_campaigns_active ON campaigns(is_active);
CREATE INDEX idx_campaigns_dates ON campaigns(start_date, end_date);
```

**Relationships:**
- `target_dealer_groups` → Array of `dealer_groups(id)` (NULL = all dealers)
- `image_url` → Supabase Storage path (public bucket or signed URL)

**RLS Policy:**
```sql
-- All authenticated users can read active campaigns relevant to them
CREATE POLICY "Dealers can read relevant campaigns"
  ON campaigns FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND CURRENT_DATE BETWEEN start_date AND end_date
    AND (
      target_dealer_groups IS NULL -- Campaign targets all groups
      OR EXISTS ( -- Campaign targets dealer's group
        SELECT 1 FROM dealers
        WHERE user_id = auth.uid()
          AND dealer_group_id = ANY(target_dealer_groups)
      )
    )
  );

-- Admins can manage all campaigns
CREATE POLICY "Admins can manage campaigns"
  ON campaigns FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = id AND role = 'admin'
    )
  );
```

**Realtime:** Optional postgres_changes subscription for campaign updates (campaign created/activated targeting dealer's group)

---

### 4. campaign_products

**Purpose:** Join table linking campaigns to discounted products

**Key columns:**
```sql
CREATE TABLE campaign_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, product_id)
);

CREATE INDEX idx_campaign_products_campaign_id ON campaign_products(campaign_id);
CREATE INDEX idx_campaign_products_product_id ON campaign_products(product_id);
```

**Relationships:**
- `campaign_id` → `campaigns(id)` (CASCADE DELETE)
- `product_id` → `products(id)` (CASCADE DELETE)

**RLS Policy:**
```sql
-- Follows campaign visibility (dealers see products in campaigns they can see)
CREATE POLICY "Dealers can read campaign products for visible campaigns"
  ON campaign_products FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM campaigns
      WHERE is_active = true
        AND CURRENT_DATE BETWEEN start_date AND end_date
        AND (
          target_dealer_groups IS NULL
          OR EXISTS (
            SELECT 1 FROM dealers
            WHERE user_id = auth.uid()
              AND dealer_group_id = ANY(target_dealer_groups)
          )
        )
    )
  );

-- Admins can manage
CREATE POLICY "Admins can manage campaign products"
  ON campaign_products FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = id AND role = 'admin'
    )
  );
```

---

### 5. announcements

**Purpose:** Admin-to-dealer messaging system (system announcements, not campaigns)

**Key columns:**
```sql
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  target_dealer_groups UUID[], -- NULL = all dealers
  target_dealer_ids UUID[], -- NULL = all in groups, specific dealer_ids = only those dealers
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- NULL = no expiration
);

CREATE INDEX idx_announcements_active ON announcements(is_active);
CREATE INDEX idx_announcements_expires ON announcements(expires_at);
CREATE INDEX idx_announcements_created ON announcements(created_at DESC);
```

**Relationships:**
- `created_by` → `users(id)` (admin who created it)
- `target_dealer_groups` → Array of `dealer_groups(id)`
- `target_dealer_ids` → Array of `dealers(id)` (for specific targeting)

**RLS Policy:**
```sql
-- Dealers see announcements targeted to them
CREATE POLICY "Dealers can read targeted announcements"
  ON announcements FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (
      -- Targeted to all
      (target_dealer_groups IS NULL AND target_dealer_ids IS NULL)
      -- Targeted to dealer's group
      OR EXISTS (
        SELECT 1 FROM dealers
        WHERE user_id = auth.uid()
          AND (dealer_group_id = ANY(target_dealer_groups) OR target_dealer_groups IS NULL)
          AND (id = ANY(target_dealer_ids) OR target_dealer_ids IS NULL)
      )
    )
  );

-- Admins can manage all
CREATE POLICY "Admins can manage announcements"
  ON announcements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = id AND role = 'admin'
    )
  );
```

**Realtime:** High-value use case for postgres_changes subscription (urgent announcements)

---

### 6. support_messages

**Purpose:** Async dealer-to-admin messaging (ticket-like system)

**Key columns:**
```sql
CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'product_request', 'order_issue', 'account', 'technical')),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL, -- Optional product reference
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL, -- Optional order reference
  admin_response TEXT, -- Admin's response
  responded_by UUID REFERENCES users(id), -- Admin who responded
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_support_messages_dealer_id ON support_messages(dealer_id);
CREATE INDEX idx_support_messages_status ON support_messages(status);
CREATE INDEX idx_support_messages_created ON support_messages(created_at DESC);
```

**Relationships:**
- `dealer_id` → `dealers(id)` (CASCADE DELETE)
- `product_id` → `products(id)` (SET NULL, optional context)
- `order_id` → `orders(id)` (SET NULL, optional context)
- `responded_by` → `users(id)` (admin who responded)

**RLS Policy:**
```sql
-- Dealers can read/create own messages
CREATE POLICY "Dealers can manage own support messages"
  ON support_messages FOR ALL
  TO authenticated
  USING (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    dealer_id IN (
      SELECT id FROM dealers WHERE user_id = auth.uid()
    )
  );

-- Admins can manage all messages
CREATE POLICY "Admins can manage all support messages"
  ON support_messages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = id AND role = 'admin'
    )
  );
```

**Realtime:** Admin side should subscribe to new support_messages (postgres_changes INSERT event)

---

### 7. order_attachments

**Purpose:** Link orders to uploaded documents (fatura, irsaliye PDFs uploaded by admin)

**Key columns:**
```sql
CREATE TABLE order_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL, -- Supabase Storage path
  file_type TEXT NOT NULL CHECK (file_type IN ('invoice', 'waybill', 'other')),
  file_size INT NOT NULL, -- bytes
  uploaded_by UUID REFERENCES users(id), -- Admin who uploaded
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_attachments_order_id ON order_attachments(order_id);
CREATE INDEX idx_order_attachments_type ON order_attachments(file_type);
```

**Relationships:**
- `order_id` → `orders(id)` (CASCADE DELETE)
- `uploaded_by` → `users(id)` (admin who uploaded)
- `file_url` → Supabase Storage path (`order-attachments/{order_id}/{file}`)

**RLS Policy:**
```sql
-- Dealers can read attachments for their orders
CREATE POLICY "Dealers can read own order attachments"
  ON order_attachments FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT o.id FROM orders o
      JOIN dealers d ON o.dealer_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

-- Admins can manage all attachments
CREATE POLICY "Admins can manage order attachments"
  ON order_attachments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = id AND role = 'admin'
    )
  );
```

---

## Database Summary Table

| Table | Purpose | Foreign Keys | RLS Scope | Realtime |
|-------|---------|--------------|-----------|----------|
| `dealer_transactions` | Financial ledger | dealer_id, created_by | Dealer sees own | No |
| `favorite_products` | Favorites | dealer_id, product_id | Dealer manages own | No |
| `campaigns` | Marketing campaigns | target_dealer_groups[] | Dealer sees relevant | Optional |
| `campaign_products` | Campaign-product link | campaign_id, product_id | Follows campaign visibility | No |
| `announcements` | System messages | created_by, target arrays | Dealer sees targeted | Yes |
| `support_messages` | Dealer support tickets | dealer_id, product_id, order_id, responded_by | Dealer sees own, admin sees all | Yes (admin) |
| `order_attachments` | Order documents | order_id, uploaded_by | Dealer sees own orders | No |

---

## File Storage Architecture

### Storage Buckets

**1. financial-documents** (Private bucket)

**Purpose:** Store financial PDFs (invoices, receipts) linked to dealer_transactions

**Folder structure:**
```
financial-documents/
  {dealer_id}/
    {transaction_id}_{filename}.pdf
```

**RLS Policy:**
```sql
-- Dealers can read own documents
CREATE POLICY "Dealers can read own financial documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'financial-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM dealers WHERE user_id = auth.uid()
    )
  );

-- Admins can manage all documents
CREATE POLICY "Admins can manage financial documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'financial-documents'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = id AND role = 'admin'
    )
  );
```

**Upload pattern (Server Action):**
```typescript
// In admin action: uploadFinancialDocument(dealerId, transactionId, file)
const filePath = `${dealerId}/${transactionId}_${file.name}`
const { data, error } = await supabase.storage
  .from('financial-documents')
  .upload(filePath, file, { upsert: false })

// Store path in dealer_transactions.document_url
```

---

**2. order-attachments** (Private bucket)

**Purpose:** Store order-related documents (fatura, irsaliye) uploaded by admin

**Folder structure:**
```
order-attachments/
  {order_id}/
    {file_type}_{timestamp}_{filename}.pdf
```

**RLS Policy:**
```sql
-- Dealers can read attachments for their orders
CREATE POLICY "Dealers can read own order attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'order-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT o.id::text FROM orders o
      JOIN dealers d ON o.dealer_id = d.id
      WHERE d.user_id = auth.uid()
    )
  );

-- Admins can manage all order attachments
CREATE POLICY "Admins can manage order attachments"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'order-attachments'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE auth.uid() = id AND role = 'admin'
    )
  );
```

**Upload pattern (Server Action):**
```typescript
// In admin action: uploadOrderAttachment(orderId, fileType, file)
const filePath = `${orderId}/${fileType}_${Date.now()}_${file.name}`
const { data, error } = await supabase.storage
  .from('order-attachments')
  .upload(filePath, file)

// Create order_attachments record with file_url = filePath
```

---

## Integration Points with Existing System

### 1. Dealer Dashboard (New Route)

**Route:** `src/app/(dealer)/dashboard/page.tsx`

**Integration:**
- Reuses existing `getDealerInfo()` from `src/lib/actions/catalog.ts`
- New action: `getDealerStats()` in `src/lib/actions/dashboard.ts`
- Queries:
  - Total spending: `SUM(total_amount) FROM orders WHERE dealer_id = $1 AND created_at > $2`
  - Recent orders: Reuse `getDealerOrders()` with limit
  - Top products: `SELECT product_id, SUM(quantity) FROM order_items JOIN orders ... GROUP BY product_id ORDER BY SUM DESC LIMIT 5`
  - Pending orders count: `SELECT COUNT(*) FROM orders WHERE dealer_id = $1 AND status_id IN (SELECT id FROM order_statuses WHERE code IN ('pending', 'confirmed'))`
  - Current balance: `SELECT SUM(CASE ...) FROM dealer_transactions WHERE dealer_id = $1`

**Components:**
- `src/components/dashboard/stats-card.tsx` (reusable metric widget)
- `src/components/dashboard/recent-orders-widget.tsx`
- `src/components/dashboard/top-products-widget.tsx`
- Reuses existing `CartIndicator` and nav from `(dealer)/layout.tsx`

---

### 2. Financial Information (New Route)

**Route:** `src/app/(dealer)/financials/page.tsx`

**Actions:** `src/lib/actions/financials.ts`
- `getDealerTransactions(filters?: { startDate, endDate, type })` → Returns transactions with balance calculation
- `getDealerBalance()` → Current balance aggregate
- `downloadFinancialDocument(transactionId)` → Creates signed URL for PDF

**Components:**
- `src/components/financials/transaction-list.tsx`
- `src/components/financials/balance-summary.tsx`
- `src/components/financials/transaction-filters.tsx`

**Admin Side:** `src/app/(admin)/dealers/[id]/financials/page.tsx`
- Admin can create transactions via `createDealerTransaction(dealerId, data, file?)`
- Upload PDF to Storage, create dealer_transactions record with document_url

---

### 3. Favorites (New Routes)

**Routes:**
- `src/app/(dealer)/favorites/page.tsx` (list view)
- `src/app/(dealer)/catalog/page.tsx` (add favorite button)

**Actions:** `src/lib/actions/favorites.ts`
- `toggleFavorite(productId)` → Upsert/delete favorite_products record
- `getFavoriteProducts()` → Join favorite_products with products, returns CatalogProduct[] format

**Integration with Catalog:**
- Modify `src/components/catalog/product-card.tsx` to show favorite button
- Client component: `<FavoriteButton productId={id} initialFavorited={isFavorited} />`
- Calls `toggleFavorite` server action on click

**State Management:**
- No Zustand needed (favorites are server-managed)
- Optimistic UI: Toggle button immediately, revalidate on server response

---

### 4. Campaigns & Announcements (New Routes)

**Routes:**
- `src/app/(dealer)/campaigns/page.tsx` (active campaigns list)
- `src/app/(dealer)/campaigns/[id]/page.tsx` (campaign detail with products)
- `src/app/(dealer)/announcements/page.tsx` (announcements list)

**Actions:** `src/lib/actions/campaigns.ts`
- `getActiveCampaigns()` → Returns campaigns visible to dealer (RLS handles filtering)
- `getCampaignProducts(campaignId)` → Products in campaign with discount applied
- `getAnnouncements()` → Active announcements targeted to dealer

**Components:**
- `src/components/campaigns/campaign-card.tsx`
- `src/components/campaigns/campaign-products-grid.tsx` (reuses ProductCard)
- `src/components/announcements/announcement-list.tsx`
- `src/components/announcements/announcement-badge.tsx` (priority color coding)

**Realtime Integration:**
- Optional: Subscribe to announcements table for urgent messages
```typescript
// In (dealer)/layout.tsx or announcements page
const channel = supabase
  .channel('dealer-announcements')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'announcements',
    filter: `priority=eq.urgent` // RLS will filter to dealer's view
  }, (payload) => {
    toast.info(payload.new.title) // Show notification
  })
  .subscribe()
```

**Admin Side:** `src/app/(admin)/campaigns/` and `src/app/(admin)/announcements/`
- CRUD operations for campaigns, campaign_products, announcements
- Target selection UI (dealer groups checkboxes)

---

### 5. Support / Messages (New Routes)

**Routes:**
- `src/app/(dealer)/support/page.tsx` (list messages + create new)
- `src/app/(dealer)/support/[id]/page.tsx` (message detail)
- `src/app/(dealer)/support/faq/page.tsx` (static FAQ page)

**Actions:** `src/lib/actions/support.ts`
- `getSupportMessages()` → Dealer's messages ordered by created_at DESC
- `createSupportMessage(data)` → Create new message, optionally reference product/order
- `getSupportMessage(id)` → Single message with product/order details

**Components:**
- `src/components/support/message-list.tsx`
- `src/components/support/message-form.tsx` (subject, category, message, optional product/order select)
- `src/components/support/message-detail.tsx` (shows admin response if exists)

**Admin Side:** `src/app/(admin)/support/page.tsx`
- List all messages with filters (status, priority, dealer)
- Realtime subscription for new messages:
```typescript
supabase
  .channel('support-messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'support_messages'
  }, (payload) => {
    playNotificationSound()
    refetchMessages()
  })
  .subscribe()
```
- Respond action: `respondToSupportMessage(messageId, response)` updates admin_response, responded_by, responded_at, status

---

### 6. Order Details Enhancement (Existing Route)

**Route:** `src/app/(dealer)/orders/[id]/page.tsx` (extend existing)

**New Features:**
- Display order_attachments (invoices, waybills)
- Download buttons with signed URLs

**Actions:** Extend `src/lib/actions/orders.ts`
- `getOrderAttachments(orderId)` → Returns attachments for order
- `downloadOrderAttachment(attachmentId)` → Creates signed URL

**Components:**
- `src/components/orders/attachment-list.tsx` (shows file type icons, download buttons)
- Add to existing order detail page below order items

**Admin Side:** `src/app/(admin)/orders/[id]/page.tsx`
- Upload attachment form: `uploadOrderAttachment(orderId, fileType, file)`
- Server action uploads to Storage, creates order_attachments record

---

### 7. Dealer Reports (New Route)

**Route:** `src/app/(dealer)/reports/page.tsx`

**Actions:** `src/lib/actions/reports.ts`
- `getDealerSpendingAnalysis(period)` → Time-series spending data
- `getProductPurchaseHistory(productId?)` → Purchase frequency analysis
- `getPeriodComparison(period1, period2)` → Compare spending across periods

**Analytics Queries (PostgreSQL patterns):**

```sql
-- Monthly spending trend (last 12 months)
SELECT
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as order_count,
  SUM(total_amount) as total_spent
FROM orders
WHERE dealer_id = $1
  AND created_at >= NOW() - INTERVAL '12 months'
GROUP BY month
ORDER BY month DESC;

-- Top 10 products by purchase frequency
SELECT
  p.id, p.name, p.code,
  COUNT(DISTINCT oi.order_id) as times_ordered,
  SUM(oi.quantity) as total_quantity,
  SUM(oi.total_price) as total_spent
FROM order_items oi
JOIN products p ON oi.product_id = p.id
JOIN orders o ON oi.order_id = o.id
WHERE o.dealer_id = $1
GROUP BY p.id, p.name, p.code
ORDER BY times_ordered DESC
LIMIT 10;

-- Period comparison (this month vs last month)
WITH this_month AS (
  SELECT SUM(total_amount) as amount, COUNT(*) as count
  FROM orders
  WHERE dealer_id = $1
    AND created_at >= DATE_TRUNC('month', CURRENT_DATE)
),
last_month AS (
  SELECT SUM(total_amount) as amount, COUNT(*) as count
  FROM orders
  WHERE dealer_id = $1
    AND created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
    AND created_at < DATE_TRUNC('month', CURRENT_DATE)
)
SELECT
  this_month.amount as this_month_amount,
  last_month.amount as last_month_amount,
  this_month.count as this_month_count,
  last_month.count as last_month_count,
  ((this_month.amount - last_month.amount) / NULLIF(last_month.amount, 0) * 100) as amount_change_percent,
  ((this_month.count - last_month.count) / NULLIF(last_month.count, 0) * 100) as count_change_percent
FROM this_month, last_month;
```

**Components:**
- `src/components/reports/spending-chart.tsx` (uses Recharts, already installed from v1)
- `src/components/reports/period-comparison.tsx`
- `src/components/reports/top-products-table.tsx`

**Chart Library:** Recharts (already in dependencies from Phase 03)

---

## API Route Structure

### Server Actions Organization

Following existing pattern in `src/lib/actions/`, create new action files:

```
src/lib/actions/
  auth.ts (existing)
  catalog.ts (existing)
  orders.ts (existing) — EXTEND with getOrderAttachments, downloadOrderAttachment
  admin-orders.ts (existing)
  export-reports.ts (existing)

  dashboard.ts (NEW) — getDealerStats, getDealerBalance
  financials.ts (NEW) — getDealerTransactions, downloadFinancialDocument
                        ADMIN: createDealerTransaction, uploadFinancialDocument
  favorites.ts (NEW) — toggleFavorite, getFavoriteProducts, isFavorited
  campaigns.ts (NEW) — getActiveCampaigns, getCampaignProducts, getAnnouncements
                       ADMIN: CRUD for campaigns/announcements
  support.ts (NEW) — getSupportMessages, createSupportMessage, getSupportMessage
                     ADMIN: respondToSupportMessage, updateMessageStatus
  reports.ts (NEW) — getDealerSpendingAnalysis, getProductPurchaseHistory, getPeriodComparison
```

### Server Action Pattern (from existing codebase)

**Standard structure:**
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type ActionState = {
  success?: boolean
  message?: string
  errors?: Record<string, string[]>
  // ... feature-specific fields
}

export async function actionName(params): Promise<ActionState> {
  const supabase = await createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { message: 'Oturum acmaniz gerekiyor' }

  // 2. Authorization check (get dealer, verify ownership)
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (!dealer) return { message: 'Bayi kaydı bulunamadı' }

  // 3. Validation (Zod schema recommended for v2.0)
  // TODO: Add Zod validation

  // 4. Business logic
  const { data, error } = await supabase
    .from('table')
    .insert(...)

  if (error) return { message: 'Hata: ' + error.message }

  // 5. Revalidate
  revalidatePath('/relevant-path')

  return { success: true, message: 'Başarılı' }
}
```

**Validation Enhancement (recommended for v2.0):**
```typescript
import { z } from 'zod'

const createTransactionSchema = z.object({
  dealer_id: z.string().uuid(),
  transaction_type: z.enum(['invoice', 'payment', 'credit_note', 'debit_note']),
  amount: z.number().positive(),
  balance_effect: z.enum(['debit', 'credit']),
  description: z.string().min(1),
  reference_number: z.string().optional(),
  transaction_date: z.date().default(() => new Date())
})

export async function createDealerTransaction(
  formData: z.infer<typeof createTransactionSchema>
): Promise<ActionState> {
  // Validate
  const parsed = createTransactionSchema.safeParse(formData)
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  // ... proceed with validated data
}
```

---

## Component Organization

### New Route Groups

```
src/app/(dealer)/
  layout.tsx (existing) — ADD nav links for new routes
  catalog/ (existing)
  orders/ (existing)
  cart/ (existing)
  checkout/ (existing)
  quick-order/ (existing)

  dashboard/ (NEW) — Stats overview
    page.tsx

  financials/ (NEW) — Financial tracking
    page.tsx
    loading.tsx

  favorites/ (NEW) — Favorite products
    page.tsx

  campaigns/ (NEW) — Active campaigns
    page.tsx
    [id]/
      page.tsx

  announcements/ (NEW) — System announcements
    page.tsx

  support/ (NEW) — Support tickets
    page.tsx
    [id]/
      page.tsx
    faq/
      page.tsx

  reports/ (NEW) — Dealer analytics
    page.tsx
```

### New Shared Components

```
src/components/
  ui/ (existing — shadcn components)
  cart/ (existing)
  catalog/ (existing)
  orders/ (existing)
  layout/ (existing)

  dashboard/ (NEW)
    stats-card.tsx
    recent-orders-widget.tsx
    top-products-widget.tsx
    balance-summary.tsx

  financials/ (NEW)
    transaction-list.tsx
    transaction-filters.tsx
    balance-summary.tsx
    document-download-button.tsx

  favorites/ (NEW)
    favorite-button.tsx (used in catalog)
    favorites-grid.tsx

  campaigns/ (NEW)
    campaign-card.tsx
    campaign-products-grid.tsx
    discount-badge.tsx

  announcements/ (NEW)
    announcement-list.tsx
    announcement-badge.tsx (priority color)

  support/ (NEW)
    message-list.tsx
    message-form.tsx
    message-detail.tsx
    status-badge.tsx

  reports/ (NEW)
    spending-chart.tsx (Recharts)
    period-comparison.tsx
    top-products-table.tsx
```

---

## Suggested Build Order (Based on Dependencies)

### Phase 1: Foundation (No dependencies)

**Tasks:**
1. Database migrations for all 7 tables
2. Storage bucket creation + RLS policies
3. Create new Server Actions structure (empty files)
4. Update nav-links component with new routes

**Estimated complexity:** Low
**Why first:** Establishes data layer before building features

---

### Phase 2: Favorites (Simple, standalone)

**Dependencies:** None (uses existing products table)

**Tasks:**
1. Implement favorites.ts actions (toggleFavorite, getFavoriteProducts)
2. Create FavoriteButton component
3. Integrate FavoriteButton into ProductCard
4. Create favorites/page.tsx (reuses ProductGrid)

**Estimated complexity:** Low
**Why early:** Simple feature, validates action pattern, no file uploads

---

### Phase 3: Dashboard (Aggregates existing data)

**Dependencies:** Uses existing orders, order_items, products tables

**Tasks:**
1. Implement dashboard.ts actions (getDealerStats)
2. Create dashboard components (StatsCard, widgets)
3. Create dashboard/page.tsx
4. Update (dealer)/layout to redirect / to /dashboard

**Estimated complexity:** Medium
**Why mid:** Requires analytics queries, but no new data entry

---

### Phase 4: Campaigns & Announcements (Read-only dealer view)

**Dependencies:** campaigns, announcements tables (admin will populate manually first)

**Tasks:**
1. Implement campaigns.ts actions (read-only dealer side)
2. Create campaign/announcement components
3. Create campaigns/page.tsx, announcements/page.tsx
4. Optional: Add Realtime subscription for announcements

**Estimated complexity:** Medium
**Why mid:** Read-only for dealers, defer admin CRUD to later

---

### Phase 5: Support Messages (Async messaging)

**Dependencies:** support_messages table

**Tasks:**
1. Implement support.ts actions (dealer: create/read, admin: read/respond)
2. Create support components (form, list, detail)
3. Create support/page.tsx, support/[id]/page.tsx
4. Create static support/faq/page.tsx
5. Admin side: support management page with Realtime

**Estimated complexity:** Medium
**Why mid:** Standalone feature, tests Realtime on admin side

---

### Phase 6: Financial Information (Complex, requires file uploads)

**Dependencies:** dealer_transactions table, financial-documents bucket

**Tasks:**
1. Implement financials.ts actions (read for dealer, create+upload for admin)
2. Server Action for file upload to Storage
3. Create financials components
4. Create financials/page.tsx (dealer view)
5. Admin side: dealer/[id]/financials page with transaction creation + PDF upload
6. Zod validation for transaction form

**Estimated complexity:** High
**Why later:** File uploads add complexity, requires admin UI for data entry

---

### Phase 7: Order Attachments (Extends existing orders)

**Dependencies:** order_attachments table, order-attachments bucket

**Tasks:**
1. Extend orders.ts actions (getOrderAttachments, downloadOrderAttachment)
2. Create attachment-list component
3. Integrate into existing orders/[id]/page.tsx
4. Admin side: order attachment upload on orders/[id]/page.tsx

**Estimated complexity:** Medium
**Why later:** Extends existing feature, validates Storage pattern from Phase 6

---

### Phase 8: Dealer Reports (Complex queries)

**Dependencies:** Aggregates orders, order_items (existing data)

**Tasks:**
1. Implement reports.ts actions (complex aggregation queries)
2. Create reports components (charts, tables)
3. Create reports/page.tsx
4. Optimize queries with indexes if needed

**Estimated complexity:** High
**Why last:** Complex analytics queries, benefits from having real data to test with

---

### Phase 9: Admin CRUD for Campaigns/Announcements (Deferred)

**Tasks:**
1. Admin campaign management pages
2. Admin announcement management pages
3. Target selection UI (dealer groups)

**Estimated complexity:** Medium
**Why deferred:** Admin can manually insert via SQL initially, UI is polish

---

## Build Order Summary Table

| Phase | Features | Complexity | Dependencies | Reason |
|-------|----------|------------|--------------|--------|
| 1 | Database + Storage setup | Low | None | Foundation layer |
| 2 | Favorites | Low | Existing products | Simple, validates patterns |
| 3 | Dashboard | Medium | Existing orders | Analytics without new data |
| 4 | Campaigns/Announcements (read) | Medium | New tables | Read-only, tests RLS |
| 5 | Support Messages | Medium | New table | Tests Realtime |
| 6 | Financial Information | High | New table + Storage | File uploads |
| 7 | Order Attachments | Medium | Phase 6 patterns | Extends existing feature |
| 8 | Dealer Reports | High | Existing data | Complex queries |
| 9 | Admin Campaign/Announcement CRUD | Medium | Phase 4 | Polish, can defer |

---

## RLS Security Considerations

### Consistent Pattern Across All Tables

**Standard dealer visibility check:**
```sql
dealer_id IN (
  SELECT id FROM dealers WHERE user_id = auth.uid()
)
```

**Why this pattern:**
- Single JOIN to verify ownership
- Works with RLS recursion (policies can reference other policies)
- Indexed on `dealers.user_id` (existing index from v1)
- Consistent across orders, favorites, transactions, etc.

---

### Storage RLS Pattern

**Folder-based security:**
```sql
(storage.foldername(name))[1] IN (
  SELECT id::text FROM dealers WHERE user_id = auth.uid()
)
```

**Why this pattern:**
- Extracts first folder level (dealer_id or order_id)
- For orders: Additional check that order belongs to dealer
- Prevents path traversal (../other-dealer-files)

---

### Multi-Tenant Best Practices

**Index Performance:**
- CRITICAL: Index `dealer_id` on all new tables (already in schemas above)
- Index `user_id` on dealers table (existing from v1)
- RLS policies join dealers table on every query — index is essential

**Policy Simplicity:**
- Keep policies simple: One dealer ownership check, one admin check
- Avoid complex subqueries in policies (use functions if needed)
- Test policies with EXPLAIN ANALYZE to verify index usage

---

## Sources

### Supabase Multi-Tenant Security
- [Storage Access Control | Supabase Docs](https://supabase.com/docs/guides/storage/security/access-control)
- [Enforcing Row Level Security in Supabase: A Deep Dive into LockIn's Multi-Tenant Architecture - DEV Community](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2)
- [Best Practices for Supabase | Security, Scaling & Maintainability](https://www.leanware.co/insights/supabase-best-practices)
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)

### Supabase Storage & File Uploads
- [Signed URL file uploads with NextJs and Supabase | by Ollie | Medium](https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0)
- [Complete Guide to File Uploads with Next.js and Supabase Storage](https://supalaunch.com/blog/file-upload-nextjs-supabase)
- [Uploading files to Supabase storage with Next.js](https://kirandev.com/upload-files-to-supabase-storage-nextjs)

### Next.js Server Actions
- [Next.js Server Actions: The Complete Guide (2026)](https://makerkit.dev/blog/tutorials/nextjs-server-actions)
- [Next.js Server Actions Error Handling: A Production-Ready Guide | by Pawan tripathi | Dec, 2025 | Medium](https://medium.com/@pawantripathi648/next-js-server-actions-error-handling-the-pattern-i-wish-i-knew-earlier-e717f28f2f75)
- [Type safe Server Actions in your Next.js project | next-safe-action](https://next-safe-action.dev/)
- [Data Fetching: Server Actions and Mutations | Next.js](https://nextjs.org/docs/14/app/building-your-application/data-fetching/server-actions-and-mutations)

### PostgreSQL Analytics
- [How to Optimize PostgreSQL for Analytics Workloads](https://oneuptime.com/blog/post/2026-01-25-optimize-postgresql-analytics-workloads/view)
- [PostgreSQL as a Real-Time Analytics Database | Tiger Data](https://www.tigerdata.com/learn/real-time-analytics-in-postgres)
- [How to Query Time-Series Data in TimescaleDB](https://oneuptime.com/blog/post/2026-02-02-timescaledb-time-series-queries/view)

### Supabase Realtime
- [Best Practices for Supabase | Security, Scaling & Maintainability](https://www.leanware.co/insights/supabase-best-practices)
- [Multi-tenant · supabase · Discussion #1615](https://github.com/orgs/supabase/discussions/1615)

---

**End of Architecture Research**

**Research confidence: HIGH** — All patterns verified with official Supabase docs, existing v1 codebase patterns, and 2026 best practices.
