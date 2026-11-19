"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { getSupabase, SessionState } from "@/lib/supabase";
import SlideViewer from "./SlideViewer";
import Chat from "./Chat";

type Props = { adminPassword?: string };

export default function Room({ adminPassword }: Props) {
  const isAdmin = !!adminPassword;
  const [tab, setTab] = useState<"slides" | "chat">("slides");
  const [state, setState] = useState<SessionState>({ id: 1, pdf_url: null, slide: 1 });
  const [total, setTotal] = useState(0);
  const [follow, setFollow] = useState(true);
  const [localPage, setLocalPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const sb = getSupabase();
    sb.from("session_state")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => data && setState(data as SessionState));
    const channel = sb
      .channel("session_state")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "session_state" }, (p) =>
        setState(p.new as SessionState),
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  const page = isAdmin || follow ? state.slide : localPage;

  const call = useCallback(
    async (payload: object) => {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword, ...payload }),
      });
      return res.json();
    },
    [adminPassword],
  );

  const go = useCallback(
    (n: number) => {
      const max = total || 1;
      const next = Math.min(Math.max(1, n), max);
      if (isAdmin) {
        setState((s) => ({ ...s, slide: next })); // 낙관적 업데이트
        call({ action: "set-state", slide: next });
      } else {
        setFollow(false);
        setLocalPage(next);
      }
    },
    [isAdmin, total, call],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowRight" || e.key === "PageDown") go(page + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, page]);

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      setStatus("PDF 파일만 업로드할 수 있습니다. PowerPoint에서 'PDF로 내보내기'를 해주세요.");
      return;
    }
    setUploading(true);
    setStatus("업로드 중…");
    try {
      const u = await call({ action: "upload-url" });
      if (u.error) throw new Error(u.error);
      const { error } = await getSupabase()
        .storage.from("slides")
        .uploadToSignedUrl(u.path, u.token, file, { contentType: "application/pdf" });
      if (error) throw error;
      const r = await call({ action: "set-state", pdf_url: u.publicUrl, slide: 1 });
      if (r.error) throw new Error(r.error);
      setStatus("업로드 완료");
    } catch (err: any) {
      setStatus(`업로드 실패: ${err.message ?? err}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="app" data-tab={tab}>
      <nav className="tabs">
        <button className={tab === "slides" ? "on" : ""} onClick={() => setTab("slides")}>
          📊 프레젠테이션
        </button>
        <button className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>
          💬 채팅
        </button>
      </nav>

      <section className="pane-slides">
        <div className="toolbar">
          {isAdmin && (
            <label className={`btn ${uploading ? "disabled" : ""}`}>
              PDF 업로드
              <input type="file" accept="application/pdf" hidden onChange={upload} disabled={uploading} />
            </label>
          )}
          <button onClick={() => go(page - 1)} disabled={page <= 1}>
            ◀
          </button>
          <span>
            {page} / {total || "-"}
          </span>
          <button onClick={() => go(page + 1)} disabled={!total || page >= total}>
            ▶
          </button>
          {!isAdmin && (
            <button className={follow ? "on" : ""} onClick={() => setFollow((f) => !f)}>
              {follow ? "강연자 따라가는 중" : "직접 넘기는 중 (눌러서 따라가기)"}
            </button>
          )}
          {status && <span className="muted status">{status}</span>}
        </div>
        <SlideViewer url={state.pdf_url} page={page} onLoaded={setTotal} />
      </section>

      <aside className="pane-chat">
        <Chat adminPassword={adminPassword} />
      </aside>
    </div>
  );
}
