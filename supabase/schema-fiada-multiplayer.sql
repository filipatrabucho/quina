-- Corre isto no Supabase (SQL Editor → cola tudo → Run).
-- Isto SUBSTITUI o esquema anterior do Fiada 1vs1 (schema-fiada.sql) por um
-- que suporta salas com 2 a 5 jogadores. Remove primeiro o que já existia.

drop function if exists fiada_discard(uuid);
drop function if exists fiada_place(uuid, int);
drop function if exists fiada_pick_faceup(uuid, int);
drop function if exists fiada_draw_blind(uuid);
drop function if exists fiada_join(text);
drop table if exists fiada_duels;
drop function if exists fiada_is_valid_placement(jsonb, int, int);

-- Mesma lógica de validação de sempre, em SQL, para nunca confiar cegamente
-- no cliente.
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
    if jsonb_typeof(other) = 'null' then continue; end if;
    if c < grid_col and (other)::int >= value then return false; end if;
    if c > grid_col and (other)::int <= value then return false; end if;
  end loop;

  for r in 0..3 loop
    if r = grid_row then continue; end if;
    other := cells -> (r * 4 + grid_col);
    if jsonb_typeof(other) = 'null' then continue; end if;
    if r < grid_row and (other)::int >= value then return false; end if;
    if r > grid_row and (other)::int <= value then return false; end if;
  end loop;

  return true;
end;
$$;

-- "players" é um array jsonb: [{ "id": uuid, "cells": [16 valores], "moves": n }, ...]
-- A ordem no array É a ordem de turno.
create table fiada_rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid references auth.users(id) not null,
  max_players int not null default 5 check (max_players between 2 and 5),
  players jsonb not null default '[]'::jsonb,
  deck jsonb not null,
  draw_index int not null default 0,
  face_up jsonb not null default '[]'::jsonb,
  turn_index int not null default 0,
  pending_value int,
  status text not null default 'a-espera' check (status in ('a-espera', 'a-jogar', 'terminado')),
  winner_id uuid,
  created_at timestamptz not null default now()
);

alter table fiada_rooms enable row level security;

create policy "participantes veem a sala fiada"
  on fiada_rooms for select
  using (
    auth.uid() = host_id
    or exists (
      select 1 from jsonb_array_elements(players) p
      where (p ->> 'id')::uuid = auth.uid()
    )
  );

create policy "anfitriao cria a sala fiada"
  on fiada_rooms for insert
  with check (auth.uid() = host_id);

create or replace function fiada_join_room(p_code text)
returns fiada_rooms
language plpgsql
security definer
as $$
declare
  r fiada_rooms;
  already_in boolean;
