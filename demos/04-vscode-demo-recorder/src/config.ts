/**
 * Configuration loader for vscode-demo-recorder.
 *
 * Resolves and validates the YAML config file using Zod schemas.
 * Supports environment variable overrides and config file discovery.
 */

import * as fs from "fs";
import * as path from "path";
import YAML from "yaml";
import { RecorderConfigSchema, type RecorderConfig } from "./schema.js";
import { CLI_NAME } from "./constants.js";

/**
 * Config file discovery order:
 * 1. $VSCODE_DEMO_RECORDER_CONFIG_PATH (env var)
 * 2. ./<cli-name>.config.yaml (project-local)
 * 3. ./<cli-name>.config.yml
 * 4. ./<cli-name>.config.json
 */
const CONFIG_FILE_NAMES = [
  `${CLI_NAME}.config.yaml`,
  `${CLI_NAME}.config.yml`,
  `${CLI_NAME}.config.json`,
];

export function resolveConfigPath(explicitPath?: string): string | null {
  // 1. Explicit path (CLI flag or env var)
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
    return null;
  }

  // 2. Environment variable
  const envPath = process.env.VSCODE_DEMO_RECORDER_CONFIG_PATH;
  if (envPath) {
    const resolved = path.resolve(envPath);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  // 3. Project-local discovery (walk up from cwd)
  let dir = process.cwd();
  const root = path.parse(dir).root;
  while (dir !== root) {
    for (const name of CONFIG_FILE_NAMES) {
      const candidate = path.join(dir, name);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    dir = path.dirname(dir);
  }

  return null;
}

/**
 * Load, parse, and validate the config file.
 * All relative paths in the config are resolved relative to the config file's directory.
 */
export function loadConfig(configPath: string): RecorderConfig {
  const raw = fs.readFileSync(configPath, "utf-8");
  const ext = path.extname(configPath).toLowerCase();

  let parsed: unknown;
  if (ext === ".json") {
    parsed = JSON.parse(raw);
  } else {
    parsed = YAML.parse(raw);
  }

  const result = RecorderConfigSchema.safeParse(parsed);
  if (!result.success) {
    const errors = result.error.issues.map(
      (i) => `  - ${i.path.join(".")}: ${i.message}`
    );
    throw new Error(
      `Configuration validation failed:\n${errors.join("\n")}`
    );
  }

  return result.data;
}

/**
 * Resolve all relative paths in the config relative to a base directory.
 */
export function resolvePaths(
  config: RecorderConfig,
  baseDir: string
): RecorderConfig {
  const resolve = (p: string) =>
    path.isAbsolute(p) ? p : path.resolve(baseDir, p);

  return {
    ...config,
    paths: {
      extensionRoot: resolve(config.paths.extensionRoot),
      fixturesDir: resolve(config.paths.fixturesDir),
      outputDir: resolve(config.paths.outputDir),
      goldensDir: resolve(config.paths.goldensDir),
      gifOutputDir: resolve(config.paths.gifOutputDir),
    },
  };
}

/**
 * Generate a default config YAML string.
 */
export function generateDefaultConfig(): string {
  const defaults = RecorderConfigSchema.parse({
    scenarios: [
      {
        name: "example",
        description: "Example scenario — customize this",
        steps: [
          { action: "open", fixture: "example.json" },
          { action: "sleep", ms: 500 },
          { action: "screenshot", label: "01-initial" },
          { action: "selectAll" },
          { action: "command", command: "extension.myCommand" },
          { action: "sleep", ms: 1000 },
          { action: "verify", golden: "02-after-command" },
          { action: "screenshot", label: "02-after-command" },
          { action: "closeEditor" },
        ],
      },
    ],
  });

  return YAML.stringify(defaults, { indent: 2 });
}
