"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { getSupabase, Message } from "@/lib/supabase";

type Props = { adminPassword?: string };

export default function Chat({ adminPassword }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [nick, setNick] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNick(localStorage.getItem("nick") ?? (adminPassword ? "강연자" : ""));
  }, [adminPassword]);

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

  async function adminCall(payload: object) {
    await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminPassword, ...payload }),
    });
  }

  return (
    <div className="chat">
      {adminPassword && (
        <div className="chat-tools">
          <button
            onClick={() => confirm("모든 채팅을 삭제할까요?") && adminCall({ action: "clear-messages" })}
          >
            채팅 전체 삭제
          </button>
        </div>
      )}
      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && <p className="muted">첫 메시지를 남겨보세요 👋</p>}
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
