-- Corre isto no Supabase (SQL Editor → cola tudo → Run).
-- Contas com email + password + username, e avatares (Storage).
-- Pode ser corrido mais do que uma vez sem estragar nada.

-- Perfis públicos: um por conta "a sério" (as sessões anónimas de
-- convidado e do Discord não criam perfil). Serve sobretudo para garantir
-- que cada username é único.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  constraint profiles_username_formato check (username ~ '^[A-Za-z0-9_.]{3,20}$')
);

create unique index if not exists profiles_username_unico on public.profiles (lower(username));

alter table public.profiles enable row level security;

drop policy if exists "perfis são públicos" on public.profiles;
create policy "perfis são públicos"
  on public.profiles for select
  using (true);

drop policy if exists "cada um edita o seu perfil" on public.profiles;
create policy "cada um edita o seu perfil"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Para o formulário de registo avisar logo se o username já está tomado.
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(trim(p_username)));
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- Cria o perfil automaticamente quando alguém se regista com username.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
begin
  if v_username is not null then
    insert into public.profiles (id, username, avatar_url)
    values (new.id, v_username, new.raw_user_meta_data ->> 'avatar_url');
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Bucket público para os avatares. Cada utilizador só pode escrever na
-- sua própria pasta: avatars/<id do utilizador>/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatares: ler" on storage.objects;
create policy "avatares: ler"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatares: carregar o meu" on storage.objects;
create policy "avatares: carregar o meu"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatares: atualizar o meu" on storage.objects;
create policy "avatares: atualizar o meu"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatares: apagar o meu" on storage.objects;
create policy "avatares: apagar o meu"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
