/**
 * `assemble` CLI command — convert screenshots into GIFs.
 *
 * Reads GIF settings from config and uses ffmpeg + gifsicle.
 */

import type { CommandModule } from "yargs";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import chalk from "chalk";
import { resolveConfigPath, loadConfig, resolvePaths } from "../config.js";
import { getLogger } from "../logger.js";
import type { GifSettings } from "../schema.js";

function checkDeps(): void {
  const missing: string[] = [];
  for (const cmd of ["ffmpeg", "gifsicle"]) {
    try {
      execSync(`command -v ${cmd}`, { stdio: "ignore" });
    } catch {
      missing.push(cmd);
    }
  }
  if (missing.length > 0) {
    console.error(chalk.red(`ERROR: Missing required tools: ${missing.join(", ")}`));
    console.error(`Install with: brew install ${missing.join(" ")}`);
    process.exit(1);
  }
}

function assembleScenario(
  scenarioName: string,
  screenshotsDir: string,
  gifOutputDir: string,
  tempDir: string,
  gif: GifSettings
): boolean {
  const inputDir = path.join(screenshotsDir, scenarioName);
  const outputFile = path.join(gifOutputDir, `demo-${scenarioName}.gif`);

  if (!fs.existsSync(inputDir)) {
    console.warn(`⚠ No screenshots for scenario '${scenarioName}' in ${inputDir}`);
    return false;
  }

  const pngs = fs.readdirSync(inputDir).filter((f) => f.endsWith(".png"));
  if (pngs.length === 0) {
    console.warn(`⚠ No PNG files found in ${inputDir}`);
    return false;
  }

  console.log(`▶ Assembling ${scenarioName} (${pngs.length} frames) → ${outputFile}`);
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(gifOutputDir, { recursive: true });

  // Step 1: Create palette
  const palette = path.join(tempDir, `palette-${scenarioName}.png`);
  execSync(
    `ffmpeg -y -framerate 1 -pattern_type glob -i "${inputDir}/*.png" ` +
      `-vf "scale=${gif.width}:-1:flags=lanczos,palettegen=max_colors=${gif.colors}:stats_mode=${gif.statsMode}" ` +
      `"${palette}"`,
    { stdio: "ignore" }
  );

  // Step 2: Generate GIF
  const rawGif = path.join(tempDir, `raw-${scenarioName}.gif`);
  execSync(
    `ffmpeg -y -framerate 1 -pattern_type glob -i "${inputDir}/*.png" ` +
      `-i "${palette}" ` +
      `-lavfi "scale=${gif.width}:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=${gif.dither}:diff_mode=rectangle" ` +
      `"${rawGif}"`,
    { stdio: "ignore" }
  );

  // Step 3: Optimize with gifsicle
  execSync(
    `gifsicle -O3 --lossy=${gif.lossy} --colors ${gif.colors} ` +
      `--delay ${gif.frameDelay} --no-warnings --loop ` +
      `"${rawGif}" -o "${outputFile}"`,
    { stdio: "ignore" }
  );

  const stat = fs.statSync(outputFile);
  const sizeKb = Math.round(stat.size / 1024);
  console.log(`✓ ${outputFile} (${sizeKb}K)`);
  return true;
}

function combineAll(
  screenshotsDir: string,
  gifOutputDir: string,
  gif: GifSettings
): void {
  const outputFile = path.join(gifOutputDir, "intro.gif");
  const inputs: string[] = [];

  if (!fs.existsSync(screenshotsDir)) return;

  for (const entry of fs.readdirSync(screenshotsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const gifPath = path.join(gifOutputDir, `demo-${entry.name}.gif`);
    if (fs.existsSync(gifPath)) {
      inputs.push(gifPath);
    }
  }

  if (inputs.length === 0) {
    console.warn("⚠ No scenario GIFs found to combine");
    return;
  }

  console.log(`▶ Combining ${inputs.length} scenario GIFs → ${outputFile}`);
  execSync(
    `gifsicle -O3 --colors ${gif.colors} --no-warnings --merge --loop ` +
      inputs.map((f) => `"${f}"`).join(" ") +
      ` -o "${outputFile}"`,
    { stdio: "ignore" }
  );

  const stat = fs.statSync(outputFile);
  const sizeKb = Math.round(stat.size / 1024);
  console.log(`✓ ${outputFile} (${sizeKb}K)`);
}

export const assembleCommand: CommandModule = {
  command: "assemble [scenario]",
  describe: "Assemble screenshots into GIFs",
  builder: (yargs) =>
    yargs.positional("scenario", {
      type: "string",
      description: "Scenario name to assemble, or 'all'",
      default: "all",
    }),
  handler: async (argv) => {
    const log = getLogger();
    checkDeps();

    const configPath = resolveConfigPath(argv.config as string | undefined);
    if (!configPath) {
      console.error(chalk.red("❌ Config file not found. Run `vscode-demo-recorder config init`"));
      process.exit(1);
    }

    const rawConfig = loadConfig(configPath);
    const configDir = path.dirname(configPath);
    const config = resolvePaths(rawConfig, configDir);

    const screenshotsDir = path.join(config.paths.outputDir, "screenshots");
    const tempDir = path.join(config.paths.outputDir, ".tmp-gif");
    const scenario = argv.scenario as string;

    if (scenario === "all") {
      for (const s of config.scenarios) {
        assembleScenario(s.name, screenshotsDir, config.paths.gifOutputDir, tempDir, config.gif);
      }
      combineAll(screenshotsDir, config.paths.gifOutputDir, config.gif);
    } else {
      assembleScenario(scenario, screenshotsDir, config.paths.gifOutputDir, tempDir, config.gif);
    }

    // Cleanup temp
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log("");
    console.log("═══ GIF Assembly Complete ═══");
    console.log(`Output directory: ${config.paths.gifOutputDir}`);
  },
};
