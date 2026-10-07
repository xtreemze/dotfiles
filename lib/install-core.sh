#!/usr/bin/env bash
set -euo pipefail

DOTFILES_DIR="${DOTFILES_DIR:-$HOME/.dotfiles}"
INTERACTIVE="${INTERACTIVE:-false}"
FORCE_MODE="${FORCE_MODE:-}"
FORCE_MACHINE="${FORCE_MACHINE:-}"
ROLE_OVERRIDES=()
DRY_RUN="${DRY_RUN:-false}"
SKIP_PACKAGES="${SKIP_PACKAGES:-false}"
SKIP_STOW="${SKIP_STOW:-false}"
SKIP_HOOKS="${SKIP_HOOKS:-false}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"
FORCE="${FORCE:-false}"
ADOPT="${ADOPT:-false}"
VERBOSE="${VERBOSE:-false}"
JSON_OUTPUT="${JSON_OUTPUT:-false}"
MINIMAL_MODE="${MINIMAL_MODE:-false}"

fallback_library="$DOTFILES_DIR/lib/fallback-acquire.sh"
if [[ -r "$fallback_library" ]]; then
  # shellcheck source=lib/fallback-acquire.sh
  source "$fallback_library"
fi

show_help() {
  cat <<'EOF'
Dotfiles Installer v4.0

Usage: ./install.sh [OPTIONS]

Modes:
  -i, --interactive    Use the prebuilt optional TUI
  -s, --server         Force server/headless mode
  -d, --desktop        Force desktop mode
  -m, --machine NAME  Select machine metadata explicitly
  -r, --role NAME     Add a role (repeatable: remote, development, desktop, server, mobile)
  -l, --list-machines List available machine metadata

Installation:
  --dry-run           Describe package and Stow actions without changing state
  --minimal           Install required packages only; keep optional tools if already present
  --skip-packages     Do not install software packages
  --skip-stow         Do not deploy configuration with GNU Stow
  --skip-hooks        Do not run pre/post-install hooks
  --skip-backup       Skip the backup pre-install hook
  --adopt             Explicitly allow GNU Stow to adopt conflicting files
  --force             Skip the pre-install environment check

Diagnostics:
  --verbose           Verbose output
  --trace             Enable shell tracing
  --json-output       Emit JSON progress events for the optional TUI
  -h, --help          Show this help
  -v, --version       Show version

Architecture:
  Package provisioning and configuration deployment are independent.
  macOS packages come from Brewfile via `brew bundle`.
  Linux/Termux use logical role manifests plus packages/catalog.yaml to map
  package-manager names and executable probes. Minimal mode installs required
  packages only while retaining configuration for optional tools already present.
  GNU Stow deploys an explicit repository config set and never adopts
  conflicting machine files unless --adopt is supplied.
EOF
}

show_version() { echo "Dotfiles Installer v4.0"; }

