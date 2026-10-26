import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { App } from '@capacitor/app';
import { sb, configured, onUser, signIn, signOut, deleteAccount } from './supabase.js';
import { DEFAULT_Q, CATS, prep, raw, ETC, ANY, answered as answeredIn, verdict, cellText, commonDates, fmtDates, EXAMPLES } from './questions.js';
// 지금 열린 여행의 질문 목록 (여행마다 다를 수 있음)
let Q = prep(DEFAULT_Q);
const N = () => Q.length;
const answered = d => answeredIn(d, Q);
const qById = id => Q.find(q => q.id === id) || DEFAULT_Q.find(q => q.id === id);

const STORE_URL = import.meta.env.VITE_STORE_URL || '';
const WEB_URL = (import.meta.env.VITE_WEB_URL || '').replace(/\/$/, '');   // 아이폰 친구용 웹 주소

// 초대 링크(?join=CODE)로 들어오면 로그인 뒤에도 코드를 기억했다가 바로 참여 화면을 띄움
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} } };
(() => { if (new URLSearchParams(location.search).get('account') === 'delete') store.set('openAccount', '1'); })();
(() => { const c = new URLSearchParams(location.search).get('join'); if (c) { store.set('pendingJoin', c.toUpperCase().slice(0, 6)); history.replaceState(null, '', location.pathname); } })();

/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  kids.flat().forEach(k => k != null && k !== false && e.append(k));
  return e;
};
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2000); }
const fmt = ms => { const d = new Date(ms); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const DENIED = e => e && (e.code === '42501' || /row-level security|permission/i.test(e.message || ''));
const errText = e => DENIED(e) ? '권한이 없어요' : '인터넷 연결을 확인하고 다시 해주세요';
const must = r => { if (r.error) throw r.error; return r.data; };

/* ================= state ================= */
let me = null;                 // Supabase user ({ id, ... })
let myTrips = [];              // trips I'm in
let trip = null, tripId = null; // open trip
let answers = {};              // uid -> answer doc for open trip
let profiles = {};             // uid -> {name, photo}
let mine = { answers: {}, etc: {}, history: [] }, saved = { answers: {} }, nickname = '';
let tab = 'mine', showEx = true, exTouched = false, onlyBad = false;
let homeCh = null, tripCh = null;

const isEx = id => id.startsWith('ex-');
const isOwner = () => trip && me && trip.owner_id === me.id;
const editable = () => trip && !trip.locked;

/* ================= routing ================= */
function go(screen) {
  closeSheet();
  if (screen === 'home') { closeTrip(); renderHome(); }
}
App.addListener('backButton', () => {
  if (!$('#sheet').hidden) closeSheet();
  else if (tripId) go('home');
  else App.exitApp();
});

/* ================= login ================= */
const G_ICON = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.6 28.5A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.8-4.5l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.7 10.7l7.9-6.2z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>';
function renderLogin(msg) {
  const btn = el('button', { class: 'gbtn', type: 'button' });
  btn.innerHTML = G_ICON + '<span>Google로 시작하기</span>';
  const err = el('div', { class: 'err' }); if (msg) err.textContent = msg;
  btn.addEventListener('click', async () => {
    btn.disabled = true; err.textContent = '';
    try { await signIn(); } catch (e) { console.error(e); err.textContent = '로그인하지 못했어요. 다시 눌러주세요.'; }
    btn.disabled = false;
  });
  $('#app').replaceChildren(el('div', { class: 'screen login' },
    el('div', { class: 'eyebrow', text: '여행 합의서' }),
    el('h1', { text: '떠나기 전에\n맞춰보자' }),
    el('p', { text: '친구들과 여행 취향을 체크하고, 누가 뭘 골랐는지 한 장으로 비교해요. 바뀐 답은 기록으로 남아요.' }),
    store.get('pendingJoin') ? el('div', { class: 'notice', text: `초대받은 여행(${store.get('pendingJoin')})이 있어요. 로그인하면 바로 들어가요.` }) : null,
    btn, err));
}

/* ================= home ================= */
async function loadMyTrips() {
  try {
    const rows = must(await sb.from('trips').select('*, trip_members(count)').order('created_at', { ascending: false }));
    myTrips = rows.map(t => ({ ...t, count: t.trip_members?.[0]?.count ?? 1 }));
  } catch (e) { console.error(e); toast('여행 목록을 못 불러왔어요'); }
  if (!tripId) renderHome();
}
function watchMyTrips() {
  if (homeCh) sb.removeChannel(homeCh);
  homeCh = sb.channel('home-' + me.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members', filter: `user_id=eq.${me.id}` }, () => loadMyTrips())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips' }, () => { if (!tripId) loadMyTrips(); })
    .subscribe();
  loadMyTrips();
}
function renderHome() {
  const list = el('div', { class: 'panel' });
  if (!myTrips.length) list.append(el('div', { class: 'card empty', text: '아직 여행이 없어요.' }));
  myTrips.forEach(t => list.append(el('button', { class: 'card triprow', type: 'button', onclick: () => openTrip(t.id) },
    el('b', { text: t.name }),
    el('span', { class: 'small', text: [`${t.count}명`, t.note, t.locked ? '마감' : ''].filter(Boolean).join(' · ') }),
    el('span', { class: 'go', text: '›' }))));
  $('#app').replaceChildren(el('div', { class: 'screen' },
    el('header', { class: 'top tight' },
      el('div', { class: 'toprow' },
        el('span', { class: 'me' }, avatar(me.id), el('span', { text: profiles[me.id]?.name || '' })),
        el('button', { class: 'linkbtn plain', type: 'button', style: 'margin-left:auto', onclick: accountSheet }, '계정')),
      el('h1', { text: '내 여행' })),
    list,
    el('button', { class: 'btn', type: 'button', onclick: createSheet }, '새 여행 만들기'),
    el('button', { class: 'linkbtn plain center', type: 'button', onclick: () => joinSheet() }, '초대 코드가 있어요')));
}

