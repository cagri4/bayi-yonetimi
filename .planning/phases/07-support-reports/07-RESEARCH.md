# Phase 7: Support & Reports - Research

**Researched:** 2026-03-01
**Domain:** Async messaging, FAQ management, product requests, spending analytics, Excel export
**Confidence:** HIGH

## Summary

Phase 7 has two distinct sub-domains: (1) a dealer support system comprising async messaging, FAQ browsing, and product requests; and (2) dealer self-service spending analytics with charts and Excel export.

The support system requires new DB tables (support_messages, faq_categories, faq_items, product_requests) with RLS following the exact same patterns used in announcements and financials. Admin real-time notification for new dealer messages uses the established `supabase.channel().on('postgres_changes')` hook pattern from Phase 2 — identical to `use-order-realtime.ts`, just on the admin panel side. No new infrastructure is needed.

The reports sub-domain is built entirely on top of existing data: the `dealer_spending_summary` materialized view (Phase 6) already provides monthly aggregations, and the `dealer_transactions` table (Phase 5) provides raw rows. Charts use recharts (already installed at 2.15.4) following the `SalesChart` + `ChartContainer` pattern already in `src/components/reports/`. Excel export uses the `xlsx` (SheetJS) library — NOT installed yet (project currently uses `csv-stringify` for CSV). The `xlsx` package is the standard for browser-downloadable `.xlsx` files in Next.js.

The data for dealer spending reports comes primarily from `dealer_transactions`, not from `orders`. This is important: the financial transactions (invoices, payments, adjustments) in Phase 5 are the source of truth for spending analysis, supplemented by the `dealer_spending_summary` materialized view for monthly trend data.

**Primary recommendation:** New DB migration for support tables. Use Server Actions + Server Components pattern identical to announcements.ts. Supabase Realtime for admin notification of new messages (client hook in admin UI). Recharts BarChart for monthly trends, recharts LineChart for year-over-year comparison. Install `xlsx` for Excel export triggered via a route handler (not a Server Action, because binary file responses require `Response` not `revalidatePath`).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SUP-01 | Dealer can send messages to admin with subject categorization | `support_messages` table with `subject_category` enum/text; Server Action follows `createAnnouncement` pattern |
| SUP-02 | Dealer can view message history (pending/answered status) | `support_messages.status` field ('pending', 'answered'); dealer query filtered by `dealer_id` via RLS |
| SUP-03 | Dealer can browse FAQ organized by categories | `faq_categories` + `faq_items` tables; static read, no realtime needed |
| SUP-04 | Dealer can submit product requests for out-of-stock items | `product_requests` table linking to `products`; simple form + Server Action |
| SUP-05 | Admin receives real-time notification for new dealer messages | Supabase Realtime `postgres_changes` on `support_messages INSERT`; same pattern as `use-order-realtime.ts` |
| SUP-06 | Admin can reply to dealer messages and manage FAQ content | Admin Server Actions for message replies + FAQ CRUD; follows announcements admin pattern |
| REP-01 | Dealer can view spending analysis with monthly trend charts | `dealer_spending_summary` materialized view (Phase 6) + recharts BarChart; already have `spending-summary.tsx` as starting point |
| REP-02 | Dealer can compare spending periods (this month vs last month, this year vs last year) | Query `dealer_spending_summary` for date ranges; `SpendingSummary` type already exists in `dashboard.ts` |
| REP-03 | Dealer can export spending report as Excel | Install `xlsx`; route handler at `/api/reports/spending-export` returns binary `.xlsx`; NOT a Server Action |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 2.15.4 (installed) | Monthly trend BarChart, period comparison LineChart | Already in project; `SalesChart` + `ChartContainer` pattern established |
| xlsx (SheetJS) | ^0.18.5 (needs install) | Excel .xlsx export | Industry standard for Excel in Node.js/browser; 35k+ stars; Apache-2.0 license |
| @supabase/supabase-js | 2.91.1 (installed) | Realtime channel subscription for admin notification | Already used for order tracking; `postgres_changes` proven in production |
| date-fns | 4.1.0 (installed) | Date range calculations for period comparisons | Already used in `reports/sales-chart.tsx` and `dashboard.ts` |
| zod | 4.3.6 (installed) | Input validation for message forms | Already used in `financials.ts` `createTransactionSchema` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | 2.0.7 (installed) | Toast notification for message sent / export done | Already used throughout |
| lucide-react | 0.563.0 (installed) | Icons (MessageSquare, HelpCircle, FileSpreadsheet) | Already used throughout |
| react-hook-form + @hookform/resolvers | installed | Message compose form with validation | Already used in financials admin forms |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| xlsx (SheetJS) | exceljs | exceljs has richer styling API but 5x larger bundle; xlsx sufficient for data export |
| xlsx (SheetJS) | csv-stringify (already installed) | CSV already works but REP-03 requirement is explicitly Excel (.xlsx) |
| Supabase Realtime for SUP-05 | Polling every 30s | Polling is simpler but wastes bandwidth; Realtime already proven in project |
| Supabase Realtime for SUP-05 | Email notification | Email better for async admin check, but requirement says "real-time notification" in the UI |