list_machines() {
  echo "Available machine metadata:"
  if [[ ! -d "$DOTFILES_DIR/machines" ]]; then
    echo "  (none)"
    return 0
  fi

  local dir name desc
  for dir in "$DOTFILES_DIR"/machines/*/; do
    [[ -d "$dir" ]] || continue
    name=$(basename "$dir")
    desc=""
    if [[ -f "$dir/config.yaml" ]]; then
      desc=$(grep '^description:' "$dir/config.yaml" 2>/dev/null | cut -d: -f2- | xargs || true)
    fi
    if [[ -n "$desc" ]]; then
      echo "  - $name: $desc"
    else
      echo "  - $name"
    fi
  done
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--interactive) INTERACTIVE=true; shift ;;
    -s|--server) FORCE_MODE="server"; shift ;;
    -d|--desktop) FORCE_MODE="desktop"; shift ;;
    -m|--machine)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 2; }
      FORCE_MACHINE="$2"; shift 2
      ;;
    -r|--role)
      [[ $# -ge 2 ]] || { echo "Missing value for $1" >&2; exit 2; }
      [[ "$2" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || { echo "Invalid role: $2" >&2; exit 2; }
      ROLE_OVERRIDES+=("$2"); shift 2
      ;;
    -l|--list-machines) list_machines; exit 0 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --minimal) MINIMAL_MODE=true; shift ;;
    --skip-packages) SKIP_PACKAGES=true; shift ;;
    --skip-stow) SKIP_STOW=true; shift ;;
    --skip-hooks) SKIP_HOOKS=true; shift ;;
    --skip-backup) SKIP_BACKUP=true; shift ;;
    --adopt) ADOPT=true; shift ;;
    --force) FORCE=true; shift ;;
    --verbose) VERBOSE=true; shift ;;
    --trace) set -x; shift ;;
    --json-output) JSON_OUTPUT=true; shift ;;
    -h|--help) show_help; exit 0 ;;
    -v|--version) show_version; exit 0 ;;
    *) echo "Unknown option: $1" >&2; show_help; exit 2 ;;
  esac
done

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_header() { echo -e "${BOLD}${BLUE}Dotfiles Installer v4.0${NC}"; }
print_step() { echo -e "${CYAN}▸${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1" >&2; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_verbose() { [[ "$VERBOSE" == "true" ]] && echo -e "${CYAN}  →${NC} $1" || true; }

json_emit() {
  [[ "$JSON_OUTPUT" == "true" ]] || return 0
  local event="$1" message="$2" status="${3:-info}" timestamp
  timestamp=$(date +%s)
  message="${message//\\/\\\\}"
  message="${message//\"/\\\"}"
  message="${message//$'\n'/\\n}"
  printf '{"timestamp":%s,"event":"%s","message":"%s","status":"%s"}\n' \
    "$timestamp" "$event" "$message" "$status"
}

json_progress() {
  [[ "$JSON_OUTPUT" == "true" ]] || return 0
  local current="$1" total="$2" message="$3" timestamp
  timestamp=$(date +%s)
  message="${message//\\/\\\\}"
  message="${message//\"/\\\"}"
  printf '{"timestamp":%s,"event":"progress","current":%s,"total":%s,"message":"%s"}\n' \
    "$timestamp" "$current" "$total" "$message"
}

run_hooks() {
  local stage="$1" hooks_dir="$DOTFILES_DIR/hooks/$1" hook hook_name failures=0

  if [[ "$SKIP_HOOKS" == "true" ]]; then
    print_info "Skipping $stage hooks (--skip-hooks)"
    json_emit "hooks.$stage" "Skipping $stage hooks" "skipped"
    return 0
  fi
  [[ -d "$hooks_dir" ]] || return 0

  print_step "Running $stage hooks..."
  export DOTFILES_DIR MACHINE HOSTNAME OS USE_CASE SHELL
  export DRY_RUN INTERACTIVE SKIP_BACKUP FORCE ADOPT

  for hook in "$hooks_dir"/*.sh; do
    [[ -f "$hook" && -x "$hook" ]] || continue
    hook_name=$(basename "$hook")

    if [[ "$stage" == "pre-install" && "$hook_name" == "00-check-env.sh" && "$FORCE" == "true" ]]; then
      print_info "Skipping $hook_name (--force)"
      continue
    fi
    if [[ "$stage" == "pre-install" && "$hook_name" == "01-backup.sh" && "$SKIP_BACKUP" == "true" ]]; then
      print_info "Skipping $hook_name (--skip-backup)"
      continue
    fi
    if [[ "$DRY_RUN" == "true" ]]; then
      print_info "Would run hook: $hook_name"
      continue
    fi

    if "$hook"; then
      print_verbose "$hook_name completed"
    else
      print_error "Hook failed: $hook_name"
      failures=$((failures + 1))
    fi
  done

  if (( failures > 0 )); then
    json_emit "hooks.$stage" "$stage hooks failed: $failures" "error"
    return 1
  fi
  return 0
}

detect_os() {
  case "$(uname -s)" in
    Darwin) echo "macos" ;;
    Linux) [[ -n "${TERMUX_VERSION:-}" ]] && echo "termux" || echo "linux" ;;
    *) echo "unknown" ;;
  esac
}

detect_device_type() {
  local os="$1" model=""
  case "$os" in
    macos)
      model=$(system_profiler SPHardwareDataType 2>/dev/null | grep 'Model Identifier' | awk '{print $3}' || true)
      case "$model" in MacBook*) echo "laptop" ;; *) echo "desktop" ;; esac
      ;;
    termux) echo "mobile" ;;
    linux)
      if [[ -n "${container:-}" || -e /.dockerenv || -e /run/.containerenv ]] ||
         grep -qiE 'docker|containerd|kubepods|podman|lxc' /proc/1/cgroup 2>/dev/null; then
        echo "container"
      elif grep -qi 'virtual\|vmware\|qemu\|kvm' /sys/class/dmi/id/* 2>/dev/null; then
        echo "vm"
      elif grep -qi 'laptop\|notebook' /sys/class/dmi/id/* 2>/dev/null; then
        echo "laptop"
      else
        echo "desktop"
      fi
      ;;
    *) echo "unknown" ;;
  esac
}

detect_use_case() {
  local os="$1" device="$2"
  if [[ -n "$FORCE_MODE" ]]; then echo "$FORCE_MODE"; return; fi
  if [[ "$os" == "termux" ]]; then echo "mobile"
  elif [[ "$device" == "vm" || "$device" == "container" ]]; then echo "server"
  elif [[ "$os" == "macos" ]]; then echo "desktop"
  elif [[ -n "${DISPLAY:-}" || -n "${WAYLAND_DISPLAY:-}" ]]; then echo "desktop"
  else echo "server"
  fi
}

detect_shell() {
  local candidate
  candidate=$(basename "${SHELL:-}")
  case "$candidate" in zsh|bash|fish|nushell) echo "$candidate"; return ;; esac
  if [[ -n "${ZSH_VERSION:-}" ]]; then echo "zsh"
  elif [[ -n "${BASH_VERSION:-}" ]]; then echo "bash"
  elif [[ -n "${FISH_VERSION:-}" ]]; then echo "fish"
  else echo "zsh"
  fi
}

detect_package_manager() {
  local os="$1"
  case "$os" in
    macos) command -v brew >/dev/null 2>&1 && echo "brew" || echo "none" ;;
    termux) command -v pkg >/dev/null 2>&1 && echo "pkg" || echo "none" ;;
    linux)
      if command -v apt >/dev/null 2>&1; then echo "apt"
      elif command -v dnf >/dev/null 2>&1; then echo "dnf"
      elif command -v pacman >/dev/null 2>&1; then echo "pacman"
      elif command -v apk >/dev/null 2>&1; then echo "apk"
      else echo "none"
      fi
      ;;
    *) echo "none" ;;
  esac
}

has_role() {
  local wanted="$1" role
  for role in "${ROLE_OVERRIDES[@]}"; do
    [[ "$role" == "$wanted" ]] && return 0
  done
  return 1
}

resolve_roles() {
  local use_case="$1" role
  local requested=("${ROLE_OVERRIDES[@]}")

  # Runtime context is always a layer. Explicit roles augment it rather than
  # replacing it, so e.g. a headless development host resolves
  # server + development and a Termux SSH target resolves mobile + remote.
  ROLE_OVERRIDES=("$use_case")
  for role in "${requested[@]}"; do
    has_role "$role" || ROLE_OVERRIDES+=("$role")
  done
}

validate_roles() {
  local role
  for role in "${ROLE_OVERRIDES[@]}"; do
    if [[ ! -f "$DOTFILES_DIR/packages/$role.yaml" ]]; then
      print_error "Unknown role: $role (missing packages/$role.yaml)"
      return 1
    fi
  done
}

detect_machine() {
  local hostname
  hostname=$(hostname 2>/dev/null || echo unknown)
  if [[ -n "$FORCE_MACHINE" ]]; then
    [[ -d "$DOTFILES_DIR/machines/$FORCE_MACHINE" ]] || {
      print_error "Unknown machine metadata: $FORCE_MACHINE"
      return 1
    }
    echo "$FORCE_MACHINE"
  elif [[ -d "$DOTFILES_DIR/machines/$hostname" ]]; then
    echo "$hostname"
  else
    echo "base"
  fi
}

packages_from_yaml_file() {
  local file="$1" line name requirement
  [[ -f "$file" ]] || return 0
  while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*-[[:space:]] ]] || continue
    if [[ "$line" =~ name:[[:space:]]*([a-zA-Z0-9_@.+-]+) ]]; then
      name="${BASH_REMATCH[1]}"
      requirement="required"
      [[ "$line" =~ install:[[:space:]]*optional ]] && requirement="optional"
      printf '%s|%s\n' "$name" "$requirement"
    fi
  done < "$file"
}

native_package_list() {
  local os="$1" role
  {
    packages_from_yaml_file "$DOTFILES_DIR/packages/base.yaml"
    packages_from_yaml_file "$DOTFILES_DIR/packages/$os.yaml"
    for role in "${ROLE_OVERRIDES[@]}"; do
      packages_from_yaml_file "$DOTFILES_DIR/packages/$role.yaml"
    done
  } | awk -F'|' '
    NF >= 2 {
      if (!seen[$1]) { order[++n]=$1; seen[$1]=1 }
      if ($2 == "required" || req[$1] == "") req[$1]=$2
    }
    END { for (i=1; i<=n; i++) print order[i] "|" req[order[i]] }'
}

catalog_field() {
  local logical="$1" field="$2" catalog="$DOTFILES_DIR/packages/catalog.yaml"
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

package_install_name() {
  local logical="$1" pm="$2" mapped
  mapped=$(catalog_field "$logical" "$pm" 2>/dev/null || true)
  printf '%s\n' "${mapped:-$logical}"
}

package_probe_names() {
  local logical="$1" pm="$2" probes
  probes=$(catalog_field "$logical" "${pm}_probe" 2>/dev/null || true)
  [[ -n "$probes" ]] || probes=$(catalog_field "$logical" probe 2>/dev/null || true)
  printf '%s\n' "${probes:-$logical}"
}

tool_available() {
  local logical="$1" pm="$2" probes probe
  local -a probe_list=()
  probes=$(package_probe_names "$logical" "$pm")
  [[ "$probes" != "none" ]] || return 1
  IFS='|' read -r -a probe_list <<< "$probes"
  for probe in "${probe_list[@]}"; do
    command -v "$probe" >/dev/null 2>&1 && return 0
  done
  return 1
}

run_privileged() {
  if [[ "$(id -u)" -eq 0 ]]; then "$@"
  elif command -v sudo >/dev/null 2>&1; then sudo "$@"
  else return 126
  fi
}

install_tool() {
  local tool="$1" pm="$2"
  case "$pm" in
    brew) brew install "$tool" ;;
    apt) run_privileged apt install -y "$tool" ;;
    dnf) run_privileged dnf install -y "$tool" ;;
    pacman) run_privileged pacman -S --needed --noconfirm "$tool" ;;
    apk) run_privileged apk add "$tool" ;;
    pkg) pkg install -y "$tool" ;;
    *) return 1 ;;
  esac
}

package_failures=0
optional_package_failures=0
record_package_failure() {
  local logical="$1" requirement="$2" message="$3"
  if [[ "$requirement" == "optional" ]]; then
    print_warning "$message"
    optional_package_failures=$((optional_package_failures + 1))
  else
    print_error "$message"
    package_failures=$((package_failures + 1))
  fi
}

try_verified_fallback() {
  local logical="$1" os="$2" requirement="$3" spec

  declare -F fallback_spec >/dev/null 2>&1 || return 1
  declare -F fallback_acquire >/dev/null 2>&1 || return 1
  spec=$(fallback_spec "$logical" "$os" 2>/dev/null || true)
  [[ -n "$spec" ]] || return 1

  local status=0
  fallback_acquire "$logical" "$os" || status=$?
  if [[ "$status" -eq 0 ]]; then
    return 0
  fi
  if [[ "$requirement" == "optional" ]]; then
    print_warning "Verified fallback failed for optional tool $logical (status $status)"
  else
    print_error "Verified fallback failed for required tool $logical (status $status)"
  fi
  return "$status"
}

provision_packages() {
  local os="$1" pm="$2" pkg requirement records index total install_pkg probes fallback_spec_value

  if [[ "$SKIP_PACKAGES" == "true" ]]; then
    print_info "Skipping package installation (--skip-packages)"
    return 0
  fi

  if [[ "$os" == "macos" ]]; then
    [[ -f "$DOTFILES_DIR/Brewfile" ]] || {
      print_error "Brewfile not found at $DOTFILES_DIR/Brewfile"
      package_failures=$((package_failures + 1))
      return 0
    }
    if [[ "$DRY_RUN" == "true" ]]; then
      print_info "Would run: brew bundle --file $DOTFILES_DIR/Brewfile"
      return 0
    fi
    if [[ "$pm" != "brew" ]]; then
      print_error "Homebrew is required for macOS package provisioning"
      package_failures=$((package_failures + 1))
      return 0
    fi
    print_step "Applying Brewfile desired state..."
    if brew bundle --file "$DOTFILES_DIR/Brewfile"; then
      print_success "Brewfile applied"
    else
      print_error "brew bundle failed"
      package_failures=$((package_failures + 1))
    fi
    return 0
  fi

  records=$(native_package_list "$os")
  if [[ -z "$records" ]]; then
    records=$(printf '%s\n' 'git|required' 'tmux|required')
  fi
  total=$(printf '%s\n' "$records" | grep -c . || true)
  index=0

  while IFS='|' read -r pkg requirement; do
    [[ -n "$pkg" ]] || continue
    index=$((index + 1))
    json_progress "$index" "$total" "Processing $pkg"

    if tool_available "$pkg" "$pm"; then
      continue
    fi

    if [[ "$MINIMAL_MODE" == "true" && "$requirement" == "optional" ]]; then
      print_info "Skipping optional package in minimal mode: $pkg"
      continue
    fi

    install_pkg=$(package_install_name "$pkg" "$pm")
    probes=$(package_probe_names "$pkg" "$pm")

    fallback_spec_value=""
    if declare -F fallback_spec >/dev/null 2>&1; then
      fallback_spec_value=$(fallback_spec "$pkg" "$os" 2>/dev/null || true)
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
      if [[ "$install_pkg" == "none" || "$pm" == "none" ]]; then
        if [[ -n "$fallback_spec_value" ]]; then
          print_info "No native package mapping for $pkg on $pm; verified fallback is available"
          fallback_acquire "$pkg" "$os" || true
        else
          record_package_failure "$pkg" "$requirement" \
            "$pkg has no native package mapping for package manager $pm"
        fi
      else
        if [[ "$install_pkg" == "$pkg" && "$probes" == "$pkg" ]]; then
          print_info "Would install: $pkg ($requirement)"
        else
          print_info "Would install: $pkg via $pm package $install_pkg ($requirement; probes: $probes)"
        fi
        if [[ -n "$fallback_spec_value" ]]; then
          print_info "If native acquisition fails, verified fallback policy is available for $pkg"
          fallback_acquire "$pkg" "$os" || true
        fi
      fi
      continue
    fi

    if [[ "$install_pkg" == "none" || "$pm" == "none" ]]; then
      if try_verified_fallback "$pkg" "$os" "$requirement"; then
        continue
      fi
      record_package_failure "$pkg" "$requirement" \
        "$pkg has no usable native mapping or verified fallback for package manager $pm"
      continue
    fi

    if ! install_tool "$install_pkg" "$pm"; then
      if try_verified_fallback "$pkg" "$os" "$requirement"; then
        continue
      fi
      if [[ "$install_pkg" == "$pkg" && "$probes" == "$pkg" ]]; then
        if [[ "$requirement" == "optional" ]]; then
          record_package_failure "$pkg" "$requirement" "Optional package unavailable: $pkg"
        else
          record_package_failure "$pkg" "$requirement" "Failed to install required package: $pkg"
        fi
      else
        record_package_failure "$pkg" "$requirement" \
          "Failed to install $pkg via $pm package $install_pkg and no verified fallback succeeded"
      fi
      continue
    fi

    if ! tool_available "$pkg" "$pm"; then
      if try_verified_fallback "$pkg" "$os" "$requirement"; then
        continue
      fi
      record_package_failure "$pkg" "$requirement" \
        "Installed $pm package $install_pkg for $pkg, but expected executable probe was not found: $probes"
    fi
  done <<< "$records"
}

ensure_stow() {
  local os="$1" pm="$2"
  [[ "$SKIP_STOW" == "true" ]] && return 0
  [[ "$DRY_RUN" == "true" ]] && return 0
  command -v stow >/dev/null 2>&1 && return 0

  if [[ "$SKIP_PACKAGES" == "true" ]]; then
    print_error "Stow not found and package installation is disabled (--skip-packages)"
    return 1
  fi

  print_info "Stow not found after package provisioning; installing required deployment dependency..."
  if ! install_tool stow "$pm"; then
    print_error "Failed to install required dependency: stow"
    return 1
  fi
}

stow_tool() {
  local package="$1" target="$2" output status first_line adopt_output adopt_status
  [[ -d "$DOTFILES_DIR/$package" ]] || return 0

  if [[ "$DRY_RUN" == "true" ]]; then
    print_info "Would stow: $package"
    return 0
  fi

  if output=$(stow -R -t "$target" -d "$DOTFILES_DIR" "$package" 2>&1); then
    print_success "stowed $package"
    return 0
  else
    status=$?
  fi

  if echo "$output" | grep -q 'would cause conflicts'; then
    if [[ "$ADOPT" != "true" ]]; then
      print_error "$package: Stow conflict; refusing implicit adoption"
      print_info "Review the conflicting files, then rerun with --adopt only if the machine copy should replace repository source."
      return "$status"
    fi

    print_warning "$package: explicitly adopting conflicting machine files (--adopt)"
    if adopt_output=$(stow --adopt -t "$target" -d "$DOTFILES_DIR" "$package" 2>&1); then
      print_success "stowed $package (adopted existing files)"
      return 0
    else
      adopt_status=$?
    fi
    first_line=$(printf '%s\n' "$adopt_output" | head -1)
    print_error "$package: failed to adopt (exit $adopt_status): $first_line"
    return "$adopt_status"
  fi

  first_line=$(printf '%s\n' "$output" | head -1)
  print_error "$package: stow failed (exit $status): $first_line"
  return "$status"
}

stow_failures=0
stow_configurations() {
  local os="$1" shell="$2" pm="$3" package
  local core=(git tmux ssh)
  local capability=(atuin bat btop gdu gh helix lazygit rclone starship yazi)
  local optional=(lazynpm lnav npm oatmeal)
  local macos=(ghostty karabiner kanata)

  if [[ "$SKIP_STOW" == "true" ]]; then
    print_info "Skipping all stow operations (--skip-stow)"
    return 0
  fi

  for package in "${core[@]}"; do
    [[ -d "$DOTFILES_DIR/$package" ]] || continue
    if ! stow_tool "$package" "$HOME"; then
      stow_failures=$((stow_failures + 1))
    fi
  done

  for package in "${capability[@]}"; do
    [[ -d "$DOTFILES_DIR/$package" ]] || continue
    if tool_available "$package" "$pm"; then
      if ! stow_tool "$package" "$HOME"; then
        stow_failures=$((stow_failures + 1))
      fi
    else
      print_info "Skipping config for unavailable optional tool: $package"
    fi
  done

  if [[ -d "$DOTFILES_DIR/$shell" ]]; then
    if ! stow_tool "$shell" "$HOME"; then
      stow_failures=$((stow_failures + 1))
    fi
  fi

  for package in "${optional[@]}"; do
    [[ -d "$DOTFILES_DIR/$package" ]] || continue
    if command -v "$package" >/dev/null 2>&1; then
      if ! stow_tool "$package" "$HOME"; then
        stow_failures=$((stow_failures + 1))
      fi
    fi
  done

  if [[ "$os" == "macos" ]] && has_role desktop; then
    for package in "${macos[@]}"; do
      [[ -d "$DOTFILES_DIR/$package" ]] || continue
      if ! stow_tool "$package" "$HOME"; then
        stow_failures=$((stow_failures + 1))
      fi
    done
  elif [[ "$os" == "termux" && -d "$DOTFILES_DIR/termux" ]]; then
    if ! stow_tool termux "$HOME"; then
      stow_failures=$((stow_failures + 1))
    fi
  fi
}

show_summary() {
  local os="$1" device="$2" shell="$3" hostname="$4" branch="$5" machine="$6" roles="$7"
  echo
  echo -e "${BOLD}Installation Summary${NC}"
  echo "  System:   $os / $device"
  echo "  Hostname: $hostname"
  echo "  Machine:  $machine"
  echo "  Roles:    $roles"
  echo "  Shell:    $shell"
  if [[ "$MINIMAL_MODE" == "true" ]]; then
    echo "  Policy:   minimal (required packages only)"
  fi
  if (( optional_package_failures > 0 )); then
    echo "  Optional: $optional_package_failures package(s) unavailable"
  fi
  echo "  Branch:   $branch"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${GREEN}✓ Dry run complete; no installation actions were executed.${NC}"
  else
    echo -e "${GREEN}✓ Dotfiles installation complete!${NC}"
  fi
}

main() {
  print_header
  json_emit start "Dotfiles Installer v4.0 starting" running

  if [[ "$DRY_RUN" == "true" ]]; then
    print_info "DRY RUN MODE - No changes will be made"
  fi

  if [[ "$INTERACTIVE" == "true" && "$JSON_OUTPUT" != "true" ]]; then
    if [[ ! -x "$DOTFILES_DIR/bin/dotfiles-installer-tui" ]]; then
      print_error "Interactive TUI is not built at $DOTFILES_DIR/bin/dotfiles-installer-tui"
      print_info "Interactive mode is optional; run without --interactive or build rust/installer-tui explicitly."
      return 1
    fi
    export DRY_RUN SKIP_PACKAGES SKIP_STOW SKIP_HOOKS SKIP_BACKUP FORCE ADOPT FORCE_MODE FORCE_MACHINE MINIMAL_MODE
    export INTERACTIVE=false
    exec "$DOTFILES_DIR/bin/dotfiles-installer-tui"
  fi

  local os device use_case hostname pm shell machine branch roles_csv
  os=$(detect_os)
  device=$(detect_device_type "$os")
  use_case=$(detect_use_case "$os" "$device")
  resolve_roles "$use_case"
  validate_roles || return 1
  roles_csv=$(IFS=,; echo "${ROLE_OVERRIDES[*]}")
  hostname=$(hostname 2>/dev/null || echo unknown)
  pm=$(detect_package_manager "$os")
  shell=$(detect_shell)
  machine=$(detect_machine) || return 1
  branch=$(git -C "$DOTFILES_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)

  export MACHINE="$machine" HOSTNAME="$hostname" OS="$os" USE_CASE="$use_case" SHELL="$shell" ROLES="$roles_csv"

  print_step "Detected OS: $os"
  print_step "Detected device type: $device"
  print_step "Detected use case: $use_case"
  print_step "Resolved roles: $roles_csv"
  print_step "Detected hostname: $hostname"
  print_step "Machine metadata: $machine"
  print_step "Package manager: $pm"
  print_step "Git branch: $branch"
  echo

  if [[ "$MINIMAL_MODE" == "true" && "$os" == "macos" ]]; then
    print_error "--minimal is currently supported on Linux and Termux only; macOS Brewfile is a single full desired-state authority"
    return 2
  fi

  if ! run_hooks pre-install; then
    print_error "Pre-install hooks failed; aborting before installation changes"
    return 1
  fi

  provision_packages "$os" "$pm"

  if ! ensure_stow "$os" "$pm"; then
    return 1
  fi

  stow_configurations "$os" "$shell" "$pm"

  if (( package_failures > 0 || stow_failures > 0 )); then
    print_error "Installation incomplete: $package_failures package installation failure(s), $stow_failures stow failure(s)"
    return 1
  fi

  if ! run_hooks post-install; then
    print_error "Post-install hooks failed; installation requires attention"
    return 1
  fi

  show_summary "$os" "$device" "$shell" "$hostname" "$branch" "$machine" "$roles_csv"
  json_emit complete "Dotfiles installation complete" success
}

main "$@"
