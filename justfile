set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

_dotfiles := env_var_or_default("DOTFILES_DIR", justfile_directory())
_cli := _dotfiles + "/bin/dotfiles"

# Show the most useful commands.
default:
  @just --list

# Install or reconcile this machine. Pass a role such as development, server, remote, desktop, or mobile.
install role="":
  @if [[ -n "{{role}}" ]]; then "{{_cli}}" install --role "{{role}}"; else "{{_cli}}" install; fi

# Preview installation without changing the machine.
plan role="":
  @if [[ -n "{{role}}" ]]; then "{{_cli}}" install --dry-run --role "{{role}}"; else "{{_cli}}" install --dry-run; fi

# Install only required baseline dependencies.
minimal:
  @"{{_cli}}" install --minimal

# Show installation and repository state.
status:
  @"{{_cli}}" status

# Run health checks for tools, links, shell integration, and platform prerequisites.
doctor:
  @"{{_cli}}" doctor

# Update the checkout and re-apply managed configuration.
update:
  @"{{_cli}}" update

# Create a recovery backup.
backup:
  @"{{_cli}}" backup

# Provision another machine over SSH.
remote host *args:
  @"{{_cli}}" remote "{{host}}" {{args}}

# Show the role/package plan used by the public installer and site.
packages role="":
  @if [[ -n "{{role}}" ]]; then "{{_dotfiles}}/scripts/package-plan" --role "{{role}}"; else "{{_dotfiles}}/scripts/package-plan"; fi

# Generate shell completion for just itself.
completions shell:
  @just --completions "{{shell}}"
