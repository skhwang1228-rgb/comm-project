import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}

export type Message = {
  id: string;
  nickname: string;
  body: string;
  created_at: string;
};

export type SessionState = {
  id: number;
  pdf_url: string | null;
  slide: number;
};
