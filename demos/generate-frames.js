#!/usr/bin/env node
/**
 * Generate SVG frames for demo GIFs.
 *
 * This script imports the extension's transformer functions directly,
 * generates before/after text states for each feature, and renders
 * them as SVG frames styled like a VS Code dark theme editor.
 *
 * Usage:
 *   node demos/generate-frames.js [scenario]
 *   node demos/generate-frames.js          # all scenarios
 *   node demos/generate-frames.js toggle   # specific scenario
 *
 * Output: demos/frames/<scenario>/<NNN>.svg
 */

const fs = require('fs');
const path = require('path');

// ── Import extension functions ───────────────────────────────
// We require the compiled JS from out/ (esbuild bundles everything into main.js,
// but the individual tsc-compiled files are also available after `tsc -p .`)
// For simplicity, we inline the logic here to avoid build dependency issues.

/**
 * Inline parser: find balanced { } blocks respecting quoted strings.
 */
function findBalancedBlocks(text) {
  const blocks = [];
  let depth = 0;
  let blockStart = -1;
  let isInString = false;
  let currentQuote = '';
  const QUOTE_RE = /['"`]/;

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

    if (ch === '{') {
      if (depth === 0) blockStart = i;
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

/**
 * Inline transformer: compact blocks.
 */
function compactBlocks(text) {
  const blocks = findBalancedBlocks(text);
  if (blocks.length === 0) return text.trim().replace(/[\r\n\t]/g, '');

  const beforeFirst = text.substring(0, blocks[0].start);
  const indentMatch = beforeFirst.match(/([ \t]*)$/);
  const indent = indentMatch ? indentMatch[1] : '';
  const lines = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const raw = text.substring(block.start, block.end + 1);
    const compacted = raw
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .replace(/\{\s+/g, '{ ')
      .replace(/\s+\}/g, ' }');

    const nextStart = i + 1 < blocks.length ? blocks[i + 1].start : text.length;
    let trailing = text.substring(block.end + 1, nextStart).trim();

    if (trailing === ',' || trailing.startsWith(',')) {
      lines.push(indent + compacted + ',');
    } else {
      lines.push(indent + compacted + (trailing ? ' ' + trailing : ''));
    }
  }
  return lines.join('\n');
}

/**
 * Inline transformer: toggle single/multi line.
 */
function findSeparatorIndexes(text) {
  let isInString = false;
  let currentQuote = '';
  const result = [];
  const QUOTE_RE = /['"`]/;

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
    if (QUOTE_RE.test(ch)) {
      if (!isInString) { currentQuote = ch; isInString = true; }
      else if (currentQuote === ch) { isInString = false; }
    }
  }
  return result;
}

function toSingleLine(text) {
  return text.trim().replace(/[\r\n\t]/g, '');
}

function toMultiLine(text, isCommaOnNewLine) {
  const separators = findSeparatorIndexes(text);
  const chars = text.split('');
  separators.forEach(({ index, isComma }) => {
    if (isCommaOnNewLine && isComma) {
      chars[index] = '\n' + chars[index];
    } else {
      chars[index] += '\n';
    }
  });
  return chars.join('');
}

function toggleLineLayout(text) {
  const trimmed = text.trim();
  if (!trimmed.length) return text;
  const isMulti = /[\r\n]/.test(trimmed);
  return isMulti ? toSingleLine(trimmed) : toMultiLine(trimmed, false);
}

// ── SVG Rendering ────────────────────────────────────────────

const THEME = {
  bg: '#1e1e1e',
  fg: '#d4d4d4',
  lineNum: '#858585',
  selection: '#264f78',
  keyword: '#569cd6',
  string: '#ce9178',
  punct: '#d4d4d4',
  key: '#9cdcfe',
  titleBg: '#2d2d2d',
  titleFg: '#cccccc',
  titleBorder: '#3c3c3c',
  statusBg: '#007acc',
  statusFg: '#ffffff',
};

const FONT_SIZE = 14;
const LINE_HEIGHT = 22;
const CHAR_WIDTH = 8.4;
const PADDING_LEFT = 60;
const PADDING_TOP = 40;
const TITLE_HEIGHT = 30;
const STATUS_HEIGHT = 24;
const SVG_WIDTH = 700;

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Simple JSON-like syntax highlighting.
 * Returns an array of { text, color } spans for a single line.
 */
function highlightLine(line) {
  const spans = [];
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    // Quoted string
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < line.length && line[j] !== quote) j++;
      j++; // include closing quote
      const content = line.substring(i, j);

      // Check if this is a key (followed by :)
      const rest = line.substring(j).trimStart();
      if (rest.startsWith(':')) {
        spans.push({ text: content, color: THEME.key });
      } else {
        spans.push({ text: content, color: THEME.string });
      }
      i = j;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      spans.push({ text: line.substring(i, j), color: '#b5cea8' });
      i = j;
      continue;
    }

    // Keywords
    if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < line.length && /[a-zA-Z_]/.test(line[j])) j++;
      const word = line.substring(i, j);
      if (['true', 'false', 'null'].includes(word)) {
        spans.push({ text: word, color: THEME.keyword });
      } else {
        spans.push({ text: word, color: THEME.fg });
      }
      i = j;
      continue;
    }

    // Punctuation and whitespace
    spans.push({ text: ch, color: /[{}[\]:,]/.test(ch) ? THEME.punct : THEME.fg });
    i++;
  }

  return spans;
}

