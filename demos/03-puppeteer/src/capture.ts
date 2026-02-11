#!/usr/bin/env bun
/**
 * Solution 03: Puppeteer Screenshot Capture
 *
 * Renders code frames as HTML styled like VS Code dark theme in a headless
 * Chromium browser, then captures pixel-perfect PNG screenshots.
 *
 * Advantages over Solution 01 (SVG):
 * - Real font rendering (sub-pixel antialiasing, ligatures)
 * - Proper CSS layout (no manual character-width calculations)
 * - Higher visual fidelity
 *
 * Usage:
 *   bun demos/03-puppeteer/src/capture.ts [scenario]
 *   bun demos/03-puppeteer/src/capture.ts          # all
 *   bun demos/03-puppeteer/src/capture.ts toggle   # specific
 *
 * Output: demos/03-puppeteer/output/screenshots/<scenario>/<NNN>.png
 */

import puppeteer from "puppeteer";
import { mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import {
  getScenarios,
  type Scenario,
  type ScenarioStep,
} from "../../shared/src/scenarios";

// ── Paths ────────────────────────────────────────────────────

const SOLUTION_DIR = join(dirname(import.meta.path), "..");
const SCREENSHOTS_DIR = join(SOLUTION_DIR, "output", "screenshots");

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

// ── HTML Template ────────────────────────────────────────────

function buildHtml(
  code: string,
  title: string,
  subtitle: string,
  highlight: "all" | null,
): string {
  const lines = code.split("\n");

  const lineElements = lines
    .map((line, i) => {
      const lineNum = i + 1;
      const highlighted = highlight === "all" ? " highlighted" : "";
      const tokenized = tokenizeLine(line);
      return `<div class="line${highlighted}">
        <span class="line-num">${lineNum}</span>
        <span class="line-content">${tokenized}</span>
      </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: #1e1e1e;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
    font-size: 14px;
    line-height: 22px;
    color: #d4d4d4;
    width: 700px;
    -webkit-font-smoothing: antialiased;
  }

  .window {
    border-radius: 8px;
    overflow: hidden;
    background: #1e1e1e;
    border: 1px solid #3c3c3c;
  }

  .title-bar {
    background: #2d2d2d;
    height: 30px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    border-bottom: 1px solid #3c3c3c;
    position: relative;
  }

  .window-controls {
    display: flex;
    gap: 8px;
  }

  .window-controls span {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
  }

  .ctrl-close { background: #ff5f57; }
  .ctrl-minimize { background: #febc2e; }
  .ctrl-maximize { background: #28c840; }

  .title-text {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
    color: #cccccc;
  }

  .editor {
    padding: 12px 0;
    min-height: 80px;
  }

  .line {
    display: flex;
    padding: 0 16px 0 0;
    height: 22px;
    align-items: center;
  }

  .line.highlighted {
    background: rgba(38, 79, 120, 0.6);
  }

  .line-num {
    width: 44px;
    text-align: right;
    color: #858585;
    padding-right: 16px;
    flex-shrink: 0;
    user-select: none;
  }

  .line-content {
    white-space: pre;
  }

  .status-bar {
    background: #007acc;
    height: 24px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 11px;
    color: #ffffff;
  }

  /* Syntax highlighting tokens */
  .tok-key { color: #9cdcfe; }
  .tok-string { color: #ce9178; }
  .tok-number { color: #b5cea8; }
  .tok-keyword { color: #569cd6; }
  .tok-punct { color: #d4d4d4; }
</style>
</head>
<body>
  <div class="window">
    <div class="title-bar">
      <div class="window-controls">
        <span class="ctrl-close"></span>
        <span class="ctrl-minimize"></span>
        <span class="ctrl-maximize"></span>
      </div>
      <span class="title-text">${escapeHtml(title)}</span>
    </div>
    <div class="editor">
      ${lineElements}
    </div>
    <div class="status-bar">${escapeHtml(subtitle)}</div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Simple JSON-like syntax tokenizer — returns HTML with span classes.
 */
function tokenizeLine(line: string): string {
  let result = "";
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    // Quoted string
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < line.length && line[j] !== quote) j++;
      j++;
      const content = escapeHtml(line.substring(i, j));
      const rest = line.substring(j).trimStart();
      const cls = rest.startsWith(":") ? "tok-key" : "tok-string";
      result += `<span class="${cls}">${content}</span>`;
      i = j;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      result += `<span class="tok-number">${escapeHtml(line.substring(i, j))}</span>`;
      i = j;
      continue;
    }

    // Keywords
    if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < line.length && /[a-zA-Z_]/.test(line[j])) j++;
      const word = line.substring(i, j);
      if (["true", "false", "null"].includes(word)) {
        result += `<span class="tok-keyword">${escapeHtml(word)}</span>`;
      } else {
        result += escapeHtml(word);
      }
      i = j;
      continue;
    }

    // Punctuation
    if (/[{}[\]:,]/.test(ch)) {
      result += `<span class="tok-punct">${escapeHtml(ch)}</span>`;
    } else {
      result += escapeHtml(ch);
    }
    i++;
  }

  return result;
}

// ── Main ─────────────────────────────────────────────────────

async function captureScenario(
  browser: puppeteer.Browser,
  scenario: Scenario,
): Promise<void> {
  console.log(`▶ Capturing scenario: ${scenario.name}`);
  const dir = join(SCREENSHOTS_DIR, scenario.name);
  ensureDir(dir);

  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 600, deviceScaleFactor: 2 });

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    const html = buildHtml(
      step.code,
      scenario.title,
      step.subtitle,
      step.highlight,
    );

    await page.setContent(html, { waitUntil: "domcontentloaded" });
    // Brief wait for layout to settle
    await new Promise((r) => setTimeout(r, 200));

    const windowEl = await page.$(".window");
    if (windowEl) {
      const filepath = join(dir, `${String(i).padStart(3, "0")}-${step.label}.png`);
      await windowEl.screenshot({ path: filepath });
      console.log(`  📸 ${String(i).padStart(3, "0")}-${step.label}.png`);
    }
  }

  await page.close();
  console.log(
    `  ✓ ${scenario.steps.length} screenshots → ${dir}/`,
  );
}

async function main(): Promise<void> {
  const filter = process.argv[2] || "all";
  const scenarios = getScenarios(filter);

  console.log("═══ Solution 03: Puppeteer Screenshot Capture ═══");
  console.log(`Output: ${SCREENSHOTS_DIR}`);
  console.log("");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    for (const scenario of scenarios) {
      await captureScenario(browser, scenario);
    }
  } finally {
    await browser.close();
  }

  console.log("");
  console.log("═══ Capture Complete ═══");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
