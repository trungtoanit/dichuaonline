import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import path from 'node:path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { loadSettings, saveSettings, sanitize, MACHINES } from './settings.js';
import { CommentFilter } from './filter.js';
import { DisplayQueue } from './display-queue.js';
import { TikTokSource, cleanUsername } from './tiktok.js';
import { startDemo } from './demo.js';
import { QueGame, GIFT_POINTS_PER_COIN } from './que.js';
import { Ranks, POINTS, RANKS } from './ranks.js';
import { detectPromotion, detectNegative, detectTired, detectJobRequest, detectTimesheet, detectLoveBoss, detectChairman, detectMachineRequest, detectNoPay, detectCV, detectRaise, detectFlirt, detectHateBoss, detectGuardWord, detectDrinking, detectBloodsucker, detectStrike, detectPraiseBoss, detectJoin, detectDiligent, detectBossWife, detectEffort, detectResign, detectLazy, detectMaternity, detectAdvance, detectPayCut, detectQuit, detectIuBoss, detectGreetBoss, detectSwitchMachine, detectCurse, detectPayDemand, detectLessHours } from './promote.js';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.resolve('public');
const FEED_SIZE = 200;

let settings = loadSettings();
const filter = new CommentFilter();
const queue = new DisplayQueue(() => settings);
const tiktok = new TikTokSource();
const stats = { received: 0, accepted: 0, filtered: 0 };
const feed = []; // bình luận gần nhất cho dashboard (kể cả bị lọc)
const MEMBERS_SIZE = 300;
const members = new Map(); // username -> người đã vào phiên LIVE (mới nhất ở cuối)
let viewers = 0;
let online = []; // username người xem TikTok báo đang ở trong phòng
const ranks = new Ranks();
// Lương (triệu/tháng) sếp Toán tăng cho người xem — trò chơi trên LIVE, lưu để giữ qua các buổi
const SALARY_FILE = path.resolve('data', 'salaries.json');
let salaries = {};
try { salaries = JSON.parse(fs.readFileSync(SALARY_FILE, 'utf8')); } catch {}
const SALARY_LAZY = 4.6; // giảm lương vì làm biếng
const SALARY_MAX = 500;  // lương cao nhất (triệu/tháng)
const RAISE_STREAK_MAX = 2;          // tối đa 2 lần tăng lương liên tiếp
const RAISE_STREAK_MS = 10 * 60 * 1000;
let raiseStreak = null;              // lượt tăng lương gần nhất: { name, n, at } — người khác được tăng thì tính lại
// Tự động thì không được thăng chức 2 lần liên tiếp (trong 10 phút, chưa bị hạ chức)
const lastPromote = new Map();       // username -> thời điểm thăng chức tự động gần nhất
const SALARY_START = 12; // mốc khởi điểm khi chưa có lương, lần tăng đầu = 12 + 3..6
// Vị trí đặc biệt sếp điều chuyển: bảo vệ / lao công
const JOBS_FILE = path.resolve('data', 'jobs.json');
const JOBS = { 'bao-ve': 'Bảo vệ', 'lao-cong': 'Lao công', 'thu-ky': 'Thư ký', 'ke-toan': 'Kế toán', 'doi-no': 'Đòi nợ' };
let jobs = {};
try { jobs = JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8')); } catch {}
// Máy mà nhân viên xin làm (username -> mã máy)
const MACHINE_FILE = path.resolve('data', 'machines.json');
// Danh sách quà nhận được (giữ 3000 quà gần nhất) — dashboard tính tổng xu và ước tính tiền
const GIFT_FILE = path.resolve('data', 'gifts.json');
let giftLog = [];
try { giftLog = JSON.parse(fs.readFileSync(GIFT_FILE, 'utf8')); } catch {}
// channel: kênh chính đang nhận quà
function logGift(a, channel) {
  const entry = { at: Date.now(), channel, username: a.username, nickname: a.nickname, gift: a.gift ?? 'Quà', count: a.count, coins: Number(a.coins) || 0 };
  giftLog.push(entry);
  if (giftLog.length > 3000) giftLog = giftLog.slice(-3000);
  fs.mkdirSync(path.dirname(GIFT_FILE), { recursive: true });
  fs.writeFileSync(GIFT_FILE, JSON.stringify(giftLog));
  broadcast({ type: 'gift', entry });
}
let machineWish = {};
try { machineWish = JSON.parse(fs.readFileSync(MACHINE_FILE, 'utf8')); } catch {}
const demoRanks = new Ranks(null); // người giả lập không vào bảng xếp hạng thật
let stopDemo = null;
// Bản đồ quê: người giả lập chơi trên bản đồ riêng, không ghi vào điểm thật
const que = new QueGame(path.resolve('data', 'que.json'));
const demoQue = new QueGame(null);

// ---------- HTTP ----------
const app = express();

// Truy cập qua đường hầm công khai (Cloudflare Tunnel…) chỉ được XEM overlay:
// không mở dashboard, không điều khiển qua WebSocket, không tải file lên.
const isRemote = (req) => Boolean(req.headers['cf-ray'] || req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']);
const PUBLIC_PATHS = /^\/(overlay(\/(chua|nha-may|que))?|nhac|ws-client\.js|music-player\.js|provinces\.js|vn-map\.js|tts|staff\/[a-z0-9]+\.jpg|logo-tuan-tu\.png|ong-chu-toan\.jpg|logos\/[a-z0-9-]+\.(png|jpg|webp|svg)|music\/[^/]+\.mp3)$/;
app.use((req, res, next) => {
  if (!isRemote(req) || (req.method === 'GET' && PUBLIC_PATHS.test(req.path))) return next();
  res.status(403).send('Chỉ xem overlay');
});

app.get('/', (_req, res) => res.redirect('/dashboard'));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(PUBLIC, 'dashboard.html')));
app.get('/overlay', (_req, res) => res.sendFile(path.join(PUBLIC, 'overlay.html')));
app.get('/overlay/chua', (_req, res) => res.sendFile(path.join(PUBLIC, 'overlay-chua.html')));
app.get('/overlay/nha-may', (_req, res) => res.sendFile(path.join(PUBLIC, 'overlay-nha-may.html')));
app.get('/overlay/que', (_req, res) => res.sendFile(path.join(PUBLIC, 'overlay-que.html')));
// Giọng đọc tiếng Việt cho overlay: chỉ dùng một giọng AI của Microsoft (vi-VN-HoaiMyNeural, cần mạng).
// Không tạo được thì bỏ câu đó (không đổi sang giọng khác). File âm thanh lưu đệm theo nội dung câu.
const TTS_DIR = path.resolve('data', 'tts');
const TTS_KEEP = 300;
const TTS_VOICE = 'vi-VN-HoaiMyNeural';
const ttsJobs = new Map(); // tên file -> Promise<đường dẫn file | null>
function edgeSpeak(text, file) {
  return new Promise((resolve) => {
    const tts = new MsEdgeTTS();
    const chunks = [];
    let finished = false;
    const finish = (ok) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { tts.close(); } catch {}
      const buf = Buffer.concat(chunks);
      if (ok && buf.length > 1000) {
        fs.writeFileSync(file, buf);
        resolve(true);
      } else resolve(false);
    };
    const timer = setTimeout(() => finish(false), 10000);
    tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3).then(() => {
      const { audioStream } = tts.toStream(text, { rate: 1.08 });
      audioStream.on('data', (c) => chunks.push(c));
      audioStream.on('close', () => finish(true));
      audioStream.on('error', () => finish(false));
    }, () => finish(false));
  });
}
async function makeSpeech(text, base) {
  // dịch vụ giọng AI thỉnh thoảng ngắt giữa chừng một cách ngẫu nhiên: thử lại vài lần
  for (let i = 0; i < 6; i++) if (await edgeSpeak(text, `${base}.mp3`)) return `${base}.mp3`;
  console.error('[giọng đọc] giọng AI không phản hồi, bỏ qua câu:', text);
  return null;
}
app.get('/tts', async (req, res) => {
  const text = String(req.query.text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!text) return res.status(404).end();
  const base = path.join(TTS_DIR, crypto.createHash('sha1').update(`${TTS_VOICE}|${text}`).digest('hex'));
  let file = fs.existsSync(`${base}.mp3`) ? `${base}.mp3` : null;
  if (!file) {
    if (!ttsJobs.has(base)) {
      fs.mkdirSync(TTS_DIR, { recursive: true });
      ttsJobs.set(base, makeSpeech(text, base).finally(() => ttsJobs.delete(base)));
      // dọn bớt file cũ
      const old = fs.readdirSync(TTS_DIR).map((f) => path.join(TTS_DIR, f)).sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
      for (const f of old.slice(0, Math.max(0, old.length - TTS_KEEP))) fs.rmSync(f, { force: true });
    }
    file = await ttsJobs.get(base);
    if (!file) return res.status(500).end();
  }
  res.type('audio/mpeg').sendFile(file);
});
app.get('/nhac', (_req, res) => res.sendFile(path.join(PUBLIC, 'nhac.html')));
// ---------- Logo đoàn khách hàng audit (file do người dùng tải lên) ----------
const LOGO_DIR = path.join(PUBLIC, 'logos');
const LOGO_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg' };
const logoSlug = (team) => String(team).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

