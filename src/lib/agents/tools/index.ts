/**
 * Placeholder tool definitions for Phase 9 validation.
 * Real tool implementations come in Phase 10+.
 * These 3 tools validate ToolRegistry wire-up and prompt caching behavior.
 */
import type { Tool } from '@anthropic-ai/sdk/resources/messages'

export const echoTool: Tool = {
  name: 'echo',
  description: 'Echoes the input back. Test tool for Phase 9 validation.',
  input_schema: {
    type: 'object' as const,
    properties: { message: { type: 'string', description: 'Message to echo' } },
    required: ['message'],
  },
}

export const getTimeTool: Tool = {
  name: 'get_current_time',
  description: 'Returns the current server time in ISO format.',
  input_schema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
}

export const lookupDealerTool: Tool = {
  name: 'lookup_dealer',
  description: 'Looks up dealer information by ID. Requires company_id scoping.',
  input_schema: {
    type: 'object' as const,
    properties: { dealer_id: { type: 'string', description: 'Dealer UUID' } },
    required: ['dealer_id'],
  },
}

/** All placeholder tools for Phase 9. Ordered: ephemeral cache_control goes on last item. */
export const placeholderTools: Tool[] = [echoTool, getTimeTool, lookupDealerTool]
