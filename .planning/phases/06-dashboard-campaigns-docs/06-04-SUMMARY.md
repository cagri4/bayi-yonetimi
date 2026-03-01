---
phase: "06"
plan: "04"
subsystem: "order-documents"
tags: ["order-docs", "file-upload", "cargo-tracking", "supabase-storage", "pdf", "signed-url"]
dependency_graph:
  requires: ["06-01 (schema - order_documents table, cargo columns on orders)"]
  provides: ["order document upload/download", "cargo tracking display"]
  affects: ["admin/orders/[id]", "dealer/orders/[id]"]
tech_stack:
  added: []
  patterns: ["Supabase Storage signed URLs", "optimistic UI on upload/delete", "parallel data fetching with Promise.all"]
key_files:
  created:
    - src/components/admin/orders/document-upload.tsx
    - src/components/admin/orders/cargo-form.tsx
    - src/components/orders/order-documents.tsx
    - src/components/orders/cargo-info.tsx
  modified:
    - src/app/(admin)/admin/orders/[id]/page.tsx
    - src/app/(dealer)/orders/[id]/page.tsx
decisions:
  - "Optimistic UI for document upload/delete — list updates immediately without waiting for page revalidation"
  - "CargoInfo is a pure server component (no interactivity); OrderDocuments is client component (download triggers JS)"
  - "cargo-info.tsx returns null render (empty state card) when no cargo data set — matches plan intent"
  - "Document download uses anchor tag with download attribute targeting Supabase signed URL, opens in new tab"
metrics:
  duration: "21 minutes"
  completed: "2026-03-01"
  tasks_completed: 6
  files_created: 4
  files_modified: 2
---

# Phase 06 Plan 04: Order Documents & Cargo Tracking Summary

**One-liner:** PDF invoice/irsaliye upload with signed-URL download and cargo tracking (vehicle plate, driver info) integrated into admin and dealer order detail pages.

## What Was Built

### Admin Components

**`src/components/admin/orders/document-upload.tsx`** — Client component
- Document type selector (Fatura / Irsaliye) via shadcn Select
- Native file input accepting `.pdf` only
- Upload calls `uploadOrderDocument` server action with FormData
- Optimistic list update after successful upload (no page reload)
- Delete button per document calls `deleteOrderDocument` with loading state
- File size display (B / KB / MB formatting)
- Upload date display in Turkish locale

**`src/components/admin/orders/cargo-form.tsx`** — Client component
- Fields: Arac Plakasi, Sofor Adi, Sofor Telefonu, Kargo Notu
- Vehicle plate auto-uppercased on input
- Calls `updateCargoInfo` server action on submit
- Success feedback with 3-second auto-dismiss
- Pre-populated from `initialCargoInfo` prop

### Dealer Components

**`src/components/orders/order-documents.tsx`** — Client component
- Lists documents with type label, date, file size
- Download button fetches signed URL via `getDocumentDownloadUrl` then triggers browser download
- Loading state per document during URL fetch
- Empty state card when no documents exist

**`src/components/orders/cargo-info.tsx`** — Server component (no interactivity)
- Displays vehicle plate in monospace font
- Driver phone as clickable `tel:` link
- Shows empty state card when cargoInfo is null
- Conditionally renders each field only when set

### Page Updates

**Admin `/admin/orders/[id]`:** Added `getOrderDocuments` and `getCargoInfo` to parallel `Promise.all` fetch, rendered `DocumentUpload` and `CargoForm` in main content column after Status Update card.

**Dealer `/orders/[id]`:** Added `getOrderDocuments` and `getCargoInfo` to parallel `Promise.all` fetch, rendered `OrderDocuments` and `CargoInfo` in main content column after Order Notes card.

## Verification

- `npx tsc --noEmit` passed with zero errors
- All 4 new files created, 2 pages updated
- All imports from `@/lib/actions/order-docs` are valid (types + functions)
- No new dependencies added

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: src/components/admin/orders/document-upload.tsx
- FOUND: src/components/admin/orders/cargo-form.tsx
- FOUND: src/components/orders/order-documents.tsx
- FOUND: src/components/orders/cargo-info.tsx

Commits verified:
- FOUND: 1fd70a0 feat(06-04): create admin document upload and cargo form components
- FOUND: 3926bd8 feat(06-04): create dealer order-documents and cargo-info components
- FOUND: da60032 feat(06-04): add document upload and cargo form to admin order detail page
- FOUND: 853f949 feat(06-04): add order documents and cargo info to dealer order detail page
