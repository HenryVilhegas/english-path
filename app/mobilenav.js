// ===== Navegação inferior (mobile) =====
// 3 destinos: Trilha (mapa de lições), Praticar (home do módulo livre atual),
// Mais (lista de módulos extras: Teste de Nível, Rua, Phrasal Verbs, Dicas).
const EXTRA_MODULE_IDS = ["test", "us", "phr", "tips"];

function mobNavSetActive(name) {
  document.querySelectorAll(".bottom-nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
}

function mobNavRenderMore() {
  const box = document.getElementById("moreList");
  box.innerHTML = EXTRA_MODULE_IDS.map((id) => {
    const lvl = LEVELS.find((l) => l.id === id);
    if (!lvl) return "";
    return `<button class="more-item" data-goto-module="${id}">${lvl.label}</button>`;
  }).join("");
  box.querySelectorAll("[data-goto-module]").forEach((b) => {
    b.onclick = async () => {
      document.getElementById("moreSheet").classList.remove("open");
      await selectLevel(b.dataset.gotoModule);
      showView("home");
      mobNavSetActive("home");
    };
  });
}

document.querySelectorAll(".bottom-nav-btn").forEach((b) => {
  b.onclick = async () => {
    const dest = b.dataset.nav;
    if (dest === "path") {
      mobNavSetActive("path");
      await openPath();
    } else if (dest === "home") {
      mobNavSetActive("home");
      // "Praticar" abre o módulo livre atualmente selecionado (ou A1 por padrão).
      if (!state.data || PATH_LEVELS.includes(state.levelId) === false && EXTRA_MODULE_IDS.includes(state.levelId) === false) {
        await selectLevel("a1");
      } else {
        renderHome();
      }
      showView("home");
    } else if (dest === "more") {
      mobNavRenderMore();
      document.getElementById("moreSheet").classList.add("open");
    }
  };
});
document.getElementById("closeMoreSheet").onclick = () => document.getElementById("moreSheet").classList.remove("open");
document.getElementById("moreSheet").onclick = (e) => { if (e.target.id === "moreSheet") e.currentTarget.classList.remove("open"); };