**Installation (only new dependency):**
```bash
npm install xlsx
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/(dealer)/
│   ├── support/                    # New: dealer support hub
│   │   ├── page.tsx                # Message history + compose button
│   │   ├── faq/
│   │   │   └── page.tsx            # FAQ by category
│   │   └── product-requests/
│   │       └── page.tsx            # Product request form + history
│   └── reports/                    # New: dealer spending reports
│       └── page.tsx                # Charts + period comparison + export button
├── app/(admin)/admin/
│   └── support/                    # New: admin message management
│       ├── page.tsx                # Message inbox (with realtime)
│       ├── [id]/
│       │   └── page.tsx            # Individual thread + reply form
│       └── faq/
│           └── page.tsx            # FAQ CRUD
├── app/api/
│   └── reports/
│       └── spending-export/
│           └── route.ts            # GET handler returns .xlsx binary
├── components/
│   ├── support/
│   │   ├── message-compose-form.tsx    # Dealer: new message form
│   │   ├── message-list.tsx            # Dealer: message history list
│   │   ├── message-status-badge.tsx    # pending/answered badge
│   │   ├── faq-category-list.tsx       # FAQ accordion by category
│   │   └── product-request-form.tsx    # Out-of-stock request form
│   ├── admin/
│   │   ├── support/
│   │   │   ├── message-inbox.tsx       # Admin: message list with realtime
│   │   │   ├── message-thread.tsx      # Admin: thread view + reply
│   │   │   └── faq-manager.tsx         # Admin: FAQ CRUD
│   └── reports/
│       ├── spending-trend-chart.tsx    # Monthly bar chart (recharts)
│       ├── period-comparison.tsx       # This month vs last month cards
│       └── spending-export-button.tsx  # Client button triggers download
├── lib/
│   ├── actions/
│   │   └── support.ts              # All support Server Actions
│   └── queries/
│       └── spending-reports.ts     # Dealer spending query functions
└── hooks/
    └── use-support-realtime.ts     # Admin: subscribe to new messages
```

