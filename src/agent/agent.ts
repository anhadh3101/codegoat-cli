import OpenAI from 'openai';
import { END, START, StateGraph } from './graph';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AgentState = {
  messages: ChatMessage[];
};

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

async function modelNode(state: AgentState): Promise<Partial<AgentState>> {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'openai/gpt-4o-mini',
    messages: state.messages,
  });

  const reply = completion.choices[0]?.message?.content ?? '';

  return { messages: [...state.messages, { role: 'assistant', content: reply }] };
}

const graph = new StateGraph<AgentState>()
  .addNode('model', modelNode)
  .addEdge(START, 'model')
  .addEdge('model', END)
  .compile();

export function runAgent(state: AgentState): Promise<AgentState> {
  return graph.invoke(state);
}
