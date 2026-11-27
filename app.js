// ===== English Path App =====
// Inglês do zero ao avançado (A1 a C1) + inglês americano de rua. Dados por módulo em /data/<id>.json.
// Progresso salvo em localStorage.

const LEVELS = [
  { id: "test", label: "0 · Teste de Nível", ready: true },
  { id: "a1", label: "A1 · Iniciante", ready: true },
  { id: "a2", label: "A2 · Básico", ready: true },
  { id: "b1", label: "B1 · Intermediário", ready: true },
  { id: "b2", label: "B2 · Intermediário Superior", ready: true },
  { id: "c1", label: "C1 · Avançado", ready: true },
  { id: "us", label: "🗽 Inglês de Rua (EUA)", ready: true },
  { id: "phr", label: "🔀 Phrasal Verbs e Idioms", ready: true },
  { id: "tips", label: "💡 Dicas para Imersão", ready: true },
];

const EXAM_SECONDS_PER_Q = 40; // ritmo de prova de nível: ~40 s por questão
const EXAM_MIN_SECONDS = 60;   // piso de tempo do simulado

const state = {
  levelId: "test",
  data: null,
  study: null,       // material resumo (cache de -study.json)
  studyDeep: null,   // material detalhado (cache de -deep.json)
  studyVariant: "resumo", // "resumo" | "deep" — material em exibição
  flashIndex: 0,
  flashHistory: [],
  flashTopic: null,   // null = todos os tópicos
  quizTopic: null,
  // quiz/exam
  mode: null,          // 'quiz' | 'exam'
  examCfg: { difficulty: "todas", amount: 10 },
  wrongQuestions: [],
  questions: [],
  qIndex: 0,
  answers: [],
  timerId: null,
  timeLeft: 0,
};

// ---------- Storage ----------
const storeKey = (lvl) => `english-study:${lvl}`;
function loadProgress(lvl) {
  try { return JSON.parse(localStorage.getItem(storeKey(lvl))) || {}; }
  catch { return {}; }
}
function saveProgress(lvl, p) {
  localStorage.setItem(storeKey(lvl), JSON.stringify(p));
}

// Histórico: guarda as últimas tentativas (mais recente primeiro).
const MAX_HISTORY = 10;
function recordAttempt(mode, pct, total) {
  const p = loadProgress(state.levelId);
  const hist = p.history || [];
  hist.unshift({ mode, pct, total, date: Date.now() });
  p.history = hist.slice(0, MAX_HISTORY);
  saveProgress(state.levelId, p);
}

// ---------- View routing ----------
function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById(`view-${name}`).classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Level nav ----------
function renderLevelNav() {
  const nav = document.getElementById("levelNav");
  nav.innerHTML = "";
  LEVELS.forEach((lvl) => {
    const b = document.createElement("button");
    b.textContent = lvl.label + (lvl.ready ? "" : " 🔒");
    b.className = lvl.id === state.levelId ? "active" : "";
    b.disabled = !lvl.ready;
    b.title = lvl.ready ? `Estudar ${lvl.label}` : "Em breve";
    b.onclick = () => selectLevel(lvl.id);
    nav.appendChild(b);
  });
}

async function selectLevel(id) {
  state.levelId = id;
  renderLevelNav();
  try {
    const res = await fetch(`data/${id}.json`);
    if (!res.ok) throw new Error(res.status);
    state.data = await res.json();
    // Banco extra opcional (data/<id>-extra.json): mais questões e flashcards.
    try {
      const rx = await fetch(`data/${id}-extra.json`);
      if (rx.ok) {
        const ex = await rx.json();
        state.data.questions = state.data.questions.concat(ex.questions || []);
        state.data.flashcards = state.data.flashcards.concat(ex.flashcards || []);
      }
    } catch { /* sem extra */ }
  } catch (e) {
    state.data = null;
    document.getElementById("levelTitle").textContent = "Erro ao carregar";
    document.getElementById("levelDesc").textContent =
      "Rode o app por um servidor local (ver README) para carregar os dados.";
    return;
  }
  // Pré-carrega o material de estudo para a métrica de "seções estudadas"
  // já aparecer certa na Home. Falha silenciosa se não existir.
  state.study = null;
  state.studyDeep = null;
  try {
    const r = await fetch(`data/${id}-study.json`);
    if (r.ok) {
      const s = await r.json();
      if (s && s.sections) state.study = s;
    }
  } catch { /* ignore */ }

  renderHome();
  showView("home");
}

