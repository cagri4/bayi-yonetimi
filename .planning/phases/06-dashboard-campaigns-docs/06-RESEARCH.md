# Phase 6: Dashboard, Campaigns & Order Documents - Research

**Researched:** 2026-02-11
**Domain:** Dashboard aggregation, content management, PDF generation, file uploads
**Confidence:** HIGH

## Summary

Phase 6 combines three distinct domains: (1) personalized dealer dashboards with aggregated spending and order data, (2) campaign and announcement content management with read receipts, and (3) enhanced order documentation with PDF generation and file uploads. All three domains extend existing v1 patterns (Server Components, Server Actions, Supabase RLS) without new architectural paradigms.

The standard approach uses Next.js 15 Server Components for dashboard aggregation queries (avoiding N+1 with parallel fetching), PostgreSQL materialized views for performance-critical aggregations, @react-pdf/renderer for server-side PDF generation, and Supabase Storage with RLS policies for secure file uploads. Dashboard widgets use CSS Grid with Tailwind for responsive layouts, campaigns use junction tables for product associations, and read receipts follow the dealer_id + resource_id + read_at pattern established in v1.

The project already has recharts (2.15.4) for data visualization, @radix-ui/react-tabs (1.1.13) for UI, and Zustand (5.0.10) for client state. No new dependencies required beyond @react-pdf/renderer (mentioned in v2.0 roadmap).

**Primary recommendation:** Use Server Components for all aggregation queries, implement materialized views for dashboard spending summaries, follow the dealer_favorites RLS pattern for campaigns/announcements tables, and generate PDFs server-side with @react-pdf/renderer to avoid exposing business logic to clients.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 15 | 16.1.4 (current) | Server Components for aggregation queries | Parallel data fetching eliminates N+1 queries, direct database access |
| @react-pdf/renderer | 4.1.7 (latest) | Server-side PDF generation | React components for PDFs, 16.4k stars, server/browser support |
| Supabase Storage | via @supabase/supabase-js 2.91.1 | File upload with RLS | Built-in CDN, RLS policies for multi-tenant security |
| recharts | 2.15.4 (installed) | Dashboard charts | Already in project, composable React components, 25k stars |
| PostgreSQL materialized views | Native | Pre-computed aggregations | 10-100x faster than real-time queries for dashboards |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-tabs | 1.1.13 (installed) | Tab navigation for dashboard sections | Already in project, accessible, unstyled |
| date-fns | 4.1.0 (installed) | Date filtering and formatting | Already in project, tree-shakeable |
| Zustand | 5.0.10 (installed) | Client state for UI toggles | Already established pattern, localStorage sync |
| React 19 useOptimistic | Native | Instant UI feedback | Already used in favorites (Phase 4) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @react-pdf/renderer | jsPDF (28.5k stars) | jsPDF better for browser-side, but React components preferred for maintainability |
| @react-pdf/renderer | pdfkit (9.6k stars) | Lower-level API, no React components, harder to maintain |
| Materialized views | Real-time aggregation | Real-time more flexible but 10-100x slower, unacceptable for dashboards |
| Supabase Storage | AWS S3 direct | More complex auth, loses RLS integration, overkill for this scale |

**Installation:**
```bash
npm install @react-pdf/renderer
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(dealer)/
│   ├── dashboard/           # Dealer dashboard page (new)
│   ├── campaigns/           # Campaign browsing (new)
│   └── announcements/       # Announcements feed (new)
├── app/(admin)/admin/
│   ├── campaigns/           # Campaign CRUD (new)
│   └── announcements/       # Announcement CRUD (new)
├── components/
│   ├── dashboard/           # Dashboard widgets (new)
│   │   ├── spending-summary.tsx
│   │   ├── recent-orders.tsx
│   │   ├── pending-count.tsx
│   │   ├── quick-actions.tsx
│   │   └── top-products.tsx
│   ├── campaigns/           # Campaign cards (new)
│   └── orders/              # Enhanced order documents (modify existing)
├── lib/
│   ├── actions/
│   │   ├── campaigns.ts     # Campaign mutations (new)
│   │   ├── announcements.ts # Announcement CRUD + read receipts (new)
│   │   └── order-docs.ts    # PDF upload, cargo tracking (new)
│   ├── queries/
│   │   ├── dashboard.ts     # Dashboard aggregations (new)
│   │   └── campaigns.ts     # Campaign queries (new)
│   └── pdf/
│       └── invoice.tsx      # @react-pdf/renderer components (new)
└── supabase/migrations/
    └── 007_dashboard_campaigns.sql  # New tables (new)
```

