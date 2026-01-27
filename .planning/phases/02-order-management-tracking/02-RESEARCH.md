# Phase 02: Order Management & Tracking - Research

**Researched:** 2026-01-27
**Domain:** Supabase Realtime + Order Management UI + Notification System
**Confidence:** HIGH

## Summary

Phase 02 implements real-time order status tracking, order history with reordering capability, quick order forms for frequent purchases, and comprehensive admin order management with status updates. The architecture centers on Supabase Realtime for instant order status notifications, database triggers for automatic audit trail creation, and server-side filtering patterns for performant order list management.

The standard approach combines Supabase Realtime postgres_changes subscriptions (with proper RLS permissions) for live updates, sonner toast notifications already installed in Phase 1, database triggers to auto-populate order_status_history, and TanStack Table with server-side filtering for admin order management. Critical architectural decisions include granting supabase_realtime role SELECT permissions on orders table, using useEffect cleanup for Realtime subscriptions, implementing quick order patterns with SKU-based search, and creating reorder functionality that loads past order items directly into cart.

**Primary recommendation:** Use Supabase Realtime postgres_changes with proper cleanup in React useEffect, grant SELECT to supabase_realtime role on orders/order_status_history tables, create database triggers for automatic status history tracking, implement server-side filtering for admin order lists, and leverage existing sonner toast system for status change notifications.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.91.1+ | Realtime subscriptions | Official client with postgres_changes support, RLS-aware filtering |
| sonner | 2.0.7+ | Toast notifications | Already installed, lightweight, opinionated design matches shadcn/ui |
| date-fns | 4.1.0+ | Date formatting | Turkish locale support, relative time (formatDistance, formatRelative) |
| TanStack Table | v8 | Data tables | Server-side filtering/sorting, already in use from Phase 1 |
| Zustand | 5.0.10+ | Client state | Already used for cart, can extend for order history cache |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.563.0+ | Icons | Status indicators, timeline icons (already installed) |
| shadcn/ui components | Latest | UI components | Badge (status), Dialog (order details), Timeline (custom component) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Supabase Realtime | Polling (setInterval) | Polling simpler but 10-60s latency vs instant, higher database load |
| Database triggers | Application-level history | Triggers automatic, consistent; app code can be bypassed via SQL |
| sonner | react-hot-toast | Both good, sonner already installed and matches shadcn/ui aesthetic |
| Server-side filtering | Client-side with all data | Server-side essential for 1000+ orders, client-side works for <100 |

**Installation:**

No new core dependencies needed. All required libraries already installed in Phase 1.

