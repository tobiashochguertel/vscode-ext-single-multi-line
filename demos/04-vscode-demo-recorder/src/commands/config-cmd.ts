/**
 * `config` CLI command — manage configuration files.
 *
 * Subcommands: init, show, get, set, unset, validate, path
 */

import type { CommandModule } from "yargs";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import YAML from "yaml";
import { resolveConfigPath, loadConfig, generateDefaultConfig } from "../config.js";
import { RecorderConfigSchema } from "../schema.js";
import { getLogger } from "../logger.js";

const CLI_NAME = "vscode-demo-recorder";

function getConfigPath(argv: { config?: string }): string {
  const configPath = resolveConfigPath(argv.config);
  if (!configPath) {
    console.error(chalk.red(`❌ Configuration Error: Config file not found`));
    console.error(`\n   Suggestion: Run \`${CLI_NAME} config init\` to create one`);
    process.exit(1);
  }
  return configPath;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== "object") {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function deleteNestedValue(obj: Record<string, unknown>, path: string): boolean {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== "object") {
      return false;
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  const key = parts[parts.length - 1];
  if (key in current) {
    delete current[key];
    return true;
  }
  return false;
}

function coerceValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw === "null") return null;
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^\d+\.\d+$/.test(raw)) return parseFloat(raw);
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through
    }
  }
  return raw;
}

export const configCommand: CommandModule = {
  command: "config <action>",
  describe: "Manage configuration",
  builder: (yargs) =>
    yargs
      .command(
        "init",
        "Create a new configuration file with defaults",
        (y) =>
          y.option("force", {
            type: "boolean",
            description: "Overwrite existing config file",
            default: false,
          }),
        (argv) => {
          const targetPath = path.resolve(
            (argv.config as string) || `${CLI_NAME}.config.yaml`
          );

          if (fs.existsSync(targetPath) && !argv.force) {
            console.error(chalk.red(`❌ Configuration Error: File already exists`));
            console.error(`\n   Path: ${targetPath}`);
            console.error(`\n   Suggestion: Use --force to overwrite, or edit the existing file`);
            process.exit(1);
          }

          if (fs.existsSync(targetPath) && argv.force) {
            const backup = `${targetPath}.${Date.now()}.bak`;
            fs.copyFileSync(targetPath, backup);
            getLogger().info(`Backed up existing config to ${backup}`);
          }

          const content = generateDefaultConfig();
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, content, "utf-8");
          console.log(chalk.green(`✓ Created configuration file: ${targetPath}`));
          console.log(`  Edit this file or use \`${CLI_NAME} config set\` to customize settings.`);
        }
      )
      .command(
        "show",
        "Display current configuration",
        (y) =>
          y.option("format", {
            type: "string",
            choices: ["json", "yaml"],
            default: "yaml",
            description: "Output format",
          }),
        (argv) => {
          const configPath = getConfigPath(argv);
          const config = loadConfig(configPath);
          if (argv.format === "json") {
            console.log(JSON.stringify(config, null, 2));
          } else {
            console.log(YAML.stringify(config, { indent: 2 }));
          }
        }
      )
      .command(
        "get <property>",
        "Get a configuration property value",
        (y) =>
          y.positional("property", {
            type: "string",
            description: "Dot-notation property path",
            demandOption: true,
          }),
        (argv) => {
          const configPath = getConfigPath(argv);
          const config = loadConfig(configPath);
          const value = getNestedValue(config as unknown as Record<string, unknown>, argv.property as string);
          if (value === undefined) {
            console.error(chalk.red(`❌ Configuration Error: Property not found`));
            console.error(`\n   Path: ${argv.property}`);
            console.error(`\n   Suggestion: Use \`${CLI_NAME} config show\` to see available properties`);
            process.exit(1);
          }
          if (typeof value === "object" && value !== null) {
            console.log(YAML.stringify(value, { indent: 2 }));
          } else {
            console.log(value);
          }
        }
      )
      .command(
        "set <property> <value>",
        "Set a configuration property value",
        (y) =>
          y
            .positional("property", {
              type: "string",
              description: "Dot-notation property path",
              demandOption: true,
            })
            .positional("value", {
              type: "string",
              description: "Value to set",
              demandOption: true,
            }),
        (argv) => {
          const configPath = getConfigPath(argv);
          const raw = fs.readFileSync(configPath, "utf-8");
          const parsed = YAML.parse(raw) as Record<string, unknown>;
          const coerced = coerceValue(argv.value as string);

          setNestedValue(parsed, argv.property as string, coerced);

          // Validate the updated config
          const result = RecorderConfigSchema.safeParse(parsed);
          if (!result.success) {
            console.error(chalk.red(`❌ Validation Error: Invalid value for property '${argv.property}'`));
            for (const issue of result.error.issues) {
              console.error(`   - ${issue.path.join(".")}: ${issue.message}`);
            }
            process.exit(1);
          }

          fs.writeFileSync(configPath, YAML.stringify(parsed, { indent: 2 }), "utf-8");
          console.log(chalk.green(`✓ Set ${argv.property} = ${JSON.stringify(coerced)}`));
        }
      )
      .command(
        "unset <property>",
        "Remove a configuration property",
        (y) =>
          y.positional("property", {
            type: "string",
            description: "Dot-notation property path",
            demandOption: true,
          }),
        (argv) => {
          const configPath = getConfigPath(argv);
          const raw = fs.readFileSync(configPath, "utf-8");
          const parsed = YAML.parse(raw) as Record<string, unknown>;

          if (!deleteNestedValue(parsed, argv.property as string)) {
            console.error(chalk.red(`❌ Configuration Error: Property not found`));
            console.error(`\n   Path: ${argv.property}`);
            process.exit(1);
          }

          fs.writeFileSync(configPath, YAML.stringify(parsed, { indent: 2 }), "utf-8");
          console.log(chalk.green(`✓ Removed ${argv.property}`));
        }
      )
      .command(
        "validate",
        "Validate configuration against schema",
        () => {},
        (argv) => {
          const configPath = getConfigPath(argv);
          try {
            loadConfig(configPath);
            console.log(chalk.green(`✓ Configuration is valid`));
            console.log(`  File: ${configPath}`);
          } catch (e: any) {
            console.error(chalk.red(`❌ Validation Error: Configuration is invalid`));
            console.error(`\n${e.message}`);
            process.exit(1);
          }
        }
      )
      .command(
        "path",
        "Print the resolved configuration file path",
        () => {},
        (argv) => {
          const configPath = resolveConfigPath(argv.config as string | undefined);
          if (configPath) {
            console.log(`${configPath} ${chalk.green("(exists)")}`);
          } else {
            const defaultPath = path.resolve(`${CLI_NAME}.config.yaml`);
            console.log(`${defaultPath} ${chalk.red("(not found)")}`);
          }
        }
      )
      .demandCommand(1, "Please specify a config action"),
};
