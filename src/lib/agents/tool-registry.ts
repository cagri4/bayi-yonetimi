/**
 * ToolRegistry — maps each AgentRole to its specific tool set and model.
 * Phase 9: all roles get the same placeholder tools.
 * Phase 10+: each role will have role-specific real tool implementations.
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import { AgentRole, AGENT_MODELS } from './types'
import { placeholderTools } from './tools/index'
import { egitimciTools } from './tools/egitimci-tools'
import { satisTools } from './tools/satis-tools'

// ─── Tool Registry Map ─────────────────────────────────────────────────────

/**
 * Maps each agent role to its available tools.
 * Phase 9: all roles use placeholder tools.
 * Phase 10: egitimci and satis_temsilcisi use real tool implementations.
 * Phase 10+: populate role-specific tool arrays for remaining roles.
 */
export const TOOL_REGISTRY: Record<AgentRole, Tool[]> = {
  egitimci: egitimciTools,
  satis_temsilcisi: satisTools,
  muhasebeci: placeholderTools,
  depo_sorumlusu: placeholderTools,
  destek: placeholderTools,
  genel_mudur_danismani: placeholderTools,
  tahsilat_uzmani: placeholderTools,
  dagitim_koordinatoru: placeholderTools,
  saha_satis: placeholderTools,
  pazarlamaci: placeholderTools,
  urun_yoneticisi: placeholderTools,
  satin_alma: placeholderTools,
}

// ─── Prompt Caching Helper ─────────────────────────────────────────────────

/**
 * Applies Anthropic prompt caching to tool definitions.
 * Sets cache_control: { type: 'ephemeral' } on the LAST tool in the array.
 * This enables cache hits on repeated invocations with the same tool set.
 *
 * AI-10: Prompt caching on tool definitions reduces per-message cost on long conversations.
 */
export function applyPromptCaching(tools: Tool[]): Tool[] {
  if (tools.length === 0) return tools

  const lastIndex = tools.length - 1
  return tools.map((tool, index) => {
    if (index !== lastIndex) return tool
    return {
      ...tool,
      cache_control: { type: 'ephemeral' as const },
    }
  })
}

// ─── ToolRegistry Class ────────────────────────────────────────────────────

/**
 * Stateless registry for agent tool and model lookups.
 * All methods are pure lookups against the TOOL_REGISTRY and AGENT_MODELS constants.
 */
export class ToolRegistry {
  /**
   * Returns the tools available to the given agent role.
   * Phase 9: returns placeholder tools for all roles.
   */
  getTools(role: AgentRole): Tool[] {
    return TOOL_REGISTRY[role]
  }

  /**
   * Returns the Claude model ID assigned to the given agent role.
   * Sonnet 4.6 for complex reasoning roles; Haiku 4.5 for operational roles.
   */
  getModel(role: AgentRole): string {
    return AGENT_MODELS[role]
  }

  /**
   * Returns tools for the role with prompt caching applied to the last tool.
   * Use this when building Claude API requests to enable prompt cache hits.
   */
  getToolsWithCaching(role: AgentRole): Tool[] {
    return applyPromptCaching(this.getTools(role))
  }
}

/** Singleton registry instance for use across agent infrastructure */
export const toolRegistry = new ToolRegistry()
