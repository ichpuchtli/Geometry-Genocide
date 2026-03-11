#!/bin/zsh
set -euo pipefail

ROOT_DIR="${0:A:h:h}"
MENU_DIR="${ROOT_DIR}/sounds/generated/menu"
TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gg-elevenlabs-menu.XXXXXX")"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "Missing required segment: $1" >&2
    exit 1
  fi
}

require_file "${MENU_DIR}/start_menu_seg1.mp3"
require_file "${MENU_DIR}/start_menu_seg2.mp3"
require_file "${MENU_DIR}/start_menu_seg3.mp3"
require_file "${MENU_DIR}/gameover_menu_seg1.mp3"
require_file "${MENU_DIR}/gameover_menu_seg2.mp3"
require_file "${MENU_DIR}/gameover_menu_seg3.mp3"

printf "file '%s'\nfile '%s'\nfile '%s'\n" \
  "${MENU_DIR}/start_menu_seg1.mp3" \
  "${MENU_DIR}/start_menu_seg2.mp3" \
  "${MENU_DIR}/start_menu_seg3.mp3" > "${TMP_DIR}/start_menu.txt"

printf "file '%s'\nfile '%s'\nfile '%s'\n" \
  "${MENU_DIR}/gameover_menu_seg1.mp3" \
  "${MENU_DIR}/gameover_menu_seg2.mp3" \
  "${MENU_DIR}/gameover_menu_seg3.mp3" > "${TMP_DIR}/gameover_menu.txt"

ffmpeg -hide_banner -loglevel error -y \
  -f concat -safe 0 -i "${TMP_DIR}/start_menu.txt" -c copy \
  "${MENU_DIR}/start_menu_theme_elevenlabs_v1.mp3"

ffmpeg -hide_banner -loglevel error -y \
  -f concat -safe 0 -i "${TMP_DIR}/gameover_menu.txt" -c copy \
  "${MENU_DIR}/gameover_menu_theme_elevenlabs_v1.mp3"

echo "Created:"
echo "  ${MENU_DIR}/start_menu_theme_elevenlabs_v1.mp3"
echo "  ${MENU_DIR}/gameover_menu_theme_elevenlabs_v1.mp3"
