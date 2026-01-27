---
phase: 02
plan: 01
subsystem: order-management
tags: [realtime, supabase, orders, dealer-portal]

dependency-graph:
  requires: [01-foundation-basic-ordering]
  provides: [dealer-order-list, dealer-order-detail, realtime-updates, status-timeline]
  affects: [02-02-admin-orders, 02-03-quick-order]

tech-stack:
  added: []
  patterns: [supabase-realtime, postgres-triggers, react-strict-mode-safe-hooks]

file-tracking:
  key-files:
    created:
      - supabase/migrations/002_realtime_setup.sql
      - src/hooks/use-order-realtime.ts
      - src/components/orders/order-status-badge.tsx
      - src/components/orders/order-status-timeline.tsx
      - src/app/(dealer)/orders/page.tsx
      - src/app/(dealer)/orders/[id]/page.tsx
      - src/app/(dealer)/orders/[id]/order-realtime-wrapper.tsx
    modified:
      - src/app/(dealer)/layout.tsx
      - src/lib/actions/admin-orders.ts

decisions:
  - id: realtime-cleanup
    choice: useRef for channel storage
    reason: Handles React Strict Mode double-mount safely
  - id: status-badge-colors
    choice: Custom className overrides for Badge component
    reason: shadcn Badge lacks success variant, need green for delivered status
  - id: timeline-sort
    choice: Sort history ascending by created_at
    reason: Natural chronological order for status progression

metrics:
  duration: 17min
  completed: 2026-01-27
---

# Phase 02 Plan 01: Dealer Order History & Realtime Tracking Summary

Supabase Realtime postgres_changes subscriptions with database trigger for automatic status history tracking

## What Was Built

### Database Layer
- **002_realtime_setup.sql migration**: Database trigger `track_order_status_change()` that automatically inserts order_status_history entries on order creation or status changes. Uses SECURITY DEFINER to capture auth.uid(). Turkish notes for audit trail.
- **Realtime permissions**: GRANT SELECT to supabase_realtime role on orders, order_status_history, order_statuses tables
- **Realtime publication**: Added orders and order_status_history to supabase_realtime publication

### React Hooks & Components
- **useOrderRealtime hook**: Subscribes to postgres_changes on orders table filtered by order ID. Handles React Strict Mode with channelRef. Shows toast notification with status name on updates. Proper cleanup with removeChannel.
- **OrderStatusBadge**: Color-coded badge component for order status display (pending/gray, confirmed/blue, preparing/yellow, shipped/indigo, delivered/green, cancelled/red)
- **OrderStatusTimeline**: Vertical timeline with lucide-react icons showing status progression. Uses date-fns formatDistanceToNow with Turkish locale.

### Dealer Pages
- **Orders List Page** (`/orders`): Server component using getDealerOrders(), table with order number, date (Turkish locale), status badge, total, and detail link. Empty state handling.
- **Order Detail Page** (`/orders/[id]`): Server component fetching order with items, status, and history. Shows order items table with quantities and prices, totals breakdown, notes section, and status timeline. Client wrapper for Realtime subscription with live indicator.
- **Navigation update**: Added "Siparislerim" link to dealer layout navbar

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript types in admin-orders.ts**
- **Found during:** Task 2 verification
- **Issue:** Supabase query results typed as `never` due to missing type assertions
- **Fix:** Added explicit type assertions for userProfile, historyEntry, order, and transitions
- **Files modified:** src/lib/actions/admin-orders.ts
- **Commit:** 073cdef (auto-committed during build check)

**2. [Rule 1 - Bug] Fixed TypeScript spread operator in admin order detail**
- **Found during:** Task 3 build verification
- **Issue:** `Spread types may only be created from object types` error on line 125
- **Fix:** Replaced spread with explicit property assignment after type assertion
- **Files modified:** src/app/(admin)/admin/orders/[id]/page.tsx
- **Commit:** a91c29a (included in Task 3 commit)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| cee45c0 | feat | Database trigger and Realtime permissions |
| 7b7db5b | feat | Realtime hook and order status components |
| a91c29a | feat | Dealer order list and detail pages |

## Technical Notes

### Realtime Subscription Pattern
The useOrderRealtime hook follows Supabase best practices:
1. Store channel in useRef to handle Strict Mode
2. Filter subscription by specific order ID (not entire table)
3. Cleanup with supabase.removeChannel on unmount
4. Fetch status name separately for toast message

### Database Trigger Design
The trigger uses SECURITY DEFINER to access auth.uid() inside the trigger function. This captures the actual user who made the status change, not a service account.

### Status Timeline Logic
Timeline sorts history ascending and determines icon based on:
- Completed: status index < current index (CheckCircle2, green)
- Current: matching current status (Clock, blue)
- Cancelled: special case (Circle, red)

## Verification Results

All success criteria verified:
- [x] Dealer can navigate to /orders and see order list
- [x] Dealer can click order to see full details with items and history
- [x] OrderStatusBadge shows correct colors for different statuses
- [x] OrderStatusTimeline displays chronological status changes
- [x] useOrderRealtime hook subscribes with proper cleanup
- [x] Migration file ready for manual application

## Next Phase Readiness

Ready for 02-02 (Admin Order Management). The realtime infrastructure and status components can be reused for admin order detail pages.

**Dependencies provided:**
- Database trigger will auto-create history entries when admin changes status
- OrderStatusBadge and OrderStatusTimeline components available for admin UI
- Admin order actions already created (getAdminOrders, updateOrderStatus, cancelOrder, getValidNextStatuses)
