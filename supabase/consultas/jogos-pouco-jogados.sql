-- ============================================================================
-- Que jogos ninguém joga?
-- Como usar: no Supabase, abre o SQL Editor, cola este ficheiro e carrega em Run.
-- Mostra todos os jogos do site (também os que nunca foram abertos), do menos
-- jogado para o mais jogado, nos últimos 30 e 90 dias. Não conta o admin nem
-- os testers (para os testes não enganarem os números).
-- Coluna sugestao:
--   desativar  -> nenhuma partida em 30 dias e quase ninguém o abriu
--   a vigiar   -> poucas partidas (menos de 5 em 30 dias)
--   manter     -> o resto
-- Para desativar um jogo: Backoffice > separador Jogos > "Pôr em beta".
-- (Em beta o jogo sai do menu, da página inicial e do Google para toda a
-- gente; só tu e os testers o continuam a ver. Volta com "Pôr em produção".)
-- ============================================================================

with jogos(jogo, nome, beta_no_codigo) as (values
  ('impostor', 'O Impostor', true),
  ('emojidia', 'Emoji do Dia', false),
  ('bisca', 'Bisca', false),
  ('spider', 'Spider', false),
  ('freecell', 'FreeCell', false),
  ('domino', 'Dominó', false),
  ('sueca', 'Sueca', false),
  ('colonos', 'Colonos', true),
  ('bombas', 'Bombas & Companhia', true),
  ('blackjack', 'Blackjack', true),
  ('poker', 'Poker', true),
  ('emojis', 'Emoji Battle', false),
  ('noventa', '99', false),
  ('frase', 'Continua a Frase', false),
  ('verdades', '2 Verdades 1 Mentira', false),
  ('memoria', 'Memória', false),
  ('snake', 'Snake', false),
  ('memes', 'Jogo dos Memes', false),
  ('naval', 'Batalha Naval', false),
  ('stop', 'Stop', false),
  ('cartas', 'Cartas Coloridas', false),
  ('xadrez', 'Xadrez', false),
  ('quatro', '4 em Linha', false),
  ('galo', 'Jogo do Galo', false),
  ('palavras', 'Palavras', false),
  ('fiada', 'Fiada', true)
),
staff_ids as (select user_id from public.staff),
linhas as (
  select gp.* from public.game_plays gp
  where gp.created_at >= now() - interval '90 days'
    and (gp.user_id is null or gp.user_id not in (select user_id from staff_ids))
),
contas as (
  select game,
    count(distinct coalesce(user_id::text, visitor)) filter (where kind = 'abriu' and created_at >= now() - interval '30 days') as abriram_30d,
    count(distinct coalesce(user_id::text, visitor)) filter (where kind = 'partida' and created_at >= now() - interval '30 days') as jogaram_30d,
    count(*) filter (where kind = 'partida' and created_at >= now() - interval '30 days') as partidas_30d,
    count(*) filter (where kind = 'partida') as partidas_90d,
    max(created_at) filter (where kind = 'partida') as ultima_partida
  from linhas group by game
)
select
  j.nome,
  j.jogo,
  case when coalesce(gs.beta, j.beta_no_codigo) then 'beta' else 'produção' end as estado_no_backoffice,
  coalesce(c.abriram_30d, 0) as pessoas_abriram_30d,
  coalesce(c.jogaram_30d, 0) as pessoas_jogaram_30d,
  coalesce(c.partidas_30d, 0) as partidas_30d,
  coalesce(c.partidas_90d, 0) as partidas_90d,
  coalesce(to_char(c.ultima_partida at time zone 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI'), 'nunca') as ultima_partida,
  case
    when coalesce(c.partidas_30d, 0) = 0 and coalesce(c.abriram_30d, 0) < 3 then 'desativar'
    when coalesce(c.partidas_30d, 0) < 5 then 'a vigiar'
    else 'manter'
  end as sugestao
from jogos j
left join contas c on c.game = j.jogo
left join public.game_settings gs on gs.game = j.jogo
order by partidas_30d, pessoas_abriram_30d, partidas_90d, j.nome;
