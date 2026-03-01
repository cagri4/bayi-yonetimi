---
phase: 06-dashboard-campaigns-docs
plan: "03"
subsystem: campaigns-announcements
tags: [campaigns, announcements, dealer, admin, read-receipts]
dependency_graph:
  requires: ["06-01"]
  provides: ["campaigns-dealer-browsing", "campaigns-admin-crud", "announcements-dealer-browsing", "announcements-read-receipts", "announcements-admin-crud"]
  affects: ["dealer-layout", "admin-layout"]
tech_stack:
  added: []
  patterns: ["server-actions", "useOptimistic", "useTransition", "soft-delete"]
key_files:
  created:
    - src/lib/actions/campaigns.ts
    - src/lib/actions/announcements.ts
    - src/components/campaigns/campaign-card.tsx
    - src/components/campaigns/campaign-list.tsx
    - src/components/campaigns/campaign-product-card.tsx
    - src/components/announcements/announcement-card.tsx
    - src/components/announcements/announcement-list.tsx
    - src/app/(dealer)/campaigns/page.tsx
    - src/app/(dealer)/campaigns/[id]/page.tsx
    - src/app/(dealer)/announcements/page.tsx
    - src/app/(admin)/admin/campaigns/page.tsx
    - src/app/(admin)/admin/campaigns/new/page.tsx
    - src/app/(admin)/admin/campaigns/[id]/edit/page.tsx
    - src/app/(admin)/admin/announcements/page.tsx
    - src/components/admin/campaign-form.tsx
    - src/components/admin/campaign-table.tsx
    - src/components/admin/announcement-manager.tsx
  modified:
    - src/components/layout/nav-links.tsx
    - src/app/(admin)/layout.tsx
decisions:
  - "Soft delete for campaigns and announcements (set is_active=false) to preserve history"
  - "useOptimistic for announcement read-state to provide instant UI feedback"
  - "ON CONFLICT DO NOTHING pattern for announcement read receipts prevents duplicate inserts"
  - "Campaign product pricing uses dealer group discount + custom dealer_prices override"
metrics:
  duration: "~5 min (verification only - files pre-committed in 15c5f77)"
  completed: "2026-03-01"
  tasks_completed: 3
  files_created: 17
  files_modified: 2
---

# Phase 06 Plan 03: Campaigns and Announcements System Summary

**One-liner:** Full campaigns and announcements system with dealer browsing, optimistic read receipts, and admin CRUD using Dialog modals and campaign-product linking.

## What Was Built

Complete campaigns and announcements feature set for both dealer and admin roles:

**Campaigns (Dealer side):**
- `/campaigns` — Grid of active campaigns with image, dates, status badge
- `/campaigns/[id]` — Campaign detail with description, product grid with dealer-specific pricing, add-to-cart per product

**Campaigns (Admin side):**
- `/admin/campaigns` — Table of all campaigns (active/inactive) with edit and soft-delete
- `/admin/campaigns/new` — Create form with title, description, image URL, date range, active toggle
- `/admin/campaigns/[id]/edit` — Edit existing campaign, pre-filled form

**Announcements (Dealer side):**
- `/announcements` — List with unread count badge, visual distinction (highlighted border/background), click-to-read with `useOptimistic` for instant UI response
- "Tümünü Okundu İşaretle" bulk-read button

**Announcements (Admin side):**
- `/admin/announcements` — Table + Dialog modal for create/edit inline, priority labels (Acil/Önemli/Normal), publish and expiry dates

**Navigation:**
- Dealer nav-links.tsx: Kampanyalar (Megaphone icon) + Duyurular (Bell icon)
- Admin layout.tsx: Kampanyalar + Duyurular links already present

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Soft delete (is_active=false) | Preserve data history, allow reactivation |
| `useOptimistic` for read state | Instant UI feedback without server round-trip |
| ON CONFLICT DO NOTHING | Idempotent read receipt inserts |
| Dialog modal for announcements admin | Simpler UX than separate pages for simple text-only CRUD |
| Separate campaign-product pricing | Dealer group discount + custom price override pattern matches existing catalog |

## Key Patterns

**Announcement read receipt optimistic update:**
```tsx
const [optimisticRead, setOptimisticRead] = useOptimistic(
  announcement.is_read,
  (state, newState: boolean) => newState
)
```

**Dealer pricing in campaigns:**
```ts
const dealerPrice = customPrice !== undefined
  ? customPrice
  : product.base_price * (1 - discountPercent / 100)
```

## Verification Results

- TypeScript: `npx tsc --noEmit` — zero errors
- Build: `npm run build` — 30 pages, all routes compiled successfully
- Routes verified: `/campaigns`, `/campaigns/[id]`, `/announcements`, `/admin/campaigns`, `/admin/campaigns/new`, `/admin/campaigns/[id]/edit`, `/admin/announcements`
- Nav links: Kampanyalar + Duyurular present in both dealer nav-links.tsx and admin layout.tsx
- All 18 required files found and validated

## Deviations from Plan

None - plan executed exactly as written. All files were pre-committed in commit `15c5f77` as part of the Phase 6 bulk implementation. Verification confirmed all files correct, TypeScript clean, build passing.

## Self-Check: PASSED

All files found:
- FOUND: src/lib/actions/campaigns.ts (368 lines)
- FOUND: src/lib/actions/announcements.ts (340 lines)
- FOUND: src/components/campaigns/campaign-card.tsx
- FOUND: src/components/campaigns/campaign-list.tsx
- FOUND: src/components/campaigns/campaign-product-card.tsx
- FOUND: src/components/announcements/announcement-card.tsx
- FOUND: src/components/announcements/announcement-list.tsx
- FOUND: src/app/(dealer)/campaigns/page.tsx
- FOUND: src/app/(dealer)/campaigns/[id]/page.tsx
- FOUND: src/app/(dealer)/announcements/page.tsx
- FOUND: src/app/(admin)/admin/campaigns/page.tsx
- FOUND: src/app/(admin)/admin/campaigns/new/page.tsx
- FOUND: src/app/(admin)/admin/campaigns/[id]/edit/page.tsx
- FOUND: src/app/(admin)/admin/announcements/page.tsx
- FOUND: src/components/admin/campaign-form.tsx
- FOUND: src/components/admin/campaign-table.tsx
- FOUND: src/components/admin/announcement-manager.tsx
- FOUND: src/components/layout/nav-links.tsx

Key exports verified:
- campaigns.ts: getActiveCampaigns, getCampaignDetail, createCampaign, updateCampaign, deleteCampaign
- announcements.ts: getAnnouncements, markAnnouncementAsRead, markAllAnnouncementsAsRead, createAnnouncement, updateAnnouncement, deleteAnnouncement

Commit reference: 15c5f77 (feat(06): add Phase 6 dashboard, campaigns, announcements, order docs)
