# Technology Stack Research - v2.0 Features

**Project:** B2B Dealer Order Management System (Bayi Yönetimi)
**Research Scope:** v2.0 milestone additions (Dashboard, Financial Tracking, Favorites, Campaigns, Support)
**Original Research:** 2026-01-25
**v2.0 Update:** 2026-02-08
**Current Stack:** Next.js 16.1.4 + Supabase (Auth, Database, Realtime, Storage) + Expo + Zustand + Recharts

---

## Executive Summary

**v2.0 requires MINIMAL stack additions** to the existing Next.js 14 + Supabase foundation. The current stack already provides most needed capabilities through Supabase's integrated services (Auth, Database, Realtime, Storage).

**Key Additions:**
1. **PDF Generation**: `@react-pdf/renderer` for invoices/reports (web only)
2. **UI Components**: Additional Radix UI primitives (accordion, tabs, popover)
3. **Mobile Documents**: `expo-document-picker` for file selection, WebView for PDF display
4. **Everything Else**: Leverage existing Supabase services (Realtime for messaging, Storage for files, Database for features)

**Philosophy:** Extend existing capabilities rather than introduce new platforms. Total new dependencies: 5 required + 2 optional.

---

## Current Stack (v1.0 - DO NOT CHANGE)

### Backend & Database
- **Supabase**: Auth, PostgreSQL Database, Realtime, Storage, Row Level Security
- **@supabase/ssr** (^0.8.0): Server-side Supabase client for Next.js
- **@supabase/supabase-js** (^2.91.1): JavaScript client library

### Frontend (Web)
- **Next.js** (16.1.4): App Router, Server Components, Server Actions
- **React** (19.2.3): UI library
- **TypeScript** (^5): Type safety throughout
- **Tailwind CSS** (^4): Utility-first styling
- **Radix UI**: Dialog, Select, Switch, Label, Slot (already installed)
- **Zustand** (^5.0.10): Client state management
- **React Hook Form** (^7.71.1): Form handling and validation
- **Recharts** (^2.15.4): Charts and data visualization
- **Sonner** (^2.0.7): Toast notifications
- **next-themes** (^0.4.6): Dark/light mode

### Frontend (Mobile)
- **Expo**: React Native development platform
- **Zustand**: State management (shared with web)

### Utilities
- **date-fns** (^4.1.0): Date manipulation
- **Zod** (^4.3.6): Schema validation
- **Lucide React** (^0.563.0): Icon library

---

## New Dependencies for v2.0

### PDF Generation (Web Only)

#### `@react-pdf/renderer` (^4.1.10) — REQUIRED
**Purpose:** Generate invoice PDFs and dealer reports server-side
**Why Needed:** v2.0 requires downloadable invoices (Finansal Bilgiler) and export reports (Bayi Raporları)
**Why This Library:**
- React-based declarative API (matches existing stack patterns)
- Works in Next.js App Router with Server Actions
- Fast rendering (lighter than Puppeteer, 1.2M weekly downloads)
- Compatible with Next.js 16 + React 19 (confirmed)

**Integration Pattern:**
```typescript
// app/api/invoices/[id]/pdf/route.ts
import { renderToBuffer } from '@react-pdf/renderer';

export async function GET(req, { params }) {
  const supabase = createClient();
  const { data: invoice } = await supabase
    .from('orders')
    .select('*, dealer:dealers(*), items:order_items(*)')
    .eq('id', params.id)
    .single();

  const pdfBuffer = await renderToBuffer(<InvoicePDF invoice={invoice} />);

  // Upload to Supabase Storage for archival
  await supabase.storage
    .from('invoices')
    .upload(`${params.id}.pdf`, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  return new Response(pdfBuffer, {
    headers: { 'Content-Type': 'application/pdf' }
  });
}
```

**Why Server-Side:**
- No client bundle bloat
- Always generates from current database data
- Can store PDFs in Supabase Storage for archival

**Alternative Rejected:** Puppeteer
- **Why NOT:** Large container (300MB+ with Chrome), high latency, overkill for structured invoices
- **When to Reconsider:** If business requires pixel-perfect HTML email templates as PDFs (not current requirement)