function listLogos() {
  const out = {};
  try {
    for (const f of fs.readdirSync(LOGO_DIR)) {
      const m = f.match(/^([a-z0-9-]+)\.(png|jpg|webp|svg)$/);
      if (m) out[m[1]] = `/logos/${f}?v=${Math.round(fs.statSync(path.join(LOGO_DIR, f)).mtimeMs)}`;
    }
  } catch {}
  return out;
}

app.get('/api/logos', (_req, res) => res.json(listLogos()));

// Địa chỉ đường hầm Cloudflare đang chạy: cloudflared báo qua cổng metrics (20241–20245) tại /quicktunnel
app.get('/api/tunnel', async (_req, res) => {
  for (let port = 20241; port <= 20245; port++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/quicktunnel`, { signal: AbortSignal.timeout(800) });
      const { hostname } = await r.json();
      if (hostname) return res.json({ url: `https://${hostname}` });
    } catch {}
  }
  res.json({ url: null });
});
function saveLogo(team, type, body) {
  const slug = logoSlug(team);
  const ext = LOGO_TYPES[String(type).split(';')[0].trim()];
  if (!slug || !ext || !Buffer.isBuffer(body) || !body.length || body.length > 3 * 1024 * 1024) {
    throw new Error('Chỉ nhận ảnh PNG, JPG, WEBP hoặc SVG (tối đa 3MB)');
  }
  fs.mkdirSync(LOGO_DIR, { recursive: true });
  for (const e of Object.values(LOGO_TYPES)) fs.rmSync(path.join(LOGO_DIR, `${slug}.${e}`), { force: true });
  fs.writeFileSync(path.join(LOGO_DIR, `${slug}.${ext}`), body);
  const logos = listLogos();
  broadcast({ type: 'logos', logos });
  return logos[slug];
}

