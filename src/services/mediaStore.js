// ── src/services/mediaStore.js ─────────────────────────────────────
// WHAT: the ONE place files land — product photos + notice media.
// Cloudinary first (survives redeploys!), local disk fallback (dev).
// WHY: Render's free disk is EPHEMERAL — every redeploy wipes public/uploads
// and customer photos die. Cloudinary's free tier hosts them permanently.
// ENV: CLOUDINARY_CLOUD_NAME + CLOUDINARY_UPLOAD_PRESET (unsigned preset:
// Cloudinary dashboard → Settings → Upload → Upload presets → Add (Signing
// Mode: Unsigned) → copy the name). Unset = local disk (old behavior!).
// RULES (both backends): images jpg/png/webp/gif ≤2.5MB, mp4 ≤10MB,
// magic-byte verified (renamed .exe files die here!), server-built names.
// No npm modules — global fetch/FormData/Blob + fs/path only.

function cloudinaryConfig() {
  const cloud = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const preset = (process.env.CLOUDINARY_UPLOAD_PRESET || '').trim();
  if (!cloud || !preset) return null; // unset → local disk (dev convenience!)
  return { cloud, preset };
}

function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return { error: 'Send an image (jpg, png, webp or gif) or mp4 video.' };
  const img = dataUrl.match(/^data:(image\/(jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/);
  if (img) return { kind: 'image', mime: img[1], b64: img[3] };
  const vid = dataUrl.match(/^data:(video\/mp4);base64,([A-Za-z0-9+/=\s]+)$/);
  if (vid) return { kind: 'video', mime: 'video/mp4', b64: vid[2] };
  return { error: 'Send an image (jpg, png, webp or gif) or mp4 video.' };
}

function checkMagic(kind, mime, buf) {
  if (kind === 'image') {
    const k = mime.split('/')[1]; // jpeg | png | webp | gif
    return (k === 'jpeg' && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
      || (k === 'png' && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
      || (k === 'gif' && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46)
      || (k === 'webp' && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP');
  }
  return buf.toString('ascii', 4, 8) === 'ftyp'; // mp4 magic: "ftyp" at byte 4
}

function extFor(kind, mime) {
  if (kind === 'video') return 'mp4';
  const k = mime.split('/')[1];
  return k === 'jpeg' ? 'jpg' : k; // jpeg → jpg (shorter URLs!)
}

async function uploadCloudinary(cfg, kind, dataUrl, filename) {
  const form = new FormData(); // global (Node 18+ — no `form-data` package!)
  form.append('file', dataUrl); // data-URI upload (Cloudinary accepts data: URIs directly!)
  form.append('upload_preset', cfg.preset);
  form.append('public_id', filename.replace(/\.[^.]+$/, '')); // our name, their extension handling
  const ctrl = new AbortController(); // uploads hanging must never hang the request!
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/${kind}/upload`, {
      method: 'POST', body: form, signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.secure_url) throw new Error((data && data.error && data.error.message) || `Cloudinary ${res.status}`);
    return data.secure_url; // https://res.cloudinary.com/… (permanent, CDN-fast!)
  } finally {
    clearTimeout(t);
  }
}

/**
 * Validate + store one upload. Returns { url }.
 * Throws { status:400 } on bad input, Error (500) on storage failure.
 * allowVideo=false → product photos (images only, old error strings kept!).
 */
async function saveUpload({ dataUrl, prefix, businessId, allowVideo }) {
  const parsed = parseDataUrl(dataUrl);
  if (parsed.error) {
    const msg = allowVideo ? parsed.error : 'Send an image file (jpg, png, webp or gif).';
    throw Object.assign(new Error(msg), { status: 400 });
  }
  if (!allowVideo && parsed.kind !== 'image') throw Object.assign(new Error('Send an image file (jpg, png, webp or gif).'), { status: 400 });
  let buf;
  try {
    buf = Buffer.from(parsed.b64.replace(/\s/g, ''), 'base64'); // \s strip: some pickers wrap lines!
  } catch {
    throw Object.assign(new Error('Could not read that file.'), { status: 400 });
  }
  const cap = parsed.kind === 'image' ? 2.5 * 1024 * 1024 : 10 * 1024 * 1024; // photos 2.5MB, video 10MB
  if (buf.length === 0 || buf.length > cap) {
    throw Object.assign(new Error(parsed.kind === 'image' ? 'Image too large — max 2.5MB.' : 'Video too large — max 10MB.'), { status: 400 });
  }
  if (!checkMagic(parsed.kind, parsed.mime, buf)) {
    throw Object.assign(new Error(parsed.kind === 'image' ? 'That file is not a real image.' : 'That file is not a real mp4.'), { status: 400 });
  }
  const safe = `${prefix}${Number(businessId) || 0}-${Date.now()}.${extFor(parsed.kind, parsed.mime)}`; // server-built name (user filenames NEVER touch storage!)
  const cfg = cloudinaryConfig();
  if (cfg) { // cloud first (permanent!)
    try {
      return { url: await uploadCloudinary(cfg, parsed.kind, dataUrl, safe), stored: 'cloudinary' };
    } catch (e) {
      console.error('cloudinary upload error:', e.message);
      throw new Error('Could not save that file — try again.');
    }
  }
  const fs = require('fs'); // local fallback (dev / pre-Cloudinary deploys!)
  const path = require('path');
  const dir = path.join(__dirname, '..', '..', 'public', 'uploads'); // served by express.static (server.js!)
  fs.mkdirSync(dir, { recursive: true }); // creates public/uploads on first use
  try {
    fs.writeFileSync(path.join(dir, safe), buf); // sync: small files, request-scoped
  } catch (e) {
    console.error('local media write error:', e.message);
    throw new Error('Could not save that file — try again.');
  }
  return { localFile: safe, stored: 'local' }; // caller builds the absolute URL (needs req host!)
}

module.exports = { cloudinaryConfig, saveUpload };
