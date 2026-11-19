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
