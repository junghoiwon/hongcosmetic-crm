import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // 콘솔에 명확히 알려줘야 "왜 데이터가 하나도 안 뜨지?" 같은 삽질을 줄일 수 있습니다.
  console.error(
    "[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다. " +
      ".env 파일(로컬) 또는 Vercel 프로젝트 환경변수를 확인하세요."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
