// 휴대용(정적) 빌드에서는 로그인/삭제 API를 배포된 서버로 보낸다. 일반 빌드에서는 같은 도메인의 상대 경로를 쓴다.
export const ADMIN_API = `${process.env.NEXT_PUBLIC_ADMIN_API_BASE ?? ""}/api/admin`;
