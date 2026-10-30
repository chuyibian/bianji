'use strict';

const VERSION = 'v11'; // 发布时与 sw.js 里的 CACHE 一起加一
const KEY = 'bianji.records.v1';
const BRISTOL = [null,
  ['分离硬块', '便秘'], ['结块香肠状', '轻度便秘'], ['表面有裂纹', '正常'], ['光滑柔软', '理想'],
  ['软团块', '正常偏软'], ['糊状', '轻度腹泻'], ['水样', '腹泻'],
];
const FEELING = { smooth: '顺畅', strain: '费力', pain: '疼痛' };
const FEEL_COLOR = { smooth: 'var(--teal)', strain: 'var(--sand)', pain: 'var(--red)' };
const GROUPS = [
  { name: '偏干', range: '1–2 型', types: [1, 2], color: 'var(--sand)', tip: '偏干时可多喝水、多吃蔬果和全谷物，并保持活动。' },
  { name: '正常', range: '3–5 型', types: [3, 4, 5], color: 'var(--teal)' },
  { name: '偏稀', range: '6–7 型', types: [6, 7], color: 'var(--slate)', tip: '偏稀时注意饮食卫生、及时补水；持续数日请就医。' },
];
const groupOf = b => GROUPS.find(g => g.types.includes(b));
const GLYPH = [null,
  '<circle cx="9" cy="13" r="4.5"/><circle cx="20" cy="9.5" r="4"/><circle cx="30" cy="14" r="4.5"/><circle cx="39" cy="10" r="3"/>',
  '<circle cx="9" cy="12" r="5.5"/><circle cx="17" cy="11" r="5.5"/><circle cx="25" cy="13" r="5.5"/><circle cx="33" cy="12" r="5.5"/>',
  '<rect x="3" y="7" width="38" height="10" rx="5"/><path class="crack" d="M12 7v3.5M20 17v-3.5M27 7v4M34 17v-3.5" stroke-width="1.6"/>',
  '<path d="M6 15c6-7 12 2 17-3s10-5 15-1" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
  '<ellipse cx="9" cy="13" rx="6.5" ry="4.5"/><ellipse cx="22" cy="11" rx="6" ry="4.5"/><ellipse cx="35" cy="13" rx="6.5" ry="4.5"/>',
  '<path d="M4 16c0-4 4-6 7-4 1-4 7-5 9-1 2-3 8-3 9 1 3-2 8 0 8 4 0 3-3 4-6 3-2 2-6 2-8 0-3 2-7 2-9 0-4 1-10 1-10-3z"/>',
  '<path d="M4 12c3 0 3-2.5 6-2.5s3 2.5 6 2.5 3-2.5 6-2.5 3 2.5 6 2.5 3-2.5 6-2.5 3 2.5 6 2.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><ellipse cx="22" cy="18" rx="18" ry="3.5" opacity=".4"/>',
];
const CHEV = '<svg class="chev" viewBox="0 0 8 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m1.5 1.5 5 5-5 5"/></svg>';

/* ---------- 存储 ---------- */

let records = load();
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function save() {
  records.sort((a, b) => a.ts - b.ts);
  localStorage.setItem(KEY, JSON.stringify(records));
  syncPush().catch(err => syncLater(err)); // 最后一次记录的时间变了，告诉推送服务器
}
function upsert(rec) {
  const i = records.findIndex(r => r.id === rec.id);
  if (i < 0) records.push(rec); else records[i] = rec;
  save();
}
function remove(id) {
  records = records.filter(r => r.id !== id);
  save();
}
const uid = () => Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);

/* ---------- 工具 ---------- */

const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const hm = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const startOfDay = t => new Date(t).setHours(0, 0, 0, 0);
const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
const WEEK = '日一二三四五六';
const md = t => { const d = new Date(t); return `${d.getMonth() + 1}月${d.getDate()}日`; };
const ym = t => { const d = new Date(t); return `${d.getFullYear()}年${d.getMonth() + 1}月`; };
const pct = (n, total) => (total ? Math.round(n / total * 100) : 0) + '%';

