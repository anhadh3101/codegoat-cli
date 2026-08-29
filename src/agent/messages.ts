import type Anthropic from '@anthropic-ai/sdk';

export function extractText(content: Anthropic.MessageParam['content']): string {
  if (typeof content === 'string') return content;

  return content
    .filter((block): block is Anthropic.TextBlockParam => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}
