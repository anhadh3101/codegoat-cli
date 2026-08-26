import type Anthropic from '@anthropic-ai/sdk';

// Server tool: Anthropic executes this itself, no execute function here.
export const webFetchTool: Anthropic.WebFetchTool20250910 = {
  type: 'web_fetch_20250910',
  name: 'web_fetch',
};
