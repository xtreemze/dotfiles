const translations = {
  en: {
    intro: "Interactive dotfiles terminal. Safe browser sandbox; no host shell is exposed.",
    hint: "Type 'help' for commands.",
    helpTitle: "Available commands",
    unsupported: "This command requires a real host shell and is intentionally unavailable in the browser demo.",
    notFound: "command not found",
    copied: "Installer command copied to clipboard.",
    copyFailed: "Could not access the clipboard. Select and copy the command manually.",
    theme: "Theme changed to",
    lang: "Language changed to",
    role: "Role selection updated:",
    roleInvalid: "Unknown role. Use development, desktop, server, remote, or mobile.",
    cwd: "No such virtual directory:",
    file: "No such virtual file:",
    actions: "Browser actions",
    readonly: "Read-only shell",
    realShell: "Requires host shell"
  },
  es: {
    intro: "Terminal interactiva de dotfiles. Sandbox seguro del navegador; no expone la shell del sistema.",
    hint: "Escribe 'help' para ver los comandos.",
    helpTitle: "Comandos disponibles",
    unsupported: "Este comando requiere una shell real del sistema y no está disponible deliberadamente en la demo del navegador.",
    notFound: "comando no encontrado",
    copied: "Comando de instalación copiado al portapapeles.",
    copyFailed: "No se pudo acceder al portapapeles. Selecciona y copia el comando manualmente.",
    theme: "Tema cambiado a",
    lang: "Idioma cambiado a",
    role: "Selección de rol actualizada:",
    roleInvalid: "Rol desconocido. Usa development, desktop, server, remote o mobile.",
    cwd: "No existe el directorio virtual:",
    file: "No existe el archivo virtual:",
    actions: "Acciones del navegador",
    readonly: "Shell de solo lectura",
    realShell: "Requiere shell del sistema"
  },
  sv: {
    intro: "Interaktiv dotfiles-terminal. Säker webbläsarsandbox; ingen värd-shell exponeras.",
    hint: "Skriv 'help' för kommandon.",
    helpTitle: "Tillgängliga kommandon",
    unsupported: "Kommandot kräver en riktig värd-shell och är medvetet otillgängligt i webbdemon.",
    notFound: "kommandot hittades inte",
    copied: "Installationskommandot kopierades till urklipp.",
    copyFailed: "Urklipp kunde inte nås. Markera och kopiera kommandot manuellt.",
    theme: "Tema ändrat till",
    lang: "Språk ändrat till",
    role: "Rollval uppdaterat:",
    roleInvalid: "Okänd roll. Använd development, desktop, server, remote eller mobile.",
    cwd: "Ingen sådan virtuell katalog:",
    file: "Ingen sådan virtuell fil:",
    actions: "Webbläsaråtgärder",
    readonly: "Skrivskyddad shell",
    realShell: "Kräver värd-shell"
  }
};

const virtualFs = {
  "~/.dotfiles": {
    type: "dir",
    entries: ["README.md", "Brewfile", "bootstrap.sh", "install.sh", "packages", "public", "rclone", "ghostty", "starship", "zsh", "tmux", "helix", "yazi", "atuin"]
  },
  "~/.dotfiles/packages": {
    type: "dir",
    entries: ["base.yaml", "linux.yaml", "termux.yaml", "development.yaml", "desktop.yaml", "server.yaml", "remote.yaml", "mobile.yaml", "catalog.yaml"]
  },
  "~/.dotfiles/public": { type: "dir", entries: ["README.md", "Brewfile", "site", "bootstrap.sh"] },
  "~/.dotfiles/rclone": { type: "dir", entries: [".config", ".local"] },
  "~/.dotfiles/ghostty": { type: "dir", entries: [".config"] },
  "~/.dotfiles/starship": { type: "dir", entries: [".config"] },
  "~/.dotfiles/zsh": { type: "dir", entries: [".zshrc", ".zshenv", ".zprofile"] },
  "~/.dotfiles/yazi": { type: "dir", entries: [".config"] },
  "~/.dotfiles/atuin": { type: "dir", entries: [".config"] },
  "~/.dotfiles/tmux": { type: "dir", entries: [".tmux.conf", "tmux-session-switcher.sh", "tmux-project-switcher.sh"] },
  "~/.dotfiles/helix": { type: "dir", entries: [".config"] }
};

