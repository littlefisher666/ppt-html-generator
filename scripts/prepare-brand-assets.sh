#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  printf '用法: %s <deck-output-directory> <hengda|chuangxin|zhengmeiji>\n' "$0" >&2
  exit 64
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "$script_dir/.." && pwd)"
output_dir="$1"
brand_key="$2"

case "$brand_key" in
  hengda|chuangxin|zhengmeiji) ;;
  *)
    printf '不支持的公司标识: %s（可选：hengda、chuangxin、zhengmeiji）\n' "$brand_key" >&2
    exit 65
    ;;
esac

source_asset_dir="$skill_dir/assets/$brand_key"
shared_asset_dir="$skill_dir/assets/shared"
target_asset_dir="$output_dir/assets/brand"
required_assets=(
  cover-campus.jpg logo-white.png agenda-welding.jpg logo-color.png
  section-campus-night.png closing-digital-globe.jpg theme-texture.jpg template-manifest.json
)

node "$script_dir/verify-hengda-assets.mjs" "$source_asset_dir" --shared-dir "$shared_asset_dir" --allow-review-source
mkdir -p "$target_asset_dir"
for asset_name in "${required_assets[@]}"; do
  if [[ -f "$source_asset_dir/$asset_name" ]]; then
    source_asset_path="$source_asset_dir/$asset_name"
  elif [[ -f "$shared_asset_dir/$asset_name" ]]; then
    source_asset_path="$shared_asset_dir/$asset_name"
  else
    printf '缺少%s母版素材: %s\n' "$brand_key" "$asset_name" >&2
    exit 66
  fi
  install -m 0644 "$source_asset_path" "$target_asset_dir/$asset_name"
done
node "$script_dir/verify-hengda-assets.mjs" "$target_asset_dir"
printf '已复制%s母版素材: %s（7 个媒体文件 + 1 个 manifest）\n' "$brand_key" "$target_asset_dir"
