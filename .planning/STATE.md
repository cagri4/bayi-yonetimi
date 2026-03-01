# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Bayilerin mesai saatlerinden bagimsiz, anlik stok ve fiyat bilgisiyle siparis verebilmesi — AI agent'lar ile 7/24 otonom is surecleri.

**Current focus:** v3.0 — Multi-Tenant SaaS + AI Agent Ecosystem

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-01 — Milestone v3.0 started

## Milestones

**Shipped:**
- v1 MVP (2026-02-03) — 3 phases, 14 plans, 38 requirements
- v2.0 — Bayi Deneyimi ve Finansal Takip (2026-03-01) — 4 phases, 20 plans, 36 requirements

## Accumulated Context

### Supabase Project
- Project ref: neqcuhejmornybmbclwt (restored, West EU London)
- URL: https://neqcuhejmornybmbclwt.supabase.co
- Auth users: admin@test.com (admin), bayi@test.com (dealer)
- RLS: Uses is_admin() SECURITY DEFINER function
- All 8 migrations applied, seed data present

### Deployment
- Vercel: https://bayi-yonetimi.vercel.app (38 routes)
- GitHub: cagri4/bayi-yonetimi

### Key Architectural Decisions
- is_admin() SECURITY DEFINER to prevent RLS recursion on users table
- gen_random_uuid() instead of uuid_generate_v4() for Supabase
- Zod v4: error instead of errorMap
- @supabase/supabase-js v2.91+ requires Relationships: [] on all table types
- Server Actions pattern for mutations
- Zustand + localStorage for client state

### Pending Todos
- None carried over from v2.0

### Blockers/Concerns
- Database SQL execution requires Dashboard SQL Editor (no CLI access token)
- Claude API key needed for agent features (user has existing key from another project)

## Session Continuity

Last session: 2026-03-01
Stopped at: Starting v3.0 milestone — defining requirements
Resume file: None

---
*Last updated: 2026-03-01*