const virtualFiles = {
  "~/.dotfiles/README.md": `# Dotfiles

Cross-platform workstation environment for macOS, Linux, and Termux.
GNU Stow deploys configuration. Roles are additive. Rclone provides the canonical cloud: abstraction.

Try:
  just
  just plan development
  dotfiles packages development
  git status
`,
  "~/.dotfiles/Brewfile": `# Managed macOS baseline
brew "git"
brew "stow"
brew "just"
brew "zsh"
brew "starship"
brew "atuin"
brew "helix"
brew "tmux"
brew "gh"
brew "yazi"
brew "rclone"
cask "ghostty"
cask "font-monaspace"
`,
  "~/.dotfiles/packages/base.yaml": `name: base
packages:
  - git
  - tmux
  - curl
  - tar
  - stow
  - just
  - rclone
`,
  "~/.dotfiles/zsh/.zshrc": `bindkey -e\n# Atuin, zsh-autocomplete, autosuggestions, syntax highlighting, zoxide and Starship are enabled when installed.\n`,
  "~/.dotfiles/rclone/.config/dotfiles/rclone-vfs.env": `RCLONE_CLOUD_REMOTE="cloud:"
RCLONE_CLOUD_MOUNT="$HOME/Cloud"
RCLONE_VFS_CACHE_MODE="full"
RCLONE_VFS_CACHE_MAX_SIZE="20Gi"
`
};

