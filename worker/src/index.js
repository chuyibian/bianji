// 便记推送服务：保存每台设备的推送订阅和「最后一次记录的时间」，
// 每 30 分钟检查一次，超过设定天数没记录就推送提醒（当地 9:00–22:00，每次断档只提醒一次）。
import { sendPush } from './webpush.js';

const ALLOWED = ['https://chuyibian.github.io', 'http://localhost:8765'];
const DAY = 864e5;
const pad = n => String(n).padStart(2, '0');

const keyOf = async endpoint => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)))]
  .map(b => b.toString(16).padStart(2, '0')).join('');
const vapidOf = env => ({ publicKey: env.VAPID_PUBLIC, privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK), subject: env.VAPID_SUBJECT });

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin');
    const headers = {
      'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
      'Access-Control-Allow-Methods': 'PUT, DELETE, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    const json = (data, status = 200) => Response.json(data, { status, headers });
    const path = new URL(req.url).pathname;

    // App 用不带 Content-Type 的 POST（浏览器不需要先发预检请求，一次连接完成）；
    // 旧版的 PUT / DELETE 仍然兼容
    const route = `${req.method} ${path}`;
    try {
      const body = JSON.parse(await req.text());
      const endpoint = body.subscription?.endpoint || body.endpoint;
      if (!/^https:\/\//.test(endpoint || '')) return json({ error: 'bad endpoint' }, 400);
      const key = await keyOf(endpoint);

      // 登记或更新：订阅、最后一次记录时间、提醒天数、时区偏移（分钟，与 getTimezoneOffset 相同）
      if (route === 'POST /sub' || route === 'PUT /sub') {
        const sub = body.subscription;
        if (!sub?.keys?.p256dh || !sub?.keys?.auth) return json({ error: 'bad subscription' }, 400);
        const old = await env.SUBS.get(key, 'json');
        const last = Number.isFinite(body.last) ? body.last : null;
        await env.SUBS.put(key, JSON.stringify({
          sub, last,
          days: [1, 2, 3].includes(body.days) ? body.days : 2,
          tz: Number.isFinite(body.tz) ? body.tz : 0,
          notified: old?.last === last ? old.notified : null,
        }));
        return json({ ok: true });
      }
      if (route === 'POST /unsub' || route === 'DELETE /sub') {
        await env.SUBS.delete(key);
        return json({ ok: true });
      }
      if (route === 'POST /test') {
        const rec = await env.SUBS.get(key, 'json');
        if (!rec) return json({ error: 'not subscribed' }, 404);
        const res = await sendPush(rec.sub, { title: '便记', body: '测试通知：推送提醒已经开好了 💩' }, vapidOf(env));
        return json({ ok: res.ok, status: res.status }, res.ok ? 200 : 502);
      }
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: String(e) }, 400);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(remind(env));
  },
};

async function remind(env) {
  const now = Date.now();
  let cursor;
  do {
    const page = await env.SUBS.list({ cursor });
    for (const { name } of page.keys) {
      const rec = await env.SUBS.get(name, 'json');
      if (!rec?.last || rec.notified === rec.last || now - rec.last < rec.days * DAY) continue;
      const local = t => new Date(t - rec.tz * 6e4); // 用 UTC 方法读出的就是用户当地时间
      const hour = local(now).getUTCHours();
      if (hour < 9 || hour >= 22) continue;

      const l = local(rec.last);
      const res = await sendPush(rec.sub, {
        title: `已经 ${Math.floor((now - rec.last) / DAY)} 天没有记录了`,
        body: `上次是 ${l.getUTCMonth() + 1}月${l.getUTCDate()}日 ${pad(l.getUTCHours())}:${pad(l.getUTCMinutes())}。记得记录一下 💩`,
      }, vapidOf(env));
      if (res.status === 404 || res.status === 410) await env.SUBS.delete(name); // 订阅已失效
      else if (res.ok) await env.SUBS.put(name, JSON.stringify({ ...rec, notified: rec.last }));
      else console.log('push failed', res.status, await res.text());
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
}
