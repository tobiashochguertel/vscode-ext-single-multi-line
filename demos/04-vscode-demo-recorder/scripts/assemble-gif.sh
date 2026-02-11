#!/usr/bin/env bash
#
# Solution 02: Convert PNG screenshots into optimized GIFs.
#
# Usage:
#   ./demos/02-vscode-test-electron/scripts/assemble-gif.sh [scenario]
#   ./demos/02-vscode-test-electron/scripts/assemble-gif.sh          # all
#   ./demos/02-vscode-test-electron/scripts/assemble-gif.sh toggle   # specific
#
# Prerequisites: ffmpeg, gifsicle
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOLUTION_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$SOLUTION_DIR/../.." && pwd)"
SCREENSHOTS_DIR="$SOLUTION_DIR/output/screenshots"
OUTPUT_DIR="$PROJECT_DIR/images"
TEMP_DIR="$SOLUTION_DIR/output/.tmp-gif"

# GIF settings
FRAME_DELAY=150  # Centiseconds between frames (150 = 1.5s per frame)
WIDTH=1440       # Output width — half of Retina (2880) for crisp 1:2 downscale
LOSSY=30         # gifsicle lossy compression (lower = better quality)
COLORS=256       # Max colors in palette (GIF maximum)

# ── Helpers ───────────────────────────────────────────────────

check_deps() {
  local missing=()
  for cmd in ffmpeg gifsicle; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done
  if [ ${#missing[@]} -gt 0 ]; then
    echo "ERROR: Missing required tools: ${missing[*]}"
    echo "Install with: brew install ${missing[*]}"
    exit 1
  fi
}

assemble_scenario() {
  local scenario="$1"
  local output_name="${2:-demo-${scenario}.gif}"
  local input_dir="$SCREENSHOTS_DIR/$scenario"
  local output_file="$OUTPUT_DIR/$output_name"

  if [ ! -d "$input_dir" ]; then
    echo "⚠ No screenshots for scenario '$scenario' in $input_dir"
    return 1
  fi

  local png_count
  png_count=$(find "$input_dir" -name '*.png' | wc -l | tr -d ' ')
  if [ "$png_count" -eq 0 ]; then
    echo "⚠ No PNG files found in $input_dir"
    return 1
  fi

  echo "▶ Assembling $scenario ($png_count frames) → $output_file"
  mkdir -p "$TEMP_DIR" "$OUTPUT_DIR"

  # Step 1: Create palette (full stats_mode for best per-frame quality)
  local palette="$TEMP_DIR/palette-${scenario}.png"
  ffmpeg -y -framerate 1 -pattern_type glob -i "${input_dir}/*.png" \
    -vf "scale=${WIDTH}:-1:flags=lanczos,palettegen=max_colors=${COLORS}:stats_mode=full" \
    "$palette" 2>/dev/null

  # Step 2: Generate GIF using the palette
  #   - sierra2_4a dithering: smooth, no visible grid artifacts (unlike bayer)
  #   - diff_mode=rectangle: only encode changed regions per frame
  local raw_gif="$TEMP_DIR/raw-${scenario}.gif"
  ffmpeg -y -framerate 1 -pattern_type glob -i "${input_dir}/*.png" \
    -i "$palette" \
    -lavfi "scale=${WIDTH}:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=sierra2_4a:diff_mode=rectangle" \
    "$raw_gif" 2>/dev/null

  # Step 3: Light optimization with gifsicle (preserve quality)
  gifsicle -O3 --lossy="$LOSSY" --colors "$COLORS" \
    --delay "$FRAME_DELAY" \
    --no-warnings --loop \
    "$raw_gif" -o "$output_file"

  local size
  size=$(du -h "$output_file" | cut -f1 | tr -d ' ')
  echo "✓ $output_file ($size)"
}

combine_all() {
  local output_file="$OUTPUT_DIR/intro.gif"
  local inputs=()

  for scenario_dir in "$SCREENSHOTS_DIR"/*/; do
    [ -d "$scenario_dir" ] || continue
    local scenario
    scenario=$(basename "$scenario_dir")
    local gif="$OUTPUT_DIR/demo-${scenario}.gif"
    if [ -f "$gif" ]; then
      inputs+=("$gif")
    fi
  done

  if [ ${#inputs[@]} -eq 0 ]; then
    echo "⚠ No scenario GIFs found to combine"
    return 1
  fi

  echo "▶ Combining ${#inputs[@]} scenario GIFs → $output_file"
  gifsicle -O3 --colors "$COLORS" \
    --no-warnings --merge --loop \
    "${inputs[@]}" -o "$output_file"

  local size
  size=$(du -h "$output_file" | cut -f1 | tr -d ' ')
  echo "✓ $output_file ($size)"
}

# ── Main ──────────────────────────────────────────────────────

check_deps

scenario="${1:-all}"

if [ "$scenario" = "all" ]; then
  for scenario_dir in "$SCREENSHOTS_DIR"/*/; do
    [ -d "$scenario_dir" ] || continue
    name=$(basename "$scenario_dir")
    assemble_scenario "$name" || true
  done
  combine_all || true
else
  assemble_scenario "$scenario"
fi

rm -rf "$TEMP_DIR"

echo ""
echo "═══ GIF Assembly Complete ═══"
echo "Output directory: $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"/*.gif 2>/dev/null || echo "(no GIFs found)"
