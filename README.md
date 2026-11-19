# 실시간 강연 채팅 앱

- `/` 참석자 화면: 닉네임으로 실시간 채팅 (휴대폰/PC)
- `/admin` 강연자 화면: 비밀번호 로그인 → 좌측 슬라이드 + 우측 채팅. HDMI로 TV에 띄워 사용
  - **PDF 열기**: 로컬 PDF를 브라우저에서만 열어 표시 (서버 업로드 없음). ←/→/Space로 넘김
  - **임베드 링크**: OneDrive/SharePoint(PowerPoint 웹) 삽입 주소를 붙여넣으면 영상·애니메이션 포함 재생
  - 메시지 삭제, 채팅 전체 삭제

## 설정

1. [Supabase](https://supabase.com) 프로젝트 생성 → SQL Editor에서 `supabase/schema.sql` 실행
2. `.env.example`을 `.env.local`로 복사해 값 입력 (Project Settings → API Keys)
3. `npm run dev` → http://localhost:3000 , http://localhost:3000/admin

## Vercel 배포

Vercel 프로젝트에 환경변수 4개를 등록하고 배포합니다.
(Vercel 서버리스는 WebSocket을 지원하지 않아 실시간 통신은 Supabase Realtime을 사용합니다.)
