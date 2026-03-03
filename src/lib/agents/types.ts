/**
 * Agent type system for Phase 9+ agent infrastructure.
 * Defines agent roles, model assignments, context interfaces, and budget constants.
 */

// ─── Agent Role Taxonomy ───────────────────────────────────────────────────

/**
 * Union type of all 12 agent roles in the system.
 * Using Turkish-English kebab-case identifiers matching the business domain.
 */
export type AgentRole =
  | 'egitimci'              // Trainer
  | 'satis_temsilcisi'      // Sales Representative
  | 'muhasebeci'            // Accountant
  | 'depo_sorumlusu'        // Warehouse Manager
  | 'destek'                // Support
  | 'genel_mudur_danismani' // Executive Advisor
  | 'tahsilat_uzmani'       // Collections Specialist
  | 'dagitim_koordinatoru'  // Distribution Coordinator
  | 'saha_satis'            // Field Sales
  | 'pazarlamaci'           // Marketing
  | 'urun_yoneticisi'       // Product Manager
  | 'satin_alma'            // Procurement
  | 'iade_kalite'            // Returns/Quality

// ─── Model Constants ───────────────────────────────────────────────────────

export const SONNET_MODEL = 'claude-sonnet-4-6' as const
export const HAIKU_MODEL = 'claude-haiku-4-5' as const

/**
 * Maps each agent role to its Claude model.
 * Sonnet 4.6: High-complexity roles (Trainer, Accountant, Marketing, Executive)
 * Haiku 4.5: All other roles (cost optimization)
 */
export const AGENT_MODELS: Record<AgentRole, string> = {
  // Sonnet 4.6 — high-complexity reasoning roles
  egitimci: SONNET_MODEL,
  muhasebeci: SONNET_MODEL,
  pazarlamaci: SONNET_MODEL,
  genel_mudur_danismani: SONNET_MODEL,

  // Haiku 4.5 — transactional / operational roles
  satis_temsilcisi: HAIKU_MODEL,
  depo_sorumlusu: HAIKU_MODEL,
  destek: HAIKU_MODEL,
  tahsilat_uzmani: HAIKU_MODEL,
  dagitim_koordinatoru: HAIKU_MODEL,
  saha_satis: HAIKU_MODEL,
  urun_yoneticisi: HAIKU_MODEL,
  satin_alma: HAIKU_MODEL,
  iade_kalite: HAIKU_MODEL,
}

// ─── Runtime Context ───────────────────────────────────────────────────────

/**
 * Runtime context passed to AgentRunner on each invocation.
 * Carries tenant isolation, conversation tracking, and deadlock detection state.
 */
export interface AgentContext {
  companyId: string
  dealerId: string
  conversationId: string
  agentRole: AgentRole
  telegramChatId: number
  callStack: string[]  // For deadlock detection
  depth: number        // Current call depth
}

// ─── Token Usage ───────────────────────────────────────────────────────────

/**
 * Token usage breakdown from a single Claude API response.
 * All four fields must be present; set to 0 if not applicable.
 */
export interface TokenUsageRecord {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

// ─── Cost Control Constants ────────────────────────────────────────────────

/** Soft daily token limit per dealer — log warning but allow continuation */
export const SOFT_TOKEN_LIMIT = 50_000

/** Hard daily token limit per dealer — block further requests */
export const HARD_TOKEN_LIMIT = 100_000

// ─── Loop Guard Constants ──────────────────────────────────────────────────

/** Maximum tool-calling iterations in a single AgentRunner.run() invocation */
export const MAX_ITERATIONS = 10

/** Maximum cross-agent call depth before deadlock protection kicks in */
export const MAX_AGENT_DEPTH = 5

/** Maximum total tool calls within a single agent loop */
export const MAX_TOOL_CALLS = 10
