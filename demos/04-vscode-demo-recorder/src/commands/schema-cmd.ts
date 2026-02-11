/**
 * `schema` CLI command — inspect, validate, and export JSON schemas.
 *
 * Subcommands: list, show, validate, export, path
 */

import type { CommandModule } from "yargs";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import chalk from "chalk";
import YAML from "yaml";
import { RecorderConfigSchema } from "../schema.js";
import { CLI_NAME } from "../constants.js";

function getSchemasDir(): string {
  return path.resolve(__dirname, "..", "..", "schemas");
}

function getSchemaStorePath(): string | null {
  const storeDir = process.env.JSON_SCHEMA_STORE_LOCAL;
  return storeDir || null;
}

function generateJsonSchema(): object {
  return z.toJSONSchema(RecorderConfigSchema, {
    target: "draft-07",
    reused: "inline",
    unrepresentable: "any",
  });
}

function getSchemaFileName(configType: string): string {
  return `${CLI_NAME}.${configType}.schema.json`;
}

function resolveSchemaPath(configType: string): string {
  return path.join(getSchemasDir(), getSchemaFileName(configType));
}

export const schemaCommand: CommandModule = {
  command: "schema <action>",
  describe: "Inspect and manage JSON schemas",
  builder: (yargs) =>
    yargs
      .command(
        "list",
        "List all available schemas",
        () => { },
        () => {
          const schemasDir = getSchemasDir();
          if (!fs.existsSync(schemasDir)) {
            console.log("No schemas directory found. Run `schema export` to generate.");
            return;
          }

          const files = fs.readdirSync(schemasDir).filter((f) => f.endsWith(".schema.json"));
          if (files.length === 0) {
            console.log("No schema files found.");
            return;
          }

          console.log(
            chalk.bold("Config Type".padEnd(16)) +
            chalk.bold("Schema File".padEnd(48)) +
            chalk.bold("Size".padEnd(10)) +
            chalk.bold("Modified")
          );
          console.log("─".repeat(90));

          for (const file of files) {
            const filePath = path.join(schemasDir, file);
            const stat = fs.statSync(filePath);
            const configType = file.replace(`${CLI_NAME}.`, "").replace(".schema.json", "");
            const sizeKb = (stat.size / 1024).toFixed(1) + " KB";
            const modified = stat.mtime.toISOString().slice(0, 10);
            console.log(
              configType.padEnd(16) +
              file.padEnd(48) +
              sizeKb.padEnd(10) +
              modified
            );
          }
        }
      )
      .command(
        "show <type>",
        "Display a schema's content",
        (y) =>
          y
            .positional("type", {
              type: "string",
              description: "Config type (e.g. cli)",
              demandOption: true,
            })
            .option("format", {
              type: "string",
              choices: ["json", "yaml"],
              default: "json",
            }),
        (argv) => {
          const schemaPath = resolveSchemaPath(argv.type as string);

          let schema: object;
          if (fs.existsSync(schemaPath)) {
            schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
          } else {
            // Generate on the fly if not exported yet
            if ((argv.type as string) === "cli") {
              schema = generateJsonSchema();
            } else {
              console.error(chalk.red(`❌ Schema not found: ${schemaPath}`));
              process.exit(1);
            }
          }

          if (argv.format === "yaml") {
            console.log(YAML.stringify(schema, { indent: 2 }));
          } else {
            console.log(JSON.stringify(schema, null, 2));
          }
        }
      )
      .command(
        "validate <file>",
        "Validate a configuration file against a schema",
        (y) =>
          y
            .positional("file", {
              type: "string",
              description: "Path to the config file to validate",
              demandOption: true,
            })
            .option("type", {
              type: "string",
              description: "Config type",
              default: "cli",
            }),
        (argv) => {
          const filePath = path.resolve(argv.file as string);
          if (!fs.existsSync(filePath)) {
            console.error(chalk.red(`❌ File not found: ${filePath}`));
            process.exit(2);
          }

          const raw = fs.readFileSync(filePath, "utf-8");
          const ext = path.extname(filePath).toLowerCase();
          let parsed: unknown;
          try {
            parsed = ext === ".json" ? JSON.parse(raw) : YAML.parse(raw);
          } catch (e: any) {
            console.error(chalk.red(`❌ Parse error: ${e.message}`));
            process.exit(2);
          }

          const result = RecorderConfigSchema.safeParse(parsed);
          if (result.success) {
            console.log(chalk.green(`✓ Configuration is valid`));
          } else {
            console.error(chalk.red(`❌ Validation Error: Configuration is invalid`));
            console.error("");
            for (const issue of result.error.issues) {
              console.error(`  - ${chalk.yellow(issue.path.join("."))}: ${issue.message}`);
            }
            process.exit(1);
          }
        }
      )
      .command(
        "export",
        "Export schemas to a directory",
        (y) =>
          y.option("out", {
            type: "string",
            description: "Output directory",
            default: "./schemas",
          }),
        (argv) => {
          const outDir = path.resolve(argv.out as string);
          fs.mkdirSync(outDir, { recursive: true });

          // Also write to the solution's schemas dir
          const solutionSchemasDir = getSchemasDir();
          fs.mkdirSync(solutionSchemasDir, { recursive: true });

          const schema = generateJsonSchema();
          const fileName = getSchemaFileName("cli");
          const content = JSON.stringify(schema, null, 2) + "\n";

          // Write to requested output dir
          const outPath = path.join(outDir, fileName);
          fs.writeFileSync(outPath, content, "utf-8");

          // Also write to solution schemas dir
          const solutionPath = path.join(solutionSchemasDir, fileName);
          fs.writeFileSync(solutionPath, content, "utf-8");

          // Also copy to JSON_SCHEMA_STORE_LOCAL if set
          const storePath = getSchemaStorePath();
          if (storePath && fs.existsSync(storePath)) {
            const storeFile = path.join(storePath, fileName);
            fs.writeFileSync(storeFile, content, "utf-8");
            console.log(chalk.green(`✓ Exported to schema store: ${storeFile}`));
          }

          console.log(chalk.green(`✓ Exported 1 schema to ${outDir}`));
          console.log(`  - ${fileName}`);
        }
      )
      .command(
        "path <type>",
        "Print the resolved path to a schema file",
        (y) =>
          y.positional("type", {
            type: "string",
            description: "Config type",
            demandOption: true,
          }),
        (argv) => {
          const schemaPath = resolveSchemaPath(argv.type as string);
          const exists = fs.existsSync(schemaPath);
          console.log(
            `${schemaPath} ${exists ? chalk.green("(exists)") : chalk.red("(not found)")}`
          );
        }
      )
      .demandCommand(1, "Please specify a schema action"),
};