app.post('/api/logo/:team', express.raw({ type: Object.keys(LOGO_TYPES), limit: '3mb' }), (req, res) => {
  try {
    res.json({ ok: true, url: saveLogo(req.params.team, req.headers['content-type'], req.body) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Dán link ảnh (Copy image address): máy chủ tự tải ảnh về làm logo
app.post('/api/logo-url/:team', express.json({ limit: '4kb' }), async (req, res) => {
  try {
    const url = new URL(String(req.body?.url ?? ''));
    if (!/^https?:$/.test(url.protocol)) throw new Error('Link ảnh phải bắt đầu bằng http:// hoặc https://');
    const r = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) throw new Error(`Không tải được ảnh (mã ${r.status})`);
    const body = Buffer.from(await r.arrayBuffer());
    res.json({ ok: true, url: saveLogo(req.params.team, r.headers.get('content-type') ?? '', body) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ---------- Nhân viên Tuấn Tú (đứng máy khi chưa có người xem) ----------
// data/nhan-su.json: [{ "name": "Nguyễn Văn A", "role": "Tổ in" }, ...] — chỉ họ tên + bộ phận, không dữ liệu cá nhân khác
const STAFF_FILE = path.resolve('data', 'nhan-su.json');
function loadStaff() {
  try {
    return JSON.parse(fs.readFileSync(STAFF_FILE, 'utf8'))
      .map((p) => ({
        name: String(p.name ?? p).trim().slice(0, 60),
        role: String(p.role ?? '').trim().slice(0, 40),
        photo: /^\/staff\/[a-z0-9]+\.jpg$/.test(p.photo ?? '') ? p.photo : '',
      }))
      .filter((p) => p.name);
  } catch {
    return [];
  }
}
let staff = loadStaff();
fs.watchFile(STAFF_FILE, { interval: 2000 }, () => {
  staff = loadStaff();
  broadcast({ type: 'staff', staff });
});

// ---------- Nhạc nền MP3 ----------
const MUSIC_DIR = path.join(PUBLIC, 'music');
// Giữ tên tiếng Việt, chỉ bỏ ký tự không hợp lệ trong tên file
const safeTrackName = (name) => String(name).replace(/\.mp3$/i, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '').trim().slice(0, 120);
const music = { index: 0, playing: false, volume: 0.6, shuffle: false, seq: 0 };

function listTracks() {
  try {
    return fs.readdirSync(MUSIC_DIR).filter((f) => /\.mp3$/i.test(f)).sort((a, b) => a.localeCompare(b, 'vi'))
      .map((f) => ({ file: f, name: f.replace(/\.mp3$/i, ''), url: `/music/${encodeURIComponent(f)}` }));
  } catch {
    return [];
  }
}
const musicState = () => {
  const tracks = listTracks();
  if (music.index >= tracks.length) music.index = 0;
  return { ...music, tracks };
};
const sendMusic = () => {
  music.seq += 1;
  broadcast({ type: 'music', music: musicState() });
};

app.get('/api/music', (_req, res) => res.json(musicState()));
app.post('/api/music', express.raw({ type: ['audio/mpeg', 'audio/mp3'], limit: '60mb' }), (req, res) => {
  const name = safeTrackName(decodeURIComponent(String(req.query.name ?? '')));
  if (!name || !Buffer.isBuffer(req.body) || !req.body.length) {
    return res.status(400).json({ error: 'Chỉ nhận file MP3 (tối đa 60MB)' });
  }
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
  fs.writeFileSync(path.join(MUSIC_DIR, `${name}.mp3`), req.body);
  sendMusic();
  res.json({ ok: true });
});
app.delete('/api/music/:file', (req, res) => {
  const file = path.basename(req.params.file);
  if (/\.mp3$/i.test(file)) fs.rmSync(path.join(MUSIC_DIR, file), { force: true });
  sendMusic();
  res.json({ ok: true });
});

function nextTrack(step = 1) {
  const n = listTracks().length;
  if (!n) return;
  if (music.shuffle && n > 1) {
    let i;
    do i = Math.floor(Math.random() * n); while (i === music.index);
    music.index = i;
  } else {
    music.index = (music.index + step + n) % n;
  }
}

// no-cache: OBS/trình duyệt luôn kiểm tra bản mới sau khi cập nhật phần mềm
app.use(express.static(PUBLIC, { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

const server = http.createServer(app);

// ---------- WebSocket ----------
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of wss.clients) if (ws.readyState === ws.OPEN) ws.send(data);
}

const snapshot = () => ({
  type: 'hello',
  settings,
  status: tiktok.status,
  demo: Boolean(stopDemo),
  stats: { ...stats, showing: queue.showing.length, waiting: queue.waitingCount },
  showing: queue.showing,
  feed,
  members: [...members.values()],
  viewers,
  ranks: ranks.pick([...members.keys()]),
  logos: listLogos(),
  music: musicState(),
  staff,
  online,
  auditVisits,
  salaries,
  jobs,
  machineWish,
  gifts: giftLog,
  top: ranks.top(),
  que: queState(),
});

// Cộng điểm chăm chỉ (chủ kênh là Ông chủ nên không tính)
function award(person, points) {
  if (!points || person.username.toLowerCase() === settings.username.toLowerCase()) return;
  const store = person.demo ? demoRanks : ranks;
  const entry = store.award(person, points);
  broadcast({ type: 'rank', entry, top: store.top() });
}

// Người đang trong phiên (giống cột "Đang trong phiên" trên dashboard):
// TikTok báo đang xem, hoặc có hoạt động trong 5 phút gần đây
const ACTIVE_MS = 5 * 60 * 1000;
const GREET_MAX_IN_SESSION = 10; // đông hơn thì không tự chào người mới nữa
const lastSeen = new Map(); // username -> thời điểm hoạt động gần nhất
function inSessionCount() {
  const now = Date.now();
  const names = new Set(online);
  for (const [u, t] of lastSeen) if (now - t <= ACTIVE_MS) names.add(u);
  names.delete(settings.username);
  return names.size;
}

// Donate: quà nào cũng tăng lương (quà càng nhiều xu tăng càng nhiều); từ 10 xu (hoa Rosa) lên 1 chức, từ 20 xu lên thẳng Giám đốc
const DONATE_RAISE_COINS = 1;
const DONATE_PROMOTE_COINS = 10;
const DONATE_DIRECTOR_COINS = 20; // từ 20 xu: lên thẳng Giám đốc nhà máy, chào mừng bằng pháo hoa lớn
// Quà càng nhiều xu thì tăng lương càng nhiều (triệu/tháng)
function donateRaise(coins) {
  const pick = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  if (coins >= 1000) return 50;
  if (coins >= 500) return pick(30, 40);
  if (coins >= 100) return pick(20, 25);
  if (coins >= 30) return pick(12, 16);
  if (coins >= 10) return pick(8, 10);
  if (coins >= 5) return pick(6, 8);
  return pick(3, 6);
}
function rewardDonate(a) {
  if (!settings.autoPromote || a.demo || !a.username || a.username.toLowerCase() === settings.username.toLowerCase()) return;
  const coins = Number(a.coins) || 0;
  if (coins < DONATE_RAISE_COINS) return;
  let delay = 0;
  if (coins >= DONATE_DIRECTOR_COINS) {
    actions.setRank({ username: a.username, title: RANKS[RANKS.length - 1].title, byBoss: true, reason: 'giám đốc' });
    delay = 6500;
  } else if (coins >= DONATE_PROMOTE_COINS) {
    const level = ranks.get(a.username)?.level ?? 0;
    if (level < RANKS.length - 1) {
      // để bảng thăng chức hiện xong rồi mới báo tăng lương
      if (actions.setRank({ username: a.username, title: RANKS[level + 1].title, byBoss: true, reason: 'donate' }) !== false) delay = 4000;
    }
  }
  if ((salaries[a.username] ?? 0) < SALARY_MAX) {
    setTimeout(() => actions.setSalary({ username: a.username, amount: 'raise', by: donateRaise(coins), reason: 'donate' }), delay);
  }
}

// Chia sẻ phiên LIVE: overlay cảm ơn bằng pháo hoa (mỗi người tối đa 1 lần / phút)
const SHARE_COOLDOWN = 60 * 1000;
const lastShare = new Map();
function thankShare(a) {
  if (a.demo || !a.username || a.username.toLowerCase() === settings.username.toLowerCase()) return;
  const now = Date.now();
  if (now - (lastShare.get(a.username) ?? 0) < SHARE_COOLDOWN) return;
  lastShare.set(a.username, now);
  const m = members.get(a.username) ?? { username: a.username, nickname: a.nickname, avatar: a.avatar };
  broadcast({ type: 'shareThanks', member: m, boss: settings.ownerName });
}

function handleActivity(a) {
  alias(a);
  if (a.username) lastSeen.set(a.username, Date.now());
  if (a.kind === 'like') award(a, Math.min(POINTS.likeMax, a.count * POINTS.like));
  else if (a.kind === 'gift') {
    award(a, a.count * POINTS.gift);
    if (!a.demo) logGift(a, tiktok.username);
    rewardDonate(a);
  }
  else if (a.kind === 'share') {
    award(a, POINTS.share);
    thankShare(a);
  }
  else if (a.kind === 'follow') award(a, POINTS.follow);
  // bản đồ quê nhận tương tác của cả kênh chính lẫn kênh thứ hai
  queActivity(a, a.demo ? demoQue : que);
}

// ---------- Bản đồ quê (/overlay/que) ----------
// Bản đồ nhận tương tác từ cả kênh chính lẫn kênh thứ hai (queSource) chạy song song,
// queSource tự kết nối khi máy chủ chạy; bấm Ngắt trên dashboard để tắt.
// Kênh bản đồ trùng kênh chính đang kết nối thì dùng chung luồng đó, không mở thêm.
const queSource = new TikTokSource();
let queEnabled = true;
const mainFeedsQue = () => !tiktok.manualStop && cleanUsername(tiktok.username ?? '').toLowerCase() === settings.queUsername.toLowerCase();
const queGame = () => (stopDemo ? demoQue : que);
const queChannel = () => (mainFeedsQue() ? { ...tiktok.status, message: `Dùng chung kết nối chính — ${tiktok.status.message}` } : queSource.status);
const queState = () => ({
  ...queGame().snapshot(), channel: settings.queUsername, status: queChannel().state, message: queChannel().message,
  liveSince: queChannel().liveSince ?? null, enabled: queEnabled, demo: Boolean(stopDemo),
});
const sendQueState = () => broadcast({ type: 'queState', que: queState() });

function queComment(c, game) {
  if (c.old) return;
  const hit = game.claim(alias(c), c.text);
  if (hit) broadcast({ type: 'queClaim', id: hit.id, changed: hit.changed, isNew: hit.isNew, member: { username: c.username, nickname: c.nickname, avatar: c.avatar }, demo: Boolean(c.demo) });
}
// Thả tim +1 điểm mỗi tim; tặng quà +50 điểm mỗi xu (giả lập không có giá xu thì tính 1 xu mỗi quà)
function queActivity(a, game) {
  if (a.kind === 'share') return broadcast({ type: 'queShare', member: { username: a.username, nickname: alias(a).nickname, avatar: a.avatar }, demo: Boolean(a.demo) });
  const coins = Number(a.coins) || a.count;
  const points = a.kind === 'like' ? a.count : a.kind === 'gift' ? coins * GIFT_POINTS_PER_COIN : 0;
  if (!points) return;
  const hit = game.like(alias(a), points);
  // Cảm ơn mọi người tặng quà (kể cả chưa nhận quê: overlay nhắc bình luận tên quê)
  if (a.kind === 'gift') broadcast({ type: 'queGift', id: hit?.id ?? null, points: hit?.add ?? 0, coins, gift: a.gift ?? null, count: a.count, member: { username: a.username, nickname: a.nickname, avatar: a.avatar }, demo: Boolean(a.demo) });
  if (hit) broadcast({
    type: 'queLike', ...hit, kind: a.kind, coins: a.kind === 'gift' ? coins : 0, gift: a.gift ?? null,
    member: { username: a.username, nickname: a.nickname, avatar: a.avatar }, demo: Boolean(a.demo),
  });
}
function syncQueSource() {
  const want = queEnabled && !mainFeedsQue();
  if (want && (queSource.manualStop || queSource.username !== settings.queUsername)) {
    console.log(`[bản đồ quê] kết nối @${settings.queUsername}`);
    queSource.connect(settings.queUsername);
  } else if (!want && !queSource.manualStop) {
    queSource.disconnect();
  }
}
queSource.on('comment', (c) => queComment(c, que));
queSource.on('activity', (a) => queActivity(a, que)); // quà kênh bản đồ chỉ cộng điểm bản đồ, không vào thống kê quà
queSource.on('status', (s) => {
  console.log(`[bản đồ quê] ${s.message}`);
  sendQueState();
});
tiktok.on('status', () => {
  syncQueSource();
  sendQueState();
});
syncQueSource();

const sendStats = () =>
  broadcast({ type: 'stats', stats: { ...stats, showing: queue.showing.length, waiting: queue.waitingCount } });

// Đổi tên hiển thị theo cài đặt nameAliases (vd. "Sầu Riêng Ba Ngon" → "Sếp Thông")
function alias(person) {
  const key = (v) => String(v ?? '').normalize('NFC').trim().toLowerCase();
  const names = [key(person.nickname), key(person.username)];
  const hit = Object.entries(settings.nameAliases ?? {}).find(([from]) => names.includes(key(from)));
  person.origName ??= person.nickname;
  person.nickname = hit ? hit[1] : person.origName;
  return person;
}

function handleComment(comment) {
  alias(comment);
  lastSeen.set(comment.username, Date.now());
  stats.received += 1;
  const reason = comment.old ? 'Bình luận cũ' : filter.check(comment, settings);
  const entry = { ...comment, filtered: reason };
  feed.push(entry);
  if (feed.length > FEED_SIZE) feed.shift();
  if (reason) stats.filtered += 1;
  else {
    stats.accepted += 1;
    queue.push(comment);
    award(comment, POINTS.comment);
    autoRank(comment);
  }
  broadcast({ type: 'comment', comment: entry });
  // Người bình luận vào xưởng ngay (không phải chờ bình luận tới lượt hiện); trừ người bị chặn / nói từ cấm
  if (!comment.old && !(reason === 'Người dùng bị chặn' || reason?.startsWith('Từ khóa cấm'))) {
    broadcast({ type: 'present', member: members.get(comment.username) ?? { username: comment.username, nickname: comment.nickname, avatar: comment.avatar } });
  }
  queComment(comment, comment.demo ? demoQue : que);
  sendStats();
}

// Tự thăng chức khi nhân viên xin ("cho em làm tổ trưởng"), giảm 1 bậc khi nói tiêu cực
const AUTO_RANK_COOLDOWN = 2 * 60 * 1000;
const lastAutoRank = new Map();
const CV_COOLDOWN = 60 * 1000;
const lastCV = new Map(); // username -> thời điểm
const HELLO_COOLDOWN = 2 * 60 * 1000;
const lastHello = new Map(); // username -> lần sếp chào lại gần nhất
const lastCurse = new Map(); // username -> lần bị đuổi vì chửi tục gần nhất
function autoRank(c) {
  if (!settings.autoPromote || c.demo || c.username.toLowerCase() === settings.username.toLowerCase()) return;
  const now = Date.now();
  // Xin vào làm = nộp CV: chỉ hiện bảng mời nộp CV, có thời gian chờ riêng (không chặn các luật khác)
  // (xin vào làm máy / vị trí cụ thể thì để luật xin máy / xin vị trí xử lý)
  const join = detectJoin(c.text) && !detectMachineRequest(c.text) && !detectJobRequest(c.text);
  if (join || detectCV(c.text)) {
    if (now - (lastCV.get(c.username) ?? 0) < CV_COOLDOWN) return;
    lastCV.set(c.username, now);
    const m = members.get(c.username) ?? { username: c.username, nickname: c.nickname, avatar: c.avatar };
    return broadcast({ type: 'cv', member: m, company: 'Công ty Bao bì Tuấn Tú', boss: settings.ownerName });
  }
  // Chửi tục: đuổi ra khỏi cổng luôn (không chờ thời gian chờ chung; mỗi người tối đa 1 lần / 30 giây)
  if (detectCurse(c.text)) {
    if (now - (lastCurse.get(c.username) ?? 0) < 30 * 1000) return;
    lastCurse.set(c.username, now);
    lastAutoRank.set(c.username, now);
    const m = members.get(c.username) ?? { username: c.username, nickname: c.nickname, avatar: c.avatar };
    return broadcast({ type: 'kickout', member: m, reason: 'chửi tục', boss: settings.ownerName });
  }
  // Chào sếp: sếp chào lại (thời gian chờ riêng 2 phút, không chặn các luật khác)
  if (detectGreetBoss(c.text) && now - (lastHello.get(c.username) ?? 0) > HELLO_COOLDOWN) {
    lastHello.set(c.username, now);
    const m = members.get(c.username) ?? { username: c.username, nickname: c.nickname, avatar: c.avatar };
    broadcast({ type: 'bossHello', member: m, boss: settings.ownerName });
  }
  if (now - (lastAutoRank.get(c.username) ?? 0) < AUTO_RANK_COOLDOWN) return;
  // Xin nghỉ thai sản: cho đi bệnh viện Từ Dũ luôn (overlay đưa xe cấp cứu tới chở đi)
  if (detectMaternity(c.text)) {
    lastAutoRank.set(c.username, now);
    const m = members.get(c.username) ?? { username: c.username, nickname: c.nickname, avatar: c.avatar };
    return broadcast({ type: 'maternity', member: m, hospital: 'Bệnh viện Từ Dũ', boss: settings.ownerName });
  }
  // "Làm việc khác": chuyển sang đứng một máy khác (ngẫu nhiên, khác máy đang làm)
  if (detectSwitchMachine(c.text)) {
    const others = MACHINES.filter((m) => m !== machineWish[c.username]);
    lastAutoRank.set(c.username, now);
    return actions.setMachine({ username: c.username, machine: others[Math.floor(Math.random() * others.length)] });
  }
  // Xin nghỉ việc: đuổi ra khỏi cổng, cho xuống ca
  if (detectQuit(c.text)) {
    lastAutoRank.set(c.username, now);
    const m = members.get(c.username) ?? { username: c.username, nickname: c.nickname, avatar: c.avatar };
    return broadcast({ type: 'kickout', member: m, boss: settings.ownerName });
  }
  // Đòi "giảm giờ làm": trừ lương ngẫu nhiên 1–2 triệu
  if (detectLessHours(c.text)) {
    if (salaries[c.username] === SALARY_LAZY) return; // đã ở mức thấp nhất
    lastAutoRank.set(c.username, now);
    return actions.setSalary({ username: c.username, amount: 'cut', by: 1 + Math.floor(Math.random() * 2), reason: 'giảm giờ làm' });
  }
  // Nói "giảm lương": trừ 30% lương hiện tại (thấp nhất 4tr6)
  if (detectPayCut(c.text)) {
    const before = salaries[c.username] || SALARY_START;
    if (before <= SALARY_LAZY) return; // đã ở mức thấp nhất
    lastAutoRank.set(c.username, now);
    return actions.setSalary({ username: c.username, amount: 'cut', by: Math.max(0.1, Math.round(before * 0.3 * 10) / 10), reason: 'giảm lương' });
  }
  // Xin ứng lương: cho đi làm Đòi nợ khách hàng cho sếp
  if (detectAdvance(c.text)) {
    if (jobs[c.username] === 'doi-no') return; // đang đi đòi nợ rồi
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: 'doi-no', reason: 'ứng lương' });
  }
  if (detectGuardWord(c.text)) {
    if (salaries[c.username] === SALARY_LAZY) return; // đã ở mức thấp nhất
    lastAutoRank.set(c.username, now);
    return actions.setSalary({ username: c.username, amount: 'cut', by: 1, reason: 'bảo vệ' });
  }
  if (detectEffort(c.text)) {
    if ((salaries[c.username] ?? 0) >= SALARY_MAX) return; // đã kịch trần
    lastAutoRank.set(c.username, now);
    return actions.setSalary({ username: c.username, amount: 'raise', by: 1 + Math.floor(Math.random() * 3), reason: 'cố gắng' }); // +1–3 triệu
  }
  if (detectDiligent(c.text)) {
    if ((salaries[c.username] ?? 0) >= SALARY_MAX) return; // đã kịch trần
    lastAutoRank.set(c.username, now);
    return actions.setSalary({ username: c.username, amount: 'raise', by: 1 + Math.floor(Math.random() * 3), reason: 'chăm chỉ' });
  }
  if (detectRaise(c.text)) {
    if ((salaries[c.username] ?? 0) >= SALARY_MAX) return; // đã kịch trần
    lastAutoRank.set(c.username, now);
    return actions.setSalary({ username: c.username, amount: 'raise', reason: 'xin' });
  }
  if (detectStrike(c.text)) {
    lastAutoRank.set(c.username, now);
    return actions.fire({ username: c.username, reason: 'đình công' });
  }
  if (detectNoPay(c.text)) {
    lastAutoRank.set(c.username, now);
    return actions.fire({ username: c.username, reason: 'chưa có lương' });
  }
  // Đòi "trả lương": cho đi làm Bảo vệ
  if (detectPayDemand(c.text)) {
    if (jobs[c.username] === 'bao-ve') return; // đã là bảo vệ
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: 'bao-ve', reason: 'trả lương' });
  }
  if (detectChairman(c.text)) {
    if (jobs[c.username] === 'bao-ve') return; // đã là bảo vệ
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: 'bao-ve', reason: 'chủ tịch' });
  }
  if (detectBossWife(c.text)) {
    if (jobs[c.username] === 'thu-ky') return; // đã là thư ký
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: 'thu-ky', reason: 'vợ sếp' });
  }
  if (detectPraiseBoss(c.text)) {
    if (jobs[c.username] === 'thu-ky') return; // đã là thư ký
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: 'thu-ky', reason: 'khen sếp' });
  }
  if (detectIuBoss(c.text)) {
    if (jobs[c.username] === 'thu-ky') return; // đã là thư ký
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: 'thu-ky', reason: 'iu sếp' });
  }
  if (detectLoveBoss(c.text)) {
    lastAutoRank.set(c.username, now);
    const level = ranks.get(c.username)?.level ?? 0;
    const promoted = level < RANKS.length - 1
      && actions.setRank({ username: c.username, title: RANKS[level + 1].title, byBoss: true, reason: 'yêu sếp' }) !== false;
    // để bảng thăng chức hiện xong rồi mới báo tăng lương
    setTimeout(() => actions.setSalary({ username: c.username, amount: 'raise', reason: 'yêu sếp' }), promoted ? 4000 : 0);
    return;
  }
  if (detectTimesheet(c.text)) {
    lastAutoRank.set(c.username, now);
    return actions.setSalary({ username: c.username, amount: 'cut', reason: 'chấm công' });
  }
  const machine = detectMachineRequest(c.text);
  if (machine) {
    if (machineWish[c.username] === machine && !jobs[c.username]) return; // đang làm máy đó rồi
    lastAutoRank.set(c.username, now);
    return actions.setMachine({ username: c.username, machine });
  }
  const office = detectJobRequest(c.text);
  if (office) {
    if (jobs[c.username] === office) return; // đã làm vị trí đó
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: office, reason: 'xin' });
  }
  if (detectHateBoss(c.text)) {
    if (jobs[c.username] === 'bao-ve' || jobs[c.username] === 'lao-cong') return;
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: Math.random() < 0.5 ? 'bao-ve' : 'lao-cong', reason: 'ghét sếp' });
  }
  if (detectBloodsucker(c.text)) {
    if (jobs[c.username] === 'bao-ve') return; // đã là bảo vệ
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: 'bao-ve', reason: 'hút máu' });
  }
  if (detectDrinking(c.text)) {
    if (jobs[c.username] === 'lao-cong') return; // đã là lao công
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: 'lao-cong', reason: 'đi nhậu' });
  }
  if (detectFlirt(c.text)) {
    if (jobs[c.username] === 'bao-ve') return; // đã là bảo vệ
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: 'bao-ve', reason: 'mê gái' });
  }
  if (detectLazy(c.text)) {
    if (jobs[c.username] === 'bao-ve') return; // đã là bảo vệ
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: 'bao-ve', reason: 'lười' });
  }
  if (detectResign(c.text)) {
    if (jobs[c.username] === 'lao-cong') return; // đã là lao công
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: 'lao-cong', reason: 'từ chức' });
  }
  const tired = detectTired(c.text);
  if (tired) {
    if (jobs[c.username] === 'lao-cong') return; // đã là lao công
    lastAutoRank.set(c.username, now);
    return actions.setJob({ username: c.username, job: 'lao-cong', reason: tired });
  }
  if (detectPromotion(c.text)) {
    const level = ranks.get(c.username)?.level ?? 0;
    if (level >= RANKS.length - 1) return; // đã ở chức cao nhất
    lastAutoRank.set(c.username, now);
    return actions.setRank({ username: c.username, title: RANKS[level + 1].title, byBoss: true, reason: 'xin' });
  }
  if (detectNegative(c.text)) {
    const level = ranks.get(c.username)?.level ?? 0;
    if (level === 0) return; // đã ở bậc thấp nhất
    lastAutoRank.set(c.username, now);
    actions.setRank({ username: c.username, title: RANKS[level - 1].title, byBoss: true, reason: 'tiêu cực' });
  }
}

