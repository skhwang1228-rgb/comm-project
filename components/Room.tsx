"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { pickFiles } from "@/lib/pick";
import SlideViewer from "./SlideViewer";
import Chat from "./Chat";
import { kvClear, kvDel, kvGet, kvSet, Meta, SavedItem } from "@/lib/store";

type Props = { adminPassword?: string };

type MediaItem = { id: string; kind: "file" | "embed" | "video"; name: string; src: string; blob?: Blob };

// 유튜브/Vimeo 주소는 임베드 주소로, 그 외 https 주소는 <video> 직접 재생으로 처리
function parseVideoUrl(raw: string): Omit<MediaItem, "id"> | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "m.youtube.com") {
    id = u.searchParams.get("v") ?? (u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : null);
  }
  if (id) return { kind: "embed", src: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`, name: "YouTube" };
  if (host === "vimeo.com" && /^\/\d+/.test(u.pathname)) {
    return { kind: "embed", src: `https://player.vimeo.com/video/${u.pathname.split("/")[1]}?autoplay=1`, name: "Vimeo" };
  }
  return { kind: "video", src: raw, name: u.hostname };
}

// 참석자(/): 채팅만. 강연자(/admin): 좌측 슬라이드(로컬 PDF 또는 임베드 링크) + 우측 채팅.
// 슬라이드와 영상은 서버로 올리지 않고 강연자 브라우저(IndexedDB)에만 보관한다.
export default function Room({ adminPassword }: Props) {
  if (!adminPassword) {
    return (
      <div className="app chat-only">
        <aside className="pane-chat">
          <Chat />
        </aside>
      </div>
    );
  }
  return <Presenter adminPassword={adminPassword} />;
}

