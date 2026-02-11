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

let screenshotCounter = 0;
let currentScenario = "default";

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Capture a screenshot of the entire screen using macOS `screencapture`.
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
    // Capture the entire screen — most reliable approach on macOS.
    // The -x flag suppresses the shutter sound.
    execSync(`screencapture -x "${filepath}"`, {
      timeout: 10000,
    });
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

// ── Scenarios ────────────────────────────────────────────────

async function scenarioToggle(): Promise<void> {
  currentScenario = "toggle";
  screenshotCounter = 0;
  console.log("▶ Recording scenario: toggle");

  const editor = await openFixture("toggle-multiline.json");
  await sleep(500);
  captureScreenshot("01-single-line-before");

  selectAll(editor);
  await sleep(500);
  captureScreenshot("02-selected");

  await vscode.commands.executeCommand("extension.singleMultiLine");
  await sleep(1000);
  captureScreenshot("03-multi-line-after");

  selectAll(editor);
  await sleep(500);
  captureScreenshot("04-selected-again");

  await vscode.commands.executeCommand("extension.singleMultiLine");
  await sleep(1000);
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
  captureScreenshot("01-multiline-blocks");

  selectAll(editor);
  await sleep(500);
  captureScreenshot("02-selected");

  await vscode.commands.executeCommand("extension.compactBlocks");
  await sleep(1000);
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
  captureScreenshot("01-multi-line-before");

  selectAll(editor);
  await sleep(500);
  captureScreenshot("02-selected");

  await vscode.commands.executeCommand("extension.singleMultiLine");
  await sleep(1000);
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

  console.log("");
  console.log("═══ Recording Complete ═══");
}
