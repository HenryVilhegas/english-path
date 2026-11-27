# Política de Segurança

## Sobre o projeto
English Path é um app de estudo client-side (HTML, CSS e JavaScript puros, sem backend, sem banco de dados, sem autenticação). Todo o progresso do usuário é salvo apenas no `localStorage` do próprio navegador, no próprio dispositivo. Não há coleta, envio ou armazenamento de dados em qualquer servidor.

Isso reduz bastante a superfície de ataque, mas não a zera: um app client-side ainda pode ter vulnerabilidades de XSS, de manifest/service worker mal configurado, ou de dependências supply-chain (mesmo não tendo nenhuma dependência de terceiros hoje).

## Modelo de ameaça (o que este projeto considera)
- **XSS via conteúdo do app**: todo texto gerado pelo próprio banco de dados (`app/data/*.json`) é confiável, pois é escrito pelos mantenedores do repositório. Ainda assim, qualquer valor originado de entrada do usuário (campo de texto do modo "Escrever em inglês", transcrição do reconhecimento de voz) é inserido no DOM via `textContent` ou escapado com a função `escHtml()` antes de qualquer `innerHTML`, nunca interpolado direto como HTML.
- **Service worker / cache**: o `sw.js` só armazena em cache os arquivos do próprio domínio do app (manifest, JS, CSS, JSON de dados). Não faz proxy ou cache de origens externas.
- **Dependências**: o projeto não usa nenhuma biblioteca de terceiros (sem `npm install`, sem CDN externo além das fontes/vozes nativas do navegador). Isso elimina o risco mais comum de supply-chain attack em projetos JS.

## Reportando uma vulnerabilidade
Se você encontrar uma vulnerabilidade de segurança (por exemplo, um jeito de injetar HTML/JavaScript através de algum campo, ou um problema no manifest/service worker que exponha dados de outro site), por favor:

1. **Não abra uma issue pública** até o problema ser corrigido.
2. Abra uma [GitHub Security Advisory](../../security/advisories/new) neste repositório (aba "Security" → "Report a vulnerability"), descrevendo:
   - O que foi encontrado e como reproduzir.
   - O impacto potencial (o que um atacante conseguiria fazer).
3. Resposta esperada: este é um projeto pessoal de estudo, mantido sem SLA formal, mas relatos serão lidos e corrigidos com prioridade sobre qualquer outra tarefa.

## Escopo fora de preocupação
- Ataques que dependam de acesso físico ao dispositivo do usuário (ex.: ler o `localStorage` com o navegador já aberto) não são tratados como vulnerabilidade deste app — é uma limitação inerente a `localStorage` em qualquer site.
- Este projeto não lida com dados sensíveis (sem senha, sem dado pessoal identificável, sem pagamento).
