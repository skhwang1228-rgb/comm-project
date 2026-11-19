# 개발 가이드

Live Talk 앱을 수정하고 실행하는 개발자용 문서입니다. 강연 현장 사용법은 [GUIDE.md](GUIDE.md)를 보세요.

## 1. 구성

- **Next.js 15 (App Router) + React 19 + TypeScript**
- **Supabase**: 채팅 메시지 저장과 실시간 전달(Realtime). 슬라이드·영상은 저장하지 않습니다.
- **pdfjs-dist**: 브라우저에서 PDF 렌더링
- **Vercel**: 참석자용 배포
- **portable/**: 강연자용 정적 빌드 + PowerShell 서버 (Node.js 없이 실행)

| 화면 | 경로 | 설명 |
|---|---|---|
| 참석자 | `/` | 채팅만 표시 |
| 강연자 | `/admin` | 비밀번호 로그인 → 슬라이드(로컬 PDF 또는 임베드 링크) + 채팅 관리 |

## 2. 처음 세팅

필요한 것: Node.js (LTS 이상), Git

```powershell
cd D:\edu\comm
npm install
```

### 환경변수
`.env.example`을 복사해 `.env.local`을 만들고 값을 채웁니다. `.env.local`은 `.gitignore`에 들어 있어 Git에 올라가지 않습니다.

```powershell
copy .env.example .env.local
```

| 변수 | 설명 | 노출 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL (`https://<프로젝트ID>.supabase.co`) | 공개 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable(anon) 키 | 공개 |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret(service_role) 키. 메시지 삭제용 | **서버 전용, 절대 공개 금지** |
| `ADMIN_PASSWORD` | `/admin` 로그인 비밀번호 | 서버 전용 |

값은 Supabase 대시보드의 **Project Settings → API Keys**에서 확인합니다. 값을 바꾼 뒤에는 개발 서버를 껐다 켜야 반영됩니다.

### DB 테이블
Supabase **SQL Editor**에서 [supabase/schema.sql](supabase/schema.sql)을 한 번 실행합니다. (`messages` 테이블, 읽기/쓰기 정책, Realtime 등록)

## 3. 명령어

| 명령어 | 용도 |
|---|---|
| `npm run dev` | **개발 서버 실행** (코드 수정이 바로 반영됨) |
| `npm run build` | 운영 빌드 (Vercel이 배포 때 실행하는 것과 같음) |
| `npm start` | 운영 빌드 결과 실행 (`npm run build` 후) |
| `npm run build:portable -- <배포주소>` | 강연자용 휴대용 폴더 생성 |
| `npx tsc --noEmit` | 타입 검사 (빌드 없이 빠르게) |

### 개발 서버 실행

```powershell
npm run dev
```

- 기본 주소는 `http://localhost:3000` 입니다. 3000번이 사용 중이면 3001 등 **다음 빈 포트**로 열리니, 터미널에 출력되는 `Local:` 주소를 확인하세요.
- 참석자 화면: `http://localhost:3000/` / 강연자 화면: `http://localhost:3000/admin`
- 종료는 터미널에서 `Ctrl+C` 입니다.

### 휴대용 폴더 만들기

```powershell
npm run build:portable -- https://comm-project-fawn.vercel.app
```

- 결과는 `portable/out`에 생기며, `portable` 폴더 전체를 강연 PC에 복사하면 됩니다.
- 인자로 준 주소는 휴대용 앱이 **로그인과 채팅 삭제를 요청할 서버**입니다. 반드시 배포된 주소를 넣으세요.
- 개발 서버가 켜져 있어도 실행할 수 있습니다. (빌드 결과는 `.next-portable`을 쓰므로 개발 서버와 충돌하지 않습니다)

## 4. 폴더 구조

```
app/
  layout.tsx            전체 레이아웃, 테마 초기화 스크립트(기본 다크)
  page.tsx              참석자 화면 (/)
  admin/page.tsx        강연자 로그인 (/admin)
  api/admin/route.ts    로그인·메시지 삭제 API (비밀번호 검사, localhost CORS 허용)
  globals.css           스타일, 다크/화이트 테마 변수
components/
  Room.tsx              참석자/강연자 화면 구성, 슬라이드·영상 로직
  Chat.tsx              채팅, … 메뉴(내보내기·삭제·전체 초기화)
  SlideViewer.tsx       PDF 렌더링 (pdf.js)
  ThemeToggle.tsx       다크/화이트 스위치
lib/
  supabase.ts           Supabase 클라이언트, 메시지 타입
  store.ts              IndexedDB 저장 (PDF·영상·슬라이드 위치)
  pick.ts               브라우저 내장 파일 선택창(File System Access API)
  config.ts             관리자 API 주소 (휴대용 빌드는 배포 서버로 향함)
scripts/build-portable.mjs   휴대용 정적 빌드 스크립트
portable/               강연자용 폴더 (start.bat, serve.ps1, README.txt, out/)
supabase/schema.sql     DB 스키마
```

## 5. 동작 원리 (알아 두면 좋은 것)

- **슬라이드와 영상은 서버로 가지 않습니다.** 강연자 브라우저의 IndexedDB(`lib/store.ts`)에만 저장됩니다. 주소(origin)와 브라우저마다 따로 저장됩니다.
- **참석자는 채팅만** 합니다. 채팅은 Supabase `messages` 테이블과 Realtime으로 오갑니다.
- **관리자 기능**(로그인, 메시지 삭제, 전체 삭제)은 `app/api/admin/route.ts`가 `ADMIN_PASSWORD`를 확인한 뒤 `service_role` 키로 처리합니다.
- **휴대용 앱은 정적 빌드**라서 API 라우트가 없습니다. 대신 `NEXT_PUBLIC_ADMIN_API_BASE`(빌드 때 주입)가 가리키는 배포 서버의 `/api/admin`을 호출합니다. 서버는 `localhost` 출처에만 CORS를 허용합니다.
- **사내 정책 때문에** 배포 주소에서는 파일 선택이 막혀 있어, 강연자는 `localhost`로 실행하는 휴대용 앱을 씁니다.

## 6. 배포 흐름

1. 코드 수정 후 개발 서버에서 확인
2. `npx tsc --noEmit`으로 타입 검사
3. 커밋 후 `git push` → **Vercel이 자동 배포** (참석자용)
4. 강연자용도 바뀌었다면 `npm run build:portable`로 `portable` 폴더를 다시 만들어 강연 PC에 교체

Vercel에는 환경변수 4개를 등록해야 합니다. 값을 바꾸면 **재배포(Redeploy)** 해야 반영됩니다. `NEXT_PUBLIC_` 변수는 빌드 때 코드에 들어가기 때문입니다. `NEXT_PUBLIC_ADMIN_API_BASE`는 Vercel에 **등록하지 마세요.** (휴대용 빌드 전용입니다)

## 7. 주의사항과 문제 해결

| 증상 | 원인과 해결 |
|---|---|
| `supabaseUrl is required` | 환경변수가 비어 있거나 이름이 틀렸습니다. 값 확인 후 개발 서버 재시작(또는 Vercel 재배포) |
| 포트 3000이 이미 사용 중 | 다음 포트(3001 등)로 열립니다. 터미널의 `Local:` 주소를 확인하세요 |
| `build:portable`에서 EPERM | 개발 서버가 폴더를 잡고 있을 때 생길 수 있습니다. 스크립트는 파일만 옮기도록 되어 있으니, 그래도 실패하면 개발 서버를 끄고 다시 실행하세요 |
| 휴대용 앱 로그인이 "서버에 연결하지 못했습니다" | 배포 서버가 최신 코드(CORS 허용)인지, 빌드 때 준 배포 주소가 맞는지 확인하세요 |
| 개발 서버의 포트 3217 충돌 | 3217은 휴대용 앱(`start.bat`) 전용 포트입니다. 개발 서버와 별개입니다 |
| 줄바꿈 경고 (LF → CRLF) | Windows의 Git 기본 동작이라 무시해도 됩니다 |

## 8. 커밋 전 체크리스트

- [ ] `npx tsc --noEmit` 통과
- [ ] `.env.local`이 커밋 목록에 없는지 확인 (`git status`)
- [ ] 키나 비밀번호를 코드·문서에 적지 않았는지 확인
- [ ] 휴대용 앱 관련 변경이면 `npm run build:portable`로 다시 만들고 `start.bat`으로 확인
