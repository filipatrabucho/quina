-- ============================================================================
-- Que jogos jogou um utilizador?
-- Como usar: no Supabase, abre o SQL Editor, cola este ficheiro, troca o
-- username na linha marcada com <<< e carrega em Run. O resultado tem 3 partes
-- (escolhe a parte no seletor por baixo do editor, ou corre uma de cada vez):
--   1) resumo por jogo   2) histórico, do mais recente para o mais antigo
--   3) totais de sempre (inclui partidas de antes de existir o histórico)
-- Conta também o que essa pessoa jogou sem sessão iniciada no(s) mesmo(s)
-- browser(s) onde já entrou com a conta.
-- ============================================================================

-- 1) Resumo por jogo
with alvo as (
  select id from public.profiles where username = 'O_USERNAME'   -- <<< troca aqui
),
browsers as (
  select distinct visitor from public.game_plays where user_id = (select id from alvo)
),
linhas as (
  select * from public.game_plays
  where user_id = (select id from alvo) or visitor in (select visitor from browsers)
)
select
  game as jogo,
  count(*) filter (where kind = 'partida') as partidas,
  count(*) filter (where kind = 'partida' and won) as vitorias,
  count(*) filter (where kind = 'partida' and mode = 'online') as online,
  count(*) filter (where kind = 'abriu') as vezes_que_abriu,
  to_char(max(created_at) at time zone 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI') as ultima_vez
from linhas
group by game
order by max(created_at) desc;

-- 2) Histórico completo
with alvo as (
  select id from public.profiles where username = 'O_USERNAME'   -- <<< troca aqui
),
browsers as (
  select distinct visitor from public.game_plays where user_id = (select id from alvo)
)
select
  to_char(gp.created_at at time zone 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI') as quando,
  gp.game as jogo,
  case when gp.kind = 'abriu' then 'abriu o jogo' when gp.won then 'ganhou' else 'perdeu' end as o_que,
  coalesce(gp.mode, '') as modo,
  case when gp.user_id is null then 'sem sessão' else 'com conta' end as sessao
from public.game_plays gp
where gp.user_id = (select id from alvo) or gp.visitor in (select visitor from browsers)
order by gp.created_at desc
limit 500;

-- 3) Totais de sempre (estatísticas da conta)
select ps.game as jogo, ps.plays as partidas, ps.wins as vitorias, ps.best_streak as melhor_sequencia,
       to_char(ps.updated_at at time zone 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI') as atualizado
from public.player_stats ps
join public.profiles p on p.id = ps.user_id
where p.username = 'O_USERNAME'   -- <<< troca aqui
order by ps.plays desc;

-- ----------------------------------------------------------------------------
-- E para um convidado (sem conta)? No Backoffice → Atividade aparece como
-- "Convidado abcd": essas 4 letras são o fim do código do browser.
-- ----------------------------------------------------------------------------
-- select to_char(created_at at time zone 'Europe/Lisbon', 'DD/MM/YYYY HH24:MI') as quando, game as jogo,
--        case when kind = 'abriu' then 'abriu o jogo' when won then 'ganhou' else 'perdeu' end as o_que, coalesce(mode, '') as modo
-- from public.game_plays
-- where visitor like '%abcd'          -- <<< troca pelas 4 letras
-- order by created_at desc;
