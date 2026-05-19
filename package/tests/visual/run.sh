#!/usr/bin/env bash
# Visual regression runner — chrome-headless + ImageMagick.
#
# Why not Playwright: the bundled chromium-headless-shell doesn't ship
# for every Linux distro (e.g., Ubuntu 26.04 at time of writing). The
# system google-chrome works everywhere, including GitHub's ubuntu-latest
# runners. ImageMagick's `compare -metric AE` produces the same kind of
# numeric pixel-diff Playwright's toHaveScreenshot uses internally.
#
# Usage:
#   ./run.sh                  — run tests; fail if any diff > MAX_AE
#   ./run.sh --update         — regenerate baselines (review before commit)
#   ./run.sh --keep-server    — leave the preview server running for debug
#
# Env:
#   CI=1                      — quieter output, exit on first failure suppressed
#   MAX_AE=50000              — pixel-diff threshold per page-viewport pair
#   PORT=4173                 — fixture preview port
set -uo pipefail

cd "$(dirname "$0")"

MAX_AE="${MAX_AE:-50000}"
PORT="${PORT:-4173}"
UPDATE=0
KEEP_SERVER=0
for arg in "$@"; do
  case "$arg" in
    --update) UPDATE=1 ;;
    --keep-server) KEEP_SERVER=1 ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# Page × viewport matrix. Each row: "slug:url-path".
PAGES=(
  "index:/"
  "chapter-full:/chapters/full/"
  "chapter-minimal:/chapters/minimal/"
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

# Locate ImageMagick `compare`.
if ! command -v compare >/dev/null 2>&1; then
  echo "ERROR: ImageMagick 'compare' not found. apt-get install imagemagick" >&2
  exit 2
fi

# Build the fixture.
echo "==> Building fixture"
npm --prefix fixture run build >/dev/null

# Start preview server in the background.
echo "==> Starting preview server on :$PORT"
npm --prefix fixture run preview > /tmp/fixture-server.log 2>&1 &
SERVER_PID=$!
cleanup() {
  if [ "$KEEP_SERVER" -eq 0 ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf /tmp/visual-runs.$$
}
trap cleanup EXIT

# Wait for server to come up.
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
  echo "ERROR: preview server failed to start. See /tmp/fixture-server.log" >&2
  exit 3
fi

OUT_DIR="${OUT_DIR:-/tmp/visual-runs.$$}"
mkdir -p "$OUT_DIR"
mkdir -p baselines diffs

PASS=0
FAIL=0
FAILS=()

for entry in "${PAGES[@]}"; do
  IFS=':' read -r slug path <<< "$entry"
  for w in "${WIDTHS[@]}"; do
    name="${slug}-${w}.png"
    shot="$OUT_DIR/$name"
    "$CHROME" --headless --disable-gpu --no-sandbox \
      --hide-scrollbars \
      --window-size="${w}x2000" \
      --screenshot="$shot" \
      "http://127.0.0.1:$PORT$path" >/dev/null 2>&1

    if [ ! -f "$shot" ]; then
      echo "FAIL ${name}: screenshot failed"
      FAIL=$((FAIL + 1)); FAILS+=("$name (no shot)")
      continue
    fi

    if [ "$UPDATE" -eq 1 ]; then
      cp "$shot" "baselines/$name"
      printf "BASELINE  %-32s  saved\n" "$name"
      PASS=$((PASS + 1))
      continue
    fi

    if [ ! -f "baselines/$name" ]; then
      echo "FAIL ${name}: missing baseline (run with --update to create)"
      FAIL=$((FAIL + 1)); FAILS+=("$name (no baseline)")
      continue
    fi

    # ImageMagick compare returns AE (absolute number of differing pixels).
    # Exit code: 0 = identical, 1 = different (with valid metric), 2 = error.
    ae=$(compare -metric AE -fuzz 2% \
      "baselines/$name" "$shot" "diffs/$name" 2>&1)
    rc=$?
    # compare may emit "<count>" on stderr even on rc=1. Capture as number.
    ae_num="${ae// /}"
    if ! [[ "$ae_num" =~ ^[0-9]+$ ]]; then
      ae_num=0
    fi

    if [ "$rc" -eq 2 ]; then
      printf "FAIL  %-32s  compare error: %s\n" "$name" "$ae"
      FAIL=$((FAIL + 1)); FAILS+=("$name (compare error)")
    elif [ "$ae_num" -gt "$MAX_AE" ]; then
      printf "FAIL  %-32s  AE=%-8s  > MAX_AE=%s   (diff: diffs/%s)\n" \
        "$name" "$ae_num" "$MAX_AE" "$name"
      FAIL=$((FAIL + 1)); FAILS+=("$name (AE=$ae_num)")
    else
      printf "PASS  %-32s  AE=%s\n" "$name" "$ae_num"
      PASS=$((PASS + 1))
    fi
  done
done

echo
echo "==> Summary: $PASS passed, $FAIL failed (threshold: AE <= $MAX_AE)"
if [ "$FAIL" -gt 0 ]; then
  echo "Failed cases:"
  for f in "${FAILS[@]}"; do echo "  - $f"; done
  exit 1
fi