function handleMember(member) {
  alias(member);
  if (settings.blockedUsers.includes(member.username.toLowerCase())) return;
  const isNew = !members.has(member.username);
  lastSeen.set(member.username, Date.now());
  members.delete(member.username); // đưa lên cuối danh sách
  members.set(member.username, member);
  if (members.size > MEMBERS_SIZE) members.delete(members.keys().next().value);
  // Trong phiên quá 10 người thì không tự chào mừng người mới (vẫn chào bằng nút 🎉 trên dashboard)
  const greet = isNew && inSessionCount() <= GREET_MAX_IN_SESSION;
  broadcast({ type: 'member', member, isNew, greet, total: members.size });
}

tiktok.on('comment', handleComment);
tiktok.on('member', handleMember);
tiktok.on('activity', handleActivity);
tiktok.on('roomRanks', (list) => {
  for (const u of list) if (!members.has(u.username)) handleMember({ ...u, at: Date.now() });
  online = list.map((u) => u.username);
  broadcast({ type: 'online', users: online });
});
tiktok.on('viewers', (n) => {
  viewers = n;
  broadcast({ type: 'viewers', viewers });
});
tiktok.on('status', (status) => broadcast({ type: 'status', status }));
queue.on('change', (showing) => {
  broadcast({ type: 'showing', showing });
  sendStats();
});

