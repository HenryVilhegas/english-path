# English Path

[![Deploy to GitHub Pages](https://github.com/HenryVilhegas/english-path/actions/workflows/pages.yml/badge.svg)](https://github.com/HenryVilhegas/english-path/actions/workflows/pages.yml)
[![CodeQL](https://github.com/HenryVilhegas/english-path/actions/workflows/codeql.yml/badge.svg)](https://github.com/HenryVilhegas/english-path/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

App de estudo de inglês com trilha gamificada (estilo Duolingo), A1 a C1 + inglês de rua dos EUA, phrasal verbs e dicas de imersão. Explicações em português, frases em inglês com áudio. PWA instalável, funciona offline depois da primeira visita.

**App publicado:** https://henryvilhegas.github.io/english-path/

## Como usar
- **Direto no navegador**: acesse o link acima (celular ou computador).
- **Instalar no Android (Chrome)**: abra o link, toque nos três pontinhos → "Adicionar à tela inicial" ou "Instalar app".
- **Rodar localmente**: dê dois cliques em `iniciar.bat` e acesse `http://localhost:8007` (requer Python instalado).

## A trilha
Uma sequência de lições, uma por tópico gramatical, de A1 a C1. Cada lição libera a próxima só depois de um mini-quiz com 80% ou mais de acerto. XP e sequência de dias (streak) ficam salvos no dispositivo. Os módulos **🗽 Inglês de Rua**, **🔀 Phrasal Verbs e Idioms** e **💡 Dicas para Imersão** não entram na trilha obrigatória — ficam livres, acessíveis pelo menu "Mais".

## Módulos
- **0 · Teste de Nível**: quiz por seção. Seu nível é a maior seção com 75% ou mais de acertos.
- **A1, A2, B1, B2, C1**: gramática, vocabulário e frases por nível, organizados em trilha.
- **🗽 Inglês de Rua EUA**: gonna/wanna, gírias, small talk, pedidos, texting, falsos cognatos.
- **🔀 Phrasal Verbs e Idioms**: 9 seções — os essenciais, trabalho/viagem, idioms, get/take/make/do, preposições, e phrasal verbs organizados por partícula (up, out, on/off) com um guia definitivo de separáveis x inseparáveis.
- **💡 Dicas para Imersão**: pares mínimos (sons que o brasileiro confunde, como ship/sheep e three/tree), números/datas/horas falados como americano fala de verdade, e entonação de pergunta x afirmação.

Cada módulo tem: Estudar resumo, Estudar a fundo, Flashcards, Quiz, **Escutar e falar**, **Escrever em inglês** e Simulado.

## Recursos
- **Descobrir meu nível** (módulo 0): 60 questões (12 por nível, A1 a C1), sem feedback durante a prova. Mostra o acerto por nível e o nível estimado (maior com 75% ou mais).
- **Escutar e falar**: ouvir e escolher o significado, ditado (aceita I am/I'm, gonna/going to) e pronúncia por reconhecimento de voz (Chrome ou Edge, precisa de internet e microfone).
- 🔊 e 🐢 tocam a frase (voz en-US do navegador). A qualidade depende das vozes instaladas no sistema.
- **Pronúncia simplificada**: em flashcards e frases de exemplo, um texto pequeno entre aspas (ex.: <i>"UÓ-ter"</i>) mostra como ler a palavra/frase em "português de leitura", com a sílaba tônica em maiúscula. Não é fonética IPA, é uma aproximação para quem não estudou fonética. Use o 🔊 para ouvir o som real e a pronúncia simplificada como apoio visual.
- **Escrever em inglês**: você digita a frase e ela é corrigida por regex. Opção de falar a resposta certa.
- **Dica do dia** na tela inicial (`app/data/daily-tips.json`).
- **PWA offline**: um service worker (`app/sw.js`) guarda os arquivos e os dados em cache no primeiro acesso; depois disso, o app abre mesmo sem internet.

## Dados (`app/data/`)
Por módulo: `<id>.json` (flashcards e questões), `<id>-study.json`, `<id>-deep.json`, `<id>-terminal.json`.
O `topic` de cada card ou questão deve ser igual ao título de uma seção do `-deep.json`.
Bancos extras opcionais, carregados automaticamente se existirem: `<id>-extra.json` (mais flashcards/questões), `<id>-sections-extra.json` (mais seções de estudo, formato `{study:[...], deep:[...]}`) e `<id>-terminal-extra.json` (mais desafios de escrita).
Campo opcional `syl` em flashcards e no 3º campo de um item `say` (`"frase | tradução | PRONÚNCIA"`): pronúncia simplificada, sílaba tônica em MAIÚSCULAS.

## Arquitetura
- HTML, CSS e JavaScript puros. Sem framework, sem build step, sem dependência de pacote (`npm`).
- Sem backend: todo o progresso (XP, streak, lições concluídas, flashcards dominados) fica no `localStorage` do navegador, no próprio dispositivo. Nada é enviado a servidor algum.
- Publicado como site estático no GitHub Pages, via GitHub Actions (`.github/workflows/pages.yml`), a partir da pasta `app/`.

## Segurança
- Veja [SECURITY.md](SECURITY.md) para a política de divulgação de vulnerabilidades e o modelo de ameaça considerado.
- **CSP** (Content-Security-Policy) restritivo em `app/index.html`: só permite script/estilo/imagem/mídia da própria origem.
- Nenhuma dependência de terceiros (zero risco de supply-chain via pacote NPM).
- **CodeQL** roda em todo push/PR e semanalmente, analisando o JavaScript em busca de padrões de vulnerabilidade.
- **Dependabot** monitora as GitHub Actions usadas nos workflows.
- As GitHub Actions dos workflows são fixadas por hash de commit (não por tag mutável), seguindo a prática recomendada contra ataques de supply-chain em CI/CD.
- Entradas do usuário (campo de texto do modo "Escrever em inglês", transcrição de voz do modo "Falar") nunca são inseridas como HTML bruto: usam `textContent` ou passam por uma função de escape (`escHtml`) antes de qualquer `innerHTML`.

## Limites
O teste mede gramática e vocabulário. Não mede escuta nem fala de forma objetiva (o modo "Falar" dá uma pontuação aproximada, por comparação de palavras reconhecidas).
