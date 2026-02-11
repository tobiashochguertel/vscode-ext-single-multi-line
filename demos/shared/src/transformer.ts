/**
 * Shared transformer functions — extracted from the extension's src/ modules.
 * Used by all demo solutions to generate before/after text states.
 */

// ── Types ────────────────────────────────────────────────────

export interface SeparatorLocation {
  index: number;
  isComma: boolean;
}

export interface BalancedBlock {
  start: number;
  end: number;
}

// ── Parser ───────────────────────────────────────────────────

const QUOTE_RE = /['"`]/;

export function findBalancedBlocks(text: string): BalancedBlock[] {
  const blocks: BalancedBlock[] = [];
  let depth = 0;
  let blockStart = -1;
  let isInString = false;
  let currentQuote = "";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
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
    if (isInString) continue;

    if (ch === "{") {
      if (depth === 0) blockStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && blockStart !== -1) {
        blocks.push({ start: blockStart, end: i });
        blockStart = -1;
      }
    }
  }
  return blocks;
}

export function findSeparatorIndexes(text: string): SeparatorLocation[] {
  let isInString = false;
  let currentQuote = "";
  const result: SeparatorLocation[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (!isInString) {
      const isSeparator =
        /[{[(]/.test(ch) ||
        (/[}\])]/.test(ch) &&
          next !== undefined &&
          ![",", ";"].includes(next)) ||
        (next !== undefined && /[}\])]/.test(next)) ||
        [",", ";"].includes(ch);
      if (isSeparator) {
        result.push({ index: i, isComma: ch === "," });
      }
    }
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

// ── Transformers ─────────────────────────────────────────────

export function toSingleLine(text: string): string {
  return text.trim().replace(/[\r\n\t]/g, "");
}

export function toMultiLine(
  text: string,
  isCommaOnNewLine: boolean = false,
): string {
  const separators = findSeparatorIndexes(text);
  const chars = text.split("");
  separators.forEach(({ index, isComma }) => {
    if (isCommaOnNewLine && isComma) {
      chars[index] = "\n" + chars[index];
    } else {
      chars[index] += "\n";
    }
  });
  return chars.join("");
}

export function toggleLineLayout(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.length) return text;
  const isMulti = /[\r\n]/.test(trimmed);
  return isMulti ? toSingleLine(trimmed) : toMultiLine(trimmed);
}

export function compactBlocks(text: string): string {
  const blocks = findBalancedBlocks(text);
  if (blocks.length === 0) return text.trim().replace(/[\r\n\t]/g, "");

  const beforeFirst = text.substring(0, blocks[0].start);
  const indentMatch = beforeFirst.match(/([ \t]*)$/);
  const indent = indentMatch ? indentMatch[1] : "";
  const lines: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const raw = text.substring(block.start, block.end + 1);
    const compacted = raw
      .replace(/[\r\n\t]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/\{\s+/g, "{ ")
      .replace(/\s+\}/g, " }");

    const nextStart =
      i + 1 < blocks.length ? blocks[i + 1].start : text.length;
    const trailing = text.substring(block.end + 1, nextStart).trim();

    if (trailing === "," || trailing.startsWith(",")) {
      lines.push(indent + compacted + ",");
    } else {
      lines.push(indent + compacted + (trailing ? " " + trailing : ""));
    }
  }
  return lines.join("\n");
}
