#!/usr/bin/env bun
/**
 * vscode-demo-recorder CLI
 *
 * Project-agnostic VS Code extension demo GIF recorder.
 * Records scenarios in a real VS Code instance and assembles GIFs.
 */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import chalk from "chalk";
import { createLogger } from "./logger.js";
import { configCommand } from "./commands/config-cmd.js";
import { schemaCommand } from "./commands/schema-cmd.js";
import { recordCommand } from "./commands/record-cmd.js";
import { assembleCommand } from "./commands/assemble-cmd.js";
import { CLI_NAME } from "./constants.js";

async function main(): Promise<void> {
  await yargs(hideBin(process.argv))
    .scriptName(CLI_NAME)
    .usage(`${chalk.bold(CLI_NAME)} — VS Code extension demo GIF recorder`)
    .option("verbose", {
      alias: "v",
      type: "boolean",
      description: "Increase logging verbosity",
      default: false,
    })
    .option("quiet", {
      alias: "q",
      type: "boolean",
      description: "Suppress non-error output",
      default: false,
    })
    .option("config", {
      alias: "c",
      type: "string",
      description: "Path to config file",
    })
    .middleware((argv) => {
      createLogger({ verbose: argv.verbose, quiet: argv.quiet });
    })
    .command(configCommand)
    .command(schemaCommand)
    .command(recordCommand)
    .command(assembleCommand)
    .demandCommand(1, "Please specify a command")
    .strict()
    .help()
    .alias("h", "help")
    .version()
    .parseAsync();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
