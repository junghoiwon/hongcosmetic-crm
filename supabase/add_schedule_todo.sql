-- ============================================================
-- 대시보드 "일정" 위젯 + "할 일(To-do)" 위젯을 위한 테이블
-- ============================================================

-- 1) schedule_events: 팀 전체가 공유하는 일정 (오늘/이번주 위젯에서 사용)
create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  event_type text not null default '기타',
  client_id uuid references public.customers(id) on delete set null,
  memo text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists schedule_events_event_date_idx on public.schedule_events(event_date);

alter table public.schedule_events enable row level security;

drop policy if exists "schedule_events_select" on public.schedule_events;
drop policy if exists "schedule_events_insert" on public.schedule_events;
drop policy if exists "schedule_events_update" on public.schedule_events;
drop policy if exists "schedule_events_delete" on public.schedule_events;

-- 로그인한 누구나 팀 일정을 보고 등록할 수 있습니다. 수정/삭제는 작성자 본인이나 관리자만.
create policy "schedule_events_select" on public.schedule_events
  for select using (auth.uid() is not null);
create policy "schedule_events_insert" on public.schedule_events
  for insert with check (auth.uid() is not null);
create policy "schedule_events_update" on public.schedule_events
  for update using (created_by = auth.uid() or is_admin()) with check (created_by = auth.uid() or is_admin());
create policy "schedule_events_delete" on public.schedule_events
  for delete using (created_by = auth.uid() or is_admin());

revoke all on table public.schedule_events from anon;
grant select, insert, update, delete on table public.schedule_events to authenticated;

-- 2) todos: 사용자 개인 할 일 목록
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null,
  is_done boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists todos_user_id_idx on public.todos(user_id);

alter table public.todos enable row level security;

drop policy if exists "todos_select" on public.todos;
drop policy if exists "todos_insert" on public.todos;
drop policy if exists "todos_update" on public.todos;
drop policy if exists "todos_delete" on public.todos;

-- 본인 할 일만 보고 관리할 수 있습니다.
create policy "todos_select" on public.todos for select using (user_id = auth.uid());
create policy "todos_insert" on public.todos for insert with check (user_id = auth.uid());
create policy "todos_update" on public.todos for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "todos_delete" on public.todos for delete using (user_id = auth.uid());

revoke all on table public.todos from anon;
grant select, insert, update, delete on table public.todos to authenticated;

-- 3) 대시보드에 위젯 2개 등록
do $$
begin
  if not exists (
    select 1 from public.dashboard_layout_items where item_type = 'widget' and content = 'schedule_widget'
  ) then
    insert into public.dashboard_layout_items (item_type, content, x, y, width, height, sort_order, is_active)
    values ('widget', 'schedule_widget', 0, 1420, 570, 320, 25, true);
  end if;

  if not exists (
    select 1 from public.dashboard_layout_items where item_type = 'widget' and content = 'todo_widget'
  ) then
    insert into public.dashboard_layout_items (item_type, content, x, y, width, height, sort_order, is_active)
    values ('widget', 'todo_widget', 590, 1420, 570, 320, 26, true);
  end if;
end $$;

-- 확인:
--   select * from public.schedule_events order by event_date;
--   select * from public.todos;
