# Demo GIF Generation

Automated GIF recording for the extension's features.

## Prerequisites

```bash
brew install ffmpeg gifsicle
npm install  # installs @vscode/test-electron
```

## How It Works

1. **Fixture files** in `demos/fixtures/` contain sample code for each feature
2. **Scenario scripts** in `demos/scenarios/` run inside VS Code Extension Development Host:
   - Open a fixture file
   - Select text, execute extension commands
   - Capture screenshots at each step via macOS `screencapture`
3. **`assemble-gif.sh`** converts screenshot sequences into optimized GIFs using `ffmpeg` + `gifsicle`

## Usage

```bash
# Record all demos and generate GIFs
task demo:record

# Only assemble GIFs from existing screenshots
task demo:assemble

# Record a specific feature
task demo:record -- toggle

# Clean demo artifacts
task demo:clean
```

## Adding a New Demo

1. Create a fixture file in `demos/fixtures/`
2. Create a scenario in `demos/scenarios/` (see existing ones as templates)
3. Register it in `demos/run-scenarios.ts`
4. Run `task demo:record`

## Output

Generated GIFs are placed in `images/`:

- `images/demo-toggle.gif` — Toggle single/multi-line
- `images/demo-compact.gif` — Compact blocks feature
- `images/intro.gif` — Combined overview (all features)

## Optimization

The pipeline applies:

- **ffmpeg**: Palette-based GIF encoding (256 colors optimized per frame)
- **gifsicle**: Frame optimization (`-O3`), lossy compression (`--lossy=80`), color reduction
- Typical result: **200-500KB** vs the original 3MB intro.gif