// ---------- Đoàn khách hàng audit ----------
// Lần vào gần nhất của từng đoàn (lưu file để giữ qua các lần khởi động)
const VISITS_FILE = path.resolve('data', 'audit-visits.json');
let auditVisits = {};
try { auditVisits = JSON.parse(fs.readFileSync(VISITS_FILE, 'utf8')); } catch {}
let auditTimer = null;
const AUDIT_MAX_VIEWERS = 10; // đông hơn số người xem này thì tạm không cho đoàn audit vào (tránh lag)
function inviteAudit(team, { manual = false } = {}) {
  if (!team) return;
  if (viewers > AUDIT_MAX_VIEWERS) {
    if (manual) broadcast({ type: 'notice', text: `Đang có ${viewers} người xem (trên ${AUDIT_MAX_VIEWERS}): tạm không cho đoàn ${team} vào để tránh lag giao diện.` });
    return;
  }
  auditVisits[team] = Date.now();
  fs.mkdirSync(path.dirname(VISITS_FILE), { recursive: true });
  fs.writeFileSync(VISITS_FILE, JSON.stringify(auditVisits));
  broadcast({ type: 'audit', team });
  broadcast({ type: 'auditVisits', visits: auditVisits });
}
function scheduleAudit() {
  clearInterval(auditTimer);
  if (settings.auditAutoMin > 0) {
    auditTimer = setInterval(() => {
      // mời đoàn lâu chưa đến nhất
      const next = [...settings.auditTeams].sort((a, b) => (auditVisits[a] ?? 0) - (auditVisits[b] ?? 0))[0];
      if (next) inviteAudit(next);
    }, settings.auditAutoMin * 60 * 1000);
  }
}
scheduleAudit();