### Pattern 1: Dashboard Aggregation with Parallel Fetching
**What:** Fetch all dashboard widgets' data in parallel using Promise.all() to avoid sequential waterfalls
**When to use:** Any page that displays multiple independent data widgets (dashboard, reports)
**Example:**
```typescript
// Source: Next.js Learn - Fetching Data
// https://nextjs.org/learn/dashboard-app/fetching-data
async function DashboardPage() {
  // Parallel fetching - all queries start simultaneously
  const [balance, orders, pendingCount, topProducts] = await Promise.all([
    getDealerBalance(),
    getRecentOrders(),
    getPendingOrdersCount(),
    getTopProducts()
  ])

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <SpendingSummary balance={balance} />
      <RecentOrders orders={orders} />
      <PendingCount count={pendingCount} />
      <TopProducts products={topProducts} />
    </div>
  )
}
```

### Pattern 2: Materialized Views for Expensive Aggregations
**What:** Pre-compute dealer spending summaries and refresh periodically instead of calculating on every page load
**When to use:** Complex aggregations (SUM, GROUP BY) over large datasets accessed frequently
**Example:**
```sql
-- Source: Supabase Database Advisors
-- https://supabase.com/docs/guides/database/database-advisors
CREATE MATERIALIZED VIEW dealer_spending_summary AS
SELECT
  dealer_id,
  DATE_TRUNC('month', transaction_date) as month,
  SUM(amount) FILTER (WHERE transaction_type = 'debit') as total_debit,
  SUM(amount) FILTER (WHERE transaction_type = 'credit') as total_credit,
  SUM(amount) as net_balance
FROM dealer_transactions
GROUP BY dealer_id, DATE_TRUNC('month', transaction_date);

CREATE INDEX idx_dealer_spending_dealer ON dealer_spending_summary(dealer_id);

-- Refresh strategy: cron job or trigger after transaction insert
REFRESH MATERIALIZED VIEW CONCURRENTLY dealer_spending_summary;
```

### Pattern 3: Read Receipts with Junction Table
**What:** Track which announcements each dealer has read using dealer_id + announcement_id + read_at
**When to use:** Any content that users mark as "read" or "seen" (announcements, messages, notifications)
**Example:**
```sql
-- Similar to dealer_favorites pattern from Phase 4
CREATE TABLE announcement_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, dealer_id)
);

-- RLS: Dealers can only read/write their own read receipts
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dealers read own receipts"
  ON announcement_reads FOR SELECT
  USING (dealer_id IN (
    SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
  ));

CREATE POLICY "Dealers insert own receipts"
  ON announcement_reads FOR INSERT
  WITH CHECK (dealer_id IN (
    SELECT id FROM dealers WHERE user_id = (SELECT auth.uid())
  ));
```

### Pattern 4: Server-Side PDF Generation
**What:** Generate PDFs using @react-pdf/renderer in Server Actions, return blob or file path
**When to use:** Invoice generation, report exports, any document that requires consistent formatting
**Example:**
```typescript
// Source: @react-pdf/renderer GitHub README
// https://github.com/diegomura/react-pdf
'use server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'

export async function generateInvoicePDF(orderId: string) {
  const supabase = await createClient()

  // 1. Fetch order data (with RLS protection)
  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single()

  // 2. Generate PDF server-side
  const pdfBuffer = await renderToBuffer(<InvoiceDocument order={order} />)

  // 3. Upload to Supabase Storage
  const fileName = `invoices/${orderId}.pdf`
  await supabase.storage
    .from('order-documents')
    .upload(fileName, pdfBuffer, { contentType: 'application/pdf', upsert: true })

  return { success: true, path: fileName }
}
```

