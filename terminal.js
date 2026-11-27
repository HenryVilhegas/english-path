// ===== Escrever em inglês (modo "terminal") =====
// Desafios em data/<level>-terminal.json:
//   [{ id, topic, q, a:[regex], ex, out, why, hint }]
//   q = enunciado em PT · a = regex aceitas (sem diferenciar maiúsculas) · ex = resposta modelo
//   out = "Também se diz..." (opcional) · why = explicação/dica de uso · hint = dica
// Usa globals: state, showView, loadProgress, saveProgress, shuffle, speak.

const term = { all: [], list: [], idx: 0, tries: 0, hits: 0, misses: [] };

const $t = (id) => document.getElementById(id);

function termPrint(text, cls = "") {
  const body = $t("termBody");
  const line = document.createElement("div");
  line.className = "term-line " + cls;
  line.textContent = text;           // textContent: nunca interpreta HTML
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

// Normaliza o que a pessoa digitou: aspas curvas, pontuação final, espaços.
function termNorm(s) {
  return s
    .trim()
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[.!?]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function termDoneMap() {
  return loadProgress(state.levelId).termDone || {};
}
function termMark(id) {
  const p = loadProgress(state.levelId);
  p.termDone = p.termDone || {};
  p.termDone[id] = true;
  saveProgress(state.levelId, p);
}

function termUpdateInfo() {
  const done = termDoneMap();
  const n = term.all.filter((c) => done[c.id]).length;
  $t("termInfo").textContent =
    `${state.data ? state.data.name : ""} · ${n}/${term.all.length} dominados · ` +
    `nesta sessão: ${term.hits} de primeira`;
}

function termSay(text) {
  if ($t("termSpeak") && $t("termSpeak").checked && typeof speak === "function") speak(text, 1);
}

async function openTerminal() {
  showView("terminal");
  $t("termBody").textContent = "";
  $t("termRetry").style.display = "none";
  term.all = [];
  try {
    const r = await fetch(`data/${state.levelId}-terminal.json`);
    if (r.ok) term.all = await r.json();
  } catch { /* sem desafios */ }
  // Desafios extras opcionais (data/<level>-terminal-extra.json).
  try {
    const rx = await fetch(`data/${state.levelId}-terminal-extra.json`);
    if (rx.ok) term.all = term.all.concat(await rx.json());
  } catch { /* sem extra */ }

  if (!term.all.length) {
    termPrint("Este módulo ainda não tem desafios de escrita.", "err");
    $t("termInput").disabled = true;
    termUpdateInfo();
    return;
  }
  $t("termInput").disabled = false;
  termStart(false);
}

function termStart(retry) {
  let pool = retry ? term.misses.slice() : term.all.slice();
  if (!retry && $t("termOnlyNew").checked) {
    const done = termDoneMap();
    pool = pool.filter((c) => !done[c.id]);
  }
  $t("termBody").textContent = "";
  $t("termRetry").style.display = "none";
  term.hits = 0;
  term.misses = [];
  term.idx = 0;
  term.list = shuffle(pool);

  termPrint("# Escreva a frase em inglês e aperte Enter. Maiúsculas e pontuação final não importam.", "dim");
  termPrint("# Comandos: dica · resposta · pular · limpar · ajuda", "dim");
  if (!term.list.length) {
    termPrint("Você já dominou todos os desafios! Desmarque 'só os que ainda não dominei'.", "ok");
    termUpdateInfo();
    return;
  }
  termNext();
}

function termShowTask() {
  const c = term.list[term.idx];
  termPrint("");
  termPrint(`# Desafio ${term.idx + 1}/${term.list.length}${c.topic ? " · " + c.topic : ""}`, "dim");
  termPrint(`# ${c.q}`, "task");
}

function termNext() {
  termUpdateInfo();
  if (term.idx >= term.list.length) { termFinish(); return; }
  term.tries = 0;
  termShowTask();
  $t("termInput").focus();
}

function termFinish() {
  const total = term.list.length;
  termPrint("");
  termPrint(`✔ Fim da rodada: ${term.hits}/${total} de primeira.`, "ok");
  if (term.misses.length) {
    termPrint("Para revisar:", "dim");
    term.misses.forEach((c) => termPrint(`  ${c.ex}   ← ${c.q}`, "hint"));
    $t("termRetry").style.display = "inline-block";
  } else {
    termPrint("Perfeito! Desmarque 'só os que ainda não dominei' para treinar tudo de novo.", "ok");
  }
  termUpdateInfo();
}

function termAddMiss(c) {
  if (!term.misses.includes(c)) term.misses.push(c);
}

function termHint() {
  const c = term.list[term.idx];
  if (!c) return;
  const fallback = "Começa com: " + c.ex.split(" ").slice(0, 2).join(" ") + " …";
  termPrint(`💡 ${c.hint || fallback}`, "hint");
}

function termReveal() {
  const c = term.list[term.idx];
  if (!c) return;
  termPrint(`→ ${c.ex}`, "ans");
  if (c.out) c.out.split("\n").forEach((l) => termPrint(l, "out"));
  termPrint(`ℹ ${c.why}`, "dim");
  termSay(c.ex);
  termAddMiss(c);
  term.idx++;
  termNext();
}

function termSkip() {
  const c = term.list[term.idx];
  if (!c) return;
  termPrint("(pulado)", "dim");
  termAddMiss(c);
  term.idx++;
  termNext();
}

// Aceita a resposta modelo, as regex e variações com/sem contração (I am / I'm, do not / don't).
function termMatches(c, cmd) {
  const forms = [cmd, expandContractions(cmd), contractWords(cmd)];
  if (forms.some((f) => f.toLowerCase() === termNorm(c.ex).toLowerCase())) return true;
  return forms.some((f) => c.a.some((re) => new RegExp(re, "i").test(f)));
}
function termSubmit(raw) {
  const cmd = termNorm(raw);
  if (!cmd) return;
  termPrint(`> ${raw.trim()}`, "cmd");
  const lower = cmd.toLowerCase();

  if (["dica", "hint"].includes(lower)) { termHint(); return; }
  if (["resposta", "answer", "solucao", "solução"].includes(lower)) { termReveal(); return; }
  if (["pular", "skip"].includes(lower)) { termSkip(); return; }
  if (["limpar", "clear"].includes(lower)) {
    $t("termBody").textContent = "";
    if (term.list[term.idx]) termShowTask();
    return;
  }
  if (["ajuda", "help"].includes(lower)) {
    termPrint("dica = pista · resposta = mostra e segue · pular = próxima · limpar = limpa a tela", "dim");
    return;
  }

  const c = term.list[term.idx];
  if (!c) { termPrint("Rodada encerrada. Use 'Recomeçar'.", "dim"); return; }

  const ok = termMatches(c, cmd);
  if (ok) {
    if (c.out) c.out.split("\n").forEach((l) => termPrint(l, "out"));
    termPrint(`✓ ${c.why}`, "ok");
    termSay(c.ex);
    if (term.tries === 0) { term.hits++; termMark(c.id); } else { termAddMiss(c); }
    term.idx++;
    termNext();
    return;
  }

  term.tries++;
  const ex = termNorm(c.ex).toLowerCase().split(" ");
  const inp = lower.split(" ");
  const incomplete = inp.length < ex.length && inp.every((t, i) => t === ex[i]);
  termPrint(incomplete
    ? "✗ Quase! Falta completar a frase."
    : "✗ Ainda não. Confira as palavras e a ordem e tente de novo.", "err");
  if (term.tries === 2) termHint();
  if (term.tries >= 4) {
    termPrint("Vamos ver a resposta e seguir:", "dim");
    termReveal();
  }
}

// ---- Eventos (o script é carregado no fim do <body>) ----
$t("termForm").onsubmit = (e) => {
  e.preventDefault();
  const inp = $t("termInput");
  const v = inp.value;
  inp.value = "";
  termSubmit(v);
};
$t("termHint").onclick = termHint;
$t("termReveal").onclick = termReveal;
$t("termSkip").onclick = termSkip;
$t("termRestart").onclick = () => { if (term.all.length) termStart(false); };
$t("termRetry").onclick = () => termStart(true);
$t("termOnlyNew").onchange = () => { if (term.all.length) termStart(false); };
$t("term").onclick = () => { if (!$t("termInput").disabled) $t("termInput").focus(); };
