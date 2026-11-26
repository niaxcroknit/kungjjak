// 결과를 이미지 한 장으로 (단톡방에 올리기용, 가로 1080px)
const W = 1080, PAD = 64;
const C = {
  bg: '#F5F1EA', paper: '#FFFFFF', ink: '#1B2A26', muted: '#6A746F', line: '#E7E1D6',
  teal: '#0E7C66', teal2: '#0B6A57', tealSoft: '#DDF1EA', coral: '#E8542F', coralSoft: '#FDE7DF', gold: '#A8720A',
};
const DISPLAY = '"Do Hyeon","Gothic A1",sans-serif';
const BODY = '"Gothic A1","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

async function fontsReady() {
  if (!document.fonts?.load) return;
  const wait = Promise.all([
    document.fonts.load(`80px ${DISPLAY}`, '쿵짝트립'), document.fonts.load(`800 36px ${BODY}`, '가나다'),
    document.fonts.load(`600 30px ${BODY}`, '가나다'), document.fonts.load(`400 30px ${BODY}`, '가나다')]).catch(() => {});
  await Promise.race([wait, new Promise(r => setTimeout(r, 2500))]);   // 글꼴이 늦으면 기본 글꼴로라도 그려요
}
function loadImg(src) {
  return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// 한국어는 띄어쓰기 단위로 줄바꿈, 너무 긴 단어만 글자 단위로
function wrap(ctx, text, maxW) {
  const out = []; let line = '';
  for (const word of String(text).split(/(\s+)/)) {
    const tryLine = line + word;
    if (ctx.measureText(tryLine).width <= maxW) { line = tryLine; continue; }
    if (line.trim()) { out.push(line.trimEnd()); line = ''; }
    let w = word.trimStart();
    while (ctx.measureText(w).width > maxW) {
      let k = w.length; while (k > 1 && ctx.measureText(w.slice(0, k)).width > maxW) k--;
      out.push(w.slice(0, k)); w = w.slice(k);
    }
    line = w;
  }
  if (line.trim()) out.push(line.trimEnd());
  return out.length ? out : [''];
}
function text(ctx, s, x, y, { font, color, maxW = W - 2 * PAD, lh = 44, align = 'left' }) {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const ls = wrap(ctx, s, maxW);
  ls.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return y + (ls.length - 1) * lh;
}

/**
 * data: { name, meta, counts:{ok,part,bad}, bad:[{t, note, groups:[{text,names}]}], ok:[{t,a}], url, logo }
 */
export async function drawResult(data) {
  await fontsReady();
  const svg = data.logo && (data.logo.includes('xmlns=') ? data.logo : data.logo.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  const logo = svg ? await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)) : null;
  const paint = ctx => layout(ctx, data, logo);
  const probe = document.createElement('canvas'); probe.width = W; probe.height = 10;
  const H = Math.ceil(paint(probe.getContext('2d')));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  paint(cv.getContext('2d'));
  return cv;
}