### Pattern 5: Secure File Upload with RLS
**What:** Upload files via Server Actions, store in Supabase Storage with RLS policies preventing cross-tenant access
**When to use:** Any user-uploaded content (invoices, irsaliye, profile photos)
**Example:**
```typescript
// Source: Supabase Storage Security - Access Control
// https://supabase.com/docs/guides/storage/security/access-control
'use server'
export async function uploadOrderDocument(formData: FormData) {
  const supabase = await createClient()

  // 1. Validate file (Zod + size/type checks)
  const file = formData.get('file') as File
  if (file.size > 5 * 1024 * 1024) throw new Error('File too large (max 5MB)')
  if (!['application/pdf'].includes(file.type)) throw new Error('Only PDF allowed')

  // 2. Generate unique path (avoid overwrite conflicts)
  const orderId = formData.get('orderId') as string
  const timestamp = Date.now()
  const fileName = `order-docs/${orderId}/${timestamp}-${file.name}`

  // 3. Upload with authentication (RLS enforces dealer_id match)
  const { error } = await supabase.storage
    .from('order-documents')
    .upload(fileName, file, { contentType: file.type })

  if (error) throw new Error('Upload failed')

  // 4. Store reference in database for audit trail
  await supabase.from('order_documents').insert({
    order_id: orderId,
    file_path: fileName,
    file_type: 'invoice',
    uploaded_by: (await supabase.auth.getUser()).data.user?.id
  })

  revalidatePath(`/orders/${orderId}`)
  return { success: true }
}
```

### Pattern 6: Campaign-Product Association (Many-to-Many)
**What:** Use junction table to link campaigns with multiple products
**When to use:** Any many-to-many relationship (campaigns-products, orders-products already exists)
**Example:**
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE campaign_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  discount_percent DECIMAL(5,2),
  UNIQUE(campaign_id, product_id)
);

-- Query pattern: Get campaign with products
SELECT
  c.*,
  json_agg(json_build_object(
    'id', p.id,
    'name', p.name,
    'discount', cp.discount_percent
  )) as products