**Confidence:** HIGH — Proven with Next.js 16 + React 19, multiple production references

**Sources:**
- [react-pdf Official Documentation](https://react-pdf.org/compatibility)
- [Building a PDF generation service using Next.js and React PDF](https://03balogun.medium.com/building-a-pdf-generation-service-using-nextjs-and-react-pdf-78d5931a13c7)
- [Creating PDF in React/Next.js: A Complete Guide](https://dominikfrackowiak.com/en/blog/react-pdf-with-next-js)

---

### UI Component Extensions (Web Only)

#### Radix UI Accordion, Tabs, Popover, Collapsible — REQUIRED

**Already in Stack:** Dialog, Select, Switch, Label, Slot
**Add for v2.0:**

| Component | Version | Use Case in v2.0 |
|-----------|---------|------------------|
| `@radix-ui/react-accordion` | ^1.2.3 | FAQ section (Destek), financial details expansion (Finansal Bilgiler) |
| `@radix-ui/react-tabs` | ^1.2.5 | Dashboard section navigation, report view switching |
| `@radix-ui/react-popover` | ^1.2.8 | Help tooltips, quick action menus |
| `@radix-ui/react-collapsible` | ^1.2.4 | Campaign detail expansion (Kampanyalar) |

**Why Radix:**
- Already in stack (consistent patterns)
- Accessible by default (WAI-ARIA compliant)
- Unstyled (works with existing Tailwind setup)
- Small bundle size (~10KB total for all four)
- TypeScript-first

**Installation:**
```bash
npm install @radix-ui/react-accordion @radix-ui/react-tabs @radix-ui/react-popover @radix-ui/react-collapsible
```

**Confidence:** HIGH — Same library family already in use

**Sources:**
- [Radix Primitives - Accordion](https://www.radix-ui.com/primitives/docs/components/accordion)
- [Radix Primitives - Tabs](https://www.radix-ui.com/primitives/docs/components/tabs)
- [Building Low Level Components the Radix Way](https://alexkondov.com/building-low-level-components-the-radix-way/)

---

### Mobile Document Handling

#### `expo-document-picker` (^12.3.1) — REQUIRED
**Purpose:** Allow dealers to select and upload documents from mobile devices
**Use Cases:**
- Upload invoice documents (Sipariş Detayları)
- Attach files to support messages (Destek)

**Why This Library:**
- Official Expo SDK (well-maintained, consistent API)
- Cross-platform (iOS/Android)
- Works with Expo Go (no development build required)

**Critical Configuration:**
```typescript
import * as DocumentPicker from 'expo-document-picker';

const result = await DocumentPicker.getDocumentAsync({
  type: ['application/pdf', 'image/*'],
  copyToCacheDirectory: true, // MUST set to true for file access
});
```

**Integration with Supabase Storage:**
```typescript
if (result.type === 'success') {
  const file = new File([result.file], result.name);
  await supabase.storage
    .from('documents')
    .upload(`dealer/${userId}/${result.name}`, file);
}
```

**Confidence:** HIGH — Official Expo SDK, widely used

**Sources:**
- [Expo DocumentPicker Documentation](https://docs.expo.dev/versions/latest/sdk/document-picker/)
- [React Native File & Image Picker with Expo](https://medium.com/@YAGNIK09/react-native-file-image-picker-with-expo-documentpicker-imagepicker-camera-2b3699b3db99)

---

#### PDF Viewing on Mobile — NO NEW DEPENDENCY (Start with WebView)

**Recommended Approach for v2.0:** Use React Native WebView (already available in Expo)

```typescript
import { WebView } from 'react-native-webview';

// Display PDF using Google Docs Viewer
<WebView
  source={{ uri: `https://docs.google.com/viewer?url=${pdfUrl}` }}
/>
```

**Pros:**
- Zero new dependencies
- Works in Expo Go (no development build)
- Consistent with existing stack

**Cons:**
- Slower rendering than native
- Requires internet connection
- Limited offline support

**Alternative (DEFER TO PHASE 07 TESTING):** `react-native-pdf` (^7.0.3)

**Add ONLY if Phase 07 testing shows:**
- Dealers frequently access large PDFs (>5MB)
- Performance issues with WebView rendering
- Need offline PDF viewing

**Trade-offs of react-native-pdf:**
- Requires Expo development build (no longer works in Expo Go)
- Adds build complexity
- 80x faster rendering (native-backed)

**Recommendation:** START with WebView, add react-native-pdf ONLY if performance testing justifies complexity.

**Confidence:** MEDIUM — WebView approach solid but untested for this use case

**Sources:**
- [React Native PDF Viewer Guide](https://theappmarket.io/blog/react-native-pdf-viewer)
- [Handling PDF Links in WebView in React Native](https://medium.com/@valentyndanilichev/handling-pdf-links-in-webview-in-react-native-eecba9f18591)

---

## Leveraging Existing Stack (NO NEW DEPENDENCIES)

### Real-time Messaging (Destek Feature)

**Use:** Supabase Realtime (already in stack via `@supabase/supabase-js`)

**Why No New Dependency:**
- Supabase Realtime Postgres Changes already available
- Persistent messages (not ephemeral)
- RLS policies provide security
- WebSocket connection already established

**Implementation:**
```typescript
// Subscribe to new messages for dealer
const channel = supabase
  .channel(`support:dealer-${dealerId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `dealer_id=eq.${dealerId}`
  }, (payload) => {
    setMessages(prev => [...prev, payload.new]);
  })
  .subscribe();
```

**Data Model:**
```sql
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id uuid REFERENCES dealers(id),
  sender_type text CHECK (sender_type IN ('dealer', 'admin')),
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- RLS: Dealers see only their messages
CREATE POLICY "Dealers view own messages"
  ON messages FOR SELECT
  USING (dealer_id = auth.uid());
```

**Why NOT Separate Chat Service (SendBird, Stream Chat):**
- Adds external dependency and cost
- Over-engineered for dealer support (not consumer chat)
- Supabase Realtime provides needed capabilities

**When to Reconsider:** Message volume >10K/day or need advanced features (typing indicators, reactions, threads)

**Confidence:** HIGH — Supabase Realtime well-documented, proven for chat use cases

**Sources:**
- [Supabase Realtime Chat Documentation](https://supabase.com/ui/docs/nextjs/realtime-chat)
- [Realtime Chat With Supabase](https://blog.stackademic.com/realtime-chat-with-supabase-realtime-is-supa-easy-091c96411afd)

---

### File Upload/Download (Sipariş Detayları, Destek)

**Use:** Supabase Storage (already in stack)

**Capabilities Already Available:**
- File upload/download
- Authenticated access via RLS policies
- Public/private buckets
- Signed upload URLs (bypasses Next.js 1MB body limit)

**Web Upload Pattern:**
```typescript
// Server Action for signed URL (files >1MB)
'use server'
export async function getUploadUrl(fileName: string) {
  const supabase = createClient();
  const { data } = await supabase.storage
    .from('documents')
    .createSignedUploadUrl(`dealer/${userId}/${fileName}`);
  return data?.signedUrl; // Expires in 2 hours
}

// Client upload
const uploadFile = async (file: File) => {
  const signedUrl = await getUploadUrl(file.name);
  await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type }
  });
};
```

**Security via RLS:**
```sql
-- Dealers upload only to their own folder
CREATE POLICY "Dealers upload own files"
  ON storage.objects FOR INSERT
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Dealers download only their files
CREATE POLICY "Dealers download own files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
```

**File Validation (Use Existing React Hook Form):**
```typescript
<input
  type="file"
  {...register('file', {
    validate: {
      fileType: (value) => {
        const allowed = ['application/pdf', 'image/png', 'image/jpeg'];
        return allowed.includes(value?.[0]?.type) || 'Only PDF, PNG, JPG allowed';
      },
      fileSize: (value) => {
        const maxSize = 10 * 1024 * 1024; // 10MB
        return value?.[0]?.size <= maxSize || 'File must be under 10MB';
      }
    }
  })}
/>
```

**Best Practices:**
- Server-side validation MANDATORY (client validation can be bypassed)
- Enforce 10MB max on web, 5MB on mobile (network considerations)
- Allowed types: PDF, PNG, JPG
- Use signed URLs for files >1MB (Next.js Server Action body limit workaround)

**Confidence:** HIGH — Supabase Storage well-documented, proven solution

**Sources:**
- [Complete Guide to File Uploads with Next.js and Supabase Storage](https://supalaunch.com/blog/file-upload-nextjs-supabase)
- [Signed URL file uploads with Next.js and Supabase](https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0)
- [React Hook Form: Working with Multipart Form Data](https://claritydev.net/blog/react-hook-form-multipart-form-data-file-uploads)

---

### Dashboard Widgets & Charts (Bayi Dashboard)

**Use:** Recharts (^2.15.4 — already in stack)

**Coverage:**
- Spending trends → `LineChart` (already used in v1 admin reporting)
- Category breakdown → `PieChart`
- Monthly comparison → `BarChart`

**No New Dependencies Needed.**

**State Management:** Use Zustand (already in stack) for dashboard state (date range, filters)

**Confidence:** HIGH — Recharts already proven in v1

---

### Toast Notifications (All Features)

**Use:** Sonner (^2.0.7 — already in stack)

**Coverage in v2.0:**
- File upload success/errors
- Campaign notifications
- Order status updates
- Support message notifications

**Why NOT Add React-Toastify:**
- Sonner already provides what's needed
- 2-3KB vs 16KB for React-Toastify
- Modern API, dark/light mode support
- 11.5K GitHub stars, 7M weekly downloads

**Confidence:** HIGH — Sonner sufficient for all v2.0 notification needs

**Sources:**
- [Comparing the top React toast libraries [2025 update]](https://blog.logrocket.com/react-toast-libraries-compared-2025/)
- [Sonner vs. Toast: A Deep Dive](https://www.oreateai.com/blog/sonner-vs-toast-a-deep-dive-into-react-notification-libraries/4596cec74c442a27834f2ec4b53b8eb2)

---

## Optional Dependencies (Defer to Phase Testing)

### `react-dropzone` (^14.3.5) — OPTIONAL

**Purpose:** Drag-and-drop file upload UI
**Use Case:** Dealer document uploads (if native input UX is insufficient)

**Why Defer:**
- Native file input with React Hook Form is simpler
- One less dependency (bundle size matters on mobile)
- Can add later if UX testing shows dealers struggle

**Add ONLY if Phase 07 testing shows:**
- Dealers confused by native file input
- High support tickets about file uploads
- Multiple file uploads needed frequently

**Integration (if added):**
```typescript
import { useDropzone } from 'react-dropzone';

const { getRootProps, getInputProps } = useDropzone({
  accept: { 'application/pdf': ['.pdf'] },
  maxSize: 10 * 1024 * 1024,
  onDrop: (files) => handleUpload(files)
});
```

**Confidence:** LOW (not yet validated as necessary)

---

### `react-native-pdf` (^7.0.3) — OPTIONAL

**Purpose:** Native PDF rendering on mobile
**Use Case:** If WebView PDF performance is poor

**Why Defer:**
- Requires Expo development build (no longer works in Expo Go)
- Adds build complexity
- WebView approach simpler for MVP

**Add ONLY if Phase 07 testing shows:**
- Slow WebView rendering with large PDFs (>5MB)
- Dealers frequently view PDFs offline
- Performance issues impact user experience

**Confidence:** LOW (WebView approach untested but likely sufficient)

---

## What NOT to Add

### ❌ Puppeteer
**Why Avoid:** Large container (300MB+ Chrome), high latency, overkill for invoices
**When to Reconsider:** Need pixel-perfect HTML email templates as PDFs

### ❌ Separate Chat Service (SendBird, Stream Chat)
**Why Avoid:** External dependency, cost, over-engineered for dealer support
**When to Reconsider:** Message volume >10K/day or need advanced chat features

### ❌ react-dropzone (for now)
**Why Avoid:** Native input simpler, one less dependency
**When to Reconsider:** Phase 07 UX testing shows dealer confusion

### ❌ Heavy PDF Viewers (PSPDFKit, Nutrient)
**Why Avoid:** Commercial licensing ($$$), large SDK, overkill for read-only invoices
**When to Reconsider:** Need PDF annotation/editing

### ❌ Redux or Additional State Management
**Why Avoid:** Zustand already in stack, adding Redux for messaging over-engineered
**When to Reconsider:** State complexity exceeds Zustand capabilities

---

## Installation Summary

### Required for v2.0 (Web)
```bash
# PDF generation
npm install @react-pdf/renderer

# Radix UI additions
npm install @radix-ui/react-accordion @radix-ui/react-tabs @radix-ui/react-popover @radix-ui/react-collapsible
```

### Required for v2.0 (Mobile)
```bash
# Document picker
npx expo install expo-document-picker
```

### Optional (Evaluate in Phase)
```bash
# If native file input UX insufficient (web)
npm install react-dropzone

# If WebView PDF performance poor (mobile)
npx expo install react-native-pdf
# Note: Requires Expo development build
```

**Total:**
- **Required:** 5 packages (1 PDF + 4 UI components)
- **Optional:** 2 packages (both deferred to testing)
- **Bundle Impact:** ~150KB (web), ~50KB (mobile) for required dependencies
- **Breaking Changes:** None

---

## Phase-by-Phase Breakdown

| Phase | New Dependencies | Leverages Existing |
|-------|------------------|-------------------|
| **06 - Bayi Dashboard** | Radix Tabs, Accordion | Recharts, Zustand |
| **07 - Finansal Bilgiler** | @react-pdf/renderer, Radix Popover | Supabase Storage, React Hook Form |
| **08 - Favoriler** | None | Supabase Database |
| **09 - Kampanyalar** | Radix Collapsible | Sonner, Supabase Database |
| **10 - Destek** | None | Supabase Realtime, Radix Popover (from 07) |
| **11 - Sipariş Detayları** | expo-document-picker (mobile) | @react-pdf/renderer (from 07), Supabase Storage |
| **12 - Bayi Raporları** | None | @react-pdf/renderer (from 07), Recharts |

---

## Version Compatibility Matrix

| Dependency | Version | Next.js | React | Expo | Supabase | Notes |
|------------|---------|---------|-------|------|----------|-------|
| @react-pdf/renderer | ^4.1.10 | 14-16 ✅ | 18-19 ✅ | N/A | ✅ | Compatible with current stack |
| @radix-ui/* | ^1.2.x | Any ✅ | 18-19 ✅ | N/A | ✅ | Same version as existing Radix components |
| expo-document-picker | ^12.3.1 | N/A | N/A | 51-52 ✅ | ✅ | Official Expo SDK |
| react-native-pdf | ^7.0.3 | N/A | N/A | 51-52 ✅ | ✅ | Optional, requires dev build |
| react-dropzone | ^14.3.5 | 14-16 ✅ | 18-19 ✅ | N/A | ✅ | Optional |

**Current Stack:** Next.js 16.1.4 ✅, React 19.2.3 ✅, Supabase (latest) ✅
**Result:** All proposed dependencies fully compatible

---

## Confidence Assessment

| Area | Level | Reasoning |
|------|-------|-----------|
| PDF Generation | **HIGH** | @react-pdf/renderer proven with Next.js 16 + React 19 |
| File Upload | **HIGH** | Supabase Storage well-documented, signed URLs solve Next.js limits |
| Real-time Messaging | **HIGH** | Supabase Realtime already in stack, Postgres changes pattern established |
| UI Components | **HIGH** | Radix UI already in use, adding more components is low-risk |
| Mobile PDF (WebView) | **MEDIUM** | WebView approach solid but untested for this use case |
| Mobile PDF (Native) | **MEDIUM** | react-native-pdf proven but adds build complexity |
| **Overall** | **HIGH** | Minimal additions to proven stack, clear fallback options |

---

## Key Decisions & Rationale

| Decision | Chosen | Rejected | Why |
|----------|--------|----------|-----|
| **PDF Generation** | @react-pdf/renderer | Puppeteer | Smaller bundle, faster rendering, no Chrome needed |
| **Messaging** | Supabase Realtime | SendBird, Stream Chat | Already in stack, zero cost, simpler integration |
| **File Upload** | Native input first | react-dropzone from start | Simpler, defer complexity until validated |
| **Mobile PDF** | WebView first | react-native-pdf from start | Avoid dev build complexity until performance validates need |
| **Notifications** | Sonner (keep) | React-Toastify | Already sufficient, lightweight, modern |
| **UI Components** | Radix (expand) | New library | Consistent with existing patterns |

**Philosophy:** Extend existing capabilities, add dependencies only when necessary, prefer server-side solutions to reduce client bundle size.

---

## Integration with Existing Architecture

### Supabase-First Approach

All v2.0 features integrate with existing Supabase services:

```
┌─────────────────────────────────────────┐
│         Next.js 16 App Router           │
│  (Existing: Auth, Catalog, Cart, Orders)│
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌──────▼─────────┐
│  Supabase Auth │  │ Supabase DB    │
│  (Existing)    │  │ (PostgreSQL)   │
│                │  │                │
│  - Dealers     │  │ + messages     │ ← New for Destek
│  - Admins      │  │ + favorites    │ ← New for Favoriler
└────────────────┘  │ + campaigns    │ ← New for Kampanyalar
                    │                │
                    │ Existing:      │
                    │ - orders       │
                    │ - products     │
                    │ - dealers      │
                    └────────────────┘
                            │
                ┌───────────┴────────────┐
                │                        │
        ┌───────▼────────┐      ┌───────▼────────┐
        │ Supabase       │      │ Supabase       │
        │ Realtime       │      │ Storage        │
        │                │      │                │
        │ + messages     │      │ + invoices/    │ ← New for PDFs
        │   channel      │      │ + documents/   │ ← New for uploads
        └────────────────┘      └────────────────┘

┌─────────────────────────────────────────┐
│         @react-pdf/renderer             │ ← New dependency
│  (Server-side PDF generation)           │
│                                         │
│  Invoice → PDF → Supabase Storage       │
└─────────────────────────────────────────┘
```

### Server Actions Pattern (Existing, Extended)

v2.0 features follow existing Server Actions pattern:

```typescript
// Existing pattern from v1
'use server'
export async function createOrder(data: OrderData) {
  const supabase = createClient();
  // ...
}

// Extended for v2.0
'use server'
export async function generateInvoicePDF(orderId: string) {
  const supabase = createClient();

  // 1. Fetch data
  const { data: invoice } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  // 2. Generate PDF
  const pdfBuffer = await renderToBuffer(<InvoicePDF invoice={invoice} />);

  // 3. Store in Supabase Storage
  const { data } = await supabase.storage
    .from('invoices')
    .upload(`${orderId}.pdf`, pdfBuffer);

  return data.path;
}
```

**Consistency:** All new features use existing patterns (Server Actions + Supabase RLS)

---

## Sources

### PDF Generation
- [react-pdf Official Documentation](https://react-pdf.org/compatibility)
- [Building a PDF generation service using Next.js and React PDF](https://03balogun.medium.com/building-a-pdf-generation-service-using-nextjs-and-react-pdf-78d5931a13c7)
- [Creating PDF in React/Next.js: A Complete Guide](https://dominikfrackowiak.com/en/blog/react-pdf-with-next-js)
- [Puppeteer vs react-pdf Comparison](https://npm-compare.com/html-pdf,pdfkit,pdfmake,puppeteer,react-pdf,wkhtmltopdf)

### Supabase Storage & File Uploads
- [Complete Guide to File Uploads with Next.js and Supabase Storage](https://supalaunch.com/blog/file-upload-nextjs-supabase)
- [Signed URL file uploads with Next.js and Supabase](https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0)
- [Supabase Storage Guide for Next.JS](https://supalaunch.com/blog/supabase-storage-guide-for-nextjs)
- [Next.js 14 Tutorial Part 5 - File upload using server actions](https://strapi.io/blog/epic-next-js-15-tutorial-part-5-file-upload-using-server-actions)
- [Size Limitation for Server Actions in Next.js 14](https://github.com/vercel/next.js/discussions/57973)

### Supabase Realtime
- [Supabase Realtime Chat Documentation](https://supabase.com/ui/docs/nextjs/realtime-chat)
- [Realtime Chat With Supabase](https://blog.stackademic.com/realtime-chat-with-supabase-realtime-is-supa-easy-091c96411afd)
- [Build a Real-Time Data Syncing Chat Application](https://egghead.io/courses/build-a-real-time-data-syncing-chat-application-with-supabase-and-next-js-84e58958)

### UI Components
- [Radix Primitives - Accordion](https://www.radix-ui.com/primitives/docs/components/accordion)
- [Radix Primitives - Tabs](https://www.radix-ui.com/primitives/docs/components/tabs)
- [Radix Primitives - Popover](https://www.radix-ui.com/primitives/docs/components/popover)
- [Radix Primitives - Collapsible](https://www.radix-ui.com/primitives/docs/components/collapsible)
- [Building Low Level Components the Radix Way](https://alexkondov.com/building-low-level-components-the-radix-way/)

### React Hook Form & Validation
- [File Uploads with ReactJS and Hooks](https://rootstack.com/en/blog/file-uploads-reactjs-and-hooks-complete-guide)
- [Uploading files with React Hook Form](https://dreamix.eu/insights/uploading-files-with-react-hook-form/)
- [React Hook Form: Working with Multipart Form Data](https://claritydev.net/blog/react-hook-form-multipart-form-data-file-uploads)

### Mobile File Handling
- [Expo DocumentPicker Documentation](https://docs.expo.dev/versions/latest/sdk/document-picker/)
- [Expo FileSystem Documentation](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- [React Native File & Image Picker with Expo](https://medium.com/@YAGNIK09/react-native-file-image-picker-with-expo-documentpicker-imagepicker-camera-2b3699b3db99)
- [React Native PDF Viewer Guide](https://theappmarket.io/blog/react-native-pdf-viewer)
- [Handling PDF Links in WebView in React Native](https://medium.com/@valentyndanilichev/handling-pdf-links-in-webview-in-react-native-eecba9f18591)

### Toast Notifications
- [Comparing the top React toast libraries [2025 update]](https://blog.logrocket.com/react-toast-libraries-compared-2025/)
- [Sonner vs. Toast: A Deep Dive Into React Notification Libraries](https://www.oreateai.com/blog/sonner-vs-toast-a-deep-dive-into-react-notification-libraries/4596cec74c442a27834f2ec4b53b8eb2)
- [Top 9 React notification libraries in 2026](https://knock.app/blog/the-top-notification-libraries-for-react)

### Next.js Server Actions
- [How to Bypass Vercel Upload Limits in Next.js](https://medium.com/@swerashed/how-to-bypass-vercel-upload-limits-in-next-js-using-use-client-for-client-side-file-uploads-b045ed3b65a5)
- [Next.js Server Actions: The Complete Guide (2026)](https://makerkit.dev/blog/tutorials/nextjs-server-actions)

---

## Summary

**v2.0 stack additions are MINIMAL and STRATEGIC:**

✅ **5 Required Dependencies** (@react-pdf/renderer + 4 Radix UI + expo-document-picker)
✅ **Leverage 90% of Existing Stack** (Supabase services, React Hook Form, Recharts, Sonner)
✅ **No Architectural Changes** (same Server Actions + Supabase pattern)
✅ **Clear Fallback Options** (WebView → react-native-pdf if needed)
✅ **Progressive Enhancement** (native input → react-dropzone if validated)

**Total Bundle Impact:** ~150KB web, ~50KB mobile
**Breaking Changes:** None
**Risk Level:** Low (extending proven patterns)

This approach maintains architectural consistency while adding only what's strictly necessary for v2.0 features.
