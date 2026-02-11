#!/usr/bin/env bun
/**
 * Solution 02: VS Code Test Electron — Launcher
 *
 * Downloads VS Code (if needed), launches Extension Development Host,
 * and runs the scenario runner inside it which captures real screenshots.
 *
 * Uses downloadAndUnzipVSCode + resolveCliArgsFromVSCodeExecutablePath
 * to spawn the VS Code CLI wrapper (not the raw Electron binary), which
 * properly bootstraps VS Code with extension test support.
 *
 * Usage:
 *   bun demos/02-vscode-test-electron/src/launch.ts [scenario]
 *   bun demos/02-vscode-test-electron/src/launch.ts          # all
 *   bun demos/02-vscode-test-electron/src/launch.ts toggle   # specific
 */

import * as path from "path";
import { spawn } from "child_process";
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
} from "@vscode/test-electron";

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

  // Download VS Code if needed and resolve the CLI wrapper path
  const vscodeExecutablePath = await downloadAndUnzipVSCode();
  const [cliPath, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

  const args = [
    ...cliArgs,
    fixturesPath,
    `--extensionDevelopmentPath=${extensionDevelopmentPath}`,
    `--extensionTestsPath=${extensionTestsPath}`,
    "--disable-gpu",
    "--skip-welcome",
    "--skip-release-notes",
    "--disable-workspace-trust",
  ];

  console.log(`CLI: ${cliPath}`);
  console.log(`Args: ${args.join(" ")}`);
  console.log("");

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(cliPath, args, {
      stdio: "inherit",
      env: {
        ...process.env,
        DEMO_SCENARIO: scenario,
      },
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    console.error(`VS Code exited with code ${exitCode}`);
    process.exit(exitCode);
  }
}

main().catch((err) => {
  console.error("Failed to run demo scenarios:", err);
  process.exit(1);
});
