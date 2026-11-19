-- Supabase SQL Editor에서 한 번 실행하세요.

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 30),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists session_state (
  id int primary key default 1 check (id = 1),
  pdf_url text,
  slide int not null default 1,
  updated_at timestamptz not null default now()
);
insert into session_state (id) values (1) on conflict do nothing;

alter table messages enable row level security;
alter table session_state enable row level security;

create policy "anyone can read messages" on messages for select using (true);
create policy "anyone can post messages" on messages for insert with check (true);
create policy "anyone can read state" on session_state for select using (true);
-- 슬라이드 상태 변경/메시지 삭제는 서버(service role)만 가능

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table session_state;

-- 슬라이드 PDF 저장소 (공개 읽기)
insert into storage.buckets (id, name, public)
values ('slides', 'slides', true)
on conflict do nothing;
