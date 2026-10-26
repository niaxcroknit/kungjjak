// 계정 삭제: 로그인한 본인만 자기 계정을 지울 수 있음 (Google Play 계정 삭제 요구사항)
// 함수 안에서 직접 사용자 토큰을 확인해요(verify_jwt=false 이유: 브라우저 CORS 사전 요청 통과용).
// auth.users 행이 지워지면 profiles / trip_members / answers / 내가 방장인 trips 가 FK cascade 로 같이 지워져요.
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'not signed in' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return json({ error: 'not signed in' }, 401);

  const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);
  if (delErr) return json({ error: delErr.message }, 500);
  return json({ ok: true });
});
