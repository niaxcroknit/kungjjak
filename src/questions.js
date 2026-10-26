// 기본 질문 26개. 새 여행을 만들면 이 목록이 그 여행에 복사되고, 방장이 여행마다 넣고·빼고·고칠 수 있어요.
// type:"dates" → 달력에서 되는 날 고르기 / type:"text" → 직접 쓰기 / multi → 여러 개 선택 / etc → '기타' 칸 / fixed → 고르면 장소 입력칸
// any(기본 true) → '상관없음' 선택지 / off → 이 여행에서 뺀 질문 / custom → 방장이 새로 만든 질문
export const ETC = '기타';
export const ANY = '상관없음';

export const DEFAULT_Q = [
  { cat: '언제·어디로', id: 'dest', t: '여행지', multi: true, etc: true, fixed: '이미 정해졌어요', o: ['이미 정해졌어요', '도시', '자연', '휴양지'] },
  { cat: '언제·어디로', id: 'when', t: '가능한 날짜', type: 'dates' },
  { cat: '언제·어디로', id: 'length', t: '여행 기간', o: ['당일치기', '1박 2일', '2박 3일', '3박 4일 이상'] },
  { cat: '스타일', id: 'plan', t: '여행 계획', o: ['꼼꼼하게', '대략적으로', '계획 없이'] },
  { cat: '스타일', id: 'pace', t: '여행 강도', o: ['알차게', '느긋하게', '반반'] },
  { cat: '스타일', id: 'vibe', t: '여행 성향', o: ['부지런하게', '여유롭게'] },
  { cat: '스타일', id: 'pack', t: '준비물', o: ['모두 챙겨 가기', '최대한 가볍게', '현지에서 구매', '반반'] },
  { cat: '돈', id: 'budget', t: '1인 예산 (교통·숙박 포함)', o: ['30만 원 이하', '30~60만 원', '60~100만 원', '100만 원 이상'] },
  { cat: '돈', id: 'money', t: '경비 방식', o: ['각자 내기', '공금 모으기', '한 명이 내고 정산'] },
  { cat: '숙소', id: 'stay', t: '숙소 형태', multi: true, etc: true, o: ['호텔', '리조트', '펜션', '에어비앤비', '게스트하우스', '모텔'] },
  { cat: '숙소', id: 'staycond', t: '숙소에서 중요한 것', multi: true, etc: true, o: ['취식 가능', '청결', '프라이빗', '저렴한 가격', '위치', '부대시설'] },
  { cat: '숙소', id: 'room', t: '방 배정', o: ['다 같이 한 방', '침대만 따로', '방도 따로'] },
  { cat: '숙소', id: 'sleepnote', t: '미리 말해둘 잠버릇', type: 'text', ph: '예: 코골이 있음, 불 켜져 있으면 못 잠' },
  { cat: '이동', id: 'air', t: '항공', o: ['비행기 안 탐', '국적기', '경유 괜찮음', '무조건 최저가'] },
  { cat: '이동', id: 'move', t: '교통편', multi: true, o: ['렌터카', '자가차', '버스·지하철', '택시', '뚜벅이'] },
  { cat: '하루', id: 'sleep', t: '기상·취침', o: ['일찍 자고 일찍 일어남', '일찍 자고 늦게 일어남', '늦게 자고 일찍 일어남', '늦게 자고 늦게 일어남'] },
  { cat: '하루', id: 'day', t: '하루 동선', o: ['아침 일찍부터', '밤늦게까지', '아침부터 밤까지', '느지막이 나가서 일찍 들어오기'] },
  { cat: '하루', id: 'alone', t: '혼자 시간', o: ['따로 다녀도 OK', '웬만하면 같이'] },
  { cat: '하루', id: 'todo', t: '하고 싶은 활동', multi: true, etc: true, o: ['쇼핑', '야외에서 쉬기', '실내에서 쉬기', '액티비티', '먹방 투어', '동네 구경', '덕질'] },
  { cat: '먹기', id: 'food', t: '선호 음식', multi: true, etc: true, o: ['한식', '로컬푸드', '다이어트 중'] },
  { cat: '먹기', id: 'meals', t: '끼니', o: ['삼시세끼', '두 끼', '세 끼 + 야식'] },
  { cat: '먹기', id: 'eatery', t: '식당 고르기', o: ['웨이팅해도 맛집', '아무 데나 빨리'] },
  { cat: '먹기', id: 'drink', t: '술', o: ['매일 한잔', '가끔', '안 마심'] },
  { cat: '기타', id: 'photo', t: '사진', multi: true, o: ['인생샷 필수', '단체샷 위주', '풍경샷 위주', '인증샷 정도', '사진 필요 없음'] },
  { cat: '기타', id: 'must', t: '꼭 하고 싶은 것 하나', type: 'text', ph: '예: 성산일출봉에서 일출 보기' },
  { cat: '기타', id: 'never', t: '절대 싫은 것 하나', type: 'text', ph: '예: 웨이팅 1시간 넘는 식당' },
];
export const CATS = [...new Set(DEFAULT_Q.map(q => q.cat))];

// 저장된 질문 목록 → 화면에 쓸 목록 (뺀 질문 제외, 기타·상관없음 선택지 붙이기)
export function prep(list) {
  return (list || DEFAULT_Q).filter(q => !q.off).map(q => (q.type === 'text' || q.type === 'dates') ? { ...q }
    : { ...q, o: [...q.o.filter(x => x !== ETC && x !== ANY), ...(q.etc ? [ETC] : []), ...(q.any !== false ? [ANY] : [])] });
}
export const raw = list => structuredClone(list || DEFAULT_Q);