// ---------- Home ----------
function renderHome() {
  if (typeof renderTip === "function") renderTip();
  const pc = document.getElementById("placementCard");
  if (pc) pc.style.display = state.levelId === "test" ? "flex" : "none";
  const d = state.data;
  document.getElementById("levelTitle").textContent = `${d.level} · ${d.name}`;
  document.getElementById("levelDesc").textContent = d.description || "";

  const p = loadProgress(state.levelId);
  const mastered = (p.masteredFlashcards || []).length;
  const total = d.flashcards.length;
  document.getElementById("statFlash").textContent = `${mastered}/${total}`;
  document.getElementById("barFlash").style.width =
    total ? `${Math.round((mastered / total) * 100)}%` : "0%";
  document.getElementById("statQuiz").textContent =
    p.bestQuiz != null ? `${p.bestQuiz}%` : "—";
  document.getElementById("statExam").textContent =
    p.bestExam != null ? `${p.bestExam}%` : "—";

  // Seções de estudo lidas (preenchido quando o study.json carrega)
  const readEl = document.getElementById("statStudy");
  const readBar = document.getElementById("barStudy");
  if (readEl && readBar) {
    const readCount = (p.readSections || []).length;
    const secTotal = state.study ? state.study.sections.length : null;
    if (secTotal != null) {
      readEl.textContent = `${readCount}/${secTotal}`;
      readBar.style.width = secTotal ? `${Math.round((readCount / secTotal) * 100)}%` : "0%";
    } else {
      readEl.textContent = readCount ? `${readCount}` : "—";
      readBar.style.width = "0%";
    }
  }

  renderHistory(p.history || []);
}

// Exibe as tentativas recentes (quiz/simulado) na Home.
function renderHistory(hist) {
  const card = document.getElementById("historyCard");
  const list = document.getElementById("historyList");
  if (!card || !list) return;
  if (!hist.length) { card.style.display = "none"; return; }

  card.style.display = "block";
  list.innerHTML = hist
    .map((h) => {
      const d = new Date(h.date);
      const when = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
        " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const label = h.mode === "exam" ? "Simulado" : h.mode === "placement" ? "Teste de nível" : "Quiz";
      const cls = h.pct >= 70 ? "ok" : "no";
      return `<div class="history-item">` +
        `<span class="h-mode">${label}</span>` +
        `<span class="h-when">${when}</span>` +
        `<span class="h-score ${cls}">${h.pct}% <small>(${h.total}q)</small></span>` +
        `</div>`;
    })
    .join("");
}

// ---------- Study ----------
// Lê um JSON autossuficiente em data/<level>-study.json (evita depender de
// arquivos fora da raiz do servidor, que servidores estáticos bloqueiam).
// variant: "resumo" (data/<level>-study.json) ou "deep" (data/<level>-deep.json)
async function openStudy(variant = "resumo") {
  state.studyVariant = variant;
  const container = document.getElementById("studyContent");
  container.innerHTML = "<p class='muted'>Carregando material…</p>";
  showView("study");

  const isDeep = variant === "deep";
  const file = isDeep ? `${state.levelId}-deep.json` : `${state.levelId}-study.json`;
  let study = isDeep ? state.studyDeep : state.study;

  if (!study) {
    try {
      const r = await fetch(`data/${file}`);
      if (r.ok) study = await r.json();
    } catch { /* ignore */ }
    // Seções extras opcionais (data/<id>-sections-extra.json): mais tópicos de estudo.
    // Formato: { study: [{title, blocks}], deep: [{title, blocks}] }
    try {
      const rx = await fetch(`data/${state.levelId}-sections-extra.json`);
      if (rx.ok && study && study.sections) {
        const ex = await rx.json();
        const extraSecs = isDeep ? ex.deep : ex.study;
        if (Array.isArray(extraSecs)) study.sections = study.sections.concat(extraSecs);
      }
    } catch { /* sem extra */ }
    if (study && study.sections) {
      if (isDeep) state.studyDeep = study; else state.study = study;
    }
  }

  if (!study || !study.sections) {
    container.innerHTML =
      "<p class='muted'>Material de estudo deste nível ainda não disponível.</p>";
    return;
  }

  await applyLabs(study);
  renderStudy();
}

