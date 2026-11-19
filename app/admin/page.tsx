"use client";

import { FormEvent, useState } from "react";
import Room from "@/components/Room";

export default function Admin() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function login(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", password: pw }),
    });
    if (res.ok) setAuthed(pw);
    else setError("비밀번호가 올바르지 않습니다.");
  }

  if (authed) return <Room adminPassword={authed} />;

  return (
    <form className="login" onSubmit={login}>
      <h1>강연자 로그인</h1>
      <input type="password" placeholder="관리자 비밀번호" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      <button type="submit">입장</button>
      {error && <p className="muted">{error}</p>}
    </form>
  );
}
