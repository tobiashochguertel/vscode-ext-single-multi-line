/**
 * vscode-demo-recorder — Scenario Runner
 *
 * Runs inside the VS Code Extension Development Host.
 * Reads scenario definitions from the config file (via DEMO_CONFIG_PATH env var)
 * and executes steps generically: open fixtures, run commands, verify goldens,
 * capture screenshots.
 *
 * This file is the test entry point passed to @vscode/test-electron.
 */

import * as vscode from "vscode";
import * as path from "path";
import { execSync } from "child_process";
import * as fs from "fs";

// ── Types (mirrored from schema.ts for CommonJS compatibility) ──

interface StepOpen { action: "open"; fixture: string; }
interface StepSelectAll { action: "selectAll"; }
interface StepCommand { action: "command"; command: string; args?: Record<string, unknown>; }
interface StepVerify { action: "verify"; golden: string; }
interface StepScreenshot { action: "screenshot"; label: string; }
interface StepSleep { action: "sleep"; ms: number; }
interface StepCloseEditor { action: "closeEditor"; }

type ScenarioStep =
  | StepOpen | StepSelectAll | StepCommand | StepVerify
  | StepScreenshot | StepSleep | StepCloseEditor;

interface Scenario {
  name: string;
  description?: string;
  steps: ScenarioStep[];
}

interface VscodeEnv {
  settings: Record<string, unknown>;
  fontZoomLevel: number;
  cliFlags: string[];
  wipeUserData: boolean;
}

interface Paths {
  extensionRoot: string;
  fixturesDir: string;
  outputDir: string;
  goldensDir: string;
  gifOutputDir: string;
}

interface RuntimeFlags {
  scenarioFilter: string;
  updateGoldens: boolean;
}

interface RecorderConfig {
  version: string;
  paths: Paths;
  vscode: VscodeEnv;
  gif: Record<string, unknown>;
  scenarios: Scenario[];
  _runtime?: RuntimeFlags;
}

// ── Config Loading ───────────────────────────────────────────

