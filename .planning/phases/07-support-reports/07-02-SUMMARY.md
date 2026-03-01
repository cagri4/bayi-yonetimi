---
phase: 07-support-reports
plan: 02
subsystem: support-ui
tags: [support, messaging, faq, product-requests, realtime, server-actions, dealer-pages, admin-pages]
dependency_graph:
  requires: [07-01-database-schema]
  provides: [support dealer pages, support admin pages, realtime admin notifications, FAQ management UI]
  affects: [nav-links, admin-layout]
tech_stack:
  added: []
  patterns: [server-actions-with-auth, use-transition-forms, realtime-hook-channelref, supabase-postgres-changes-insert]
key_files:
  created:
    - src/lib/actions/support.ts
    - src/hooks/use-support-realtime.ts
    - src/components/support/message-status-badge.tsx
    - src/components/support/message-list.tsx
    - src/components/support/message-compose-form.tsx
    - src/components/support/faq-category-list.tsx
    - src/components/support/product-request-form.tsx
    - src/components/admin/support/message-inbox.tsx
    - src/components/admin/support/message-thread.tsx
    - src/components/admin/support/faq-manager.tsx
    - src/app/(dealer)/support/page.tsx
    - src/app/(dealer)/support/faq/page.tsx
    - src/app/(dealer)/support/product-requests/page.tsx
    - src/app/(admin)/admin/support/page.tsx
    - src/app/(admin)/admin/support/[id]/page.tsx
    - src/app/(admin)/admin/support/faq/page.tsx
  modified:
    - src/components/layout/nav-links.tsx
    - src/app/(admin)/layout.tsx
decisions:
  - "Atomic replyToMessage UPDATE sets reply_body + replied_at + replied_by + status=answered in a single database call — avoids race condition from research pitfall 4"
  - "useSupportRealtime subscribes to INSERT only (admin only needs new message notifications, not updates)"
  - "FaqManager uses soft-delete (is_active=false) not hard DELETE — preserves data history"
  - "Admin layout updated directly (not via NavLinks component) because admin uses a different layout.tsx with hardcoded links"
  - "MessageInbox newMessageCount adds to initial pending count (server-rendered) for accurate badge without needing full re-render"
metrics:
  duration_seconds: 720
  completed_date: "2026-03-01"
  tasks_completed: 2
  files_created: 16
  files_modified: 2
---

# Phase 7 Plan 02: Support Messaging, FAQ, and Product Requests Summary

**One-liner:** Dealer support hub (3 pages) and admin support inbox (3 pages) with Supabase Realtime INSERT notifications, atomic reply Server Action, and accordion FAQ + product request CRUD.

## What Was Built

### Support Server Actions (`src/lib/actions/support.ts`)

Complete server-side data layer with 12 exported functions:

**Dealer mutations:**
- `sendSupportMessage(input)`: validates with zod, inserts to `support_messages` with `status='pending'`
- `submitProductRequest(input)`: validates with zod, inserts to `product_requests` with `status='open'`

**Dealer queries:**
- `getSupportMessages()`: returns dealer's own messages ordered by `created_at DESC`
- `getFaqWithCategories()`: returns active categories with active items (no auth required beyond session)
- `getDealerProductRequests()`: returns dealer's own product request history

**Admin queries:**
- `getAllSupportMessages()`: admin-only, joins `dealers(company_name)`, returns `SupportMessageWithDealer[]`
- `getSupportMessageById(id)`: admin-only, single message with dealer info

**Admin mutations:**
- `replyToMessage(messageId, replyBody)`: ATOMIC single UPDATE — sets `reply_body + replied_at + replied_by + status='answered'` together
- `createFaqCategory(name, displayOrder?)`: INSERT with `is_active=true`
- `createFaqItem(categoryId, question, answer, displayOrder?)`: INSERT
- `updateFaqItem(id, updates)`: UPDATE with `updated_at`
- `deleteFaqItem(id)`: SOFT DELETE via `is_active=false`

### Realtime Hook (`src/hooks/use-support-realtime.ts`)

Follows exact `use-order-realtime.ts` pattern with `channelRef` to prevent React Strict Mode double-subscription:
- Channel: `'admin-support-messages'`
- Event: `INSERT` only on `support_messages`
- On event: `toast.info('Yeni destek mesaji alindi')` + `setNewMessageCount(c => c + 1)` + `router.refresh()`
- Returns `{ newMessageCount }` for badge display