/* ----- create ----- */
function createSheet() {
  const name = el('input', { class: 'field', id: 'c-name', maxlength: '30', placeholder: '예: 제주 2박 3일' });
  const note = el('input', { class: 'field', id: 'c-note', maxlength: '60', placeholder: '메모 (선택) 예: 11/14~16' });
  const btn = el('button', { class: 'btn', type: 'button', disabled: '' }, '기본 질문으로 만들기');
  const btn2 = el('button', { class: 'btn line', type: 'button', disabled: '' }, '질문 고르고 만들기');
  name.addEventListener('input', () => { btn.disabled = btn2.disabled = !name.value.trim(); });
  const make = async edit => {
    btn.disabled = btn2.disabled = true;
    try {
      const t = must(await sb.rpc('create_trip', { p_name: name.value.trim(), p_note: note.value.trim() }));
      closeSheet(); loadMyTrips(); await openTrip(t.id);
      if (edit) questionsSheet(); else toast('여행을 만들었어요. 친구들에게 코드를 보내세요');
    } catch (e) { console.error(e); toast(errText(e)); btn.disabled = btn2.disabled = false; }
  };
  btn.addEventListener('click', () => make(false));
  btn2.addEventListener('click', () => make(true));
  openSheet('새 여행', el('div', { class: 'card' }, el('h3', { text: '여행 이름' }), name, note,
    el('p', { class: 'small', text: `기본 질문 ${DEFAULT_Q.length}개로 시작해요. 질문은 나중에 '여행 관리'에서도 넣고 빼고 고칠 수 있어요.` }),
    el('div', { class: 'stack-btns' }, btn, btn2)));
  name.focus();
}

/* ----- join ----- */
function joinSheet(prefill = '') {
  const code = el('input', { class: 'field codein', id: 'j-code', maxlength: '6', placeholder: 'ABC234', autocomplete: 'off', autocapitalize: 'characters' });
  const msg = el('p', { class: 'err' });
  const btn = el('button', { class: 'btn', type: 'button', disabled: '' }, '참여하기');
  code.addEventListener('input', () => { code.value = code.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); btn.disabled = code.value.length !== 6; msg.textContent = ''; });
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      const r = await sb.rpc('join_trip', { p_code: code.value });
      if (r.error && (r.error.code === 'P0002' || /no such code/.test(r.error.message))) { msg.textContent = '없는 코드예요. 다시 확인해 주세요.'; btn.disabled = false; return; }
      const tid = must(r);
      closeSheet(); loadMyTrips(); await openTrip(tid); toast('여행에 들어왔어요');
    } catch (e) { console.error(e); msg.textContent = errText(e); btn.disabled = false; }
  });
  openSheet('코드로 참여', el('div', { class: 'card' }, el('p', { class: 'small', text: '친구에게 받은 6자리 코드를 넣어주세요.' }), code, msg, el('div', { class: 'row-btns' }, btn)));
  if (prefill) { code.value = prefill; code.dispatchEvent(new Event('input')); btn.focus(); } else code.focus();
}

/* ================= trip ================= */
async function openTrip(id) {
  closeTrip();
  tripId = id; tab = 'mine'; exTouched = false; answers = {}; lastStatus = '';
  mine = { answers: {}, etc: {}, history: [] }; saved = { answers: {} }; nickname = '';
  const ok = await loadTrip(true);
  if (!ok) return;
  // 친구가 체크하거나, 방장이 마감·이름을 바꾸거나, 누가 들어오고 나가면 바로 다시 불러옴
  let t = null; const again = () => { clearTimeout(t); t = setTimeout(() => loadTrip(false), 150); };
  tripCh = sb.channel('trip-' + id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `trip_id=eq.${id}` }, again)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${id}` }, again)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${id}` }, again)
    .subscribe();
}
async function loadTrip(first) {
  const id = tripId; if (!id) return false;
  try {
    const [tr, mem, ans] = await Promise.all([
      sb.from('trips').select('*').eq('id', id).maybeSingle(),
      sb.from('trip_members').select('user_id').eq('trip_id', id),
      sb.from('answers').select('*').eq('trip_id', id)]);
    if (id !== tripId) return false;
    const t = must(tr);
    if (!t) { toast(first ? '여행을 열 수 없어요' : '여행이 삭제됐거나 나왔어요'); go('home'); loadMyTrips(); return false; }
    const was = trip?.locked;
    const qKey = JSON.stringify(t.questions || null), qChanged = trip && trip.qKey !== qKey;
    trip = { ...t, qKey, members: must(mem).map(m => m.user_id) };
    Q = prep(trip.questions);
    answers = {}; must(ans).forEach(r => { answers[r.user_id] = { ...r, updatedAt: Date.parse(r.updated_at) }; });
    if (first) {
      const a = answers[me.id];
      if (a) { mine = { answers: { ...(a.answers || {}) }, etc: { ...(a.etc || {}) }, history: [...(a.history || [])] }; nickname = a.nickname || ''; }
      saved = structuredClone({ answers: mine.answers });
    }
    await loadProfiles(trip.members);
    if (first) step = firstOpen();
    if (first || tab !== 'mine' || was !== trip.locked || qChanged) renderTrip(); else renderHeaderOnly();
    if (!first && qChanged && !isOwner()) toast('방장이 질문을 바꿨어요');
    if (!first && was !== undefined && was !== trip.locked) toast(trip.locked ? '방장이 답변을 마감했어요' : '마감이 풀렸어요');
    return true;
  } catch (e) { console.error(e); toast(errText(e)); return false; }
}
function closeTrip() { if (tripCh) sb.removeChannel(tripCh); tripCh = null; trip = tripId = null; }

async function loadProfiles(ids) {
  const need = ids.filter(id => !isEx(id) && !profiles[id]);
  if (!need.length) return;
  try { must(await sb.from('profiles').select('id,name,photo').in('id', need)).forEach(p => { profiles[p.id] = p; }); } catch (e) { console.error(e); }
  need.forEach(id => { profiles[id] ||= { name: '' }; });
}
const shortName = id => isEx(id) ? EXAMPLES[id].nickname : id === me.id ? '나'
  : ((answers[id]?.nickname) || (profiles[id]?.name || '').split(' ')[0] || '친구');
const fullName = id => isEx(id) ? '예시·' + EXAMPLES[id].nickname
  : [profiles[id]?.name, answers[id]?.nickname && answers[id].nickname !== profiles[id]?.name ? `(${answers[id].nickname})` : ''].filter(Boolean).join(' ') || '친구';
function avatar(id) {
  const p = profiles[id];
  if (p?.photo && !isEx(id)) { const i = el('img', { class: 'av', alt: '', referrerpolicy: 'no-referrer' }); i.src = p.photo; return i; }
  const s = el('span', { class: 'av', text: (isEx(id) ? EXAMPLES[id].nickname : (p?.name || '?')).slice(0, 1) });
  s.style.background = isEx(id) ? EXAMPLES[id].color : '#62766F'; return s;
}

