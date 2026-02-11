# End-User Guide: Automated GIF Generation for VS Code Extensions

This guide explains how to use **vscode-demo-recorder** to add automated demo GIF generation to your VS Code extension project.

## Overview

`vscode-demo-recorder` launches a real VS Code Extension Development Host, executes your extension commands on fixture files, captures screenshots via macOS `screencapture`, verifies editor content against golden files, and assembles the screenshots into optimized GIFs.

The entire workflow is driven by a single YAML configuration file.

## Prerequisites

### System Dependencies

```bash
brew install ffmpeg gifsicle
```

### macOS Permissions

Your terminal application (or VS Code / Windsurf) must have:

- **Screen Recording** — System Settings → Privacy & Security → Screen Recording
- **Accessibility** — System Settings → Privacy & Security → Accessibility

### Runtime

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- Your VS Code extension must be compilable (`npm run compile`)

## Step-by-Step Setup

### 1. Copy vscode-demo-recorder into your project

Copy the `demos/04-vscode-demo-recorder` directory into your extension project (e.g., as `tools/demo-recorder` or `demos/recorder`).

```bash
cp -r demos/04-vscode-demo-recorder your-extension/tools/demo-recorder
```

### 2. Install dependencies

```bash
cd your-extension/tools/demo-recorder
bun install
```

### 3. Create a configuration file

From your **extension root** directory:

```bash
bun tools/demo-recorder/src/cli.ts config init
```

This creates `vscode-demo-recorder.config.yaml` in your project root. Edit it to match your extension.

### 4. Configure paths

```yaml
version: "1.0"

paths:
  extensionRoot: "."                    # Your extension root (where package.json is)
  fixturesDir: "demos/fixtures"         # Directory with test fixture files
  outputDir: "demos/output"             # Where screenshots and reports go
  goldensDir: "demos/goldens"           # Golden files for verification
  gifOutputDir: "images"                # Final GIF output directory
```

### 5. Configure VS Code settings

These settings are pre-seeded into the test VS Code instance to produce clean screenshots:

```yaml
vscode:
  fontZoomLevel: 3                      # Zoom in for GIF readability
  wipeUserData: true                    # Fresh state each run
  cliFlags:
    - "--wait"
    - "--disable-gpu"
    - "--skip-welcome"
    - "--skip-release-notes"
    - "--disable-workspace-trust"
  settings:
    git.enabled: false
    git.autoRepositoryDetection: false
    workbench.startupEditor: "none"
    telemetry.telemetryLevel: "off"
```

### 6. Define scenarios

Each scenario is a named sequence of steps:

```yaml
scenarios:
  - name: my-feature
    description: "Demonstrate my-feature command"
    steps:
      - action: open
        fixture: "example.json"           # Opens this file in the editor
      - action: sleep
        ms: 500                           # Wait for editor to settle
      - action: screenshot
        label: "01-before"                # Capture screenshot
      - action: selectAll                 # Select all text
      - action: command
        command: "extension.myCommand"    # Execute your extension command
        args:                             # Optional command arguments
          someOption: true
      - action: sleep
        ms: 1000                          # Wait for command to complete
      - action: verify
        golden: "02-after"                # Verify editor content matches golden
      - action: screenshot
        label: "02-after"                 # Capture screenshot
      - action: closeEditor               # Close the file
```

### 7. Create fixture files

Place your test fixture files in the `fixturesDir`:

```
demos/fixtures/
  example.json
  another-fixture.ts
```

These are the files that will be opened in VS Code during recording.

### 8. Record and generate golden files

First run with `--update-goldens` to create the baseline golden files:

```bash
bun tools/demo-recorder/src/cli.ts record all --update-goldens
```

This creates golden files in `goldensDir` that capture the expected editor content after each `verify` step.

### 9. Record screenshots

```bash
bun tools/demo-recorder/src/cli.ts record all
```

This launches VS Code, runs all scenarios, captures screenshots, and verifies against golden files.

### 10. Assemble GIFs

```bash
bun tools/demo-recorder/src/cli.ts assemble all
```

This creates:
- `images/demo-my-feature.gif` — per-scenario GIF
- `images/intro.gif` — combined GIF of all scenarios

## Available Step Actions

| Action | Description | Parameters |
|--------|-------------|------------|
| `open` | Open a fixture file in the editor | `fixture`: filename |
| `sleep` | Wait for a duration | `ms`: milliseconds |
| `screenshot` | Capture a screenshot | `label`: filename label |
| `selectAll` | Select all text in the editor | — |
| `command` | Execute a VS Code command | `command`: command ID, `args`: optional |
| `verify` | Verify editor content against golden | `golden`: golden file label |
| `closeEditor` | Close the active editor | — |

## GIF Settings

Fine-tune the GIF output:

```yaml
gif:
  frameDelay: 150          # Centiseconds between frames (150 = 1.5s)
  width: 1440              # Output width in pixels
  lossy: 30                # gifsicle compression (0=lossless, higher=smaller)
  colors: 256              # Max colors in palette
  dither: "sierra2_4a"     # ffmpeg dither algorithm
  statsMode: "full"        # ffmpeg palettegen mode
```

## Schema Validation

The configuration is validated against a Zod v4 schema. You can:

```bash
# Validate your config
bun src/cli.ts config validate

# Export JSON Schema for IDE autocompletion
bun src/cli.ts schema export

# View the schema
bun src/cli.ts schema show cli
```

Add the `$schema` reference to your YAML config for IDE support:

```yaml
# yaml-language-server: $schema=./tools/demo-recorder/schemas/vscode-demo-recorder.cli.schema.json
```

## CI Integration

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Record demo GIFs
  run: |
    bun tools/demo-recorder/src/cli.ts record all
    bun tools/demo-recorder/src/cli.ts assemble all
```

> **Note:** CI requires a display server (e.g., `xvfb-run` on Linux) and screen recording permissions on macOS.

## Troubleshooting

### VS Code exits immediately

- Ensure your extension compiles without errors (`npm run compile`)
- Check that `out/package.json` exists with `{ "type": "commonjs" }` — the launcher creates this automatically
- Run with `--verbose` flag on `bin/code` for debug output

### No screenshots generated

- Verify macOS Screen Recording permissions for your terminal
- Check `output/verification-report.txt` for errors
- Ensure fixture files exist in the configured `fixturesDir`

### Golden file mismatches

- Run `record --update-goldens` to regenerate baselines
- Check that your extension commands produce deterministic output
