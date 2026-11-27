// ===== Trilha (estilo Duolingo): mapa de lições, XP e streak =====
// Cada seção de estudo dos módulos A1 a C1 vira uma "lição".
// Lição N só libera depois que a N-1 for concluída com >=80% no mini-quiz.
// Progresso salvo em localStorage, separado do progresso "livre" por módulo.
const PATH_LEVELS = ["a1", "a2", "b1", "b2", "c1"];
const PATH_PASS_PCT = 80;
const PATH_KEY = "english-study:path";
const path = { cache: null, lesson: null }; // cache: { levels: [{id,label,sections:[title,...]}] }

function pathLoad() {
  try { return JSON.parse(localStorage.getItem(PATH_KEY)) || {}; } catch { return {}; }
}
function pathSave(p) { localStorage.setItem(PATH_KEY, JSON.stringify(p)); }

// Lição concluída = pct >= PATH_PASS_PCT registrado para "<levelId>::<secTitle>".
function pathIsDone(p, levelId, secTitle) {
  const rec = p.done && p.done[levelId + "::" + secTitle];
  return !!(rec && rec.pct >= PATH_PASS_PCT);
}
function pathBestPct(p, levelId, secTitle) {
  const rec = p.done && p.done[levelId + "::" + secTitle];
  return rec ? rec.pct : null;
}

// Carrega os títulos de seção de cada nível A1-C1 (usa -deep.json, cacheado).
async function pathLoadLevels() {
  if (path.cache) return path.cache;
  const levels = [];
  for (const id of PATH_LEVELS) {
    const lvl = LEVELS.find((l) => l.id === id);
    let sections = [];
    try {
      const r = await fetch(`data/${id}-deep.json`);
      if (r.ok) sections = ((await r.json()).sections || []).map((s) => s.title);
    } catch { /* sem material */ }
    levels.push({ id, label: lvl ? lvl.label : id, sections });
  }
  path.cache = levels;
  return levels;
}

// Primeira lição ainda não concluída, na ordem da trilha (próxima a fazer).
function pathNextLesson(levels, p) {
  for (const lvl of levels) {
    for (const sec of lvl.sections) {
      if (!pathIsDone(p, lvl.id, sec)) return { levelId: lvl.id, label: lvl.label, title: sec };
    }
  }
  return null; // trilha completa
}

// Uma lição está desbloqueada se todas as anteriores (na ordem global) já foram concluídas.
function pathIsUnlocked(levels, p, levelId, secTitle) {
  for (const lvl of levels) {
    for (const sec of lvl.sections) {
      if (lvl.id === levelId && sec === secTitle) return true;
      if (!pathIsDone(p, lvl.id, sec)) return false;
    }
  }
  return true;
}

// ---- XP e streak ----
function pathToday() { return new Date().toISOString().slice(0, 10); }
function pathAddXp(p, amount) {
  p.xp = (p.xp || 0) + amount;
  const today = pathToday();
  if (p.lastDay !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    p.streak = p.lastDay === yesterday ? (p.streak || 0) + 1 : 1;
    p.lastDay = today;
  }
  pathSave(p);
}
function pathMarkDone(levelId, secTitle, pct) {
  const p = pathLoad();
  p.done = p.done || {};
  const key = levelId + "::" + secTitle;
  const already = p.done[key] && p.done[key].pct >= PATH_PASS_PCT;
  p.done[key] = { pct: Math.max(pct, (p.done[key] || {}).pct || 0) };
  if (pct >= PATH_PASS_PCT && !already) pathAddXp(p, 20);
  else pathSave(p);
  return p;
}

