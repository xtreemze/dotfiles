const locales = {
  en: {
    intro: "Browser-local reproduction of the managed terminal stack. No host shell is exposed.",
    hint: "help for commands · Tab completes · ↑/↓ history · Ctrl-R search · Ctrl-L clear",
    unsupported: "requires the installed host environment and is intentionally unavailable in the browser",
    notFound: "command not found",
    noFile: "no such file or directory",
    copied: "installer command copied",
    copyFailed: "clipboard unavailable; command printed instead",
    historySearch: "history search",
    clean: "working tree clean",
    hostOnly: "host-only"
  },
  es: {
    intro: "Reproducción local en el navegador del stack de terminal gestionado. No se expone la shell del sistema.",
    hint: "help para comandos · Tab completa · ↑/↓ historial · Ctrl-R busca · Ctrl-L limpia",
    unsupported: "requiere el entorno real instalado y no está disponible deliberadamente en el navegador",
    notFound: "comando no encontrado",
    noFile: "archivo o directorio inexistente",
    copied: "comando de instalación copiado",
    copyFailed: "portapapeles no disponible; se muestra el comando",
    historySearch: "búsqueda de historial",
    clean: "árbol de trabajo limpio",
    hostOnly: "solo host"
  },
  sv: {
    intro: "Webbläsarlokal återgivning av den hanterade terminalstacken. Ingen värd-shell exponeras.",
    hint: "help för kommandon · Tab kompletterar · ↑/↓ historik · Ctrl-R söker · Ctrl-L rensar",
    unsupported: "kräver den installerade värdmiljön och är medvetet otillgängligt i webbläsaren",
    notFound: "kommandot hittades inte",
    noFile: "filen eller katalogen finns inte",
    copied: "installationskommandot kopierades",
    copyFailed: "urklipp ej tillgängligt; kommandot visas i stället",
    historySearch: "historiksökning",
    clean: "arbetskatalogen är ren",
    hostOnly: "endast värd"
  }
};

const files = new Map([
  ["~/.dotfiles/README.md", `# Dotfiles

Cross-platform workstation environment for macOS, Linux, and Termux.
GNU Stow is configuration authority. Roles are additive.
Rclone is the canonical cloud-storage abstraction.

Common commands:
  just
  just plan development
  dotfiles packages development
  dotfiles doctor
`],
  ["~/.dotfiles/Brewfile", `brew "git"
brew "stow"
brew "just"
brew "zsh"
brew "starship"
brew "atuin"
brew "zoxide"
brew "eza"
brew "bat"
brew "fd"
brew "ripgrep"
brew "helix"
brew "tmux"
brew "lazygit"
brew "gh"
brew "yazi"
brew "rclone"
cask "ghostty"
cask "font-monaspace"
`],
  ["~/.dotfiles/packages/base.yaml", `name: base
packages:
  - { name: git, install: required }
  - { name: tmux, install: required }
  - { name: curl, install: required }
  - { name: tar, install: required }
  - { name: stow, install: required }
  - { name: just, install: optional }
  - { name: rclone, install: optional }
`],
  ["~/.dotfiles/ghostty/.config/ghostty/config", `font-family = Monaspace Krypton
font-size = 14
theme = dark:everforest-dark-hard.ghostty,light:everforest-light-medium.ghostty
cursor-style = block
macos-titlebar-style = tabs
term = xterm-256color
`],
  ["~/.dotfiles/starship/.config/starship.toml", `format = "$os $shell $username$hostname$directory$git_branch$git_state$docker_context$package$nodejs$rust$python$battery$jobs$line_break$character"
right_format = "$git_commit $git_status $cmd_duration"
palette = "everforest"
`],
  ["~/.dotfiles/rclone/.config/dotfiles/rclone-vfs.env", `RCLONE_CLOUD_REMOTE="cloud:"
RCLONE_CLOUD_MOUNT="$HOME/Cloud"
RCLONE_VFS_CACHE_MODE="full"
RCLONE_VFS_CACHE_MAX_SIZE="20Gi"
RCLONE_VFS_CACHE_MAX_AGE="168h"
`]
]);

const dirs = new Map([
  ["~/.dotfiles", ["README.md","Brewfile","bootstrap.sh","install.sh","bin","packages","hooks","public","bash","fish","zsh","nushell","starship","atuin","ghostty","tmux","helix","yazi","lazygit","rclone"]],
  ["~/.dotfiles/bin", ["dotfiles","opencode-guard","opencode-cleanup"]],
  ["~/.dotfiles/packages", ["base.yaml","linux.yaml","termux.yaml","development.yaml","desktop.yaml","server.yaml","remote.yaml","mobile.yaml","catalog.yaml","fallbacks.yaml"]],
  ["~/.dotfiles/hooks", ["pre-install","post-install"]],
  ["~/.dotfiles/public", ["README.md","Brewfile","bootstrap.sh","bin","packages","site"]],
  ["~/.dotfiles/bash", [".bashrc"]],
  ["~/.dotfiles/fish", [".config"]],
  ["~/.dotfiles/zsh", [".zshrc"]],
  ["~/.dotfiles/nushell", [".config"]],
  ["~/.dotfiles/starship", [".config"]],
  ["~/.dotfiles/atuin", [".config"]],
  ["~/.dotfiles/ghostty", [".config"]],
  ["~/.dotfiles/tmux", [".tmux.conf","tmux-session-switcher.sh","tmux-project-switcher.sh"]],
  ["~/.dotfiles/helix", [".config"]],
  ["~/.dotfiles/yazi", [".config"]],
  ["~/.dotfiles/lazygit", [".config"]],
  ["~/.dotfiles/rclone", [".config",".local"]]
]);

