# Demo GIF Generation

Automated GIF generation for the extension's features. Multiple solution approaches are provided so we can compare quality, fidelity, and ease of use.

## Structure

```structure
demos/
├── fixtures/                          # Shared fixture files for all solutions
├── shared/src/                        # Shared TypeScript utilities (transformer, scenarios)
├── 01-svg-frames/                     # Pure SVG rendering (deterministic, headless)
├── 02-vscode-test-electron/           # Real VS Code + macOS screencapture
├── 03-puppeteer/                      # Headless Chromium via Puppeteer
├── tsconfig.json                      # Shared TypeScript config for IDE
├── package.json                       # Shared bun dependencies
└── README.md                          # This file
```

## Solutions

| #      | Name                                              | Approach                           | Fidelity  | Platform | Headless |
| ------ | ------------------------------------------------- | ---------------------------------- | --------- | -------- | -------- |
| **01** | [SVG Frames](01-svg-frames/)                      | Render code as SVG, convert to GIF | Simulated | Any      | ❌       |
| **02** | [VS Code Test Electron](02-vscode-test-electron/) | Real VS Code + `screencapture`     | Real      | macOS    | ❌       |
| **03** | [Puppeteer](03-puppeteer/)                        | Headless Chromium HTML rendering   | High      | Any      | ✅       |

## Quick Start

```bash
# Install demo dependencies (from demos/ directory)
cd demos && bun install && cd ..

# Solution 01: SVG Frames (fast, headless)
bun demos/01-svg-frames/src/generate-frames.ts
./demos/01-svg-frames/scripts/assemble-gif.sh

# Solution 02: Real VS Code screenshots (requires macOS permissions)
npm run compile
npx tsc -p demos/02-vscode-test-electron/tsconfig.json
bun demos/02-vscode-test-electron/src/launch.ts
./demos/02-vscode-test-electron/scripts/assemble-gif.sh

# Solution 03: Puppeteer (headless Chromium, high fidelity)
bun demos/03-puppeteer/src/capture.ts
./demos/03-puppeteer/scripts/assemble-gif.sh

# Or via Taskfile
task demo:01:generate    # Solution 01
task demo:02:generate    # Solution 02
task demo:03:generate    # Solution 03
```

## Shared Components

- **`fixtures/`** — Sample code files used by all solutions
- **`shared/src/transformer.ts`** — Extension's parser/transformer functions (extracted)
- **`shared/src/scenarios.ts`** — Scenario definitions (before/after states, labels)

## Output

All solutions write final GIFs to the project's `images/` directory:

- `images/demo-toggle.gif` — Toggle single/multi-line
- `images/demo-compact.gif` — Compact blocks feature
- `images/intro.gif` — Combined overview

## Prerequisites

```bash
brew install ffmpeg gifsicle librsvg   # GIF assembly tools
bun --version                          # Bun runtime for TypeScript scripts
```

For Solution 02 (macOS only):

- System Settings → Privacy & Security → **Screen Recording** → add VS Code / Windsurf / Terminal
- System Settings → Privacy & Security → **Accessibility** → add VS Code / Windsurf / Terminal
