import type Anthropic from '@anthropic-ai/sdk';
import type { ClientTool } from '../toolNode.js';
import { bashClientTool } from './bash.js';
import { textEditorClientTool } from './textEditor.js';
import { webFetchTool } from './webFetch.js';
import { webSearchTool } from './webSearch.js';

const clientTools: ClientTool[] = [bashClientTool, textEditorClientTool];

export const allTools: Anthropic.ToolUnion[] = [
  ...clientTools.map((tool) => tool.definition),
  webSearchTool,
  webFetchTool,
];

export const clientToolsByName: Record<string, ClientTool> = Object.fromEntries(
  clientTools.map((tool) => [tool.definition.name, tool]),
);
