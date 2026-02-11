# Solution 03: Puppeteer (Headless Chromium)

**Approach:** Render code as HTML styled like VS Code dark theme in a headless Chromium browser via Puppeteer, then capture pixel-perfect PNG screenshots with 2x device scale factor (Retina).

## Pros

- **High fidelity** — real browser rendering with sub-pixel antialiasing, proper font metrics
- **No display required** — headless Chromium, works in CI/SSH
- **Deterministic** — identical output every run
- **Cross-platform** — works on macOS, Linux, Windows
- **No macOS permissions** — no Accessibility or Screen Recording needed
- **Proper CSS layout** — no manual character-width calculations like SVG approach

## Cons

- **Not real VS Code** — simulated editor appearance (but much closer than SVG)
- **Requires Chromium download** — Puppeteer downloads ~170MB Chromium on first run
- **Slower than SVG** — browser startup overhead (~2-3s)

## Prerequisites

```bash
brew install ffmpeg gifsicle

# Puppeteer is installed via demos/package.json
cd demos && bun install
```

## Usage

```bash
# Capture screenshots
bun demos/03-puppeteer/src/capture.ts

# Assemble into GIFs
./demos/03-puppeteer/scripts/assemble-gif.sh

# Or via Taskfile from project root
task demo:03:generate
```

## Output

- `demos/03-puppeteer/output/screenshots/<scenario>/*.png` — Retina PNG screenshots
- `images/demo-toggle.gif`, `images/demo-compact.gif`, `images/intro.gif` — final GIFs