// Soma os laboratórios práticos (data/<level>-labs.json) ao fim de cada seção.
// Formato: { "<título da seção>": [ { h, p, list, code }, ... ] }
async function applyLabs(study) {
  if (study._labsApplied) return;
  study._labsApplied = true;
  try {
    const r = await fetch(`data/${state.levelId}-labs.json`);
    if (!r.ok) return;
    const labs = await r.json();
    study.sections.forEach((sec) => {
      if (labs[sec.title]) sec.blocks = sec.blocks.concat(labs[sec.title]);
    });
  } catch { /* sem labs */ }
}

// Monta a tela de estudo: sumário navegável + seções com "marcar como lida"
// e "testar esta seção". Guarda referência em state.study para re-render.
function renderStudy() {
  const isDeep = state.studyVariant === "deep";
  const study = isDeep ? state.studyDeep : state.study;
  const container = document.getElementById("studyContent");
  const read = new Set(loadReadSections());
  const topics = new Set((state.data.questions || []).map((q) => q.topic));

  // slug estável a partir do título (para id de âncora)
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const label = isDeep ? "Material detalhado" : "Material de estudo (resumo)";
  let html = `<h1>${study.level} — ${label}</h1>`;

  // Sumário
  html += `<nav class="study-toc" aria-label="Sumário">`;
  html += study.sections
    .map((sec) => {
      const done = read.has(sec.title) ? " done" : "";
      const check = read.has(sec.title) ? "✓ " : "";
      return `<a class="toc-chip${done}" href="#sec-${slug(sec.title)}">${check}${sec.title}</a>`;
    })
    .join("");
  html += `</nav>`;

  // Seções
  for (const sec of study.sections) {
    const id = slug(sec.title);
    const isRead = read.has(sec.title);
    html += `<section class="study-section" id="sec-${id}">`;
    html += `<h2>${sec.title}</h2>`;
    for (const b of sec.blocks) {
      if (b.h) html += `<h3>${b.h}</h3>`;
      if (b.p) html += `<p>${b.p}</p>`;
      if (b.list) html += "<ul>" + b.list.map((i) => `<li>${i}</li>`).join("") + "</ul>";
      if (b.svg) html += `<figure class="diagram">${b.svg}</figure>`;
      if (b.say) html += renderSay(b.say);
      if (b.code) {
        // Escapa o código: comandos Linux têm &lt; &gt; &amp; que quebrariam o HTML.
        const esc = b.code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        html += `<pre class="codeblock"><code>${esc}</code></pre>`;
      }
    }
    html += `<div class="section-actions">`;
    html += `<button class="btn small toggle-read${isRead ? " is-read" : ""}" data-section="${encodeURIComponent(sec.title)}">`;
    html += isRead ? "✓ Lida" : "Marcar como lida";
    html += `</button>`;
    if (topics.has(sec.title)) {
      html += `<button class="btn small test-section" data-topic="${encodeURIComponent(sec.title)}">Testar esta seção</button>`;
    }
    html += `</div></section>`;
  }
  container.innerHTML = html;

  // Liga os botões (CSP-safe, sem onclick inline)
  container.querySelectorAll(".toggle-read").forEach((b) => {
    b.onclick = () => toggleReadSection(decodeURIComponent(b.dataset.section));
  });
  container.querySelectorAll(".test-section").forEach((b) => {
    b.onclick = () => startQuiz("quiz", decodeURIComponent(b.dataset.topic));
  });
}

// ---------- Progresso de leitura ----------
function loadReadSections() {
  const p = loadProgress(state.levelId);
  return p.readSections || [];
}
function toggleReadSection(title) {
  const p = loadProgress(state.levelId);
  const set = new Set(p.readSections || []);
  if (set.has(title)) set.delete(title); else set.add(title);
  p.readSections = [...set];
  saveProgress(state.levelId, p);
  renderStudy();  // atualiza sumário + botão
}

// ---------- Flashcards (repetição espaçada leve) ----------
// Cada carta tem um "nível de domínio" (0..MAX). Acertar sobe o nível,
// errar zera. Quanto maior o nível, menor o peso de sorteio -> aparece menos.
// Carta é considerada "dominada" (conta no progresso) ao atingir MASTERED_AT.
const FLASH_MAX_LEVEL = 5;   // teto do nível de domínio
const FLASH_MASTERED_AT = 3; // a partir daqui conta como dominada
// Pesos por nível: nível 0 aparece ~16x mais que o nível 5.
const FLASH_WEIGHTS = [16, 8, 4, 2, 1, 1];

