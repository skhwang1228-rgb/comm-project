강연자용 휴대용 폴더 (설치 불필요)

사용법
1. 이 폴더(portable) 전체를 강연할 PC에 복사합니다. (USB, 사내 공유 폴더 등)
2. start.bat 을 더블클릭합니다.
3. 브라우저에서 http://localhost:3217/admin 이 열립니다. 비밀번호를 입력해 시작합니다.
4. 강연이 끝나면 검은 창(PowerShell)을 닫습니다.

참고
- 필요한 것은 Windows 와 Chrome/Edge 뿐입니다. Node.js 설치는 필요 없습니다.
- PDF/영상은 그 PC 의 브라우저에만 저장됩니다. 다른 PC 에서는 다시 열어야 합니다.
- 참석자는 배포 주소로 접속해 채팅합니다: https://comm-project-fawn.vercel.app/
  채팅은 같은 DB 로 연결됩니다.
- 앱을 수정한 경우: 개발 PC 에서 npm run build:portable -- https://배포주소 를 실행해 이 폴더를 다시 만듭니다.