Optional (for custom timeline component):
```bash
# All core libraries already installed
# Optional: shadcn/ui badge component if not already installed
npx shadcn@latest add badge
```

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (dealer)/
│   │   ├── orders/                    # Order history & tracking
│   │   │   ├── page.tsx               # Order list
│   │   │   └── [id]/
│   │   │       └── page.tsx           # Order detail + status tracking
│   │   ├── quick-order/               # Quick order form
│   │   │   └── page.tsx
│   │
│   ├── (admin)/
│   │   └── admin/
│   │       └── orders/                # Admin order management
│   │           ├── page.tsx           # Order list with filters
│   │           └── [id]/
│   │               └── page.tsx       # Order detail + status update
│
├── components/
│   ├── orders/
│   │   ├── order-status-badge.tsx     # Status indicator
│   │   ├── order-status-timeline.tsx  # Visual status progression
│   │   ├── order-items-table.tsx      # Order items display
│   │   └── reorder-button.tsx         # Add past order to cart
│   │
│   ├── admin/
│   │   ├── order-table.tsx            # TanStack Table with filtering
│   │   ├── order-status-select.tsx    # Status update dropdown
│   │   └── order-filters.tsx          # Date/dealer/status filters
│   │
│   ├── quick-order/
│   │   ├── sku-search.tsx             # Product search by SKU
│   │   ├── frequent-products.tsx      # Top purchased products
│   │   └── quick-order-form.tsx       # Bulk add to cart
│
├── hooks/
│   ├── use-order-realtime.ts          # Realtime subscription hook
│   └── use-frequent-products.ts       # Query frequent purchases
│
├── lib/
│   ├── actions/
│   │   └── orders.ts                  # Extend with status update actions
│   │
│   └── queries/
│       └── orders.ts                  # Server-side order queries
```

### Pattern 1: Realtime Order Status Subscriptions

**What:** Subscribe to order status changes using Supabase Realtime postgres_changes, filtered by dealer_id via RLS, with proper cleanup.

**When to use:** Dealer order detail pages, admin order management dashboard.

**Example:**

```typescript
// hooks/use-order-realtime.ts
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useOrderRealtime(orderId: string) {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    let channel: RealtimeChannel

    const subscribe = async () => {
      channel = supabase
        .channel(`order-${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            // Payload contains new row data
            console.log('Order updated:', payload)
            toast.success('Sipariş durumu güncellendi')

            // Trigger page revalidation or state update
            window.location.reload() // or use router.refresh()
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsSubscribed(true)
          }
        })
    }

    subscribe()

    // Cleanup on unmount
    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [orderId, supabase])

  return { isSubscribed }
}
```

**Database setup (required):**

```sql
-- Grant SELECT to supabase_realtime role
GRANT SELECT ON orders TO supabase_realtime;
GRANT SELECT ON order_status_history TO supabase_realtime;

-- Enable publication (via Supabase Dashboard > Database > Publications)
-- Or via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_status_history;
```

**Source:** [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)

### Pattern 2: Automatic Status History with Triggers

**What:** Database trigger that automatically inserts order_status_history record whenever order status changes.

**When to use:** All order status updates (dealer creates order, admin changes status).

**Example:**

```sql
-- Trigger function to track status changes
CREATE OR REPLACE FUNCTION track_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF (TG_OP = 'UPDATE' AND OLD.status_id IS DISTINCT FROM NEW.status_id) OR TG_OP = 'INSERT' THEN
    INSERT INTO order_status_history (
      order_id,
      status_id,
      changed_by,
      notes
    ) VALUES (
      NEW.id,
      NEW.status_id,
      (SELECT auth.uid()), -- Current user from Supabase Auth
      CASE
        WHEN TG_OP = 'INSERT' THEN 'Sipariş oluşturuldu'
        ELSE 'Durum değiştirildi'
      END
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER order_status_change_trigger
  AFTER INSERT OR UPDATE OF status_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION track_order_status_change();
```

**Source:** [PostgreSQL Trigger-Based Audit Log](https://medium.com/israeli-tech-radar/postgresql-trigger-based-audit-log-fd9d9d5e412c), [Working with Postgres Audit Triggers](https://www.enterprisedb.com/postgres-tutorials/working-postgres-audit-triggers)

### Pattern 3: Server-Side Order Filtering

**What:** Use URL search params for filter state, query database server-side with pagination, pass results to TanStack Table.

**When to use:** Admin order management page with date/dealer/status filters.

**Example:**

```typescript
// app/(admin)/admin/orders/page.tsx
import { createClient } from '@/lib/supabase/server'
import { OrderTable } from '@/components/admin/order-table'

interface SearchParams {
  page?: string
  status?: string
  dealer?: string
  from?: string
  to?: string
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()

  // Parse filters from URL
  const page = parseInt(searchParams.page || '1')
  const pageSize = 50
  const offset = (page - 1) * pageSize

  // Build query with filters
  let query = supabase
    .from('orders')
    .select(`
      *,
      dealer:dealers(id, company_name, email),
      status:order_statuses(id, code, name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (searchParams.status) {
    query = query.eq('status_id', searchParams.status)
  }

  if (searchParams.dealer) {
    query = query.eq('dealer_id', searchParams.dealer)
  }

  if (searchParams.from) {
    query = query.gte('created_at', searchParams.from)
  }

  if (searchParams.to) {
    query = query.lte('created_at', searchParams.to)
  }

  const { data: orders, count, error } = await query

  if (error) throw error

  return (
    <div>
      <OrderTable
        orders={orders || []}
        totalCount={count || 0}
        currentPage={page}
      />
    </div>
  )
}
```

**Source:** [TanStack Table Server-Side Guide](https://medium.com/@clee080/how-to-do-server-side-pagination-column-filtering-and-sorting-with-tanstack-react-table-and-react-7400a5604ff2), [TanStack Table Column Filtering Guide](https://tanstack.com/table/latest/docs/guide/column-filtering)

### Pattern 4: Reorder from History

**What:** Load past order items into cart with one click, preserving product details and recalculating current prices.

**When to use:** Order history page, order detail page.

**Example:**

```typescript
// components/orders/reorder-button.tsx
'use client'

import { Button } from '@/components/ui/button'
import { useCartStore } from '@/store/cart'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface ReorderButtonProps {
  orderId: string
}

export function ReorderButton({ orderId }: ReorderButtonProps) {
  const addItem = useCartStore((state) => state.addItem)

  const handleReorder = async () => {
    const supabase = createClient()

    // Fetch order items
    const { data: orderItems, error } = await supabase
      .from('order_items')
      .select('product_id, product_code, product_name, quantity')
      .eq('order_id', orderId)

    if (error || !orderItems) {
      toast.error('Sipariş yüklenirken hata oluştu')
      return
    }

    // Get current dealer prices for products
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: dealer } = await supabase
      .from('dealers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!dealer) return

    // Add each item to cart with current price
    for (const item of orderItems) {
      const { data: priceData } = await supabase
        .rpc('get_dealer_price', {
          p_dealer_id: dealer.id,
          p_product_id: item.product_id,
        })

      addItem({
        productId: item.product_id,
        productCode: item.product_code,
        productName: item.product_name,
        quantity: item.quantity,
        price: priceData || 0,
      })
    }

    toast.success(`${orderItems.length} ürün sepete eklendi`)
  }

  return (
    <Button onClick={handleReorder} variant="outline">
      Tekrar Sipariş Ver
    </Button>
  )
}
```

**Source:** [Order History Guide - Shopify](https://www.shopify.com/blog/order-history-why-keeping-track-of-customers-previous-orders-can-help-you-make-more-sales), [B2B Shopping Cart Best Practices](https://www.practicalecommerce.com/common-b2b-mistakes-part-3-shopping-carts-order-management)

### Pattern 5: Quick Order Form with SKU Search

**What:** Table-based form where dealers can enter SKUs and quantities, auto-searching products, showing frequent purchases.

**When to use:** B2B dealers who know product codes and order regularly.

**Example:**

```typescript
// components/quick-order/quick-order-form.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCartStore } from '@/store/cart'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface QuickOrderRow {
  id: string
  sku: string
  productName: string
  productId: string | null
  quantity: number
  price: number | null
}

export function QuickOrderForm() {
  const [rows, setRows] = useState<QuickOrderRow[]>([
    { id: '1', sku: '', productName: '', productId: null, quantity: 1, price: null }
  ])
  const addItem = useCartStore((state) => state.addItem)
  const supabase = createClient()

  const searchProduct = async (sku: string, rowId: string) => {
    if (!sku) return

    // Get dealer ID
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: dealer } = await supabase
      .from('dealers')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!dealer) return

    // Search product by code
    const { data: product } = await supabase
      .from('products')
      .select('id, code, name')
      .ilike('code', sku)
      .single()

    if (!product) {
      toast.error(`Ürün bulunamadı: ${sku}`)
      return
    }

    // Get dealer price
    const { data: price } = await supabase
      .rpc('get_dealer_price', {
        p_dealer_id: dealer.id,
        p_product_id: product.id,
      })

    // Update row
    setRows(prev => prev.map(row =>
      row.id === rowId
        ? { ...row, productId: product.id, productName: product.name, price }
        : row
    ))
  }

  const addToCart = () => {
    const validRows = rows.filter(r => r.productId && r.quantity > 0)

    validRows.forEach(row => {
      addItem({
        productId: row.productId!,
        productCode: row.sku,
        productName: row.productName,
        quantity: row.quantity,
        price: row.price || 0,
      })
    })

    toast.success(`${validRows.length} ürün sepete eklendi`)

    // Reset form
    setRows([{ id: '1', sku: '', productName: '', productId: null, quantity: 1, price: null }])
  }

  return (
    <div className="space-y-4">
      <table className="w-full">
        <thead>
          <tr>
            <th>Ürün Kodu</th>
            <th>Ürün Adı</th>
            <th>Miktar</th>
            <th>Fiyat</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td>
                <Input
                  value={row.sku}
                  onChange={(e) => {
                    const newSku = e.target.value
                    setRows(prev => prev.map(r =>
                      r.id === row.id ? { ...r, sku: newSku } : r
                    ))
                  }}
                  onBlur={() => searchProduct(row.sku, row.id)}
                  placeholder="Ürün kodu girin"
                />
              </td>
              <td>{row.productName}</td>
              <td>
                <Input
                  type="number"
                  value={row.quantity}
                  onChange={(e) => {
                    setRows(prev => prev.map(r =>
                      r.id === row.id ? { ...r, quantity: parseInt(e.target.value) || 0 } : r
                    ))
                  }}
                />
              </td>
              <td>{row.price ? `₺${row.price.toFixed(2)}` : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setRows(prev => [...prev, {
            id: Date.now().toString(),
            sku: '',
            productName: '',
            productId: null,
            quantity: 1,
            price: null
          }])}
        >
          Satır Ekle
        </Button>
        <Button onClick={addToCart}>
          Sepete Ekle
        </Button>
      </div>
    </div>
  )
}
```

**Source:** [B2B Quick Order Forms](https://www.bigcommerce.com/articles/b2b-ecommerce/b2b-order-management/), [WooCommerce Quick Order Patterns](https://store.webkul.com/woocommerce-quick-order.html)

### Pattern 6: Order Status Timeline Component

**What:** Visual timeline showing order progression through status steps with timestamps.

**When to use:** Order detail pages for both dealer and admin.

**Example:**

```typescript
// components/orders/order-status-timeline.tsx
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import { CheckCircle2, Circle, Clock } from 'lucide-react'

interface OrderStatusHistory {
  id: string
  status: {
    code: string
    name: string
  }
  created_at: string
  notes?: string
}

interface OrderStatusTimelineProps {
  history: OrderStatusHistory[]
  currentStatusCode: string
}

const STATUS_ORDER = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered']

export function OrderStatusTimeline({ history, currentStatusCode }: OrderStatusTimelineProps) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatusCode)

  return (
    <div className="space-y-4">
      {history.map((item, index) => {
        const statusIndex = STATUS_ORDER.indexOf(item.status.code)
        const isCompleted = statusIndex <= currentIndex
        const isCurrent = item.status.code === currentStatusCode

        return (
          <div key={item.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              {isCompleted ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : isCurrent ? (
                <Clock className="h-6 w-6 text-blue-600" />
              ) : (
                <Circle className="h-6 w-6 text-gray-300" />
              )}

              {index < history.length - 1 && (
                <div className={`w-0.5 h-12 ${isCompleted ? 'bg-green-600' : 'bg-gray-300'}`} />
              )}
            </div>

            <div className="flex-1 pb-8">
              <div className="font-semibold">{item.status.name}</div>
              <div className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(item.created_at), {
                  addSuffix: true,
                  locale: tr
                })}
              </div>
              {item.notes && (
                <div className="text-sm text-muted-foreground mt-1">
                  {item.notes}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

**Source:** [Shadcn Timeline Component](https://www.shadcn.io/template/timdehof-shadcn-timeline), [Material UI Timeline](https://mui.com/material-ui/react-timeline/)

### Anti-Patterns to Avoid

- **Not cleaning up Realtime subscriptions** - Always use `supabase.removeChannel(channel)` in useEffect cleanup to prevent memory leaks
- **Forgetting to grant supabase_realtime permissions** - Realtime won't work without `GRANT SELECT ON table TO supabase_realtime`
- **Client-side filtering for large datasets** - Use server-side filtering for admin order lists; client-side works only for <100 records
- **Subscribing to all order changes** - Filter subscriptions by order ID or dealer ID to reduce database load
- **Not using database triggers for audit trail** - Application-level status history can be bypassed; triggers are automatic and consistent
- **Recalculating prices in reorder without checking current price** - Always fetch current dealer price when reordering (prices change)
- **Using polling instead of Realtime without measurement** - Realtime is free on Supabase, provides instant updates; don't prematurely optimize
- **Not handling React Strict Mode double-mount** - Realtime subscriptions in useEffect will mount twice in development; ensure cleanup works

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time notifications | WebSocket server, polling | Supabase Realtime postgres_changes | RLS enforcement, automatic filtering, connection management, 99.9% uptime SLA |
| Audit trail / status history | Application-level logging | PostgreSQL triggers | Automatic, can't be bypassed, transactional, zero application code |
| Toast notifications | Custom notification component | sonner (already installed) | Accessible, animated, positioned correctly, promise support, already integrated |
| Order status timeline UI | Custom timeline from scratch | shadcn timeline pattern or Material UI | Accessibility, responsive, tested across browsers, animation support |
| Date formatting for Turkish | String manipulation | date-fns with tr locale | Locale-specific formatting, relative time, timezone support, consistent across app |
| SKU search / autocomplete | Custom debounced search | Supabase .ilike() with client-side debounce hook (already exists) | Indexed search, works with RLS, consistent with catalog search pattern |
| Server-side pagination | Custom offset logic | TanStack Table manual mode with URL params | Shareable URLs, browser back/forward, SEO, proven pattern |

**Key insight:** Order management has complex real-time requirements (instant status updates), audit requirements (who changed what when), and scale challenges (1000+ orders). Use Supabase Realtime for instant updates, database triggers for reliable audit trails, and server-side filtering for performance. Don't reinvent these battle-tested patterns.

## Common Pitfalls

### Pitfall 1: Realtime Subscription Memory Leaks

**What goes wrong:** Subscriptions created in useEffect but not cleaned up, causing memory leaks, duplicate subscriptions, and degraded performance.

**Why it happens:** Developers forget to return cleanup function, or cleanup doesn't properly remove channel. React Strict Mode double-mounts components in development, making this worse.

**How to avoid:**
1. Always return cleanup function in useEffect: `return () => supabase.removeChannel(channel)`
2. Store channel reference before subscribing to access in cleanup
3. Test in development with React Strict Mode enabled to catch double-subscription issues
4. Use custom hook to encapsulate subscription logic and ensure cleanup

**Warning signs:**
- Multiple console logs from same subscription
- Memory usage increases over time
- Supabase connection count increases without user count increase
- Toast notifications firing multiple times

**Source:** [Supabase Realtime Cleanup Issues](https://github.com/orgs/supabase/discussions/8573), [Supabase JavaScript API - removeSubscription](https://supabase.com/docs/reference/javascript/v1/removesubscription)

### Pitfall 2: Missing supabase_realtime Permissions

**What goes wrong:** Realtime subscriptions silently fail or don't receive updates; no error shown to developer.

**Why it happens:** Supabase Realtime service needs explicit GRANT SELECT permission on tables to check RLS policies. Default setup doesn't grant this.

**How to avoid:**
1. Grant SELECT permission: `GRANT SELECT ON orders TO supabase_realtime;`
2. Add table to supabase_realtime publication via Dashboard > Database > Publications
3. Verify RLS policies allow authenticated users to see their own data
4. Test subscriptions after granting permissions

**Warning signs:**
- Subscription status shows 'SUBSCRIBED' but no updates received
- Updates work in Supabase Dashboard but not in app
- RLS policies work for queries but not Realtime
- No error messages in console

**Source:** [Supabase Realtime RLS Policy Subscription Issues](https://www.technetexperts.com/realtime-rls-solved/), [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)

### Pitfall 3: Realtime Performance at Scale

**What goes wrong:** Database becomes slow or unresponsive when many users subscribe to order changes simultaneously.

**Why it happens:** Each Realtime update triggers RLS policy checks for every subscribed user. 100 users subscribed = 100 authorization checks per insert/update. Realtime processing is single-threaded.

**How to avoid:**
1. Filter subscriptions narrowly: `filter: 'id=eq.${orderId}'` not `table: 'orders'`
2. Limit concurrent subscriptions: unsubscribe when component unmounts or page hidden
3. Monitor database load in Supabase Dashboard under Database > Performance
4. For high-volume scenarios (>50 concurrent subscriptions), consider polling or server-side Realtime with Broadcast
5. Index columns used in Realtime filters

**Warning signs:**
- Database CPU usage spikes during status updates
- Slow query warnings in Supabase logs
- Authorization check time increases
- Delayed notifications (>1s latency)

**Source:** [Supabase Realtime Postgres Changes Performance](https://supabase.com/docs/guides/realtime/postgres-changes)

### Pitfall 4: Stale Cart Prices on Reorder

**What goes wrong:** Reordering past order adds items at old prices, causing checkout failure or price discrepancies.

**Why it happens:** Order items snapshot prices at order time. Product prices or dealer group discounts may have changed since original order.

**How to avoid:**
1. Always call `get_dealer_price()` function when loading order items into cart
2. Show price comparison if significantly different: "Was ₺100, now ₺90"
3. Validate cart prices server-side before checkout (already done in Phase 1)
4. Document in UI that prices are current, not historical

**Warning signs:**
- Users report price differences after reordering
- Checkout validation fails with "price mismatch" error
- Different prices shown in order history vs. catalog

**Source:** [B2B Shopping Cart Order Management Best Practices](https://www.practicalecommerce.com/common-b2b-mistakes-part-3-shopping-carts-order-management)

### Pitfall 5: Server-Side Filtering Without Indexes

**What goes wrong:** Admin order list loads slowly as order count grows, especially with date range or status filters.

**Why it happens:** Filtering on created_at, status_id, dealer_id without proper indexes causes sequential scans.

**How to avoid:**
1. Verify indexes exist (already created in Phase 1 schema):
   - `idx_orders_created_at` for date filtering
   - `idx_orders_status_id` for status filtering
   - `idx_orders_dealer_id` for dealer filtering
2. Use composite indexes for common filter combinations: `(dealer_id, created_at)`
3. Test queries with EXPLAIN ANALYZE to verify index usage
4. Monitor slow queries in Supabase Dashboard

**Warning signs:**
- Order list loads slowly (>2s) with 500+ orders
- EXPLAIN shows "Seq Scan" instead of "Index Scan"
- Database CPU spikes when loading admin order page
- Supabase slow query logs show order queries

**Source:** [Supabase Query Optimization](https://supabase.com/docs/guides/database/query-optimization)

### Pitfall 6: Frequent Purchase Calculation Without Caching

**What goes wrong:** Quick order form takes 5+ seconds to load "frequently purchased products" by querying full order history each time.

**Why it happens:** Aggregating order items grouped by product across all dealer orders is computationally expensive without optimization.

**How to avoid:**
1. Create materialized view refreshed daily for frequent products:
   ```sql
   CREATE MATERIALIZED VIEW dealer_frequent_products AS
   SELECT
     dealer_id,
     product_id,
     COUNT(*) as order_count,
     SUM(quantity) as total_quantity
   FROM order_items oi
   JOIN orders o ON o.id = oi.order_id
   WHERE o.created_at > NOW() - INTERVAL '90 days'
   GROUP BY dealer_id, product_id;

   CREATE INDEX idx_frequent_products_dealer ON dealer_frequent_products(dealer_id);
   ```
2. Refresh nightly via cron job or database schedule
3. Alternatively, cache in Zustand store with 1-hour expiry
4. Limit query to last 90 days and top 20 products

**Warning signs:**
- Quick order page loads slowly
- Database query time >1s for frequent products
- Users complain about performance
- Database load increases during business hours

**Source:** [PostgreSQL Materialized Views](https://www.postgresql.org/docs/current/sql-creatematerializedview.html)

### Pitfall 7: Not Validating Status Transitions

**What goes wrong:** Admin changes order from 'delivered' back to 'pending', creating invalid state and breaking business logic.

**Why it happens:** Status update action doesn't check if transition is valid according to order_status_transitions table.

**How to avoid:**
1. Call `validate_order_status_transition()` function (already created in Phase 1 schema) before updating status
2. Return error if transition invalid: "Cannot change from delivered to pending"
3. Show only valid next statuses in status dropdown (query order_status_transitions)
4. Document valid transitions in admin UI (tooltip or help text)

**Warning signs:**
- Order status changes that shouldn't be allowed
- Business logic breaks (e.g., shipped order marked pending)
- Audit logs show nonsensical status progression
- Customer complaints about incorrect order status

**Source:** [State Machine Best Practices](https://docs.commercetools.com/learning-model-your-business-structure/state-machines/states-and-best-practices)

## Code Examples

Verified patterns from official sources:

### Realtime Subscription with Cleanup

```typescript
// hooks/use-order-status-subscription.ts
'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function useOrderStatusSubscription(orderId: string) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        async (payload) => {
          // Fetch new status name
          const { data: status } = await supabase
            .from('order_statuses')
            .select('name')
            .eq('id', payload.new.status_id)
            .single()

          if (status) {
            toast.success(`Sipariş durumu: ${status.name}`)
          }

          // Refresh page data
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId, supabase, router])
}
```

**Source:** [Supabase Realtime Getting Started](https://supabase.com/docs/guides/realtime/getting_started)

### Server Action for Status Update with Validation

```typescript
// lib/actions/orders.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateOrderStatus(
  orderId: string,
  newStatusId: string,
  notes?: string
) {
  const supabase = await createClient()

  // Check authentication and admin role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Oturum açmanız gerekli' }
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userProfile?.role !== 'admin') {
    return { error: 'Bu işlem için yetkiniz yok' }
  }

  // Validate transition
  const { data: isValid } = await supabase
    .rpc('validate_order_status_transition', {
      p_order_id: orderId,
      p_new_status_id: newStatusId,
    })

  if (!isValid) {
    return { error: 'Geçersiz durum değişikliği' }
  }

  // Update order status
  const { error: updateError } = await supabase
    .from('orders')
    .update({ status_id: newStatusId })
    .eq('id', orderId)

  if (updateError) {
    return { error: 'Durum güncellenirken hata oluştu' }
  }

  // Optionally add notes to status history (trigger handles base history)
  if (notes) {
    await supabase
      .from('order_status_history')
      .update({ notes })
      .eq('order_id', orderId)
      .eq('status_id', newStatusId)
      .order('created_at', { ascending: false })
      .limit(1)
  }

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)

  return { success: true }
}
```

**Source:** [Next.js Server Actions Pattern](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)

### Frequent Products Query

```typescript
// lib/queries/orders.ts
import { createClient } from '@/lib/supabase/server'

export async function getFrequentProducts(dealerId: string, limit = 10) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('order_items')
    .select(`
      product_id,
      product_code,
      product_name,
      quantity
    `)
    .in('order_id',
      supabase
        .from('orders')
        .select('id')
        .eq('dealer_id', dealerId)
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    )

  if (error) throw error

  // Group by product and sum quantities
  const productMap = new Map<string, {
    product_id: string
    product_code: string
    product_name: string
    total_quantity: number
    order_count: number
  }>()

  data?.forEach(item => {
    const existing = productMap.get(item.product_id)
    if (existing) {
      existing.total_quantity += item.quantity
      existing.order_count += 1
    } else {
      productMap.set(item.product_id, {
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        total_quantity: item.quantity,
        order_count: 1,
      })
    }
  })

  // Sort by order count and return top N
  return Array.from(productMap.values())
    .sort((a, b) => b.order_count - a.order_count)
    .slice(0, limit)
}
```

**Source:** [Supabase Querying Best Practices](https://supabase.com/docs/guides/database/joins-and-nesting)

### Turkish Date Formatting

```typescript
// lib/utils/dates.ts
import { formatDistanceToNow, format } from 'date-fns'
import { tr } from 'date-fns/locale'

export function formatOrderDate(date: string | Date) {
  return format(new Date(date), 'dd MMMM yyyy, HH:mm', { locale: tr })
}

export function formatRelativeTime(date: string | Date) {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: tr,
  })
}

// Usage:
// formatOrderDate('2026-01-27T10:30:00Z') → "27 Ocak 2026, 10:30"
// formatRelativeTime('2026-01-27T10:30:00Z') → "2 saat önce"
```

**Source:** [date-fns i18n Documentation](https://github.com/date-fns/date-fns/blob/main/docs/i18n.md)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for updates (setInterval) | Supabase Realtime postgres_changes | Supabase GA 2021 | Real-time updates, lower DB load, better UX |
| Application-level status history | Database triggers | PostgreSQL 8.4+ | Automatic audit trail, can't be bypassed |
| Custom toast component | sonner | 2023 (Emil Kowalski) | Cleaner API, better animations, smaller bundle |
| Client-side order filtering | Server-side with URL params | TanStack Table v8 | Shareable URLs, handles 1000+ orders, SEO |
| Custom timeline components | shadcn/ui timeline patterns | 2024-2025 | Accessible, responsive, copy-paste ownership |
| Manual price recalculation | Database function (get_dealer_price) | Phase 1 decision | Consistent pricing, single source of truth |

**Deprecated/outdated:**
- **Polling for real-time updates**: Use Supabase Realtime for instant updates with RLS support
- **Application-level audit logging**: Use database triggers for reliable, automatic audit trails
- **Client-side filtering for large datasets**: Use server-side filtering with URL params for performance and shareability

## Open Questions

Things that couldn't be fully resolved:

1. **Realtime performance with 50+ concurrent dealer subscriptions**
   - What we know: Single-threaded processing, RLS checks per user, indexing required
   - What's unclear: Exact breaking point for order count + concurrent users combination
   - Recommendation: Monitor in production, prepare fallback to polling if latency >2s, consider materialized views for frequently accessed data

2. **Frequent products calculation optimal refresh interval**
   - What we know: Can use materialized view refreshed periodically, or query on-demand with caching
   - What's unclear: Best balance between data freshness and performance for this use case
   - Recommendation: Start with daily refresh materialized view, adjust based on user feedback and query performance metrics

3. **CSV bulk upload for quick order**
   - What we know: B2B platforms often support CSV upload for bulk ordering
   - What's unclear: Whether this is needed for MVP or can be deferred to later phase
   - Recommendation: Implement SKU-based quick order form first, add CSV upload in Phase 3 if requested

4. **Order cancellation workflow**
   - What we know: Requirement AORD-04 allows admin to cancel orders
   - What's unclear: Can dealers cancel their own orders? What status transitions allow cancellation? Should cancellation restore stock?
   - Recommendation: Only allow cancellation from 'pending' or 'confirmed' statuses, admin-only for now, document in status transitions table

5. **Notification preference management**
   - What we know: Dealers receive realtime notifications for order status changes
   - What's unclear: Should dealers be able to disable/configure notification types?
   - Recommendation: All notifications on by default for MVP, add preference management in later phase if users request it

## Sources

### Primary (HIGH confidence)

- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) - Subscription patterns, RLS filtering, performance
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization) - RLS policies, supabase_realtime role permissions
- [shadcn/ui Sonner Component](https://ui.shadcn.com/docs/components/sonner) - Toast notification setup and usage
- [date-fns i18n Documentation](https://github.com/date-fns/date-fns/blob/main/docs/i18n.md) - Turkish locale support
- [TanStack Table Column Filtering Guide](https://tanstack.com/table/latest/docs/guide/column-filtering) - Server-side filtering patterns
- [PostgreSQL Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html) - Trigger implementation for audit trails
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) - Server action patterns

### Secondary (MEDIUM confidence)

- [TanStack Table Server-Side Guide](https://medium.com/@clee080/how-to-do-server-side-pagination-column-filtering-and-sorting-with-tanstack-react-table-and-react-7400a5604ff2) - Implementation patterns
- [Supabase Realtime RLS Issues](https://www.technetexperts.com/realtime-rls-solved/) - Common setup problems
- [PostgreSQL Trigger-Based Audit Log](https://medium.com/israeli-tech-radar/postgresql-trigger-based-audit-log-fd9d9d5e412c) - Audit trail patterns
- [Working with Postgres Audit Triggers](https://www.enterprisedb.com/postgres-tutorials/working-postgres-audit-triggers) - Best practices
- [Shopify Order History Guide](https://www.shopify.com/blog/order-history-why-keeping-track-of-customers-previous-orders-can-help-you-make-more-sales) - Reorder UX patterns
- [B2B Shopping Cart Best Practices](https://www.practicalecommerce.com/common-b2b-mistakes-part-3-shopping-carts-order-management) - Order management patterns
- [B2B Order Management Tools](https://www.bigcommerce.com/articles/b2b-ecommerce/b2b-order-management/) - Quick order features
- [Shadcn Timeline Template](https://www.shadcn.io/template/timdehof-shadcn-timeline) - Timeline UI component
- [Material UI Timeline](https://mui.com/material-ui/react-timeline/) - Timeline patterns
- [Supabase Realtime Cleanup Issues](https://github.com/orgs/supabase/discussions/8573) - React subscription cleanup
- [State Machine Best Practices](https://docs.commercetools.com/learning-model-your-business-structure/state-machines/states-and-best-practices) - Status transition validation

### Tertiary (LOW confidence - requires validation)

- Various Medium articles on TanStack Table server-side patterns
- GitHub discussions on Realtime subscription patterns
- Community tutorials for order management UX

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All libraries already installed in Phase 1, official docs verified
- Architecture: **HIGH** - Supabase Realtime official patterns, database triggers are PostgreSQL standard
- Pitfalls: **HIGH** - Common issues documented in official troubleshooting, community consensus on solutions

**Research date:** 2026-01-27
**Valid until:** 2026-04-27 (90 days - Supabase Realtime stable, minimal breaking changes expected)

**Key technology versions researched:**
- @supabase/supabase-js: 2.91.1+ (Realtime stable)
- sonner: 2.0.7+ (already installed)
- date-fns: 4.1.0+ (Turkish locale verified)
- TanStack Table: v8 (from Phase 1)
- PostgreSQL: 15+ via Supabase (trigger support)

**Notes for planner:**
- All core dependencies already installed from Phase 1
- Supabase Realtime requires database-level permissions (GRANT SELECT)
- Database trigger for status history is CRITICAL for audit compliance
- Server-side filtering essential for admin with 1000+ orders
- Turkish locale support confirmed in date-fns
- Reorder pattern must recalculate current prices, not use historical
- Quick order form follows B2B best practices (SKU search, bulk add)