// 今天 14:48 / 昨天 08:10 / 10月21日 09:30
function when(t) {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(t)) / 864e5);
  return (diff === 0 ? '今天' : diff === 1 ? '昨天' : md(t)) + ' ' + hm(t);
}
// 时长 → N天N小时；不足一天只计小时
function since(ms) {
  const h = Math.floor(ms / 36e5), d = Math.floor(h / 24);
  return d ? [[d, '天'], [h % 24, '小时']] : [[h, '小时']];
}
const metric = parts => parts.map(([v, u]) => `${v}<small>${u}</small>`).join('');
const plain = parts => parts.map(([v, u]) => v + u).join('');
const chartHead = (label, value, sub) =>
  `<div class="chart-label">${label}</div><div class="metric">${value ?? '<span class="empty">暂无数据</span>'}</div><div class="chart-sub">${sub}</div>`;

/* ---------- 路由 ---------- */

const VIEWS = { '': 'home', calendar: 'calendar', data: 'data' };
let view = 'home';
function route() {
  view = VIEWS[location.hash.replace(/^#\/?/, '')] || 'home';
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== view; });
  render();
  scrollTo(0, 0);
}
function render() {
  ({ home: renderHome, calendar: renderCalendar, data: renderData })[view]();
}
addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
setInterval(() => { if (view === 'home' && !document.hidden) renderHome(); }, 30e3);

/* ---------- 首页 ---------- */

function renderHome() {
  const now = new Date(), last = records.at(-1);
  $('#sinceValue').innerHTML = last ? metric(since(now - last.ts)) : '<span class="empty">暂无记录</span>';
  $('#lastAt').textContent = last ? when(last.ts) : '';
}

// 只打开面板；点「完成」才保存，取消或点遮罩不会留下空记录
$('#record').onclick = () => openSheet('new', { id: uid(), ts: Date.now(), bristol: null, feeling: null });

function celebrate() {
  navigator.vibrate?.(10);
  navigator.storage?.persist?.();
  const btn = $('#record');
  btn.classList.add('done');
  $('#recordLabel').textContent = '已记录';
  setTimeout(() => { btn.classList.remove('done'); $('#recordLabel').textContent = '记录'; }, 1200);
}

/* ---------- 详情面板 ---------- */

let draft, mode;
function openSheet(m, rec) {
  mode = m;
  draft = { ...rec };
  $('#sheetTitle').textContent = { new: '新记录', edit: '编辑记录', add: '补录' }[m];
  $('#sheetLeft').textContent = m === 'edit' ? '删除' : '取消';
  $('#sheetLeft').classList.toggle('danger', m === 'edit');
  $('#doneBtn').textContent = m === 'add' ? '添加' : '完成';
  $('#timeInput').value = hm(draft.ts);
  paintPicks();
  $('#sheet').hidden = false;
}
function paintPicks() {
  $('#bristolPick').innerHTML = BRISTOL.slice(1).map(([name], i) =>
    `<button type="button" data-b="${i + 1}" aria-pressed="${draft.bristol === i + 1}">
      <svg viewBox="0 0 44 24" fill="currentColor">${GLYPH[i + 1]}</svg><b>${i + 1}型</b><span>${name}</span></button>`).join('');
  $('#feelingPick').innerHTML = Object.entries(FEELING).map(([k, v]) =>
    `<button type="button" data-f="${k}" aria-pressed="${draft.feeling === k}"><i style="background:${FEEL_COLOR[k]}"></i><b>${v}</b></button>`).join('');
}
// 再点一次已选项 = 取消选择
$('#bristolPick').onclick = e => {
  const b = e.target.closest('[data-b]');
  if (!b) return;
  draft.bristol = draft.bristol === +b.dataset.b ? null : +b.dataset.b;
  paintPicks();
};
$('#feelingPick').onclick = e => {
  const b = e.target.closest('[data-f]');
  if (!b) return;
  draft.feeling = draft.feeling === b.dataset.f ? null : b.dataset.f;
  paintPicks();
};
function closeSheet(commit) {
  if (commit) {
    const [h, m] = $('#timeInput').value.split(':').map(Number);
    if (!isNaN(h)) draft.ts = new Date(draft.ts).setHours(h, m, 0, 0);
    if (draft.ts > Date.now()) return alert('时间不能晚于现在');
    upsert(draft);
    if (mode === 'new') celebrate();
  }
  $('#sheet').hidden = true;
  render();
}
$('#sheetForm').onsubmit = e => { e.preventDefault(); closeSheet(true); };
// 点遮罩 = 取消，不保存任何改动
$('.backdrop').onclick = () => closeSheet(false);
$('#sheetLeft').onclick = () => {
  if (mode !== 'edit') return closeSheet(false);
  if (!confirm('删除这条记录？')) return;
  remove(draft.id);
  closeSheet(false);
};

