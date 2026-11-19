# 실시간 강연 앱

- `/` 참석자 화면: 좌측 슬라이드 + 우측 채팅 (모바일은 탭 전환)
- `/admin` 강연자 화면: 비밀번호 로그인 → PDF 업로드, 슬라이드 넘김(←/→ 키), 채팅 삭제

## 설정

1. [Supabase](https://supabase.com) 프로젝트 생성 → SQL Editor에서 `supabase/schema.sql` 실행
2. `.env.example`을 `.env.local`로 복사해 값 입력 (Project Settings → API)
3. `npm run dev` → http://localhost:3000 , http://localhost:3000/admin

## Vercel 배포

Vercel 프로젝트에 위 4개 환경변수를 등록하고 배포합니다.
(Vercel 서버리스는 WebSocket을 지원하지 않아 실시간 통신은 Supabase Realtime을 사용합니다.)

## 슬라이드

PowerPoint → 파일 > 내보내기 > PDF 로 저장 후 업로드하세요.
