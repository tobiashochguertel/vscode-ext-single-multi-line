#!/usr/bin/env bun
/**
 * Solution 01: SVG Frame Generator
 *
 * Generates SVG frames styled like a VS Code dark theme editor,
 * using the extension's transformer functions to produce before/after states.
 *
 * Usage:
 *   bun demos/01-svg-frames/src/generate-frames.ts [scenario]
 *   bun demos/01-svg-frames/src/generate-frames.ts          # all
 *   bun demos/01-svg-frames/src/generate-frames.ts toggle   # specific
 *
 * Output: demos/01-svg-frames/output/frames/<scenario>/<NNN>.svg
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { getScenarios, type ScenarioStep } from "../../shared/src/scenarios";

// ── VS Code Dark Theme ───────────────────────────────────────

const THEME = {
  bg: "#1e1e1e",
  fg: "#d4d4d4",
  lineNum: "#858585",
  selection: "#264f78",
  keyword: "#569cd6",
  string: "#ce9178",
  punct: "#d4d4d4",
  key: "#9cdcfe",
  number: "#b5cea8",
  titleBg: "#2d2d2d",
  titleFg: "#cccccc",
  titleBorder: "#3c3c3c",
  statusBg: "#007acc",
  statusFg: "#ffffff",
} as const;

const FONT_SIZE = 14;
const LINE_HEIGHT = 22;
const CHAR_WIDTH = 8.4;
const PADDING_LEFT = 60;
const TITLE_HEIGHT = 30;
const STATUS_HEIGHT = 24;
const SVG_WIDTH = 700;

// ── SVG Helpers ──────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface Span {
  text: string;
  color: string;
}

function highlightLine(line: string): Span[] {
  const spans: Span[] = [];
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    // Quoted string
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < line.length && line[j] !== quote) j++;
      j++;
      const content = line.substring(i, j);
      const rest = line.substring(j).trimStart();
      spans.push({
        text: content,
        color: rest.startsWith(":") ? THEME.key : THEME.string,
      });
      i = j;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      spans.push({ text: line.substring(i, j), color: THEME.number });
      i = j;
      continue;
    }

    // Keywords
    if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < line.length && /[a-zA-Z_]/.test(line[j])) j++;
      const word = line.substring(i, j);
      spans.push({
        text: word,
        color: ["true", "false", "null"].includes(word)
          ? THEME.keyword
          : THEME.fg,
      });
      i = j;
      continue;
    }

    spans.push({
      text: ch,
      color: /[{}[\]:,]/.test(ch) ? THEME.punct : THEME.fg,
    });
    i++;
  }

  return spans;
}

function renderFrame(
  code: string,
  title: string,
  subtitle: string,
  highlight: "all" | null,
): string {
  const lines = code.split("\n");
  const contentHeight =
    lines.length * LINE_HEIGHT + TITLE_HEIGHT + 16 + STATUS_HEIGHT + 20;
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

  const codeStartY = TITLE_HEIGHT + 16;

  for (let i = 0; i < lines.length; i++) {
    const y = codeStartY + i * LINE_HEIGHT + FONT_SIZE;
    const lineNum = i + 1;

    if (highlight === "all") {
      svg += `  <rect x="${PADDING_LEFT - 4}" y="${y - FONT_SIZE + 2}" width="${SVG_WIDTH - PADDING_LEFT}" height="${LINE_HEIGHT}" fill="${THEME.selection}" opacity="0.6"/>\n`;
    }

    svg += `  <text x="${PADDING_LEFT - 16}" y="${y}" text-anchor="end" fill="${THEME.lineNum}" class="code">${lineNum}</text>\n`;

    const spans = highlightLine(lines[i]);
    let xPos = PADDING_LEFT;
    for (const span of spans) {
      svg += `  <text x="${xPos}" y="${y}" fill="${span.color}" class="code">${escapeXml(span.text)}</text>\n`;
      xPos += span.text.length * CHAR_WIDTH;
    }
  }

  const statusY = svgHeight - STATUS_HEIGHT;
  svg += `
  <!-- Status bar -->
  <rect y="${statusY}" width="${SVG_WIDTH}" height="${STATUS_HEIGHT}" fill="${THEME.statusBg}"/>
  <rect y="${statusY}" width="${SVG_WIDTH}" height="4" fill="${THEME.statusBg}"/>
  <text x="12" y="${statusY + 16}" fill="${THEME.statusFg}" class="status">${escapeXml(subtitle)}</text>
`;

  svg += `</svg>`;
  return svg;
}

// ── Main ─────────────────────────────────────────────────────

const SOLUTION_DIR = join(dirname(import.meta.path), "..");
const FRAMES_DIR = join(SOLUTION_DIR, "output", "frames");

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function saveFrame(scenario: string, index: number, svg: string): string {
  const dir = join(FRAMES_DIR, scenario);
  ensureDir(dir);
  const file = join(dir, `${String(index).padStart(3, "0")}.svg`);
  writeFileSync(file, svg);
  return file;
}

const filter = process.argv[2] || "all";
const scenarios = getScenarios(filter);

console.log("═══ Solution 01: SVG Frame Generator ═══");
console.log(`Output: ${FRAMES_DIR}`);
console.log("");

for (const scenario of scenarios) {
  console.log(`▶ Generating frames: ${scenario.name}`);
  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    saveFrame(
      scenario.name,
      i,
      renderFrame(step.code, scenario.title, step.subtitle, step.highlight),
    );
  }
  console.log(
    `  ✓ ${scenario.steps.length} frames → ${FRAMES_DIR}/${scenario.name}/`,
  );
}

console.log("");
console.log("═══ Frame Generation Complete ═══");
