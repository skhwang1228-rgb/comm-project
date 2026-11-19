"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme !== "light");
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button className="switch" role="switch" aria-checked={dark} aria-label="다크 모드" onClick={toggle}>
      <span className="muted">다크</span>
      <span className="track">
        <span className="thumb" />
      </span>
    </button>
  );
}