// Lê o mapa { cardId: level } do progresso salvo.
function loadFlashLevels() {
  const p = loadProgress(state.levelId);
  return p.flashLevels || {};
}
// Salva o mapa de níveis e mantém masteredFlashcards em sincronia
// (pra barra de progresso da Home continuar correta).
function saveFlashLevels(levels) {
  const p = loadProgress(state.levelId);
  p.flashLevels = levels;
  p.masteredFlashcards = Object.keys(levels).filter(
    (id) => levels[id] >= FLASH_MASTERED_AT
  );
  saveProgress(state.levelId, p);
}

// Baralho ativo: todos os flashcards ou só os do tópico selecionado.
function activeFlashcards() {
  const all = state.data.flashcards;
  return state.flashTopic ? all.filter((c) => c.topic === state.flashTopic) : all;
}

// Abre o seletor de tópico dos flashcards.
function openFlashcards() {
  renderFlashTopics();
  showView("flashtopics");
}

function renderFlashTopics() {
  const box = document.getElementById("flashTopicList");
  const cards = state.data.flashcards;
  const levels = loadFlashLevels();

  // Conta cartas e dominadas por tópico, preservando a ordem de aparição.
  const topics = [];
  const seen = new Set();
  cards.forEach((c) => {
    if (!seen.has(c.topic)) { seen.add(c.topic); topics.push(c.topic); }
  });

  const makeRow = (label, list, topicValue) => {
    const mastered = list.filter((c) => (levels[c.id] || 0) >= FLASH_MASTERED_AT).length;
    const b = document.createElement("button");
    b.className = "topic-card";
    b.innerHTML = `<span class="t-name">${label}</span>` +
      `<span class="t-count">${mastered}/${list.length} dominados</span>`;
    b.onclick = () => startFlashcards(topicValue);
    return b;
  };

  box.innerHTML = "";
  box.appendChild(makeRow("Todos os tópicos", cards, null));
  topics.forEach((t) => {
    box.appendChild(makeRow(t, cards.filter((c) => c.topic === t), t));
  });
}

// Inicia o baralho (topic null = todos).
function startFlashcards(topic) {
  state.flashTopic = topic;
  state.flashHistory = [];
  state.flashIndex = pickWeightedFlashcard(null);
  renderFlashcard();
  showView("flashcards");
}

// Sorteia o índice da próxima carta ponderando pelo nível de domínio.
// Índice relativo ao baralho ATIVO (activeFlashcards).
// Evita repetir a carta 'exclude' quando há mais de uma opção.
function pickWeightedFlashcard(exclude) {
  const cards = activeFlashcards();
  const levels = loadFlashLevels();
  const pool = [];
  let totalWeight = 0;

  cards.forEach((c, i) => {
    if (i === exclude && cards.length > 1) return;
    const lvl = Math.min(levels[c.id] || 0, FLASH_MAX_LEVEL);
    const w = FLASH_WEIGHTS[lvl];
    totalWeight += w;
    pool.push({ i, w });
  });

  let r = Math.random() * totalWeight;
  for (const item of pool) {
    r -= item.w;
    if (r <= 0) return item.i;
  }
  return pool[pool.length - 1].i;
}

function renderFlashcard() {
  const cards = activeFlashcards();
  const c = cards[state.flashIndex];
  const levels = loadFlashLevels();
  const lvl = Math.min(levels[c.id] || 0, FLASH_MAX_LEVEL);
  const status =
    lvl === 0 ? "novo" :
    lvl >= FLASH_MASTERED_AT ? `dominado (nível ${lvl})` :
    `aprendendo (nível ${lvl})`;

  const mastered = cards.filter((x) => (levels[x.id] || 0) >= FLASH_MASTERED_AT).length;
  document.getElementById("flashCounter").textContent =
    `${c.topic} · ${status} · ${mastered}/${cards.length} dominados`;
  const pron = c.en && c.syl ? renderPron(c.syl) : "";
  document.getElementById("flashFront").innerHTML = c.front + (c.en ? pron + " " + speakBtn(c.en) : "");
  document.getElementById("flashBack").innerHTML = c.back + (c.en ? pron + " " + speakBtn(c.en) : "");
  document.getElementById("flashcard").classList.remove("flipped");
}