function renderTrip() {
  if (!trip) return;
  const head = el('header', { class: 'top tight' },
    el('div', { class: 'toprow' },
      el('button', { class: 'back', type: 'button', onclick: () => go('home') }, '‹ 내 여행'),
      el('button', { class: 'iconbtn', type: 'button', 'aria-label': '설정', onclick: settingsSheet }, '⚙')),
    el('h1', {}, trip.name, trip.locked ? el('span', { class: 'tag lock', text: '마감' }) : null),
    el('div', { class: 'toprow' },
      el('span', { class: 'status', id: 'status', text: [`${trip.members.length}명`, trip.note, `코드 ${trip.code}`].filter(Boolean).join(' · ') }),
      el('button', { class: 'btn small', type: 'button', onclick: shareTrip }, '친구 초대')));
  const tabs = el('nav', { class: 'tabs two', role: 'tablist' },
    [['mine', '체크'], ['all', '결과']].map(([k, t]) =>
      el('button', { role: 'tab', type: 'button', 'aria-selected': String(tab === k), onclick: () => { tab = k; renderTrip(); window.scrollTo(0, 0); } }, t)));
  const body = el('section', { class: 'panel', id: 'body' }); addSwipe(body);
  $('#app').replaceChildren(head, tabs, body);
  renderBody();
}
function renderHeaderOnly() {}
function renderBody() { if (tab === 'mine') renderMine(); else renderAll(); }

async function shareTrip() {
  const text = `[여행 합의서] '${trip.name}' 같이 체크하자!\n초대 코드: ${trip.code}`
    + (STORE_URL ? `\n\n갤럭시(안드로이드): 앱 받고 '코드로 참여'\n${STORE_URL}` : '')
    + (WEB_URL ? `\n\n아이폰·PC: 아래 링크 누르면 바로 참여\n${WEB_URL}/?join=${trip.code}` : '');
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast('초대 문구를 복사했어요. 카톡에 붙여넣으세요'); } catch { toast(`초대 코드: ${trip.code}`); } };
  try {
    if (Capacitor.isNativePlatform()) await Share.share({ title: '여행 합의서 초대', text, dialogTitle: '친구 초대' });
    else if (navigator.share) await navigator.share({ text });
    else await copy();
  } catch (e) { if (e?.name !== 'AbortError') await copy(); }   // 공유 창이 안 되는 환경이면 복사로
}