/* ---------- 日历 ---------- */

let calMonth = new Date(new Date().setDate(1)).setHours(0, 0, 0, 0);
let selDay = startOfDay(Date.now());

function renderCalendar() {
  const m = new Date(calMonth), y = m.getFullYear(), mo = m.getMonth();
  const today = startOfDay(Date.now());
  const counts = {};
  for (const r of records) { const k = startOfDay(r.ts); counts[k] = (counts[k] || 0) + 1; }

  const days = new Date(y, mo + 1, 0).getDate();
  let html = '<span></span>'.repeat((m.getDay() + 6) % 7), monthTotal = 0;
  for (let d = 1; d <= days; d++) {
    const t = new Date(y, mo, d).getTime(), n = counts[t] || 0;
    monthTotal += n;
    const cls = [t === today && 'today', t > today && 'future', t === selDay && 'sel'].filter(Boolean).join(' ');
    html += `<button data-t="${t}" class="${cls}" aria-label="${mo + 1}月${d}日 ${n}次"><span class="num">${d}</span><span class="dots">${'<i></i>'.repeat(Math.min(n, 3))}</span></button>`;
  }
  $('#grid').innerHTML = html;
  $('#monthLabel').textContent = ym(calMonth);
  $('#monthCount').textContent = `本月共 ${monthTotal} 次`;

  const sd = new Date(selDay), list = records.filter(r => startOfDay(r.ts) === selDay);
  $('#dayLabel').textContent = `${md(selDay)} 星期${WEEK[sd.getDay()]} · ${list.length} 次`;
  $('#dayList').innerHTML = list.length
    ? list.map((r, i) => {
        const g = groupOf(r.bristol);
        const sub = [r.bristol && `${r.bristol}型`, FEELING[r.feeling]].filter(Boolean).join(' · ') || '未填写详情';
        return `<li class="swipe"><button class="swipe-del" data-del="${r.id}">删除</button>
          <button class="row rec" data-id="${r.id}">
          <span class="badge" style="background:${g ? g.color : 'var(--gray)'}">${r.bristol || '–'}</span>
          <span class="rec-main"><span>Happy poop💩${i ? ' again' : ''}</span><small>${sub}</small></span>
          <span class="rec-time">${hm(r.ts)}</span>${CHEV}</button></li>`;
      }).join('')
    : '<li><div class="row empty-row">无记录</div></li>';
  $('#addBtn').disabled = selDay > today;
}
$('#grid').onclick = e => {
  const b = e.target.closest('[data-t]');
  if (b) { selDay = +b.dataset.t; renderCalendar(); }
};
const shiftMonth = n => { const m = new Date(calMonth); calMonth = new Date(m.getFullYear(), m.getMonth() + n, 1).getTime(); renderCalendar(); };
$('#prevMonth').onclick = () => shiftMonth(-1);
$('#nextMonth').onclick = () => shiftMonth(1);
// 左右滑动切换月份
let touchX = null;
$('#grid').addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
$('#grid').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) shiftMonth(dx < 0 ? 1 : -1);
}, { passive: true });
$('#todayBtn').onclick = () => {
  calMonth = new Date(new Date().setDate(1)).setHours(0, 0, 0, 0);
  selDay = startOfDay(Date.now());
  renderCalendar();
};
// 左滑记录露出尾部的「删除」按钮（同一时间只展开一条）
const SWIPE_OPEN = -84;
let swipe = null;
const setX = (row, x) => { row.style.transform = x ? `translateX(${x}px)` : ''; };
const closeSwipes = except => document.querySelectorAll('.rec.open').forEach(r => {
  if (r !== except) { r.classList.remove('open'); setX(r, 0); }
});
$('#dayList').addEventListener('pointerdown', e => {
  const row = e.target.closest('.rec');
  if (row) swipe = { row, x0: e.clientX, base: row.classList.contains('open') ? SWIPE_OPEN : 0, moved: false };
});
$('#dayList').addEventListener('pointermove', e => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x0;
  if (!swipe.moved && Math.abs(dx) < 8) return;
  swipe.moved = true;
  swipe.row.classList.add('dragging');
  setX(swipe.row, Math.min(0, Math.max(SWIPE_OPEN * 1.3, swipe.base + dx)));
});
const endSwipe = e => {
  if (!swipe) return;
  const { row, x0, base, moved } = swipe;
  swipe = null;
  row.classList.remove('dragging');
  if (!moved) return;
  const open = e.type === 'pointerup' ? base + e.clientX - x0 < SWIPE_OPEN / 2 : base !== 0;
  row.classList.toggle('open', open);
  setX(row, open ? SWIPE_OPEN : 0);
  if (open) closeSwipes(row);
  row.dataset.swiped = Date.now(); // 吞掉松手后紧跟的那次点击
};
$('#dayList').addEventListener('pointerup', endSwipe);
$('#dayList').addEventListener('pointercancel', endSwipe);

