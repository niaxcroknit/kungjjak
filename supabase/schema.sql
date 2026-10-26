-- 여행 합의서 — Supabase 스키마 + 권한(RLS)
--
-- trips          여행 1개 (방장, 초대 코드, 마감 여부)
-- trip_members   누가 어느 여행에 들어와 있는지
-- answers        멤버 1명의 답 (여행마다 1줄)
-- profiles       이름·사진 (같은 여행 멤버끼리만 보임)
--
-- 규칙
--  * 여행·답은 그 여행 멤버만 볼 수 있음
--  * 답은 각자 자기 것만 쓰기 (방장도 남의 답은 못 고침)
--  * 마감(locked)되면 아무도 답을 못 씀
--  * 여행 만들기 / 코드로 참여는 함수(create_trip, join_trip)로만

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  photo text not null default '',
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30),
  note text not null default '' check (char_length(note) <= 60),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z2-9]{6}$'),
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  -- 여행마다 질문 목록 (null = 앱의 기본 질문). 방장만 수정 가능
  questions jsonb check (questions is null or (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 80 and pg_column_size(questions) < 60000))
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_members_user_idx on public.trip_members(user_id);

create table public.answers (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  etc jsonb not null default '{}'::jsonb,
  history jsonb not null default '[]'::jsonb,
  nickname text not null default '' check (char_length(nickname) <= 20),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index answers_user_idx on public.answers(user_id);

create schema if not exists private;   -- API로 직접 호출 안 되는 내부 함수 자리
grant usage on schema private to authenticated;

-- ---------- helpers (security definer: RLS 안에서 멤버 여부를 볼 때 재귀를 피하려고) ----------
create or replace function private.is_member(t uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trip_members m where m.trip_id = t and m.user_id = (select auth.uid()));
$$;

create or replace function private.shares_trip_with(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.trip_members a join public.trip_members b on a.trip_id = b.trip_id
    where a.user_id = (select auth.uid()) and b.user_id = other);
$$;

create or replace function private.trip_unlocked(t uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.trips where id = t and not locked);
$$;

-- ---------- actions ----------
create or replace function public.create_trip(p_name text, p_note text default '')
returns public.trips language plpgsql security definer set search_path = '' as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- 헷갈리는 0/O, 1/I 제외
  c text; t public.trips; i int;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  loop
    c := '';
    for i in 1..6 loop c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from public.trips where code = c);
  end loop;
  insert into public.trips (name, note, owner_id, code)
    values (trim(p_name), coalesce(trim(p_note), ''), (select auth.uid()), c) returning * into t;
  insert into public.trip_members (trip_id, user_id) values (t.id, (select auth.uid()));
  return t;
end $$;

create or replace function public.join_trip(p_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare t uuid;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  select id into t from public.trips where code = upper(trim(p_code));
  if t is null then raise exception 'no such code' using errcode = 'P0002'; end if;
  insert into public.trip_members (trip_id, user_id) values (t, (select auth.uid())) on conflict do nothing;
  return t;
end $$;

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.answers enable row level security;

create policy "see self and tripmates" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_trip_with(id));
create policy "write own profile" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "members read trip" on public.trips for select to authenticated
  using (private.is_member(id));
create policy "owner edits trip" on public.trips for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "owner deletes trip" on public.trips for delete to authenticated
  using (owner_id = (select auth.uid()));
-- 방장도 이름·메모·마감만 바꿀 수 있게 (코드·방장은 고정)
-- 코드·방장·생성일은 아무도 못 바꿈 (방장은 이름·메모·마감만)
create or replace function public.trips_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.code is distinct from old.code or new.owner_id is distinct from old.owner_id
     or new.created_at is distinct from old.created_at or new.id is distinct from old.id then
    raise exception 'code, owner and created_at cannot be changed';
  end if;
  return new;
end $$;
create trigger trips_guard before update on public.trips
  for each row execute function public.trips_guard();
-- trips / trip_members 에는 insert 정책이 없어서 직접 추가 불가 (create_trip / join_trip 함수로만)

create policy "members see members" on public.trip_members for select to authenticated
  using (private.is_member(trip_id));
-- 나가기: 자기 자신만, 방장은 못 나감(여행 삭제로)
create policy "member leaves (not owner)" on public.trip_members for delete to authenticated
  using (user_id = (select auth.uid())
         and not exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())));

create policy "members read answers" on public.answers for select to authenticated
  using (private.is_member(trip_id));
create policy "write own answer" on public.answers for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_member(trip_id) and private.trip_unlocked(trip_id));
create policy "update own answer" on public.answers for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and private.is_member(trip_id) and private.trip_unlocked(trip_id));

-- ---------- realtime: 친구가 체크하면 바로 보이게 ----------
alter publication supabase_realtime add table public.answers, public.trips, public.trip_members;

-- ---------- 바뀐 기록은 서버가 직접 씀 (앱이 보낸 history는 무시 → 본인도 기록 조작 불가) ----------
create or replace function public.answers_track_history()
returns trigger language plpgsql set search_path = '' as $$
declare
  hist jsonb := case when tg_op = 'UPDATE' then coalesce(old.history, '[]'::jsonb) else '[]'::jsonb end;
  old_a jsonb := case when tg_op = 'UPDATE' then coalesce(old.answers, '{}'::jsonb) else '{}'::jsonb end;
  new_a jsonb := coalesce(new.answers, '{}'::jsonb);
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  k text; f text; t text; n_old int;
begin
  select count(*) into n_old from jsonb_each(old_a) e where jsonb_typeof(e.value) = 'array' and jsonb_array_length(e.value) > 0;
  if n_old > 0 and not exists (select 1 from jsonb_each(new_a) e where jsonb_typeof(e.value) = 'array' and jsonb_array_length(e.value) > 0) then
    hist := hist || jsonb_build_array(jsonb_build_object('t', now_ms, 'q', '__reset', 'from', n_old || '개', 'to', ''));
  else
    for k in select distinct key from (select jsonb_object_keys(old_a) as key union select jsonb_object_keys(new_a)) s loop
      f := coalesce((select string_agg(x, ', ') from jsonb_array_elements_text(case when jsonb_typeof(old_a -> k) = 'array' then old_a -> k else '[]'::jsonb end) x), '');
      t := coalesce((select string_agg(x, ', ') from jsonb_array_elements_text(case when jsonb_typeof(new_a -> k) = 'array' then new_a -> k else '[]'::jsonb end) x), '');
      if f is distinct from t then
        hist := hist || jsonb_build_array(jsonb_build_object('t', now_ms, 'q', k, 'from', f, 'to', t));
      end if;
    end loop;
  end if;
  if jsonb_array_length(hist) > 200 then
    hist := (select jsonb_agg(v order by i) from jsonb_array_elements(hist) with ordinality a(v, i) where i > jsonb_array_length(hist) - 200);
  end if;
  new.history := hist;
  new.updated_at := now();
  return new;
end $$;
create trigger answers_track_history before insert or update on public.answers
  for each row execute function public.answers_track_history();
