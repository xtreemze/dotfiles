const supportedLanguages = ["en", "es", "sv"];
const supportedThemes = ["auto", "light", "dark"];
const query = new URLSearchParams(location.search);

const languageSelect = document.querySelector("#language-select");
const themeSelect = document.querySelector("#theme-select");
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
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
const systemDark = matchMedia("(prefers-color-scheme: dark)");

function preferredLanguage() {
  const fromUrl = query.get("lang");
  if (supportedLanguages.includes(fromUrl)) return fromUrl;

  const stored = localStorage.getItem("dotfiles-language");
  if (supportedLanguages.includes(stored)) return stored;

  for (const candidate of navigator.languages || [navigator.language]) {
    const base = candidate?.toLowerCase().split("-")[0];
    if (supportedLanguages.includes(base)) return base;
  }

  return "en";
}

function preferredTheme() {
  const stored = localStorage.getItem("dotfiles-theme");
  return supportedThemes.includes(stored) ? stored : "auto";
}

let selectedLanguage = preferredLanguage();
let selectedTheme = preferredTheme();
const guessedPlatform = /Mac/.test(navigator.platform) ? "macos" : "linux";
let selectedPlatform = ["macos", "linux", "termux"].includes(query.get("platform"))
  ? query.get("platform")
  : guessedPlatform;
let selectedRoles = new Set(
  (query.get("roles") ?? "development")
    .split(",")
    .filter(role => ["development", "desktop", "server", "remote", "mobile"].includes(role))
);
let selectedCatalogLayer = [
  "base", "macos", "linux", "termux", "development", "desktop", "server", "remote", "mobile"
].includes(query.get("catalog")) ? query.get("catalog") : "base";

