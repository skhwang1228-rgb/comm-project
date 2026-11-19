import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = admin();

  switch (body.action) {
    case "login":
      return NextResponse.json({ ok: true });

    // 브라우저가 Supabase Storage로 직접 업로드하도록 서명된 URL 발급
    // (Vercel 함수는 요청 본문 4.5MB 제한이 있어 파일을 서버로 보내지 않음)
    case "upload-url": {
      const path = `${Date.now()}-${crypto.randomUUID()}.pdf`;
      const { data, error } = await db.storage.from("slides").createSignedUploadUrl(path);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const { data: pub } = db.storage.from("slides").getPublicUrl(path);
      return NextResponse.json({ path, token: data.token, publicUrl: pub.publicUrl });
    }

    case "set-state": {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.slide === "number") update.slide = Math.max(1, Math.floor(body.slide));
      if (typeof body.pdf_url === "string") update.pdf_url = body.pdf_url;
      const { error } = await db.from("session_state").update(update).eq("id", 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "delete-message": {
      const { error } = await db.from("messages").delete().eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "clear-messages": {
      const { error } = await db.from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
