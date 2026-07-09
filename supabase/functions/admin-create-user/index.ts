// admin-create-user
// ------------------------------------------------------------------
// 관리자가 앱 안에서 직원 계정을 생성/삭제할 수 있도록 하는 Edge Function.
// service role key는 이 함수(서버 측) 안에서만 사용되며 브라우저에는
// 절대 전달되지 않습니다.
//
// 호출하는 쪽(브라우저)은 supabase.functions.invoke("admin-create-user", ...)
// 로 접근하며, 이때 로그인한 사용자의 access token이 Authorization 헤더에
// 자동으로 실려 옵니다. 이 함수는 그 토큰으로 "호출자가 실제로 관리자인지"
// 먼저 확인한 뒤에만 계정 생성/삭제를 수행합니다.
// ------------------------------------------------------------------
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "인증 정보가 없습니다." }, 401);

    // 호출자 본인의 권한으로 동작하는 클라이언트 (RLS 적용됨)
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      return json({ error: "로그인이 필요합니다." }, 401);
    }
    const callerId = userData.user.id;

    const { data: callerProfile, error: profileError } = await callerClient
      .from("profiles")
      .select("role, is_active")
      .eq("user_id", callerId)
      .maybeSingle();

    if (profileError || !callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) {
      return json({ error: "관리자만 사용할 수 있는 기능입니다." }, 403);
    }

    // 여기서부터는 service role 클라이언트 (RLS 우회, 서버에서만 사용)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "create") {
      const { email, password, name, department, position, role } = body;
      if (!email || !password) {
        return json({ error: "이메일과 비밀번호를 입력해주세요." }, 400);
      }
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: name || "",
          department: department || "",
          position: position || "",
          role: role || "viewer",
        },
      });
      if (error) return json({ error: error.message }, 400);
      return json({ user_id: data.user?.id });
    }

    if (action === "delete") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id가 필요합니다." }, 400);
      if (user_id === callerId) {
        return json({ error: "본인 계정은 삭제할 수 없습니다." }, 400);
      }
      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "알 수 없는 요청입니다." }, 400);
  } catch (err) {
    console.error("[admin-create-user] 처리 실패", err);
    return json({ error: "서버 오류가 발생했습니다." }, 500);
  }
});