begin
  select * into r from fiada_rooms where code = p_code for update;
  if r.id is null then raise exception 'Sala não encontrada'; end if;
  if r.status <> 'a-espera' then raise exception 'Esta sala já começou'; end if;

  select exists(
    select 1 from jsonb_array_elements(r.players) p where (p ->> 'id')::uuid = auth.uid()
  ) into already_in;

  if already_in then
    return r;
  end if;

  if jsonb_array_length(r.players) >= r.max_players then
    raise exception 'Esta sala já está cheia';
  end if;

  update fiada_rooms
    set players = players || jsonb_build_array(jsonb_build_object(
      'id', auth.uid(),
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
as $$
declare
  r fiada_rooms;
begin
  select * into r from fiada_rooms where id = p_room_id for update;
  if r.id is null then raise exception 'Sala não encontrada'; end if;
  if auth.uid() <> r.host_id then raise exception 'Só o anfitrião pode começar o jogo'; end if;
  if r.status <> 'a-espera' then raise exception 'O jogo já começou'; end if;
  if jsonb_array_length(r.players) < 2 then raise exception 'Precisas de pelo menos 2 jogadores'; end if;

  update fiada_rooms set status = 'a-jogar', turn_index = 0 where id = p_room_id
    returning * into r;
  return r;
end;
$$;

create or replace function fiada_draw_blind(p_room_id uuid)
returns fiada_rooms
language plpgsql
security definer
as $$
declare
  r fiada_rooms;
  current_player_id uuid;
begin
  select * into r from fiada_rooms where id = p_room_id for update;
  if r.id is null then raise exception 'Sala não encontrada'; end if;
  if r.status <> 'a-jogar' then raise exception 'O jogo não está em curso'; end if;

  current_player_id := (r.players -> r.turn_index ->> 'id')::uuid;
  if auth.uid() <> current_player_id then raise exception 'Não é a tua vez'; end if;
  if r.pending_value is not null then raise exception 'Já tens um azulejo na mão'; end if;
  if r.draw_index >= jsonb_array_length(r.deck) then raise exception 'Baralho esgotado'; end if;

  update fiada_rooms
    set pending_value = (r.deck -> r.draw_index)::int,
        draw_index = r.draw_index + 1
    where id = p_room_id
    returning * into r;
  return r;
end;
$$;

create or replace function fiada_pick_faceup(p_room_id uuid, p_idx int)
returns fiada_rooms
language plpgsql
security definer
as $$
declare
  r fiada_rooms;
  current_player_id uuid;
  value int;
  new_face jsonb;
begin
  select * into r from fiada_rooms where id = p_room_id for update;
  if r.id is null then raise exception 'Sala não encontrada'; end if;
  if r.status <> 'a-jogar' then raise exception 'O jogo não está em curso'; end if;

  current_player_id := (r.players -> r.turn_index ->> 'id')::uuid;
  if auth.uid() <> current_player_id then raise exception 'Não é a tua vez'; end if;
  if r.pending_value is not null then raise exception 'Já tens um azulejo na mão'; end if;
  if p_idx < 0 or p_idx >= jsonb_array_length(r.face_up) then raise exception 'Escolha inválida'; end if;

  value := (r.face_up -> p_idx)::int;
  new_face := r.face_up - p_idx;

  if r.draw_index < jsonb_array_length(r.deck) then
    new_face := new_face || jsonb_build_array(r.deck -> r.draw_index);
    update fiada_rooms set pending_value = value, face_up = new_face, draw_index = r.draw_index + 1
      where id = p_room_id returning * into r;
  else
    update fiada_rooms set pending_value = value, face_up = new_face
      where id = p_room_id returning * into r;
  end if;
  return r;
end;
$$;

create or replace function fiada_place(p_room_id uuid, p_index int)
returns fiada_rooms
language plpgsql
security definer
as $$
declare
  r fiada_rooms;
  current_player_id uuid;
  my_cells jsonb;
  occupant jsonb;
  cells_without jsonb;
  won boolean;
  next_turn int;
  new_players jsonb;
begin
  select * into r from fiada_rooms where id = p_room_id for update;
  if r.id is null then raise exception 'Sala não encontrada'; end if;
  if r.status <> 'a-jogar' then raise exception 'O jogo não está em curso'; end if;

  current_player_id := (r.players -> r.turn_index ->> 'id')::uuid;
  if auth.uid() <> current_player_id then raise exception 'Não é a tua vez'; end if;
  if r.pending_value is null then raise exception 'Não tens nenhum azulejo na mão'; end if;
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
  new_players := jsonb_set(
    new_players,
    array[r.turn_index::text, 'moves'],
    to_jsonb(((r.players -> r.turn_index ->> 'moves')::int) + 1)
  );

  won := not exists (
    select 1 from jsonb_array_elements(my_cells) elem where jsonb_typeof(elem) = 'null'
  );

  next_turn := (r.turn_index + 1) % jsonb_array_length(r.players);

  update fiada_rooms set
    players = new_players,
    face_up = case when jsonb_typeof(occupant) <> 'null' then face_up || jsonb_build_array(occupant) else face_up end,
    pending_value = null,
    turn_index = next_turn,
    status = case when won then 'terminado' else status end,
    winner_id = case when won then auth.uid() else winner_id end
    where id = p_room_id
    returning * into r;

  return r;
end;
$$;

create or replace function fiada_discard(p_room_id uuid)
returns fiada_rooms
language plpgsql
security definer
as $$
declare
  r fiada_rooms;
  current_player_id uuid;
  next_turn int;
begin
  select * into r from fiada_rooms where id = p_room_id for update;
  if r.id is null then raise exception 'Sala não encontrada'; end if;
  if r.status <> 'a-jogar' then raise exception 'O jogo não está em curso'; end if;

  current_player_id := (r.players -> r.turn_index ->> 'id')::uuid;
  if auth.uid() <> current_player_id then raise exception 'Não é a tua vez'; end if;
  if r.pending_value is null then raise exception 'Não tens nenhum azulejo na mão'; end if;

  next_turn := (r.turn_index + 1) % jsonb_array_length(r.players);
  update fiada_rooms set pending_value = null, turn_index = next_turn where id = p_room_id
    returning * into r;
  return r;
end;
$$;

alter publication supabase_realtime add table fiada_rooms;