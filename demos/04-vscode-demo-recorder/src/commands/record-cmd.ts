/**
 * `record` CLI command — launch VS Code and run scenarios.
 *
 * Delegates to launch.ts which uses the proven spawn + bin/code pattern
 * from Solution 02. This ensures the VS Code CLI wrapper properly blocks
 * until the Extension Development Host exits.
 */

import type { CommandModule } from "yargs";
import * as path from "path";
import { spawn } from "child_process";
import chalk from "chalk";

export const recordCommand: CommandModule = {
  command: "record [scenario]",
  describe: "Launch VS Code and record scenario screenshots",
  builder: (yargs) =>
    yargs
      .positional("scenario", {
        type: "string",
        description: "Scenario name to record, or 'all'",
        default: "all",
      })
      .option("update-goldens", {
        type: "boolean",
        description: "Write actual editor content as new golden files",
        default: false,
      }),
  handler: async (argv) => {
    // Delegate to launch.ts which uses the proven spawn + bin/code pattern.
    // Running it as a separate bun process ensures the event loop stays alive
    // while the VS Code CLI wrapper blocks.
    const launchScript = path.resolve(__dirname, "..", "launch.ts");
    const launchArgs: string[] = [launchScript];

    const scenario = argv.scenario as string;
    if (scenario) {
      launchArgs.push(scenario);
    }
    if (argv.updateGoldens) {
      launchArgs.push("--update-goldens");
    }

    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn("bun", launchArgs, {
        stdio: "inherit",
        cwd: process.cwd(),
        env: process.env,
      });
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });

    if (exitCode !== 0) {
      console.error(chalk.red(`Record failed with exit code ${exitCode}`));
      process.exit(exitCode);
    }
  },
};