function markFlashcard(hit) {
  const levels = loadFlashLevels();
  const id = activeFlashcards()[state.flashIndex].id;
  const cur = levels[id] || 0;
  // Acertou: sobe de nível (vê menos). Errou: zera (volta a ver muito).
  levels[id] = hit ? Math.min(cur + 1, FLASH_MAX_LEVEL) : 0;
  saveFlashLevels(levels);
  nextFlashcard();
}

function nextFlashcard() {
  state.flashHistory.push(state.flashIndex);
  if (state.flashHistory.length > 50) state.flashHistory.shift();
  state.flashIndex = pickWeightedFlashcard(state.flashIndex);
  renderFlashcard();
}

function prevFlashcard() {
  if (state.flashHistory.length) {
    state.flashIndex = state.flashHistory.pop();
  }
  renderFlashcard();
}

// ---------- Quiz / Exam ----------
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Embaralha as alternativas de uma questão e reindexa a resposta correta.
// Retorna uma CÓPIA; não altera o objeto original.
function shuffleOptions(q) {
  const idx = shuffle(q.options.map((_, i) => i)); // nova ordem dos índices
  return {
    ...q,
    options: idx.map((i) => q.options[i]),
    answer: idx.indexOf(q.answer),
  };
}

// Opções de quantidade sugeridas para o simulado.
const EXAM_AMOUNTS = [5, 10, 20];

// Quantas questões existem para uma dada dificuldade ("todas" = tudo).
function countByDifficulty(diff) {
  const all = state.data.questions;
  return diff === "todas" ? all.length : all.filter((q) => q.difficulty === diff).length;
}

function openExamConfig() {
  // Garante que a quantidade padrão cabe no total disponível.
  const avail = countByDifficulty(state.examCfg.difficulty);
  if (state.examCfg.amount > avail) state.examCfg.amount = avail;
  renderExamConfig();
  showView("examconfig");
}

function renderExamConfig() {
  const diff = state.examCfg.difficulty;
  const avail = countByDifficulty(diff);

  // Chips de dificuldade
  document.querySelectorAll("#cfgDifficulty .config-chip").forEach((b) => {
    b.classList.toggle("active", b.dataset.diff === diff);
  });

  // Chips de quantidade: só mostra valores que cabem; sempre inclui "Todas (N)"
  const amountBox = document.getElementById("cfgAmount");
  amountBox.innerHTML = "";
  const amounts = EXAM_AMOUNTS.filter((n) => n < avail);
  amounts.push(avail); // opção "todas as disponíveis"
  // se a quantidade escolhida não existe mais, usa a maior possível
  if (!amounts.includes(state.examCfg.amount)) {
    state.examCfg.amount = amounts[amounts.length - 1] || 0;
  }
  amounts.forEach((n) => {
    const b = document.createElement("button");
    b.className = "config-chip" + (n === state.examCfg.amount ? " active" : "");
    b.textContent = n === avail ? `Todas (${n})` : n;
    b.onclick = () => { state.examCfg.amount = n; renderExamConfig(); };
    amountBox.appendChild(b);
  });

  document.getElementById("cfgAvail").textContent =
    avail > 0
      ? `${avail} questões disponíveis nesta dificuldade.`
      : "Nenhuma questão nesta dificuldade.";
  document.getElementById("startExamBtn").disabled = avail === 0;
}

function startQuiz(mode, topic = null) {
  state.mode = mode;
  state.quizTopic = topic;

  // Monta o pool conforme a origem:
  // - exam: usa a config (dificuldade + quantidade)
  // - quiz por tópico: filtra pelo tópico
  // - quiz geral: todas as questões
  let pool;
  if (mode === "placement") {
    pool = shuffle(state.data.questions.filter((q) => /^Nível /.test(q.topic)));
  } else if (mode === "exam") {
    const diff = state.examCfg.difficulty;
    pool = diff === "todas"
      ? state.data.questions
      : state.data.questions.filter((q) => q.difficulty === diff);
    pool = shuffle(pool).slice(0, state.examCfg.amount);
  } else {
    pool = topic
      ? state.data.questions.filter((q) => q.topic === topic)
      : state.data.questions;
    pool = shuffle(pool);
  }

  // Embaralha as alternativas de cada questão (evita decorar posição).
  state.questions = pool.map(shuffleOptions);
  state.qIndex = 0;
  state.answers = [];
  showView("quiz");

  const timerEl = document.getElementById("quizTimer");
  stopTimer();
  if (mode === "exam") {
    state.timeLeft = Math.max(
      EXAM_MIN_SECONDS,
      state.questions.length * EXAM_SECONDS_PER_Q
    );
    tickTimer();
    state.timerId = setInterval(tickTimer, 1000);
  } else {
    timerEl.textContent = "sem limite";
    timerEl.classList.remove("danger");
  }
  renderQuestion();
}

