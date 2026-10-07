const platforms = {
  macos: {
    label: "macOS",
    detail: "Homebrew desired state",
    note: "The public Brewfile is the package authority on macOS; role flags still carry forward to the authenticated private handoff."
  },
  linux: {
    label: "Linux",
    detail: "apt · dnf · pacman · apk",
    note: "The installer detects the native package manager and resolves logical package names through the public catalog."
  },
  termux: {
    label: "Termux",
    detail: "Android · pkg",
    note: "Termux uses native packages only for the public baseline and keeps mobile configuration isolated from desktop assumptions."
  }
};

const roles = {
  development: {
    label: "Development",
    detail: "Editor, Git and runtime tools"
  },
  desktop: {
    label: "Desktop",
    detail: "Workstation monitoring and utilities"
  },
  server: {
    label: "Server",
    detail: "Headless inspection and sync"
  },
  remote: {
    label: "Remote",
    detail: "Interactive SSH environment"
  },
  mobile: {
    label: "Mobile",
    detail: "Termux-oriented terminal tools"
  }
};

const platformEl = document.querySelector("#platforms");
const rolesEl = document.querySelector("#roles");
const commandEl = document.querySelector("#command");
const inspectEl = document.querySelector("#inspect-command");
const copyEl = document.querySelector("#copy");
const bodyEl = document.querySelector("#packages");
const countEl = document.querySelector("#package-count");
const planMetaEl = document.querySelector("#plan-meta");
const summaryEl = document.querySelector("#selection-summary");
const errorEl = document.querySelector("#plan-error");
const commandNoteEl = document.querySelector("#command-note");

const query = new URLSearchParams(location.search);
const guessedPlatform = /Mac/.test(navigator.platform) ? "macos" : "linux";
let selectedPlatform = platforms[query.get("platform")] ? query.get("platform") : guessedPlatform;
let selectedRoles = new Set(
  (query.get("roles") ?? "development")
    .split(",")
    .filter(role => roles[role])
);

function choiceButton({ name, label, detail, pressed, onClick, kind }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "choice";
  button.dataset[kind] = name;
  button.setAttribute("aria-pressed", String(pressed));
  button.innerHTML = `<strong></strong><span></span>`;
  button.querySelector("strong").textContent = label;
  button.querySelector("span").textContent = detail;
  button.addEventListener("click", onClick);
  return button;
}

for (const [name, platform] of Object.entries(platforms)) {
  platformEl.append(choiceButton({
    name,
    ...platform,
    pressed: name === selectedPlatform,
    kind: "platform",
    onClick: () => {
      selectedPlatform = name;
      render();
    }
  }));
}

for (const [name, role] of Object.entries(roles)) {
  rolesEl.append(choiceButton({
    name,
    ...role,
    pressed: selectedRoles.has(name),
    kind: "role",
    onClick: () => {
      if (selectedRoles.has(name)) selectedRoles.delete(name);
      else selectedRoles.add(name);
      render();
    }
  }));
}

function roleArgs() {
  return [...selectedRoles].map(role => ` --role ${role}`).join("");
}

function installCommand() {
  return `curl -fsSL https://xtreemze.github.io/dotfiles/install | bash -s --${roleArgs()}`;
}

function inspectCommand() {
  return [
    'install_path="${TMPDIR:-/tmp}/xtreemze-dotfiles-install"',
    'curl -fsSLo "$install_path" https://xtreemze.github.io/dotfiles/install',
    'less "$install_path"',
    `bash "$install_path"${roleArgs()}`
  ].join("\n");
}

async function getPlan(name) {
  const response = await fetch(`./data/${name}.json`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Package plan unavailable for ${name}`);
  return response.json();
}

function mergePlans(plans) {
  const packages = new Map();

  for (const plan of plans) {
    for (const pkg of plan.packages) {
      const existing = packages.get(pkg.name);
      if (!existing) {
        packages.set(pkg.name, {
          ...pkg,
          sources: new Set([pkg.source])
        });
        continue;
      }

      existing.sources.add(pkg.source);
      if (pkg.requirement === "required") existing.requirement = "required";
      if ((!existing.reason || existing.reason === "Managed terminal dependency") && pkg.reason) {
        existing.reason = pkg.reason;
      }
      if ((!existing.version || existing.version === "system") && pkg.version) {
        existing.version = pkg.version;
      }
    }
  }

  return [...packages.values()]
    .map(pkg => ({
      ...pkg,
      source: [...pkg.sources].sort((a, b) => {
        if (a === "base") return -1;
        if (b === "base") return 1;
        return a.localeCompare(b);
      }).join(" + ")
    }))
    .sort((a, b) => {
      if (a.requirement !== b.requirement) return a.requirement === "required" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

function syncUrl() {
  const params = new URLSearchParams();
  params.set("platform", selectedPlatform);
  if (selectedRoles.size) params.set("roles", [...selectedRoles].join(","));
  history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
}

function renderChoices() {
  for (const button of platformEl.querySelectorAll("[data-platform]")) {
    button.setAttribute("aria-pressed", String(button.dataset.platform === selectedPlatform));
  }
  for (const button of rolesEl.querySelectorAll("[data-role]")) {
    button.setAttribute("aria-pressed", String(selectedRoles.has(button.dataset.role)));
  }
}

async function renderPlan() {
  errorEl.hidden = true;
  bodyEl.replaceChildren();
  bodyEl.setAttribute("aria-busy", "true");
  countEl.textContent = "Loading…";

  try {
    const names = [selectedPlatform, ...selectedRoles];
    const plans = await Promise.all(names.map(getPlan));
    const packages = mergePlans(plans);

    for (const pkg of packages) {
      const row = document.createElement("tr");
      const values = [
        pkg.name,
        pkg.requirement,
        pkg.source,
        pkg.version || "system",
        pkg.reason || "Managed terminal dependency"
      ];

      values.forEach((value, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        if (index === 0) cell.scope = "row";
        cell.textContent = value;
        row.append(cell);
      });

      bodyEl.append(row);
    }

    countEl.textContent = `${packages.length} program${packages.length === 1 ? "" : "s"}`;
    planMetaEl.textContent = platforms[selectedPlatform].note;
  } catch (error) {
    countEl.textContent = "Plan unavailable";
    errorEl.textContent = error instanceof Error ? error.message : "Unable to load package plan.";
    errorEl.hidden = false;
  } finally {
    bodyEl.removeAttribute("aria-busy");
  }
}

async function render() {
  renderChoices();
  syncUrl();

  commandEl.textContent = installCommand();
  inspectEl.textContent = inspectCommand();

  const roleLabels = [...selectedRoles].map(role => roles[role].label);
  summaryEl.textContent = [platforms[selectedPlatform].label, roleLabels.join(" + ") || "runtime defaults"].join(" · ");

  commandNoteEl.textContent = selectedPlatform === "termux"
    ? "Run this inside Termux. Bash is installed as a bootstrap prerequisite if necessary."
    : "Uses Bash explicitly because the bootstrap relies on Bash features.";

  await renderPlan();
}

copyEl.addEventListener("click", async () => {
  const value = commandEl.textContent;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.className = "clipboard-helper";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }

  copyEl.textContent = "Copied";
  copyEl.setAttribute("aria-label", "Install command copied");
  window.setTimeout(() => {
    copyEl.textContent = "Copy";
    copyEl.removeAttribute("aria-label");
  }, 1400);
});

render();