$('#dayList').onclick = e => {
  const del = e.target.closest('[data-del]');
  if (del) { remove(del.dataset.del); return renderCalendar(); }
  const row = e.target.closest('.rec');
  if (!row) return;
  if (Date.now() - (row.dataset.swiped || 0) < 400) return;
  if (document.querySelector('.rec.open')) return closeSwipes(); // 有展开的行时，点一下先收起
  openSheet('edit', records.find(r => r.id === row.dataset.id));
};
$('#addBtn').onclick = () => {
  const ts = selDay === startOfDay(Date.now()) ? Date.now() : new Date(selDay).setHours(12);
  openSheet('add', { id: uid(), ts, bristol: null, feeling: null });
};

/* ---------- 数据 ---------- */

let range = '7', pick = null; // pick：趋势图里点选的柱子
$('#range').onclick = e => {
  const b = e.target.closest('[data-r]');
  if (b) { range = b.dataset.r; pick = null; renderData(); }
};
$('#trend').onclick = e => {
  const c = e.target.closest('[data-i]');
  if (c) { pick = pick === +c.dataset.i ? null : +c.dataset.i; renderData(); }
};

const niceMax = m => (m <= 2 ? 2 : m <= 4 ? 4 : Math.ceil(m / 2) * 2);
function barChart(items, sel) {
  const top = niceMax(Math.max(...items.map(x => x.n)));
  const cols = items.map((x, i) =>
    `<div class="col${sel != null && sel !== i ? ' dim' : ''}" data-i="${i}"><i style="height:${x.n / top * 100}%"></i></div>`).join('');
  return `<div class="chart"><div class="plot-wrap">
      <div class="grid-lines"><span data-v="${top}"></span><span data-v="${top / 2}"></span><span data-v="0"></span></div>
      <div class="plot">${cols}</div></div>
    <div class="xlabels">${items.map(x => `<span>${x.label}</span>`).join('')}</div></div>`;
}
function stack(items, total) {
  return `<div class="stack">${items.map(x => (x.n ? `<i style="flex:${x.n};background:${x.color}"></i>` : '')).join('')}</div>
    <div class="legend">${items.map(x => `<span><b style="background:${x.color}"></b>${x.label}<em>${pct(x.n, total)}</em></span>`).join('')}</div>`;
}