function tickTimer() {
  const el = document.getElementById("quizTimer");
  const m = Math.floor(state.timeLeft / 60);
  const s = state.timeLeft % 60;
  el.textContent = `${m}:${String(s).padStart(2, "0")}`;
  el.classList.toggle("danger", state.timeLeft <= 30);
  if (state.timeLeft <= 0) { stopTimer(); finishQuiz(); return; }
  state.timeLeft--;
}
function stopTimer() {
  if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
}

function renderQuestion() {
  const q = state.questions[state.qIndex];
  document.getElementById("quizCounter").textContent =
    (state.quizTopic ? `${state.quizTopic} · ` : "") +
    `Questão ${state.qIndex + 1} de ${state.questions.length}`;
  // Barra de progresso: proporção de questões já respondidas.
  const progress = document.getElementById("quizProgress");
  if (progress) {
    const pct = Math.round((state.qIndex / state.questions.length) * 100);
    progress.style.width = `${pct}%`;
  }
  document.getElementById("quizQuestion").innerHTML = q.question + (q.en ? " " + speakBtn(q.en) : "");
  const fb = document.getElementById("quizFeedback");
  fb.textContent = ""; fb.className = "feedback";
  document.getElementById("quizNext").style.display = "none";

  const box = document.getElementById("quizOptions");
  box.innerHTML = "";
  q.options.forEach((opt, i) => {
    const b = document.createElement("button");
    b.className = "option";
    b.innerHTML = `<span class="opt-key">${i + 1}</span>${opt}`;
    b.onclick = () => answer(i);
    box.appendChild(b);
  });
}

function answer(choice) {
  const q = state.questions[state.qIndex];
  state.answers.push({ id: q.id, choice, correct: choice === q.answer });
  const btns = [...document.querySelectorAll("#quizOptions .option")];
  btns.forEach((b, i) => {
    b.disabled = true;
    if (i === q.answer) b.classList.add("correct");
    if (i === choice && choice !== q.answer) b.classList.add("wrong");
  });

  if (state.mode === "quiz") {
    const fb = document.getElementById("quizFeedback");
    const ok = choice === q.answer;
    fb.className = "feedback " + (ok ? "ok" : "no");
    fb.innerHTML = (ok ? "✓ Correto! " : "✗ ") + q.explanation;
    document.getElementById("quizNext").style.display = "inline-block";
  } else {
    // simulado: avança sozinho
    setTimeout(nextQuestion, 350);
  }
}

function nextQuestion() {
  state.qIndex++;
  if (state.qIndex >= state.questions.length) { finishQuiz(); return; }
  renderQuestion();
}

