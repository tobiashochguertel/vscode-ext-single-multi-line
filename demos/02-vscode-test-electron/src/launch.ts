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
import * as fs from "fs";
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
    "--wait",
    "--disable-gpu",
    "--skip-welcome",
    "--skip-release-notes",
    "--disable-workspace-trust",
  ];

  // Wipe user-data to ensure fresh VS Code state (no cached notifications)
  const userDataArg = args.find((a) => a.startsWith("--user-data-dir="));
  if (userDataArg) {
    const userDataDir = userDataArg.split("=")[1];
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }

    // Pre-seed VS Code settings to suppress distracting UI before launch
    const settingsDir = path.join(userDataDir, "User");
    const settingsPath = path.join(settingsDir, "settings.json");
    fs.mkdirSync(settingsDir, { recursive: true });

    const settings = {
      "git.enabled": false,
      "git.autoRepositoryDetection": false,
      "git.openRepositoryInParentFolders": "never",
      "chat.commandCenter.enabled": false,
      "workbench.startupEditor": "none",
      "workbench.tips.enabled": false,
      "update.showReleaseNotes": false,
      "extensions.ignoreRecommendations": true,
      "telemetry.telemetryLevel": "off",
    };

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
    console.log(`Settings: ${settingsPath}`);
  }

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

  // Print verification report if it exists
  const reportPath = path.resolve(__dirname, "..", "output", "verification-report.txt");
  if (fs.existsSync(reportPath)) {
    console.log("");
    console.log(fs.readFileSync(reportPath, "utf-8"));
  }

  if (exitCode !== 0) {
    console.error(`VS Code exited with code ${exitCode}`);
    process.exit(exitCode);
  }
}

main().catch((err) => {
  console.error("Failed to run demo scenarios:", err);
  process.exit(1);
});
