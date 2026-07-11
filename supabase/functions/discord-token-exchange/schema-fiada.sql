-- Corre isto no Supabase (SQL Editor → cola tudo → Run), depois de já teres
-- corrido o supabase/schema.sql do Palavras.

-- Mesma lógica de validação do jogo em JS, em versão SQL, para nunca
-- confiar cegamente no cliente.
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

-- Estado do duelo. Ao contrário do jogo de Palavras, aqui não há nada
-- secreto — os dois painéis ficam sempre visíveis aos dois jogadores.
create table fiada_duels (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  host_id uuid references auth.users(id) not null,
  guest_id uuid references auth.users(id),
  deck jsonb not null,
  draw_index int not null default 3,
  face_up jsonb not null default '[]'::jsonb,
  host_cells jsonb not null default '[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]'::jsonb,
  guest_cells jsonb not null default '[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]'::jsonb,
  host_moves int not null default 0,
  guest_moves int not null default 0,
  turn text not null default 'host' check (turn in ('host', 'guest')),
  pending_value int,
  status text not null default 'a-espera' check (status in ('a-espera', 'a-jogar', 'terminado')),
  winner_id uuid,
  created_at timestamptz not null default now()
);

alter table fiada_duels enable row level security;

create policy "participantes veem o duelo fiada"
  on fiada_duels for select
  using (auth.uid() = host_id or auth.uid() = guest_id);

create policy "anfitriao cria duelo fiada"
  on fiada_duels for insert
  with check (auth.uid() = host_id);

create or replace function fiada_join(p_code text)
returns fiada_duels
language plpgsql
security definer
as $$
declare
  d fiada_duels;
begin
  select * into d from fiada_duels where code = p_code for update;
  if d.id is null then
    raise exception 'Sala não encontrada';
  end if;
  if d.guest_id is not null and d.guest_id <> auth.uid() then
    raise exception 'Esta sala já tem dois jogadores';
  end if;
  update fiada_duels set guest_id = auth.uid(), status = 'a-jogar'
    where id = d.id and guest_id is null
    returning * into d;
  return d;
end;
$$;

create or replace function fiada_draw_blind(p_duel_id uuid)
returns fiada_duels
language plpgsql
security definer
as $$
declare
  d fiada_duels;
  my_turn text;
begin
  select * into d from fiada_duels where id = p_duel_id for update;
  if d.id is null then raise exception 'Duelo não encontrado'; end if;
  if d.status <> 'a-jogar' then raise exception 'O duelo não está em curso'; end if;
  my_turn := case when auth.uid() = d.host_id then 'host' when auth.uid() = d.guest_id then 'guest' else null end;
  if my_turn is null then raise exception 'Não pertences a este duelo'; end if;
  if d.turn <> my_turn then raise exception 'Não é a tua vez'; end if;
  if d.pending_value is not null then raise exception 'Já tens um azulejo na mão'; end if;
  if d.draw_index >= jsonb_array_length(d.deck) then raise exception 'Baralho esgotado'; end if;

  update fiada_duels
    set pending_value = (d.deck -> d.draw_index)::int,
        draw_index = d.draw_index + 1
    where id = p_duel_id
    returning * into d;
  return d;
end;
$$;

create or replace function fiada_pick_faceup(p_duel_id uuid, p_idx int)
returns fiada_duels
language plpgsql
security definer
as $$
declare
  d fiada_duels;
  my_turn text;
  value int;
  new_face jsonb;
begin
  select * into d from fiada_duels where id = p_duel_id for update;
  if d.id is null then raise exception 'Duelo não encontrado'; end if;
  if d.status <> 'a-jogar' then raise exception 'O duelo não está em curso'; end if;
  my_turn := case when auth.uid() = d.host_id then 'host' when auth.uid() = d.guest_id then 'guest' else null end;
  if my_turn is null then raise exception 'Não pertences a este duelo'; end if;
  if d.turn <> my_turn then raise exception 'Não é a tua vez'; end if;
  if d.pending_value is not null then raise exception 'Já tens um azulejo na mão'; end if;
  if p_idx < 0 or p_idx >= jsonb_array_length(d.face_up) then raise exception 'Escolha inválida'; end if;

  value := (d.face_up -> p_idx)::int;
  new_face := d.face_up - p_idx;

  if d.draw_index < jsonb_array_length(d.deck) then
    new_face := new_face || jsonb_build_array(d.deck -> d.draw_index);
    update fiada_duels set pending_value = value, face_up = new_face, draw_index = d.draw_index + 1
      where id = p_duel_id returning * into d;
  else
    update fiada_duels set pending_value = value, face_up = new_face
      where id = p_duel_id returning * into d;
  end if;
  return d;
