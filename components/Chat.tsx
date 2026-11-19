"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { getSupabase, Message } from "@/lib/supabase";
import ThemeToggle from "./ThemeToggle";

type Props = { adminPassword?: string; onResetAll?: () => void | Promise<void> };

export default function Chat({ adminPassword, onResetAll }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [nick, setNick] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNick(localStorage.getItem("nick") ?? "");
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    let active = true;

    sb.from("messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (active && data) setMessages(data as Message[]);
      });

    const channel = sb
      .channel("messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const m = p.new as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].slice(-300)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => {
        const id = (p.old as { id: string }).id;
        if (id) setMessages((prev) => prev.filter((x) => x.id !== id));
        else setMessages([]);
      })
      .subscribe();

    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    const nickname = nick.trim();
    if (!body || !nickname || sending) return;
    setSending(true);
    localStorage.setItem("nick", nickname);
    const { error } = await getSupabase().from("messages").insert({ nickname, body });
    if (!error) setText("");
    setSending(false);
  }

  // 전체 채팅을 CSV로 저장 (엑셀에서 한글이 깨지지 않도록 BOM 포함)
  async function exportChat() {
    setMenuOpen(false);
    const sb = getSupabase();
    const all: Message[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from("messages")
        .select("*")
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      if (error) {
        alert(`내보내기에 실패했습니다: ${error.message}`);
        return;
      }
      all.push(...((data ?? []) as Message[]));
      if (!data || data.length < 1000) break;
    }
    if (all.length === 0) {
      alert("내보낼 채팅이 없습니다.");
      return;
    }
    // 엑셀 수식으로 해석되지 않도록 = + - @ 로 시작하는 값은 앞에 ' 를 붙임
    const cell = (s: string) => `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
    const rows = [
      ["시간", "닉네임", "내용"],
      ...all.map((m) => [new Date(m.created_at).toLocaleString("ko-KR"), m.nickname, m.body]),
    ];
    const csv = "﻿" +rows.map((r) => r.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function adminCall(payload: object) {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminPassword, ...payload }),
    });
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <span>Live Talk</span>
        <div className="head-right">
          <ThemeToggle />
          {adminPassword && (
            <div className="menu">
              <button aria-label="더보기" onClick={() => setMenuOpen((o) => !o)}>
                …
              </button>
              {menuOpen && (
                <>
                  <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="menu-list">
                    <button onClick={exportChat}>채팅 내보내기 (CSV)</button>
                    <button
                      className="danger"
                      onClick={async () => {
                        setMenuOpen(false);
                        if (!confirm("모든 채팅과 저장된 닉네임을 삭제할까요?")) return;
                        await adminCall({ action: "clear-messages" });
                        localStorage.removeItem("nick");
                        setNick("");
                      }}
                    >
                      채팅 전체 삭제
                    </button>
                    {onResetAll && (
                      <button
                        className="danger"
                        onClick={async () => {
                          setMenuOpen(false);
                          if (
                            !confirm(
                              "강연 설정(PDF·영상), 채팅, 저장된 닉네임을 모두 삭제합니다. 되돌릴 수 없습니다.\n필요하면 먼저 '채팅 내보내기'를 하세요. 계속할까요?",
                            )
                          )
                            return;
                          await adminCall({ action: "clear-messages" });
                          await onResetAll();
                          localStorage.removeItem("nick");
                          setNick("");
                        }}
                      >
                        전체 초기화 (강연 설정 + 채팅)
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && <p className="muted">첫 메시지를 남겨보세요.</p>}
        {messages.map((m) => (
          <div key={m.id} className="msg">
            <div className="msg-head">
              <strong>{m.nickname}</strong>
              <span className="muted">
                {new Date(m.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              {adminPassword && (
                <button className="link" onClick={() => adminCall({ action: "delete-message", id: m.id })}>
                  삭제
                </button>
              )}
            </div>
            <div className="msg-body">{m.body}</div>
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={send}>
        <input
          className="nick"
          placeholder="닉네임"
          value={nick}
          maxLength={30}
          onChange={(e) => setNick(e.target.value)}
        />
        <div className="row">
          <input
            placeholder="메시지 입력…"
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" disabled={sending || !text.trim() || !nick.trim()}>
            전송
          </button>
        </div>
      </form>
    </div>
  );
}