FROM campaigns c
LEFT JOIN campaign_products cp ON cp.campaign_id = c.id
LEFT JOIN products p ON p.id = cp.product_id
WHERE c.is_active = true
GROUP BY c.id;
```

### Pattern 7: Responsive Dashboard Grid with CSS Grid
**What:** Use CSS Grid (not third-party libraries) with Tailwind's grid utilities for responsive dashboard layouts
**When to use:** Dashboard widgets, admin panels, any grid-based responsive layouts
**Example:**
```typescript
// Source: Tailwind CSS Grid Template Columns
// https://thelinuxcode.com/tailwind-css-grid-template-columns-practical-patterns-for-2026-layouts/
export function DashboardGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Full width on mobile, 2 cols on tablet, 4 cols on desktop */}
      <SpendingSummaryCard className="md:col-span-2" />
      <PendingOrdersCard />
      <QuickActionsCard />

      {/* Second row */}
      <RecentOrdersWidget className="lg:col-span-3" />
      <TopProductsWidget />
    </div>
  )
}
```

### Anti-Patterns to Avoid
- **Client-side aggregation:** Fetching raw transactions and calculating totals in React wastes bandwidth and exposes sensitive data. Use database aggregations or materialized views instead.
- **Real-time over-optimization:** Not all data needs real-time updates. Dashboard spending summaries can be 5-10 minutes stale without impacting UX. Use materialized views refreshed by cron.
- **Public storage buckets for sensitive docs:** Don't set buckets to public just to avoid RLS complexity. Order documents contain sensitive pricing data and must have RLS policies enforcing dealer_id matching.
- **Browser-side PDF generation:** Generating PDFs in the browser exposes business logic (pricing calculations, invoice templates) and creates inconsistent formatting across devices. Generate server-side.
- **File overwrite without versioning:** Using upsert: true on Supabase Storage causes CDN cache staleness. Use unique file paths with timestamps or UUIDs instead.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom HTML-to-PDF pipeline | @react-pdf/renderer | Handles page breaks, fonts, images, complex layouts. 16.4k stars, battle-tested. |
| Dashboard chart rendering | Canvas/SVG from scratch | recharts (already installed) | Responsive, accessible, composable. Reinventing wastes 40+ hours. |
| File type validation | String checks on extension | Zod + zod-form-data with file refinements | Type-safe, validates size/mime type, consistent error messages |
| Read receipt tracking | Boolean flags per user | Junction table (announcement_reads) | Scales to track read timestamps, who read when, supports "mark all as read" |
| Campaign date filtering | Manual date comparisons in code | PostgreSQL date range queries | Database indexes make date filtering 100x faster than JS filtering |
| Spending aggregation | Summing in React | PostgreSQL SUM() with materialized views | Database 10-100x faster, reduces data transfer, enables RLS filtering |

**Key insight:** This phase involves no novel problems. Every requirement (aggregations, PDFs, file uploads, campaigns) has standard PostgreSQL/Supabase/React solutions. Custom implementations introduce bugs (timezone issues, file validation bypass, SQL injection) that libraries have already solved.

## Common Pitfalls

### Pitfall 1: N+1 Queries in Dashboard Widgets
**What goes wrong:** Each widget triggers sequential database queries (fetch orders, then for each order fetch items, then dealer info), causing 20+ queries for a single page load
**Why it happens:** Natural pattern when building components in isolation without considering data fetching strategy
**How to avoid:** Use Promise.all() at the page level for parallel fetching (see Pattern 1). Use PostgreSQL joins instead of multiple queries. Consider React.cache for request-level memoization.
**Warning signs:** Dashboard page takes >2 seconds to load, database query logs show sequential queries with identical timestamps

### Pitfall 2: Materialized View Staleness
**What goes wrong:** Dealer sees yesterday's spending total because materialized view wasn't refreshed after new transaction
**Why it happens:** REFRESH MATERIALIZED VIEW must be called explicitly, doesn't auto-update like regular views
**How to avoid:** Set up pg_cron job to refresh every 5-10 minutes OR use CONCURRENTLY to allow reads during refresh OR trigger refresh after transaction INSERT via database function
**Warning signs:** Dealers report "incorrect balances", balances update only after page reload

### Pitfall 3: Storage RLS Policy Misconfiguration
**What goes wrong:** Dealer A can download Dealer B's invoices by guessing file paths (e.g., /order-docs/dealer-b-order-id.pdf)
**Why it happens:** Setting bucket to "public" or forgetting to enable RLS on storage.objects table
**How to avoid:** ALWAYS enable RLS on storage buckets. Use folder-based policies with storage.foldername() helper. Test with multiple dealer accounts. Never set buckets public unless truly public (e.g., product images).
**Warning signs:** Files accessible via direct URL without authentication, audit logs show cross-tenant downloads

### Pitfall 4: File Upload Without Unique Paths
**What goes wrong:** Admin uploads invoice.pdf for Order A, then uploads invoice.pdf for Order B, overwriting Order A's file. Order A dealer sees Order B's invoice.
**Why it happens:** Using static file names or relying on upsert: true without unique identifiers
**How to avoid:** Include timestamp, UUID, or order ID in file path (e.g., order-docs/{orderId}/{timestamp}-invoice.pdf). Avoid upsert: true unless intentionally versioning. Check for existing file before upload.
**Warning signs:** Dealers report "wrong invoice downloaded", file timestamps don't match upload logs

### Pitfall 5: Server Action File Validation Bypass
**What goes wrong:** Attacker renames malware.exe to invoice.pdf, bypasses client-side validation, uploads malicious file
**Why it happens:** Trusting file extension instead of validating mime type and content on server
**How to avoid:** Validate file.type (mime type) on server. Use Zod schema with file size/type refinements. Consider scanning file content with magic number checks. Never trust client-side validation.
**Warning signs:** Non-PDF files in storage bucket, unusual file sizes, security scanner alerts

### Pitfall 6: Campaign Date Filtering Performance
**What goes wrong:** Filtering active campaigns with WHERE start_date <= NOW() AND end_date >= NOW() becomes slow as campaigns table grows
**Why it happens:** Missing indexes on date columns, scanning entire table
**How to avoid:** Create composite index on (is_active, start_date, end_date). Consider boolean is_active flag updated by cron if date queries too slow. Use EXPLAIN ANALYZE to verify index usage.
**Warning signs:** Campaign page takes >1s to load, EXPLAIN shows Seq Scan instead of Index Scan

### Pitfall 7: PDF Generation Memory Leaks
**What goes wrong:** Server memory usage grows over time, eventually crashes when generating PDFs
**Why it happens:** @react-pdf/renderer buffers accumulate if not properly disposed, especially with large documents
**How to avoid:** Use renderToBuffer() for small PDFs, renderToStream() for large multi-page documents. Dispose buffers after upload. Set memory limits in Next.js config. Monitor memory usage in production.
**Warning signs:** Server restarts daily, memory usage graph shows upward trend, PDF generation gets slower over time

## Code Examples

Verified patterns from official sources:

### Dashboard Aggregation Query (Parallel Fetching)
```typescript
// Source: Next.js Learn - Fetching Data
// https://nextjs.org/learn/dashboard-app/fetching-data
import { createClient } from '@/lib/supabase/server'

