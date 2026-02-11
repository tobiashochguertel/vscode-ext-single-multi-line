/**
 * Solution 02: VS Code Test Electron — Scenario Runner
 *
 * Runs inside the VS Code Extension Development Host.
 * Opens fixture files, executes extension commands, and captures
 * screenshots via macOS `screencapture`.
 *
 * This file is the test entry point passed to @vscode/test-electron.
 */

import * as vscode from "vscode";
import * as path from "path";
import { execSync } from "child_process";
import * as fs from "fs";

const SOLUTION_DIR = path.resolve(__dirname, "..", "..");
const SCREENSHOT_DIR = path.join(SOLUTION_DIR, "output", "screenshots");
const FIXTURES_DIR = path.resolve(SOLUTION_DIR, "..", "fixtures");
const GOLDENS_DIR = path.join(SOLUTION_DIR, "goldens");

/** When true, write actual editor content as new golden files instead of verifying. */
const UPDATE_GOLDENS = process.env.UPDATE_GOLDENS === "1" || process.env.UPDATE_GOLDENS === "true";

let screenshotCounter = 0;
let currentScenario = "default";
let verificationErrors: string[] = [];
let verificationPasses: string[] = [];
const REPORT_PATH = path.join(SOLUTION_DIR, "output", "verification-report.txt");

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cached macOS window ID for the VS Code Electron window.
 * Resolved once and reused for all screenshots.
 */
let cachedWindowId: string | null = null;

/**
 * Find the VS Code Electron window ID using a compiled Swift helper
 * that queries macOS CoreGraphics CGWindowListCopyWindowInfo.
 *
 * The VS Code test instance typically runs as "Electron".
 */
function findVSCodeWindowId(): string | null {
  if (cachedWindowId !== null) {
    return cachedWindowId;
  }

  const helperBin = path.join(SOLUTION_DIR, "scripts", "find-window-id");

  // Try "Electron" first (VS Code test instance), then "Code" as fallback
  for (const ownerName of ["Electron", "Code"]) {
    try {
      const result = execSync(`"${helperBin}" ${ownerName}`, {
        timeout: 3000,
        encoding: "utf-8",
      }).trim();

      if (result && /^\d+$/.test(result)) {
        cachedWindowId = result;
        console.log(`  🪟 Found window ID: ${cachedWindowId} (owner: ${ownerName})`);
        return cachedWindowId;
      }
    } catch {
      // Not found with this owner name, try next
    }
  }

  console.warn("  ⚠ Could not find VS Code window ID — falling back to full-screen capture");
  return null;
}

/**
 * Capture a screenshot of the VS Code window using macOS `screencapture`.
 *
 * Uses `-l <windowID>` to capture only the VS Code window.
 * Falls back to full-screen capture if the window ID cannot be determined.
 *
 * NOTE: Requires the calling application (VS Code / Windsurf / Terminal)
 * to be added to macOS System Settings → Privacy & Security → Screen Recording.
 */
function captureScreenshot(label: string): string {
  const scenarioDir = path.join(SCREENSHOT_DIR, currentScenario);
  ensureDir(scenarioDir);

  const paddedCounter = String(screenshotCounter++).padStart(3, "0");
  const filename = `${paddedCounter}-${label}.png`;
  const filepath = path.join(scenarioDir, filename);

  try {
    const windowId = findVSCodeWindowId();
    if (windowId) {
      // Capture only the VS Code window (with shadow via -o to omit shadow)
      execSync(`screencapture -x -o -l ${windowId} "${filepath}"`, {
        timeout: 10000,
      });
    } else {
      // Fallback: capture entire screen
      execSync(`screencapture -x "${filepath}"`, {
        timeout: 10000,
      });
    }
    console.log(`  📸 ${filename}`);
  } catch (e: any) {
    console.warn(`  ⚠ Screenshot failed for ${label}: ${e.message}`);
  }

  return filepath;
}

