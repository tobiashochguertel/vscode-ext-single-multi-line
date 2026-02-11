#!/usr/bin/env bun
/**
 * vscode-demo-recorder — VS Code Launcher
 *
 * Config-driven launcher: reads the YAML config, writes a runtime config
 * for the scenario runner, pre-seeds VS Code settings, and spawns the
 * VS Code CLI wrapper (bin/code) which bootstraps VS Code with extension
 * test support.
 *
 * IMPORTANT: The bin/code CLI exits immediately if a VS Code instance is
 * already running with the same user-data-dir. This launcher kills any
 * stale test instances before launching to ensure bin/code blocks properly.
 *
 * Usage:
 *   bun demos/04-vscode-demo-recorder/src/launch.ts [scenario] [--update-goldens]
 */

import * as path from "path";
import * as fs from "fs";
import { spawn, execSync } from "child_process";
import {
  downloadAndUnzipVSCode,
  resolveCliArgsFromVSCodeExecutablePath,
} from "@vscode/test-electron";
import { resolveConfigPath, loadConfig, resolvePaths } from "./config.js";

/**
 * Kill any lingering VS Code test instances that share the same user-data-dir.
 * If bin/code detects an existing server, it sends the open command and exits
 * immediately instead of launching a new instance.
 */
function killStaleTestInstances(): void {
  try {
    execSync('pkill -f "Electron.*extensionDevelopmentPath" 2>/dev/null || true', { stdio: "ignore" });
    // Give processes time to die
    execSync("sleep 1", { stdio: "ignore" });
  } catch {
    // Ignore errors — no stale instances
  }
}

async function main(): Promise<void> {
  const scenario = process.argv[2] || process.env.DEMO_SCENARIO || "all";
  const updateGoldens = process.argv.includes("--update-goldens");

  // Load and resolve config
  const configPath = resolveConfigPath();
  if (!configPath) {
    console.error("❌ Config file not found. Run: bun demos/04-vscode-demo-recorder/src/cli.ts config init");
    process.exit(1);
  }

  const rawConfig = loadConfig(configPath);
  const config = resolvePaths(rawConfig, path.dirname(configPath));

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  vscode-demo-recorder                    ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`Config:    ${configPath}`);
  console.log(`Scenario:  ${scenario}`);
  console.log(`Extension: ${config.paths.extensionRoot}`);
  console.log(`Fixtures:  ${config.paths.fixturesDir}`);
  console.log("");

  // Write runtime config for the scenario runner
  const runtimeConfigPath = path.join(config.paths.outputDir, ".runtime-config.json");
  fs.mkdirSync(path.dirname(runtimeConfigPath), { recursive: true });
  fs.writeFileSync(
    runtimeConfigPath,
    JSON.stringify({
      ...config,
      _runtime: { scenarioFilter: scenario, updateGoldens },
    }, null, 2),
    "utf-8"
  );

  // Compiled test entry point
  const solutionDir = path.resolve(__dirname, "..");
  const extensionTestsPath = path.resolve(solutionDir, "out", "src", "run-scenarios");

  // Download VS Code if needed and resolve the CLI wrapper path
  const vscodeExecutablePath = await downloadAndUnzipVSCode();
  const [cliPath, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(vscodeExecutablePath);

  const args = [
    ...cliArgs,
    config.paths.fixturesDir,
    `--extensionDevelopmentPath=${config.paths.extensionRoot}`,
    `--extensionTestsPath=${extensionTestsPath}`,
    ...config.vscode.cliFlags,
  ];

  // Wipe user-data for fresh state
  const userDataArg = args.find((a) => a.startsWith("--user-data-dir="));
  if (userDataArg && config.vscode.wipeUserData) {
    const userDataDir = userDataArg.split("=")[1];

    // Kill stale test instances BEFORE wiping user-data
    killStaleTestInstances();

    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }

    // Pre-seed VS Code settings
    const settingsDir = path.join(userDataDir, "User");
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(
      path.join(settingsDir, "settings.json"),
      JSON.stringify(config.vscode.settings, null, 2),
      "utf-8"
    );
    console.log(`Settings: ${path.join(settingsDir, "settings.json")}`);
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
        DEMO_CONFIG_PATH: runtimeConfigPath,
        UPDATE_GOLDENS: updateGoldens ? "1" : "",
      },
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

  // Print verification report
  const reportPath = path.join(config.paths.outputDir, "verification-report.txt");
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
