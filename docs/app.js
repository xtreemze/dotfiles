const roles = {
  development: "Development workstation",
  desktop: "Desktop / workstation",
  server: "Headless server",
  remote: "Remote shell",
  mobile: "Mobile / Termux"
};

const descriptions = {
  development: "Editor, Git tooling, search, runtime management, and the portable terminal baseline.",
  desktop: "Portable terminal baseline plus workstation monitoring and desktop-oriented utilities.",
  server: "Headless baseline with server inspection and synchronization utilities.",
  remote: "Interactive SSH environment with editor, navigation, prompt, history, and search tools.",
  mobile: "Termux-oriented baseline with portable editor, navigation, and prompt tooling."
};

const rolesEl = document.querySelector("#roles");
const commandEl = document.querySelector("#command");
const copyEl = document.querySelector("#copy");
const bodyEl = document.querySelector("#packages");
const countEl = document.querySelector("#package-count");
const descriptionEl = document.querySelector("#role-description");

let selected = "development";

for (const [role, label] of Object.entries(roles)) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.role = role;
  button.addEventListener("click", () => selectRole(role));
  rolesEl.append(button);
}

function installCommand(role) {
  return `curl -fsSL https://xtreemze.github.io/dotfiles/install | sh -s -- --role ${role}`;
}

async function selectRole(role) {
  selected = role;
  for (const button of rolesEl.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button.dataset.role === role));
  }
  commandEl.textContent = installCommand(role);
  descriptionEl.textContent = descriptions[role] ?? "";
  bodyEl.replaceChildren();

  const response = await fetch(`./data/${role}.json`);
  if (!response.ok) throw new Error(`Unable to load package plan for ${role}`);
  const plan = await response.json();
  countEl.textContent = `${plan.packages.length} programs`;

  for (const pkg of plan.packages) {
    const row = document.createElement("tr");
    for (const value of [pkg.name, pkg.requirement, pkg.version, pkg.reason]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    bodyEl.append(row);
  }
}

copyEl.addEventListener("click", async () => {
  await navigator.clipboard.writeText(commandEl.textContent);
  copyEl.textContent = "Copied";
  window.setTimeout(() => { copyEl.textContent = "Copy"; }, 1200);
});

selectRole(selected);
