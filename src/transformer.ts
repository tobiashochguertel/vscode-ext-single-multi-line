/**
 * Transformer module — responsible for converting text between layouts.
 *
 * Single Responsibility: only transforms text, delegates parsing to parser.ts.
 * Open/Closed: new transformation strategies can be added as new functions
 * without modifying existing ones.
 */

import { detectLayout, findBalancedBlocks, findSeparatorIndexes } from './parser';
import { TextLayout, TransformOptions } from './types';

/**
 * Convert multi-line text to a single line by stripping newlines and tabs.
 */
export function toSingleLine(text: string): string {
  return text.trim().replace(/[\r\n\t]/g, '');
}

/**
 * Convert single-line text to multi-line by inserting line breaks at
 * separator positions (brackets, commas, semicolons).
 */
export function toMultiLine(text: string, options: TransformOptions): string {
  const separators = findSeparatorIndexes(text);
  const chars = text.split('');

  separators.forEach(({ index, isComma }) => {
    if (options.isCommaOnNewLine && isComma) {
      chars[index] = '\n' + chars[index];
    } else {
      chars[index] += '\n';
    }
  });

  return chars.join('');
}

/**
 * Toggle between single-line and multi-line.
 *
 * This is the original behaviour of the extension — kept for backward
 * compatibility.
 */
export function toggleLineLayout(text: string, options: TransformOptions): string {
  const trimmed = text.trim();
  if (!trimmed.length) {
    return text;
  }

  const layout = detectLayout(trimmed);
  return layout === TextLayout.MultiLine
    ? toSingleLine(trimmed)
    : toMultiLine(trimmed, options);
}

/**
 * Compact balanced `{ }` blocks — each block is collapsed to a single line
 * while preserving the surrounding structure (one block per line).
 *
 * This is the NEW feature that solves the use-case of compacting:
 *
 * ```
 *   {
 *     "name": "foo",
 *     "regexp": "*"
 *   },
 *   {
 *     "name": "bar",
 *     "regexp": "*"
 *   },
 * ```
 *
 * into:
 *
 * ```
 *   { "name": "foo", "regexp": "*" },
 *   { "name": "bar", "regexp": "*" },
 * ```
 *
 * Strategy:
 * 1. Find all top-level `{ }` blocks.
 * 2. For each block, collapse its interior whitespace to single spaces.
 * 3. Detect the leading indentation of the first block and apply it to all.
 * 4. Reassemble with one block per line, preserving commas/trailing content.
 */
export function compactBlocks(text: string): string {
  const blocks = findBalancedBlocks(text);

  if (blocks.length === 0) {
    // No balanced blocks found — fall back to simple single-line
    return toSingleLine(text);
  }

  // Detect indentation from the text before the first block
  const beforeFirst = text.substring(0, blocks[0].start);
  const indentMatch = beforeFirst.match(/([ \t]*)$/);
  const indent = indentMatch ? indentMatch[1] : '';

  const lines: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const raw = text.substring(block.start, block.end + 1);

    // Collapse interior: replace newlines/tabs with spaces, collapse multiple spaces
    const compacted = raw
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\{\s+/g, '{ ')
      .replace(/\s+\}/g, ' }');

    // Grab any trailing content between this block's end and the next block's start
    // (typically a comma and whitespace)
    const nextStart = i + 1 < blocks.length ? blocks[i + 1].start : text.length;
    let trailing = text.substring(block.end + 1, nextStart).trim();

    // If trailing is just a comma, append it directly to the compacted block
    if (trailing === ',') {
      lines.push(indent + compacted + ',');
    } else if (trailing.startsWith(',')) {
      lines.push(indent + compacted + ',');
    } else {
      lines.push(indent + compacted + (trailing ? ' ' + trailing : ''));
    }
  }

  return lines.join('\n');
}
