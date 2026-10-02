// Images and videos for ads (several per ad, shown as a swipeable strip in the app). Files go on disk, not in the database:
// a video as a data URL would make every ads request megabytes. The admin server saves them into AD_MEDIA_DIR; the app
// server serves the same folder at /media/ads/<file> (EventX-mobile-latest/server/src/app.js). On the VPS both point
// AD_MEDIA_DIR at one shared folder; on this PC the default is the app server's own uploads folder.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AD_MEDIA_DIR = path.resolve(process.env.AD_MEDIA_DIR || path.join(__dirname, '..', '..', 'EventX-mobile-latest', 'server', 'uploads', 'ads'));
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;
const MAX_MEDIA_PER_AD = 10;
// What a stored item looks like in ads.media — only names this module produced are accepted back.
const MEDIA_PATH = /^\/media\/ads\/[a-f0-9]{24}\.(jpg|png|webp|gif|mp4|webm|mov)$/;

// The file's own first bytes decide what it is (never the name or the browser's claim).
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'image', ext: 'jpg' };
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { type: 'image', ext: 'png' };
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return { type: 'image', ext: 'webp' };
  if (buf.slice(0, 4).toString('latin1') === 'GIF8') return { type: 'image', ext: 'gif' };
  if (buf.slice(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.slice(8, 12).toString('latin1');
    return { type: 'video', ext: brand.startsWith('qt') ? 'mov' : 'mp4' };
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { type: 'video', ext: 'webm' };
  return null;
}

// Saves one uploaded file; returns { path, type } or { error }.
function saveUpload(buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) return { error: 'No file received' };
  const kind = sniff(buf);
  if (!kind) return { error: 'Only images (JPG, PNG, WEBP, GIF) and videos (MP4, WEBM, MOV) can be used' };
  if (kind.type === 'image' && buf.length > MAX_IMAGE_BYTES) return { error: 'Images must be under 5 MB' };
  if (kind.type === 'video' && buf.length > MAX_VIDEO_BYTES) return { error: 'Videos must be under 30 MB' };
  fs.mkdirSync(AD_MEDIA_DIR, { recursive: true });
  const name = `${crypto.randomBytes(12).toString('hex')}.${kind.ext}`;
  fs.writeFileSync(path.join(AD_MEDIA_DIR, name), buf);
  return { path: `/media/ads/${name}`, type: kind.type };
}

// The media list an ad is saved with: only items this server stored, the right type for their extension, at most 10.
function cleanMediaList(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const m of list) {
    if (!m || typeof m.path !== 'string' || !MEDIA_PATH.test(m.path)) continue;
    const ext = m.path.split('.').pop();
    const type = ['mp4', 'webm', 'mov'].includes(ext) ? 'video' : 'image';
    if (!fs.existsSync(path.join(AD_MEDIA_DIR, path.basename(m.path)))) continue;
    out.push({ type, path: m.path });
    if (out.length >= MAX_MEDIA_PER_AD) break;
  }
  return out.length ? out : null;
}

// For the admin web's previews (the admin site only proxies /api to this server).
function filePathFor(name) {
  if (!/^[a-f0-9]{24}\.(jpg|png|webp|gif|mp4|webm|mov)$/.test(name)) return null;
  const p = path.join(AD_MEDIA_DIR, name);
  return fs.existsSync(p) ? p : null;
}

module.exports = { AD_MEDIA_DIR, MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MAX_MEDIA_PER_AD, saveUpload, cleanMediaList, filePathFor, sniff };
