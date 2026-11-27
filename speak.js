// ===== Áudio (Web Speech API) e Dica do dia =====
// speakBtn(texto)  -> HTML com botões 🔊 (normal) e 🐢 (devagar)
// renderSay(itens) -> lista de frases "EN | PT" com áudio
// renderTip()      -> sorteia uma dica de data/tips.json na Home

function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pickVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "en-US" && /natural|google|samantha|aria|jenny|zira/i.test(v.name)) ||
    voices.find((v) => v.lang === "en-US") ||
    voices.find((v) => v.lang && v.lang.startsWith("en")) ||
    null
  );
}

function speak(text, rate = 1) {
  if (!("speechSynthesis" in window) || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = Number(rate) || 1;
  const v = pickVoice();
  if (v) u.voice = v;
  synth.speak(u);
}

function speakBtn(text) {
  if (!text) return "";
  const t = encodeURIComponent(text);
  return (
    `<button type="button" class="speak" data-say="${t}" title="Ouvir" aria-label="Ouvir">🔊</button>` +
    `<button type="button" class="speak slow" data-say="${t}" data-rate="0.65" title="Ouvir devagar" aria-label="Ouvir devagar">🐢</button>`
  );
}

// Pronúncia "como se lê em português", sílaba tônica em MAIÚSCULA.
// renderPron("UÓ-ter") -> span pequeno, cinza, entre aspas tipográficas.
function renderPron(syl) {
  if (!syl) return "";
  return ` <span class="pron" title="Pronúncia aproximada (não é IPA)">“${escHtml(syl)}”</span>`;
}

// items: ["I'm hungry. | Estou com fome.", ...] ou
//        ["I'm hungry. | Estou com fome. | AIM RÂN-gri", ...] (3º campo = pronúncia aproximada)
function renderSay(items) {
  return (
    '<ul class="say">' +
    items
      .map((raw) => {
        const [en, pt, syl] = String(raw).split("|").map((x) => x.trim());
        return `<li>${speakBtn(en)}<span class="en">${escHtml(en)}</span>` +
          renderPron(syl) +
          (pt ? `<span class="pt"> — ${escHtml(pt)}</span>` : "") + "</li>";
      })
      .join("") +
    "</ul>"
  );
}

// ---- Contrações (usado no ditado, na pronúncia e no modo de escrita) ----
const _CONTR = {
  "i'm": "i am", "you're": "you are", "he's": "he is", "she's": "she is", "it's": "it is", "we're": "we are", "they're": "they are",
  "i've": "i have", "you've": "you have", "we've": "we have", "they've": "they have",
  "i'll": "i will", "you'll": "you will", "he'll": "he will", "she'll": "she will", "we'll": "we will", "they'll": "they will",
  "i'd": "i would", "you'd": "you would", "he'd": "he would", "she'd": "she would", "we'd": "we would", "they'd": "they would",
  "don't": "do not", "doesn't": "does not", "didn't": "did not", "can't": "can not", "cannot": "can not", "won't": "will not",
  "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not", "haven't": "have not", "hasn't": "has not",
  "hadn't": "had not", "wouldn't": "would not", "couldn't": "could not", "shouldn't": "should not", "mustn't": "must not",
  "let's": "let us", "that's": "that is", "what's": "what is", "there's": "there is", "here's": "here is", "who's": "who is",
  "dunno": "do not know", "gonna": "going to", "wanna": "want to", "gotta": "got to", "kinda": "kind of", "lemme": "let me", "gimme": "give me"
};
const _CONTR_REV = (() => {
  const r = {};
  Object.entries(_CONTR).forEach(([k, v]) => { if (!/^(cannot|gonna|wanna|gotta|kinda|lemme|gimme|can't)$/.test(k)) r[v] = k; });
  return r;
})();
const _CONTR_RE = new RegExp("(?<![a-z'])(" + Object.keys(_CONTR).map((k) => k.replace(/'/g, "'")).join("|") + ")(?![a-z'])", "gi");
const _CONTR_REV_RE = new RegExp("(?<![a-z'])(" + Object.keys(_CONTR_REV).sort((a, b) => b.length - a.length).join("|") + ")(?![a-z'])", "gi");
function expandContractions(s) {
  return String(s).replace(/[\u2018\u2019]/g, "'").replace(_CONTR_RE, (m) => _CONTR[m.toLowerCase()]);
}
function contractWords(s) {
  return String(s).replace(/[\u2018\u2019]/g, "'").replace(_CONTR_REV_RE, (m) => _CONTR_REV[m.toLowerCase()]);
}
// Clique em qualquer botão com data-say (captura: não vira o flashcard).
document.addEventListener(
  "click",
  (e) => {
    const b = e.target.closest && e.target.closest("[data-say]");
    if (!b) return;
    e.stopPropagation();
    e.preventDefault();
    speak(decodeURIComponent(b.dataset.say), b.dataset.rate || 1);
  },
  true
);

// Garante que a lista de vozes carregue (alguns navegadores carregam depois).
if ("speechSynthesis" in window) window.speechSynthesis.getVoices();

// ---- Dica do dia ----
let _tips = null;
async function renderTip(force) {
  const card = document.getElementById("tipCard");
  if (!card) return;
  if (!_tips) {
    try {
      const r = await fetch("data/daily-tips.json");
      _tips = r.ok ? await r.json() : [];
    } catch { _tips = []; }
  }
  if (!_tips.length) { card.style.display = "none"; return; }
  const t = _tips[Math.floor(Math.random() * _tips.length)];
  document.getElementById("tipText").innerHTML =
    (t.en ? `<span class="en">${escHtml(t.en)}</span>${renderPron(t.syl)} ${speakBtn(t.en)}<br>` : "") + t.pt;
  card.style.display = "flex";
}
const _tipBtn = document.getElementById("tipNext");
if (_tipBtn) _tipBtn.onclick = () => renderTip(true);

