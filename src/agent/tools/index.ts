import type Anthropic from '@anthropic-ai/sdk';
import type { ClientTool } from '../toolNode';
import { bashClientTool } from './bash';
import { textEditorClientTool } from './textEditor';
import { webFetchTool } from './webFetch';
import { webSearchTool } from './webSearch';

const clientTools: ClientTool[] = [bashClientTool, textEditorClientTool];

export const allTools: Anthropic.ToolUnion[] = [
  ...clientTools.map((tool) => tool.definition),
  webSearchTool,
  webFetchTool,
];

export const clientToolsByName: Record<string, ClientTool> = Object.fromEntries(
  clientTools.map((tool) => [tool.definition.name, tool]),
);