export const answered = (d, Q) => Q.filter(q => q.type === 'text'
  ? !!(((d.etc || {})[q.id]) || '').trim()
  : ((d.answers || {})[q.id] || []).length).length;

// 의견 비교: ok(같음) / part(일부 같음) / bad(갈림) / none(2명 미만)
// 날짜: 모두 되는 날
export function commonDates(q, list) {
  const sets = list.map(d => (d.answers || {})[q.id] || []).filter(s => s.length && !(s.length === 1 && s[0] === ANY));
  if (!sets.length) return [];
  return sets[0].filter(x => sets.every(s => s.includes(x))).sort();
}
// ['2026-11-14','2026-11-15','2026-11-21'] → '11/14~15, 11/21'
export function fmtDates(arr) {
  const ds = [...new Set(arr || [])].filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort();
  if (!ds.length) return (arr || []).includes(ANY) ? ANY : '';
  const day = x => new Date(x + 'T00:00:00');
  const runs = []; let a = ds[0], b = ds[0];
  for (const x of ds.slice(1)) { if ((day(x) - day(b)) / 864e5 === 1) b = x; else { runs.push([a, b]); a = b = x; } }
  runs.push([a, b]);
  const md = x => `${+x.slice(5, 7)}/${+x.slice(8, 10)}`;
  return runs.map(([a, b]) => a === b ? md(a) : a.slice(5, 7) === b.slice(5, 7) ? `${md(a)}~${+b.slice(8, 10)}` : `${md(a)}~${md(b)}`).join(', ');
}

export function verdict(q, list) {
  if (q.type === 'dates') {
    const all = list.map(d => (d.answers || {})[q.id] || []).filter(s => s.length);
    if (all.length < 2) return 'none';
    const real = all.filter(s => !(s.length === 1 && s[0] === ANY));
    if (real.length < 2) return 'ok';
    const c = commonDates(q, list);
    if (!c.length) return 'bad';
    return real.every(s => s.length === c.length) ? 'ok' : 'part';
  }
  const all = list.map(d => (d.answers || {})[q.id] || []).filter(s => s.length);
  if (all.length < 2) return 'none';
  const sets = all.filter(s => !(s.length === 1 && s[0] === ANY));   // '상관없음'은 누구와도 맞음
  if (sets.length < 2) return 'ok';
  const key = s => [...s].sort().join('|');
  if (sets.every(s => key(s) === key(sets[0]))) return 'ok';
  if (q.multi && sets[0].some(o => sets.every(s => s.includes(o)))) return 'part';
  return 'bad';
}

export function cellText(q, d) {
  const E = d.etc || {};
  if (q.type === 'text') return (E[q.id] || '').trim();
  if (q.type === 'dates') return fmtDates((d.answers || {})[q.id]) || (E[q.id] || '').trim();   // 예전 글 답도 보여주기
  return ((d.answers || {})[q.id] || [])
    .map(x => x === q.fixed ? (E[q.id + '_fixed'] || '정해짐') : x === ETC && E[q.id] ? E[q.id] : x)
    .join(', ');
}

// 미리보기용 예시 친구 (저장 안 됨)
const EX_T = Date.parse('2026-10-08T21:00:00+09:00');
export const EXAMPLES = {
  'ex-minji': { nickname: '민지', color: '#D9644A', updatedAt: EX_T,
    etc: { dest_fixed: '제주도', sleepnote: '코골이 조금 있어요', must: '성산일출봉에서 일출 보기', never: '1시간 넘는 웨이팅' },
    answers: { dest: ['이미 정해졌어요'], when: ['2026-11-13', '2026-11-14', '2026-11-15', '2026-11-20', '2026-11-21'], length: ['2박 3일'], plan: ['꼼꼼하게'], pace: ['알차게'], vibe: ['부지런하게'], pack: ['모두 챙겨 가기'], budget: ['30~60만 원'], money: ['공금 모으기'], stay: ['호텔', '펜션'], staycond: ['청결', '위치'], room: ['침대만 따로'], air: ['무조건 최저가'], move: ['렌터카'], sleep: ['일찍 자고 일찍 일어남'], day: ['아침 일찍부터'], alone: ['웬만하면 같이'], todo: ['동네 구경', '먹방 투어', '액티비티'], food: ['로컬푸드'], meals: ['삼시세끼'], eatery: ['웨이팅해도 맛집'], drink: ['가끔'], photo: ['인생샷 필수', '단체샷 위주'] },
    history: [{ t: EX_T, q: 'eatery', from: '아무 데나 빨리', to: '웨이팅해도 맛집' }] },
  'ex-jihoon': { nickname: '지훈', color: '#3D7FC8', updatedAt: EX_T + 600e3,
    etc: { dest_fixed: '제주도', sleepnote: '불 켜져 있으면 못 자요', must: '흑돼지 먹기', never: '새벽 기상' },
    answers: { dest: ['이미 정해졌어요'], when: ['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-28', '2026-11-29'], length: ['3박 4일 이상'], plan: ['계획 없이'], pace: ['느긋하게'], vibe: ['여유롭게'], pack: ['최대한 가볍게'], budget: ['60~100만 원'], money: ['공금 모으기'], stay: ['에어비앤비', '펜션'], staycond: ['프라이빗', '위치'], room: ['상관없음'], air: ['무조건 최저가'], move: ['렌터카', '택시'], sleep: ['늦게 자고 늦게 일어남'], day: ['밤늦게까지'], alone: ['따로 다녀도 OK'], todo: ['야외에서 쉬기', '먹방 투어'], food: ['상관없음'], meals: ['두 끼'], eatery: ['상관없음'], drink: ['매일 한잔'], photo: ['사진 필요 없음'] },
    history: [{ t: EX_T + 600e3, q: 'plan', from: '대략적으로', to: '계획 없이' }] },
};