### Pattern 1: Supabase Realtime for Admin Message Notification
**What:** Admin UI subscribes to `INSERT` events on `support_messages`. When a dealer submits a new message, admin sees a toast + badge count increment without page reload.
**When to use:** SUP-05 requirement. Admin panel only (dealer doesn't need realtime on their own sent messages).

```typescript
// Source: Based on /src/hooks/use-order-realtime.ts (proven project pattern)
// File: src/hooks/use-support-realtime.ts
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useSupportRealtime() {
  const [newMessageCount, setNewMessageCount] = useState(0)
  const router = useRouter()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (channelRef.current) return

    const channel = supabase
      .channel('admin-support-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
        },
        (payload) => {
          toast.info('Yeni destek mesaji alindi')
          setNewMessageCount((c) => c + 1)
          router.refresh()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [supabase, router])

  return { newMessageCount }
}
```

**DB requirement:** `support_messages` table must be added to `supabase_realtime` publication (same as `orders` in migration 002).

### Pattern 2: Excel Export via Route Handler
**What:** Excel export cannot be a Server Action (Server Actions return serializable data; binary files need `Response` with correct headers). Use a Next.js Route Handler instead.
**When to use:** REP-03 requirement.

```typescript
// Source: Next.js docs + xlsx README
// File: src/app/api/reports/spending-export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get dealer ID
  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealer) return NextResponse.json({ error: 'Dealer not found' }, { status: 404 })

  // Fetch spending data from dealer_spending_summary
  const { data: rows } = await supabase
    .from('dealer_spending_summary')
    .select('month, total_debit, total_credit, net_balance')
    .eq('dealer_id', (dealer as { id: string }).id)
    .order('month', { ascending: false })

  // Build worksheet
  const wsData = (rows || []).map((r: any) => ({
    'Ay': r.month,
    'Toplam Borc (TL)': r.total_debit,
    'Toplam Alacak (TL)': r.total_credit,
    'Net Bakiye (TL)': r.net_balance,
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(wsData)
  XLSX.utils.book_append_sheet(wb, ws, 'Harcama Analizi')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="harcama-analizi-${new Date().toISOString().slice(0,10)}.xlsx"`,
    },
  })
}
```

**Client button triggers the download:**
```tsx
// File: src/components/reports/spending-export-button.tsx
'use client'
export function SpendingExportButton() {
  const handleExport = () => {
    window.location.href = '/api/reports/spending-export'
  }
  return (
    <Button onClick={handleExport} variant="outline">
      <FileSpreadsheet className="h-4 w-4 mr-2" />
      Excel Indir
    </Button>
  )
}
```

### Pattern 3: Spending Trend Chart (Reuse Existing recharts Setup)
**What:** Monthly BarChart using `dealer_spending_summary` materialized view. Reuse `ChartContainer` + `ChartTooltip` from `src/components/ui/chart.tsx` (the shadcn chart wrapper already established in Phase 3).
**When to use:** REP-01 requirement.

```typescript
// Source: Based on /src/components/reports/sales-chart.tsx (existing pattern)
// File: src/components/reports/spending-trend-chart.tsx
'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { format, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'

const chartConfig = {
  total_debit: { label: 'Borc (TL)', color: 'hsl(var(--chart-1))' },
  total_credit: { label: 'Alacak (TL)', color: 'hsl(var(--chart-2))' },
}

export function SpendingTrendChart({ data }: { data: Array<{ month: string; total_debit: number; total_credit: number }> }) {
  const chartData = [...data].reverse().map((d) => ({
    month: format(parseISO(`${d.month}-01`), 'MMM yy', { locale: tr }),
    total_debit: d.total_debit,
    total_credit: d.total_credit,
  }))

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={chartData} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="total_debit" fill="var(--color-total_debit)" radius={[4,4,0,0]} />
        <Bar dataKey="total_credit" fill="var(--color-total_credit)" radius={[4,4,0,0]} />
      </BarChart>
    </ChartContainer>
  )
}
```

### Pattern 4: Support Message Server Actions
**What:** Follows the exact pattern of `announcements.ts` — `createClient()`, auth check, dealer ID lookup, insert, `revalidatePath`. Admin actions follow `verifyAdmin()` helper from `financials.ts`.

```typescript
// File: src/lib/actions/support.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const sendMessageSchema = z.object({
  subject: z.string().min(1).max(200),
  category: z.enum(['siparis', 'urun', 'odeme', 'teknik', 'diger']),
  body: z.string().min(10).max(5000),
})

