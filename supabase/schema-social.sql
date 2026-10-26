-- Corre isto no Supabase (SQL Editor → cola tudo → Run), DEPOIS do
-- schema-contas.sql. Acrescenta: descrição e redes sociais no perfil,
-- amizades, chat (mensagens e convites), estatísticas e medalhas.
-- Pode ser corrido mais do que uma vez.

-- ---------- Perfil público ----------
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists links jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_bio_tamanho;
alter table public.profiles add constraint profiles_bio_tamanho check (char_length(bio) <= 300);

-- Contas criadas antes do schema-contas.sql (ou com o Discord) não têm
-- perfil. Esta função cria-o a partir dos dados da conta, com um username
-- válido e único.
create or replace function public.create_profile_for(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u auth.users;
  base text;
  candidate text;
begin
  if exists (select 1 from profiles where id = p_uid) then return; end if;
  select * into u from auth.users where id = p_uid;
  if u.id is null or coalesce(u.is_anonymous, false) then return; end if;

  base := coalesce(
    nullif(u.raw_user_meta_data ->> 'username', ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    split_part(coalesce(u.email, ''), '@', 1),
    'jogador'
  );
  base := regexp_replace(translate(base, 'ÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç ', 'AAAAEEIOOOUUCaaaaeeiooouuc_'), '[^A-Za-z0-9_.]', '', 'g');
  if char_length(base) < 3 then base := base || 'jogador'; end if;
  base := left(base, 16);
  candidate := base;
  while exists (select 1 from profiles where lower(username) = lower(candidate)) loop
    candidate := base || (floor(random() * 9000) + 1000)::int;
  end loop;

  insert into profiles (id, username, avatar_url)
  values (p_uid, candidate, u.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
end;
$$;
revoke execute on function public.create_profile_for(uuid) from public, anon, authenticated;

-- Chamada pelo site quando um utilizador com sessão não tem perfil.
create or replace function public.ensure_profile()
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  perform create_profile_for(auth.uid());
  return query select * from profiles where id = auth.uid();
end;
$$;
grant execute on function public.ensure_profile() to authenticated;

-- Cria já o perfil de todas as contas que ainda não o têm.
-- Cada conta é tratada à parte: se uma falhar, as outras continuam.
do $$
declare r record;
begin
  for r in select id, email from auth.users where not coalesce(is_anonymous, false)
           and id not in (select id from public.profiles) loop
    begin
      perform public.create_profile_for(r.id);
    exception when others then
      raise warning 'Não foi possível criar o perfil de %: %', r.email, sqlerrm;
    end;
  end loop;
end $$;

-- Para confirmar: contas com sessão possível que continuam sem perfil
-- (deve dar 0 linhas).
select u.email, u.raw_user_meta_data ->> 'username' as username
from auth.users u
where not coalesce(u.is_anonymous, false) and u.id not in (select id from public.profiles);

-- ---------- Amizades ----------
create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  requester uuid not null references public.profiles(id) on delete cascade,
  addressee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'aceite')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_par_unico
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;

drop policy if exists "amizades: ver as minhas" on public.friendships;
create policy "amizades: ver as minhas" on public.friendships for select
  using (auth.uid() in (requester, addressee));

drop policy if exists "amizades: pedir" on public.friendships;
create policy "amizades: pedir" on public.friendships for insert
  with check (requester = auth.uid() and status = 'pendente');

drop policy if exists "amizades: aceitar" on public.friendships;
create policy "amizades: aceitar" on public.friendships for update
  using (addressee = auth.uid())
  with check (addressee = auth.uid() and status = 'aceite');

drop policy if exists "amizades: remover" on public.friendships;
create policy "amizades: remover" on public.friendships for delete
  using (auth.uid() in (requester, addressee));

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from friendships
    where status = 'aceite'
      and least(requester, addressee) = least(a, b)
      and greatest(requester, addressee) = greatest(a, b)
  );
$$;

-- ---------- Mensagens (chat e convites) ----------
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender uuid not null references public.profiles(id) on delete cascade,
  recipient uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'texto' check (kind in ('texto', 'convite')),
  body text not null default '' check (char_length(body) <= 1000),
  payload jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_conversa on public.messages (least(sender, recipient), greatest(sender, recipient), created_at desc);
create index if not exists messages_por_ler on public.messages (recipient) where read_at is null;

alter table public.messages enable row level security;

drop policy if exists "mensagens: ver as minhas" on public.messages;
create policy "mensagens: ver as minhas" on public.messages for select
  using (auth.uid() in (sender, recipient));

-- Só se pode escrever a amigos.
drop policy if exists "mensagens: enviar a amigos" on public.messages;
create policy "mensagens: enviar a amigos" on public.messages for insert
  with check (sender = auth.uid() and read_at is null and public.are_friends(sender, recipient));

create or replace function public.mark_messages_read(p_friend uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update messages set read_at = now()
  where recipient = auth.uid() and sender = p_friend and read_at is null;
$$;
grant execute on function public.mark_messages_read(uuid) to authenticated;

-- ---------- Estatísticas e medalhas ----------
create table if not exists public.player_stats (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null,
  plays int not null default 0,
  wins int not null default 0,
  streak int not null default 0,
  best_streak int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
-- Lista de jogos (atualizada sempre que há jogos novos).
alter table public.player_stats drop constraint if exists player_stats_game_check;
alter table public.player_stats add constraint player_stats_game_check
  check (game in ('palavras', 'fiada', 'quatro', 'galo', 'xadrez', 'memes', 'naval', 'stop', 'cartas', 'snake', 'memoria', 'noventa', 'verdades', 'frase', 'emojis', 'colonos', 'bombas', 'blackjack', 'poker', 'sueca', 'emojidia', 'bisca', 'domino', 'spider', 'freecell', 'impostor'));
alter table public.player_stats enable row level security;
-- Melhor pontuação (jogos com pontos, como a Snake): o top destes jogos é por pontos.
alter table public.player_stats add column if not exists best_score int;
drop policy if exists "estatisticas: publicas" on public.player_stats;
create policy "estatisticas: publicas" on public.player_stats for select using (true);

create table if not exists public.user_medals (
  user_id uuid not null references public.profiles(id) on delete cascade,
  medal text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, medal)
);
alter table public.user_medals enable row level security;
drop policy if exists "medalhas: publicas" on public.user_medals;
create policy "medalhas: publicas" on public.user_medals for select using (true);

-- Atribui uma medalha (se ainda não a tiver). Devolve true se for nova.
create or replace function public.award_medal(p_user uuid, p_medal text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_medals (user_id, medal) values (p_user, p_medal) on conflict do nothing;
  return found;
end;
$$;
revoke execute on function public.award_medal(uuid, text) from public, anon, authenticated;

-- Regista o fim de uma partida do utilizador e devolve as medalhas novas.
-- p_detail: informação extra (ex.: 'dificil' quando se ganha ao bot difícil).
create or replace function public.record_game_result(p_game text, p_won boolean, p_detail text default null)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s player_stats;
  total_plays int;
  total_wins int;
  games_played int;
  earned text[] := '{}';
begin
  if uid is null or not exists (select 1 from profiles where id = uid) then
    return earned; -- convidados (sem conta) não acumulam estatísticas
  end if;

  insert into player_stats as ps (user_id, game, plays, wins, streak, best_streak, best_score)
  values (uid, p_game, 1, case when p_won then 1 else 0 end, case when p_won then 1 else 0 end, case when p_won then 1 else 0 end,
          case when p_game = 'snake' and p_detail ~ '^[0-9]{1,6}$' then p_detail::int end)
  on conflict (user_id, game) do update set
    plays = ps.plays + 1,
    best_score = case when p_game = 'snake' and p_detail ~ '^[0-9]{1,6}$' then greatest(coalesce(ps.best_score, 0), p_detail::int) else ps.best_score end,
    wins = ps.wins + case when p_won then 1 else 0 end,
    streak = case when p_won then ps.streak + 1 else 0 end,
    best_streak = greatest(ps.best_streak, case when p_won then ps.streak + 1 else 0 end),
    updated_at = now()
  returning * into s;

  select coalesce(sum(plays), 0), coalesce(sum(wins), 0), count(*) into total_plays, total_wins, games_played
    from player_stats where user_id = uid;

  if total_wins >= 1 and award_medal(uid, 'primeira-vitoria') then earned := array_append(earned, 'primeira-vitoria'); end if;
  if total_plays >= 50 and award_medal(uid, 'veterano') then earned := array_append(earned, 'veterano'); end if;
  if total_wins >= 100 and award_medal(uid, 'lenda') then earned := array_append(earned, 'lenda'); end if;
  if games_played >= 6 and award_medal(uid, 'explorador') then earned := array_append(earned, 'explorador'); end if;
  if s.streak >= 5 and award_medal(uid, 'imparavel') then earned := array_append(earned, 'imparavel'); end if;

  if p_game = 'palavras' and s.wins >= 10 and award_medal(uid, 'palavras-10') then earned := array_append(earned, 'palavras-10'); end if;
  if p_game = 'fiada' and s.wins >= 5 and award_medal(uid, 'fiada-5') then earned := array_append(earned, 'fiada-5'); end if;
  if p_game = 'galo' and s.wins >= 10 and award_medal(uid, 'galo-10') then earned := array_append(earned, 'galo-10'); end if;
  if p_game = 'quatro' and s.wins >= 10 and award_medal(uid, 'quatro-10') then earned := array_append(earned, 'quatro-10'); end if;
  if p_game = 'xadrez' and s.wins >= 5 and award_medal(uid, 'xadrez-5') then earned := array_append(earned, 'xadrez-5'); end if;
  if p_game = 'xadrez' and p_won and p_detail = 'dificil' and award_medal(uid, 'xadrez-mestre') then earned := array_append(earned, 'xadrez-mestre'); end if;
  if p_game = 'naval' and s.wins >= 5 and award_medal(uid, 'naval-5') then earned := array_append(earned, 'naval-5'); end if;
  if p_game = 'stop' and s.wins >= 5 and award_medal(uid, 'stop-5') then earned := array_append(earned, 'stop-5'); end if;
  if p_game = 'cartas' and s.wins >= 5 and award_medal(uid, 'cartas-5') then earned := array_append(earned, 'cartas-5'); end if;
  if p_game = 'noventa' and s.wins >= 5 and award_medal(uid, 'noventa-5') then earned := array_append(earned, 'noventa-5'); end if;
  if p_game = 'emojis' and s.wins >= 5 and award_medal(uid, 'emojis-5') then earned := array_append(earned, 'emojis-5'); end if;
  if p_game = 'bombas' and s.wins >= 5 and award_medal(uid, 'bombas-5') then earned := array_append(earned, 'bombas-5'); end if;
  if p_game = 'colonos' and s.wins >= 3 and award_medal(uid, 'colonos-3') then earned := array_append(earned, 'colonos-3'); end if;
  if p_game = 'snake' and p_detail ~ '^[0-9]+$' and p_detail::int >= 40 and award_medal(uid, 'snake-40') then earned := array_append(earned, 'snake-40'); end if;
  if p_game = 'memes' and s.wins >= 3 and award_medal(uid, 'memes-3') then earned := array_append(earned, 'memes-3'); end if;

  return earned;
end;
$$;
grant execute on function public.record_game_result(text, boolean, text) to authenticated;

-- Medalhas automáticas: boas-vindas, amigos e mensagens.
create or replace function public.medals_on_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform award_medal(new.id, 'bem-vindo');
  return new;
end;
$$;
drop trigger if exists medals_on_profile on public.profiles;
create trigger medals_on_profile after insert on public.profiles
  for each row execute function public.medals_on_profile();
insert into public.user_medals (user_id, medal) select id, 'bem-vindo' from public.profiles on conflict do nothing;

create or replace function public.medals_on_friendship()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  u uuid;
begin
  if new.status <> 'aceite' then return new; end if;
  foreach u in array array[new.requester, new.addressee] loop
    perform award_medal(u, 'primeiro-amigo');
    if (select count(*) from friendships where status = 'aceite' and u in (requester, addressee)) >= 10 then
      perform award_medal(u, 'popular');
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists medals_on_friendship on public.friendships;
create trigger medals_on_friendship after insert or update on public.friendships
  for each row execute function public.medals_on_friendship();

create or replace function public.medals_on_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'convite' then perform award_medal(new.sender, 'anfitriao'); end if;
  if (select count(*) from messages where sender = new.sender) >= 100 then
    perform award_medal(new.sender, 'conversador');
  end if;
  return new;
end;
$$;
drop trigger if exists medals_on_message on public.messages;
create trigger medals_on_message after insert on public.messages
  for each row execute function public.medals_on_message();

-- ---------- Tempo real ----------
do $$
declare t text;
begin
  foreach t in array array['messages', 'friendships', 'user_medals', 'player_stats'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- Grupos de amigos (convidar vários de uma vez) ----------
create table if not exists public.friend_groups (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  members uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.friend_groups enable row level security;
drop policy if exists "grupos: só o dono" on public.friend_groups;
create policy "grupos: só o dono" on public.friend_groups for all
  using (owner = auth.uid()) with check (owner = auth.uid());

-- ---------- Admin e testers (jogos em beta) ----------
create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'tester')),
  added_at timestamptz not null default now()
);
alter table public.staff enable row level security;
drop policy if exists "staff: ver o meu" on public.staff;
create policy "staff: ver o meu" on public.staff for select using (user_id = auth.uid());
-- Ninguém escreve diretamente: só pelas funções abaixo (ou no SQL Editor).

create or replace function public.my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from staff where user_id = auth.uid();
$$;
grant execute on function public.my_role() to authenticated;

create or replace function public.list_staff()
returns table (user_id uuid, username text, role text, added_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from staff s where s.user_id = auth.uid() and s.role = 'admin') then
    raise exception 'Só o admin pode ver os testers.';
  end if;
  return query
    select s.user_id, p.username, s.role, s.added_at
    from staff s left join profiles p on p.id = s.user_id
    order by s.role, p.username;
end;
$$;
grant execute on function public.list_staff() to authenticated;

-- p_role: 'tester', 'admin' ou null para tirar.
create or replace function public.set_staff(p_username text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not exists (select 1 from staff s where s.user_id = auth.uid() and s.role = 'admin') then
    raise exception 'Só o admin pode gerir testers.';
  end if;
  select id into uid from profiles where lower(username) = lower(trim(p_username));
  if uid is null then raise exception 'Não existe nenhum jogador com esse username.'; end if;
  if p_role is null then
    if uid = auth.uid() then raise exception 'Não te podes tirar a ti próprio.'; end if;
    delete from staff where user_id = uid;
  elsif p_role in ('admin', 'tester') then
    insert into staff (user_id, role) values (uid, p_role)
    on conflict (user_id) do update set role = excluded.role;
  else
    raise exception 'Papel inválido.';
  end if;
end;
$$;
grant execute on function public.set_staff(text, text) to authenticated;

-- ---------- Backoffice (só admin) ----------
-- Lista de utilizadores com pesquisa, papel e número de partidas.
create or replace function public.admin_list_users(p_query text default '', p_role text default null, p_limit int default 25, p_offset int default 0)
returns table (user_id uuid, username text, email text, avatar_url text, created_at timestamptz, provider text, plays bigint, wins bigint, role text, total bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from staff s where s.user_id = auth.uid() and s.role = 'admin') then
    raise exception 'Só o admin pode ver os utilizadores.';
  end if;
  return query
    select p.id, p.username, u.email::text, p.avatar_url, p.created_at,
           coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
           coalesce(st.plays, 0), coalesce(st.wins, 0), sf.role,
           count(*) over ()
    from profiles p
    join auth.users u on u.id = p.id
    left join (select ps.user_id, sum(ps.plays)::bigint plays, sum(ps.wins)::bigint wins from player_stats ps group by ps.user_id) st on st.user_id = p.id
    left join staff sf on sf.user_id = p.id
    where (coalesce(trim(p_query), '') = ''
           or p.username ilike '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
           or u.email ilike '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%')
      and (p_role is null or (p_role = 'jogador' and sf.role is null) or sf.role = p_role)
    order by p.created_at desc
    limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
end;
$$;
grant execute on function public.admin_list_users(text, text, int, int) to authenticated;

-- Números gerais e partidas por jogo.
create or replace function public.admin_stats()
returns json language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from staff s where s.user_id = auth.uid() and s.role = 'admin') then
    raise exception 'Só o admin pode ver as estatísticas.';
  end if;
  return json_build_object(
    'users', (select count(*) from profiles),
    'users_7d', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'testers', (select count(*) from staff where role = 'tester'),
    'admins', (select count(*) from staff where role = 'admin'),
    'plays', (select coalesce(sum(plays), 0) from player_stats),
    'games', (select coalesce(json_agg(g order by g.plays desc), '[]'::json) from (
      select game, count(*) as players, sum(plays) as plays, sum(wins) as wins from player_stats group by game
    ) g)
  );
end;
$$;
grant execute on function public.admin_stats() to authenticated;

-- Mudar o papel pelo id (o backoffice usa isto; o set_staff por username continua a funcionar).
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from staff s where s.user_id = auth.uid() and s.role = 'admin') then
    raise exception 'Só o admin pode gerir papéis.';
  end if;
  if p_role is null or p_role = 'jogador' then
    if p_user = auth.uid() then raise exception 'Não te podes tirar a ti próprio.'; end if;
    delete from staff where user_id = p_user;
  elsif p_role in ('admin', 'tester') then
    if p_user = auth.uid() and p_role <> 'admin' then raise exception 'Não podes tirar o teu próprio acesso de admin.'; end if;
    insert into staff (user_id, role) values (p_user, p_role)
    on conflict (user_id) do update set role = excluded.role;
  else
    raise exception 'Papel inválido.';
  end if;
end;
$$;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- ---------- Carteira de fichas (a fingir) por jogo ----------
-- O saldo do Blackjack passa de uma partida para a outra. É público (a mesa
-- online mostra as fichas de todos) e cada um só escreve o seu.
create table if not exists public.game_wallets (
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('blackjack')),
  chips integer not null check (chips >= 0 and chips <= 100000000),
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.game_wallets enable row level security;
drop policy if exists "carteiras: publicas" on public.game_wallets;
create policy "carteiras: publicas" on public.game_wallets for select using (true);
drop policy if exists "carteiras: criar a minha" on public.game_wallets;
create policy "carteiras: criar a minha" on public.game_wallets for insert with check (user_id = auth.uid());
drop policy if exists "carteiras: mudar a minha" on public.game_wallets;
create policy "carteiras: mudar a minha" on public.game_wallets for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Partidas jogadas (com e sem conta) ----------
-- Cada visitante tem um id aleatório guardado no browser. 'abriu' = abriu a
-- página do jogo (uma vez por sessão); 'partida' = acabou uma partida.
-- Ninguém lê esta tabela diretamente: só o admin, pelas funções abaixo.
create table if not exists public.game_plays (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('abriu', 'partida')),
  game text not null check (game ~ '^[a-z0-9-]{1,30}$'),
  mode text check (mode in ('solo', 'online')),
  won boolean,
  visitor text not null check (visitor ~ '^[A-Za-z0-9_-]{6,40}$'),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists game_plays_created_idx on public.game_plays (created_at);
create index if not exists game_plays_visitor_idx on public.game_plays (visitor, created_at);
alter table public.game_plays enable row level security;

create or replace function public.log_play(p_kind text, p_game text, p_mode text, p_won boolean, p_visitor text)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Travão contra abusos: no máximo 200 registos por visitante por hora.
  if (select count(*) from game_plays where visitor = p_visitor and created_at > now() - interval '1 hour') >= 200 then
    return;
  end if;
  insert into game_plays (kind, game, mode, won, visitor, user_id)
  values (p_kind, p_game, p_mode, p_won, p_visitor, auth.uid());
end;
$$;
grant execute on function public.log_play(text, text, text, boolean, text) to anon, authenticated;

-- Números para o backoffice (últimos p_days dias).
create or replace function public.admin_play_stats(p_days int default 30)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365)));
begin
  if not exists (select 1 from staff s where s.user_id = auth.uid() and s.role = 'admin') then
    raise exception 'Só o admin pode ver estes números.';
  end if;
  return json_build_object(
    'totals', (
      select json_build_object(
        'visitors', count(distinct coalesce(user_id::text, visitor)) filter (where kind = 'abriu'),
        'players', count(distinct coalesce(user_id::text, visitor)) filter (where kind = 'partida'),
        'plays', count(*) filter (where kind = 'partida'),
        'guest_players', count(distinct visitor) filter (where kind = 'partida' and user_id is null),
        'account_players', count(distinct user_id) filter (where kind = 'partida')
      ) from game_plays where created_at >= since
    ),
    'games', (
      select coalesce(json_agg(g order by g.plays desc, g.opened desc), '[]'::json) from (
        select game,
          count(distinct coalesce(user_id::text, visitor)) filter (where kind = 'abriu') as opened,
          count(distinct coalesce(user_id::text, visitor)) filter (where kind = 'partida') as players,
          count(*) filter (where kind = 'partida') as plays,
          count(*) filter (where kind = 'partida' and mode = 'solo') as solo,
          count(*) filter (where kind = 'partida' and mode = 'online') as online
        from game_plays where created_at >= since group by game
      ) g
    ),
    'days', (
      select coalesce(json_agg(d order by d.day), '[]'::json) from (
        select (created_at at time zone 'Europe/Lisbon')::date as day,
          count(distinct coalesce(user_id::text, visitor)) filter (where kind = 'partida') as players,
          count(*) filter (where kind = 'partida') as plays
        from game_plays where created_at >= since group by 1
      ) d
    )
  );
