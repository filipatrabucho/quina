-- Corre isto no Supabase (SQL Editor → cola tudo → Run).
-- Fiada multiplayer (2 a 5 jogadores), versão 4:
--  * ao começar, monta o baralho (um conjunto de 1 a 20 por jogador) e
--    põe 4 trevos na diagonal de cada painel, por ordem crescente;
--  * no início de cada vez, vira automaticamente uma carta do baralho:
--    o jogador coloca-a ("aceitar"), descarta-a para a mesa ("passar") ou
--    troca-a por uma carta à escolha da mesa (uma vez por vez);
--  * quando o baralho acaba, joga-se com as cartas da mesa; se também a
--    mesa acabar, ganha quem tiver o painel mais preenchido.
-- Pode ser corrido mais do que uma vez (substitui as versões anteriores).

create table if not exists fiada_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid references auth.users(id) not null,
  max_players int not null default 5 check (max_players between 2 and 5),
  players jsonb not null default '[]'::jsonb,
  deck jsonb not null default '[]'::jsonb,
  draw_index int not null default 0,
  face_up jsonb not null default '[]'::jsonb,
  turn_index int not null default 0,
  pending_value int,
  status text not null default 'a-espera' check (status in ('a-espera', 'a-jogar', 'terminado')),
  winner_id uuid,
  created_at timestamptz not null default now()
);
alter table fiada_rooms alter column deck set default '[]'::jsonb;
-- De onde veio a carta na mão: 'baralho' ou 'mesa' (só se troca uma vez).
alter table fiada_rooms add column if not exists pending_source text;

alter table fiada_rooms enable row level security;

drop policy if exists "participantes veem a sala fiada" on fiada_rooms;
create policy "participantes veem a sala fiada"
  on fiada_rooms for select
  using (
    auth.uid() = host_id
    or exists (select 1 from jsonb_array_elements(players) p where (p ->> 'id')::uuid = auth.uid())
  );

drop policy if exists "anfitriao cria a sala fiada" on fiada_rooms;
create policy "anfitriao cria a sala fiada"
  on fiada_rooms for insert
  with check (auth.uid() = host_id);

-- Remove versões antigas (assinaturas diferentes)
drop function if exists fiada_join_room(text);
drop function if exists fiada_join_room(text, text, text);
drop function if exists fiada_start_room(uuid);
drop function if exists fiada_draw_blind(uuid);
drop function if exists fiada_pick_faceup(uuid, int);
drop function if exists fiada_place(uuid, int);
drop function if exists fiada_discard(uuid);
drop function if exists fiada_pass_turn(uuid);
drop function if exists fiada_next_turn(fiada_rooms);
drop function if exists fiada_finish_turn(uuid, int);

create or replace function fiada_is_valid_placement(cells jsonb, idx int, value int)
returns boolean
language plpgsql
immutable
as $$
declare
  grid_row int := idx / 4;
  grid_col int := idx % 4;
  c int;
  r int;
  other jsonb;
begin
  for c in 0..3 loop
    if c = grid_col then continue; end if;
    other := cells -> (grid_row * 4 + c);
    if other is null or jsonb_typeof(other) = 'null' then continue; end if;
    if c < grid_col and (other)::int >= value then return false; end if;
    if c > grid_col and (other)::int <= value then return false; end if;
  end loop;
  for r in 0..3 loop
    if r = grid_row then continue; end if;
    other := cells -> (r * 4 + grid_col);
    if other is null or jsonb_typeof(other) = 'null' then continue; end if;
    if r < grid_row and (other)::int >= value then return false; end if;
    if r > grid_row and (other)::int <= value then return false; end if;
  end loop;
  return true;
end;
$$;