let locale = null;
let packageDetails = null;

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Unable to load ${path}`);
  return response.json();
}

async function loadLocale(language) {
  return fetchJson(`./locales/${language}.json`);
}

async function ensurePackageDetails() {
  if (!packageDetails) packageDetails = await fetchJson("./package-details.json");
  return packageDetails;
}

function getByPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function t(path, fallback = path) {
  return getByPath(locale?.ui, path) ?? fallback;
}

function applyStaticTranslations() {
  document.documentElement.lang = selectedLanguage;
  languageSelect.value = selectedLanguage;
  themeSelect.value = selectedTheme;

  for (const element of document.querySelectorAll("[data-i18n]")) {
    const value = t(element.dataset.i18n, element.textContent);
    element.textContent = value;
  }

  for (const element of document.querySelectorAll("[data-i18n-html]")) {
    const value = t(element.dataset.i18nHtml, element.innerHTML);
    element.innerHTML = value;
  }

  for (const element of document.querySelectorAll("[data-i18n-aria]")) {
    const value = t(element.dataset.i18nAria, element.getAttribute("aria-label") || "");
    element.setAttribute("aria-label", value);
  }

  const flow = document.querySelector(".flow");
  if (flow && locale.ui.trust.steps) {
    flow.setAttribute("aria-label", locale.ui.trust.flowLabel);
    [...flow.querySelectorAll("li")].forEach((item, index) => {
      const [title, body] = locale.ui.trust.steps[index] || [];
      if (!title) return;
      item.querySelector("strong").textContent = title;
      item.querySelector("small").innerHTML = body;
    });
  }

  const policyCards = [...document.querySelectorAll(".policy-grid article")];
  locale.ui.policy.cards?.forEach(([title, body], index) => {
    if (!policyCards[index]) return;
    policyCards[index].querySelector("h3").textContent = title;
    policyCards[index].querySelector("p").textContent = body;
  });

  const commandRows = [...document.querySelectorAll(".command-list > div")];
  locale.ui.after.commands?.forEach(([command, description], index) => {
    if (!commandRows[index]) return;
    commandRows[index].querySelector("code").textContent = command;
    commandRows[index].querySelector("span").textContent = description;
  });

  const afterNote = document.querySelector("#after-title")?.closest("section")?.querySelector(".field-help");
  if (afterNote) afterNote.innerHTML = locale.ui.after.note;

  const footerText = document.querySelector("footer span:last-child");
  if (footerText) footerText.textContent = locale.ui.footer;

  const noScript = document.querySelector(".noscript");
  if (noScript) {
    const code = noScript.querySelector("code")?.outerHTML || "";
    noScript.innerHTML = `${locale.ui.noScript} ${code}`;
  }

  document.title = `xtreemze dotfiles · ${locale.ui.hero.title}`;
}

function effectiveTheme() {
  if (selectedTheme === "dark") return "dark";
  if (selectedTheme === "light") return "light";
  return systemDark.matches ? "dark" : "light";
}

function applyTheme() {
  if (selectedTheme === "auto") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = selectedTheme;
  }
  themeSelect.value = selectedTheme;
  themeColorMeta?.setAttribute("content", effectiveTheme() === "dark" ? "#111318" : "#f7f7f4");
}

function syncUrl() {
  const params = new URLSearchParams();
  params.set("lang", selectedLanguage);
  params.set("platform", selectedPlatform);
  if (selectedRoles.size) params.set("roles", [...selectedRoles].join(","));
  if (selectedCatalogLayer !== "base") params.set("catalog", selectedCatalogLayer);
  history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
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
  return fetchJson(`./data/${name}.json`);
}

function mergePlans(plans) {
  const packages = new Map();

  for (const plan of plans) {
    for (const pkg of plan.packages) {
      const existing = packages.get(pkg.name);
      if (!existing) {
        packages.set(pkg.name, { ...pkg, sources: new Set([pkg.source]) });
        continue;
      }
      existing.sources.add(pkg.source);
      if (pkg.requirement === "required") existing.requirement = "required";
      if ((!existing.version || existing.version === "system") && pkg.version) existing.version = pkg.version;
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

function localizedPackage(name, baseDetail) {
  return { ...baseDetail, ...(locale.packages?.[name] || {}) };
}

function localizedRequirement(value) {
  return value === "required" ? locale.ui.catalog.required : locale.ui.catalog.optional;
}

function localizedSource(source) {
  return source
    .split(" + ")
    .map(name => locale.catalogLayers?.[name]?.label || name)
    .join(" + ");
}

function renderChoiceButtons() {
  platformEl.replaceChildren();
  for (const [name, platform] of Object.entries(locale.platforms)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.dataset.platform = name;
    button.setAttribute("aria-pressed", String(name === selectedPlatform));
    button.innerHTML = "<strong></strong><span></span>";
    button.querySelector("strong").textContent = platform.label;
    button.querySelector("span").textContent = platform.detail;
    button.addEventListener("click", () => {
      selectedPlatform = name;
      render();
    });
    platformEl.append(button);
  }

  rolesEl.replaceChildren();
  for (const [name, role] of Object.entries(locale.roles)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    button.dataset.role = name;
    button.setAttribute("aria-pressed", String(selectedRoles.has(name)));
    button.innerHTML = "<strong></strong><span></span>";
    button.querySelector("strong").textContent = role.label;
    button.querySelector("span").textContent = role.detail;
    button.addEventListener("click", () => {
      if (selectedRoles.has(name)) selectedRoles.delete(name);
      else selectedRoles.add(name);
      render();
    });
    rolesEl.append(button);
  }
}

function renderCatalogTabs() {
  catalogTabsEl.replaceChildren();
  for (const [name, layer] of Object.entries(locale.catalogLayers)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "catalog-tab";
    button.dataset.catalog = name;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(name === selectedCatalogLayer));
    button.tabIndex = name === selectedCatalogLayer ? 0 : -1;
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
}

async function renderPlan() {
  errorEl.hidden = true;
  bodyEl.replaceChildren();
  bodyEl.setAttribute("aria-busy", "true");
  countEl.textContent = locale.ui.plan.loading;

  try {
    const [plans, detailsPayload] = await Promise.all([
      Promise.all([selectedPlatform, ...selectedRoles].map(getPlan)),
      ensurePackageDetails()
    ]);
    const packages = mergePlans(plans);

    for (const pkg of packages) {
      const detail = localizedPackage(pkg.name, detailsPayload.packages[pkg.name] || {});
      const row = document.createElement("tr");
      const values = [
        pkg.name,
        localizedRequirement(pkg.requirement),
        localizedSource(pkg.source),
        pkg.version || "system",
        detail.why || pkg.reason || ""
      ];

      values.forEach((value, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        if (index === 0) cell.scope = "row";
        cell.textContent = value;
        row.append(cell);
      });
      bodyEl.append(row);
    }

    const noun = packages.length === 1 ? locale.ui.plan.programSingular : locale.ui.plan.programPlural;
    countEl.textContent = `${packages.length} ${noun}`;
    planMetaEl.textContent = locale.platforms[selectedPlatform].note;
  } catch (error) {
    countEl.textContent = locale.ui.plan.unavailable;
    errorEl.textContent = error instanceof Error ? error.message : locale.ui.plan.unavailable;
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
  whyLabel.textContent = locale.ui.catalog.whyHere;
  why.append(whyLabel, detail.why);

  const meta = document.createElement("div");
  meta.className = "package-meta";
  for (const value of [
    localizedRequirement(pkg.requirement),
    localizedSource(pkg.source),
    pkg.version || "system"
  ]) {
    const badge = document.createElement("span");
    badge.textContent = value;
    meta.append(badge);
  }

  const alternatives = document.createElement("div");
  alternatives.className = "package-alternatives";
  const altLabel = document.createElement("span");
  altLabel.className = "package-alt-label";
  altLabel.textContent = locale.ui.catalog.alternatives;
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

  const layer = locale.catalogLayers[selectedCatalogLayer];
  catalogTitleEl.textContent = layer.label;
  catalogDescriptionEl.textContent = layer.description;
  catalogNoteEl.textContent = layer.note;
  catalogCountEl.textContent = locale.ui.catalog.loading;

  try {
    const [plan, detailsPayload] = await Promise.all([
      getPlan(selectedCatalogLayer),
      ensurePackageDetails()
    ]);

    const packages = [...plan.packages].sort((a, b) => {
      if (a.source !== b.source) {
        if (a.source === "base") return -1;
        if (b.source === "base") return 1;
      }
      if (a.requirement !== b.requirement) return a.requirement === "required" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    for (const pkg of packages) {
      const baseDetail = detailsPayload.packages[pkg.name];
      if (!baseDetail) throw new Error(`Missing package details for ${pkg.name}`);
      catalogCardsEl.append(packageCard(pkg, localizedPackage(pkg.name, baseDetail)));
    }

    const additions = packages.filter(pkg => pkg.source === selectedCatalogLayer).length;
    const baseCount = packages.filter(pkg => pkg.source === "base").length;
    if (selectedCatalogLayer === "base") {
      const noun = packages.length === 1
        ? locale.ui.catalog.baselinePackage
        : locale.ui.catalog.baselinePackages;
      catalogCountEl.textContent = `${packages.length} ${noun}`;
    } else {
      catalogCountEl.textContent = `${additions} ${locale.ui.catalog.layer} + ${baseCount} ${locale.ui.catalog.base}`;
    }
  } catch (error) {
    catalogCountEl.textContent = locale.ui.catalog.unavailable;
    catalogErrorEl.textContent = error instanceof Error ? error.message : locale.ui.catalog.unavailable;
    catalogErrorEl.hidden = false;
  } finally {
    catalogCardsEl.removeAttribute("aria-busy");
  }
}

async function applyLanguage(language) {
  locale = await loadLocale(language);
  selectedLanguage = language;
  localStorage.setItem("dotfiles-language", language);
  applyStaticTranslations();
  renderChoiceButtons();
  renderCatalogTabs();
}

async function render() {
  if (!locale) await applyLanguage(selectedLanguage);
  syncUrl();

  commandEl.textContent = installCommand();
  inspectEl.textContent = inspectCommand();

  const roleLabels = [...selectedRoles].map(role => locale.roles[role].label);
  summaryEl.textContent = [
    locale.platforms[selectedPlatform].label,
    roleLabels.join(" + ") || locale.catalogLayers.base.label
  ].join(" · ");

  commandNoteEl.textContent = selectedPlatform === "termux"
    ? locale.ui.install.termuxNote
    : locale.ui.install.bashNote;

  await Promise.all([renderPlan(), renderCatalog()]);
}

languageSelect.addEventListener("change", async event => {
  const language = event.target.value;
  if (!supportedLanguages.includes(language)) return;
  await applyLanguage(language);
  syncUrl();
  await render();
});

themeSelect.addEventListener("change", event => {
  const theme = event.target.value;
  if (!supportedThemes.includes(theme)) return;
  selectedTheme = theme;
  if (theme === "auto") localStorage.removeItem("dotfiles-theme");
  else localStorage.setItem("dotfiles-theme", theme);
  applyTheme();
});

systemDark.addEventListener("change", () => {
  if (selectedTheme === "auto") applyTheme();
});

catalogTabsEl.addEventListener("keydown", event => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();

  const names = Object.keys(locale.catalogLayers);
  let index = names.indexOf(selectedCatalogLayer);
  if (event.key === "ArrowRight") index = (index + 1) % names.length;
  if (event.key === "ArrowLeft") index = (index - 1 + names.length) % names.length;
  if (event.key === "Home") index = 0;
  if (event.key === "End") index = names.length - 1;

  selectedCatalogLayer = names[index];
  renderCatalogTabs();
  renderCatalog();
  syncUrl();
  catalogTabsEl.querySelector(`[data-catalog="${selectedCatalogLayer}"]`)?.focus();
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

  copyEl.textContent = locale.ui.install.copied;
  copyEl.setAttribute("aria-label", locale.ui.install.copied);
  window.setTimeout(() => {
    copyEl.textContent = locale.ui.install.copy;
    copyEl.removeAttribute("aria-label");
  }, 1400);
});

applyTheme();
render();
