import type { MessageItem } from '../transcript.js';

export const BANNER_ROWS = 3;

function wrapLines(text: string, width: number): number {
  if (width <= 0) return 1;

  const paragraphs = text.split('\n');
  let lines = 0;

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines += 1;
    } else {
      lines += Math.ceil(paragraph.length / width);
    }
  }

  return Math.max(lines, 1);
}

export function estimateMessageLines(
  item: MessageItem,
  columns: number,
): number {
  const margin = 1;
  let width = columns;

  if (item.kind === 'user') {
    width = Math.max(columns - 2, 1);
  }

  return wrapLines(item.text, width) + margin;
}

export function totalMessageLines(
  items: MessageItem[],
  columns: number,
): number {
  return items.reduce(
    (sum, item) => sum + estimateMessageLines(item, columns),
    0,
  );
}

export function maxScrollFromBottom(
  items: MessageItem[],
  columns: number,
  viewportRows: number,
): number {
  return Math.max(0, totalMessageLines(items, columns) - viewportRows);
}

export function clampScrollFromBottom(
  scrollFromBottom: number,
  items: MessageItem[],
  columns: number,
  viewportRows: number,
): number {
  return Math.min(
    Math.max(0, scrollFromBottom),
    maxScrollFromBottom(items, columns, viewportRows),
  );
}

export function getVisibleMessages(
  items: MessageItem[],
  columns: number,
  viewportRows: number,
  scrollFromBottom: number,
): MessageItem[] {
  if (items.length === 0 || viewportRows <= 0) return [];

  const totalLines = totalMessageLines(items, columns);
  const scroll = clampScrollFromBottom(
    scrollFromBottom,
    items,
    columns,
    viewportRows,
  );
  const targetEnd = totalLines - scroll;
  const targetStart = Math.max(0, targetEnd - viewportRows);

  const visible: MessageItem[] = [];
  let currentLine = 0;

  for (const item of items) {
    const lines = estimateMessageLines(item, columns);
    const messageStart = currentLine;
    const messageEnd = currentLine + lines;

    if (messageEnd > targetStart && messageStart < targetEnd) {
      visible.push(item);
    }

    currentLine = messageEnd;
  }

  while (visible.length > 0) {
    const visibleLines = visible.reduce(
      (sum, item) => sum + estimateMessageLines(item, columns),
      0,
    );
    if (visibleLines <= viewportRows) break;
    visible.shift();
  }

  return visible;
}

export function footerRows(view: string, busy: boolean): number {
  if (view === 'model-select') return 8;
  return busy ? 2 : 1;
}

export function transcriptViewportRows(
  terminalRows: number,
  view: string,
  busy: boolean,
): number {
  return Math.max(1, terminalRows - BANNER_ROWS - footerRows(view, busy));
}
