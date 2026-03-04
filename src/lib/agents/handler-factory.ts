/**
 * Handler Factory — maps AgentRole to its tool handler Map.
 * Shared between dispatcher.ts and agent-bridge.ts to avoid duplication.
 * Phase 12: All 12 roles mapped to real handlers (except destek which uses placeholder).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AgentContext } from './types'
import { createEgitimciHandlers } from './tools/egitimci-tools'
import { createSatisHandlers } from './tools/satis-tools'
import { createMuhasebeciHandlers } from './tools/muhasebeci-tools'
import { createDepoSorumlusuHandlers } from './tools/depo-sorumlusu-tools'
import { createGenelMudurHandlers } from './tools/genel-mudur-tools'
import { createTahsilatUzmaniHandlers } from './tools/tahsilat-uzmani-tools'
import { createDagitimKoordinatoruHandlers } from './tools/dagitim-koordinatoru-tools'
import { createSahaSatisHandlers } from './tools/saha-satis-tools'
import { createPazarlamaciHandlers } from './tools/pazarlamaci-tools'
import { createUrunYoneticisiHandlers } from './tools/urun-yoneticisi-tools'
import { createSatinAlmaHandlers } from './tools/satin-alma-tools'
import { createIadeKaliteHandlers } from './tools/iade-kalite-tools'

type HandlerFn = (input: Record<string, unknown>, context: AgentContext) => Promise<string>

export function buildHandlersForRole(
  role: string,
  supabase: SupabaseClient<Database>,
): Map<string, HandlerFn> {
  if (role === 'egitimci') return createEgitimciHandlers(supabase)
  if (role === 'satis_temsilcisi') return createSatisHandlers(supabase)
  if (role === 'muhasebeci') return createMuhasebeciHandlers(supabase)
  if (role === 'depo_sorumlusu') return createDepoSorumlusuHandlers(supabase)
  if (role === 'genel_mudur_danismani') return createGenelMudurHandlers(supabase)
  if (role === 'tahsilat_uzmani') return createTahsilatUzmaniHandlers(supabase)
  if (role === 'dagitim_koordinatoru') return createDagitimKoordinatoruHandlers(supabase)
  if (role === 'saha_satis') return createSahaSatisHandlers(supabase)
  if (role === 'pazarlamaci') return createPazarlamaciHandlers(supabase)
  if (role === 'urun_yoneticisi') return createUrunYoneticisiHandlers(supabase)
  if (role === 'satin_alma') return createSatinAlmaHandlers(supabase)
  if (role === 'iade_kalite') return createIadeKaliteHandlers(supabase)
  // Fallback for destek and unknown roles
  return new Map([
    ['echo', async (input: Record<string, unknown>) => String(input.message ?? '[Bos mesaj]')],
    ['get_current_time', async () => new Date().toISOString()],
  ])
}