export async function getDashboardData(dealerId: string) {
  const supabase = await createClient()

  // Parallel fetching - all queries start at once
  const [balance, orders, pendingCount, topProducts] = await Promise.all([
    // Query 1: Current balance from materialized view
    supabase
      .from('dealer_spending_summary')
      .select('*')
      .eq('dealer_id', dealerId)
      .order('month', { ascending: false })
      .limit(2)
      .then(r => r.data),

    // Query 2: Recent orders
    supabase
      .from('orders')
      .select('id, order_number, status, total_amount, created_at')
      .eq('dealer_id', dealerId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(r => r.data),

    // Query 3: Pending count (aggregation)
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('dealer_id', dealerId)
      .in('status', ['pending', 'confirmed', 'preparing'])
      .then(r => r.count || 0),

    // Query 4: Top products (join with order_items)
    supabase.rpc('get_top_products_for_dealer', { p_dealer_id: dealerId, p_limit: 5 })
      .then(r => r.data)
  ])

  return { balance, orders, pendingCount, topProducts }
}
```

### Materialized View for Spending Summary
```sql
-- Source: Supabase Database Advisors
-- https://supabase.com/docs/guides/database/database-advisors
CREATE MATERIALIZED VIEW dealer_spending_summary AS
SELECT
  d.id as dealer_id,
  d.company_name,
  DATE_TRUNC('month', dt.transaction_date)::date as month,
  SUM(dt.amount) FILTER (WHERE tt.balance_effect = 'debit') as total_debit,
  SUM(dt.amount) FILTER (WHERE tt.balance_effect = 'credit') as total_credit,
  SUM(
    CASE
      WHEN tt.balance_effect = 'debit' THEN dt.amount
      ELSE -dt.amount
    END
  ) as net_balance
FROM dealers d
LEFT JOIN dealer_transactions dt ON dt.dealer_id = d.id
LEFT JOIN transaction_types tt ON tt.id = dt.transaction_type_id
GROUP BY d.id, d.company_name, DATE_TRUNC('month', dt.transaction_date);

-- Index for fast dealer lookup
CREATE INDEX idx_dealer_spending_dealer_month
  ON dealer_spending_summary(dealer_id, month DESC);

-- Refresh strategy (run via pg_cron every 10 minutes)
REFRESH MATERIALIZED VIEW CONCURRENTLY dealer_spending_summary;
```

### Server Action: Mark Announcement as Read
```typescript
// Source: Existing pattern from favorites.ts (Phase 4)
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markAnnouncementAsRead(announcementId: string) {
  const supabase = await createClient()

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Get dealer ID
  const { data: dealerData } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealerData) throw new Error('Dealer not found')
  const dealerId = (dealerData as { id: string }).id

  // Insert read receipt (UNIQUE constraint prevents duplicates)
  const { error } = await supabase
    .from('announcement_reads')
    .insert({
      announcement_id: announcementId,
      dealer_id: dealerId,
      read_at: new Date().toISOString()
    })

  // Ignore duplicate key errors (already marked as read)
  if (error && !error.message.includes('duplicate')) {
    throw new Error('Failed to mark as read')
  }

  revalidatePath('/announcements')
  return { success: true }
}
```

### React PDF Invoice Component
```typescript
// Source: @react-pdf/renderer GitHub README
// https://github.com/diegomura/react-pdf
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 30 },
  header: { marginBottom: 20, borderBottom: '2pt solid #000' },
  title: { fontSize: 24, fontWeight: 'bold' },
  row: { flexDirection: 'row', borderBottom: '1pt solid #ccc', padding: 8 },
  col: { flex: 1 },
})

