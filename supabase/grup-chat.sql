-- ============================================================================
-- KOYEN: Grup Chat Publik (login Google, admin, realtime)
-- Jalankan SEKALI: Supabase Dashboard > SQL Editor > New query > tempel semua
-- isi file ini > Run. Aman dijalankan ulang (memakai "if not exists" / "or replace").
-- ============================================================================

-- ---------- 1) Tabel ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  role text not null default 'member' check (role in ('member', 'admin')),
  banned boolean not null default false,
  muted_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  content text not null,
  reply_to uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  constraint messages_content_len check (deleted_at is not null or char_length(btrim(content)) between 1 and 1000)
);
create index if not exists messages_created_idx on public.messages (created_at desc);

create table if not exists public.group_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'Grup KOYEN' check (char_length(name) between 1 and 40),
  description text not null default '' check (char_length(description) <= 300),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  only_admin_can_send boolean not null default false,
  slow_mode_seconds int not null default 0 check (slow_mode_seconds between 0 and 600),
  pinned_message_id uuid references public.messages(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.group_settings (id) values (1) on conflict do nothing;

create table if not exists public.reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮', '🙏', '😢')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

-- ---------- 2) Fungsi bantu (dipakai aturan keamanan) ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not banned);
$$;

create or replace function public.is_member_ok() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and not banned);
$$;

-- Boleh kirim pesan? Admin selalu boleh. Anggota biasa: tidak diblokir, tidak
-- dibisukan, grup tidak sedang "hanya admin", dan sudah lewat jeda mode lambat
-- (minimal 1 detik antar pesan sebagai pengaman anti-spam).
create or replace function public.can_send() returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles;
  s public.group_settings;
  last_at timestamptz;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found or p.banned then return false; end if;
  if p.role = 'admin' then return true; end if;
  if p.muted_until is not null and p.muted_until > now() then return false; end if;
  select * into s from public.group_settings where id = 1;
  if s.only_admin_can_send then return false; end if;
  select max(created_at) into last_at from public.messages where user_id = auth.uid();
  if last_at is not null and last_at > now() - make_interval(secs => greatest(s.slow_mode_seconds, 1)) then
    return false;
  end if;
  return true;
end;
$$;

-- ---------- 3) Profil otomatis saat pertama kali login Google ----------
-- Nama yang tampil = NAMA DEPAN saja (email tidak disimpan di profil/tidak terlihat anggota lain).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(nullif(split_part(coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), ' ', 1), ''), split_part(new.email, '@', 1), 'Anggota'), 20),
    case when new.raw_user_meta_data->>'avatar_url' ~ '^https://' then new.raw_user_meta_data->>'avatar_url' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Untuk akun yang sudah pernah login sebelum SQL ini dijalankan.
insert into public.profiles (id, display_name, avatar_url)
select u.id,
       left(coalesce(nullif(split_part(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', ''), ' ', 1), ''), split_part(u.email, '@', 1), 'Anggota'), 20),
       case when u.raw_user_meta_data->>'avatar_url' ~ '^https://' then u.raw_user_meta_data->>'avatar_url' end
from auth.users u
on conflict (id) do nothing;

-- ---------- 4) Trigger pelindung ----------
-- Anggota biasa tidak boleh mengubah role / blokir / bisu, walau memanggil API langsung.
-- (auth.uid() kosong = dijalankan dari SQL Editor / service role, jadi tidak dibatasi.)
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.banned := old.banned;
    new.muted_until := old.muted_until;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_trg on public.profiles;
create trigger protect_profile_trg before update on public.profiles
  for each row execute function public.protect_profile();

-- Pesan hanya bisa diubah dengan cara "dihapus" (isi dikosongkan). Isi, pengirim,
-- dan waktu tidak bisa diedit.
create or replace function public.protect_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  new.user_id := old.user_id;
  new.reply_to := old.reply_to;
  new.created_at := old.created_at;
  if old.deleted_at is not null then return old; end if;
  if new.deleted_at is not null then
    new.deleted_at := now();
    new.deleted_by := auth.uid();
    new.content := '';
  else
    new.content := old.content;
    new.deleted_by := old.deleted_by;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_message_trg on public.messages;
create trigger protect_message_trg before update on public.messages
  for each row execute function public.protect_message();

create or replace function public.touch_settings() returns trigger
language plpgsql as $$
begin
  new.id := 1;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists touch_settings_trg on public.group_settings;
create trigger touch_settings_trg before update on public.group_settings
  for each row execute function public.touch_settings();

-- ---------- 5) Aturan keamanan (Row Level Security) ----------
alter table public.profiles enable row level security;
alter table public.messages enable row level security;
alter table public.group_settings enable row level security;
alter table public.reactions enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated using (public.is_member_ok());
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (user_id = auth.uid() and public.can_send());
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
  using (public.is_member_ok() and (user_id = auth.uid() or public.is_admin()))
  with check (public.is_member_ok() and (user_id = auth.uid() or public.is_admin()));

drop policy if exists reactions_select on public.reactions;
create policy reactions_select on public.reactions for select to authenticated using (public.is_member_ok());
drop policy if exists reactions_insert on public.reactions;
create policy reactions_insert on public.reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_member_ok());
drop policy if exists reactions_delete on public.reactions;
create policy reactions_delete on public.reactions for delete to authenticated using (user_id = auth.uid());

-- Nama/deskripsi/foto grup boleh dilihat siapa saja (untuk layar login).
drop policy if exists settings_select on public.group_settings;
create policy settings_select on public.group_settings for select to anon, authenticated using (true);
drop policy if exists settings_update on public.group_settings;
create policy settings_update on public.group_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- 6) Izin akses tabel ----------
-- Wajib karena project dibuat dengan "Automatically expose new tables" dimatikan.
grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select, insert, delete on public.reactions to authenticated;
grant select on public.group_settings to anon;
grant select, update on public.group_settings to authenticated;

-- ---------- 7) Realtime ----------
do $$
begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.reactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.group_settings; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
end $$;

-- ---------- 8) ADMIN PERTAMA ----------
-- Login ke /grup dengan akun Google-mu SEKALI dulu, lalu jalankan perintah ini
-- (ganti emailnya dengan email Google yang kamu pakai, hapus tanda "--" di depan):
--
-- update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'emailkamu@gmail.com');

-- ---------- 9) (Opsional) Hapus pesan lama otomatis ----------
-- Supaya database gratis tidak cepat penuh. Aktifkan extension pg_cron dulu di
-- Database > Extensions, lalu jalankan:
--
-- select cron.schedule('hapus-pesan-lama', '0 3 * * *',
--   $$ delete from public.messages where created_at < now() - interval '30 days' $$);
