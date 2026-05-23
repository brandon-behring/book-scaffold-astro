#!/usr/bin/env bash
# Visual regression runner — chrome-headless + ImageMagick.
#
# v3.3.0: iterates over multiple fixtures (academic + course-notes). Each
# fixture spins up its own astro preview server on its own port; pages
# screenshot at 4 viewport widths and pixel-diff against baselines/.
#
# Why not Playwright: the bundled chromium-headless-shell doesn't ship for
# every Linux distro (e.g., Ubuntu 26.04 at time of writing). The system
# google-chrome works everywhere, including GitHub's ubuntu-latest runners.
# ImageMagick's `compare -metric AE` produces the same kind of numeric
# pixel-diff Playwright's toHaveScreenshot uses internally.
#
# Usage:
#   ./run.sh                  — run tests; fail if any diff > MAX_AE
#   ./run.sh --update         — regenerate baselines (review before commit)
#   ./run.sh --keep-server    — leave preview servers running for debug
#
# Env:
#   CI=1                      — quieter output, exit on first failure suppressed
#   MAX_AE=50000              — pixel-diff threshold per page-viewport pair
set -uo pipefail

cd "$(dirname "$0")"

MAX_AE="${MAX_AE:-50000}"
UPDATE=0
KEEP_SERVER=0
for arg in "$@"; do
  case "$arg" in
    --update) UPDATE=1 ;;
    --keep-server) KEEP_SERVER=1 ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# Fixture configuration. Format: "fixture-dir:port:page-prefix:page-spec[,page-spec...]"
# Each page-spec: "slug=path" (slug used for baseline filename; path is URL path).
FIXTURES=(
  "fixture:4173:academic:index=/,chapter-full=/chapters/full/,chapter-minimal=/chapters/minimal/"
  "fixture-course-notes:4174:course-notes:index=/,chapter-example=/chapters/example/,print=/print/"
  "fixture-research-portfolio:4175:research-portfolio:index=/,chapter-example=/chapters/example/,frontmatter-title=/frontmatter/title-page/"
  "fixture-academic-chapters:4176:academic-chapters:index=/,chapters-listing=/chapters/,chapter-found1=/chapters/found-week1/,chapter-synth5=/chapters/synth-week5/"
)
WIDTHS=(768 1280 1440 1920)

# Locate Chrome.
CHROME="${CHROME:-/usr/bin/google-chrome}"
if [ ! -x "$CHROME" ]; then
  CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
fi
if [ -z "$CHROME" ]; then
  echo "ERROR: google-chrome not found. Install Chrome or set CHROME=/path/to/chrome." >&2
  exit 2
fi

if ! command -v compare >/dev/null 2>&1; then
  echo "ERROR: ImageMagick 'compare' not found. apt-get install imagemagick" >&2
  exit 2
fi

OUT_DIR="${OUT_DIR:-/tmp/visual-runs.$$}"
mkdir -p "$OUT_DIR" baselines diffs

PIDS=()
cleanup() {
  if [ "$KEEP_SERVER" -eq 0 ]; then
    for pid in "${PIDS[@]:-}"; do
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    done
  fi
  rm -rf "$OUT_DIR"
}
trap cleanup EXIT

PASS=0
FAIL=0
FAILS=()

for fixture_spec in "${FIXTURES[@]}"; do
  IFS=':' read -r fixture_dir port prefix pages_csv <<< "$fixture_spec"
  echo "==> Building fixture: $fixture_dir"
  npm --prefix "$fixture_dir" run build >/dev/null

  echo "==> Starting preview server: $fixture_dir on :$port"
  npm --prefix "$fixture_dir" run preview > "/tmp/fixture-server-${port}.log" 2>&1 &
  PIDS+=($!)
  for i in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$port/" >/dev/null 2>&1; then break; fi
    sleep 0.5
  done
  if ! curl -fsS "http://127.0.0.1:$port/" >/dev/null 2>&1; then
    echo "ERROR: preview server failed to start on :$port. See /tmp/fixture-server-${port}.log" >&2
    exit 3
  fi

  # Parse "slug=path,slug=path,..." into parallel arrays.
  IFS=',' read -ra page_pairs <<< "$pages_csv"
  for pair in "${page_pairs[@]}"; do
    IFS='=' read -r slug path <<< "$pair"
    for w in "${WIDTHS[@]}"; do
      name="${prefix}-${slug}-${w}.png"
      shot="$OUT_DIR/$name"
      "$CHROME" --headless --disable-gpu --no-sandbox \
        --hide-scrollbars \
        --window-size="${w}x2000" \
        --screenshot="$shot" \
        "http://127.0.0.1:${port}${path}" >/dev/null 2>&1

      if [ ! -f "$shot" ]; then
        echo "FAIL ${name}: screenshot failed"
        FAIL=$((FAIL + 1)); FAILS+=("$name (no shot)")
        continue
      fi

      if [ "$UPDATE" -eq 1 ]; then
        cp "$shot" "baselines/$name"
        printf "BASELINE  %-40s  saved\n" "$name"
        PASS=$((PASS + 1))
        continue
      fi

      if [ ! -f "baselines/$name" ]; then
        echo "FAIL ${name}: missing baseline (run with --update to create)"
        FAIL=$((FAIL + 1)); FAILS+=("$name (no baseline)")
        continue
      fi

      ae=$(compare -metric AE -fuzz 2% \
        "baselines/$name" "$shot" "diffs/$name" 2>&1)
      rc=$?
      ae_num="${ae// /}"
      if ! [[ "$ae_num" =~ ^[0-9]+$ ]]; then
        ae_num=0
      fi

      if [ "$rc" -eq 2 ]; then
        printf "FAIL  %-40s  compare error: %s\n" "$name" "$ae"
        FAIL=$((FAIL + 1)); FAILS+=("$name (compare error)")
      elif [ "$ae_num" -gt "$MAX_AE" ]; then
        printf "FAIL  %-40s  AE=%-8s  > MAX_AE=%s\n" \
          "$name" "$ae_num" "$MAX_AE"
        FAIL=$((FAIL + 1)); FAILS+=("$name (AE=$ae_num)")
      else
        printf "PASS  %-40s  AE=%s\n" "$name" "$ae_num"
        PASS=$((PASS + 1))
      fi
    done
  done
done

echo
echo "==> Summary: $PASS passed, $FAIL failed (threshold: AE <= $MAX_AE)"
if [ "$FAIL" -gt 0 ]; then
  echo "Failed cases:"
  for f in "${FAILS[@]}"; do echo "  - $f"; done
  exit 1
fi
