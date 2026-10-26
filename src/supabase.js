// Supabase 연결 + 구글 로그인
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;
export const configured = !!url && !!key;
export const sb = configured ? createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: !Capacitor.isNativePlatform() },
}) : null;

// 로그인 후 돌아올 주소. Supabase 대시보드 → Authentication → URL Configuration 의 Redirect URLs에 등록해야 함
export const REDIRECT = 'com.tripagree.app://login-callback';
const native = Capacitor.isNativePlatform();

if (native && sb) {
  // 구글 로그인 창(Custom Tab)에서 앱으로 돌아올 때 코드를 세션으로 바꿈
  App.addListener('appUrlOpen', async ({ url: u }) => {
    if (!u.startsWith(REDIRECT)) return;
    const code = new URL(u).searchParams.get('code');
    await Browser.close().catch(() => {});
    if (code) await sb.auth.exchangeCodeForSession(code);
  });
}

export const onUser = cb => {
  if (!sb) return cb(null);
  let last;
  sb.auth.onAuthStateChange((_e, session) => {
    const u = session?.user || null;
    if ((u && u.id) === (last && last.id)) return;   // 토큰 갱신 때는 다시 그리지 않음
    last = u; setTimeout(() => cb(u), 0);
  });
};

export async function signIn() {
  if (native) {
    const { data, error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: REDIRECT, skipBrowserRedirect: true } });
    if (error) throw error;
    await Browser.open({ url: data.url });
  } else {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    if (error) throw error;
  }
}
export const signOut = () => sb.auth.signOut();

// 계정 삭제 (Edge Function 'delete-account'). 내 답·참여 기록·내가 방장인 여행이 함께 지워져요.
export async function deleteAccount() {
  const { data, error } = await sb.functions.invoke('delete-account', { method: 'POST' });
  if (error || !data?.ok) throw error || new Error('delete failed');
  await sb.auth.signOut().catch(() => {});
}