// ---- Tela do mapa ----
async function openPath() {
  showView("path");
  const box = document.getElementById("pathMap");
  box.innerHTML = "<p class='muted'>Carregando trilha...</p>";
  const levels = await pathLoadLevels();
  const p = pathLoad();
  document.getElementById("pathXp").textContent = `⭐ ${p.xp || 0} XP`;
  document.getElementById("pathStreak").textContent = `🔥 ${p.streak || 0} dia${(p.streak || 0) === 1 ? "" : "s"}`;
  const xpTop = document.getElementById("pathXpTop"), streakTop = document.getElementById("pathStreakTop");
  if (xpTop) xpTop.textContent = `⭐ ${p.xp || 0} XP`;
  if (streakTop) streakTop.textContent = `🔥 ${p.streak || 0}`;

  let html = "";
  let doneCount = 0, totalCount = 0;
  for (const lvl of levels) {
    html += `<div class="path-group"><h3 class="path-group-title">${lvl.label}</h3><div class="path-nodes">`;
    lvl.sections.forEach((sec, i) => {
      totalCount++;
      const done = pathIsDone(p, lvl.id, sec);
      if (done) doneCount++;
      const unlocked = pathIsUnlocked(levels, p, lvl.id, sec);
      const pct = pathBestPct(p, lvl.id, sec);
      const cls = done ? "done" : unlocked ? "current" : "locked";
      const icon = done ? "✓" : unlocked ? "▶" : "🔒";
      html += `<button class="path-node ${cls}" data-level="${lvl.id}" data-title="${encodeURIComponent(sec)}" ${unlocked ? "" : "disabled"}>` +
        `<span class="path-node-icon">${icon}</span><span class="path-node-label">${sec}</span>` +
        (pct != null ? `<span class="path-node-pct">${pct}%</span>` : "") +
        `</button>`;
    });
    html += `</div></div>`;
  }
  box.innerHTML = html;
  document.getElementById("pathProgressText").textContent = `${doneCount}/${totalCount} lições concluídas`;
  document.getElementById("pathProgressBar").style.width = totalCount ? `${Math.round((doneCount / totalCount) * 100)}%` : "0%";

  box.querySelectorAll(".path-node:not(.locked)").forEach((btn) => {
    btn.onclick = () => pathOpenLesson(btn.dataset.level, decodeURIComponent(btn.dataset.title));
  });
}

// Abre a tela de "lição": resumo curto da seção + botão para o mini-quiz.
async function pathOpenLesson(levelId, title) {
  path.lesson = { levelId, title };
  showView("lesson");
  const box = document.getElementById("lessonBody");
  box.innerHTML = "<p class='muted'>Carregando...</p>";
  document.getElementById("lessonTitle").textContent = title;
  let study = null, questions = [];
  try {
    const r = await fetch(`data/${levelId}-study.json`);
    if (r.ok) study = await r.json();
  } catch { /* ignore */ }
  try {
    const r = await fetch(`data/${levelId}.json`);
    if (r.ok) questions = ((await r.json()).questions || []).filter((q) => q.topic === title);
  } catch { /* ignore */ }
  const sec = study && study.sections.find((s) => s.title === title);
  let html = "";
  if (sec) {
    sec.blocks.forEach((b) => {
      if (b.h) html += `<h3>${b.h}</h3>`;
      if (b.p) html += `<p>${b.p}</p>`;
      if (b.list) html += "<ul>" + b.list.map((i) => `<li>${i}</li>`).join("") + "</ul>";
      if (b.say && typeof renderSay === "function") html += renderSay(b.say);
    });
  } else {
    html = "<p class='muted'>Resumo não encontrado para esta lição.</p>";
  }
  box.innerHTML = html;
  const btn = document.getElementById("lessonStartQuiz");
  btn.textContent = questions.length ? `Fazer o mini-quiz (${Math.min(questions.length, 5)} perguntas)` : "Esta lição não tem quiz";
  btn.disabled = !questions.length;
  btn.onclick = () => pathStartLessonQuiz(levelId, title, questions);
}

function pathStartLessonQuiz(levelId, title, questions) {
  state.mode = "lesson";
  state.quizTopic = title;
  // Não troca state.levelId: o progresso da lição é salvo em PATH_KEY, não no progresso do módulo.
  state.questions = shuffle(questions).slice(0, 5).map(shuffleOptions);
  state.qIndex = 0;
  state.answers = [];
  showView("quiz");
  const timerEl = document.getElementById("quizTimer");
  stopTimer();
  timerEl.textContent = "sem limite";
  timerEl.classList.remove("danger");
  renderQuestion();
}

// Chamado por finishQuiz() em app.js quando state.mode === "lesson".
function pathFinishLesson(pct) {
  pathMarkDone(path.lesson.levelId, path.lesson.title, pct);
  const back = document.getElementById("pathBackBtn");
  if (back) back.style.display = "inline-block";
}
