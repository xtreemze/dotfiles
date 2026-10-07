# dotfiles

Portable, safe terminal configuration for fresh machines.

The public repository is the unauthenticated bootstrap layer. It contains only configuration that is safe to expose. After the public baseline installs GitHub CLI, the bootstrap offers GitHub authentication. If the authenticated account can access `xtreemze/.dotfiles`, setup hands off to that private repository for machine-specific, identity, secret, and other sensitive configuration.

## Install

Review the installer first when possible:

```sh
curl -fsSLO https://xtreemze.github.io/dotfiles/install
less install
sh install --role development
```

Or bootstrap in one command:

```sh
curl -fsSL https://xtreemze.github.io/dotfiles/install | sh -s -- --role development
```

The flow is:

1. Clone the public repository into `~/.local/share/xtreemze/dotfiles-public`.
2. Install safe baseline packages without creating Stow links yet.
3. Ensure GitHub CLI is installed.
4. Run `gh auth login` when GitHub is not already authenticated.
5. Verify access to the private `xtreemze/.dotfiles` repository.
6. If authorized, clone private dotfiles into `~/.dotfiles` and hand off to its installer.
7. If private access is unavailable, apply the safe public configuration with GNU Stow instead.

Available roles include `development`, `desktop`, `server`, `remote`, and `mobile`. Runtime context remains additive.

GNU Stow is the configuration deployment authority. `just` provides the preferred command vocabulary after installation but is not required for bootstrap or recovery.

## Common commands

```sh
just
just plan development
just install development
just packages development
just doctor
just update
```

The underlying interfaces remain available as `dotfiles ...` and `./install.sh ...`.

## Security boundary

The public repository is generated through an explicit allowlist. Only independently audited, path-agnostic configuration is exported. Shell, tmux, editor, identity, machine, authentication, secret, and private-service configuration stays private until each component is explicitly made portable and safe. The public repository must never contain private machine metadata, authentication state, private keys, SSH identity material, cloud credentials, personal Git identity, private service configuration, or private Git history.

Authentication itself happens locally through GitHub CLI. No GitHub token or generated `gh` authentication state is stored in this repository.