function finishQuiz() {
  stopTimer();
  const total = state.questions.length;
  const correct = state.answers.filter((a) => a.correct).length;
  const pct = Math.round((correct / total) * 100);

  // salvar melhor pontuação (lição da trilha usa seu próprio registro, em pathFinishLesson)
  if (state.mode !== "lesson") {
    const p = loadProgress(state.levelId);
    const key = state.mode === "exam" ? "bestExam" : "bestQuiz";
    if (p[key] == null || pct > p[key]) p[key] = pct;
    saveProgress(state.levelId, p);
  } else if (typeof pathFinishLesson === "function") {
    pathFinishLesson(pct);
  }

  // render resultado
  document.getElementById("resultTitle").textContent =
    state.mode === "exam" ? "Resultado do Simulado" :
    state.mode === "placement" ? "Seu nível estimado" :
    state.mode === "lesson" ? "Resultado da lição" : "Resultado do Quiz";
  document.getElementById("resultScore").textContent = `${pct}%`;
  document.getElementById("resultScore").style.color =
    pct >= 70 ? "#6ee787" : "#ff8f8f";
  document.getElementById("resultMsg").textContent =
    state.mode === "lesson"
      ? `${correct} de ${total} corretas. ` + (pct >= 80 ? "Lição concluída! Próxima lição liberada. 🎉" : "Precisa de 80% para concluir a lição. Tente de novo.")
      : `${correct} de ${total} corretas. ` + (pct >= 70 ? "Aprovado no critério de 70%! 🎉" : "Abaixo de 70%, revise os erros e tente de novo.");

  // Guarda as questões erradas (objetos originais do banco) para "refazer só os erros".
  // No modo lição, o pool já está em state.questions (não depende de state.data do módulo ativo).
  const wrongIds = new Set(state.answers.filter((a) => !a.correct).map((a) => a.id));
  const bank = state.mode === "lesson" ? state.questions : state.data.questions;
  state.wrongQuestions = bank.filter((q) => wrongIds.has(q.id));

  const review = document.getElementById("resultReview");
  review.innerHTML = "";
  state.answers.forEach((a) => {
    if (a.correct) return;
    const q = state.questions.find((x) => x.id === a.id);
    const div = document.createElement("div");
    div.className = "review-item";
    div.innerHTML =
      `<div class="q">${q.question}</div>` +
      `<div class="yours">Sua resposta: ${q.options[a.choice]}</div>` +
      `<div class="a">Correta: ${q.options[q.answer]}</div>` +
      `<div class="muted" style="margin-top:6px">${q.explanation}</div>`;
    review.appendChild(div);
  });
  if (!review.innerHTML) {
    review.innerHTML = "<div class='review-item a'>Perfeito, nenhum erro! 💯</div>";
  }

  // Botão "refazer só os erros" só faz sentido se houve erros.
  const retryBtn = document.getElementById("retryWrongBtn");
  if (retryBtn) retryBtn.style.display = state.wrongQuestions.length ? "inline-block" : "none";

  if (state.mode === "placement") renderPlacement(review);
  // Registra a tentativa no histórico.
  recordAttempt(state.mode, pct, total);

  renderHome();
  showView("result");
}

// Teste de nível: acerto por seção e nível estimado (maior seção com 75% ou mais).
function renderPlacement(review) {
  const per = {};
  state.answers.forEach((a) => {
    const q = state.questions.find((x) => x.id === a.id);
    if (!q) return;
    const s = (per[q.topic] = per[q.topic] || { ok: 0, n: 0 });
    s.n++;
    if (a.correct) s.ok++;
  });
  const names = Object.keys(per).sort();
  let level = null;
  const rows = names.map((t) => {
    const pct = Math.round((per[t].ok / per[t].n) * 100);
    if (pct >= 75) level = t.replace("Nível ", "");
    return `<div class="review-item ${pct >= 75 ? "a" : ""}"><b>${t}</b>: ${per[t].ok}/${per[t].n} (${pct}%) ${pct >= 75 ? "✓" : ""}</div>`;
  });
  const head = level
    ? `<div class="review-item a"><b>Nível estimado: ${level}</b>. Estude o módulo ${level} (revise) ou o próximo, e refaça o teste em 2 a 4 semanas.</div>`
    : `<div class="review-item"><b>Nível estimado: abaixo de A1.</b> Comece pelo módulo A1.</div>`;
  const note = `<div class="review-item muted">O teste mede gramática e vocabulário. Não mede escuta nem fala.</div>`;
  review.innerHTML = head + rows.join("") + note + review.innerHTML;
  document.getElementById("resultMsg").textContent =
    level ? `Maior seção com 75% ou mais: ${level}.` : "Nenhuma seção chegou a 75%.";
}
// Refaz um quiz apenas com as questões que o usuário errou na tentativa anterior.
function retryWrong() {
  if (!state.wrongQuestions || !state.wrongQuestions.length) return;
  state.mode = "quiz";          // revisão sempre com feedback
  state.quizTopic = null;
  state.questions = shuffle(state.wrongQuestions).map(shuffleOptions);
  state.qIndex = 0;
  state.answers = [];
  stopTimer();
  document.getElementById("quizTimer").textContent = "revisão";
  document.getElementById("quizTimer").classList.remove("danger");
  showView("quiz");
  renderQuestion();
}