-- Passa a vez ao jogador seguinte e vira-lhe logo uma carta do baralho.
-- Se o baralho e a mesa estiverem vazios, o jogo acaba.
create or replace function fiada_finish_turn(p_room_id uuid, p_next int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r fiada_rooms;
  best_id uuid;
begin
  select * into r from fiada_rooms where id = p_room_id;
  if r.draw_index < jsonb_array_length(r.deck) then
    update fiada_rooms
      set turn_index = p_next,
          pending_value = (r.deck -> r.draw_index)::int,
          pending_source = 'baralho',
          draw_index = r.draw_index + 1
      where id = p_room_id;
  elsif jsonb_array_length(r.face_up) > 0 then
    update fiada_rooms set turn_index = p_next, pending_value = null, pending_source = null where id = p_room_id;
  else
    -- Sem cartas: ganha quem tiver mais casas preenchidas.
    select (p ->> 'id')::uuid into best_id
      from jsonb_array_elements(r.players) with ordinality as t(p, ord)
      order by (select count(*) from jsonb_array_elements(p -> 'cells') c where jsonb_typeof(c) <> 'null') desc,
               (p ->> 'moves')::int asc,
               ord asc
      limit 1;
    update fiada_rooms
      set turn_index = p_next, pending_value = null, pending_source = null, status = 'terminado', winner_id = best_id
      where id = p_room_id;
  end if;
end;
$$;

create or replace function fiada_join_room(p_code text, p_name text default null, p_avatar text default null)
returns fiada_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r fiada_rooms;
begin
  select * into r from fiada_rooms where code = p_code for update;
  if r.id is null then raise exception 'Sala não encontrada'; end if;

  if exists (select 1 from jsonb_array_elements(r.players) p where (p ->> 'id')::uuid = auth.uid()) then
    return r;
  end if;
  if r.status <> 'a-espera' then raise exception 'Esta sala já começou'; end if;
  if jsonb_array_length(r.players) >= r.max_players then raise exception 'Esta sala já está cheia'; end if;

  update fiada_rooms
    set players = players || jsonb_build_array(jsonb_build_object(
      'id', auth.uid(),
      'name', coalesce(nullif(trim(p_name), ''), 'Jogador'),
      'avatar', p_avatar,
      'cells', '[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]'::jsonb,
      'moves', 0
    ))
    where id = r.id
    returning * into r;
  return r;
end;
$$;

create or replace function fiada_start_room(p_room_id uuid)
returns fiada_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r fiada_rooms;
  n int;
  new_deck jsonb;
  new_players jsonb := '[]'::jsonb;
  i int;
  diag int[];
  cells jsonb;
  pos int := 0;
  rest int[];
  diag_tiles jsonb;
begin
  select * into r from fiada_rooms where id = p_room_id for update;
  if r.id is null then raise exception 'Sala não encontrada'; end if;
  if auth.uid() <> r.host_id then raise exception 'Só o anfitrião pode começar o jogo'; end if;
  if r.status <> 'a-espera' then raise exception 'O jogo já começou'; end if;
  n := jsonb_array_length(r.players);
  if n < 2 then raise exception 'Precisas de pelo menos 2 jogadores'; end if;

  -- Cada jogador tem o seu conjunto de 1 a 20. Tira 4 números diferentes
  -- desse conjunto para a diagonal (por ordem crescente); o resto de todos
  -- os conjuntos vai para o baralho, baralhado.
  rest := '{}'::int[];
  diag_tiles := '[]'::jsonb;
  for i in 0..n - 1 loop
    select array_agg(v order by v) into diag
      from (select v from generate_series(1, 20) v order by random() limit 4) d;
    rest := rest || array(select v from generate_series(1, 20) v where v <> all(diag));
    diag_tiles := diag_tiles || to_jsonb(diag);
    cells := '[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]'::jsonb;
    cells := jsonb_set(cells, '{0}', to_jsonb(diag[1]));
    cells := jsonb_set(cells, '{5}', to_jsonb(diag[2]));
    cells := jsonb_set(cells, '{10}', to_jsonb(diag[3]));
    cells := jsonb_set(cells, '{15}', to_jsonb(diag[4]));
    new_players := new_players || jsonb_build_array(
      jsonb_set(jsonb_set(r.players -> i, '{cells}', cells), '{moves}', '0'::jsonb)
    );
  end loop;
  select diag_tiles || coalesce(jsonb_agg(v order by random()), '[]'::jsonb) into new_deck from unnest(rest) v;
  pos := 4 * n;

  update fiada_rooms
    set status = 'a-jogar',
        players = new_players,
        deck = new_deck,
        draw_index = pos + 1,
        face_up = '[]'::jsonb,
        pending_value = (new_deck -> pos)::int,   -- a primeira carta já virada
        pending_source = 'baralho',
        turn_index = 0,
        winner_id = null
    where id = p_room_id
    returning * into r;
  return r;
end;
$$;

-- Só para quando não houver carta na mão e ainda houver baralho
-- (normalmente a carta já vem virada automaticamente).
create or replace function fiada_draw_blind(p_room_id uuid)
returns fiada_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r fiada_rooms;
begin
  select * into r from fiada_rooms where id = p_room_id for update;
  if r.id is null then raise exception 'Sala não encontrada'; end if;
  if r.status <> 'a-jogar' then raise exception 'O jogo não está em curso'; end if;
  if auth.uid() <> (r.players -> r.turn_index ->> 'id')::uuid then raise exception 'Não é a tua vez'; end if;
  if r.pending_value is not null then raise exception 'Já tens uma carta na mão'; end if;
  if r.draw_index >= jsonb_array_length(r.deck) then raise exception 'Baralho esgotado'; end if;

  update fiada_rooms
    set pending_value = (r.deck -> r.draw_index)::int, pending_source = 'baralho', draw_index = r.draw_index + 1
    where id = p_room_id
    returning * into r;
  return r;
end;
$$;

-- Escolhe uma carta da mesa. Se já tiver na mão a carta virada do
-- baralho, as duas trocam (a do baralho vai para a mesa). Só uma troca por vez.
create or replace function fiada_pick_faceup(p_room_id uuid, p_idx int)
returns fiada_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r fiada_rooms;
  new_face jsonb;
begin
  select * into r from fiada_rooms where id = p_room_id for update;
  if r.id is null then raise exception 'Sala não encontrada'; end if;
  if r.status <> 'a-jogar' then raise exception 'O jogo não está em curso'; end if;
  if auth.uid() <> (r.players -> r.turn_index ->> 'id')::uuid then raise exception 'Não é a tua vez'; end if;
  if r.pending_value is not null and r.pending_source = 'mesa' then
    raise exception 'Já foste buscar uma carta à mesa nesta vez';
  end if;
  if p_idx < 0 or p_idx >= jsonb_array_length(r.face_up) then raise exception 'Escolha inválida'; end if;

  new_face := r.face_up - p_idx;
  if r.pending_value is not null then
    new_face := new_face || jsonb_build_array(r.pending_value);
  end if;

  update fiada_rooms
    set pending_value = (r.face_up -> p_idx)::int, pending_source = 'mesa', face_up = new_face
    where id = p_room_id
    returning * into r;
  return r;
end;
$$;

-- Aceitar: coloca a carta da mão numa casa (vazia ou a trocar).
create or replace function fiada_place(p_room_id uuid, p_index int)
returns fiada_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r fiada_rooms;
  my_cells jsonb;
  occupant jsonb;
  cells_without jsonb;
  won boolean;
  new_players jsonb;
begin
  select * into r from fiada_rooms where id = p_room_id for update;
  if r.id is null then raise exception 'Sala não encontrada'; end if;
  if r.status <> 'a-jogar' then raise exception 'O jogo não está em curso'; end if;
  if auth.uid() <> (r.players -> r.turn_index ->> 'id')::uuid then raise exception 'Não é a tua vez'; end if;
  if r.pending_value is null then raise exception 'Não tens nenhuma carta na mão'; end if;
  if p_index < 0 or p_index > 15 then raise exception 'Posição inválida'; end if;

  my_cells := r.players -> r.turn_index -> 'cells';
  occupant := my_cells -> p_index;
  cells_without := my_cells;
  if jsonb_typeof(occupant) <> 'null' then
    cells_without := jsonb_set(my_cells, array[p_index::text], 'null'::jsonb);
  end if;
  if not fiada_is_valid_placement(cells_without, p_index, r.pending_value) then
    raise exception 'Essa posição não respeita a ordem crescente';
  end if;

  my_cells := jsonb_set(cells_without, array[p_index::text], to_jsonb(r.pending_value));
  new_players := jsonb_set(r.players, array[r.turn_index::text, 'cells'], my_cells);
  new_players := jsonb_set(new_players, array[r.turn_index::text, 'moves'],
    to_jsonb(coalesce((r.players -> r.turn_index ->> 'moves')::int, 0) + 1));
  won := not exists (select 1 from jsonb_array_elements(my_cells) e where jsonb_typeof(e) = 'null');

  update fiada_rooms set
    players = new_players,
    face_up = case when jsonb_typeof(occupant) <> 'null' then face_up || jsonb_build_array(occupant) else face_up end,
    pending_value = null,
    pending_source = null,
    status = case when won then 'terminado' else status end,
    winner_id = case when won then auth.uid() else winner_id end
    where id = p_room_id;

  if not won then
    perform fiada_finish_turn(p_room_id, (r.turn_index + 1) % jsonb_array_length(r.players));
  end if;
  select * into r from fiada_rooms where id = p_room_id;
  return r;
end;
$$;

-- Passar: a carta da mão vai para a mesa e a vez passa.
create or replace function fiada_discard(p_room_id uuid)
returns fiada_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r fiada_rooms;
begin
  select * into r from fiada_rooms where id = p_room_id for update;
  if r.id is null then raise exception 'Sala não encontrada'; end if;
  if r.status <> 'a-jogar' then raise exception 'O jogo não está em curso'; end if;
  if auth.uid() <> (r.players -> r.turn_index ->> 'id')::uuid then raise exception 'Não é a tua vez'; end if;
  if r.pending_value is null then raise exception 'Não tens nenhuma carta na mão'; end if;

  update fiada_rooms
    set face_up = face_up || jsonb_build_array(r.pending_value), pending_value = null, pending_source = null
    where id = p_room_id;
  perform fiada_finish_turn(p_room_id, (r.turn_index + 1) % jsonb_array_length(r.players));
  select * into r from fiada_rooms where id = p_room_id;
  return r;
end;
$$;

-- Passar sem carta (ex.: nenhuma carta da mesa serve).
create or replace function fiada_pass_turn(p_room_id uuid)
returns fiada_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  r fiada_rooms;
begin
  select * into r from fiada_rooms where id = p_room_id for update;
  if r.id is null then raise exception 'Sala não encontrada'; end if;
  if r.status <> 'a-jogar' then raise exception 'O jogo não está em curso'; end if;
  if auth.uid() <> (r.players -> r.turn_index ->> 'id')::uuid then raise exception 'Não é a tua vez'; end if;
  if r.pending_value is not null then raise exception 'Primeiro coloca ou passa a carta da mão'; end if;

  perform fiada_finish_turn(p_room_id, (r.turn_index + 1) % jsonb_array_length(r.players));
  select * into r from fiada_rooms where id = p_room_id;
  return r;
end;
$$;

revoke execute on function fiada_finish_turn(uuid, int) from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'fiada_rooms'
  ) then
    alter publication supabase_realtime add table fiada_rooms;
  end if;
end $$;
