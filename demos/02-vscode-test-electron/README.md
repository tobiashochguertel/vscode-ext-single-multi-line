# Solution 02: VS Code Test Electron + screencapture

**Approach:** Launch a real VS Code Extension Development Host via `@vscode/test-electron`, execute extension commands on fixture files, and capture real screenshots via macOS `screencapture`.

## Pros

- **Real screenshots** — actual VS Code UI with real syntax highlighting, themes, chrome
- **High fidelity** — exactly what users see
- **Tests real extension behavior** — catches UI regressions

## Cons

- **macOS only** — uses `screencapture` (could be adapted for other platforms)
- **Requires permissions** — VS Code / Windsurf / Terminal must be in macOS System Settings → Privacy & Security → Screen Recording & Accessibility
- **Non-deterministic** — screenshots depend on screen resolution, window size, OS theme
- **Slower** — launches a full VS Code instance

## Prerequisites

```bash
brew install ffmpeg gifsicle

# macOS permissions required:
# System Settings → Privacy & Security → Screen Recording → add VS Code / Windsurf / Terminal
# System Settings → Privacy & Security → Accessibility → add VS Code / Windsurf / Terminal
```

## Usage

```bash
# 1. Compile the extension first
npm run compile   # from project root

# 2. Compile the scenario runner (needs tsc for CommonJS output)
npx tsc -p demos/02-vscode-test-electron/tsconfig.json

# 3. Launch VS Code and record screenshots
bun demos/02-vscode-test-electron/src/launch.ts [toggle|compact|all]

# 4. Assemble into GIFs
./demos/02-vscode-test-electron/scripts/assemble-gif.sh

# Or via Taskfile from project root
task demo:02:generate
```

## Output

- `demos/02-vscode-test-electron/output/screenshots/<scenario>/*.png` — raw screenshots
- `images/demo-toggle.gif`, `images/demo-compact.gif`, `images/intro.gif` — final GIFs