### Dealer Components

- **MessageStatusBadge**: amber for `pending` ("Bekliyor"), green for `answered` ("Cevaplandi")
- **MessageList**: collapsible card rows — click to expand body + reply block (blue left-border accent for replies)
- **MessageComposeForm**: `useTransition` + sonner toast, 5-option category Select, form reset on success
- **FaqCategoryList**: accordion via `useState` per item — one Card per category, Q&A toggle rows
- **ProductRequestForm**: `product_name` (required), `product_code` (optional), `requested_quantity` number, `notes` textarea

### Dealer Pages

All 3 pages share a navigation tab bar (Mesajlarim / SSS / Urun Talebi):
- `/support` — MessageComposeForm + MessageList (Suspense-wrapped) in server component
- `/support/faq` — FaqCategoryList with accordion layout
- `/support/product-requests` — ProductRequestForm above request history with status badges

### Admin Components

- **MessageInbox** (`'use client'`): calls `useSupportRealtime()`, filter tabs (Tumu/Bekliyor/Cevaplandi), pending rows have `bg-amber-50` + bold text, links to `/admin/support/{id}`
- **MessageThread**: shows dealer name, category chip, original message, reply block (if answered), or inline ReplyForm (if pending)
- **FaqManager** (`'use client'`): category list with inline "Soru Ekle" / "Kategori Ekle" forms, per-item edit (inline textarea) and soft-delete buttons

### Admin Pages

- `/admin/support` — server component, passes `initialMessages` to MessageInbox, links to `/admin/support/faq`
- `/admin/support/[id]` — fetches by ID, redirects to `/admin/support` on not-found, renders MessageThread
- `/admin/support/faq` — fetches categories, renders FaqManager

### Navigation Updates

- **Dealer nav** (`nav-links.tsx`): added `{ href: '/support', label: 'Destek', icon: Headphones }` after Duyurular
- **Admin nav** (`layout.tsx`): added Destek link with `Headphones` icon after Duyurular

## Verification

- All 16 plan-specified files exist at correct paths
- `npx tsc --noEmit` exits 0 (no TypeScript errors)
- `support.ts` exports all 12 functions specified in plan: `sendSupportMessage`, `submitProductRequest`, `getSupportMessages`, `getFaqWithCategories`, `getDealerProductRequests`, `getAllSupportMessages`, `getSupportMessageById`, `replyToMessage`, `createFaqCategory`, `createFaqItem`, `updateFaqItem`, `deleteFaqItem`
- `use-support-realtime.ts` exports `useSupportRealtime` with `postgres_changes` subscription on `support_messages` INSERT
- `MessageInbox` uses `useSupportRealtime` hook (key_link verified)
- `sendSupportMessage` uses `from('support_messages')` insert (key_link verified)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 4bf46be | feat(07-02): create support Server Actions, realtime hook, and dealer pages |
| 2 | 8877a50 | feat(07-02): create admin support pages and update navigation |
| fix | 5bd85dd | feat(07-02): apply linter type import fixes in support components |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Export] Added FaqItem to support.ts re-export list**
- **Found during:** Task 2 TypeScript check
- **Issue:** `faq-manager.tsx` imported `FaqItem` from `@/lib/actions/support` but it was not in the re-export list
- **Fix:** Added `FaqItem` to the `export type { ... }` block in `support.ts`
- **Files modified:** `src/lib/actions/support.ts`
- **Commit:** 5bd85dd

The linter also auto-updated several component files to import types directly from `@/types/database.types` instead of via `@/lib/actions/support` re-exports (both paths are equivalent). No behavioral change.

## Self-Check: PASSED

- [x] All 16 files created at specified paths
- [x] `src/components/layout/nav-links.tsx` updated with Destek link
- [x] `src/app/(admin)/layout.tsx` updated with Destek link
- [x] Commits 4bf46be, 8877a50, 5bd85dd exist in git log
- [x] `npx tsc --noEmit` exits 0
- [x] `support.ts` contains `from('support_messages')` pattern (key_link requirement)
- [x] `use-support-realtime.ts` contains `postgres_changes.*support_messages` pattern (key_link requirement)
- [x] `message-inbox.tsx` contains `useSupportRealtime` import (key_link requirement)
