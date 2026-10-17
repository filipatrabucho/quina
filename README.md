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

## Contas, avatares e jogos novos

Para as contas (email + password + username) e os avatares funcionarem, corre
`supabase/schema-contas.sql` no Supabase (SQL Editor → cola tudo → Run). Cria a
tabela `profiles` (username único), o bucket público `avatars` e as regras de
acesso. Pode ser corrido mais do que uma vez.

Os jogos novos (4 em Linha, Galo, Xadrez e Memes) não precisam de tabelas: o
multiplayer usa o Supabase Realtime (broadcast + presence). Quem cria a sala é o
"anfitrião" e guarda o estado oficial da partida; se fechar a página, o jogo
fica parado até voltar. Sem Supabase configurado, as salas funcionam entre
separadores do mesmo browser (útil para desenvolver).

Testes da lógica dos jogos: `npm test`.

## Amigos, chat, perfis e medalhas

Corre `supabase/schema-social.sql` no Supabase (depois do `schema-contas.sql`).
Cria as amizades, as mensagens do chat (incluindo convites para salas), as
estatísticas por jogo e as medalhas. Só utilizadores com conta (email +
username) usam o chat; os convidados continuam a poder jogar.

- Perfil público: `/u/<username>` (descrição, redes sociais, medalhas e
  estatísticas). Edita-se em `/conta`.
- As medalhas são atribuídas pela base de dados (ver `record_game_result`).
  As regras/nomes estão em `src/data/medals.js` e no SQL.

## Fiada multiplayer

Corre `supabase/schema-fiada-v4.sql` no Supabase (SQL Editor). Substitui as
funções antigas: ao começar, cada jogador recebe 4 trevos na diagonal e o
baralho fica com um conjunto de 1 a 20 por jogador; no início de cada vez,
uma carta é virada automaticamente para o jogador aceitar (colocar) ou passar.

## Anúncios (Google AdSense)

O site tem espaços reservados para anúncios: duas colunas laterais (160×600,
só em ecrãs largos), uma faixa no início e outra no fim de cada página
(728×90 no computador, 320×100 no telemóvel). Para ativar:

1. Cria uma conta no AdSense e adiciona o domínio do site.
2. Cria três blocos de anúncios ("display"): coluna vertical, faixa horizontal
   e retângulo.
3. No Netlify (Site settings → Environment variables) define:
   - `VITE_ADSENSE_CLIENT` — o teu ID, ex.: `ca-pub-1234567890123456`
   - `VITE_AD_SLOT_RAIL` — ID do bloco vertical
   - `VITE_AD_SLOT_BANNER` — ID do bloco horizontal
   - `VITE_AD_SLOT_BOX` — ID do retângulo (opcional)
4. Faz um novo deploy.

Enquanto o AdSense não estiver configurado, aparecem os espaços vazios com a
etiqueta "Publicidade". Para os esconder, define `VITE_ADS_PLACEHOLDER=off`.
Com o AdSense ativo, aparece um aviso de consentimento; quem recusar vê
anúncios não personalizados.

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