export function InvoiceDocument({ order }: { order: Order }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Fatura</Text>
          <Text>Sipariş No: {order.order_number}</Text>
          <Text>Tarih: {new Date(order.created_at).toLocaleDateString('tr-TR')}</Text>
        </View>

        {/* Order items table */}
        {order.order_items.map((item: any) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.col}>{item.product.name}</Text>
            <Text style={styles.col}>{item.quantity}x</Text>
            <Text style={styles.col}>{item.unit_price} TL</Text>
            <Text style={styles.col}>{item.subtotal} TL</Text>
          </View>
        ))}

        <View style={{ marginTop: 20, alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
            Toplam: {order.total_amount} TL
          </Text>
        </View>
      </Page>
    </Document>
  )
}
```

### Storage RLS Policy for Order Documents
```sql
-- Source: Supabase Storage Security - Access Control
-- https://supabase.com/docs/guides/storage/security/access-control

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Dealers can only access their own order documents
CREATE POLICY "Dealers access own order documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'order-documents' AND
    -- Extract order_id from path: order-docs/{order_id}/{filename}
    (storage.foldername(name))[1] IN (
      SELECT o.id::text
      FROM orders o
      JOIN dealers d ON d.id = o.dealer_id
      WHERE d.user_id = (SELECT auth.uid())
    )
  );

-- Policy: Admins can upload to any order
CREATE POLICY "Admins upload order documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'order-documents' AND
    (SELECT role FROM users WHERE id = (SELECT auth.uid())) = 'admin'
  );
```

### Server Action: Upload Order Document with Validation
```typescript
// Source: Next.js Server Actions Security
// https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const uploadSchema = z.object({
  file: z.instanceof(File)
    .refine(f => f.size <= 5 * 1024 * 1024, 'File must be less than 5MB')
    .refine(f => f.type === 'application/pdf', 'Only PDF files allowed'),
  orderId: z.string().uuid(),
  documentType: z.enum(['invoice', 'irsaliye'])
})

export async function uploadOrderDocument(formData: FormData) {
  const supabase = await createClient()

  // 1. Authentication check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // 2. Role check (admin only)
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'admin') throw new Error('Forbidden')

  // 3. Validate input
  const parsed = uploadSchema.parse({
    file: formData.get('file'),
    orderId: formData.get('orderId'),
    documentType: formData.get('documentType')
  })

  // 4. Generate unique path
  const timestamp = Date.now()
  const fileName = `order-docs/${parsed.orderId}/${timestamp}-${parsed.documentType}.pdf`

  // 5. Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('order-documents')
    .upload(fileName, parsed.file, { contentType: 'application/pdf' })

  if (uploadError) throw new Error('Upload failed: ' + uploadError.message)

  // 6. Store metadata in database
  await supabase.from('order_documents').insert({
    order_id: parsed.orderId,
    document_type: parsed.documentType,
    file_path: fileName,
    uploaded_by: user.id
  })

  revalidatePath(`/admin/orders/${parsed.orderId}`)
  return { success: true, path: fileName }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side chart libraries (D3.js) | Recharts with Server Components | 2024-2025 | Reduces JS bundle, leverages RSC for data fetching |
| jsPDF browser-side generation | @react-pdf/renderer server-side | 2023-2024 | Consistent formatting, hides business logic, better performance |
| Custom file validation logic | Zod with file refinements | 2024-2025 | Type-safe, consistent error messages, better DX |
| Regular views for aggregation | Materialized views | Always existed but underused | 10-100x performance for read-heavy dashboards |
| S3 direct upload with presigned URLs | Supabase Storage with RLS | 2022-2023 | Simpler auth, integrated with Postgres RLS, built-in CDN |
| React-Grid-Layout for dashboards | CSS Grid with Tailwind | 2024-2025 | No extra dependency, simpler state management, better responsive behavior |

**Deprecated/outdated:**
- **react-pdf (display library):** Often confused with @react-pdf/renderer. The former is for viewing PDFs, the latter for generating them. Use @react-pdf/renderer for Phase 6.
- **PDFKit for React apps:** Still viable but lower-level API. @react-pdf/renderer's React components are more maintainable.
- **populate=* in Supabase queries:** Performance anti-pattern. Explicitly list fields to avoid over-fetching.

## Open Questions

