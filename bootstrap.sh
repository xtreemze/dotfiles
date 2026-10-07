#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/xtreemze/dotfiles.git}"
PUBLIC_DOTFILES_DIR="${PUBLIC_DOTFILES_DIR:-$HOME/.local/share/xtreemze/dotfiles-public}"

fail() { printf 'dotfiles: %s\n' "$*" >&2; exit 1; }
info() { printf 'dotfiles: %s\n' "$*"; }

run_privileged() {
  if [[ "$(id -u)" -eq 0 ]]; then "$@"
  elif command -v sudo >/dev/null 2>&1; then sudo "$@"
  else fail "root or sudo is required to install bootstrap packages"
  fi
}

detect_os() {
  case "$(uname -s)" in
    Darwin) echo macos ;;
    Linux) [[ -n "${TERMUX_VERSION:-}" ]] && echo termux || echo linux ;;
    *) echo unsupported ;;
  esac
}

install_homebrew() {
  local installer
  installer=$(mktemp "${TMPDIR:-/tmp}/dotfiles-homebrew.XXXXXX")
  trap 'rm -f "${installer:-}"' RETURN
  curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o "$installer"
  /bin/bash "$installer"

  local bp
  for bp in /opt/homebrew/bin /usr/local/bin; do
    if [[ -x "$bp/brew" ]]; then
      eval "$("$bp/brew" shellenv)"
      return 0
    fi
  done
  return 1
}

install_prerequisites() {
  case "$1" in
    macos)
      if ! xcode-select -p >/dev/null 2>&1; then
        xcode-select --install 2>/dev/null || true
        fail "install the macOS Command Line Tools, then rerun this command"
      fi
      command -v git >/dev/null 2>&1 || fail "git is unavailable after Command Line Tools installation"
      if ! command -v brew >/dev/null 2>&1; then
        info "installing Homebrew"
        install_homebrew || fail "Homebrew installation failed"
      fi
      ;;
    termux)
      pkg update -y
      pkg install -y git curl bash
      ;;
    linux)
      if command -v apt >/dev/null 2>&1; then
        run_privileged apt update -qq
        run_privileged apt install -y -qq git curl
      elif command -v dnf >/dev/null 2>&1; then
        run_privileged dnf install -y git curl
      elif command -v pacman >/dev/null 2>&1; then
        run_privileged pacman -S --needed --noconfirm git curl
      elif command -v apk >/dev/null 2>&1; then
        run_privileged apk add git curl bash
      else
        fail "supported package manager not found (apt, dnf, pacman, apk)"
      fi
      ;;
    *) fail "unsupported operating system: $(uname -s)" ;;
  esac
}

os=$(detect_os)
install_prerequisites "$os"

if [[ -d "$PUBLIC_DOTFILES_DIR/.git" ]]; then
  current=$(git -C "$PUBLIC_DOTFILES_DIR" remote get-url origin 2>/dev/null || true)
  [[ "$current" == "$REPO_URL" || "$current" == "git@github.com:xtreemze/dotfiles.git" ]] ||
    fail "$PUBLIC_DOTFILES_DIR is already a different Git checkout; refusing to replace it"
  git -C "$PUBLIC_DOTFILES_DIR" pull --ff-only
elif [[ -e "$PUBLIC_DOTFILES_DIR" ]]; then
  fail "$PUBLIC_DOTFILES_DIR exists and is not the public dotfiles checkout"
else
  info "cloning public dotfiles bootstrap"
  mkdir -p "$(dirname "$PUBLIC_DOTFILES_DIR")"
  git clone "$REPO_URL" "$PUBLIC_DOTFILES_DIR"
fi

[[ -x "$PUBLIC_DOTFILES_DIR/install.sh" ]] || fail "public installer not found"
[[ -x "$PUBLIC_DOTFILES_DIR/scripts/authenticate-private" ]] || fail "private handoff script not found"

# First provision safe/public packages only. Delaying Stow avoids creating links
# that the authenticated private repository would immediately need to replace.
info "provisioning the safe public baseline"
DOTFILES_DIR="$PUBLIC_DOTFILES_DIR" "$PUBLIC_DOTFILES_DIR/install.sh" --skip-stow "$@"

# If authentication succeeds and the account can access the private repository,
# this execs the private installer and never returns.
if DOTFILES_DIR="$PUBLIC_DOTFILES_DIR" "$PUBLIC_DOTFILES_DIR/scripts/authenticate-private" "$@"; then
  exit 0
fi

# Public users or machines without private access still receive a complete,
# safe Stow-based configuration from the public repository.
info "private configuration unavailable; applying the public Stow configuration"
DOTFILES_DIR="$PUBLIC_DOTFILES_DIR" exec "$PUBLIC_DOTFILES_DIR/install.sh" --skip-packages "$@"
