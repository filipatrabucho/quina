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
  check (game in ('palavras', 'fiada', 'quatro', 'galo', 'xadrez', 'memes', 'naval', 'stop', 'cartas', 'snake', 'memoria', 'noventa', 'verdades', 'frase', 'emojis', 'colonos'));
alter table public.player_stats enable row level security;
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

  insert into player_stats as ps (user_id, game, plays, wins, streak, best_streak)
  values (uid, p_game, 1, case when p_won then 1 else 0 end, case when p_won then 1 else 0 end, case when p_won then 1 else 0 end)
  on conflict (user_id, game) do update set
    plays = ps.plays + 1,
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
  foreach t in array array['messages', 'friendships', 'user_medals'] loop
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

-- PRIMEIRA VEZ: torna-te admin (troca O_TEU_USERNAME pelo teu username e corre só esta linha):
-- insert into public.staff (user_id, role) select id, 'admin' from public.profiles where username = 'O_TEU_USERNAME' on conflict (user_id) do update set role = 'admin';