async function openFixture(fixtureName: string): Promise<vscode.TextEditor> {
  const fixturePath = path.join(FIXTURES_DIR, fixtureName);
  console.log(`  Opening fixture: ${fixturePath}`);
  const doc = await vscode.workspace.openTextDocument(fixturePath);
  const editor = await vscode.window.showTextDocument(doc, { preview: false });
  await sleep(1000);
  return editor;
}

function selectAll(editor: vscode.TextEditor): void {
  const doc = editor.document;
  const lastLine = doc.lineCount - 1;
  const lastChar = doc.lineAt(lastLine).text.length;
  editor.selection = new vscode.Selection(0, 0, lastLine, lastChar);
}

/**
 * Get the full text content of the active editor.
 */
function getEditorContent(editor: vscode.TextEditor): string {
  return editor.document.getText();
}

/**
 * Verify the editor content against a golden file.
 *
 * - If UPDATE_GOLDENS is set, writes the actual content as the new golden.
 * - Otherwise, compares actual content against the golden and logs pass/fail.
 */
function verifyGolden(editor: vscode.TextEditor, stepLabel: string): void {
  const scenarioGoldensDir = path.join(GOLDENS_DIR, currentScenario);
  ensureDir(scenarioGoldensDir);

  const goldenPath = path.join(scenarioGoldensDir, `${stepLabel}.txt`);
  const actual = getEditorContent(editor);

  if (UPDATE_GOLDENS) {
    fs.writeFileSync(goldenPath, actual, "utf-8");
    console.log(`  🖊  Updated golden: ${stepLabel}.txt`);
    return;
  }

  if (!fs.existsSync(goldenPath)) {
    const msg = `  ⚠ Golden missing: ${stepLabel}.txt — run with UPDATE_GOLDENS=1 to create`;
    console.warn(msg);
    verificationErrors.push(`[${currentScenario}] ${msg.trim()}`);
    return;
  }

  const expected = fs.readFileSync(goldenPath, "utf-8");
  if (actual === expected) {
    console.log(`  ✅ Verified: ${stepLabel}`);
    verificationPasses.push(`[${currentScenario}] ${stepLabel}`);
  } else {
    const msg = `Golden mismatch: ${stepLabel}`;
    console.error(`  ❌ ${msg}`);
    console.error(`     Expected (${expected.length} chars):\n${indent(expected)}`);
    console.error(`     Actual   (${actual.length} chars):\n${indent(actual)}`);
    verificationErrors.push(`[${currentScenario}] ${msg}\n  Expected:\n${indent(expected)}\n  Actual:\n${indent(actual)}`);
  }
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => "       | " + l)
    .join("\n");
}

// ── Scenarios ────────────────────────────────────────────────

async function scenarioToggle(): Promise<void> {
  currentScenario = "toggle";
  screenshotCounter = 0;
  console.log("▶ Recording scenario: toggle");

  const editor = await openFixture("toggle-multiline.json");
  await sleep(500);
  verifyGolden(editor, "01-single-line-before");
  captureScreenshot("01-single-line-before");

  selectAll(editor);
  await sleep(500);
  captureScreenshot("02-selected");

  await vscode.commands.executeCommand("extension.singleMultiLine", { isCommaOnNewLine: false });
  await sleep(1000);
  verifyGolden(editor, "03-multi-line-after");
  captureScreenshot("03-multi-line-after");

  selectAll(editor);
  await sleep(500);
  captureScreenshot("04-selected-again");

  await vscode.commands.executeCommand("extension.singleMultiLine", { isCommaOnNewLine: false });
  await sleep(1000);
  verifyGolden(editor, "05-single-line-restored");
  captureScreenshot("05-single-line-restored");

  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  console.log("✓ Scenario toggle complete");
}

async function scenarioCompactBlocks(): Promise<void> {
  currentScenario = "compact";
  screenshotCounter = 0;
  console.log("▶ Recording scenario: compact-blocks");

  const editor = await openFixture("compact-blocks.json");
  await sleep(500);
  verifyGolden(editor, "01-multiline-blocks");
  captureScreenshot("01-multiline-blocks");

  selectAll(editor);
  await sleep(500);
  captureScreenshot("02-selected");

  await vscode.commands.executeCommand("extension.compactBlocks");
  await sleep(1000);
  verifyGolden(editor, "03-compacted");
  captureScreenshot("03-compacted");

  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  console.log("✓ Scenario compact-blocks complete");
}

