import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// 강연자 PC의 휴대용 앱(localhost)에서 이 API를 호출할 수 있도록 localhost 출처만 허용한다.
// 모든 동작은 여전히 ADMIN_PASSWORD 확인이 필요하다.
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (!LOCAL_ORIGIN.test(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req);
  const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers });

  const body = await req.json().catch(() => ({}));
  if (!process.env.ADMIN_PASSWORD || body.password !== process.env.ADMIN_PASSWORD) {
    return reply({ error: "unauthorized" }, 401);
  }

  const db = admin();

  switch (body.action) {
    case "login":
      return reply({ ok: true });

    case "delete-message": {
      const { error } = await db.from("messages").delete().eq("id", body.id);
      if (error) return reply({ error: error.message }, 500);
      return reply({ ok: true });
    }

    case "clear-messages": {
      const { error } = await db.from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) return reply({ error: error.message }, 500);
      return reply({ ok: true });
    }

    default:
      return reply({ error: "unknown action" }, 400);
  }
}
