// 설치 없이 어느 PC에서나 쓰는 강연자용 휴대용 폴더(portable/)를 만든다.
// 사용: npm run build:portable -- https://배포주소.vercel.app
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const base = (process.argv[2] || process.env.ADMIN_API_BASE || "").replace(/\/+$/, "");
if (!/^https:\/\//.test(base)) {
  console.error("배포 주소가 필요합니다. 예: npm run build:portable -- https://comm-project-fawn.vercel.app");
  process.exit(1);
}

// 정적 내보내기는 API 라우트를 지원하지 않으므로 빌드하는 동안만 치워 둔다.
// (폴더 이름 변경은 개발 서버가 폴더를 잡고 있으면 실패하므로 파일만 옮긴다)
const api = path.join(root, "app", "api", "admin", "route.ts");
const tmp = path.join(root, "app", "api", "admin", "route.ts.disabled");
fs.renameSync(api, tmp);

let status = 1;
try {
  const r = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, STATIC_EXPORT: "1", NEXT_PUBLIC_ADMIN_API_BASE: base },
  });
  status = r.status ?? 1;
} finally {
  fs.renameSync(tmp, api);
}
if (status !== 0) process.exit(status);

// 내보내기 결과 위치(out 또는 distDir) 찾기
const candidates = [path.join(root, "out"), path.join(root, ".next-portable")];
const built = candidates.find((d) => fs.existsSync(path.join(d, "index.html")));
if (!built) {
  console.error("정적 빌드 결과를 찾지 못했습니다.");
  process.exit(1);
}

const dest = path.join(root, "portable", "out");
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(built, dest, { recursive: true });
console.log(`\n완료: portable 폴더를 통째로 다른 PC에 복사해 start.bat 을 실행하세요. (${dest})`);
