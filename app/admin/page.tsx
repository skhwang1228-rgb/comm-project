"use client";

import { FormEvent, KeyboardEvent, useRef, useState } from "react";
import Room from "@/components/Room";
import { ADMIN_API } from "@/lib/config";

export default function Admin() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState<string | null>(null);
  const [error, setError] = useState("");
  const busy = useRef(false);

  async function login() {
    if (busy.current || !pw) return;
    busy.current = true;
    setError("");
    try {
      const res = await fetch(ADMIN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", password: pw }),
      });
      if (res.ok) setAuthed(pw);
      else setError("비밀번호가 올바르지 않습니다.");
    } catch {
      setError("서버에 연결하지 못했습니다.");
    } finally {
      busy.current = false;
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login();
  }

  // 폼 제출이 막히는 환경에서도 Enter로 시작되도록 직접 처리
  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      login();
    }
  }

  if (authed) return <Room adminPassword={authed} />;

  return (
    <form className="login" onSubmit={onSubmit}>
      <h1>Start Session</h1>
      <input
        type="password"
        placeholder="관리자 비밀번호"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus
      />
      <button type="submit">시작</button>
      {error && <p className="muted">{error}</p>}
    </form>
  );
}