async function scenarioToggleFromMulti(): Promise<void> {
  currentScenario = "toggle-from-multi";
  screenshotCounter = 0;
  console.log("▶ Recording scenario: toggle-from-multi-line");

  const editor = await openFixture("toggle-singleline.json");
  await sleep(500);
  verifyGolden(editor, "01-multi-line-before");
  captureScreenshot("01-multi-line-before");

  selectAll(editor);
  await sleep(500);
  captureScreenshot("02-selected");

  await vscode.commands.executeCommand("extension.singleMultiLine", { isCommaOnNewLine: false });
  await sleep(1000);
  verifyGolden(editor, "03-single-line-after");
  captureScreenshot("03-single-line-after");

  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  console.log("✓ Scenario toggle-from-multi-line complete");
}

// ── Main ─────────────────────────────────────────────────────

export async function run(): Promise<void> {
  console.log("═══ Solution 02: VS Code Test Electron ═══");
  console.log(`Screenshots dir: ${SCREENSHOT_DIR}`);
  console.log(`Fixtures dir: ${FIXTURES_DIR}`);

  ensureDir(SCREENSHOT_DIR);

  // Wait for extension to activate
  await sleep(2000);

  // Increase font size for better GIF readability
  for (let i = 0; i < 3; i++) {
    await vscode.commands.executeCommand("editor.action.fontZoomIn");
  }
  await sleep(500);

  const scenario = process.env.DEMO_SCENARIO || "all";

  if (scenario === "all" || scenario === "toggle") {
    await scenarioToggle();
  }
  if (scenario === "all" || scenario === "compact") {
    await scenarioCompactBlocks();
  }
  if (scenario === "all" || scenario === "toggle-from-multi") {
    await scenarioToggleFromMulti();
  }

  // Reset font size
  await vscode.commands.executeCommand("editor.action.fontZoomReset");
  await sleep(300);

  // ── Verification Summary ──────────────────────────────────
  const reportLines: string[] = [];
  reportLines.push(`Verification Report — ${new Date().toISOString()}`);
  reportLines.push(`Mode: ${UPDATE_GOLDENS ? "UPDATE" : "VERIFY"}`);
  reportLines.push("");

  if (UPDATE_GOLDENS) {
    reportLines.push("Golden files updated.");
    console.log("");
    console.log("═══ Golden files updated ═══");
  } else if (verificationErrors.length > 0) {
    reportLines.push(`RESULT: ❌ FAILED — ${verificationErrors.length} error(s), ${verificationPasses.length} passed`);
    reportLines.push("");
    reportLines.push("Passed:");
    for (const p of verificationPasses) {
      reportLines.push(`  ✅ ${p}`);
    }
    reportLines.push("");
    reportLines.push("Failed:");
    for (const err of verificationErrors) {
      reportLines.push(`  ❌ ${err}`);
    }
    console.error("");
    console.error("═══ ❌ Verification FAILED ═══");
    for (const err of verificationErrors) {
      console.error(`  • ${err}`);
    }
    console.error(`${verificationErrors.length} verification error(s)`);
  } else {
    reportLines.push(`RESULT: ✅ ALL PASSED — ${verificationPasses.length} verification(s)`);
    reportLines.push("");
    for (const p of verificationPasses) {
      reportLines.push(`  ✅ ${p}`);
    }
    console.log("");
    console.log("═══ ✅ All verifications passed ═══");
  }

  // Write report file so it's visible even when CLI doesn't relay stdout
  ensureDir(path.dirname(REPORT_PATH));
  fs.writeFileSync(REPORT_PATH, reportLines.join("\n") + "\n", "utf-8");
  console.log(`Report: ${REPORT_PATH}`);

  console.log("");
  console.log("═══ Recording Complete ═══");
}
