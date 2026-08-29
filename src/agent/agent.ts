import Anthropic from '@anthropic-ai/sdk';
import { END, START, StateGraph } from './graph.js';
import { hasPendingClientToolCall, toolNode } from './toolNode.js';
import { allTools } from './tools/index.js';

export type AgentState = {
  messages: Anthropic.MessageParam[];
};

const client = new Anthropic();

async function modelNode(state: AgentState): Promise<Partial<AgentState>> {
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
    max_tokens: 4096,
    messages: state.messages,
    tools: allTools,
  });

  return {
    // response.content (ContentBlock[]) carries extra response-only fields
    // beyond ContentBlockParam[], but is safe to feed straight back in as
    // the next turn's input per Anthropic's conversation-loop convention.
    messages: [
      ...state.messages,
      { role: 'assistant', content: response.content as unknown as Anthropic.MessageParam['content'] },
    ],
  };
}

function routeAfterModel(state: AgentState): string {
  return hasPendingClientToolCall(state) ? 'tools' : END;
}

const graph = new StateGraph<AgentState>()
  .addNode('model', modelNode)
  .addNode('tools', toolNode)
  .addEdge(START, 'model')
  .addConditionalEdge('model', routeAfterModel)
  .addEdge('tools', 'model')
  .compile();

export function runAgent(state: AgentState): Promise<AgentState> {
  return graph.invoke(state);
}