end;
$$;

create or replace function fiada_place(p_duel_id uuid, p_index int)
returns fiada_duels
language plpgsql
security definer
as $$
declare
  d fiada_duels;
  my_turn text;
  other_turn text;
  my_cells jsonb;
  occupant jsonb;
  cells_without jsonb;
  won boolean;
begin
  select * into d from fiada_duels where id = p_duel_id for update;
  if d.id is null then raise exception 'Duelo não encontrado'; end if;
  if d.status <> 'a-jogar' then raise exception 'O duelo não está em curso'; end if;
  my_turn := case when auth.uid() = d.host_id then 'host' when auth.uid() = d.guest_id then 'guest' else null end;
  if my_turn is null then raise exception 'Não pertences a este duelo'; end if;
  if d.turn <> my_turn then raise exception 'Não é a tua vez'; end if;
  if d.pending_value is null then raise exception 'Não tens nenhum azulejo na mão'; end if;
  if p_index < 0 or p_index > 15 then raise exception 'Posição inválida'; end if;

  my_cells := case when my_turn = 'host' then d.host_cells else d.guest_cells end;
  occupant := my_cells -> p_index;
  cells_without := my_cells;
  if jsonb_typeof(occupant) <> 'null' then
    cells_without := jsonb_set(my_cells, array[p_index::text], 'null'::jsonb);
  end if;

  if not fiada_is_valid_placement(cells_without, p_index, d.pending_value) then
    raise exception 'Essa posição não respeita a ordem crescente';
  end if;

  my_cells := jsonb_set(cells_without, array[p_index::text], to_jsonb(d.pending_value));

  if jsonb_typeof(occupant) <> 'null' then
    update fiada_duels set face_up = face_up || jsonb_build_array(occupant) where id = p_duel_id;
    select * into d from fiada_duels where id = p_duel_id;
  end if;

  other_turn := case when my_turn = 'host' then 'guest' else 'host' end;
  won := not exists (
    select 1 from jsonb_array_elements(my_cells) elem where jsonb_typeof(elem) = 'null'
  );

  if my_turn = 'host' then
    update fiada_duels set
      host_cells = my_cells,
      host_moves = host_moves + 1,
      pending_value = null,
      turn = other_turn,
      status = case when won then 'terminado' else status end,
      winner_id = case when won then auth.uid() else winner_id end
      where id = p_duel_id returning * into d;
  else
    update fiada_duels set
      guest_cells = my_cells,
      guest_moves = guest_moves + 1,
      pending_value = null,
      turn = other_turn,
      status = case when won then 'terminado' else status end,
      winner_id = case when won then auth.uid() else winner_id end
      where id = p_duel_id returning * into d;
  end if;

  return d;
end;
$$;

create or replace function fiada_discard(p_duel_id uuid)
returns fiada_duels
language plpgsql
security definer
as $$
declare
  d fiada_duels;
  my_turn text;
  other_turn text;
begin
  select * into d from fiada_duels where id = p_duel_id for update;
  if d.id is null then raise exception 'Duelo não encontrado'; end if;
  if d.status <> 'a-jogar' then raise exception 'O duelo não está em curso'; end if;
  my_turn := case when auth.uid() = d.host_id then 'host' when auth.uid() = d.guest_id then 'guest' else null end;
  if my_turn is null then raise exception 'Não pertences a este duelo'; end if;
  if d.turn <> my_turn then raise exception 'Não é a tua vez'; end if;
  if d.pending_value is null then raise exception 'Não tens nenhum azulejo na mão'; end if;

  other_turn := case when my_turn = 'host' then 'guest' else 'host' end;
  update fiada_duels set pending_value = null, turn = other_turn where id = p_duel_id
    returning * into d;
  return d;
end;
$$;

alter publication supabase_realtime add table fiada_duels;