const actions = {
  // Username mặc định cố định trong cài đặt; kết nối kênh khác không ghi đè mặc định
  connect: ({ username }) => tiktok.connect(username),
  disconnect: () => tiktok.disconnect(),
  demo: ({ on }) => {
    stopDemo?.();
    stopDemo = on ? startDemo(handleComment, handleMember, handleActivity) : null;
    broadcast({ type: 'demo', demo: Boolean(stopDemo) });
    demoQue.resetScores();
    sendQueState();
  },
  settings: ({ patch }) => {
    const autoBefore = settings.auditAutoMin;
    settings = sanitize(patch, settings);
    saveSettings(settings);
    if (settings.auditAutoMin !== autoBefore) scheduleAudit();
    queue.refresh();
    broadcast({ type: 'settings', settings });
  },
  clear: () => queue.clear(),
  // Kênh bản đồ quê (kết nối song song kênh chính)
  queConnect: ({ username }) => {
    const u = cleanUsername(username);
    if (u && u !== settings.queUsername) {
      settings = sanitize({ queUsername: u }, settings);
      saveSettings(settings);
      broadcast({ type: 'settings', settings });
    }
    queEnabled = true;
    queSource.manualStop = true; // buộc kết nối lại (kể cả cùng tên) khi bấm Kết nối
    syncQueSource();
    sendQueState();
  },
  queDisconnect: () => {
    queEnabled = false;
    syncQueSource();
    sendQueState();
  },
  queReset: () => {
    queGame().resetScores();
    sendQueState();
  },
  reloadOverlays: () => broadcast({ type: 'reload' }),
  // Gán người xem làm Trưởng máy (machine = '' để bỏ gán); mỗi máy một người
  setLead: ({ username, machine }) => {
    const user = String(username ?? '').trim();
    if (!user) return;
    const leads = Object.fromEntries(Object.entries(settings.machineLeads ?? {}).filter(([, u]) => u !== user));
    if (machine) leads[machine] = user;
    actions.settings({ patch: { machineLeads: leads } });
  },
  // Nút 🎉 Chào mừng trên dashboard: overlay bắn pháo hoa + bảng chúc mừng người này
  greet: ({ username }) => {
    const m = members.get(String(username ?? ''));
    if (m) broadcast({ type: 'greet', member: m });
  },
  // Sửa tên hiển thị của một người xem (để trống = dùng lại tên TikTok gốc)
  setAlias: ({ username, name }) => {
    const user = String(username ?? '').trim();
    if (!user) return;
    const aliases = { ...settings.nameAliases };
    const m = members.get(user);
    // bỏ các tên cũ trỏ tới người này (theo username hoặc tên TikTok gốc)
    for (const k of Object.keys(aliases)) {
      const kk = k.toLowerCase();
      if (kk === user.toLowerCase() || (m && kk === String(m.origName ?? '').toLowerCase())) delete aliases[k];
    }
    const nice = String(name ?? '').trim().slice(0, 60);
    if (nice) aliases[user] = nice;
    actions.settings({ patch: { nameAliases: aliases } });
    if (m) {
      alias(m);
      broadcast({ type: 'memberUpdate', member: m });
    }
  },
  // Điều chuyển làm Bảo vệ / Lao công (job = '' để về lại xưởng)
  setJob: ({ username, job, reason }) => {
    const name = String(username ?? '').trim().replace(/^@/, '');
    if (!name || (job && !JOBS[job])) return;
    if (job) jobs[name] = job;
    else delete jobs[name];
    fs.mkdirSync(path.dirname(JOBS_FILE), { recursive: true });
    fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs));
    const m = members.get(name) ?? feed.findLast((c) => c.username === name) ?? { username: name, nickname: name };
    broadcast({ type: 'job', member: m, job: job || null, jobs, boss: settings.ownerName, reason: reason ?? null });
  },
  // Đuổi việc: cho xuống làm Công nhân (rời vị trí đặc biệt / trưởng máy, vẫn ở lại xưởng)
  fire: ({ username, reason }) => {
    const name = String(username ?? '').trim().replace(/^@/, '');
    if (!name) return;
    const m = members.get(name) ?? feed.findLast((c) => c.username === name) ?? { username: name, nickname: name };
    const level = ranks.get(name)?.level ?? 0;
    const entry = level > 1 ? ranks.setRank({ username: name, nickname: m.nickname, avatar: m.avatar }, RANKS[1].title, true) : ranks.get(name);
    if (jobs[name]) {
      delete jobs[name];
      fs.mkdirSync(path.dirname(JOBS_FILE), { recursive: true });
      fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs));
    }
    const leads = settings.machineLeads ?? {};
    if (Object.values(leads).includes(name)) actions.settings({ patch: { machineLeads: Object.fromEntries(Object.entries(leads).filter(([, u]) => u !== name)) } });
    if (entry) broadcast({ type: 'rank', entry: { ...entry, promoted: false }, top: ranks.top() });
    broadcast({ type: 'fired', member: m, reason: reason ?? null, jobs, boss: settings.ownerName });
  },
  // Cho nhân viên về đứng máy họ xin (rời vị trí bảo vệ / lao công / văn phòng nếu có)
  setMachine: ({ username, machine }) => {
    const name = String(username ?? '').trim().replace(/^@/, '');
    if (!name || (machine && !MACHINES.includes(machine))) return;
    if (machine) machineWish[name] = machine;
    else delete machineWish[name];
    fs.mkdirSync(path.dirname(MACHINE_FILE), { recursive: true });
    fs.writeFileSync(MACHINE_FILE, JSON.stringify(machineWish));
    if (machine && jobs[name]) {
      delete jobs[name];
      fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs));
    }
    const m = members.get(name) ?? feed.findLast((c) => c.username === name) ?? { username: name, nickname: name };
    broadcast({ type: 'machine', member: m, machine: machine || null, machineWish, jobs, boss: settings.ownerName });
  },
  setSalary: ({ username, amount, reason, by }) => {
    const name = String(username ?? '').trim().replace(/^@/, '');
    const value = Number(amount);
    const before = salaries[name] ?? 0;
    // amount = 'raise': tăng ngẫu nhiên 3–6 triệu, tối đa SALARY_MAX
    // amount = 'cut': trừ ngẫu nhiên 3–6 triệu, thấp nhất 4tr6
    const jump = by > 0 ? Number(by) : 3 + Math.floor(Math.random() * 4);
    const raw = amount === 'raise' ? Math.min(SALARY_MAX, Math.max(before, SALARY_START) + jump)
      : amount === 'cut' ? Math.max(SALARY_LAZY, (before || SALARY_START) - jump)
      : value;
    const next = Math.round(raw * 10) / 10; // lẻ tới 100k, vd. 12.5 = 12tr5
    if (amount === 'cut' && before === SALARY_LAZY) return; // đã ở mức thấp nhất
    if (!name || !(Number.isFinite(next) && next >= 1 && next <= SALARY_MAX)) return;
    if (amount === 'raise' && before >= SALARY_MAX) return; // đã kịch trần
    // Tự động (có lý do) thì một người không được tăng lương 3 lần liên tiếp. Tính lại khi người khác được tăng,
    // khi người này bị trừ / giảm lương, hoặc 10 phút không ai được tăng. Sếp tăng tay và donate thì không giới hạn.
    const fresh = raiseStreak?.name === name && Date.now() - raiseStreak.at < RAISE_STREAK_MS ? raiseStreak.n : 0;
    if (next > before) {
      if (reason && reason !== 'donate' && fresh >= RAISE_STREAK_MAX) return;
      raiseStreak = { name, n: fresh + 1, at: Date.now() };
    } else if (raiseStreak?.name === name) raiseStreak = null;
    salaries[name] = next;
    fs.mkdirSync(path.dirname(SALARY_FILE), { recursive: true });
    fs.writeFileSync(SALARY_FILE, JSON.stringify(salaries));
    const m = members.get(name) ?? feed.findLast((c) => c.username === name) ?? { username: name, nickname: name };
    broadcast({ type: 'salary', member: m, amount: next, raised: next >= before, lazy: next === SALARY_LAZY, max: next >= SALARY_MAX, cut: amount === 'cut' ? Math.round((before - next) * 10) / 10 : 0, reason: reason ?? null, boss: settings.ownerName, salaries });
  },
  setRank: ({ username, title, byBoss, reason }) => {
    const name = String(username ?? '').trim().replace(/^@/, '');
    if (!name) return;
    const m = members.get(name) ?? feed.findLast((c) => c.username === name);
    const before = ranks.get(name)?.level ?? 0;
    const target = RANKS.findIndex((r) => r.title.toLowerCase() === String(title).toLowerCase());
    if (reason && target > before) {
      if (reason !== 'donate' && reason !== 'giám đốc' && Date.now() - (lastPromote.get(name) ?? 0) < RAISE_STREAK_MS) return false;
      lastPromote.set(name, Date.now());
    } else if (target < before) lastPromote.delete(name);
    const entry = ranks.setRank({ username: name, nickname: m?.nickname, avatar: m?.avatar }, title, Boolean(byBoss));
    // Thăng/hạ chức từ dashboard: overlay thông báo "Sếp Toán vừa thăng chức cho … lên làm …"
    if (byBoss) {
      broadcast({ type: 'rank', entry: { ...entry, promoted: false }, top: ranks.top() });
      broadcast({ type: 'bossPromote', entry, member: m ?? { username: name, nickname: name }, demoted: entry.level < before, reason: reason ?? null, boss: settings.ownerName });
    } else {
      broadcast({ type: 'rank', entry: { ...entry, promoted: true }, top: ranks.top() });
    }
  },
  music: ({ cmd, index, volume, on }) => {
    if (cmd === 'play') music.playing = true;
    else if (cmd === 'pause') music.playing = false;
    else if (cmd === 'toggle') music.playing = !music.playing;
    else if (cmd === 'next') { nextTrack(1); music.playing = true; }
    else if (cmd === 'prev') { nextTrack(-1); music.playing = true; }
    else if (cmd === 'select') { music.index = Math.max(0, Number(index) || 0); music.playing = true; }
    else if (cmd === 'volume') music.volume = Math.min(1, Math.max(0, Number(volume) || 0));
    else if (cmd === 'shuffle') music.shuffle = Boolean(on);
    sendMusic();
  },
  audit: ({ team }) => inviteAudit(String(team ?? '').trim().slice(0, 24), { manual: true }),
  clearMembers: () => {
    members.clear();
    broadcast({ type: 'members', members: [] });
  },
};

