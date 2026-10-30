// 用 node:crypto 独立实现 RFC 8291 解密，验证 encrypt() 的输出；并验证 VAPID 签名
import assert from 'node:assert/strict';
import { createECDH, createHmac, createDecipheriv, createPublicKey, verify, generateKeyPairSync } from 'node:crypto';
import { encrypt, vapidAuth, b64u } from '../src/webpush.js';

const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

// 模拟浏览器的订阅密钥
const ua = createECDH('prime256v1');
ua.generateKeys();
const uaPublic = ua.getPublicKey();
const auth = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
const payload = JSON.stringify({ title: '已经 2 天没有记录了', body: '上次是 10月28日 08:26。记得记录一下 💩' });

const body = Buffer.from(await encrypt(payload, uaPublic.toString('base64url'), auth.toString('base64url')));
const salt = body.subarray(0, 16), rs = body.readUInt32BE(16), idlen = body[20];
const asPublic = body.subarray(21, 21 + idlen), cipher = body.subarray(21 + idlen);
assert.equal(rs, 4096);
assert.equal(idlen, 65);

const shared = ua.computeSecret(asPublic);
const ikm = hmac(hmac(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])])).subarray(0, 32);
const prk = hmac(salt, ikm);
const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
const d = createDecipheriv('aes-128-gcm', cek, nonce);
d.setAuthTag(cipher.subarray(-16));
const plain = Buffer.concat([d.update(cipher.subarray(0, -16)), d.final()]);
assert.equal(plain.at(-1), 2, '末尾应为 0x02 分隔符');
assert.equal(plain.subarray(0, -1).toString(), payload);
console.log('✓ 加密：独立解密得到原文');

// VAPID：签名可被公钥验证，aud 为推送服务的源
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pub = publicKey.export({ format: 'jwk' });
const pubRaw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]).toString('base64url');
const header = await vapidAuth('https://web.push.apple.com/abc123', {
  publicKey: pubRaw, privateJwk: privateKey.export({ format: 'jwk' }), subject: 'https://chuyibian.github.io/bianji/',
});
const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
assert.equal(k, pubRaw);
const [h, p, s] = jwt.split('.');
const claims = JSON.parse(Buffer.from(p, 'base64url'));
assert.equal(claims.aud, 'https://web.push.apple.com');
assert.ok(claims.exp > Date.now() / 1000);
assert.ok(verify('sha256', Buffer.from(`${h}.${p}`), { key: createPublicKey({ key: pub, format: 'jwk' }), dsaEncoding: 'ieee-p1363' }, b64u.decode(s)));
console.log('✓ VAPID：签名有效，aud 正确');
