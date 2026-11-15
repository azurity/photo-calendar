#!/usr/bin/env bash
# Optional fallback for containers where apt install is unavailable.
# Downloads WebKitGTK 4.1 development packages and extracts them into .sysroot/.
# Prefer `sudo apt-get install libwebkit2gtk-4.1-dev ...` on a normal machine.
set -euo pipefail
cd "$(dirname "$0")/.."
if pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
  echo "WebKitGTK 4.1 development files already available"
  exit 0
fi
mkdir -p .sysroot/debs .sysroot/root
(
  cd .sysroot/debs
  apt-get download \
    libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev libsoup-3.0-dev \
    libnghttp2-dev libsysprof-4-dev
)
for deb in .sysroot/debs/*.deb; do
  dpkg-deb -x "$deb" .sysroot/root
done
mkdir -p .sysroot/root/usr/lib/x86_64-linux-gnu
for lib in webkit2gtk-4.1 soup-3.0 javascriptcoregtk-4.1; do
  source_lib="$(ldconfig -p | awk -v name="lib${lib}.so.0" '$1 == name { print $NF; exit }')"
  if [ -n "$source_lib" ]; then
    ln -sf "$source_lib" ".sysroot/root/usr/lib/x86_64-linux-gnu/lib${lib}.so"
  fi
done
echo "Extracted to .sysroot/root; scripts/tauri-env.mjs will use it automatically"
