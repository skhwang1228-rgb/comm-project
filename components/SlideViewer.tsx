"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  url: string | null;
  page: number;
  onLoaded: (numPages: number) => void;
};

export default function SlideViewer({ url, page, onLoaded }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<any>(null);
  const renderTask = useRef<any>(null);
  const [docVersion, setDocVersion] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 컨테이너 크기 추적
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // PDF 로드
  useEffect(() => {
    if (!url) {
      docRef.current = null;
      setDocVersion((v) => v + 1);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const doc = await pdfjs.getDocument({ url }).promise;
        if (cancelled) return;
        docRef.current = doc;
        onLoaded(doc.numPages);
        setDocVersion((v) => v + 1);
      } catch (e) {
        if (!cancelled) setError("슬라이드를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // 페이지 렌더링
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || size.w === 0 || size.h === 0) return;
    let cancelled = false;
    (async () => {
      const p = Math.min(Math.max(1, page), doc.numPages);
      const pg = await doc.getPage(p);
      if (cancelled) return;
      const base = pg.getViewport({ scale: 1 });
      const scale = Math.min(size.w / base.width, size.h / base.height);
      const dpr = window.devicePixelRatio || 1;
      const viewport = pg.getViewport({ scale: scale * dpr });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      renderTask.current?.cancel();
      const task = pg.render({ canvasContext: canvas.getContext("2d")!, viewport });
      renderTask.current = task;
      try {
        await task.promise;
      } catch {
        /* cancelled */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docVersion, page, size]);

  return (
    <div ref={wrapRef} className="slide-wrap">
      {!url && <p className="muted">'PDF 열기'로 슬라이드를 선택하거나, PDF 파일을 이 화면에 끌어다 놓거나 붙여넣기(Ctrl+V) 하세요.</p>}
      {loading && <p className="muted">슬라이드 불러오는 중…</p>}
      {error && <p className="muted">{error}</p>}
      <canvas ref={canvasRef} style={{ display: url && !error ? "block" : "none" }} />
    </div>
  );
}
