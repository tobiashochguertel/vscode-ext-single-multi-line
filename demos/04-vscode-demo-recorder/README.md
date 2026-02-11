# vscode-demo-recorder

**Project-agnostic VS Code extension demo GIF recorder.**

Records scenarios in a real VS Code Extension Development Host, captures screenshots via macOS `screencapture`, and assembles them into optimized GIFs — all driven by a single YAML configuration file.

## Features

- **YAML-driven** — define scenarios, steps, and settings in `vscode-demo-recorder.config.yaml`
- **Real screenshots** — actual VS Code UI with syntax highlighting, themes, and chrome
- **Golden file verification** — compare editor content against expected baselines
- **CLI tool** — `config`, `schema`, `record`, and `assemble` commands
- **Zod v4 schemas** — validated configuration with auto-generated JSON Schema for IDE support
- **GIF optimization** — ffmpeg palette generation + gifsicle compression

## Prerequisites

```bash
# Runtime
brew install ffmpeg gifsicle

# macOS permissions required:
# System Settings → Privacy & Security → Screen Recording → add VS Code / Windsurf / Terminal
# System Settings → Privacy & Security → Accessibility → add VS Code / Windsurf / Terminal
```

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Initialize a config file (if not present)
bun src/cli.ts config init

# 3. Record all scenarios and assemble GIFs
bun src/cli.ts record all
bun src/cli.ts assemble all

# Or via Taskfile from project root
task demo:04:generate
```

## CLI Commands

```bash
bun src/cli.ts config init          # Create default config
bun src/cli.ts config show          # Display current config
bun src/cli.ts config validate      # Validate config against schema
bun src/cli.ts config get <path>    # Get a config value
bun src/cli.ts config set <path> <value>  # Set a config value

bun src/cli.ts schema show cli      # Display JSON Schema
bun src/cli.ts schema export        # Export schema to schemas/
bun src/cli.ts schema validate <file>  # Validate a file against schema

bun src/cli.ts record [scenario]    # Record screenshots (default: all)
bun src/cli.ts record toggle --update-goldens  # Update golden files

bun src/cli.ts assemble [scenario]  # Assemble GIFs (default: all)
```

## Documentation

See [`docs/`](./docs/) for detailed guides:

- **[End-User Guide](./docs/guides/end-user-guide.md)** — how to add automated GIF generation to your VS Code extension

## Output

- `output/screenshots/<scenario>/*.png` — raw screenshots
- `output/verification-report.txt` — golden file verification results
- `<gifOutputDir>/demo-<scenario>.gif` — per-scenario GIFs
- `<gifOutputDir>/intro.gif` — combined GIF of all scenarios
