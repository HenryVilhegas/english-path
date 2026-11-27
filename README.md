# English Path

App de estudo de inglês (A1 a C1 + inglês de rua dos EUA). Explicações em português, frases em inglês com áudio.

## Como abrir
Dê dois cliques em `iniciar.bat` e acesse `http://localhost:8007` (requer Python).

## Módulos
- **0 · Teste de Nível**: quiz por seção. Seu nível é a maior seção com 75% ou mais de acertos.
- **A1, A2, B1, B2, C1**: gramática, vocabulário e frases por nível.
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

## Dados (`app/data/`)
Por módulo: `<id>.json` (flashcards e questões), `<id>-study.json`, `<id>-deep.json`, `<id>-terminal.json`.
O `topic` de cada card ou questão deve ser igual ao título de uma seção do `-deep.json`.
Bancos extras opcionais, carregados automaticamente se existirem: `<id>-extra.json` (mais flashcards/questões), `<id>-sections-extra.json` (mais seções de estudo, formato `{study:[...], deep:[...]}`) e `<id>-terminal-extra.json` (mais desafios de escrita).
Campo opcional `syl` em flashcards e no 3º campo de um item `say` (`"frase | tradução | PRONÚNCIA"`): pronúncia simplificada, sílaba tônica em MAIÚSCULAS.

## Limites
O teste mede gramática e vocabulário. Não mede escuta nem fala.