export async function sendSupportMessage(input: z.infer<typeof sendMessageSchema>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Oturum acmaniz gerekiyor' }

  const { data: dealer } = await supabase
    .from('dealers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!dealer) return { success: false, error: 'Bayi bulunamadi' }

  const parsed = sendMessageSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Gecersiz veri' }

  const { error } = await supabase
    .from('support_messages')
    .insert({
      dealer_id: (dealer as { id: string }).id,
      subject: parsed.data.subject,
      category: parsed.data.category,
      body: parsed.data.body,
      status: 'pending',
    })

  if (error) return { success: false, error: 'Mesaj gonderilemedi' }

  revalidatePath('/support')
  return { success: true }
}
```

### Anti-Patterns to Avoid
- **Binary download via Server Action:** Server Actions must return serializable data. Excel/PDF downloads must use Route Handlers (`/api/...`). Returning a `Buffer` from a Server Action will silently fail or throw.
- **Realtime on dealer side for own messages:** Unnecessary. Dealer refreshes the page to see admin reply. Only admin needs realtime (SUP-05 requirement).
- **Separate FAQ table per dealer:** FAQ is shared content. No `dealer_id` on FAQ tables. Admin manages globally, all dealers see the same FAQ.
- **Refreshing dealer_spending_summary in Server Action:** The materialized view must be refreshed separately (pg_cron or Supabase webhook). Do NOT call `REFRESH MATERIALIZED VIEW` inside a Server Action — it will block the request and potentially time out.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel file generation | Custom CSV-to-Excel conversion or ZIP manipulation | `xlsx` (SheetJS) | Cell formatting, column widths, multiple sheets — xlsx handles all edge cases |
| Admin real-time badge | Polling loop with `setInterval` | Supabase Realtime `postgres_changes` | Already proven in project; polling wastes 1 request/30s per admin tab |
| Period date arithmetic | Custom month start/end calculations | `date-fns` startOfMonth, subMonths, startOfYear | DST edge cases, leap years, locale-aware — already installed |
| Message status machine | Custom status enum validation in JS | DB `CHECK` constraint + zod enum | Consistency enforced at DB level; zod mirrors constraint for form validation |
| FAQ search | Full-text search implementation | Simple `ILIKE` query or client-side filter | Scale is small (< 100 FAQ items); no elasticsearch needed |

## Common Pitfalls

### Pitfall 1: dealer_spending_summary Materialized View May Be Stale
**What goes wrong:** Dealer opens the spending report page and sees outdated data because the materialized view hasn't been refreshed recently.
**Why it happens:** The materialized view from Phase 6 is refreshed on a schedule (or manually). If no pg_cron job is configured, data stays from creation time.
**How to avoid:** (a) Verify pg_cron refresh exists; if not, add a Supabase Database Webhook trigger on `dealer_transactions INSERT` to call a lightweight function that does `REFRESH MATERIALIZED VIEW CONCURRENTLY dealer_spending_summary`. (b) As a fallback, the spending reports page can directly query `dealer_transactions` with `DATE_TRUNC('month', transaction_date)` grouping — this is always current. Use the materialized view for the 12-month trend (performance), raw query for the current month comparison card.
**Warning signs:** Report shows 0 for current month even though transactions exist.

### Pitfall 2: xlsx Package Size in Next.js
**What goes wrong:** Installing `xlsx` adds ~500KB to the bundle if imported in a client component.
**Why it happens:** SheetJS is a large library designed for full browser use.
**How to avoid:** Import `xlsx` ONLY in the route handler (`/api/reports/spending-export/route.ts`), which runs server-side. Never `import * as XLSX from 'xlsx'` in a client component. The `SpendingExportButton` uses `window.location.href`, not xlsx itself.
**Warning signs:** Client bundle size increase; Lighthouse warnings about large JS payloads.

### Pitfall 3: Supabase Realtime — Table Not in Publication
**What goes wrong:** Admin never receives notifications for new support messages even though the hook is mounted.
**Why it happens:** `support_messages` table not added to `supabase_realtime` publication in the migration.
**How to avoid:** Migration 008 must include both `GRANT SELECT ON support_messages TO supabase_realtime` and `ALTER PUBLICATION supabase_realtime ADD TABLE support_messages`. Copy the exact pattern from `002_realtime_setup.sql`.
**Warning signs:** `supabase.channel().subscribe()` status stays `'SUBSCRIBED'` but no events fire when rows are inserted.

### Pitfall 4: Message Reply Creates New Row, Not UPDATE
**What goes wrong:** Planner designs admin reply as an UPDATE to `support_messages.reply_body`, which loses reply timestamps and makes threading impossible.
**Why it happens:** Seems simpler to add a `reply_body` column to the same table.
**How to avoid:** For Phase 7 scope (single-level async messaging), a `reply_body + replied_at + replied_by` column approach on `support_messages` is acceptable (not a full thread). But the status change to `'answered'` MUST also be atomic with the reply insertion (use a single UPDATE or DB trigger). Document this trade-off clearly in plans.
**Warning signs:** Race condition where status is set to `answered` but reply body is empty.

### Pitfall 5: Spending Report Shows Order Totals, Not Transaction Data
**What goes wrong:** Developer builds REP-01 by querying `orders.total_amount` instead of `dealer_transactions`. The two may not agree (orders are placed, but financial transactions reflect what's actually invoiced).
**Why it happens:** `orders` table is more familiar; `dealer_transactions` requires understanding the Phase 5 financial model.
**How to avoid:** Spending reports MUST use `dealer_transactions` (filtered to `invoice` type transactions) + `dealer_spending_summary` materialized view, NOT the `orders` table. The financial backbone (Phase 5) is the source of truth for what the dealer actually owes/paid.
**Warning signs:** Report shows spending before admin has confirmed/invoiced the order.

## Code Examples

### Spending Data Query (from dealer_spending_summary)
```typescript
// Source: Extends dashboard.ts getSpendingSummary() pattern
// File: src/lib/queries/spending-reports.ts
import { createClient } from '@/lib/supabase/server'

export interface MonthlySpending {
  month: string          // 'YYYY-MM-DD' (first of month)
  totalDebit: number
  totalCredit: number
  netBalance: number
}

export async function getDealerMonthlySpending(
  dealerId: string,
  months: number = 12
): Promise<MonthlySpending[]> {
  const supabase = await createClient()

  const fromDate = new Date()
  fromDate.setMonth(fromDate.getMonth() - months)
  const fromDateStr = fromDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('dealer_spending_summary')
    .select('month, total_debit, total_credit, net_balance')
    .eq('dealer_id', dealerId)
    .gte('month', fromDateStr)
    .order('month', { ascending: false })

  if (error || !data) return []

  return data.map((d: any) => ({
    month: d.month,
    totalDebit: d.total_debit ?? 0,
    totalCredit: d.total_credit ?? 0,
    netBalance: d.net_balance ?? 0,
  }))
}
```

### FAQ Table Structure and Query
```typescript
// DB schema (in migration 008):
// faq_categories: id, name, display_order, is_active
// faq_items: id, category_id, question, answer, display_order, is_active

// Query pattern (simple, no RLS complexity — public read):
const { data } = await supabase
  .from('faq_categories')
  .select(`
    id, name, display_order,
    faq_items(id, question, answer, display_order)
  `)
  .eq('is_active', true)
  .order('display_order')
```

### Period Comparison (This Month vs Last Month)
```typescript
// Source: Extends dashboard.ts SpendingSummary pattern
import { startOfMonth, subMonths, startOfYear } from 'date-fns'

export async function getSpendingComparison(dealerId: string) {
  const now = new Date()
  const thisMonthStart = startOfMonth(now).toISOString().split('T')[0]
  const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString().split('T')[0]
  const thisYearStart = startOfYear(now).toISOString().split('T')[0]
  const lastYearStart = startOfYear(subMonths(now, 12)).toISOString().split('T')[0]

  // Query dealer_spending_summary for the needed months
  // ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom CSV export for reports | xlsx for Excel (.xlsx) | Required for REP-03 | .xlsx files open natively in Excel/LibreOffice; no CSV encoding issues with Turkish chars |
| Polling for admin notifications | Supabase Realtime postgres_changes | Phase 2 (established) | Zero-latency updates, no wasted requests |
| Real-time chat for support | Async messaging (pending/answered) | PROJECT.md explicit decision | Simpler DB schema; no WebSocket session management; acceptable for B2B |

**Deprecated/outdated:**
- Real-time chat: Explicitly out of scope. PROJECT.md states: "Canli chat (realtime) — v2'de mesajlasma var ama async, canli chat yok"

## DB Schema for Phase 7

This section is for the planner — exact table definitions to use in migration 008.

### support_messages
```sql
CREATE TABLE support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('siparis', 'urun', 'odeme', 'teknik', 'diger')),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered')),
  -- Admin reply (single-level, not threaded)
  reply_body TEXT,
  replied_at TIMESTAMPTZ,
  replied_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: dealer reads own, admin reads all
-- Realtime: GRANT SELECT + ALTER PUBLICATION
```

### faq_categories + faq_items
```sql
CREATE TABLE faq_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE faq_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES faq_categories(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: all authenticated can read active items; admin manages all
```

### product_requests
```sql
CREATE TABLE product_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL, -- nullable: product may not exist yet
  product_name TEXT NOT NULL,         -- capture name even if product deleted
  product_code TEXT,
  requested_quantity INT NOT NULL DEFAULT 1,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'fulfilled', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: dealer reads own, admin reads all
```

## Open Questions

1. **dealer_spending_summary refresh strategy**
   - What we know: View exists from Phase 6 migration. Comment says "pg_cron every 10 minutes OR trigger after INSERT."
   - What's unclear: Whether pg_cron is configured in the Supabase project. If not, report page will show stale data.
   - Recommendation: Migration 008 should add a DB trigger on `dealer_transactions` INSERT/UPDATE that calls `REFRESH MATERIALIZED VIEW CONCURRENTLY dealer_spending_summary`. This is safe because CONCURRENTLY doesn't lock the table. If pg_cron exists, document it; if not, use the trigger approach.

2. **Admin support inbox — which admin user(s) receive the notification?**
   - What we know: Project has a single admin role. No multi-admin routing is needed.
   - What's unclear: Is there only ever one admin logged in, or can multiple admins be logged in simultaneously?
   - Recommendation: The Realtime hook subscribes to ALL inserts on `support_messages` regardless of which admin is viewing. This is correct for the current scale (single admin). No dealer-to-specific-admin routing needed.

3. **Product request — must the product exist in the catalog?**
   - What we know: SUP-04 says "product requests for out-of-stock items" — implying the product exists but is out of stock.
   - What's unclear: Can a dealer request a product that isn't in the catalog at all?
   - Recommendation: Make `product_id` nullable in `product_requests`. Dealer can optionally link to an existing product (out-of-stock) OR type a free-form product name/code for items not yet in catalog. Both cases handled.

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection — `src/hooks/use-order-realtime.ts` (Realtime pattern)
- Codebase direct inspection — `src/components/reports/sales-chart.tsx` + `src/components/ui/chart.tsx` (recharts wrapper pattern)
- Codebase direct inspection — `src/lib/actions/financials.ts` (Server Action + admin verify pattern)
- Codebase direct inspection — `src/lib/actions/announcements.ts` (content CRUD pattern)
- Codebase direct inspection — `supabase/migrations/002_realtime_setup.sql` (Realtime publication setup)
- Codebase direct inspection — `supabase/migrations/006_financial_tables.sql` + `007_dashboard_campaigns.sql` (DB schema patterns)
- Codebase direct inspection — `package.json` (confirmed: recharts 2.15.4 installed, xlsx NOT installed)

### Secondary (MEDIUM confidence)
- xlsx/SheetJS README and npm page — confirmed `XLSX.utils.json_to_sheet` + `XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })` pattern for server-side use
- Next.js App Router docs — confirmed Route Handlers return `NextResponse` with binary data (xlsx cannot be returned from Server Action)
- Supabase Realtime docs — confirmed `postgres_changes` INSERT filter works on any table added to publication

### Tertiary (LOW confidence)
- None — all key claims verified against project codebase or official documentation patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against package.json and existing code
- Architecture: HIGH — directly derived from established project patterns (announcements, orders, financials)
- DB schema: HIGH — follows exact patterns of migrations 006 and 007
- Pitfalls: HIGH — identified from actual code inspection (view staleness from migration comment, xlsx bundle from package.json absence)
- Excel export via Route Handler: HIGH — confirmed Next.js constraint (Server Actions are not `Response` objects)

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (stable stack, no fast-moving dependencies except possibly recharts minor updates)
