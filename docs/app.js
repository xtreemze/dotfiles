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

const catalogLayers = {
  base: {
    label: "Base",
    detail: "Required everywhere",
    description: "Minimum terminal foundation installed on every managed machine.",
    note: "These are bootstrap and configuration-management primitives, not a user-facing workload role."
  },
  macos: {
    label: "macOS",
    detail: "Public Homebrew baseline",
    description: "Public workstation package set used on macOS.",
    note: "macOS package state is driven by the public Brewfile; private setup can add sensitive or machine-specific layers after authentication."
  },
  linux: {
    label: "Linux",
    detail: "Portable Linux layer",
    description: "Portable shell and terminal additions available through supported Linux package managers.",
    note: "Package names may map differently across apt, dnf, pacman, and apk, while the logical tool remains the same."
  },
  termux: {
    label: "Termux",
    detail: "Android terminal layer",
    description: "Native Termux packages for a usable mobile terminal and GitHub-authenticated handoff.",
    note: "The public path intentionally avoids uncertified downloaded binaries on Termux."
  },
  development: {
    label: "Development",
    detail: "Code and Git workflows",
    description: "Developer-oriented editor, repository, search, and runtime tooling.",
    note: "This layer is additive to the base and detected platform."
  },
  desktop: {
    label: "Desktop",
    detail: "Workstation visibility",
    description: "Interactive monitoring, system inspection, disk analysis, and logs for desktop/workstation machines.",
    note: "These tools are optional conveniences and do not alter configuration authority."
  },
  server: {
    label: "Server",
    detail: "Headless operations",
    description: "Small, broadly packaged tools for process inspection and remote file synchronization.",
    note: "Optimized for headless hosts where graphical diagnostics are unavailable."
  },
  remote: {
    label: "Remote",
    detail: "SSH shell experience",
    description: "Editor, file navigation, prompt, history, jumping, and search tools for interactive remote sessions.",
    note: "Designed to make an SSH shell feel close to the local terminal experience."
  },
  mobile: {
    label: "Mobile",
    detail: "Compact terminal UX",
    description: "A deliberately smaller terminal experience for phones and other constrained clients.",
    note: "Platform-specific Termux packages are shown separately from this role."
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
const catalogTabsEl = document.querySelector("#catalog-tabs");
const catalogCardsEl = document.querySelector("#package-cards");
const catalogCountEl = document.querySelector("#catalog-count");
const catalogTitleEl = document.querySelector("#catalog-layer-title");
const catalogDescriptionEl = document.querySelector("#catalog-layer-description");
const catalogNoteEl = document.querySelector("#catalog-layer-note");
const catalogErrorEl = document.querySelector("#catalog-error");

const query = new URLSearchParams(location.search);
const guessedPlatform = /Mac/.test(navigator.platform) ? "macos" : "linux";
let selectedPlatform = platforms[query.get("platform")] ? query.get("platform") : guessedPlatform;
let selectedRoles = new Set(
  (query.get("roles") ?? "development")
    .split(",")
    .filter(role => roles[role])
);
let selectedCatalogLayer = catalogLayers[query.get("catalog")] ? query.get("catalog") : "base";

const packageDetailsPromise = fetch("./package-details.json", { cache: "no-cache" })
  .then(response => {
    if (!response.ok) throw new Error("Package details unavailable");
    return response.json();
  });

function choiceButton({ name, label, detail, pressed, onClick, kind }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "choice";
  button.dataset[kind] = name;
  button.setAttribute("aria-pressed", String(pressed));
  button.innerHTML = "<strong></strong><span></span>";
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

for (const [name, layer] of Object.entries(catalogLayers)) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "catalog-tab";
  button.dataset.catalog = name;
  button.setAttribute("role", "tab");
  button.setAttribute("aria-selected", String(name === selectedCatalogLayer));
  button.innerHTML = "<strong></strong><span></span>";
  button.querySelector("strong").textContent = layer.label;
  button.querySelector("span").textContent = layer.detail;
  button.addEventListener("click", () => {
    selectedCatalogLayer = name;
    renderCatalog();
    syncUrl();
  });
  catalogTabsEl.append(button);
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
  if (selectedCatalogLayer !== "base") params.set("catalog", selectedCatalogLayer);
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

function packageMonogram(name) {
  const cleaned = name.replace(/[^a-z0-9]/gi, "");
  return cleaned.slice(0, 2).toUpperCase() || "CLI";
}

function packageCard(pkg, detail) {
  const article = document.createElement("article");
  article.className = "package-card";

  const head = document.createElement("div");
  head.className = "package-card-head";

  const visual = document.createElement("div");
  visual.className = "package-visual";
  visual.setAttribute("aria-hidden", "true");

  if (detail.icon) {
    const image = document.createElement("img");
    image.src = `./icons/${detail.icon}`;
    image.alt = "";
    image.width = 42;
    image.height = 42;
    image.loading = "lazy";
    if (detail.iconMode === "monochrome") image.classList.add("monochrome");
    visual.append(image);
  } else {
    const monogram = document.createElement("span");
    monogram.className = "package-monogram";
    monogram.textContent = packageMonogram(pkg.name);
    visual.append(monogram);
  }

  const identity = document.createElement("div");
  identity.className = "package-identity";
  const title = document.createElement("h3");
  const link = document.createElement("a");
  link.href = detail.homepage;
  link.textContent = detail.title || pkg.name;
  link.rel = "noopener noreferrer";
  title.append(link);

  const packageName = document.createElement("code");
  packageName.textContent = pkg.name;
  identity.append(title, packageName);
  head.append(visual, identity);

  const summary = document.createElement("p");
  summary.className = "package-summary";
  summary.textContent = detail.summary;

  const why = document.createElement("p");
  why.className = "package-why";
  const whyLabel = document.createElement("strong");
  whyLabel.textContent = "Why here: ";
  why.append(whyLabel, detail.why);

  const meta = document.createElement("div");
  meta.className = "package-meta";
  for (const value of [pkg.requirement, pkg.source, pkg.version || "system"]) {
    const badge = document.createElement("span");
    badge.textContent = value;
    meta.append(badge);
  }

  const alternatives = document.createElement("div");
  alternatives.className = "package-alternatives";
  const altLabel = document.createElement("span");
  altLabel.className = "package-alt-label";
  altLabel.textContent = "Alternatives";
  alternatives.append(altLabel);
  for (const alternative of detail.alternatives || []) {
    const chip = document.createElement("span");
    chip.className = "alternative-chip";
    chip.textContent = alternative;
    alternatives.append(chip);
  }

  article.append(head, summary, why, meta, alternatives);
  return article;
}

async function renderCatalog() {
  catalogErrorEl.hidden = true;
  catalogCardsEl.replaceChildren();
  catalogCardsEl.setAttribute("aria-busy", "true");

  for (const button of catalogTabsEl.querySelectorAll("[data-catalog]")) {
    const selected = button.dataset.catalog === selectedCatalogLayer;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  }

  const layer = catalogLayers[selectedCatalogLayer];
  catalogTitleEl.textContent = layer.label;
  catalogDescriptionEl.textContent = layer.description;
  catalogNoteEl.textContent = layer.note;
  catalogCountEl.textContent = "Loading…";

  try {
    const [plan, detailPayload] = await Promise.all([
      getPlan(selectedCatalogLayer),
      packageDetailsPromise
    ]);

    const details = detailPayload.packages;
    const packages = [...plan.packages].sort((a, b) => {
      if (a.source !== b.source) {
        if (a.source === "base") return -1;
        if (b.source === "base") return 1;
      }
      if (a.requirement !== b.requirement) return a.requirement === "required" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const pkg of packages) {
      const detail = details[pkg.name];
      if (!detail) throw new Error(`Missing package details for ${pkg.name}`);
      catalogCardsEl.append(packageCard(pkg, detail));
    }

    const additions = packages.filter(pkg => pkg.source === selectedCatalogLayer).length;
    const baseCount = packages.filter(pkg => pkg.source === "base").length;
    catalogCountEl.textContent = selectedCatalogLayer === "base"
      ? `${packages.length} baseline package${packages.length === 1 ? "" : "s"}`
      : `${additions} layer + ${baseCount} base`;
  } catch (error) {
    catalogCountEl.textContent = "Catalog unavailable";
    catalogErrorEl.textContent = error instanceof Error ? error.message : "Unable to load package catalog.";
    catalogErrorEl.hidden = false;
  } finally {
    catalogCardsEl.removeAttribute("aria-busy");
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

  await Promise.all([renderPlan(), renderCatalog()]);
}

catalogTabsEl.addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();

  const names = Object.keys(catalogLayers);
  let index = names.indexOf(selectedCatalogLayer);

  if (event.key === "ArrowRight") index = (index + 1) % names.length;
  if (event.key === "ArrowLeft") index = (index - 1 + names.length) % names.length;
  if (event.key === "Home") index = 0;
  if (event.key === "End") index = names.length - 1;

  selectedCatalogLayer = names[index];
  renderCatalog();
  syncUrl();
  catalogTabsEl.querySelector(`[data-catalog="${selectedCatalogLayer}"]`).focus();
});

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