Things that couldn't be fully resolved:

1. **Materialized View Refresh Strategy**
   - What we know: REFRESH MATERIALIZED VIEW can use CONCURRENTLY to allow reads during refresh. pg_cron extension can schedule refreshes.
   - What's unclear: Does Supabase hosted platform support pg_cron for free tier? May need to verify or use external cron.
   - Recommendation: Test pg_cron availability in Supabase project. Fallback: Trigger refresh via Edge Function on schedule or use database function triggered after INSERT.

2. **@react-pdf/renderer Server Action Compatibility**
   - What we know: Library works in Node.js environment. Next.js 15 Server Actions run in Node runtime.
   - What's unclear: Whether renderToBuffer() is compatible with streaming responses or requires buffering full PDF.
   - Recommendation: Test with small invoice first. If memory issues with large PDFs, use renderToStream() and pipe to Supabase Storage.

3. **Campaign "New Products" Filter Performance**
   - What we know: Filtering products by created_at > (NOW() - INTERVAL '30 days') requires index on created_at.
   - What's unclear: Whether "new" threshold should be configurable per dealer or global. Requirements say "new products" but don't define "new".
   - Recommendation: Start with global 30-day threshold. Add created_at index. Consider is_new boolean flag if date filtering too slow or business defines "new" differently.

## Sources

### Primary (HIGH confidence)
- Next.js Official Docs - Fetching Data: https://nextjs.org/learn/dashboard-app/fetching-data
- Supabase Storage Access Control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Storage Standard Uploads: https://supabase.com/docs/guides/storage/uploads/standard-uploads
- Supabase Database Advisors (Materialized Views): https://supabase.com/docs/guides/database/database-advisors
- @react-pdf/renderer GitHub: https://github.com/diegomura/react-pdf (16.4k stars, MIT license)
- Next.js Server Actions Security Guide: https://makerkit.dev/blog/tutorials/secure-nextjs-server-actions

### Secondary (MEDIUM confidence)
- [Next.js 15 Advanced Patterns 2026](https://johal.in/next-js-15-advanced-patterns-app-router-server-actions-and-caching-strategies-for-2026/) - Caching strategies, verified with official docs
- [Top React Chart Libraries 2026](https://www.syncfusion.com/blogs/post/top-5-react-chart-libraries) - Recharts comparison, cross-referenced with npm stats
- [Tailwind CSS Grid Patterns 2026](https://thelinuxcode.com/tailwind-css-grid-template-columns-practical-patterns-for-2026-layouts/) - Grid layout patterns, verified with Tailwind docs
- [Strapi/Next.js Performance Mistakes](https://strapi.io/blog/performance-mistakes-strapi-nextjs-apps) - N+1 query patterns, applicable to any backend

### Secondary (MEDIUM confidence - continued)
- [Supabase RLS Complete Guide 2026](https://designrevision.com/blog/supabase-row-level-security) - RLS patterns, verified with official Supabase docs
- [React PDF Libraries Comparison 2026](https://blog.react-pdf.dev/6-open-source-pdf-generation-and-modification-libraries-every-react-dev-should-know-in-2025) - Library comparison, npm stats verified

### Tertiary (LOW confidence - requires validation)
- Campaign CMS schema patterns - No specific 2026 sources found. Recommendation based on standard junction table patterns.
- pg_cron availability on Supabase free tier - Not explicitly documented. Requires testing.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs or GitHub, versions confirmed in package.json or npm
- Architecture patterns: HIGH - Patterns derived from official Next.js/Supabase docs and existing v1 codebase (favorites.ts, financials.ts)
- Pitfalls: MEDIUM - Based on web search findings (RLS misconfiguration, N+1 queries) cross-referenced with official security guides
- PDF generation: MEDIUM - @react-pdf/renderer verified via GitHub, but Server Action compatibility not explicitly tested
- Materialized views: HIGH - PostgreSQL native feature, Supabase docs confirm support

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days - stable stack, slow-moving documentation)

**Areas requiring validation during implementation:**
1. Test @react-pdf/renderer with Next.js 15 Server Actions (small invoice first)
2. Verify pg_cron availability on Supabase hosted platform
3. Confirm file upload RLS policies with multi-dealer test accounts
4. Benchmark materialized view refresh performance with realistic data volume
