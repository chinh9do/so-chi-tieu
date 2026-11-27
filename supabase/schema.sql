-- Sổ chi tiêu: bảng lưu dữ liệu đồng bộ (đã mã hoá đầu-cuối trên máy)
-- Chạy 1 lần trong Supabase → SQL Editor → New query → Run. Chạy lại cũng không sao.

create sequence if not exists public.items_rev_seq;

create table if not exists public.items (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null,          -- mã bản ghi đã băm (HMAC), server không đọc được
  iv         text        not null,          -- vector khởi tạo AES-GCM
  data       text        not null,          -- nội dung đã mã hoá
  rev        bigint      not null default nextval('public.items_rev_seq'),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists items_user_rev on public.items (user_id, rev);

-- Mỗi lần thêm/sửa: cấp số thứ tự mới để các máy khác biết cần kéo về
create or replace function public.items_bump() returns trigger
language plpgsql set search_path = public as $$
begin
  new.rev := nextval('public.items_rev_seq');
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists items_bump on public.items;
create trigger items_bump before insert or update on public.items
  for each row execute function public.items_bump();

-- Muối (salt) và chuỗi kiểm tra mật khẩu mã hoá, mỗi tài khoản 1 dòng
create table if not exists public.vault (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  salt       text not null,
  check_iv   text not null,
  check_ct   text not null,
  created_at timestamptz not null default now()
);

-- Quyền: chỉ chủ tài khoản đã đăng nhập mới đọc/ghi được dòng của mình
alter table public.items enable row level security;
alter table public.vault enable row level security;

drop policy if exists items_select on public.items;
drop policy if exists items_insert on public.items;
drop policy if exists items_update on public.items;
create policy items_select on public.items for select to authenticated using (auth.uid() = user_id);
create policy items_insert on public.items for insert to authenticated with check (auth.uid() = user_id);
create policy items_update on public.items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists vault_select on public.vault;
drop policy if exists vault_insert on public.vault;
create policy vault_select on public.vault for select to authenticated using (auth.uid() = user_id);
create policy vault_insert on public.vault for insert to authenticated with check (auth.uid() = user_id);

revoke all on public.items, public.vault from anon;
grant select, insert, update on public.items to authenticated;
grant select, insert on public.vault to authenticated;
grant usage, select on sequence public.items_rev_seq to authenticated;