const commands = [
  "help","clear","pwd","ls","tree","cd","cat","head","echo","grep","rg","fd",
  "git","just","dotfiles","rclone","which","command","env","uname","whoami",
  "theme","lang","role","install","copy","open"
];

const hostOnly = new Set([
  "sudo","ssh","bash","sh","zsh","fish","nu","brew","apt","dnf","pacman","apk",
  "rm","mv","cp","touch","mkdir","chmod","chown","stow","hx","helix","yazi","lazygit",
  "tmux","gh","atuin","sops","age","gitleaks"
]);

function shellSplit(input) {
  const parts = [];
  let current = "";
  let quote = null;
  let escaped = false;
  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) parts.push(current);
  return parts;
}

class DotfilesTerminal extends HTMLElement {
  static observedAttributes = ["lang","data-terminal-theme"];

  constructor() {
    super();
    this.attachShadow({mode:"open"});
    this.cwd = "~/.dotfiles";
    this.history = ["git status","just plan development","dotfiles packages development","rclone status"];
    this.historyIndex = this.history.length;
    this.lastDuration = 0;
    this.lastExit = 0;
    this.searchMode = false;
    this.searchQuery = "";
  }

  connectedCallback() {
    this.render();
    this.writeIntro();
    this.updatePrompt();
    queueMicrotask(() => this.input.focus());
  }

  attributeChangedCallback() {
    if (!this.shadowRoot?.children.length) return;
    this.updatePrompt();
  }

  get lang() {
    const value = (this.getAttribute("lang") || document.documentElement.lang || "en").split("-")[0];
    return locales[value] ? value : "en";
  }

  get t() { return locales[this.lang]; }
  get input() { return this.shadowRoot.querySelector(".command-input"); }
  get output() { return this.shadowRoot.querySelector(".output"); }

  get theme() {
    return this.getAttribute("data-terminal-theme") === "light" ? "light" : "dark";
  }

  get osModule() {
    const platform = navigator.userAgentData?.platform || navigator.platform || "";
    if (/Mac/i.test(platform)) return {icon:"",label:"macOS"};
    if (/Android/i.test(navigator.userAgent)) return {icon:"",label:"Android"};
    if (/Win/i.test(platform)) return {icon:"",label:"Windows"};
    return {icon:"",label:"Linux"};
  }

