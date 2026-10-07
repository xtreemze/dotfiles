#!/usr/bin/env bash
set -euo pipefail

DOTFILES_DIR="${DOTFILES_DIR:-$HOME/.dotfiles}"
export DOTFILES_DIR

core="$DOTFILES_DIR/lib/install-core.sh"
if [[ ! -x "$core" ]]; then
  echo "dotfiles: installer core not found at $core" >&2
  exit 1
fi

# The core installer is the single authority for dry-run, package, hook, and
# Stow semantics. This wrapper intentionally does not mutate or rewrite flags.
exec "$core" "$@"
