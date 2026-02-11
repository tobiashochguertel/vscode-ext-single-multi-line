/**
 * Zod schemas for vscode-demo-recorder configuration.
 *
 * Defines all configuration types:
 * - ScenarioStep: a single step within a scenario (open, select, command, verify, screenshot)
 * - Scenario: a named sequence of steps
 * - GifSettings: ffmpeg/gifsicle encoding parameters
 * - VscodeSettings: VS Code user settings for the test instance
 * - RecorderConfig: top-level config combining everything
 */

import { z } from "zod";

// ── Scenario Step Types ──────────────────────────────────────

export const StepOpenSchema = z.object({
  action: z.literal("open"),
  fixture: z.string().describe("Fixture filename relative to fixtures directory"),
});

export const StepSelectAllSchema = z.object({
  action: z.literal("selectAll"),
});

export const StepCommandSchema = z.object({
  action: z.literal("command"),
  command: z.string().describe("VS Code command ID to execute"),
  args: z.record(z.unknown()).optional().describe("Arguments to pass to the command"),
});

export const StepVerifySchema = z.object({
  action: z.literal("verify"),
  golden: z.string().describe("Golden file label (e.g. '01-single-line-before')"),
});

export const StepScreenshotSchema = z.object({
  action: z.literal("screenshot"),
  label: z.string().describe("Screenshot label for filename"),
});

export const StepSleepSchema = z.object({
  action: z.literal("sleep"),
  ms: z.number().int().positive().describe("Milliseconds to wait"),
});

export const StepCloseEditorSchema = z.object({
  action: z.literal("closeEditor"),
});

export const ScenarioStepSchema = z.discriminatedUnion("action", [
  StepOpenSchema,
  StepSelectAllSchema,
  StepCommandSchema,
  StepVerifySchema,
  StepScreenshotSchema,
  StepSleepSchema,
  StepCloseEditorSchema,
]);

export type ScenarioStep = z.infer<typeof ScenarioStepSchema>;

// ── Scenario ─────────────────────────────────────────────────

export const ScenarioSchema = z.object({
  name: z.string().describe("Unique scenario identifier (used as directory name)"),
  description: z.string().optional().describe("Human-readable description"),
  steps: z.array(ScenarioStepSchema).min(1).describe("Ordered list of steps to execute"),
});

export type Scenario = z.infer<typeof ScenarioSchema>;

// ── GIF Settings ─────────────────────────────────────────────

export const GifSettingsSchema = z.object({
  frameDelay: z.number().int().positive().default(150)
    .describe("Centiseconds between frames (150 = 1.5s per frame)"),
  width: z.number().int().positive().default(1440)
    .describe("Output GIF width in pixels"),
  lossy: z.number().int().min(0).max(200).default(30)
    .describe("gifsicle lossy compression level (0=lossless, higher=more compression)"),
  colors: z.number().int().min(2).max(256).default(256)
    .describe("Max colors in GIF palette"),
  dither: z.string().default("sierra2_4a")
    .describe("ffmpeg dither algorithm (sierra2_4a, bayer, floyd_steinberg, none)"),
  statsMode: z.enum(["full", "diff", "single"]).default("full")
    .describe("ffmpeg palettegen stats_mode"),
});

export type GifSettings = z.infer<typeof GifSettingsSchema>;

// ── VS Code Environment ──────────────────────────────────────

export const VscodeSettingsSchema = z.record(z.unknown()).default({
  "git.enabled": false,
  "git.autoRepositoryDetection": false,
  "git.openRepositoryInParentFolders": "never",
  "chat.commandCenter.enabled": false,
  "workbench.startupEditor": "none",
  "workbench.tips.enabled": false,
  "update.showReleaseNotes": false,
  "extensions.ignoreRecommendations": true,
  "telemetry.telemetryLevel": "off",
}).describe("VS Code settings.json to pre-seed in the test instance");

export const VscodeEnvSchema = z.object({
  settings: VscodeSettingsSchema,
  fontZoomLevel: z.number().int().min(0).max(10).default(3)
    .describe("Number of font zoom-in steps for GIF readability"),
  cliFlags: z.array(z.string()).default([
    "--wait",
    "--disable-gpu",
    "--skip-welcome",
    "--skip-release-notes",
    "--disable-workspace-trust",
  ]).describe("Additional CLI flags for the VS Code test instance"),
  wipeUserData: z.boolean().default(true)
    .describe("Wipe user-data directory before each run for a clean state"),
});

export type VscodeEnv = z.infer<typeof VscodeEnvSchema>;

// ── Paths ────────────────────────────────────────────────────

export const PathsSchema = z.object({
  extensionRoot: z.string().default(".")
    .describe("Path to the VS Code extension root (relative to config file or absolute)"),
  fixturesDir: z.string().default("demos/fixtures")
    .describe("Path to fixture files directory"),
  outputDir: z.string().default("demos/02-vscode-test-electron/output")
    .describe("Path to output directory (screenshots, reports)"),
  goldensDir: z.string().default("demos/02-vscode-test-electron/goldens")
    .describe("Path to golden files directory"),
  gifOutputDir: z.string().default("images")
    .describe("Path to final GIF output directory"),
});

export type Paths = z.infer<typeof PathsSchema>;

// ── Top-Level Config ─────────────────────────────────────────

export const RecorderConfigSchema = z.object({
  $schema: z.string().optional().describe("JSON Schema reference for IDE support"),
  version: z.literal("1.0").default("1.0").describe("Config schema version"),
  paths: PathsSchema.default({}),
  vscode: VscodeEnvSchema.default({}),
  gif: GifSettingsSchema.default({}),
  scenarios: z.array(ScenarioSchema).min(1).describe("List of scenarios to record"),
});

export type RecorderConfig = z.infer<typeof RecorderConfigSchema>;