/**
 * Render a code frame as SVG.
 */
function renderFrame(code, title, subtitle, highlight) {
  const lines = code.split('\n');
  const contentHeight = lines.length * LINE_HEIGHT + PADDING_TOP + STATUS_HEIGHT + 20;
  const svgHeight = Math.max(contentHeight, 200);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${svgHeight}" viewBox="0 0 ${SVG_WIDTH} ${svgHeight}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&amp;display=swap');
      .code { font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace; font-size: ${FONT_SIZE}px; }
      .title { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; }
      .status { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; }
    </style>
  </defs>

  <!-- Background -->
  <rect width="${SVG_WIDTH}" height="${svgHeight}" fill="${THEME.bg}" rx="8"/>

  <!-- Title bar -->
  <rect width="${SVG_WIDTH}" height="${TITLE_HEIGHT}" fill="${THEME.titleBg}" rx="8"/>
  <rect y="${TITLE_HEIGHT - 4}" width="${SVG_WIDTH}" height="4" fill="${THEME.titleBg}"/>
  <line x1="0" y1="${TITLE_HEIGHT}" x2="${SVG_WIDTH}" y2="${TITLE_HEIGHT}" stroke="${THEME.titleBorder}" stroke-width="1"/>

  <!-- Window controls -->
  <circle cx="16" cy="${TITLE_HEIGHT / 2}" r="6" fill="#ff5f57"/>
  <circle cx="36" cy="${TITLE_HEIGHT / 2}" r="6" fill="#febc2e"/>
  <circle cx="56" cy="${TITLE_HEIGHT / 2}" r="6" fill="#28c840"/>

  <!-- Title text -->
  <text x="${SVG_WIDTH / 2}" y="${TITLE_HEIGHT / 2 + 4}" text-anchor="middle" fill="${THEME.titleFg}" class="title">${escapeXml(title)}</text>
`;

  // Line numbers and code
  const codeStartY = TITLE_HEIGHT + 16;

  for (let i = 0; i < lines.length; i++) {
    const y = codeStartY + i * LINE_HEIGHT + FONT_SIZE;
    const lineNum = i + 1;

    // Selection highlight
    if (highlight === 'all' || (Array.isArray(highlight) && highlight.includes(i))) {
      svg += `  <rect x="${PADDING_LEFT - 4}" y="${y - FONT_SIZE + 2}" width="${SVG_WIDTH - PADDING_LEFT}" height="${LINE_HEIGHT}" fill="${THEME.selection}" opacity="0.6"/>
`;
    }

    // Line number
    svg += `  <text x="${PADDING_LEFT - 16}" y="${y}" text-anchor="end" fill="${THEME.lineNum}" class="code">${lineNum}</text>
`;

    // Syntax-highlighted code
    const spans = highlightLine(lines[i]);
    let xPos = PADDING_LEFT;
    for (const span of spans) {
      svg += `  <text x="${xPos}" y="${y}" fill="${span.color}" class="code">${escapeXml(span.text)}</text>
`;
      xPos += span.text.length * CHAR_WIDTH;
    }
  }

  // Status bar
  const statusY = svgHeight - STATUS_HEIGHT;
  svg += `
  <!-- Status bar -->
  <rect y="${statusY}" width="${SVG_WIDTH}" height="${STATUS_HEIGHT}" fill="${THEME.statusBg}" rx="0"/>
  <rect y="${statusY}" width="${SVG_WIDTH}" height="4" fill="${THEME.statusBg}"/>
  <text x="12" y="${statusY + 16}" fill="${THEME.statusFg}" class="status">${escapeXml(subtitle)}</text>
`;

  svg += `</svg>`;
  return svg;
}

// ── Scenarios ────────────────────────────────────────────────

const FRAMES_DIR = path.join(__dirname, 'frames');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function saveFrame(scenario, index, svg) {
  const dir = path.join(FRAMES_DIR, scenario);
  ensureDir(dir);
  const file = path.join(dir, `${String(index).padStart(3, '0')}.svg`);
  fs.writeFileSync(file, svg);
  return file;
}

function scenarioToggle() {
  const scenario = 'toggle';
  console.log(`▶ Generating frames: ${scenario}`);

  const singleLine = '{ "name": "Alice", "age": 30, "city": "Berlin", "role": "Developer" }';
  const multiLine = toggleLineLayout(singleLine);

  // Frame 1: Single-line (before)
  saveFrame(scenario, 0, renderFrame(singleLine, 'example.json', '▸ Single-line object — ready to expand', null));

  // Frame 2: Selected
  saveFrame(scenario, 1, renderFrame(singleLine, 'example.json', '▸ Select all → Ctrl+Cmd+S to toggle', 'all'));

  // Frame 3: Multi-line (after toggle)
  saveFrame(scenario, 2, renderFrame(multiLine, 'example.json', '✓ Expanded to multi-line', null));

  // Frame 4: Selected again
  saveFrame(scenario, 3, renderFrame(multiLine, 'example.json', '▸ Select all → Ctrl+Cmd+S to toggle back', 'all'));

  // Frame 5: Back to single-line
  saveFrame(scenario, 4, renderFrame(singleLine, 'example.json', '✓ Collapsed back to single-line', null));

  console.log(`  ✓ 5 frames → demos/frames/${scenario}/`);
}

function scenarioCompact() {
  const scenario = 'compact';
  console.log(`▶ Generating frames: ${scenario}`);

  const multiBlocks = `{
  "name": "content",
  "regexp": "*"
},
{
  "name": "filename",
  "regexp": "*"
},
{
  "name": "path",
  "regexp": "/src/**"
}`;

  const compacted = compactBlocks(multiBlocks);

  // Frame 1: Multi-line blocks (before)
  saveFrame(scenario, 0, renderFrame(multiBlocks, 'settings.json', '▸ Multiple multiline objects — ready to compact', null));

  // Frame 2: Selected
  saveFrame(scenario, 1, renderFrame(multiBlocks, 'settings.json', '▸ Select all → Ctrl+Cmd+B to compact blocks', 'all'));

  // Frame 3: Compacted (after)
  saveFrame(scenario, 2, renderFrame(compacted, 'settings.json', '✓ Each object compacted to one line', null));

  console.log(`  ✓ 3 frames → demos/frames/${scenario}/`);
}

function scenarioToggleFromMulti() {
  const scenario = 'toggle-from-multi';
  console.log(`▶ Generating frames: ${scenario}`);

  const multiLine = `{
  "name": "Alice",
  "age": 30,
  "city": "Berlin",
  "role": "Developer"
}`;
  const singleLine = toggleLineLayout(multiLine);

  // Frame 1: Multi-line (before)
  saveFrame(scenario, 0, renderFrame(multiLine, 'example.json', '▸ Multi-line object — ready to collapse', null));

  // Frame 2: Selected
  saveFrame(scenario, 1, renderFrame(multiLine, 'example.json', '▸ Select all → Ctrl+Cmd+S to toggle', 'all'));

  // Frame 3: Single-line (after)
  saveFrame(scenario, 2, renderFrame(singleLine, 'example.json', '✓ Collapsed to single-line', null));

  console.log(`  ✓ 3 frames → demos/frames/${scenario}/`);
}

// ── Main ─────────────────────────────────────────────────────

const scenario = process.argv[2] || 'all';

console.log('═══ Demo Frame Generator ═══');
console.log(`Output: demos/frames/`);
console.log('');

if (scenario === 'all' || scenario === 'toggle') scenarioToggle();
if (scenario === 'all' || scenario === 'compact') scenarioCompact();
if (scenario === 'all' || scenario === 'toggle-from-multi') scenarioToggleFromMulti();

console.log('');
console.log('═══ Frame Generation Complete ═══');
console.log('Run `./demos/assemble-gif.sh` to convert frames to optimized GIFs.');