function renderData() {
  renderPush();
  document.querySelectorAll('#range [data-r]').forEach(b => b.setAttribute('aria-pressed', b.dataset.r === range));
  const now = Date.now(), today = startOfDay(now);

  // 分桶：天或月
  let start, buckets;
  if (range === '12m') {
    const d = new Date(today);
    start = new Date(d.getFullYear(), d.getMonth() - 11, 1).getTime();
    buckets = Array.from({ length: 12 }, (_, i) => {
      const t = new Date(d.getFullYear(), d.getMonth() - 11 + i, 1).getTime();
      return { t, label: new Date(t).getMonth() + 1, full: ym(t), n: 0 };
    });
  } else {
    const len = +range;
    start = addDays(today, 1 - len);
    buckets = Array.from({ length: len }, (_, i) => {
      const t = addDays(start, i), d = new Date(t);
      return { t, label: len === 7 ? WEEK[d.getDay()] : (len - 1 - i) % 7 ? '' : d.getDate(), full: `${md(t)} 星期${WEEK[d.getDay()]}`, n: 0 };
    });
  }
  const inRange = records.filter(r => r.ts >= start && r.ts <= now);
  for (const r of inRange) {
    let i = buckets.length - 1;
    while (buckets[i].t > r.ts) i--;
    buckets[i].n++;
  }

  // 趋势
  const total = inRange.length;
  const effStart = records.length ? Math.max(start, startOfDay(records[0].ts)) : today;
  const days = Math.round((today - effStart) / 864e5) + 1;
  const rangeText = range === '12m' ? `${ym(start)} – ${ym(today)}` : `${md(start)} – ${md(today)}`;
  $('#trendHead').innerHTML = pick != null
    ? chartHead(range === '12m' ? '当月合计' : '当日合计', metric([[buckets[pick].n, '次']]), buckets[pick].full)
    : chartHead('日均', total ? metric([[(total / days).toFixed(1), '次']]) : null, rangeText);
  $('#trend').innerHTML = barChart(buckets, pick);

  // 概览
  let gap = 0;
  for (let i = 1; i < inRange.length; i++) gap = Math.max(gap, inRange[i].ts - inRange[i - 1].ts);
  const activeDays = new Set(inRange.map(r => startOfDay(r.ts))).size;
  const last = records.at(-1);
  const row = (k, v) => `<li><div class="row"><span>${k}</span><span class="value">${v}</span></div></li>`;
  $('#summary').innerHTML =
    row('总次数', `${total}次`) +
    row('有记录的天数', `${activeDays}/${days}天`) +
    row('距上一次', last ? plain(since(now - last.ts)) : '—') +
    row('最长间隔', gap ? plain(since(gap)) : '—');

  // 时段
  const hours = Array.from({ length: 24 }, (_, h) => ({ label: h % 6 ? '' : h, n: 0 }));
  for (const r of inRange) hours[new Date(r.ts).getHours()].n++;
  const peak = hours.reduce((p, x, h) => (x.n > hours[p].n ? h : p), 0);
  $('#hoursHead').innerHTML = chartHead('最常见时段', total ? `${peak}:00 – ${peak + 1}:00` : null, `基于 ${total} 次记录`);
  $('#hours').innerHTML = barChart(hours, total ? peak : null);

  // 形状
  const withB = inRange.filter(r => r.bristol);
  const groups = GROUPS.map(g => ({ ...g, label: g.name, n: withB.filter(r => g.types.includes(r.bristol)).length }));
  const main = groups.reduce((a, b) => (b.n > a.n ? b : a));
  $('#shapeHead').innerHTML = chartHead('形状',
    withB.length ? `<span style="color:${main.color}">${main.name}</span>` : null,
    withB.length ? `以 ${main.range}为主 · ${withB.length} 条有形状的记录` : '在记录详情里选择形状后显示');
  const typeRows = BRISTOL.slice(1).map(([name], i) => {
    const n = withB.filter(r => r.bristol === i + 1).length;
    return `<li class="${n ? '' : 'muted'}"><span class="badge sm" style="background:${groupOf(i + 1).color}">${i + 1}</span><span>${name}</span>
      <span class="value">${n}<small>${pct(n, withB.length)}</small></span></li>`;
  }).join('');
  $('#shapeBody').innerHTML = stack(groups, withB.length) + `<ul class="mini">${typeRows}</ul>` +
    (withB.length && main.tip ? `<p class="card-note">${main.tip}</p>` : '');

  // 体感
  const withF = inRange.filter(r => r.feeling);
  const feels = Object.entries(FEELING).map(([k, v]) => ({ label: v, color: FEEL_COLOR[k], n: withF.filter(r => r.feeling === k).length }));
  const topF = feels.reduce((a, b) => (b.n > a.n ? b : a));
  $('#feelHead').innerHTML = chartHead('体感',
    withF.length ? `<span style="color:${topF.color}">${topF.label}</span><small>${pct(topF.n, withF.length)}</small>` : null,
    withF.length ? `${withF.length} 条有体感的记录` : '在记录详情里选择体感后显示');
  $('#feelBody').innerHTML = stack(feels, withF.length);
}