  get shortDirectory() {
    if (this.cwd === "~/.dotfiles") return ".dotfiles";
    return this.cwd.split("/").filter(Boolean).at(-1) || "~";
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        @font-face {
          font-family: "Monaspace Krypton Web";
          src: url("./fonts/MonaspaceKryptonNF-Regular.woff2") format("woff2");
          font-style: normal;
          font-weight: 100 900;
          font-display: swap;
        }
        @font-face {
          font-family: "Monaspace Krypton Web";
          src: url("./fonts/MonaspaceKryptonNF-Bold.woff2") format("woff2");
          font-style: normal;
          font-weight: 700 900;
          font-display: swap;
        }
        :host {
          display:block;
          --bg:#1e2326;
          --fg:#d3c6aa;
          --bg-dim:#232a2e;
          --bg1:#343f44;
          --grey0:#7a8478;
          --grey1:#859289;
          --grey2:#9da9a0;
          --red:#e67e80;
          --orange:#e69875;
          --yellow:#dbbc7f;
          --green:#a7c080;
          --aqua:#83c092;
          --blue:#7fbbb3;
          --purple:#d699b6;
          font-family:"Monaspace Krypton Web","Monaspace Krypton",ui-monospace,SFMono-Regular,Menlo,monospace;
          font-feature-settings:"calt" 1,"liga" 1,"ss01" 1,"ss02" 1,"ss03" 1,"ss04" 1,"ss05" 1,"ss06" 1,"ss07" 1,"ss08" 1,"ss09" 1;
          font-size:14px;
          line-height:1.2;
        }
        :host([data-terminal-theme="light"]) {
          --bg:#fdf6e3;
          --fg:#5c6a72;
          --bg-dim:#fff9e8;
          --bg1:#f4f0d9;
          --grey0:#939f91;
          --grey1:#829181;
          --grey2:#708071;
          --red:#f85552;
          --orange:#f57d26;
          --yellow:#dfa000;
          --green:#8da101;
          --aqua:#35a77c;
          --blue:#3a94c5;
          --purple:#df69ba;
        }
        *{box-sizing:border-box}
        .ghostty {
          width:min(100%,112ch);
          margin-inline:auto;
          overflow:hidden;
          border:1px solid color-mix(in srgb,var(--fg) 18%,transparent);
          border-radius:.75rem;
          background:var(--bg);
          color:var(--fg);
          box-shadow:0 18px 48px color-mix(in srgb,#000 22%,transparent);
        }
        .titlebar {
          height:2.35rem;
          display:grid;
          grid-template-columns:auto 1fr auto;
          align-items:end;
          gap:.5rem;
          padding:.35rem .5rem 0;
          background:color-mix(in srgb,var(--bg1) 70%,var(--bg));
          border-bottom:1px solid color-mix(in srgb,var(--fg) 12%,transparent);
          font-family:system-ui,sans-serif;
        }
        .traffic {display:flex;gap:.42rem;align-self:center;padding:0 .15rem .35rem}
        .traffic i{display:block;width:.72rem;height:.72rem;border-radius:50%}
        .traffic i:nth-child(1){background:#ff5f57}.traffic i:nth-child(2){background:#febc2e}.traffic i:nth-child(3){background:#28c840}
        .tabs{display:flex;min-width:0;align-self:stretch}
        .tab {
          display:flex;align-items:center;gap:.5rem;
          min-width:10rem;max-width:26rem;
          padding:.45rem .75rem;
          border:1px solid color-mix(in srgb,var(--fg) 10%,transparent);
          border-bottom:0;
          border-radius:.45rem .45rem 0 0;
          background:var(--bg);
          color:var(--fg);
          font-size:.72rem;
        }
        .tab-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .tab-shell{opacity:.5}
        .title-actions{display:flex;gap:.25rem;align-self:center;padding-bottom:.3rem}
        .title-action{width:1.25rem;text-align:center;opacity:.5;font-size:.8rem}
        .viewport {
          position:relative;
          height:calc(28 * 1.2em + .9rem);
          min-height:25rem;
          max-height:36rem;
          overflow:auto;
          padding:.45rem 0;
          background:var(--bg);
          color:var(--fg);
          scrollbar-color:color-mix(in srgb,var(--fg) 22%,transparent) transparent;
          overscroll-behavior:contain;
        }
        .output{padding:0 .7rem}
        .line {
          min-height:1.2em;
          white-space:pre-wrap;
          overflow-wrap:anywhere;
          font:inherit;
        }
        .prompt-block{padding:0 .7rem .2rem}
        .modules-row {
          display:grid;
          grid-template-columns:minmax(0,1fr) auto;
          gap:.75rem;
          align-items:baseline;
          min-height:1.2em;
        }
        .left-modules,.right-modules{display:flex;align-items:baseline;gap:.15rem;min-width:0}
        .right-modules{justify-content:flex-end}
        .os{color:var(--blue)} .shell{color:var(--green)} .directory{color:var(--orange)}
        .git-branch{color:var(--green)} .git-state{color:var(--yellow)}
        .git-status{color:var(--red)} .duration{color:var(--green)}
        .muted{color:var(--grey1)} .red{color:var(--red)} .green{color:var(--green)}
        .blue{color:var(--blue)} .orange{color:var(--orange)} .yellow{color:var(--yellow)}
        .aqua{color:var(--aqua)} .purple{color:var(--purple)}
        .command-row {
          display:grid;
          grid-template-columns:auto minmax(0,1fr);
          align-items:baseline;
          min-height:1.2em;
        }
        .character{color:var(--green);font-weight:700;margin-right:.55ch}
        :host([data-exit="error"]) .character{color:var(--red)}
        .input-wrap{position:relative;min-width:0}
        .suggestion,.command-input{
          width:100%;
          margin:0;padding:0;border:0;outline:0;
          background:transparent;
          font:inherit;
          line-height:1.2;
          letter-spacing:normal;
        }
        .suggestion{
          position:absolute;inset:0;
          color:var(--grey0);
          pointer-events:none;
          white-space:pre;
          overflow:hidden;
        }
        .suggestion-prefix{visibility:hidden}
        .command-input{
          position:relative;
          color:var(--fg);
          caret-color:transparent;
        }
        .command-input[data-known="true"]{color:var(--green)}
        .block-cursor {
          position:absolute;
          top:.05em;
          width:.62em;height:1.08em;
          background:var(--fg);
          mix-blend-mode:difference;
          pointer-events:none;
          transform:translateX(var(--cursor-x,0));
        }
        .search {
          display:none;
          grid-template-columns:auto 1fr;
          gap:.5rem;
          padding:.15rem .7rem;
          border-top:1px solid color-mix(in srgb,var(--fg) 8%,transparent);
          color:var(--grey1);
        }
        .search[data-open="true"]{display:grid}
        .search-query{color:var(--aqua)}
        .help-grid{display:grid;grid-template-columns:minmax(15ch,auto) 1fr;gap:.12rem 1rem;margin:.3rem 0 .6rem}
        .help-grid code{color:var(--aqua);font:inherit}
        .action {
          appearance:none;
          margin:.25rem .35rem .25rem 0;
          border:1px solid color-mix(in srgb,var(--fg) 24%,transparent);
          border-radius:.25rem;
          background:var(--bg1);color:var(--fg);
          padding:.22rem .45rem;font:inherit;font-size:.85em;cursor:pointer;
        }
        .action:focus-visible,.action:hover{outline:1px solid var(--aqua);outline-offset:1px}
        @media(max-width:700px){
          .ghostty{width:100%}.viewport{min-height:22rem}
          .titlebar{grid-template-columns:auto 1fr}.title-actions{display:none}
          .right-modules{display:none}
        }
      </style>
      <div class="ghostty" role="application" aria-label="Interactive dotfiles terminal">
        <div class="titlebar">
          <span class="traffic" aria-hidden="true"><i></i><i></i><i></i></span>
          <div class="tabs"><div class="tab"><span class="tab-path">~/.dotfiles</span><span class="tab-shell">zsh</span></div></div>
          <span class="title-actions" aria-hidden="true"><span class="title-action">＋</span><span class="title-action">⌄</span></span>
        </div>
        <div class="viewport" tabindex="0">
          <div class="output" aria-live="polite"></div>
          <div class="prompt-block">
            <div class="modules-row">
              <div class="left-modules">
                <span class="os"></span><span class="shell">zsh</span><span class="directory"></span><span class="git-branch"> master</span><span class="git-state"></span>
              </div>
              <div class="right-modules"><span class="git-status"></span><span class="duration"></span></div>
            </div>
            <form class="command-row">
              <span class="character">❯</span>
              <span class="input-wrap">
                <span class="suggestion" aria-hidden="true"></span>
                <input class="command-input" aria-label="Terminal command" autocomplete="off" autocapitalize="off" spellcheck="false">
                <span class="block-cursor" aria-hidden="true"></span>
              </span>
            </form>
          </div>
          <div class="search"><span>atuin ❯</span><span class="search-query"></span></div>
        </div>
      </div>
    `;

    this.form = this.shadowRoot.querySelector("form");
    this.form.addEventListener("submit", e => this.submit(e));
    this.input.addEventListener("input", () => this.inputChanged());
    this.input.addEventListener("keydown", e => this.keydown(e));
    this.input.addEventListener("click", () => this.positionCursor());
    this.input.addEventListener("keyup", () => this.positionCursor());
    this.shadowRoot.querySelector(".viewport").addEventListener("pointerdown", e => {
      if (!e.target.closest("button")) this.input.focus();
    });
  }

  writeIntro() {
    this.line(this.t.intro,"muted");
    this.line(this.t.hint,"muted");
    this.line();
  }

  updatePrompt() {
    if (!this.shadowRoot?.children.length) return;
    this.shadowRoot.querySelector(".os").textContent = this.osModule.icon;
    this.shadowRoot.querySelector(".directory").textContent = `${this.shortDirectory} `;
    this.shadowRoot.querySelector(".tab-path").textContent = this.cwd;
    this.shadowRoot.querySelector(".duration").textContent = this.lastDuration >= 500 ? `${this.lastDuration}ms  ` : "";
    this.shadowRoot.querySelector(".git-status").textContent = "";
    this.setAttribute("data-exit",this.lastExit ? "error":"ok");
    this.updateSuggestion();
    this.positionCursor();
  }

  line(text="",className="") {
    const el=document.createElement("div");
    el.className=`line ${className}`;
    el.textContent=text;
    this.output.append(el);
    this.scrollBottom();
    return el;
  }

  richLine(parts=[]) {
    const el=document.createElement("div");
    el.className="line";
    for(const [text,className] of parts){
      const span=document.createElement("span");
      span.textContent=text;
      if(className) span.className=className;
      el.append(span);
    }
    this.output.append(el);
    this.scrollBottom();
    return el;
  }

  echoPrompt(command) {
    const first=document.createElement("div");
    first.className="line";
    first.innerHTML=`<span class="blue"></span><span class="green">zsh</span> <span class="orange"></span><span class="green"> master </span>`;
    first.querySelector(".blue").textContent=this.osModule.icon;
    first.querySelector(".orange").textContent=`${this.shortDirectory} `;
    this.output.append(first);
    this.richLine([["❯ ","green"],[command,""]]);
  }

  scrollBottom() {
    requestAnimationFrame(()=>{
      const viewport=this.shadowRoot.querySelector(".viewport");
      viewport.scrollTop=viewport.scrollHeight;
    });
  }

  positionCursor() {
    if (!this.input) return;
    const measure=document.createElement("canvas").getContext("2d");
    const style=getComputedStyle(this.input);
    measure.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const prefix=this.input.value.slice(0,this.input.selectionStart ?? this.input.value.length);
    const px=measure.measureText(prefix).width;
    this.shadowRoot.querySelector(".block-cursor").style.setProperty("--cursor-x",`${px}px`);
  }

  inputChanged() {
    this.historyIndex=this.history.length;
    this.input.dataset.known=String(commands.includes(shellSplit(this.input.value)[0]||""));
    this.updateSuggestion();
    this.positionCursor();
    if(this.searchMode) this.updateSearch();
  }

  suggestionFor(value) {
    if(!value) return "";
    const lower=value.toLowerCase();
    const history=[...this.history].reverse().find(item=>item.toLowerCase().startsWith(lower)&&item!==value);
    if(history) return history;
    const tokens=shellSplit(value);
    if(tokens.length<=1 && !value.endsWith(" ")){
      const match=commands.find(cmd=>cmd.startsWith(lower)&&cmd!==lower);
      if(match) return match;
    }
    const last=tokens.at(-1) || "";
    if(value.includes(" ") && !value.endsWith(" ")){
      const matches=this.pathCandidates(last);
      if(matches.length===1) return value.slice(0,value.length-last.length)+matches[0];
    }
    return "";
  }

  updateSuggestion() {
    const value=this.input?.value||"";
    const full=this.suggestionFor(value);
    const el=this.shadowRoot.querySelector(".suggestion");
    if(!full || !full.startsWith(value)){ el.textContent=""; return; }
    el.replaceChildren();
    const hidden=document.createElement("span");
    hidden.className="suggestion-prefix";
    hidden.textContent=value;
    el.append(hidden,document.createTextNode(full.slice(value.length)));
  }

  acceptSuggestion() {
    const full=this.suggestionFor(this.input.value);
    if(!full) return false;
    this.input.value=full;
    this.inputChanged();
    queueMicrotask(()=>this.input.setSelectionRange(full.length,full.length));
    return true;
  }

  keydown(event) {
    if(this.searchMode){
      if(event.key==="Escape"){event.preventDefault();this.closeSearch();return}
      if(event.key==="Enter"){event.preventDefault();this.acceptSearch();return}
      if(event.key==="Backspace"){event.preventDefault();this.searchQuery=this.searchQuery.slice(0,-1);this.updateSearch();return}
      if(event.key.length===1&&!event.metaKey&&!event.ctrlKey&&!event.altKey){event.preventDefault();this.searchQuery+=event.key;this.updateSearch();return}
    }
    if(event.key==="Tab"){event.preventDefault();this.complete();return}
    if(event.key==="ArrowRight" && this.input.selectionStart===this.input.value.length && this.input.selectionEnd===this.input.value.length){
      if(this.acceptSuggestion()) event.preventDefault();
      return;
    }
    if(event.key==="ArrowUp"){event.preventDefault();this.historyMove(-1);return}
    if(event.key==="ArrowDown"){event.preventDefault();this.historyMove(1);return}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="l"){event.preventDefault();this.clear();return}
    if(event.ctrlKey&&event.key.toLowerCase()==="r"){event.preventDefault();this.openSearch();return}
    if(event.ctrlKey&&event.key.toLowerCase()==="c"){event.preventDefault();this.cancelInput();return}
    if(event.key==="Home"){event.preventDefault();this.input.setSelectionRange(0,0);this.positionCursor();return}
    if(event.key==="End"){event.preventDefault();const n=this.input.value.length;this.input.setSelectionRange(n,n);this.positionCursor();return}
  }

  historyMove(delta) {
    this.historyIndex=Math.max(0,Math.min(this.history.length,this.historyIndex+delta));
    this.input.value=this.history[this.historyIndex]||"";
    this.inputChanged();
    queueMicrotask(()=>{const n=this.input.value.length;this.input.setSelectionRange(n,n)});
  }

  openSearch() {
    this.searchMode=true;
    this.searchQuery="";
    this.shadowRoot.querySelector(".search").dataset.open="true";
    this.updateSearch();
  }

  closeSearch() {
    this.searchMode=false;
    this.searchQuery="";
    this.shadowRoot.querySelector(".search").dataset.open="false";
    this.input.focus();
  }

  updateSearch() {
    const match=[...this.history].reverse().find(h=>h.toLowerCase().includes(this.searchQuery.toLowerCase()))||"";
    this.shadowRoot.querySelector(".search-query").textContent=`${this.t.historySearch}: ${this.searchQuery}  ${match ? "→ "+match : ""}`;
    this.searchMatch=match;
  }

  acceptSearch() {
    if(this.searchMatch){
      this.input.value=this.searchMatch;
      this.inputChanged();
    }
    this.closeSearch();
  }

  cancelInput() {
    if(this.input.value) this.echoPrompt(`${this.input.value}^C`);
    this.input.value="";
    this.lastExit=130;
    this.updatePrompt();
  }

  pathCandidates(prefix) {
    const slash=prefix.lastIndexOf("/");
    const dirPart=slash>=0?prefix.slice(0,slash+1):"";
    const namePart=slash>=0?prefix.slice(slash+1):prefix;
    const base=this.normalizePath(dirPart||".");
    const entries=dirs.get(base)||[];
    return entries.filter(x=>x.startsWith(namePart)).map(x=>dirPart+x+(dirs.has(`${base}/${x}`) ? "/" : ""));
  }

  complete() {
    const value=this.input.value;
    const parts=shellSplit(value);
    if(parts.length<=1&&!value.endsWith(" ")){
      const prefix=parts[0]||"";
      const matches=commands.filter(x=>x.startsWith(prefix));
      if(matches.length===1){this.input.value=matches[0]+" ";this.inputChanged();return}
      if(matches.length>1){this.line(matches.join("  "),"aqua");return}
    }
    const token=parts.at(-1)||"";
    const matches=this.pathCandidates(token);
    if(matches.length===1){
      this.input.value=value.slice(0,value.length-token.length)+matches[0];
      this.inputChanged();
    } else if(matches.length>1) this.line(matches.join("  "),"aqua");
  }

  normalizePath(path) {
    if(!path||path===".") return this.cwd;
    if(path==="~"||path==="~/.dotfiles") return "~/.dotfiles";
    if(path.startsWith("~/")) return path.replace(/\/$/,"");
    if(path.startsWith("/")) return path.replace(/\/$/,"");
    const stack=this.cwd.split("/");
    for(const segment of path.split("/")){
      if(!segment||segment===".") continue;
      if(segment===".."){if(stack.length>2) stack.pop()}
      else stack.push(segment);
    }
    return stack.join("/").replace(/\/$/,"");
  }

  async submit(event) {
    event.preventDefault();
    const raw=this.input.value.trim();
    if(!raw) return;
    this.echoPrompt(raw);
    this.history.push(raw);
    this.historyIndex=this.history.length;
    this.input.value="";
    this.inputChanged();
    const started=performance.now();
    this.lastExit=await this.execute(raw);
    this.lastDuration=Math.round(performance.now()-started);
    this.updatePrompt();
  }

  async execute(raw) {
    const args=shellSplit(raw);
    const command=args.shift()||"";
    if(hostOnly.has(command)){this.line(`${command}: ${this.t.unsupported}`,"yellow");return 126}
    switch(command){
      case "help": this.help(); return 0;
      case "clear": this.clear(); return 0;
      case "pwd": this.line(this.cwd); return 0;
      case "whoami": this.line("visitor"); return 0;
      case "uname": this.line(`${this.osModule.label} browser sandbox · xterm-256color model`); return 0;
      case "env": this.env(); return 0;
      case "echo": this.line(args.join(" ")); return 0;
      case "ls": return this.ls(args);
      case "tree": this.tree(args[0]); return 0;
      case "cd": return this.cd(args[0]||"~/.dotfiles");
      case "cat": return this.cat(args);
      case "head": return this.head(args);
      case "grep": return this.grep(args);
      case "rg": return this.rg(args);
      case "fd": return this.fd(args);
      case "which": return this.which(args[0]);
      case "command": return args[0]==="-v" ? this.which(args[1]) : (this.line("command: demo supports -v","muted"),2);
      case "git": return this.git(args);
      case "just": return await this.just(args);
      case "dotfiles": return await this.dotfiles(args);
      case "rclone": return this.rclone(args);
      case "theme": return this.themeCommand(args[0]);
      case "lang": return this.langCommand(args[0]);
      case "role": return this.roleCommand(args);
      case "install": this.install(args[0]||"development"); return 0;
      case "copy": return await this.copyCommand(args);
      case "open": return this.openCommand(args[0]);
      default: this.line(`${command}: ${this.t.notFound}`,"red"); return 127;
    }
  }

  clear(){this.output.replaceChildren()}

  help(){
    const grid=document.createElement("div");grid.className="help-grid";
    const rows=[
      ["pwd ls tree cd cat head","read-only virtual filesystem"],
      ["rg grep fd","search virtual repository"],
      ["git status branch log","repository state"],
      ["just plan/packages/doctor","dotfiles recipes"],
      ["dotfiles plan/packages/doctor","published installer model"],
      ["rclone status","cloud/VFS policy"],
      ["theme lang role","real page state"],
      ["copy install · open github","real browser actions"],
      ["Tab / → / ↑↓ / Ctrl-R / Ctrl-L","zsh-like interaction"],
      ["ssh brew stow tmux hx …",this.t.hostOnly]
    ];
    for(const [a,b] of rows){const code=document.createElement("code");code.textContent=a;const span=document.createElement("span");span.textContent=b;grid.append(code,span)}
    this.output.append(grid);this.scrollBottom();
  }

  env(){
    this.line("TERM=xterm-256color");
    this.line("SHELL=/bin/zsh");
    this.line("EDITOR=hx");
    this.line("DOTFILES_ROOT=$HOME/.dotfiles");
    this.line("RCLONE_CLOUD_REMOTE=cloud:");
  }

  ls(args){
    const flags=args.filter(x=>x.startsWith("-")).join("");
    const path=args.find(x=>!x.startsWith("-"))||".";
    const target=this.normalizePath(path);
    const entries=dirs.get(target);
    if(!entries){this.line(`ls: ${path}: ${this.t.noFile}`,"red");return 2}
    if(flags.includes("l")){
      for(const name of entries){
        const full=`${target}/${name}`;
        const isDir=dirs.has(full);
        this.line(`${isDir?"drwxr-xr-x":"-rw-r--r--"}  1 xtreemze staff  ${String(isDir?128:(files.get(full)?.length||512)).padStart(5)}  ${name}${isDir?"/":""}`,isDir?"blue":"");
      }
    } else this.line(entries.map(name=>dirs.has(`${target}/${name}`)?name+"/":name).join("  "));
    return 0;
  }

  tree(path="."){
    const target=this.normalizePath(path);
    const entries=dirs.get(target);
    if(!entries){this.line(`tree: ${path}: ${this.t.noFile}`,"red");return}
    this.line(path==="."?".":path);
    entries.slice(0,18).forEach((name,i)=>{
      const last=i===Math.min(entries.length,18)-1;
      this.line(`${last?"└──":"├──"} ${name}${dirs.has(`${target}/${name}`)?"/":""}`,dirs.has(`${target}/${name}`)?"blue":"");
    });
  }

  cd(path){
    const target=this.normalizePath(path);
    if(!dirs.has(target)){this.line(`cd: ${path}: ${this.t.noFile}`,"red");return 1}
    this.cwd=target;this.updatePrompt();return 0;
  }

  cat(args){
    if(!args.length){this.line("cat: missing operand","red");return 1}
    let status=0;
    for(const path of args){
      const target=this.normalizePath(path),content=files.get(target);
      if(content==null){this.line(`cat: ${path}: ${this.t.noFile}`,"red");status=1;continue}
      content.trimEnd().split("\n").forEach(line=>this.line(line));
    }
    return status;
  }

  head(args){
    const path=args.at(-1);if(!path)return 1;
    const content=files.get(this.normalizePath(path));
    if(content==null){this.line(`head: ${path}: ${this.t.noFile}`,"red");return 1}
    content.split("\n").slice(0,10).forEach(line=>this.line(line));return 0;
  }

  grep(args){
    const needle=args[0],path=args[1];
    if(!needle||!path){this.line("grep: usage: grep PATTERN FILE","red");return 2}
    const content=files.get(this.normalizePath(path));
    if(content==null){this.line(`grep: ${path}: ${this.t.noFile}`,"red");return 2}
    let found=false;content.split("\n").forEach(line=>{if(line.includes(needle)){this.line(line);found=true}});
    return found?0:1;
  }

  rg(args){
    const needle=args[0];if(!needle){this.line("rg: missing pattern","red");return 2}
    let found=0;
    for(const [path,content] of files){
      if(!path.startsWith(this.cwd)) continue;
      content.split("\n").forEach((line,i)=>{if(line.toLowerCase().includes(needle.toLowerCase())){this.richLine([[path.replace("~/.dotfiles/",""),"purple"],[":","muted"],[String(i+1),"green"],[": ","muted"],[line,""]]);found++}});
    }
    return found?0:1;
  }

  fd(args){
    const needle=(args[0]||"").toLowerCase();
    const found=[...files.keys(),...dirs.keys()].filter(p=>p.startsWith(this.cwd)&&p.toLowerCase().includes(needle)).map(p=>p.replace(this.cwd+"/","")).filter(p=>p!==this.cwd);
    found.slice(0,30).forEach(p=>this.line(p,dirs.has(this.normalizePath(p))?"blue":""));return found.length?0:1;
  }

  which(name){
    const known=new Set([...commands,"git","just","dotfiles","rclone","starship","zoxide","eza","bat","fd","rg","hx","yazi","lazygit","gh","tmux"]);
    if(!known.has(name)){this.line(`${name} not found`,"red");return 1}
    this.line(name==="dotfiles"?"~/.dotfiles/bin/dotfiles":`/opt/homebrew/bin/${name}`);return 0;
  }

  git(args){
    switch(args[0]){
      case "status":
        this.line("On branch master","green");this.line("Your branch is up to date with 'origin/master'.","muted");this.line();this.line(`nothing to commit, ${this.t.clean}`);return 0;
      case "branch": this.line("* master","green");return 0;
      case "log": this.richLine([["7163297","yellow"],[" (HEAD -> master) ","muted"],["feat: add embeddable interactive terminal",""]]);this.richLine([["117f608","yellow"],[" ","muted"],["feat: showcase Everforest palette and Monaspace",""]]);return 0;
      case "remote": this.line("origin  git@github.com:xtreemze/.dotfiles.git (fetch)");this.line("origin  git@github.com:xtreemze/.dotfiles.git (push)");return 0;
      default:this.line("git: demo supports status, branch, log, remote","muted");return 2;
    }
  }

  async fetchPlan(role){
    const response=await fetch(`./data/${role}.json`);
    if(!response.ok) throw new Error(role);
    return response.json();
  }

  async just(args){
    if(!args.length){["plan <role>","install <role>","packages <role>","doctor","update"].forEach(x=>this.line(x));return 0}
    if(args[0]==="plan")return this.plan(args[1]||"development");
    if(args[0]==="packages")return this.packages(args[1]||"development");
    if(args[0]==="doctor")return this.doctor();
    if(args[0]==="install"){this.install(args[1]||"development");return 0}
    if(args[0]==="update"){this.line(`just update: ${this.t.unsupported}`,"yellow");return 126}
    this.line(`error: Justfile does not contain recipe \`${args[0]}\``,"red");return 1;
  }

  async dotfiles(args){
    if(args[0]==="plan")return this.plan(args[1]||"development");
    if(args[0]==="packages")return this.packages(args[1]||"development");
    if(args[0]==="doctor")return this.doctor();
    this.line("dotfiles: demo supports plan, packages, doctor","muted");return 2;
  }

  async plan(role){
    try{
      const data=await this.fetchPlan(role);this.line(`Plan · base + ${role}`,"yellow");
      data.packages.forEach(pkg=>this.line(`${pkg.requirement==="required"?"●":"○"} ${pkg.name.padEnd(14)} ${pkg.requirement}`,pkg.requirement==="required"?"green":"muted"));return 0;
    }catch{this.line(`unknown role: ${role}`,"red");return 2}
  }

  async packages(role){
    try{const data=await this.fetchPlan(role);this.line(data.packages.map(x=>x.name).join("  "));return 0}
    catch{this.line(`unknown role: ${role}`,"red");return 2}
  }

  doctor(){
    this.line("✓ git","green");this.line("✓ stow","green");this.line("✓ just","green");this.line("✓ rclone policy","green");this.line("✓ Monaspace Krypton Nerd Font (web specimen)","green");this.line("– host links and services require installed machine","yellow");return 0;
  }

  rclone(args){
    if(args[0]==="status"||args[0]==="about"){
      this.line("cloud: → ~/Cloud","aqua");this.line("VFS cache: full · max 20Gi · max age 168h","muted");this.line(`mount backend: ${this.osModule.label==="macOS"?"nfsmount":"FUSE 3"} · browser specimen does not mount host storage`,"muted");return 0;
    }
    this.line("rclone: demo supports status/about; provider operations require host authorization","muted");return 2;
  }

  themeCommand(value){
    if(!["auto","dark","light"].includes(value)){this.line("theme: use auto, dark, or light","red");return 2}
    this.dispatchEvent(new CustomEvent("dotfiles-action",{bubbles:true,composed:true,detail:{type:"theme",value}}));
    const resolved=value==="auto"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):value;
    this.setAttribute("data-terminal-theme",resolved);this.line(`theme → ${value}`,"green");return 0;
  }

