-- Supabase SQL Editor에서 한 번 실행하세요. (채팅 메시지 테이블만 필요)

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (char_length(nickname) between 1 and 30),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table messages enable row level security;

create policy "anyone can read messages" on messages for select using (true);
create policy "anyone can post messages" on messages for insert with check (true);
-- 메시지 삭제는 서버(service role)만 가능

alter publication supabase_realtime add table messages;
