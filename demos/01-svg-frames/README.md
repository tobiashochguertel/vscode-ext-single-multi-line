# Solution 01: SVG Frame Generator

**Approach:** Pure Node.js/Bun — renders code as SVG frames styled like VS Code dark theme, then assembles into optimized GIFs via ffmpeg + gifsicle.

## Pros

- **No display required** — works in CI, headless, SSH
- **Deterministic** — identical output every run
- **Fast** — no VS Code launch overhead
- **Cross-platform** — no macOS-specific APIs

## Cons

- **Not a real screenshot** — simulated VS Code appearance
- **Limited fidelity** — no real syntax highlighting engine, no real editor chrome
- **Manual theme maintenance** — colors/fonts must be kept in sync manually

## Prerequisites

```bash
brew install ffmpeg gifsicle librsvg
```

## Usage

```bash
# Generate SVG frames
bun demos/01-svg-frames/src/generate-frames.ts

# Assemble into GIFs
./demos/01-svg-frames/scripts/assemble-gif.sh

# Or via Taskfile from project root
task demo:01:generate
```

## Output

- `demos/01-svg-frames/output/frames/<scenario>/*.svg` — SVG frames
- `images/demo-toggle.gif`, `images/demo-compact.gif`, `images/intro.gif` — final GIFs