  langCommand(value){
    if(!locales[value]){this.line("lang: use en, es, or sv","red");return 2}
    this.dispatchEvent(new CustomEvent("dotfiles-action",{bubbles:true,composed:true,detail:{type:"language",value}}));
    this.setAttribute("lang",value);this.line(`lang → ${value}`,"green");return 0;
  }

  roleCommand(args){
    const [op,role]=args;
    if(!["add","remove"].includes(op)||!["development","desktop","server","remote","mobile"].includes(role)){this.line("role: use add|remove development|desktop|server|remote|mobile","red");return 2}
    this.dispatchEvent(new CustomEvent("dotfiles-action",{bubbles:true,composed:true,detail:{type:"role",operation:op,role}}));
    this.line(`role ${op} ${role}`,"green");return 0;
  }

  install(role){
    const command=`curl -fsSL https://xtreemze.github.io/dotfiles/install | bash -s -- --role ${role}`;
    this.line(command,"aqua");
    const wrap=document.createElement("div");
    const copy=document.createElement("button");copy.className="action";copy.type="button";copy.textContent="copy";copy.onclick=()=>this.copyText(command);
    const inspect=document.createElement("button");inspect.className="action";inspect.type="button";inspect.textContent="inspect";inspect.onclick=()=>window.open("https://xtreemze.github.io/dotfiles/install","_blank","noopener,noreferrer");
    wrap.append(copy,inspect);this.output.append(wrap);this.scrollBottom();
  }

  async copyCommand(args){
    if(args[0]!=="install"){this.line("copy: supported target is install","red");return 2}
    return this.copyText("curl -fsSL https://xtreemze.github.io/dotfiles/install | bash -s -- --role development");
  }

  async copyText(text){
    try{await navigator.clipboard.writeText(text);this.line(this.t.copied,"green");return 0}
    catch{this.line(this.t.copyFailed,"yellow");this.line(text,"aqua");return 1}
  }

  openCommand(target){
    const urls={github:"https://github.com/xtreemze/dotfiles",private:"https://github.com/xtreemze/.dotfiles",site:"https://xtreemze.github.io/dotfiles/"};
    if(!urls[target]){this.line("open: use github, private, or site","red");return 2}
    window.open(urls[target],"_blank","noopener,noreferrer");return 0;
  }
}

customElements.define("dotfiles-terminal",DotfilesTerminal);