const MAX_BAD = 5, MAX_OK = 8;
function layout(ctx, d, logo) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, 99999);
  let y = 56;

  // ---- 위: 탑승권 ----
  const top = y, inner = W - 2 * PAD - 112;
  let ty = top + 56;
  // 높이를 먼저 재고 그리기 위해 글자만 따로 계산
  ctx.font = `86px ${DISPLAY}`; const nameLines = wrap(ctx, d.name, inner).length;
  const headH = 56 + 64 + 34 + nameLines * 96 + 20 + 40 + 44;
  const stubH = 190;
  const g = ctx.createLinearGradient(PAD, top, W - PAD, top + headH + stubH);
  g.addColorStop(0, '#13957B'); g.addColorStop(1, C.teal2);
  ctx.fillStyle = g; rrect(ctx, PAD, top, W - 2 * PAD, headH + stubH, 44); ctx.fill();
  // 절취선 양쪽 홈
  ctx.fillStyle = C.bg;
  [PAD, W - PAD].forEach(cx => { ctx.beginPath(); ctx.arc(cx, top + headH, 22, 0, Math.PI * 2); ctx.fill(); });
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 4; ctx.setLineDash([2, 16]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(PAD + 44, top + headH); ctx.lineTo(W - PAD - 44, top + headH); ctx.stroke(); ctx.setLineDash([]);

  const x0 = PAD + 56;
  if (logo) ctx.drawImage(logo, x0, ty, 64, 64);
  text(ctx, '쿵짝트립', x0 + 82, ty + 46, { font: `40px ${DISPLAY}`, color: '#fff' });
  text(ctx, '여행 체크 결과', W - PAD - 56, ty + 44, { font: `700 28px ${BODY}`, color: 'rgba(255,255,255,.8)', align: 'right' });
  ty += 64 + 34 + 78;
  ty = text(ctx, d.name, x0, ty, { font: `86px ${DISPLAY}`, color: '#fff', maxW: inner, lh: 96 });
  ty += 20 + 40;
  text(ctx, d.meta, x0, ty, { font: `600 32px ${BODY}`, color: 'rgba(255,255,255,.85)', maxW: inner });

  // 숫자 세 칸
  const sy = top + headH + 62, colW = (W - 2 * PAD - 112) / 3;
  [['맞은 것', d.counts.ok], ['일부 같음', d.counts.part], ['얘기할 것', d.counts.bad]].forEach(([lab, n], i) => {
    const cx = x0 + colW * i;
    text(ctx, lab, cx, sy, { font: `700 28px ${BODY}`, color: 'rgba(255,255,255,.8)' });
    text(ctx, String(n), cx, sy + 84, { font: `80px ${DISPLAY}`, color: i === 2 && n ? '#FFD7C9' : '#fff' });
    ctx.font = `80px ${DISPLAY}`; const nw = ctx.measureText(String(n)).width;
    text(ctx, '개', cx + nw + 8, sy + 84, { font: `700 30px ${BODY}`, color: 'rgba(255,255,255,.8)' });
  });
  y = top + headH + stubH + 64;

  // ---- 얘기할 것 ----
  const section = (label, color, soft, n) => {
    ctx.font = `800 30px ${BODY}`; const w = ctx.measureText(label).width + 48;
    ctx.fillStyle = soft; rrect(ctx, PAD, y, w, 56, 28); ctx.fill();
    text(ctx, label, PAD + 24, y + 39, { font: `800 30px ${BODY}`, color });
    text(ctx, `${n}개`, PAD + w + 18, y + 39, { font: `700 30px ${BODY}`, color: C.muted });
    y += 56 + 24;
  };
  const card = (h, bar) => {
    ctx.save(); ctx.shadowColor = 'rgba(27,42,38,.08)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
    ctx.fillStyle = C.paper; rrect(ctx, PAD, y, W - 2 * PAD, h, 32); ctx.fill(); ctx.restore();
    if (bar) { ctx.save(); rrect(ctx, PAD, y, W - 2 * PAD, h, 32); ctx.clip(); ctx.fillStyle = bar; ctx.fillRect(PAD, y, 10, h); ctx.restore(); }
  };
  const cx = PAD + 48, cw = W - 2 * PAD - 96;

  if (d.bad.length) {
    section('얘기할 것', C.coral, C.coralSoft, d.bad.length);
    for (const q of d.bad.slice(0, MAX_BAD)) {
      // 높이 재기
      const m = probeHeight(ctx, q, cw);
      card(m, C.coral);
      let iy = y + 64;
      iy = text(ctx, q.t, cx, iy, { font: `800 38px ${BODY}`, color: C.ink, maxW: cw, lh: 50 });
      if (q.note) { iy += 50; iy = text(ctx, q.note, cx, iy, { font: `700 30px ${BODY}`, color: C.teal, maxW: cw, lh: 42 }); }
      for (const gr of q.groups) {
        iy += 30;
        ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, iy); ctx.lineTo(cx + cw, iy); ctx.stroke();
        iy += 50;
        iy = text(ctx, gr.text, cx, iy, { font: `800 34px ${BODY}`, color: C.ink, maxW: cw, lh: 46 });
        iy += 44;
        iy = text(ctx, gr.names, cx, iy, { font: `600 29px ${BODY}`, color: C.muted, maxW: cw, lh: 40 });
      }
      y += m + 24;
    }
    if (d.bad.length > MAX_BAD) { text(ctx, `외 ${d.bad.length - MAX_BAD}개는 앱에서 볼 수 있어요`, PAD + 8, y + 30, { font: `600 28px ${BODY}`, color: C.muted }); y += 60; }
    y += 32;
  } else {
    card(170, null);
    text(ctx, '다 맞았어요!', W / 2, y + 100, { font: `64px ${DISPLAY}`, color: C.teal, align: 'center' });
    y += 170 + 56;
  }

  // ---- 맞은 것 (모두 같은 답) ----
  if (d.ok.length) {
    section('맞은 것', C.teal, C.tealSoft, d.ok.length);
    const rows = d.ok.slice(0, MAX_OK);
    const colQ = 330;
    const rowH = rows.map(r => {
      ctx.font = `600 30px ${BODY}`; const a = wrap(ctx, r.t, colQ - 24).length;
      ctx.font = `800 31px ${BODY}`; const b = wrap(ctx, r.a, cw - colQ).length;
      return Math.max(a, b) * 42 + 40;
    });
    const h = rowH.reduce((s, v) => s + v, 0) + 32 + (d.ok.length > MAX_OK ? 70 : 0);
    card(h, null);
    let ry = y + 16;
    rows.forEach((r, i) => {
      if (i) { ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, ry); ctx.lineTo(cx + cw, ry); ctx.stroke(); }
      text(ctx, r.t, cx, ry + 52, { font: `600 30px ${BODY}`, color: C.muted, maxW: colQ - 24, lh: 42 });
      text(ctx, r.a, cx + colQ, ry + 52, { font: `800 31px ${BODY}`, color: C.ink, maxW: cw - colQ, lh: 42 });
      ry += rowH[i];
    });
    if (d.ok.length > MAX_OK) text(ctx, `외 ${d.ok.length - MAX_OK}개`, cx, ry + 44, { font: `600 28px ${BODY}`, color: C.muted });
    y += h + 56;
  }

  // ---- 아래 ----
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  y += 56;
  if (logo) ctx.drawImage(logo, PAD, y - 6, 52, 52);
  text(ctx, '쿵짝트립에서 같이 체크했어요', PAD + 68, y + 20, { font: `800 30px ${BODY}`, color: C.ink });
  if (d.url) text(ctx, d.url, PAD + 68, y + 60, { font: `600 26px ${BODY}`, color: C.muted, maxW: W - 2 * PAD - 68 });
  return y + 60 + 72;
}

function probeHeight(ctx, q, cw) {
  const n = (s, font, lh) => { ctx.font = font; return wrap(ctx, s, cw).length * lh; };
  let h = 64 + n(q.t, `800 38px ${BODY}`, 50) - 50;
  if (q.note) h += 50 + n(q.note, `700 30px ${BODY}`, 42) - 42;
  for (const g of q.groups) h += 30 + 50 + n(g.text, `800 34px ${BODY}`, 46) - 46 + 44 + n(g.names, `600 29px ${BODY}`, 40) - 40;
  return h + 48;
}
