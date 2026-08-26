import type Anthropic from '@anthropic-ai/sdk';

// Server tool: Anthropic executes this itself, no execute function here.
export const webSearchTool: Anthropic.WebSearchTool20250305 = {
  type: 'web_search_20250305',
  name: 'web_search',
};