/* ---------- 备份 ---------- */

$('#exportBtn').onclick = async () => {
  const d = new Date();
  const name = `bianji-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
  const file = new File([JSON.stringify({ app: 'bianji', version: 1, exportedAt: d.toISOString(), records })], name, { type: 'application/json' });
  // 手机上优先用系统分享（iOS 可“存储到文件”），否则直接下载
  if (navigator.maxTouchPoints && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch {}
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('#importBtn').onclick = () => $('#importFile').click();
$('#importFile').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const list = (Array.isArray(data) ? data : data.records).filter(r => r && typeof r.id === 'string' && Number.isFinite(r.ts));
    const have = new Set(records.map(r => r.id));
    const fresh = list.filter(r => !have.has(r.id)).map(r => ({
      id: r.id, ts: r.ts,
      bristol: Number.isInteger(r.bristol) && r.bristol >= 1 && r.bristol <= 7 ? r.bristol : null,
      feeling: Object.hasOwn(FEELING, r.feeling) ? r.feeling : null,
    }));
    records.push(...fresh);
    save();
    render();
    alert(`导入完成：新增 ${fresh.length} 条，跳过重复 ${list.length - fresh.length} 条。`);
  } catch {
    alert('无法读取这个文件，请选择便记导出的备份文件。');
  }
};

/* ---------- 推送提醒 ---------- */

// 服务器只保存：推送订阅、最后一次记录的时间、提醒天数、时区。形状和体感不会上传。
const PUSH_API = 'https://bianji-push.bianji-push.workers.dev';
const VAPID_PUBLIC = 'BMU36_1cGY70V4RTbHTf6vFnj3y-MNRiKABt9iLCHbtt_ijSIWwatiPnHx_GkKNqzvx6zAuX__xXzpS5dj58nRo';
const PUSH_KEY = 'bianji.push';
let push = (() => { try { return JSON.parse(localStorage.getItem(PUSH_KEY)) || {}; } catch { return {}; } })();
const savePush = () => localStorage.setItem(PUSH_KEY, JSON.stringify(push));

// 每一步都有超时，卡住时能看到停在哪一步，而不是一直没反应
const timeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
const setPushStatus = (text, bad = false) => { const el = $('#pushStatus'); el.textContent = text; el.classList.toggle('bad', bad); };

// 不设 Content-Type 的 POST 属于“简单请求”，浏览器不发预检，一次连接完成；网络抖动时自动再试一次
async function pushApi(path, body) {
  let res;
  for (let i = 0; !res; i++) {
    try {
      res = await timeout(fetch(PUSH_API + path, { method: 'POST', body: JSON.stringify(body) }), 12e3, '连接提醒服务器超时（12 秒）');
    } catch (err) {
      if (i) throw new Error(err.message.includes('超时') ? err.message : `连不上提醒服务器（${err.message}）`);
    }
  }
  if (!res.ok) throw new Error(`提醒服务器返回 ${res.status}`);
  return res.json();
}
const syncLater = err => setPushStatus(`已开启，但还没和提醒服务器同步：${err.message}。每次打开 app 都会自动重试`, true);
const getSub = async () => (await timeout(navigator.serviceWorker.ready, 5e3, '后台服务未就绪，请重新打开 app')).pushManager.getSubscription();

// 把订阅和最后一次记录时间同步到服务器；内容没变就不发（离线失败的话下次打开再同步）
async function syncPush(force = false) {
  if (!push.on) return;
  const sub = await getSub();
  if (!sub) { push = { days: push.days }; savePush(); return renderPush(); } // 通知权限被关掉了
  const body = { subscription: sub.toJSON(), last: records.at(-1)?.ts ?? null, days: push.days || 2, tz: new Date().getTimezoneOffset() };
  const sig = JSON.stringify(body);
  if (!force && sig === push.synced) return;
  await pushApi('/sub', body);
  push.synced = sig;
  savePush();
  setPushStatus(`已开启 · ${when(Date.now())} 与提醒服务器同步`);
}

function renderPush() {
  $('#pushToggle').checked = !!push.on;
  $('#pushDaysRow').hidden = $('#pushTestRow').hidden = !push.on;
  document.querySelectorAll('#pushDays [data-d]').forEach(b => b.setAttribute('aria-pressed', +b.dataset.d === (push.days || 2)));
}

$('#pushToggle').onchange = async e => {
  const toggle = e.target;
  toggle.disabled = true;
  try {
    if (toggle.checked) {
      if (!('Notification' in window && 'PushManager' in window)) throw new Error('请先把便记添加到主屏幕，再从主屏幕图标打开后开启。');
      setPushStatus('① 正在请求通知权限…');
      if (await Notification.requestPermission() !== 'granted') throw new Error('没有获得通知权限。可以在 iPhone 的 设置 → 通知 → 便记 里打开。');
      setPushStatus('② 正在向 Apple 注册推送…');
      const reg = await timeout(navigator.serviceWorker.ready, 5e3, '后台服务未就绪，请重新打开 app');
      const b64 = VAPID_PUBLIC.replace(/-/g, '+').replace(/_/g, '/');
      await timeout(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(atob(b64), c => c.charCodeAt(0)) }),
        15e3, '向 Apple 注册推送超时（15 秒）');
      // 已经向 Apple 注册成功：开关保持打开；服务器这次连不上也没关系，之后会自动重试
      push = { on: true, days: push.days || 2 };
      savePush();
      setPushStatus('③ 正在连接提醒服务器…');
      await syncPush(true).catch(syncLater);
    } else {
      const sub = await getSub();
      if (sub) {
        pushApi('/unsub', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      push = { days: push.days };
      setPushStatus('');
    }
  } catch (err) {
    push = { days: push.days };
    setPushStatus(`开启失败：${err.message}`, true);
    alert(`开启失败：${err.message}`);
  }
  savePush();
  toggle.disabled = false;
  renderPush();
};
$('#pushDays').onclick = e => {
  const b = e.target.closest('[data-d]');
  if (!b) return;
  push.days = +b.dataset.d;
  savePush();
  renderPush();
  syncPush().catch(syncLater);
};
$('#pushTest').onclick = async () => {
  const btn = $('#pushTest');
  btn.disabled = true;
  try {
    setPushStatus('正在发送测试通知…');
    await syncPush(true);
    await pushApi('/test', { endpoint: (await getSub()).endpoint });
    btn.textContent = '已发送，请留意通知';
    setPushStatus(`测试通知已由服务器发出（${when(Date.now())}）`);
  } catch (err) {
    setPushStatus(`发送失败：${err.message}`, true);
    alert(`发送失败：${err.message}`);
  }
  setTimeout(() => { btn.textContent = '发送测试通知'; btn.disabled = false; }, 3000);
};

/* ---------- 启动 ---------- */

route();
if (push.on) setPushStatus(push.synced ? '已开启 · 已与提醒服务器同步' : '已开启 · 正在同步…');
syncPush().catch(syncLater);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncPush().catch(syncLater); });
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg => {
    // 主屏幕 app 切回前台时并不会重新加载页面，所以每次回到前台都检查一次新版本
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update(); });
  });
  // 新版本接管后自动刷新一次；正在填写记录时不打断
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && $('#sheet').hidden) location.reload();
  });
}
$('#version').textContent = `版本 ${VERSION}`;