function Presenter({ adminPassword }: { adminPassword: string }) {
  const [tab, setTab] = useState<"slides" | "chat">("slides");
  const [pdfFile, setPdfFile] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [media, setMedia] = useState<Record<number, MediaItem[]>>({});
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [dockOpen, setDockOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [isFs, setIsFs] = useState(false);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const autoFs = useRef(false);
  const mediaRef = useRef(media);
  mediaRef.current = media;

  // 임베드 모드에서는 현재 슬라이드 번호를 알 수 없으므로 영상을 모든 슬라이드 공통(키 0)으로 관리
  const key = embedUrl ? 0 : page;
  const items = media[key] ?? [];
  const playing = items.find((m) => m.id === playingId) ?? null;

  // PDF Blob -> object URL
  useEffect(() => {
    if (!pdfFile) {
      setPdfUrl(null);
      return;
    }
    const u = URL.createObjectURL(pdfFile);
    setPdfUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [pdfFile]);

  // 이전 작업 복원
  useEffect(() => {
    (async () => {
      try {
        const meta = await kvGet<Meta>("meta");
        if (meta) {
          const restored: Record<number, MediaItem[]> = {};
          for (const [p, list] of Object.entries(meta.media ?? {})) {
            const out: MediaItem[] = [];
            for (const it of list as SavedItem[]) {
              if (it.kind === "file") {
                const blob = await kvGet<Blob>(`media:${it.id}`);
                if (blob) out.push({ id: it.id, kind: "file", name: it.name, src: URL.createObjectURL(blob), blob });
              } else {
                out.push({ id: it.id, kind: it.kind, name: it.name, src: it.src! });
              }
            }
            if (out.length) restored[Number(p)] = out;
          }
          const pdf = meta.hasPdf ? await kvGet<Blob>("pdf") : undefined;
          setMedia(restored);
          setFileName(meta.fileName);
          setEmbedUrl(meta.embedUrl);
          setPage(meta.page || 1);
          if (pdf) setPdfFile(pdf);
          setDockOpen(!(pdf || meta.embedUrl));
        }
      } catch {
        setStatus("이전 작업을 불러오지 못했습니다.");
      }
      setHydrated(true);
    })();
  }, []);

  // 변경 시 자동 저장 (용량이 큰 파일은 추가할 때 한 번만 저장하고, 여기서는 작은 정보만 저장)
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      const saved: Meta = {
        fileName,
        embedUrl,
        hasPdf: !!pdfFile,
        page,
        media: Object.fromEntries(
          Object.entries(media).map(([p, list]) => [
            p,
            list.map((m) => ({ id: m.id, kind: m.kind, name: m.name, ...(m.kind === "file" ? {} : { src: m.src }) })),
          ]),
        ),
      };
      kvSet("meta", saved).catch(() => setStatus("자동 저장에 실패했습니다."));
    }, 300);
    return () => clearTimeout(t);
  }, [hydrated, fileName, embedUrl, pdfFile, page, media]);

  // 언마운트 시 object URL 정리
  useEffect(
    () => () => {
      Object.values(mediaRef.current)
        .flat()
        .forEach((m) => m.kind === "file" && URL.revokeObjectURL(m.src));
    },
    [],
  );

  // 전체화면 상태 추적
  useEffect(() => {
    const onChange = () => {
      const fs = document.fullscreenElement === stageRef.current;
      setIsFs(fs);
      if (!fs) autoFs.current = false;
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageRef.current?.requestFullscreen().catch(() => {});
  };

  const play = useCallback((id: string) => {
    setPlayingId(id);
    if (!document.fullscreenElement) {
      stageRef.current
        ?.requestFullscreen()
        .then(() => {
          autoFs.current = true;
        })
        .catch(() => {});
    }
  }, []);

  const stop = useCallback(() => {
    setPlayingId(null);
    if (autoFs.current && document.fullscreenElement) document.exitFullscreen();
    autoFs.current = false;
  }, []);

  const go = useCallback(
    (n: number) => {
      stop();
      setPage(Math.min(Math.max(1, n), total || 1));
    },
    [total, stop],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "Escape") stop();
      if (playingId) return; // 영상 재생 중에는 슬라이드 넘김 키 무시
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") go(page + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") go(page - 1);
      if (e.key === "f" || e.key === "F") toggleFs();
      const list = mediaRef.current[embedUrl ? 0 : page] ?? [];
      if ((e.key === "v" || e.key === "V") && list[0]) play(list[0].id);
      if (/^[1-9]$/.test(e.key) && list[Number(e.key) - 1]) play(list[Number(e.key) - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, page, embedUrl, playingId, play, stop]);

  function addItem(item: MediaItem, forPage: number) {
    setMedia((prev) => ({ ...prev, [forPage]: [...(prev[forPage] ?? []), item] }));
  }

  async function pickVideos() {
    const files = await pickFiles({
      description: "영상",
      accept: { "video/*": [".mp4", ".webm", ".mov", ".m4v", ".ogv"] },
      multiple: true,
    });
    if (files === null) videoInputRef.current?.click(); // 미지원/실패 시 기존 방식
    else if (files.length) await addVideoFiles(files);
  }

  async function addVideoFiles(files: File[]) {
    const base = nameInput.trim();
    setNameInput("");
    for (const [idx, file] of files.entries()) {
      if (!file.type.startsWith("video/")) {
        setStatus(`${file.name}: 영상 파일이 아닙니다.`);
        continue;
      }
      const label = base ? (files.length > 1 ? `${base} ${idx + 1}` : base) : file.name.replace(/\.[^.]+$/, "");
      const id = crypto.randomUUID();
      try {
        await kvSet(`media:${id}`, file);
      } catch {
        setStatus("영상 저장에 실패했습니다. (이 세션에서만 사용 가능)");
      }
      addItem({ id, kind: "file", name: label, src: URL.createObjectURL(file), blob: file }, key);
      setStatus(`영상 추가: ${label}`);
    }
  }

  function addVideoUrl() {
    const m = parseVideoUrl(videoUrlInput.trim());
    if (!m) {
      setStatus("https 영상 링크를 입력하세요.");
      return;
    }
    const label = nameInput.trim() || m.name;
    addItem({ id: crypto.randomUUID(), ...m, name: label }, key);
    setVideoUrlInput("");
    setNameInput("");
    setStatus(`영상 추가: ${label}`);
  }

  function renameItem(id: string, name: string) {
    setMedia((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).map((m) => (m.id === id ? { ...m, name } : m)),
    }));
  }

  function removeItem(item: MediaItem) {
    if (playingId === item.id) stop();
    if (item.kind === "file") {
      URL.revokeObjectURL(item.src);
      kvDel(`media:${item.id}`).catch(() => {});
    }
    setMedia((prev) => {
      const list = (prev[key] ?? []).filter((m) => m.id !== item.id);
      const next = { ...prev };
      if (list.length) next[key] = list;
      else delete next[key];
      return next;
    });
  }

  async function dropAllMedia() {
    Object.values(media)
      .flat()
      .forEach((m) => m.kind === "file" && URL.revokeObjectURL(m.src));
    setMedia({});
    setPlayingId(null);
  }

  // 끌어다 놓기 / 붙여넣기로 들어온 파일 처리: PDF면 슬라이드로 열고, 영상이면 현재 슬라이드에 추가
  async function handleFiles(files: File[]) {
    const pdf = files.find((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    const videos = files.filter((f) => f.type.startsWith("video/"));
    if (pdf) await openPdf(pdf);
    else if (videos.length && (pdfUrl || embedUrl)) await addVideoFiles(videos);
    else if (videos.length) setStatus("영상은 PDF를 먼저 연 뒤에 추가할 수 있습니다.");
    else setStatus("PDF 또는 영상 파일만 사용할 수 있습니다.");
  }
  const handleFilesRef = useRef(handleFiles);
  handleFilesRef.current = handleFiles;

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        handleFilesRef.current(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function pickPdf() {
    const files = await pickFiles({ description: "PDF", accept: { "application/pdf": [".pdf"] } });
    if (files === null) pdfInputRef.current?.click(); // 미지원/실패 시 기존 방식
    else if (files[0]) await openPdf(files[0]);
  }

  async function openPdf(file: File) {
    if (!/\.pdf$/i.test(file.name)) {
      setStatus("PDF 파일만 열 수 있습니다. PowerPoint에서 'PDF로 내보내기' 해주세요.");
      return;
    }
    if (Object.keys(media).length && !confirm("새 PDF를 열면 연결된 영상이 모두 해제됩니다. 계속할까요?")) return;
    await kvClear().catch(() => {});
    await dropAllMedia();
    await kvSet("pdf", file).catch(() => setStatus("PDF 저장에 실패했습니다. (이 세션에서만 사용 가능)"));
    setEmbedUrl(null);
    setPdfFile(file);
    setFileName(file.name);
    setPage(1);
    setStatus("");
  }

  function applyLink() {
    const link = linkInput.trim();
    if (!/^https:\/\//i.test(link)) {
      setStatus("https 링크만 사용할 수 있습니다.");
      return;
    }
    setPdfFile(null);
    kvDel("pdf").catch(() => {});
    setEmbedUrl(link);
    setFileName("");
    setPage(1);
    setLinkInput("");
    setStatus("");
  }

  async function reset() {
    if (!confirm("PDF, 연결된 영상 등 모든 작업을 지웁니다. 계속할까요?")) return;
    await wipeLecture();
  }

  // 강연 설정(PDF·영상·슬라이드 위치)만 초기화. 채팅은 건드리지 않는다.
  async function wipeLecture() {
    stop();
    await dropAllMedia();
    await kvClear().catch(() => {});
    setPdfFile(null);
    setEmbedUrl(null);
    setFileName("");
    setPage(1);
    setTotal(0);
    setDockOpen(true);
    setStatus("초기화했습니다.");
  }

  return (
    <div className="app" data-tab={tab}>
      <nav className="tabs">
        <button className={tab === "slides" ? "on" : ""} onClick={() => setTab("slides")}>
          프레젠테이션
        </button>
        <button className={tab === "chat" ? "on" : ""} onClick={() => setTab("chat")}>
          Live Talk
        </button>
      </nav>

      <section className="pane-slides">
        <div
          className="stage"
          ref={stageRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            if (files.length) handleFiles(files);
          }}
        >
          {embedUrl ? (
            <div className="slide-wrap embed">
              <iframe src={embedUrl} allowFullScreen allow="autoplay; fullscreen" />
            </div>
          ) : (
            <SlideViewer url={pdfUrl} page={page} onLoaded={setTotal} />
          )}

          {/* 슬라이드에 연결된 영상: 설정창을 숨겨도 항상 표시 */}
          {!playing && items.length > 0 && (
            <div className={`video-chips${embedUrl ? " top" : ""}`}>
              {items.map((m) => (
                <button key={m.id} onClick={() => play(m.id)} title={m.name}>
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {/* 마우스를 올리면 나타나는 조작 막대 */}
          <div className="stage-bar">
            {!embedUrl && (
              <>
                <button onClick={() => go(page - 1)} disabled={page <= 1}>
                  이전
                </button>
                <span>
                  {page} / {total || "-"}
                </span>
                <button onClick={() => go(page + 1)} disabled={!total || page >= total}>
                  다음
                </button>
              </>
            )}
            <button onClick={toggleFs}>{isFs ? "축소 (F)" : "전체화면 (F)"}</button>
          </div>

          {playing && (
            <div className="video-overlay">
              <button className="video-close" onClick={stop}>
                닫기 (Esc)
              </button>
              {playing.kind === "embed" ? (
                <iframe src={playing.src} allow="autoplay; fullscreen; encrypted-media" allowFullScreen />
              ) : (
                <video key={playing.id} src={playing.src} controls autoPlay />
              )}
            </div>
          )}
        </div>

        <div className="dock">
          <button className="dock-toggle" onClick={() => setDockOpen((o) => !o)}>
            <span className={`chev ${dockOpen ? "down" : "up"}`} aria-hidden="true" />
            {dockOpen ? "설정 숨기기" : "설정 열기 (PDF·영상)"}
            {status && <span className="muted"> · {status}</span>}
          </button>
          {dockOpen && (
            <div className="dock-body">
              <div className="toolbar">
                <button onClick={pickPdf}>
                  PDF 열기
                </button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) openPdf(f);
                  }}
                />
                {fileName && <span className="muted">{fileName}</span>}
                <input
                  className="grow"
                  placeholder="또는 OneDrive/SharePoint 임베드 링크 (https://…)"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyLink()}
                />
                <button onClick={applyLink} disabled={!linkInput.trim()}>
                  적용
                </button>
                <button className="danger status" onClick={reset}>
                  초기화
                </button>
              </div>
              {(embedUrl || pdfUrl) && (
                <div className="toolbar">
                  <span className="muted">{embedUrl ? "공통 영상 (모든 슬라이드):" : `${page}번 슬라이드 영상:`}</span>
                  <input
                    className="name-input"
                    placeholder="버튼 이름"
                    value={nameInput}
                    maxLength={30}
                    onChange={(e) => setNameInput(e.target.value)}
                  />
                  <button onClick={pickVideos}>
                    파일 추가
                  </button>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      const fs = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      if (fs.length) addVideoFiles(fs);
                    }}
                  />
                  <input
                    className="grow"
                    placeholder="영상 URL (YouTube, Vimeo, mp4 링크)"
                    value={videoUrlInput}
                    onChange={(e) => setVideoUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addVideoUrl()}
                  />
                  <button onClick={addVideoUrl} disabled={!videoUrlInput.trim()}>
                    추가
                  </button>
                  {items.map((m, i) => (
                    <span key={m.id} className="chip">
                      <span className="muted">{i + 1}</span>
                      <input
                        className="chip-input"
                        value={m.name}
                        maxLength={30}
                        aria-label="영상 버튼 이름"
                        onChange={(e) => renameItem(m.id, e.target.value)}
                      />
                      <button className="link" onClick={() => removeItem(m)}>
                        삭제
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <aside className="pane-chat">
        <Chat adminPassword={adminPassword} onResetAll={wipeLecture} />
      </aside>
    </div>
  );
}
