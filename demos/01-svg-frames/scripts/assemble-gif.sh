#!/usr/bin/env bash
#
# Solution 01: Convert SVG frames into optimized GIFs.
#
# Usage:
#   ./demos/01-svg-frames/scripts/assemble-gif.sh [scenario]
#   ./demos/01-svg-frames/scripts/assemble-gif.sh          # all
#   ./demos/01-svg-frames/scripts/assemble-gif.sh toggle   # specific
#
# Prerequisites: ffmpeg, gifsicle, rsvg-convert (from librsvg)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOLUTION_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$SOLUTION_DIR/../.." && pwd)"
FRAMES_DIR="$SOLUTION_DIR/output/frames"
OUTPUT_DIR="$PROJECT_DIR/images"
TEMP_DIR="$SOLUTION_DIR/output/.tmp-gif"

# GIF settings
FRAME_DELAY=150  # Centiseconds between frames (150 = 1.5s per frame)
WIDTH=700        # Output width in pixels (matches SVG width)
LOSSY=80         # gifsicle lossy compression (0-200, higher = smaller)
COLORS=128       # Max colors in palette

# ── Helpers ───────────────────────────────────────────────────

USE_RSVG=false

check_deps() {
  local missing=()
  for cmd in ffmpeg gifsicle; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done
  if command -v rsvg-convert &>/dev/null; then
    USE_RSVG=true
  else
    echo "NOTE: rsvg-convert not found, will use ffmpeg for SVG→PNG."
    echo "      For better quality: brew install librsvg"
  fi
  if [ ${#missing[@]} -gt 0 ]; then
    echo "ERROR: Missing required tools: ${missing[*]}"
    echo "Install with: brew install ${missing[*]}"
    exit 1
  fi
}

svg_to_png() {
  local svg="$1"
  local png="$2"
  if [ "$USE_RSVG" = true ]; then
    rsvg-convert -w "$WIDTH" "$svg" -o "$png"
  else
    ffmpeg -y -i "$svg" -vf "scale=${WIDTH}:-1" "$png" 2>/dev/null
  fi
}

assemble_scenario() {
  local scenario="$1"
  local output_name="${2:-demo-${scenario}.gif}"
  local input_dir="$FRAMES_DIR/$scenario"
  local output_file="$OUTPUT_DIR/$output_name"
  local png_dir="$TEMP_DIR/png-${scenario}"

  if [ ! -d "$input_dir" ]; then
    echo "⚠ No frames for scenario '$scenario' in $input_dir"
    return 1
  fi

  local svg_count
  svg_count=$(find "$input_dir" -name '*.svg' | wc -l | tr -d ' ')
  if [ "$svg_count" -eq 0 ]; then
    echo "⚠ No SVG files found in $input_dir"
    return 1
  fi

  echo "▶ Assembling $scenario ($svg_count frames) → $output_file"
  mkdir -p "$png_dir" "$OUTPUT_DIR"

  for svg in "$input_dir"/*.svg; do
    local base
    base=$(basename "$svg" .svg)
    svg_to_png "$svg" "$png_dir/${base}.png"
  done

  local palette="$TEMP_DIR/palette-${scenario}.png"
  ffmpeg -y -framerate 1 -pattern_type glob -i "${png_dir}/*.png" \
    -vf "palettegen=max_colors=${COLORS}:stats_mode=diff" \
    "$palette" 2>/dev/null

  local raw_gif="$TEMP_DIR/raw-${scenario}.gif"
  ffmpeg -y -framerate 1 -pattern_type glob -i "${png_dir}/*.png" \
    -i "$palette" \
    -lavfi "[0:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" \
    "$raw_gif" 2>/dev/null

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

  for scenario_dir in "$FRAMES_DIR"/*/; do
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
  gifsicle -O3 --lossy="$LOSSY" --colors "$COLORS" \
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
  for scenario_dir in "$FRAMES_DIR"/*/; do
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
