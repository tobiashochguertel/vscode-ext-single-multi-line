#!/usr/bin/env bun
/**
 * Solution 02: VS Code Test Electron — Launcher
 *
 * Downloads VS Code (if needed), launches Extension Development Host,
 * and runs the scenario runner inside it which captures real screenshots.
 *
 * Usage:
 *   bun demos/02-vscode-test-electron/src/launch.ts [scenario]
 *   bun demos/02-vscode-test-electron/src/launch.ts          # all
 *   bun demos/02-vscode-test-electron/src/launch.ts toggle   # specific
 */

import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
  // Extension root (two levels up from demos/02-vscode-test-electron/src/)
  const extensionDevelopmentPath = path.resolve(__dirname, "..", "..", "..");

  // Compiled test entry point (tsc output in demos/02-vscode-test-electron/out/)
  const extensionTestsPath = path.resolve(__dirname, "..", "out", "src", "run-scenarios");

  // Fixtures directory
  const fixturesPath = path.resolve(__dirname, "..", "..", "fixtures");

  const scenario = process.argv[2] || process.env.DEMO_SCENARIO || "all";

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Solution 02: VS Code Test Electron      ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`Scenario:  ${scenario}`);
  console.log(`Extension: ${extensionDevelopmentPath}`);
  console.log(`Tests:     ${extensionTestsPath}`);
  console.log(`Fixtures:  ${fixturesPath}`);
  console.log("");

  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        fixturesPath,
        "--disable-extensions",
        "--disable-gpu",
      ],
      extensionTestsEnv: {
        DEMO_SCENARIO: scenario,
      },
    });
  } catch (err) {
    console.error("Failed to run demo scenarios:", err);
    process.exit(1);
  }
}

main();
