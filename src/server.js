import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer } from 'ws';
import { loadSettings, saveSettings, sanitize } from './settings.js';
import { CommentFilter } from './filter.js';
import { DisplayQueue } from './display-queue.js';
import { TikTokSource, cleanUsername } from './tiktok.js';
import { startDemo } from './demo.js';

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
let stopDemo = null;

// ---------- HTTP ----------
const app = express();
app.get('/', (_req, res) => res.redirect('/dashboard'));
app.get('/dashboard', (_req, res) => res.sendFile(path.join(PUBLIC, 'dashboard.html')));
app.get('/overlay', (_req, res) => res.sendFile(path.join(PUBLIC, 'overlay.html')));
app.get('/overlay/chua', (_req, res) => res.sendFile(path.join(PUBLIC, 'overlay-chua.html')));
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
});

const sendStats = () =>
  broadcast({ type: 'stats', stats: { ...stats, showing: queue.showing.length, waiting: queue.waitingCount } });

function handleComment(comment) {
  stats.received += 1;
  const reason = comment.old ? 'Bình luận cũ' : filter.check(comment, settings);
  const entry = { ...comment, filtered: reason };
  feed.push(entry);
  if (feed.length > FEED_SIZE) feed.shift();
  if (reason) stats.filtered += 1;
  else {
    stats.accepted += 1;
    queue.push(comment);
  }
  broadcast({ type: 'comment', comment: entry });
  sendStats();
}

function handleMember(member) {
  if (settings.blockedUsers.includes(member.username.toLowerCase())) return;
  const isNew = !members.has(member.username);
  members.delete(member.username); // đưa lên cuối danh sách
  members.set(member.username, member);
  if (members.size > MEMBERS_SIZE) members.delete(members.keys().next().value);
  broadcast({ type: 'member', member, isNew, total: members.size });
}

tiktok.on('comment', handleComment);
tiktok.on('member', handleMember);
tiktok.on('viewers', (n) => {
  viewers = n;
  broadcast({ type: 'viewers', viewers });
});
tiktok.on('status', (status) => broadcast({ type: 'status', status }));
queue.on('change', (showing) => {
  broadcast({ type: 'showing', showing });
  sendStats();
});

const actions = {
  connect: ({ username }) => {
    const name = cleanUsername(username);
    if (name && name !== settings.username) actions.settings({ patch: { username: name } });
    return tiktok.connect(username);
  },
  disconnect: () => tiktok.disconnect(),
  demo: ({ on }) => {
    stopDemo?.();
    stopDemo = on ? startDemo(handleComment, handleMember) : null;
    broadcast({ type: 'demo', demo: Boolean(stopDemo) });
  },
  settings: ({ patch }) => {
    settings = sanitize(patch, settings);
    saveSettings(settings);
    queue.refresh();
    broadcast({ type: 'settings', settings });
  },
  clear: () => queue.clear(),
  clearMembers: () => {
    members.clear();
    broadcast({ type: 'members', members: [] });
  },
};

wss.on('connection', (ws) => {
  ws.send(JSON.stringify(snapshot()));
  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    try {
      await actions[msg?.type]?.(msg);
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
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    stopDemo?.();
    await tiktok.disconnect();
    process.exit(0);
  });
}
