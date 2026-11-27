// ===== Escutar e falar: ouvir e escolher, ditado e pronúncia =====
// Usa globals: state, showView, loadProgress, saveProgress, shuffle, speak, speakBtn, escHtml, expandContractions.
// Fonte das frases: blocos "say" de data/<id>-study.json e <id>-deep.json (EN | PT)
// e campo "en" dos flashcards e questões.
const aud = { tab: "pick", all: [], pt: [], cur: null, ok: 0, n: 0, done: false, rec: null, listening: false };
const $a = (id) => document.getElementById(id);
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

function audTok(s) {
  const t = String(s).toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9' ]+/g, " ");
  return expandContractions(t).split(/\s+/).filter(Boolean);
}
// Compara palavra a palavra (maior subsequência comum).
function audDiff(expected, said) {
  const e = audTok(expected), g = audTok(said);
  const dp = Array.from({ length: e.length + 1 }, () => new Array(g.length + 1).fill(0));
  for (let i = e.length - 1; i >= 0; i--)
    for (let j = g.length - 1; j >= 0; j--)
      dp[i][j] = e[i] === g[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const m = new Array(e.length).fill(false);
  let i = 0, j = 0;
  while (i < e.length && j < g.length) {
    if (e[i] === g[j]) { m[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const hit = m.filter(Boolean).length;
  return { e, m, hit, extra: g.length - hit, score: e.length ? hit / e.length : 0 };
}
function audDiffHtml(d) {
  return d.e.map((w, i) => `<span class="${d.m[i] ? "w-ok" : "w-no"}">${escHtml(w)}</span>`).join(" ");
}
function audPerfect(d) { return d.e.length > 0 && d.hit === d.e.length && d.extra === 0; }

async function audLoad() {
  const id = state.levelId;
  const seen = new Set();
  aud.all = []; aud.pt = [];
  const add = (en, pt) => {
    en = String(en || "").replace(/<[^>]+>/g, "").trim();
    if (!en || en.split(/\s+/).length < 2) return;
    const k = en.toLowerCase();
    if (seen.has(k)) {
      if (pt) { const it = aud.all.find((x) => x.en.toLowerCase() === k); if (it && !it.pt) it.pt = pt; }
      return;
    }
    seen.add(k);
    aud.all.push({ en, pt: pt || "" });
  };
  const scan = (data) => (data.sections || []).forEach((s) => (s.blocks || []).forEach((b) =>
    (b.say || []).forEach((raw) => { const [en, pt] = String(raw).split("|").map((x) => x.trim()); add(en, pt); })));
  for (const f of ["study", "deep"]) {
    try { const r = await fetch(`data/${id}-${f}.json`); if (r.ok) scan(await r.json()); } catch { /* sem arquivo */ }
  }
  (state.data.flashcards || []).forEach((c) => add(c.en, ""));
  (state.data.questions || []).forEach((q) => add(q.en, ""));
  aud.pt = aud.all.filter((x) => x.pt);
}
async function openAudio() {
  showView("audio");
  aud.ok = 0; aud.n = 0;
  $a("audCard").innerHTML = "<p class='muted'>Carregando frases...</p>";
  await audLoad();
  const st = (loadProgress(state.levelId).audStats) || {};
  const bits = ["pick", "dict", "speak"].filter((k) => st[k]).map((k) =>
    ({ pick: "escolher", dict: "ditado", speak: "falar" }[k]) + ` ${st[k][0]}/${st[k][1]}`);
  $a("audInfo").textContent = `${state.data.name} · ${aud.all.length} frases` + (bits.length ? ` · acertos acumulados: ${bits.join(" · ")}` : "");
  audTab(aud.tab);
}
function audSave(ok) {
  const p = loadProgress(state.levelId);
  p.audStats = p.audStats || {};
  const s = (p.audStats[aud.tab] = p.audStats[aud.tab] || [0, 0]);
  s[1]++; if (ok) s[0]++;
  saveProgress(state.levelId, p);
}
function audTab(tab) {
  aud.tab = tab; aud.ok = 0; aud.n = 0;
  if (aud.rec) { try { aud.rec.abort(); } catch { /* nada */ } }
  document.querySelectorAll("#audTabs [data-aud]").forEach((b) => b.classList.toggle("active", b.dataset.aud === tab));
  audNext();
}
function audScore() { return `<div class="aud-score">Nesta sessão: ${aud.ok}/${aud.n}</div>`; }
function audNext() {
  aud.done = false;
  const pool = aud.tab === "pick" ? aud.pt : aud.all;
  const need = aud.tab === "pick" ? 4 : 1;
  if (pool.length < need) {
    $a("audCard").innerHTML = "<p class='muted'>Este módulo ainda não tem frases suficientes para este exercício.</p>";
    return;
  }
  let nxt;
  do { nxt = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && aud.cur === nxt);
  aud.cur = nxt;
  if (aud.tab === "pick") audPick();
  else if (aud.tab === "dict") audDict();
  else audSpeak();
}
function audNextBtn() { return `<button class="btn" id="audNextBtn">Próxima</button>`; }
// ---- 1) Ouvir e escolher ----
function audPick() {
  const c = aud.cur;
  const wrong = shuffle(aud.pt.filter((x) => x.pt !== c.pt)).slice(0, 3);
  const opts = shuffle([c, ...wrong]);
  $a("audCard").innerHTML =
    `<p>Ouça e escolha o <b>significado</b>:</p><div class="aud-play">${speakBtn(c.en)}</div>` +
    `<div class="options" id="audOpts">` +
    opts.map((o, i) => `<button class="option" data-i="${i}"><span class="opt-key">${i + 1}</span>${escHtml(o.pt)}</button>`).join("") +
    `</div><div class="feedback" id="audFb"></div><div id="audAct"></div>${audScore()}`;
  const btns = [...document.querySelectorAll("#audOpts .option")];
  btns.forEach((b, i) => (b.onclick = () => {
    if (aud.done) return;
    aud.done = true; aud.n++;
    const ok = opts[i] === c;
    if (ok) aud.ok++;
    audSave(ok);
    btns.forEach((x, k) => { x.disabled = true; if (opts[k] === c) x.classList.add("correct"); });
    if (!ok) b.classList.add("wrong");
    $a("audFb").className = "feedback " + (ok ? "ok" : "no");
    $a("audFb").innerHTML = (ok ? "✓ " : "✗ ") + `<span class="en">${escHtml(c.en)}</span> — ${escHtml(c.pt)}`;
    $a("audAct").innerHTML = audNextBtn();
    $a("audNextBtn").onclick = audNext;
  }));
  speak(c.en, 1);
}
// ---- 2) Ditado ----
function audDict() {
  const c = aud.cur;
  $a("audCard").innerHTML =
    `<p>Ouça e <b>escreva</b> o que ouviu (em inglês):</p><div class="aud-play">${speakBtn(c.en)}</div>` +
    `<form id="audForm" class="aud-form"><input id="audInput" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="O que você ouviu" />` +
    `<button class="btn small" type="submit">Verificar</button><button class="btn small ghost" type="button" id="audShow">Mostrar</button></form>` +
    `<div class="feedback" id="audFb"></div><div id="audAct"></div>${audScore()}`;
  const finish = (given) => {
    if (aud.done) return;
    aud.done = true;
    let ok = false, html;
    if (given == null) {
      html = `Resposta: <span class="en">${escHtml(c.en)}</span>`;
    } else {
      aud.n++;
      const d = audDiff(c.en, given);
      ok = audPerfect(d);
      if (ok) aud.ok++;
      audSave(ok);
      html = (ok ? "✓ Perfeito! " : `✗ Acertou ${d.hit} de ${d.e.length} palavras. `) +
        `<div class="aud-diff">${audDiffHtml(d)}</div>Frase: <span class="en">${escHtml(c.en)}</span>` +
        (c.pt ? ` — ${escHtml(c.pt)}` : "");
    }
    $a("audFb").className = "feedback " + (ok ? "ok" : "no");
    $a("audFb").innerHTML = html;
    $a("audAct").innerHTML = audNextBtn();
    $a("audNextBtn").onclick = audNext;
    $a("audNextBtn").focus();
  };
  $a("audForm").onsubmit = (e) => { e.preventDefault(); const v = $a("audInput").value.trim(); if (v) finish(v); };
  $a("audShow").onclick = () => finish(null);
  $a("audInput").focus();
  speak(c.en, 1);
}
// ---- 3) Falar (reconhecimento de voz) ----
function audSpeak() {
  const c = aud.cur;
  const supported = !!SpeechRec;
  $a("audCard").innerHTML =
    `<p>Leia em voz alta:</p><div class="aud-phrase"><span class="en">${escHtml(c.en)}</span> ${speakBtn(c.en)}</div>` +
    (c.pt ? `<p class="muted">${escHtml(c.pt)}</p>` : "") +
    (supported
      ? `<button class="btn" id="audMic">🎤 Falar</button> <button class="btn small ghost" id="audSkip">Pular</button>`
      : `<p class="feedback no">Este navegador não tem reconhecimento de voz. Use Chrome ou Edge para este exercício.</p>` +
        `<button class="btn small ghost" id="audSkip">Pular</button>`) +
    `<div class="feedback" id="audFb"></div><div id="audAct"></div>${audScore()}` +
    `<p class="kbd-hint">O navegador envia o áudio para um serviço online de reconhecimento. Permita o microfone quando ele pedir.</p>`;
  $a("audSkip").onclick = audNext;
  if (!supported) return;
  $a("audMic").onclick = () => {
    if (aud.listening) return;
    const rec = new SpeechRec();
    aud.rec = rec;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    aud.listening = true;
    $a("audMic").textContent = "🎤 Ouvindo...";
    $a("audFb").className = "feedback"; $a("audFb").textContent = "";
    let got = false;
    rec.onresult = (ev) => {
      got = true;
      const alts = [...ev.results[0]].map((a) => a.transcript);
      let best = null;
      alts.forEach((t) => { const d = audDiff(c.en, t); if (!best || d.hit - d.extra > best.d.hit - best.d.extra) best = { t, d }; });
      aud.n++;
      const ok = best.d.score >= 0.8 && best.d.extra <= 1;
      if (ok) aud.ok++;
      audSave(ok);
      $a("audFb").className = "feedback " + (ok ? "ok" : "no");
      $a("audFb").innerHTML =
        (ok ? "✓ Muito bom! " : "✗ Quase. Tente de novo ou veja as palavras que faltaram. ") +
        `${Math.round(best.d.score * 100)}% das palavras.<div class="aud-diff">${audDiffHtml(best.d)}</div>` +
        `Entendi: <i>${escHtml(best.t)}</i>`;
      $a("audAct").innerHTML = audNextBtn();
      $a("audNextBtn").onclick = audNext;
    };
    rec.onerror = (ev) => {
      got = true;
      const msg = { "not-allowed": "Permita o uso do microfone no navegador.", "no-speech": "Não ouvi nada. Tente de novo.",
        "network": "O reconhecimento de voz precisa de internet.", "audio-capture": "Nenhum microfone encontrado." }[ev.error] || `Erro: ${ev.error}`;
      $a("audFb").className = "feedback no";
      $a("audFb").textContent = msg;
    };
    rec.onend = () => {
      aud.listening = false;
      const mic = $a("audMic");
      if (mic) mic.textContent = "🎤 Falar";
      if (!got && $a("audFb")) { $a("audFb").className = "feedback no"; $a("audFb").textContent = "Não ouvi nada. Tente de novo."; }
    };
    try { rec.start(); } catch { aud.listening = false; }
  };
}
document.querySelectorAll("#audTabs [data-aud]").forEach((b) => (b.onclick = () => audTab(b.dataset.aud)));
document.addEventListener("keydown", (e) => {
  if (!$a("view-audio").classList.contains("active")) return;
  if (aud.tab === "pick" && /^[1-4]$/.test(e.key)) {
    const b = document.querySelectorAll("#audOpts .option")[Number(e.key) - 1];
    if (b) b.click();
  } else if (e.key === "Enter" && aud.done && $a("audNextBtn")) {
    $a("audNextBtn").click();
  }
});
