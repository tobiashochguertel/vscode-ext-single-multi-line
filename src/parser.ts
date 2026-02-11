/**
 * Parser module — responsible for analysing text structure.
 *
 * Single Responsibility: only detects separators, brackets, and text layout.
 * Open/Closed: new separator types can be added without modifying existing logic
 * by extending the regex sets.
 */

import { BalancedBlock, SeparatorLocation, TextLayout } from './types';

const NEWLINE_RE = /[\r\n]/;
const START_BRACKET_RE = /[{[( ]/;
const END_BRACKET_RE = /[}\])]/;
const QUOTE_RE = /['"`]/;

/** Detect whether the (trimmed) text contains line breaks. */
export function detectLayout(text: string): TextLayout {
  return NEWLINE_RE.test(text.trim())
    ? TextLayout.MultiLine
    : TextLayout.SingleLine;
}

/**
 * Walk the string and return every index where a line break should be inserted
 * when converting single-line → multi-line.
 *
 * Respects quoted strings so that separators inside quotes are ignored.
 */
export function findSeparatorIndexes(text: string): SeparatorLocation[] {
  let isInString = false;
  let currentQuote = '';
  const result: SeparatorLocation[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (!isInString) {
      const isSeparator =
        /[{[(]/.test(ch) ||
        (/[}\])]/.test(ch) && next !== undefined && ![',', ';'].includes(next)) ||
        (next !== undefined && /[}\])]/.test(next)) ||
        [',', ';'].includes(ch);

      if (isSeparator) {
        result.push({ index: i, isComma: ch === ',' });
      }
    }

    // Track string boundaries
    if (QUOTE_RE.test(ch)) {
      if (!isInString) {
        currentQuote = ch;
        isInString = true;
      } else if (currentQuote === ch) {
        isInString = false;
      }
    }
  }

  return result;
}

/**
 * Find top-level balanced blocks delimited by `{ }` in the text.
 *
 * This is used by the "compact blocks" feature: each block is compacted
 * individually while the surrounding structure (commas, line breaks) is kept.
 *
 * Respects nested brackets and quoted strings.
 */
export function findBalancedBlocks(text: string): BalancedBlock[] {
  const blocks: BalancedBlock[] = [];
  let depth = 0;
  let blockStart = -1;
  let isInString = false;
  let currentQuote = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    // Track string boundaries
    if (QUOTE_RE.test(ch)) {
      if (!isInString) {
        currentQuote = ch;
        isInString = true;
        continue;
      } else if (currentQuote === ch) {
        isInString = false;
        continue;
      }
    }
    if (isInString) {
      continue;
    }

    if (ch === '{') {
      if (depth === 0) {
        blockStart = i;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && blockStart !== -1) {
        blocks.push({ start: blockStart, end: i });
        blockStart = -1;
      }
    }
  }

  return blocks;
}
