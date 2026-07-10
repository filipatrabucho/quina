# Quina — versão PT-PT

Clone do Quina.oo / Wordle, em português de Portugal, feito em React + Vite.

## Correr localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Build de produção

```bash
npm run build
```

Gera a pasta `dist/`.

## Deploy no Netlify (hoje)

**Opção A — arrastar e largar (mais rápido):**
1. Corre `npm install && npm run build`.
2. Vai a https://app.netlify.com/drop
3. Arrasta a pasta `dist/` para lá.
4. Pronto — fica online num URL `*.netlify.app`.

**Opção B — via Netlify CLI:**
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

**Opção C — via GitHub (recomendado para atualizações contínuas):**
1. Cria um repositório no GitHub e faz push deste projeto.
2. Em Netlify: "Add new site" → "Import an existing project" → escolhe o repositório.
3. Build command: `npm run build` · Publish directory: `dist` (já configurado em `netlify.toml`).

## Estrutura

```
src/
  data/words.js       lista de palavras (expansível)
  utils/gameLogic.js  palavra do dia, avaliação de tentativas
  components/         Board e Keyboard
  App.jsx             estado do jogo, modais, partilha
  index.css           identidade visual (azulejo)
```

## Próximos passos (fora do âmbito desta versão)

- Login/associação de conta Discord (OAuth2)
- Acesso ao jogo via bot/activity do Discord
- Modo 1vs1: cada jogador escolhe uma palavra e o adversário tenta acertar

Estas funcionalidades exigem um backend (para gerir sessões, pares de jogadores
e a palavra secreta de cada um sem a expor no cliente) — faz sentido planeá-las
como uma segunda fase, depois de validar este jogo base.