end;
$$;
grant execute on function public.admin_play_stats(int) to authenticated;

-- Atividade mais recente: jogos abertos e partidas acabadas (com quem jogou, se tiver conta).
drop function if exists public.admin_recent_plays(int);
create or replace function public.admin_recent_plays(p_limit int default 30)
returns table (id bigint, created_at timestamptz, kind text, game text, mode text, won boolean, user_id uuid, username text, avatar_url text, visitor text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from staff s where s.user_id = auth.uid() and s.role = 'admin') then
    raise exception 'Só o admin pode ver estes números.';
  end if;
  return query
    select gp.id, gp.created_at, gp.kind, gp.game, gp.mode, gp.won, gp.user_id, p.username, p.avatar_url, gp.visitor
    from game_plays gp
    left join profiles p on p.id = gp.user_id
    order by gp.created_at desc
    limit greatest(1, least(p_limit, 100));
end;
$$;
grant execute on function public.admin_recent_plays(int) to authenticated;

-- ---------- Jogos em beta ou em produção (mudado no backoffice) ----------
-- Sem linha para um jogo, vale o que está no código (games.js).
create table if not exists public.game_settings (
  game text primary key check (game ~ '^[a-z0-9-]{1,30}$'),
  beta boolean not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.game_settings enable row level security;
drop policy if exists "jogos: estado publico" on public.game_settings;
create policy "jogos: estado publico" on public.game_settings for select using (true);

create or replace function public.admin_set_game_beta(p_game text, p_beta boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from staff s where s.user_id = auth.uid() and s.role = 'admin') then
    raise exception 'Só o admin pode mudar o estado dos jogos.';
  end if;
  insert into game_settings (game, beta, updated_at, updated_by) values (p_game, p_beta, now(), auth.uid())
  on conflict (game) do update set beta = excluded.beta, updated_at = now(), updated_by = auth.uid();
end;
$$;
grant execute on function public.admin_set_game_beta(text, boolean) to authenticated;

-- Jogos promovidos: aparecem em destaque no topo da página inicial.
-- (beta passa a poder ficar vazio: vazio = vale o que está no código.)
alter table public.game_settings add column if not exists promoted boolean not null default false;
alter table public.game_settings alter column beta drop not null;
create or replace function public.admin_set_game_promoted(p_game text, p_promoted boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from staff s where s.user_id = auth.uid() and s.role = 'admin') then
    raise exception 'Só o admin pode promover jogos.';
  end if;
  insert into game_settings (game, beta, promoted, updated_at, updated_by) values (p_game, null, p_promoted, now(), auth.uid())
  on conflict (game) do update set promoted = excluded.promoted, updated_at = now(), updated_by = auth.uid();
end;
$$;
grant execute on function public.admin_set_game_promoted(text, boolean) to authenticated;

-- Quantas pessoas acabaram hoje (dia de Lisboa) um jogo: público, só o número.
create or replace function public.daily_players(p_game text)
returns int language sql stable security definer set search_path = public as $$
  select count(distinct coalesce(user_id::text, visitor))::int from game_plays
  where kind = 'partida' and game = p_game
    and created_at >= (date_trunc('day', now() at time zone 'Europe/Lisbon') at time zone 'Europe/Lisbon');
$$;
grant execute on function public.daily_players(text) to anon, authenticated;

-- ---------- Lembretes (notificações no telemóvel/computador) ----------
-- Guarda as subscrições de quem pediu o lembrete diário. Só a função agendada
-- (com a chave de serviço) as lê; o site só pode juntar ou tirar a sua.
create table if not exists public.push_subscriptions (
  endpoint text primary key check (endpoint ~ '^https://' and length(endpoint) < 1000),
  p256dh text not null check (length(p256dh) < 200),
  auth text not null check (length(auth) < 100),
  visitor text check (visitor is null or visitor ~ '^[A-Za-z0-9_-]{6,40}$'),
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_sent timestamptz
);
alter table public.push_subscriptions enable row level security;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_visitor text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into push_subscriptions (endpoint, p256dh, auth, visitor, user_id)
  values (p_endpoint, p_p256dh, p_auth, p_visitor, auth.uid())
  on conflict (endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, visitor = excluded.visitor, user_id = coalesce(excluded.user_id, push_subscriptions.user_id);
end;
$$;
grant execute on function public.save_push_subscription(text, text, text, text) to anon, authenticated;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint;
$$;
grant execute on function public.delete_push_subscription(text) to anon, authenticated;

-- Quem volta: por browser (visitante). Exclui, se pedido, os browsers onde
-- já entrou um admin ou tester. Dias contados na hora de Lisboa.
create or replace function public.admin_retention(p_days int default 30, p_exclude_staff boolean default true)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Europe/Lisbon')::date;
  since date := today - greatest(1, least(p_days, 365));
begin
  if not exists (select 1 from staff s where s.user_id = auth.uid() and s.role = 'admin') then
    raise exception 'Só o admin pode ver estes números.';
  end if;
  return (
    with staff_visitors as (
      select distinct gp.visitor from game_plays gp join staff s on s.user_id = gp.user_id
    ),
    days as (
      select distinct gp.visitor, (gp.created_at at time zone 'Europe/Lisbon')::date as d
      from game_plays gp
      where not (p_exclude_staff and gp.visitor in (select visitor from staff_visitors))
    ),
    firsts as (select visitor, min(d) as first_day from days group by visitor),
    cohort as (
      select f.visitor, f.first_day,
        exists (select 1 from days x where x.visitor = f.visitor and x.d = f.first_day + 1) as d1,
        exists (select 1 from days x where x.visitor = f.visitor and x.d between f.first_day + 1 and f.first_day + 7) as d7,
        exists (select 1 from days x where x.visitor = f.visitor and x.d > f.first_day) as again
      from firsts f where f.first_day >= since
    )
    select json_build_object(
      'people', (select count(distinct visitor) from days where d >= since),
      'new', (select count(*) from cohort),
      'returning', (select count(*) from (select visitor from days where d >= since group by visitor having count(*) >= 2) r),
      'd1_base', (select count(*) from cohort where first_day < today),
      'd1', (select count(*) from cohort where first_day < today and d1),
      'd7_base', (select count(*) from cohort where first_day <= today - 7),
      'd7', (select count(*) from cohort where first_day <= today - 7 and d7),
      'staff_browsers', (select count(*) from staff_visitors),
      'reminders', (select count(*) from push_subscriptions),
      'cohorts', (select coalesce(json_agg(c order by c.day desc), '[]'::json) from (
        select first_day as day, count(*) as new, count(*) filter (where d1) as d1, count(*) filter (where again) as again
        from cohort group by first_day
      ) c)
    )
  );
end;
$$;
grant execute on function public.admin_retention(int, boolean) to authenticated;

-- ---------- Feedback dos utilizadores (opiniões e sugestões) ----------
create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('sugestao', 'erro', 'jogo', 'opiniao')),
  message text not null check (length(trim(message)) between 3 and 2000),
  page text check (page is null or length(page) <= 200),
  status text not null default 'novo' check (status in ('novo', 'lido', 'feito')),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
alter table public.feedback enable row level security;
drop policy if exists "feedback: ver o meu" on public.feedback;
create policy "feedback: ver o meu" on public.feedback for select using (user_id = auth.uid());

-- Enviar (só com conta; no máximo 10 por dia, para evitar abusos).
create or replace function public.send_feedback(p_kind text, p_message text, p_page text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Para enviar feedback precisas de uma conta.';
  end if;
  if (select count(*) from feedback where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Já enviaste muito feedback hoje. Obrigado! Tenta outra vez amanhã.';
  end if;
  insert into feedback (user_id, kind, message, page) values (auth.uid(), p_kind, trim(p_message), left(p_page, 200));
end;
$$;
grant execute on function public.send_feedback(text, text, text) to authenticated;

create or replace function public.admin_list_feedback(p_status text default null, p_limit int default 100)
returns table (id bigint, created_at timestamptz, kind text, message text, page text, status text, user_id uuid, username text, avatar_url text, email text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from staff s where s.user_id = auth.uid() and s.role = 'admin') then
    raise exception 'Só o admin pode ver o feedback.';
  end if;
  return query
    select f.id, f.created_at, f.kind, f.message, f.page, f.status, f.user_id, p.username, p.avatar_url, u.email::text
    from feedback f
    left join profiles p on p.id = f.user_id
    left join auth.users u on u.id = f.user_id
    where p_status is null or f.status = p_status
    order by f.created_at desc
    limit greatest(1, least(p_limit, 500));
end;
$$;
grant execute on function public.admin_list_feedback(text, int) to authenticated;

create or replace function public.admin_set_feedback_status(p_id bigint, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from staff s where s.user_id = auth.uid() and s.role = 'admin') then
    raise exception 'Só o admin pode mudar o feedback.';
  end if;
  update feedback set status = p_status where id = p_id;
end;
$$;
grant execute on function public.admin_set_feedback_status(bigint, text) to authenticated;

-- Avisa a API do Supabase de que há funções e tabelas novas (sem isto pode
-- dar "Could not find the function ... in the schema cache").
notify pgrst, 'reload schema';

-- PRIMEIRA VEZ: torna-te admin (troca O_TEU_USERNAME pelo teu username e corre só esta linha):
-- insert into public.staff (user_id, role) select id, 'admin' from public.profiles where username = 'O_TEU_USERNAME' on conflict (user_id) do update set role = 'admin';
