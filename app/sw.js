// ===== Service Worker: cache offline do English Path =====
// Estratégia: "cache primeiro, rede como reforço". Depois da primeira visita
// com internet, o app abre e funciona mesmo sem conexão (dados ficam no celular).
const CACHE_NAME = "english-path-v1";
const CORE_FILES = [
  "./", "./index.html", "./style.css", "./terminal.css", "./path.css",
  "./app.js", "./path.js", "./speak.js", "./terminal.js", "./audio.js", "./mobilenav.js",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png",
];
const DATA_FILES = [
  "test", "a1", "a2", "b1", "b2", "c1", "us", "phr", "tips",
].flatMap((id) => [
  `./data/${id}.json`, `./data/${id}-study.json`, `./data/${id}-deep.json`, `./data/${id}-terminal.json`,
]).concat([
  "./data/daily-tips.json", "./data/phr-extra.json", "./data/phr-sections-extra.json", "./data/phr-terminal-extra.json",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cada arquivo é buscado individualmente: um 404 isolado (arquivo opcional que não existe)
      // não deve impedir a instalação do restante do cache.
      Promise.all(
        CORE_FILES.concat(DATA_FILES).map((url) =>
          cache.add(url).catch(() => { /* arquivo opcional ausente, ignora */ })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return resp;
        })
        .catch(() => cached); // sem rede: usa o que estiver em cache
      return cached || network;
    })
  );
});