function loadRuntimeConfig(): RecorderConfig {
  // Try env var first, then fall back to well-known path relative to solution dir.
  // The bin/code CLI wrapper doesn't forward custom env vars to Electron,
  // so the record command writes the config to a well-known location.
  const solutionDir = path.resolve(__dirname, "..", "..");
  const wellKnownPath = path.join(solutionDir, "output", ".runtime-config.json");

  const configPath = process.env.DEMO_CONFIG_PATH || wellKnownPath;
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Runtime config not found: ${configPath}\n` +
      "The scenario runner must be launched via the vscode-demo-recorder CLI."
    );
  }
  return JSON.parse(fs.readFileSync(configPath, "utf-8"));
}

// ── State ────────────────────────────────────────────────────

let screenshotCounter = 0;
let currentScenario = "default";
let verificationErrors: string[] = [];
let verificationPasses: string[] = [];
let config: RecorderConfig;

// ── Helpers ──────────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Window ID (macOS screencapture) ──────────────────────────

let cachedWindowId: string | null = null;

function findVSCodeWindowId(): string | null {
  if (cachedWindowId !== null) {
    return cachedWindowId;
  }

  const solutionDir = path.resolve(__dirname, "..", "..");
  const helperBin = path.join(solutionDir, "scripts", "find-window-id");

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

// ── Screenshot ───────────────────────────────────────────────

async function captureScreenshot(label: string): Promise<string> {
  await vscode.commands.executeCommand("notifications.clearAll");
  await sleep(200);

  const screenshotDir = path.join(config.paths.outputDir, "screenshots", currentScenario);
  ensureDir(screenshotDir);

  const paddedCounter = String(screenshotCounter++).padStart(3, "0");
  const filename = `${paddedCounter}-${label}.png`;
  const filepath = path.join(screenshotDir, filename);

  try {
    const windowId = findVSCodeWindowId();
    if (windowId) {
      execSync(`screencapture -x -o -l ${windowId} "${filepath}"`, { timeout: 10000 });
    } else {
      execSync(`screencapture -x "${filepath}"`, { timeout: 10000 });
    }
    console.log(`  📸 ${filename}`);
  } catch (e: any) {
    console.warn(`  ⚠ Screenshot failed for ${label}: ${e.message}`);
  }

  return filepath;
}

// ── Fixture / Editor ─────────────────────────────────────────

async function openFixture(fixtureName: string): Promise<vscode.TextEditor> {
  const fixturePath = path.join(config.paths.fixturesDir, fixtureName);
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

// ── Golden Verification ──────────────────────────────────────

// Resolved after config is loaded; env var is fallback since bin/code may not forward it.
let UPDATE_GOLDENS = process.env.UPDATE_GOLDENS === "1" || process.env.UPDATE_GOLDENS === "true";

function verifyGolden(editor: vscode.TextEditor, stepLabel: string): void {
  const scenarioGoldensDir = path.join(config.paths.goldensDir, currentScenario);
  ensureDir(scenarioGoldensDir);

  const goldenPath = path.join(scenarioGoldensDir, `${stepLabel}.txt`);
  const actual = editor.document.getText();

  if (UPDATE_GOLDENS) {
    fs.writeFileSync(goldenPath, actual, "utf-8");
    console.log(`  🖊  Updated golden: ${stepLabel}.txt`);
    return;
  }

  if (!fs.existsSync(goldenPath)) {
    const msg = `  ⚠ Golden missing: ${stepLabel}.txt — run with --update-goldens to create`;
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
    const indent = (t: string) => t.split("\n").map((l) => "       | " + l).join("\n");
    console.error(`     Expected (${expected.length} chars):\n${indent(expected)}`);
    console.error(`     Actual   (${actual.length} chars):\n${indent(actual)}`);
    verificationErrors.push(
      `[${currentScenario}] ${msg}\n  Expected:\n${indent(expected)}\n  Actual:\n${indent(actual)}`
    );
  }
}

// ── Generic Step Executor ────────────────────────────────────

async function executeStep(
  step: ScenarioStep,
  editorRef: { current: vscode.TextEditor | null }
): Promise<void> {
  switch (step.action) {
    case "open": {
      editorRef.current = await openFixture(step.fixture);
      break;
    }
    case "selectAll": {
      if (editorRef.current) selectAll(editorRef.current);
      break;
    }
    case "command": {
      if (step.args) {
        await vscode.commands.executeCommand(step.command, step.args);
      } else {
        await vscode.commands.executeCommand(step.command);
      }
      break;
    }
    case "verify": {
      if (editorRef.current) verifyGolden(editorRef.current, step.golden);
      break;
    }
    case "screenshot": {
      await captureScreenshot(step.label);
      break;
    }
    case "sleep": {
      await sleep(step.ms);
      break;
    }
    case "closeEditor": {
      await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
      editorRef.current = null;
      break;
    }
    default: {
      console.warn(`  ⚠ Unknown step action: ${(step as any).action}`);
    }
  }
}

// ── Scenario Runner ──────────────────────────────────────────

async function runScenario(scenario: Scenario): Promise<void> {
  currentScenario = scenario.name;
  screenshotCounter = 0;
  console.log(`▶ Recording scenario: ${scenario.name}${scenario.description ? ` — ${scenario.description}` : ""}`);

  const editorRef: { current: vscode.TextEditor | null } = { current: null };

  for (const step of scenario.steps) {
    await executeStep(step, editorRef);
  }

  console.log(`✓ Scenario ${scenario.name} complete`);
}

// ── Main ─────────────────────────────────────────────────────

export async function run(): Promise<void> {
  config = loadRuntimeConfig();

  // Override UPDATE_GOLDENS from runtime config (env var may not be forwarded)
  if (config._runtime?.updateGoldens) {
    UPDATE_GOLDENS = true;
  }

  console.log("═══ vscode-demo-recorder: Scenario Runner ═══");
  console.log(`Fixtures dir: ${config.paths.fixturesDir}`);
  console.log(`Goldens dir:  ${config.paths.goldensDir}`);
  console.log(`Output dir:   ${config.paths.outputDir}`);
  console.log(`Scenarios:    ${config.scenarios.map((s) => s.name).join(", ")}`);

  ensureDir(path.join(config.paths.outputDir, "screenshots"));

  // Wait for extension to activate
  await sleep(2000);

  // Suppress distracting UI elements
  // Wrapped in try/catch: some settings may not exist in all VS Code versions
  // (e.g. chat.commandCenter.enabled is absent in 1.109.2 and throws CodeExpectedError)
  const vsConfig = vscode.workspace.getConfiguration();
  for (const [key, value] of Object.entries({
    "git.autoRepositoryDetection": false,
    "git.enabled": false,
    "chat.commandCenter.enabled": false,
  })) {
    try {
      await vsConfig.update(key, value, vscode.ConfigurationTarget.Global);
    } catch {
      // Setting not registered in this VS Code version — skip silently
    }
  }

  await vscode.commands.executeCommand("notifications.clearAll");
  await sleep(500);

  // Font zoom from config
  for (let i = 0; i < config.vscode.fontZoomLevel; i++) {
    await vscode.commands.executeCommand("editor.action.fontZoomIn");
  }
  await sleep(500);

  // Determine which scenarios to run (runtime config takes precedence over env var)
  const scenarioFilter = config._runtime?.scenarioFilter || process.env.DEMO_SCENARIO || "all";
  const scenariosToRun = scenarioFilter === "all"
    ? config.scenarios
    : config.scenarios.filter((s) => s.name === scenarioFilter);

  if (scenariosToRun.length === 0) {
    console.warn(`⚠ No scenarios matched filter: ${scenarioFilter}`);
    console.warn(`Available: ${config.scenarios.map((s) => s.name).join(", ")}`);
  }

  for (const scenario of scenariosToRun) {
    await runScenario(scenario);
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
    for (const p of verificationPasses) reportLines.push(`  ✅ ${p}`);
    reportLines.push("");
    reportLines.push("Failed:");
    for (const err of verificationErrors) reportLines.push(`  ❌ ${err}`);
    console.error("");
    console.error("═══ ❌ Verification FAILED ═══");
    for (const err of verificationErrors) console.error(`  • ${err}`);
    console.error(`${verificationErrors.length} verification error(s)`);
  } else {
    reportLines.push(`RESULT: ✅ ALL PASSED — ${verificationPasses.length} verification(s)`);
    reportLines.push("");
    for (const p of verificationPasses) reportLines.push(`  ✅ ${p}`);
    console.log("");
    console.log("═══ ✅ All verifications passed ═══");
  }

  const reportPath = path.join(config.paths.outputDir, "verification-report.txt");
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, reportLines.join("\n") + "\n", "utf-8");
  console.log(`Report: ${reportPath}`);

  console.log("");
  console.log("═══ Recording Complete ═══");
}
