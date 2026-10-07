#!/usr/bin/env bash

# Verified fallback acquisition for portable CLI tools.
# Caller owns required/optional failure semantics.

fallback_field() {
  local logical="$1" field="$2" catalog="${DOTFILES_DIR}/packages/fallbacks.yaml"
  [[ -f "$catalog" ]] || return 1

  awk -v logical="$logical" -v field="$field" '
    $0 ~ "name:[[:space:]]*" logical "([[:space:]]*,|[[:space:]]*})" {
      pattern = "(^|[,{[:space:]])" field ":[[:space:]]*[^,}]+"
      if (match($0, pattern)) {
        value = substr($0, RSTART, RLENGTH)
        sub(".*" field ":[[:space:]]*", "", value)
        gsub(/[[:space:]]/, "", value)
        print value
        exit
      }
    }
  ' "$catalog"
}

fallback_arch() {
  case "${1:-$(uname -m)}" in
    x86_64|amd64) echo x86_64 ;;
    aarch64|arm64) echo aarch64 ;;
    *) return 1 ;;
  esac
}

fallback_spec() {
  local logical="$1" os="$2" raw_arch="${3:-$(uname -m)}"
  local arch version repo asset checksum binary

  [[ "$os" == "linux" ]] || return 1
  arch=$(fallback_arch "$raw_arch") || return 1
  version=$(fallback_field "$logical" version 2>/dev/null || true)
  repo=$(fallback_field "$logical" repo 2>/dev/null || true)
  asset=$(fallback_field "$logical" "linux_$arch" 2>/dev/null || true)
  checksum=$(fallback_field "$logical" "linux_${arch}_sha256" 2>/dev/null || true)
  binary=$(fallback_field "$logical" binary 2>/dev/null || true)

  [[ -n "$version" && -n "$repo" && -n "$asset" && -n "$checksum" && -n "$binary" ]] || return 1
  [[ "$checksum" =~ ^[0-9a-fA-F]{64}$ ]] || return 1
  printf '%s|%s|%s|%s|%s\n' "$version" "$repo" "$asset" "$checksum" "$binary"
}

fallback_sha256() {
  local file="$1" hash rest
  if command -v sha256sum >/dev/null 2>&1; then
    read -r hash rest < <(sha256sum "$file")
  elif command -v shasum >/dev/null 2>&1; then
    read -r hash rest < <(shasum -a 256 "$file")
  else
    return 127
  fi
  printf '%s\n' "$hash"
}

fallback_download() {
  local url="$1" dest="$2"
  [[ "$url" == https://* ]] || return 64
  curl --fail --location --proto '=https' --tlsv1.2 --silent --show-error     --output "$dest" "$url"
}

fallback_acquire() {
  local logical="$1" os="$2" raw_arch="${3:-$(uname -m)}"
  local spec version repo asset expected binary base_url archive_url
  local tmp archive actual extract_dir source_bin bin_dir

  spec=$(fallback_spec "$logical" "$os" "$raw_arch") || return 65
  IFS='|' read -r version repo asset expected binary <<< "$spec"

  base_url="https://github.com/$repo/releases/download/$version"
  archive_url="$base_url/$asset"
  bin_dir="${FALLBACK_BIN_DIR:-$HOME/.local/bin}"

  if [[ "${DRY_RUN:-false}" == "true" ]]; then
    printf 'fallback: %s %s from %s -> %s/%s (sha256: %s)\n' \
      "$logical" "$version" "$archive_url" "$bin_dir" "$binary" "$expected"
    return 0
  fi

  for cmd in curl tar mktemp mkdir cp chmod rm find; do
    command -v "$cmd" >/dev/null 2>&1 || return 66
  done

  tmp=$(mktemp -d)
  archive="$tmp/$asset"
  extract_dir="$tmp/extract"
  mkdir -p "$extract_dir"

  if ! fallback_download "$archive_url" "$archive"; then
    rm -rf "$tmp"
    return 67
  fi
  actual=$(fallback_sha256 "$archive") || {
    rm -rf "$tmp"
    return 68
  }
  [[ "${actual,,}" == "${expected,,}" ]] || {
    rm -rf "$tmp"
    return 69
  }

  case "$asset" in
    *.tar.gz|*.tgz) tar -xzf "$archive" -C "$extract_dir" ;;
    *) rm -rf "$tmp"; return 70 ;;
  esac

  source_bin=""
  if [[ -f "$extract_dir/$binary" ]]; then
    source_bin="$extract_dir/$binary"
  else
    while IFS= read -r candidate; do
      source_bin="$candidate"
      break
    done < <(find "$extract_dir" -type f -name "$binary" -print 2>/dev/null)
  fi
  [[ -n "$source_bin" && -f "$source_bin" ]] || {
    rm -rf "$tmp"
    return 71
  }

  mkdir -p "$bin_dir"
  cp "$source_bin" "$bin_dir/$binary"
  chmod 0755 "$bin_dir/$binary"
  rm -rf "$tmp"

  printf 'fallback-installed: %s %s -> %s/%s\n' "$logical" "$version" "$bin_dir" "$binary"
}