// ---------- Events ----------
function bindEvents() {
  const pb = document.getElementById("placementBtn");
  if (pb) pb.onclick = () => startQuiz("placement");
  document.querySelectorAll(".mode-card").forEach((c) => {
    c.onclick = () => {
      const mode = c.dataset.mode;
      if (mode === "study") openStudy("resumo");
      else if (mode === "study-deep") openStudy("deep");
      else if (mode === "flashcards") openFlashcards();
      else if (mode === "quiz") startQuiz("quiz");
      else if (mode === "exam") openExamConfig();
      else if (mode === "terminal") openTerminal();
      else if (mode === "audio") openAudio();
      else if (mode === "placement") startQuiz("placement");
    };
  });
  document.querySelectorAll("[data-back]").forEach((b) => {
    b.onclick = () => {
      // Confirma antes de abandonar um simulado em andamento (perde o progresso).
      const quizActive = document.getElementById("view-quiz").classList.contains("active");
      if (quizActive && state.mode === "exam") {
        if (!confirm("Sair do simulado? Seu progresso nesta tentativa será perdido.")) return;
      }
      stopTimer();
      // Lição da trilha: voltar sempre leva para a lição (ou a própria trilha, se vier de lá).
      if (state.mode === "lesson" && (quizActive || document.getElementById("view-result").classList.contains("active"))) {
        state.mode = null;
        if (path.lesson) { pathOpenLesson(path.lesson.levelId, path.lesson.title); return; }
      }
      renderHome();
      showView("home");
    };
  });
  // Voltar dos flashcards vai para o seletor de tópico (não direto pra home).
  document.querySelectorAll("[data-back-flash]").forEach((b) => {
    b.onclick = () => { renderFlashTopics(); showView("flashtopics"); };
  });

  // flashcards
  document.getElementById("flashcard").onclick = () =>
    document.getElementById("flashcard").classList.toggle("flipped");
  document.getElementById("flashHit").onclick = () => markFlashcard(true);
  document.getElementById("flashMiss").onclick = () => markFlashcard(false);
  document.getElementById("flashNext").onclick = nextFlashcard;
  document.getElementById("flashPrev").onclick = prevFlashcard;

  // quiz
  document.getElementById("quizNext").onclick = nextQuestion;
  document.getElementById("retryWrongBtn").onclick = retryWrong;

  // config do simulado
  document.querySelectorAll("#cfgDifficulty .config-chip").forEach((b) => {
    b.onclick = () => {
      state.examCfg.difficulty = b.dataset.diff;
      renderExamConfig();  // recalcula quantidades disponíveis
    };
  });
  document.getElementById("startExamBtn").onclick = () => startQuiz("exam");

  // limpar histórico
  document.getElementById("clearHistory").onclick = () => {
    const p = loadProgress(state.levelId);
    delete p.history;
    saveProgress(state.levelId, p);
    renderHome();
  };

  // reset
  document.getElementById("resetProgress").onclick = () => {
    if (confirm("Zerar todo o progresso deste nível?")) {
      localStorage.removeItem(storeKey(state.levelId));
      renderHome();
    }
  };

  // atalhos de teclado
  document.addEventListener("keydown", handleKeydown);
}

// Roteia atalhos conforme a view ativa.
function handleKeydown(e) {
  const quizActive = document.getElementById("view-quiz").classList.contains("active");
  const flashActive = document.getElementById("view-flashcards").classList.contains("active");

  if (quizActive) {
    // 1-4 respondem a questão (se ainda não foi respondida)
    if (["1", "2", "3", "4"].includes(e.key)) {
      const opts = [...document.querySelectorAll("#quizOptions .option")];
      const i = Number(e.key) - 1;
      if (opts[i] && !opts[i].disabled) { e.preventDefault(); opts[i].click(); }
      return;
    }
    // Enter ou N avançam, quando o botão Próxima está visível (modo quiz)
    if (e.key === "Enter" || e.key.toLowerCase() === "n") {
      const next = document.getElementById("quizNext");
      if (next && next.style.display !== "none") { e.preventDefault(); next.click(); }
      return;
    }
  }

  if (flashActive) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      document.getElementById("flashcard").classList.toggle("flipped");
    } else if (e.key === "ArrowRight") {
      e.preventDefault(); nextFlashcard();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault(); prevFlashcard();
    } else if (e.key.toLowerCase() === "a") {
      e.preventDefault(); markFlashcard(true);
    } else if (e.key.toLowerCase() === "e") {
      e.preventDefault(); markFlashcard(false);
    }
  }
}

// ---------- PWA: registra o service worker (cache offline) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => { /* sem suporte, segue sem offline */ });
  });
}

// ---------- Init ----------
bindEvents();
renderLevelNav();
// Pré-carrega o módulo A1 em segundo plano (para "Praticar" já ter dados),
// mas a tela inicial é a Trilha, não a Home de um módulo específico.
selectLevel("a1").then(() => { showView("path"); if (typeof openPath === "function") openPath(); });