class DotfilesTerminal extends HTMLElement {
  static observedAttributes = ["lang", "data-terminal-theme"];

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.cwd = "~/.dotfiles";
    this.history = ["git status", "just doctor", "just plan development", "dotfiles packages development", "rg rclone .", "eza -la", "bat README.md", "rclone status"];
    this.historyIndex = this.history.length;
    this.theme = "dark";
    this.lastDuration = 0;
    this.completions = [];
  }

  connectedCallback() {
    this.render();
    this.writeIntro();
    this.shadowRoot.querySelector("input").focus();
  }

  attributeChangedCallback() {
    if (!this.shadowRoot?.children.length) return;
    this.updateLabels();
  }

  get locale() {
    const value = (this.getAttribute("lang") || document.documentElement.lang || "en").split("-")[0];
    return translations[value] ? value : "en";
  }

  get t() {
    return translations[this.locale];
  }

  get styles() {
    return `
      :host {
        display: block;
        --bg: #1e2326;
        --fg: #d3c6aa;
        --muted: #859289;
        --red: #e67e80;
        --green: #a7c080;
        --yellow: #dbbc7f;
        --blue: #7fbbb3;
        --purple: #d699b6;
        --cyan: #83c092;
        --orange: #e69875;
        --bg1: #343f44;
        --bg2: #3d484d;
        font-family: "Monaspace Krypton", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 14px;
        font-feature-settings: "calt" 1, "liga" 1, "ss01" 1, "ss02" 1, "ss03" 1, "ss04" 1, "ss05" 1, "ss06" 1, "ss07" 1, "ss08" 1, "ss09" 1;
        font-variant-ligatures: common-ligatures contextual;
        font-synthesis: none;
      }
      :host([data-terminal-theme="light"]) {
        --bg: #fdf6e3;
        --fg: #5c6a72;
        --muted: #829181;
        --red: #f85552;
        --green: #8da101;
        --yellow: #dfa000;
        --blue: #3a94c5;
        --purple: #df69ba;
        --cyan: #35a77c;
        --orange: #f57d26;
        --bg1: #f4f0d9;
        --bg2: #efebd4;
      }
      * { box-sizing: border-box; }
      .window {
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--fg) 22%, transparent);
        border-radius: 10px;
        background: var(--bg);
        color: var(--fg);
        box-shadow: 0 1.5rem 4rem color-mix(in srgb, #000 18%, transparent);
      }
      .titlebar {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: .8rem;
        align-items: end;
        min-height: 42px;
        padding: 7px 10px 0;
        border-bottom: 1px solid color-mix(in srgb, var(--fg) 12%, transparent);
        background: color-mix(in srgb, var(--fg) 3%, var(--bg));
      }
      .lights { display: flex; gap: 8px; padding: 0 10px 12px 2px; }
      .light { width: 12px; height: 12px; border-radius: 50%; }
      .light:nth-child(1) { background: #ff5f57; }
      .light:nth-child(2) { background: #febc2e; }
      .light:nth-child(3) { background: #28c840; }
      .title { display:flex; align-items:center; gap:7px; min-width:0; max-width:300px; align-self:stretch; padding:0 13px; border:1px solid color-mix(in srgb,var(--fg) 10%,transparent); border-bottom:0; border-radius:7px 7px 0 0; background:var(--bg); font:12px system-ui,sans-serif; color:var(--fg); text-align:left; }
      .title span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .stack { padding:0 0 10px 10px; font:11px system-ui,sans-serif; opacity:.5; }
      .screen {
        min-height: 27rem;
        max-height: 35rem;
        overflow: auto;
        padding: 12px 10px 18px;
        scrollbar-color: color-mix(in srgb, var(--fg) 25%, transparent) transparent;
      }
      .line {
        min-height: 1.35rem;
        margin: 0 0 .22rem;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-size: .88rem;
        line-height: 1.45;
      }
      .dim { color: var(--muted); }
      .green { color: var(--green); }
      .blue { color: var(--blue); }
      .yellow { color: var(--yellow); }
      .red { color: var(--red); }
      .cyan { color: var(--cyan); }
      .purple { color: var(--purple); }
      .orange { color: var(--orange); }
      .prompt-shell { margin-top: 8px; }
      .prompt-top { display:flex; justify-content:space-between; gap:18px; align-items:baseline; }
      .prompt-left,.prompt-right { display:flex; flex-wrap:wrap; min-width:0; }
      .prompt-right { margin-left:auto; }
      .prompt-row { display:grid; grid-template-columns:auto minmax(2rem,1fr); gap:.5rem; align-items:center; margin-top:1px; }
      .os { color: var(--blue); }
      .shell { color: var(--green); }
      .cwd { color: var(--orange); }
      .branch { color: var(--green); }
      .symbol { color: var(--green); font-weight: 800; }
      .right-status { color: var(--red); }
      .duration { color: var(--green); }
      .prompt-editor { display:grid; grid-template-areas:"stack"; min-width:0; position:relative; }
      .prompt-editor input, .autosuggest { grid-area:stack; }
      .autosuggest { color:var(--muted); pointer-events:none; white-space:pre; overflow:hidden; line-height:1.45; }
      .autosuggest .prefix { visibility:hidden; }
      input {
        min-width: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--fg);
        font: inherit;
        font-size: 14px;
        caret-color: var(--fg);
      }
      .command-line { color: var(--fg); }
      .command-line .typed { color: var(--fg); }
      .help-grid {
        display: grid;
        grid-template-columns: minmax(8rem, auto) 1fr;
        gap: .15rem 1rem;
        margin: .4rem 0 .7rem;
        font-size: .82rem;
      }
      .help-grid code { color: var(--cyan); }
      .action {
        appearance: none;
        margin: .25rem .4rem .25rem 0;
        border: 1px solid color-mix(in srgb, var(--fg) 24%, transparent);
        border-radius: .45rem;
        background: color-mix(in srgb, var(--fg) 6%, var(--bg));
        color: var(--fg);
        padding: .32rem .5rem;
        font: inherit;
        font-size: .74rem;
        cursor: pointer;
      }
      .action:hover, .action:focus-visible {
        border-color: color-mix(in srgb, var(--fg) 60%, transparent);
        outline: none;
      }
      @media (max-width: 620px) {
        .titlebar { grid-template-columns: auto 1fr; }
        .stack { display: none; }
        .screen { min-height: 24rem; }
        .prompt-row { grid-template-columns: auto auto auto minmax(1rem,1fr); }
      }
    `;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>${this.styles}</style>
      <div class="window" role="application" aria-label="Interactive dotfiles terminal">
        <div class="titlebar">
          <div class="lights" aria-hidden="true"><span class="light"></span><span class="light"></span><span class="light"></span></div>
          <div class="title"><span>⌁ ~/.dotfiles — zsh</span></div>
          <div class="stack" aria-hidden="true">Ghostty</div>
        </div>
        <div class="screen" tabindex="0">
          <div class="output" aria-live="polite"></div>
          <div class="prompt-shell">
            <div class="prompt-top">
              <div class="prompt-left"><span class="os"> </span><span class="shell">zsh </span><span class="cwd">dotfiles </span><span class="branch"> master </span></div>
              <div class="prompt-right"><span class="right-status"></span><span class="duration"></span></div>
            </div>
            <form class="prompt-row">
              <span class="symbol">❯</span>
              <div class="prompt-editor"><span class="autosuggest" aria-hidden="true"></span><input aria-label="Terminal command" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
            </form>
          </div>
        </div>
      </div>`;

    this.shadowRoot.querySelector("form").addEventListener("submit", async event => {
      event.preventDefault();
      const input = this.shadowRoot.querySelector("input");
      const command = input.value.trim();
      if (!command) return;
      this.echoCommand(command);
      this.history.push(command);
      this.historyIndex = this.history.length;
      input.value = "";
      this.updateSuggestion();
      const started = performance.now();
      await this.execute(command);
      this.lastDuration = performance.now() - started;
      this.updateRightPrompt();
    });

    const input = this.shadowRoot.querySelector("input");
    input.addEventListener("input", () => this.updateSuggestion());
    input.addEventListener("keydown", event => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (this.historyIndex > 0) this.historyIndex -= 1;
        input.value = this.history[this.historyIndex] || "";
        queueMicrotask(() => input.setSelectionRange(input.value.length, input.value.length));
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        this.showCompletions();
      }
      if (event.key === "ArrowRight" && input.selectionStart === input.value.length) {
        const suggestion = this.suggestionFor(input.value);
        if (suggestion) {
          event.preventDefault();
          input.value = suggestion;
          input.setSelectionRange(input.value.length, input.value.length);
          this.updateSuggestion();
        }
      }
      if (event.key === "Tab") {
        event.preventDefault();
        this.acceptSuggestionWord();
      }
      if (event.key.toLowerCase() === "r" && event.ctrlKey) {
        event.preventDefault();
        this.showAtuinHistory();
      }
      if (event.key === "l" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        this.clear();
      }
    });

    this.shadowRoot.querySelector(".screen").addEventListener("pointerdown", event => {
      if (event.target.closest("button")) return;
      input.focus();
    });
  }

  updateLabels() {
    // Terminal output remains historical; new output uses the selected language.
    this.shadowRoot.querySelector("input")?.setAttribute("aria-label", this.t.helpTitle);
  }

  writeIntro() {
    this.line(this.t.intro, "dim");
    this.line("↑ / Ctrl+R: Atuin history · ↓: completions · →: accept suggestion · Tab: accept word", "dim");
    this.line("");
    this.updateSuggestion();
  }

  line(text = "", className = "") {
    const line = document.createElement("div");
    line.className = `line ${className}`;
    line.textContent = text;
    this.shadowRoot.querySelector(".output").append(line);
    this.scrollBottom();
    return line;
  }

  htmlLine(html, className = "") {
    const line = document.createElement("div");
    line.className = `line ${className}`;
    line.innerHTML = html;
    this.shadowRoot.querySelector(".output").append(line);
    this.scrollBottom();
    return line;
  }

  echoCommand(command) {
    this.htmlLine(`<span class="blue"></span> <span class="green">zsh</span> <span class="orange">${this.cwd.replace("~/.dotfiles", "dotfiles")}</span> <span class="green"> master</span>`, "command-line");
    this.htmlLine(`<span class="green">❯</span> <span class="typed"></span>`, "command-line");
    const last = this.shadowRoot.querySelector(".output .line:last-child .typed");
    last.textContent = command;
  }

  updateRightPrompt() {
    const duration = this.shadowRoot.querySelector(".duration");
    if (!duration) return;
    duration.textContent = this.lastDuration >= 500 ? `${(this.lastDuration / 1000).toFixed(1)}s  ` : "";
  }

  suggestionFor(value) {
    if (!value) return "";
    return [...this.history].reverse().find(item => item !== value && item.startsWith(value)) || "";
  }

  updateSuggestion() {
    const input = this.shadowRoot.querySelector("input");
    const target = this.shadowRoot.querySelector(".autosuggest");
    if (!input || !target) return;
    const suggestion = this.suggestionFor(input.value);
    if (!suggestion) { target.textContent = ""; return; }
    target.innerHTML = `<span class="prefix">${this.escapeHtml(input.value)}</span>${this.escapeHtml(suggestion.slice(input.value.length))}`;
  }

  escapeHtml(value) {
    return value.replace(/[&<>]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
  }

  acceptSuggestionWord() {
    const input = this.shadowRoot.querySelector("input");
    const suggestion = this.suggestionFor(input.value);
    if (!suggestion) { this.showCompletions(); return; }
    const rest = suggestion.slice(input.value.length);
    const chunk = rest.match(/^(\\S+\\s?)/)?.[1] || rest;
    input.value += chunk;
    input.setSelectionRange(input.value.length, input.value.length);
    this.updateSuggestion();
  }

  showAtuinHistory() {
    this.line("Atuin history search", "yellow");
    [...this.history].reverse().slice(0, 8).forEach((item, index) => this.line(`${String(index + 1).padStart(2)}  ${item}`));
  }

  showCompletions() {
    const input = this.shadowRoot.querySelector("input");
    const commands = ["help","clear","pwd","eza","tree","cd","bat","fd","rg","git","just","dotfiles","rclone","zoxide","atuin","starship","hx","yazi","lazygit","theme","lang","role","install","copy","open"];
    const word = input.value.trim().split(/\\s+/).pop() || "";
    const matches = commands.filter(command => command.startsWith(word)).slice(0, 8);
    if (!matches.length) return;
    this.line(`completions: ${matches.join("  ")}`, "dim");
  }

  clear() {
    this.shadowRoot.querySelector(".output").replaceChildren();
  }

  scrollBottom() {
    requestAnimationFrame(() => {
      const screen = this.shadowRoot.querySelector(".screen");
      screen.scrollTop = screen.scrollHeight;
    });
  }

  normalizePath(input) {
    if (!input || input === ".") return this.cwd;
    if (input === "~" || input === "~/.dotfiles") return "~/.dotfiles";
    if (input.startsWith("~/")) return input.replace(/\/$/, "");
    if (input.startsWith("/")) return input.replace(/\/$/, "");
    if (input === "..") {
      const parts = this.cwd.split("/");
      return parts.length > 2 ? parts.slice(0, -1).join("/") : "~/.dotfiles";
    }
    return `${this.cwd}/${input}`.replace(/\/\.\//g, "/").replace(/\/$/, "");
  }

  async execute(raw) {
    const [command, ...args] = raw.split(/\s+/);
    const joined = args.join(" ");

    if (["sudo", "ssh", "bash", "sh", "zsh", "fish", "nu", "brew", "apt", "dnf", "pacman", "apk", "rm", "mv", "cp", "touch", "mkdir", "chmod", "chown"].includes(command)) {
      this.line(this.t.unsupported, "red");
      return;
    }

    switch (command) {
      case "help": return this.help();
      case "clear": return this.clear();
      case "pwd": return this.line(this.cwd);
      case "whoami": return this.line("visitor");
      case "uname": return this.line(`Browser ${navigator.platform || "Web"} · sandboxed demo`);
      case "ls": return this.ls(joined);
      case "eza": return this.eza(joined);
      case "tree": return this.tree();
      case "cd": return this.cd(joined);
      case "cat": return this.cat(joined);
      case "bat": return this.bat(joined);
      case "fd": return this.fd(joined);
      case "rg": return this.rg(joined);
      case "zoxide": return this.zoxide(args);
      case "z": return this.cd(joined);
      case "atuin": return this.atuin(args);
      case "starship": return this.starship(args);
      case "hx":
      case "helix": return this.helix(args);
      case "yazi": return this.yazi();
      case "lazygit": return this.lazygit();
      case "git": return this.git(args);
      case "just": return this.just(args);
      case "dotfiles": return this.dotfiles(args);
      case "rclone": return this.rclone(args);
      case "theme": return this.setTheme(args[0]);
      case "lang": return this.setLanguage(args[0]);
      case "role": return this.setRole(args);
      case "install": return this.install(args);
      case "open": return this.open(args[0]);
      case "copy": return this.copy(args);
      default:
        this.line(`${command}: ${this.t.notFound}`, "red");
    }
  }

  help() {
    this.line(this.t.helpTitle, "yellow");
    const grid = document.createElement("div");
    grid.className = "help-grid";
    const rows = [
      ["pwd / eza / tree / cd / bat", this.t.readonly],
      ["fd / rg / zoxide / z", this.t.readonly],
      ["atuin history list / search", this.t.readonly],
      ["hx README.md / yazi / lazygit", this.t.readonly],
      ["git status / git branch / git log", this.t.readonly],
      ["just / just plan development", this.t.readonly],
      ["dotfiles packages development", this.t.readonly],
      ["rclone status", this.t.readonly],
      ["theme auto|dark|light", this.t.actions],
      ["lang en|es|sv", this.t.actions],
      ["role add|remove <role>", this.t.actions],
      ["copy install", this.t.actions],
      ["open github|site", this.t.actions],
      ["install development", this.t.actions],
      ["ssh / sudo / brew / rm / bash …", this.t.realShell]
    ];
    for (const [cmd, desc] of rows) {
      const code = document.createElement("code");
      code.textContent = cmd;
      const span = document.createElement("span");
      span.textContent = desc;
      grid.append(code, span);
    }
    this.shadowRoot.querySelector(".output").append(grid);
    this.scrollBottom();
  }

  ls(path) {
    const target = this.normalizePath(path);
    const dir = virtualFs[target];
    if (!dir) return this.line(`ls: ${this.t.cwd} ${target}`, "red");
    this.line(dir.entries.join("  "));
  }

  tree() {
    this.line(".");
    this.line("├── README.md");
    this.line("├── Brewfile");
    this.line("├── bootstrap.sh");
    this.line("├── install.sh");
    this.line("├── packages/");
    this.line("│   ├── base.yaml");
    this.line("│   ├── development.yaml");
    this.line("│   └── catalog.yaml");
    this.line("├── ghostty/");
    this.line("├── helix/");
    this.line("├── tmux/");
    this.line("├── rclone/");
    this.line("└── public/");
  }

  cd(path) {
    const target = this.normalizePath(path || "~/.dotfiles");
    if (!virtualFs[target]) return this.line(`cd: ${this.t.cwd} ${target}`, "red");
    this.cwd = target;
    this.shadowRoot.querySelector(".cwd").textContent = `${target.replace("~/.dotfiles", "dotfiles")} `;
  }

  cat(path) {
    const target = this.normalizePath(path);
    const content = virtualFiles[target];
    if (!content) return this.line(`cat: ${this.t.file} ${target}`, "red");
    for (const row of content.trimEnd().split("\n")) this.line(row);
  }


  eza(path) {
    const target = this.normalizePath(path.replace(/^-.*$/, "").trim());
    const dir = virtualFs[target];
    if (!dir) return this.line(`eza: ${this.t.cwd} ${target}`, "red");
    dir.entries.forEach(entry => this.line(entry, entry.includes(".") ? "cyan" : "blue"));
  }

  bat(path) {
    const target = this.normalizePath(path);
    const content = virtualFiles[target];
    if (!content) return this.line(`bat: ${this.t.file} ${target}`, "red");
    content.trimEnd().split("\n").forEach((row, index) => this.htmlLine(`<span class="dim">${String(index + 1).padStart(3)} │</span> ${this.escapeHtml(row)}`));
  }

  fd(query = "") {
    const matches = [...Object.keys(virtualFs), ...Object.keys(virtualFiles)]
      .map(path => path.replace("~/.dotfiles/", ""))
      .filter(path => path.includes(query));
    if (!matches.length) return this.line("no matches", "dim");
    matches.slice(0, 20).forEach(path => this.line(path, "blue"));
  }

  rg(query) {
    if (!query) return this.line("rg: search pattern required", "red");
    let count = 0;
    for (const [path, content] of Object.entries(virtualFiles)) {
      content.split("\n").forEach((row, index) => {
        if (row.toLowerCase().includes(query.toLowerCase())) {
          this.htmlLine(`<span class="purple">${this.escapeHtml(path.replace("~/.dotfiles/", ""))}</span><span class="dim">:${index + 1}:</span>${this.escapeHtml(row)}`);
          count += 1;
        }
      });
    }
    if (!count) this.line("no matches", "dim");
  }

  zoxide(args) {
    if (args[0] === "query") {
      const query = args.slice(1).join(" ");
      const hit = Object.keys(virtualFs).find(path => path.includes(query));
      return this.line(hit || "~/.dotfiles");
    }
    this.line("zoxide: query <name> · z <directory>", "dim");
  }

  atuin(args) {
    if (args[0] === "history" && args[1] === "list") {
      [...this.history].reverse().slice(0, 12).forEach((item, index) => this.line(`${String(index + 1).padStart(2)}  ${item}`));
      return;
    }
    if (args[0] === "search" || args[0] === "history") return this.showAtuinHistory();
    this.line("atuin: history list · search", "dim");
  }

  starship(args) {
    if (args[0] === "explain") {
      this.line("left: os → shell → directory → git_branch", "dim");
      this.line("right: git_commit → git_status → cmd_duration", "dim");
      this.line("character: second line, ❯ success / ❯ error", "dim");
      return;
    }
    this.line("starship: explain", "dim");
  }

  helix(args) {
    const file = args[0] || "README.md";
    const target = this.normalizePath(file);
    const content = virtualFiles[target] || virtualFiles["~/.dotfiles/README.md"];
    this.line(`NORMAL  ${file}                                      Helix · read-only preview`, "yellow");
    content.trimEnd().split("\n").slice(0, 14).forEach((row, index) => this.htmlLine(`<span class="dim">${String(index + 1).padStart(3)}</span>  ${this.escapeHtml(row)}`));
  }

  yazi() {
    this.line("Yazi · ~/.dotfiles · read-only preview", "yellow");
    this.line("README.md   Brewfile   packages/   public/");
    this.line("ghostty/    starship/  zsh/        tmux/");
    this.line("helix/      yazi/      atuin/      rclone/");
  }

  lazygit() {
    this.line("lazygit · master · read-only preview", "yellow");
    this.line("working tree  clean", "green");
    this.line("master → origin/master");
    this.line("7163297  interactive terminal");
    this.line("117f608  palette + Monaspace");
    this.line("79b3ff1  Rclone + site");
  }

  git(args) {
    if (args[0] === "status") {
      this.line("On branch master", "green");
      this.line("Your branch is up to date with 'origin/master'.", "dim");
      this.line("nothing to commit, working tree clean");
      return;
    }
    if (args[0] === "branch") return this.line("* master", "green");
    if (args[0] === "log") { this.line("7163297 feat: add embeddable interactive terminal"); this.line("117f608 feat: showcase Everforest palette and Monaspace"); this.line("79b3ff1 feat: finalize public site, managed tooling, and rclone cloud"); return; }
    this.line("git: demo supports status, branch, and log", "dim");
  }

  async just(args) {
    if (!args.length) {
      this.line("Available recipes:", "yellow");
      this.line("  plan <role>       Preview installation");
      this.line("  install <role>    Generate installation action");
      this.line("  packages <role>   Show package plan");
      this.line("  doctor            Show demo capability check");
      this.line("  update            Requires host shell", "dim");
      return;
    }
    if (args[0] === "plan") return this.plan(args[1] || "development");
    if (args[0] === "packages") return this.packages(args[1] || "development");
    if (args[0] === "doctor") {
      this.line("✓ browser sandbox", "green");
      this.line("✓ public package metadata", "green");
      this.line("✓ clipboard/open-link actions", "green");
      this.line("– host shell intentionally unavailable", "yellow");
      return;
    }
    if (args[0] === "install") return this.install([args[1] || "development"]);
    this.line(this.t.unsupported, "red");
  }

  async dotfiles(args) {
    if (args[0] === "packages") return this.packages(args[1] || "development");
    if (args[0] === "plan") return this.plan(args[1] || "development");
    this.line("dotfiles: demo supports packages and plan", "dim");
  }

  async packages(role) {
    try {
      const response = await fetch(`./data/${role}.json`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      const names = data.packages.map(pkg => pkg.name);
      this.line(names.join("  "));
    } catch {
      this.line(`No published package plan for role: ${role}`, "red");
    }
  }

  async plan(role) {
    try {
      const response = await fetch(`./data/${role}.json`);
      if (!response.ok) throw new Error();
      const data = await response.json();
      this.line(`Plan: base + ${role}`, "yellow");
      for (const pkg of data.packages.slice(0, 14)) {
        this.line(`  ${pkg.requirement === "required" ? "●" : "○"} ${pkg.name} · ${pkg.requirement}`);
      }
      if (data.packages.length > 14) this.line(`  … ${data.packages.length - 14} more`, "dim");
    } catch {
      this.line(`No published plan for role: ${role}`, "red");
    }
  }

  rclone(args) {
    if (args[0] === "status") {
      this.line("cloud: → ~/Cloud", "cyan");
      this.line("VFS cache mode: full · browser demo does not mount host filesystems", "dim");
      return;
    }
    this.line("rclone: demo supports status; real cloud operations require host authorization", "dim");
  }

  setTheme(value) {
    if (!["auto", "dark", "light"].includes(value)) return this.line("theme: use auto, dark, or light", "red");
    this.dispatchEvent(new CustomEvent("dotfiles-action", { bubbles: true, composed: true, detail: { type: "theme", value } }));
    if (value === "light") this.setAttribute("data-terminal-theme", "light");
    else if (value === "dark") this.setAttribute("data-terminal-theme", "dark");
    else this.setAttribute("data-terminal-theme", matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    this.line(`${this.t.theme} ${value}`, "green");
  }

  setLanguage(value) {
    if (!translations[value]) return this.line("lang: use en, es, or sv", "red");
    this.dispatchEvent(new CustomEvent("dotfiles-action", { bubbles: true, composed: true, detail: { type: "language", value } }));
    this.setAttribute("lang", value);
    this.line(`${this.t.lang} ${value}`, "green");
  }

  setRole(args) {
    const [operation, role] = args;
    if (!["add", "remove"].includes(operation) || !["development", "desktop", "server", "remote", "mobile"].includes(role)) {
      return this.line(this.t.roleInvalid, "red");
    }
    this.dispatchEvent(new CustomEvent("dotfiles-action", { bubbles: true, composed: true, detail: { type: "role", operation, role } }));
    this.line(`${this.t.role} ${operation} ${role}`, "green");
  }

  install(args) {
    const role = args[0] || "development";
    const command = `curl -fsSL https://xtreemze.github.io/dotfiles/install | bash -s -- --role ${role}`;
    this.line(command, "cyan");
    const actions = document.createElement("div");
    const copy = document.createElement("button");
    copy.className = "action";
    copy.type = "button";
    copy.textContent = "Copy command";
    copy.addEventListener("click", () => this.copyText(command));
    const inspect = document.createElement("button");
    inspect.className = "action";
    inspect.type = "button";
    inspect.textContent = "Open installer";
    inspect.addEventListener("click", () => window.open("https://xtreemze.github.io/dotfiles/install", "_blank", "noopener,noreferrer"));
    actions.append(copy, inspect);
    this.shadowRoot.querySelector(".output").append(actions);
    this.scrollBottom();
  }

  async copy(args) {
    if (args[0] !== "install") return this.line("copy: supported target is 'install'", "red");
    const command = "curl -fsSL https://xtreemze.github.io/dotfiles/install | bash -s -- --role development";
    await this.copyText(command);
  }

  async copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.line(this.t.copied, "green");
    } catch {
      this.line(this.t.copyFailed, "red");
      this.line(text, "cyan");
    }
  }

  open(target) {
    const urls = {
      github: "https://github.com/xtreemze/dotfiles",
      site: "https://xtreemze.github.io/dotfiles/"
    };
    if (!urls[target]) return this.line("open: use github or site", "red");
    window.open(urls[target], "_blank", "noopener,noreferrer");
    this.line(`open ${target}`, "green");
  }
}

customElements.define("dotfiles-terminal", DotfilesTerminal);