/* ----- 체크: 한 장에 한 질문 ----- */
let step = 0;
const isDone = (q, d) => q.type === 'text' ? !!(((d.etc || {})[q.id]) || '').trim() : ((d.answers || {})[q.id] || []).length > 0;
const firstOpen = () => { const i = Q.findIndex(q => !isDone(q, mine)); return i < 0 ? Q.length : i; };
let dir = 0;   // 1: 앞으로, -1: 뒤로 (카드 넘김 효과)
function goStep(i) {
  const next = Math.max(0, Math.min(Q.length, i)); if (next === step) return;
  dir = next > step ? 1 : -1; step = next; calMonth = null; renderMine();
  const bar = document.querySelector('.tabs'); if (bar && window.scrollY > bar.offsetTop) window.scrollTo({ top: bar.offsetTop - 8 });
}
// 좌우로 밀어서 넘기기 (달력 위에서는 무시)
function addSwipe(node) {
  let x0 = null, y0 = 0;
  node.addEventListener('touchstart', e => { if (tab !== 'mine' || e.target.closest('.cal, input, textarea')) { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  node.addEventListener('touchend', e => {
    if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goStep(step + (dx < 0 ? 1 : -1));
  }, { passive: true });
}
// 질문 목록에서 바로 이동
function jumpSheet() {
  let cat = '';
  const rows = [];
  Q.forEach((q, i) => {
    if (q.cat !== cat) { cat = q.cat; rows.push(el('div', { class: 'h2', text: cat })); }
    const a = cellText(q, mine);
    rows.push(el('button', { type: 'button', class: 'jump' + (i === step ? ' here' : ''), onclick: () => { closeSheet(); goStep(i); } },
      el('span', { class: 'jn', text: String(i + 1) }),
      el('span', { class: 'jt' }, el('b', { text: q.t }), el('span', { class: 'small', text: a || '아직 안 함' })),
      el('span', { class: 'jc', text: a ? '✓' : '' })));
  });
  openSheet(`질문 ${Q.length}개 · ${answered(mine)}개 답함`, rows);
  setTimeout(() => document.querySelector('.jump.here')?.scrollIntoView({ block: 'center' }), 50);
}

function renderMine() {
  const p = $('#body'); if (!p) return; p.replaceChildren();
  const ed = editable(), total = N(), n = answered(mine);
  if (!ed) p.append(el('div', { class: 'notice', text: '마감된 여행이에요. 답을 볼 수만 있어요.' }));

  if (step >= total) {   // 끝
    const skipped = total - n;
    p.append(el('div', { class: 'card done' },
      el('div', { class: 'big', text: skipped ? `${n}/${total}` : '다 했어요' }),
      el('p', { text: skipped ? `건너뛴 질문 ${skipped}개는 나중에 해도 돼요.` : '친구들 답이랑 비교해 볼까요?' }),
      el('button', { class: 'btn', type: 'button', onclick: () => { tab = 'all'; renderTrip(); window.scrollTo(0, 0); } }, '결과 보기'),
      skipped && ed ? el('button', { class: 'btn line', type: 'button', onclick: () => goStep(firstOpen()) }, '건너뛴 질문 하기') : null,
      el('button', { class: 'linkbtn plain', type: 'button', onclick: jumpSheet }, '질문 목록 보기')));
    return;
  }

  const q = Q[step], sel = mine.answers[q.id] || [];
  const fill = el('i'); fill.style.width = Math.round((step + 1) / total * 100) + '%';   // 지금 위치 기준
  p.append(el('div', { class: 'stepbar' },
    el('button', { type: 'button', class: 'count', onclick: jumpSheet, 'aria-label': '질문 목록 열기' }, `${step + 1} / ${total}`, el('span', { class: 'caret', text: '▾' })),
    el('span', { class: 'meter' }, fill), el('span', { class: 'saved', id: 'saved', text: lastStatus })));

  const anim = dir > 0 ? ' in-next' : dir < 0 ? ' in-prev' : ''; dir = 0;
  const card = el('div', { class: 'card qbig' + anim },
    el('div', { class: 'qcat', text: q.cat }),
    el('h2', { text: q.t }),
    el('p', { class: 'small', text: q.type === 'dates' ? '되는 날을 모두 눌러주세요' : q.type === 'text' ? '' : q.multi ? '여러 개 골라도 돼요 · 다 고르면 다음' : '하나 고르면 바로 넘어가요' }));
  if (q.type === 'dates') card.append(calendar(q, ed));
  else if (q.type === 'text') {
    const inp = el('input', { class: 'field', id: 't-' + q.id, maxlength: '80', placeholder: q.ph || '' });
    inp.value = mine.etc[q.id] || ''; inp.disabled = !ed;
    inp.addEventListener('input', () => { mine.etc[q.id] = inp.value; queueSave(); const nb = $('#next-btn'); if (nb) { const h = !!inp.value.trim(); nb.textContent = step === Q.length - 1 ? '마치기' : h ? '다음' : '건너뛰기'; nb.className = h ? 'btn' : 'btn line'; } });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') goStep(step + 1); });
    card.append(inp);
  } else {
    card.append(el('div', { class: 'opts' }, q.o.map(lab => {
      const on = sel.includes(lab);
      const b = el('button', { class: 'opt', type: 'button', 'aria-pressed': String(on), onclick: () => pick(q, lab) },
        el('span', { text: lab }), el('span', { class: 'tick', text: on ? '✓' : '' }));
      b.disabled = !ed; return b;
    })));
    const extra = (key, ph) => { const i = el('input', { class: 'field', id: 'x-' + key, maxlength: '40', placeholder: ph }); i.value = mine.etc[key] || ''; i.disabled = !ed; i.addEventListener('input', () => { mine.etc[key] = i.value; queueSave(); }); card.append(i); };
    if (q.fixed && sel.includes(q.fixed)) extra(q.id + '_fixed', '어디로 정했어요? 예: 제주도');
    if (q.etc && sel.includes(ETC)) extra(q.id, '기타 내용');
  }
  p.append(card);

  const has = isDone(q, mine), last = step === total - 1;
  const single = q.type !== 'text' && q.type !== 'dates' && !q.multi && !((q.fixed && sel.includes(q.fixed)) || (q.etc && sel.includes(ETC)));
  p.append(single
    ? el('div', { class: 'stepnav single' },
        el('button', { class: 'linkbtn plain', type: 'button', disabled: step === 0 ? '' : null, onclick: () => goStep(step - 1) }, '‹ 이전'),
        el('button', { class: 'linkbtn plain', type: 'button', onclick: () => goStep(step + 1) }, last ? '마치기 ›' : has ? '다음 ›' : '건너뛰기 ›'))
    : el('div', { class: 'stepnav' },
        el('button', { class: 'btn line', type: 'button', disabled: step === 0 ? '' : null, onclick: () => goStep(step - 1) }, '이전'),
        el('button', { class: has ? 'btn' : 'btn line', type: 'button', id: 'next-btn', onclick: () => goStep(step + 1) }, last ? '마치기' : has ? '다음' : '건너뛰기')));
}
function pick(q, lab) {
  if (!editable()) return;
  let sel = mine.answers[q.id] || [];
  const solo = [ANY, q.fixed].filter(Boolean);
  if (!q.multi && sel.includes(lab) && lab !== q.fixed && lab !== ETC) { goStep(step + 1); return; }   // 이미 고른 걸 다시 누르면 그냥 다음으로
  if (sel.includes(lab)) sel = sel.filter(x => x !== lab);
  else if (!q.multi || solo.includes(lab) || sel.some(x => solo.includes(x))) sel = [lab];
  else sel = [...sel, lab];
  mine.answers = { ...mine.answers, [q.id]: sel };
  queueSave();
  // 하나만 고르는 질문은 고르면 바로 다음 장으로 (장소·기타 입력이 필요한 경우 빼고)
  const needsInput = (lab === q.fixed || lab === ETC) && sel.includes(lab);
  if (!q.multi && sel.length && !needsInput) { renderMine(); setTimeout(() => { if (Q[step]?.id === q.id) goStep(step + 1); }, 180); /* 실시간 새로고침으로 Q가 새 객체가 돼도 id로 비교 */ }
  else renderMine();
}
/* ----- 달력 (가능한 날짜) ----- */
let calMonth = null;   // 'YYYY-MM' 보고 있는 달
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function calendar(q, ed) {
  const sel = (mine.answers[q.id] || []).filter(x => x !== ANY), any = (mine.answers[q.id] || []).includes(ANY);
  const today = iso(new Date());
  if (!calMonth) calMonth = (sel[0] || today).slice(0, 7);
  const [y, m] = calMonth.split('-').map(Number);
  const first = new Date(y, m - 1, 1), days = new Date(y, m, 0).getDate();
  const shift = k => { const d = new Date(y, m - 1 + k, 1); calMonth = iso(d).slice(0, 7); renderMine(); };
  const set = arr => { mine.answers = { ...mine.answers, [q.id]: arr }; queueSave(); renderMine(); };
  const grid = el('div', { class: 'cal-grid' }, ['일', '월', '화', '수', '목', '금', '토'].map((d, i) => el('span', { class: 'cal-dow' + (i === 0 ? ' sun' : i === 6 ? ' sat' : ''), text: d })));
  for (let i = 0; i < first.getDay(); i++) grid.append(el('span'));
  for (let d = 1; d <= days; d++) {
    const k = `${calMonth}-${String(d).padStart(2, '0')}`, on = sel.includes(k), past = k < today, dow = (first.getDay() + d - 1) % 7;
    grid.append(el('button', { type: 'button', class: 'cal-day' + (on ? ' on' : '') + (k === today ? ' today' : '') + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''),
      'aria-pressed': String(on), 'aria-label': `${m}월 ${d}일`, disabled: (!ed || past) ? '' : null,
      onclick: () => set(on ? sel.filter(x => x !== k) : [...sel, k].sort()) }, String(d)));
  }
  return el('div', { class: 'cal' },
    el('div', { class: 'cal-head' },
      el('button', { type: 'button', class: 'mini', 'aria-label': '이전 달', disabled: calMonth <= today.slice(0, 7) ? '' : null, onclick: () => shift(-1) }, '‹'),
      el('b', { text: `${y}년 ${m}월` }),
      el('button', { type: 'button', class: 'mini', 'aria-label': '다음 달', onclick: () => shift(1) }, '›')),
    grid,
    el('div', { class: 'cal-foot' },
      el('span', { class: 'small', text: sel.length ? `${sel.length}일 · ${fmtDates(sel)}` : '아직 고른 날이 없어요' }),
      el('button', { type: 'button', class: 'opt slim', 'aria-pressed': String(any), disabled: !ed ? '' : null,
        onclick: () => set(any ? [] : [ANY]) }, el('span', { text: '아무 때나 괜찮아' }), el('span', { class: 'tick', text: any ? '✓' : '' }))));
}

function resetCard() {
  const open = el('button', { class: 'linkbtn', type: 'button' }, '내 답 전부 지우기');
  const box = el('div', { class: 'panel' }); box.hidden = true;
  const inp = el('input', { class: 'field', id: 'reset-word', maxlength: '6', placeholder: "'지우기'라고 입력", autocomplete: 'off' });
  const goBtn = el('button', { class: 'btn danger', type: 'button', disabled: '' }, '전부 지우기');
  box.append(el('p', { class: 'small', text: '이 여행에서 고른 답이 모두 지워져요. 기록에는 남아요.' }), inp,
    el('div', { class: 'row-btns' }, goBtn, el('button', { class: 'btn line', type: 'button', onclick: () => { box.hidden = true; open.hidden = false; } }, '취소')));
  open.addEventListener('click', () => { box.hidden = false; open.hidden = true; inp.focus(); });
  inp.addEventListener('input', () => { goBtn.disabled = inp.value.trim() !== '지우기'; });
  goBtn.addEventListener('click', () => {
    mine = { answers: {}, etc: {}, history: mine.history };
    saved = { answers: {} }; step = 0; closeSheet(); tab = 'mine'; renderTrip(); toast('내 답을 지웠어요'); queueSave(true);
  });
  return el('div', { class: 'panel' }, open, box);
}

/* ----- saving ----- */
let timer = null, saving = null, dirty = false;
let lastStatus = '';
function setStatus(t) { lastStatus = t; const s = $('#saved'); if (s) s.textContent = t; }
function queueSave(now) { dirty = true; setStatus('저장 중…'); clearTimeout(timer); timer = setTimeout(flush, now ? 0 : 700); }
async function flush() {
  if (saving) await saving;
  if (!dirty || !tripId) return; dirty = false;
  const t = Date.now();   // 바뀐 기록(history)은 서버 트리거가 직접 남겨요. 앱은 보내지 않아요.
  const snap = { answers: structuredClone(mine.answers) };
  saving = sb.from('answers').upsert({ trip_id: tripId, user_id: me.id, answers: mine.answers, etc: mine.etc, nickname })
    .then(r => { if (r.error) throw r.error; saved = snap; setStatus('저장됨 · ' + fmt(t)); })
    .catch(e => { console.error(e); setStatus(DENIED(e) ? '마감돼서 저장 안 됐어요' : '저장 실패, 다시 시도할게요'); if (!DENIED(e)) { dirty = true; setTimeout(flush, 2500); } })
    .finally(() => { saving = null; });
  await saving;
}

/* ----- 결과: 결론 먼저, 표는 나중에 ----- */
let showTable = false;
function realPeople() {
  const real = {};
  for (const [id, d] of Object.entries(answers)) if (trip.members.includes(id) && answered(d)) real[id] = d;
  return real;
}
function shown() { const real = realPeople(); return Object.keys(real).length < 2 ? { ...real, ...EXAMPLES } : real; }
const changed = (d, qid) => (d.history || []).some(h => h.q === qid && h.from);

function groupsFor(q, ids, V) {   // 같은 답끼리 묶기: [{ text, who: [ids] }]
  const m = new Map();
  ids.forEach(id => { const t = cellText(q, V[id]); if (!t) return; if (!m.has(t)) m.set(t, []); m.get(t).push(id); });
  return [...m].map(([text, who]) => ({ text, who })).sort((a, b) => b.who.length - a.who.length);
}
function faces(list) { const w = el('span', { class: 'faces' }); list.slice(0, 5).forEach(id => w.append(avatar(id))); return w; }

function resultCard(q, ids, V, kind) {
  const c = el('div', { class: 'card res ' + kind }, el('h3', { text: q.t }));
  if (q.type === 'dates') {
    const both = commonDates(q, ids.map(id => V[id]));
    c.append(el('div', { class: 'common big-common', text: both.length ? `모두 되는 날 · ${fmtDates(both)}` : '모두 되는 날이 없어요' }));
  }
  groupsFor(q, ids, V).forEach(g => {
    const moved = g.who.some(id => changed(V[id], q.id));
    c.append(el('div', { class: 'grp' },
      el('div', { class: 'gtext' }, el('b', { text: g.text }),
        moved ? el('button', { class: 'moved', type: 'button', onclick: () => historySheet(q.id) }, '바뀜') : null),
      el('div', { class: 'gwho' }, faces(g.who), el('span', { class: 'small', text: g.who.map(shortName).join(', ') }))));
  });
  if (kind === 'part') {
    const sets = ids.map(id => (V[id].answers || {})[q.id] || []).filter(s => s.length && !(s.length === 1 && s[0] === ANY));
    const common = sets[0]?.filter(o => sets.every(s => s.includes(o))) || [];
    if (common.length) c.append(el('div', { class: 'common', text: '모두 고른 것 · ' + common.join(', ') }));
  }
  return c;
}

async function renderAll() {
  const p = $('#body'); if (!p) return;
  const real = realPeople(), useEx = Object.keys(real).length < 2;
  const V = useEx ? { ...real, ...EXAMPLES } : real;
  const ids = Object.keys(V).sort((a, b) => a === me.id ? -1 : b === me.id ? 1 : 0);
  await loadProfiles(ids);
  p.replaceChildren();
  if (useEx) p.append(el('div', { class: 'notice', text: '아직 친구 답이 없어서 예시 친구 2명으로 보여줘요. 친구가 답하면 바뀌어요.' }));
  if (!ids.length) return;

  const vs = {}, cnt = { ok: 0, part: 0, bad: 0 };
  Q.forEach(q => { if (q.type === 'text') return; vs[q.id] = verdict(q, ids.map(id => V[id])); if (cnt[vs[q.id]] != null) cnt[vs[q.id]]++; });
  const by = k => Q.filter(q => vs[q.id] === k);

  p.append(el('div', { class: 'hero' },
    el('div', { class: 'big ' + (cnt.bad ? 'red' : 'green'), text: cnt.bad ? `얘기할 것 ${cnt.bad}개` : '다 맞았어요' }),
    el('div', { class: 'small' }, faces(ids), ` ${ids.length}명 · 같음 ${cnt.ok} · 일부 같음 ${cnt.part}`)));

  by('bad').forEach(q => p.append(resultCard(q, ids, V, 'bad')));

  const fold = (title, kids) => { if (!kids.length) return; const d = el('details', { class: 'fold' }, el('summary', {}, title)); kids.forEach(k => d.append(k)); p.append(d); };
  fold(`일부만 같은 것 ${cnt.part}개`, by('part').map(q => resultCard(q, ids, V, 'part')));
  const texts = Q.filter(q => q.type === 'text' && ids.some(id => cellText(q, V[id])));
  fold(`각자 적은 것 ${texts.length}개`, texts.map(q => resultCard(q, ids, V, 'text')));
  fold(`다 같은 것 ${cnt.ok}개`, [el('div', { class: 'card' }, el('ul', { class: 'same' }, by('ok').map(q => {
    const pk = ids.map(id => cellText(q, V[id])).filter(t => t && t !== ANY);
    return el('li', {}, el('span', { text: q.t }), el('b', { text: pk[0] || '모두 상관없음' }));
  })))]);

  p.append(el('button', { class: 'btn line', type: 'button', onclick: () => { showTable = !showTable; renderAll(); } }, showTable ? '전체 표 닫기' : '전체 표 보기'));
  if (showTable) p.append(el('div', { class: 'tablewrap' }, el('table', { class: 'grid' },
    el('thead', {}, el('tr', {}, el('th', { class: 'qcol', text: '질문' }),
      ids.map(id => el('th', {}, el('span', { class: 'hd' }, avatar(id), el('span', { text: shortName(id) })))))),
    el('tbody', {}, Q.map(q => el('tr', { class: vs[q.id] || 'text' }, el('th', { class: 'qcol', text: q.t }),
      ids.map(id => { const t = cellText(q, V[id]); return el('td', { class: t ? '' : 'blank', text: t || '–' }); })))))));
}

/* ----- 바뀐 기록 (시트) ----- */
const show = (q, v) => q?.type === 'dates' && v ? fmtDates(v.split(', ')) : v;
function historySheet(qid) {
  const V = shown(), items = [];
  for (const [id, d] of Object.entries(V)) (d.history || []).forEach(h => { if (!qid || h.q === qid) items.push({ ...h, id }); });
  items.sort((a, b) => b.t - a.t);
  const body = items.length ? el('div', { class: 'card' }, el('ul', { class: 'log' }, items.slice(0, 150).map(h => {
    const nm = el('b', { text: fullName(h.id) });
    let what;
    if (h.q === '__reset') what = el('div', { class: 'what' }, nm, ` · 답을 전부 지움 (${h.from})`);
    else { const q = qById(h.q); if (!q) return null;
      what = el('div', { class: 'what' }, nm, qid ? '' : ` · ${q.t}`, el('div', {},
        el('span', { class: 'arrow', text: (show(q, h.from) || '(처음)') + ' → ' }), el('ins', { text: show(q, h.to) || '(선택 해제)' }))); }
    what.append(el('div', { class: 'small', text: fmt(h.t) }));
    return el('li', {}, avatar(h.id), what);
  }))) : el('div', { class: 'card empty', text: '아직 바뀐 게 없어요.' });
  openSheet(qid ? (qById(qid)?.t || '기록') : '바뀐 기록', [body]);
}

/* ----- settings / owner ----- */
function settingsSheet() {
  const cards = [];
  const busy = async (btn, fn, ok) => { btn.disabled = true; try { await fn(); toast(ok); } catch (e) { console.error(e); toast(errText(e)); } btn.disabled = false; };
  const nick = el('input', { class: 'field', id: 'nick', maxlength: '20', placeholder: profiles[me.id]?.name || '이름' });
  nick.value = nickname; nick.disabled = !editable();
  nick.addEventListener('input', () => { nickname = nick.value.trim(); queueSave(); });
  cards.push(el('div', { class: 'card' }, el('h3', { text: '이 여행에서 내 이름' }), nick,
    el('button', { class: 'linkbtn plain', type: 'button', onclick: () => historySheet() }, '바뀐 기록 전체 보기'),
    editable() && answered(mine) ? resetCard() : null));
  if (isOwner()) cards.push(el('div', { class: 'h2', text: '방장 메뉴' }));
  if (isOwner()) {
    const nm = el('input', { class: 'field', id: 's-name', maxlength: '30' }); nm.value = trip.name;
    const nt = el('input', { class: 'field', id: 's-note', maxlength: '60', placeholder: '메모 (예: 11/14~16 · 4명)' }); nt.value = trip.note || '';
    const sv = el('button', { class: 'btn', type: 'button' }, '저장');
    sv.addEventListener('click', () => busy(sv, async () => must(await sb.from('trips').update({ name: nm.value.trim() || trip.name, note: nt.value.trim() }).eq('id', tripId)), '저장했어요'));
    cards.push(el('div', { class: 'card' }, el('h3', { text: '여행 이름' }), nm, nt, el('div', { class: 'row-btns' }, sv)));
    cards.push(el('div', { class: 'card' }, el('h3', { text: '질문' }),
      el('p', { class: 'small', text: `지금 ${N()}개${trip.questions ? ' (직접 고친 목록)' : ' (기본 질문)'}. 넣고, 빼고, 문구와 선택지를 고칠 수 있어요.` }),
      el('div', { class: 'row-btns' }, el('button', { class: 'btn', type: 'button', onclick: () => questionsSheet() }, '질문 편집'))));

    const lk = el('button', { class: trip.locked ? 'btn line' : 'btn danger', type: 'button' }, trip.locked ? '마감 풀기' : '답변 마감하기');
    lk.addEventListener('click', () => busy(lk, async () => must(await sb.from('trips').update({ locked: !trip.locked }).eq('id', tripId)), trip.locked ? '마감을 풀었어요' : '마감했어요').then(closeSheet));
    cards.push(el('div', { class: 'card' }, el('h3', { text: '답변 마감' }),
      el('p', { class: 'small', text: trip.locked ? '지금 마감돼 있어서 아무도 답을 못 바꿔요.' : '계획이 확정되면 마감하세요. 나를 포함해 아무도 답을 못 바꿔요. 서버에서 막아서 우회할 수 없어요.' }),
      el('div', { class: 'row-btns' }, lk)));

    const word = el('input', { class: 'field', id: 's-del', placeholder: `'${trip.name}' 입력`, autocomplete: 'off' });
    const del = el('button', { class: 'btn danger', type: 'button', disabled: '' }, '여행 삭제');
    word.addEventListener('input', () => { del.disabled = word.value.trim() !== trip.name; });
    del.addEventListener('click', () => busy(del, async () => {
      must(await sb.from('trips').delete().eq('id', tripId)); go('home'); loadMyTrips();
    }, '여행을 삭제했어요'));
    cards.push(el('div', { class: 'card' }, el('h3', { text: '여행 삭제' }),
      el('p', { class: 'small', text: '모든 친구에게서 이 여행이 사라져요. 되돌릴 수 없어서 여행 이름을 똑같이 입력해야 지워져요.' }), word, el('div', { class: 'row-btns' }, del)));
  } else {
    const lv = el('button', { class: 'btn line', type: 'button' }, '이 여행에서 나가기');
    let armed = false;
    lv.addEventListener('click', () => {
      if (!armed) { armed = true; lv.textContent = '정말 나가기'; lv.className = 'btn danger'; return; }
      busy(lv, async () => { must(await sb.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', me.id)); go('home'); loadMyTrips(); }, '여행에서 나왔어요');
    });
    cards.push(el('div', { class: 'card' }, el('h3', { text: '여행 나가기' }),
      el('p', { class: 'small', text: '내 답은 남아 있고, 같은 코드로 다시 들어올 수 있어요.' }), el('div', { class: 'row-btns' }, lv)));
  }
  openSheet('설정', cards);
}

/* ================= 질문 편집 (방장) ================= */
const typeOf = q => q.type === 'text' ? 'text' : q.type === 'dates' ? 'dates' : q.multi ? 'multi' : 'one';
const TYPE_LABEL = { one: '하나만', multi: '여러 개', dates: '날짜', text: '직접 쓰기' };
const cleanOpts = q => (q.o || []).filter(x => x !== ETC && x !== ANY);

async function saveQuestions(list, msg = '저장했어요') {
  try { must(await sb.from('trips').update({ questions: list }).eq('id', tripId)); trip.questions = list; trip.qKey = JSON.stringify(list); Q = prep(list); toast(msg); renderTrip(); return true; }
  catch (e) { console.error(e); toast(errText(e)); return false; }
}

function questionsSheet() {
  if (!isOwner()) return;
  let list = raw(trip.questions);
  const someone = Object.values(answers).some(a => answered(a));
  const draw = () => {
    const body = [];
    if (trip.locked) body.push(el('div', { class: 'notice', text: '답변 마감 중에는 질문을 바꿀 수 없어요. 여행 관리에서 마감을 먼저 풀어주세요.' }));
    else if (someone) body.push(el('p', { class: 'small', text: '이미 답한 친구가 있어요. 뺀 질문의 답은 표에서 숨겨지고(지워지진 않아요), 선택지를 바꾸면 그 질문은 다시 골라야 할 수 있어요.' }));
    const dis = !!trip.locked;
    body.push(el('button', { class: 'btn', type: 'button', disabled: dis ? '' : null, onclick: () => editQuestion(null) }, '+ 질문 추가'));
    const on = list.filter(q => !q.off), off = list.filter(q => q.off);
    const cats = [...new Set(on.map(q => q.cat))];
    cats.forEach(c => {
      body.push(el('div', { class: 'h2', text: c }));
      body.push(el('div', { class: 'card qlist' }, on.filter(q => q.cat === c).map(q => el('div', { class: 'qrow' },
        el('div', { class: 'qinfo' }, el('b', { text: q.t }), el('span', { class: 'small', text: TYPE_LABEL[typeOf(q)] + (q.type === 'text' || q.type === 'dates' ? '' : ` · ${cleanOpts(q).length}개`) + (q.custom ? ' · 새로 만든 질문' : '') })),
        el('button', { class: 'mini', type: 'button', disabled: dis ? '' : null, onclick: () => editQuestion(q) }, '수정'),
        el('button', { class: 'mini warn', type: 'button', disabled: dis ? '' : null, onclick: async () => {
          if (on.length <= 1) { toast('질문은 1개 이상 있어야 해요'); return; }
          q.off = true; if (await saveQuestions(list, `'${q.t}' 뺐어요`)) draw(); else q.off = false;
        } }, '빼기')))));
    });
    if (off.length) {
      body.push(el('div', { class: 'h2', text: `뺀 질문 ${off.length}개` }));
      body.push(el('div', { class: 'card qlist' }, off.map(q => el('div', { class: 'qrow' },
        el('div', { class: 'qinfo' }, el('span', { class: 'muted', text: q.t })),
        el('button', { class: 'mini', type: 'button', disabled: dis ? '' : null, onclick: async () => {
          delete q.off; if (await saveQuestions(list, `'${q.t}' 다시 넣었어요`)) draw(); else q.off = true;
        } }, '다시 넣기')))));
    }
    if (trip.questions) body.push(el('button', { class: 'linkbtn', type: 'button', disabled: dis ? '' : null, onclick: async (ev) => {
      const b = ev.currentTarget; if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = '정말 기본 질문으로 되돌리기 (한 번 더 누르기)'; return; }
      try { must(await sb.from('trips').update({ questions: null }).eq('id', tripId)); trip.questions = null; trip.qKey = 'null'; Q = prep(null); list = raw(null); toast('기본 질문으로 되돌렸어요'); renderTrip(); draw(); } catch (e) { toast(errText(e)); }
    } }, '기본 질문으로 되돌리기'));
    openSheet(`질문 ${on.length}개`, body);
  };

  function editQuestion(q) {
    const isNew = !q;
    const cur = q ? structuredClone(q) : { id: 'c' + Date.now().toString(36), cat: CATS[0], t: '', o: [], any: true, custom: true };
    let type = typeOf(cur);
    const title = el('input', { class: 'field', id: 'q-title', maxlength: '30', placeholder: '예: 숙소 체크인 전에 짐 맡기기' }); title.value = cur.t;
    const allCats = [...new Set([...CATS, ...list.map(x => x.cat)])];
    const cat = el('select', { class: 'field', id: 'q-cat' }, allCats.map(c => { const o = el('option', { value: c, text: c }); if (c === cur.cat) o.selected = true; return o; }), el('option', { value: '__new', text: '+ 새 분야 만들기' }));
    const newCat = el('input', { class: 'field', id: 'q-newcat', maxlength: '12', placeholder: '새 분야 이름 (예: 쇼핑)' }); newCat.hidden = true;
    cat.addEventListener('change', () => { newCat.hidden = cat.value !== '__new'; if (!newCat.hidden) newCat.focus(); });
    const seg = el('div', { class: 'seg2 seg4' });
    const opts = el('textarea', { class: 'field', id: 'q-opts', rows: '5', placeholder: '선택지를 한 줄에 하나씩\n예:\n2박 3일\n3박 4일' }); opts.value = cleanOpts(cur).join('\n');
    const ph = el('input', { class: 'field', id: 'q-ph', maxlength: '40', placeholder: '입력칸 안내 문구 (선택)' }); ph.value = cur.ph || '';
    const anyCb = el('input', { type: 'checkbox', id: 'q-any' }); anyCb.checked = cur.any !== false;
    const etcCb = el('input', { type: 'checkbox', id: 'q-etc' }); etcCb.checked = !!cur.etc;
    const choiceBox = el('div', { class: 'panel' }, el('label', { class: 'small', for: 'q-opts', text: '선택지 (한 줄에 하나, 2~12개)' }), opts,
      el('label', { class: 'exrow', for: 'q-any' }, anyCb, el('span', { text: "'상관없음' 선택지 넣기" })),
      el('label', { class: 'exrow', for: 'q-etc' }, etcCb, el('span', { text: "'기타' (직접 입력) 넣기" })));
    const textBox = el('div', { class: 'panel' }, ph);
    const msg = el('p', { class: 'err' });
    const setType = t => { type = t; seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === t))); choiceBox.hidden = t === 'text' || t === 'dates'; textBox.hidden = t !== 'text'; };
    Object.entries(TYPE_LABEL).forEach(([k, v]) => seg.append(el('button', { type: 'button', 'data-t': k, onclick: () => setType(k) }, v)));
    setType(type);

    const save = el('button', { class: 'btn', type: 'button' }, isNew ? '추가하기' : '저장');
    save.addEventListener('click', async () => {
      const t = title.value.trim(); if (!t) { msg.textContent = '질문을 적어주세요.'; return; }
      const c = cat.value === '__new' ? newCat.value.trim() : cat.value; if (!c) { msg.textContent = '새 분야 이름을 적어주세요.'; return; }
      const next = { id: cur.id, cat: c, t };
      if (cur.custom) next.custom = true;
      if (type === 'text') { next.type = 'text'; if (ph.value.trim()) next.ph = ph.value.trim(); }
      else if (type === 'dates') next.type = 'dates';
      else {
        const o = [...new Set(opts.value.split('\n').map(x => x.trim().slice(0, 30)).filter(x => x && x !== ETC && x !== ANY))];
        if (o.length < 2) { msg.textContent = '선택지를 2개 이상 적어주세요.'; return; }
        if (o.length > 12) { msg.textContent = '선택지는 12개까지예요.'; return; }
        next.o = o; if (type === 'multi') next.multi = true; if (etcCb.checked) next.etc = true; if (!anyCb.checked) next.any = false;
        if (cur.fixed && o.includes(cur.fixed)) next.fixed = cur.fixed;
      }
      const copy = structuredClone(list);
      if (isNew) {   // 같은 분야의 마지막 질문 뒤에 넣기
        let at = -1; copy.forEach((x, i) => { if (x.cat === c && !x.off) at = i; });
        copy.splice(at < 0 ? copy.length : at + 1, 0, next);
      } else copy[copy.findIndex(x => x.id === cur.id)] = next;
      save.disabled = true;
      if (await saveQuestions(copy, isNew ? '질문을 추가했어요' : '질문을 고쳤어요')) { list = copy; draw(); } else save.disabled = false;
    });
    openSheet(isNew ? '질문 추가' : '질문 수정', [el('div', { class: 'card' },
      el('label', { class: 'small', for: 'q-title', text: '질문' }), title,
      el('label', { class: 'small', for: 'q-cat', text: '분야' }), cat, newCat,
      el('span', { class: 'small', text: '답 방식' }), seg, choiceBox, textBox, msg,
      el('div', { class: 'row-btns' }, save, el('button', { class: 'btn line', type: 'button', onclick: draw }, '취소')))]);
    if (isNew) title.focus();
  }
  draw();
}

/* ================= 계정 (로그아웃 · 삭제) ================= */
function accountSheet() {
  const owned = myTrips.filter(t => t.owner_id === me.id);
  const word = el('input', { class: 'field', id: 'del-word', maxlength: '4', placeholder: "'삭제'라고 입력", autocomplete: 'off' });
  const del = el('button', { class: 'btn danger', type: 'button', disabled: '' }, '계정 삭제');
  const msg = el('p', { class: 'err' });
  word.addEventListener('input', () => { del.disabled = word.value.trim() !== '삭제'; });
  del.addEventListener('click', async () => {
    del.disabled = true; msg.textContent = '';
    try { await deleteAccount(); closeSheet(); toast('계정을 삭제했어요'); }
    catch (e) { console.error(e); msg.textContent = '삭제하지 못했어요. 인터넷 연결을 확인하고 다시 해주세요.'; del.disabled = false; }
  });
  openSheet('계정', [
    el('div', { class: 'card' }, el('div', { class: 'me' }, avatar(me.id), el('b', { text: profiles[me.id]?.name || '' })),
      el('button', { class: 'btn line', type: 'button', onclick: async () => { closeSheet(); await signOut(); } }, '로그아웃')),
    el('div', { class: 'card' }, el('h3', { text: '계정 삭제' }),
      el('ul', { class: 'small bullets' },
        el('li', { text: '내 이름·사진, 모든 여행의 내 답과 기록이 지워져요.' }),
        owned.length ? el('li', { text: `내가 방장인 여행 ${owned.length}개(${owned.map(t => t.name).join(', ')})는 친구들 것까지 통째로 지워져요.` }) : null,
        el('li', { text: '되돌릴 수 없어요.' })),
      word, msg, el('div', { class: 'row-btns' }, del)),
  ]);
}

/* ================= sheet ================= */
function openSheet(title, body) { $('#sheet-title').textContent = title; $('#sheet-body').replaceChildren(...[body].flat()); $('#sheet').hidden = false; }
function closeSheet() { $('#sheet').hidden = true; }
$('#sheet-close').addEventListener('click', closeSheet);
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closeSheet(); });

/* ================= boot ================= */
if (!configured) {
  $('#app').replaceChildren(el('div', { class: 'screen login' }, el('h1', { text: '설정이 필요해요' }),
    el('p', { text: '.env 파일에 Supabase 주소와 키를 넣어주세요. README를 참고하세요.' })));
} else {
  onUser(async u => {
    me = u;
    if (!u) { if (homeCh) sb.removeChannel(homeCh); homeCh = null; closeTrip(); renderLogin(); return; }
    const md = u.user_metadata || {};
    const prof = { id: u.id, name: md.full_name || md.name || (u.email || '').split('@')[0], photo: md.avatar_url || md.picture || '', updated_at: new Date().toISOString() };
    profiles[u.id] = prof;
    sb.from('profiles').upsert(prof).then(r => r.error && console.error(r.error));
    watchMyTrips(); renderHome();
    const pj = store.get('pendingJoin'); if (pj) { store.set('pendingJoin', ''); joinSheet(pj); }
    if (store.get('openAccount')) { store.set('openAccount', ''); accountSheet(); }
  });
  App.addListener('resume', () => { if (!me) return; if (tripId) loadTrip(false); else loadMyTrips(); });
}
