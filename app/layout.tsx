import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "실시간 강연",
  description: "강연 슬라이드와 실시간 채팅",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// 첫 화면이 깜빡이지 않도록 저장된 테마(없으면 다크)를 렌더 전에 적용
const themeInit = `try{document.documentElement.dataset.theme=localStorage.getItem('theme')==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
