#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  printf '用法: %s <deck-output-directory>\n' "$0" >&2
  exit 64
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"
output_dir="$1"
source_asset_dir="$skill_dir/assets/hengda"
target_asset_dir="$output_dir/assets/hengda"

required_assets=(
  cover-campus.jpg
  logo-white.png
  agenda-welding.jpg
  logo-color.png
  section-campus-night.png
  closing-digital-globe.jpg
  theme-texture.jpg
  template-manifest.json
)

node "$script_dir/verify-hengda-assets.mjs" "$source_asset_dir" --allow-review-source

for asset_name in "${required_assets[@]}"; do
  if [[ ! -s "$source_asset_dir/$asset_name" ]]; then
    printf '缺少恒达内置素材: %s\n' "$source_asset_dir/$asset_name" >&2
    exit 66
  fi
done

mkdir -p "$target_asset_dir"
for asset_name in "${required_assets[@]}"; do
  install -m 0644 "$source_asset_dir/$asset_name" "$target_asset_dir/$asset_name"
done

node "$script_dir/verify-hengda-assets.mjs" "$target_asset_dir"
printf '已复制恒达母版素材: %s（7 个媒体文件 + 1 个 manifest）\n' "$target_asset_dir"