const viewports = new Map(); // ws -> kích thước overlay đang vẽ
app.get('/api/viewports', (_req, res) => res.json([...viewports.values()]));

wss.on('connection', (ws, req) => {
  ws.on('close', () => viewports.delete(ws));
  const readOnly = isRemote(req);
  ws.send(JSON.stringify(snapshot()));
  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    try {
      if (msg?.type === 'viewport') {
        // Overlay báo kích thước thật nó đang được vẽ (để biết LIVE Studio/OBS có vẽ nhỏ rồi phóng to không)
        const v = { page: String(msg.page).slice(0, 40), w: Number(msg.w) | 0, h: Number(msg.h) | 0, dpr: Number(msg.dpr) || 1, remote: readOnly, ua: String(req.headers['user-agent'] ?? '').slice(0, 80) };
        viewports.set(ws, v);
        console.log(`[khung hình] ${v.page}: ${v.w}×${v.h} @${v.dpr}x${v.remote ? ' (qua đường hầm)' : ''} — ${v.ua}`);
      } else if (msg?.type === 'musicEnded') {
        // Chỉ chuyển bài một lần dù nhiều trình phát cùng báo
        if (msg.seq === music.seq && msg.index === music.index) { nextTrack(1); sendMusic(); }
      } else if (!readOnly) await actions[msg?.type]?.(msg);
    } catch (err) {
      console.error('[ws]', err);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Live Comment Studio đang chạy`);
  console.log(`  Dashboard: http://${HOST}:${PORT}/dashboard`);
  console.log(`  Overlay  : http://${HOST}:${PORT}/overlay   (dán vào OBS → Browser Source)`);
  console.log(`  Chùa     : http://${HOST}:${PORT}/overlay/chua`);
  console.log(`  Nhà máy  : http://${HOST}:${PORT}/overlay/nha-may`);
  console.log(`  Bản đồ   : http://${HOST}:${PORT}/overlay/que   (kênh @${settings.queUsername})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    stopDemo?.();
    ranks.save();
    que.save();
    await Promise.all([tiktok.disconnect(), queSource.disconnect()]);
    process.exit(0);
  });
}
