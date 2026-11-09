import { connectWS, initials } from '/ws-client.js';

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat('vi-VN');
const FEED_SIZE = 5; // chỉ giữ 5 bình luận mới nhất cho gọn và nhẹ
const RANK_TITLES = ['Học việc', 'Công nhân', 'Thợ đứng máy', 'Tổ trưởng', 'Trưởng ca', 'Quản đốc', 'Phó giám đốc', 'Giám đốc nhà máy'];
const forms = [$('displayForm'), $('filterForm'), $('auditForm')];
let settings = null;
let status = { state: 'idle', message: 'Chưa kết nối' };
let demo = false;

const server = connectWS(onMessage, (open) => {
  $('liveDot').classList.toggle('on', open);
  $('liveDot').textContent = open ? 'Đang nhận dữ liệu' : 'Mất kết nối máy chủ';
});

function onMessage(msg) {
  switch (msg.type) {
    case 'hello':
      $('feed').replaceChildren();
      msg.feed.forEach(addComment);
      setStats(msg.stats);
      logos = msg.logos ?? {};
      auditVisits = msg.auditVisits ?? {};
      onlineSet = new Set(msg.online ?? []);
      salaries = msg.salaries ?? {};
      jobs = msg.jobs ?? {};
      gifts = msg.gifts ?? [];
      renderGifts();
      if (msg.music) renderMusic(msg.music);
      viewerMap.clear();
      for (const m of msg.members ?? []) viewerMap.set(m.username, m);
      for (const [name, r] of Object.entries(msg.ranks ?? {})) viewerRanks.set(name, r);
      renderViewers();
      setSettings(msg.settings);
      demo = msg.demo;
      setStatus(msg.status);
      setQueChannel(msg.que);
      // Lấy username từ máy chủ, không dùng giá trị trình duyệt tự khôi phục khi tải lại trang
      if (document.activeElement !== $('username')) $('username').value = msg.settings.username;
      // Mở / F5 dashboard thì tự kết nối nếu chưa kết nối (hoặc lần trước bị lỗi)
      if (!['connected', 'connecting', 'reconnecting'].includes(msg.status.state) && $('username').value) {
        server.send({ type: 'connect', username: $('username').value });
      }
      break;
    case 'comment':
      addComment(msg.comment);
      // Người bình luận cũng là người đang xem: thêm vào Top viewers nếu chưa có
      if (!msg.comment.old) {
        if (!touchViewer(msg.comment.username)) viewerMap.set(msg.comment.username, { ...msg.comment, at: Date.now(), lastAt: Date.now() });
        renderViewersSoon();
      }
      break;
    case 'stats': setStats(msg.stats); break;
    case 'status': setStatus(msg.status); break;
    case 'queState': setQueChannel(msg.que); break;
    case 'settings': setSettings(msg.settings); break;
    case 'demo': demo = msg.demo; setStatus(status); break;
    case 'music': renderMusic(msg.music); break;
    case 'notice': alert(msg.text); break;
    case 'gift':
      gifts.push(msg.entry);
      renderGifts();
      break;
    case 'salary':
      salaries = msg.salaries;
      renderViewersSoon();
      break;
    case 'job':
    case 'machine':
      jobs = msg.jobs;
      renderViewersSoon();
      break;
    case 'fired':
      jobs = msg.jobs;
      renderViewersSoon();
      break;
    case 'auditVisits':
      auditVisits = msg.visits;
      renderAuditButtons(settings?.auditTeams ?? []);
      break;
    case 'online':
      onlineSet = new Set(msg.users);
      renderViewersSoon();
      break;
    case 'member':
      viewerMap.set(msg.member.username, { ...msg.member, lastAt: Date.now() });
      renderViewersSoon();
      break;
    case 'memberUpdate':
      viewerMap.set(msg.member.username, { ...viewerMap.get(msg.member.username), ...msg.member });
      renderViewersSoon();
      break;
    case 'members':
      viewerMap.clear();
      renderViewersSoon();
      break;
    case 'rank':
      viewerRanks.set(msg.entry.username, msg.entry);
      touchViewer(msg.entry.username);
      renderViewersSoon();
      break;
    case 'logos': logos = msg.logos; renderAuditButtons(settings?.auditTeams ?? []); break;
  }
}

// ---------- Kết nối ----------
$('connectForm').addEventListener('submit', (e) => {
  e.preventDefault();
  server.send({ type: 'connect', username: $('username').value });
});
$('disconnectBtn').onclick = () => server.send({ type: 'disconnect' });
$('queForm').addEventListener('submit', (e) => {
  e.preventDefault();
  server.send({ type: 'queConnect', username: $('queUser').value });
});
$('queDisconnectBtn').onclick = () => server.send({ type: 'queDisconnect' });

// Kênh thứ hai (bản đồ quê): máy chủ gửi kèm trạng thái kết nối trong queState
function setQueChannel(q) {
  if (!q) return;
  if (document.activeElement !== $('queUser')) $('queUser').value = q.channel;
  const pill = $('quePill');
  const live = q.status === 'connected';
  pill.dataset.state = q.enabled ? q.status : 'idle';
  pill.textContent = !q.enabled ? 'Đã ngắt' : live ? `LIVE @${q.channel}` : {
    idle: 'Chưa kết nối', connecting: 'Đang kết nối', reconnecting: 'Đang kết nối lại', error: 'Chưa LIVE', ended: 'LIVE đã kết thúc',
  }[q.status] ?? q.status;
  $('queStatusMsg').textContent = q.enabled ? (q.message ?? '') : 'Đã ngắt kết nối kênh thứ hai';
}
$('demoBtn').onclick = () => server.send({ type: 'demo', on: !demo });
$('clearBtn').onclick = () => server.send({ type: 'clear' });
$('clearMembersBtn').onclick = () => server.send({ type: 'clearMembers' });
$('queResetBtn').onclick = () => confirm('Xóa điểm tất cả tỉnh trên bản đồ quê?') && server.send({ type: 'queReset' });
$('reloadBtn').onclick = () => server.send({ type: 'reloadOverlays' });

function setStatus(s) {
  status = s;
  const pill = $('pill');
  const live = s.state === 'connected';
  pill.dataset.state = !live && demo ? 'demo' : s.state;
  pill.textContent = live ? `LIVE @${s.username}` : demo ? 'Demo' : {
    idle: 'Chưa kết nối', connecting: 'Đang kết nối', reconnecting: 'Đang kết nối lại', error: 'Lỗi', ended: 'LIVE đã kết thúc',
  }[s.state] ?? s.state;
  $('statusMsg').textContent = s.message;
  $('demoBtn').setAttribute('aria-pressed', String(demo));
  tickLiveTime();
  // Phiên LIVE mới: bảng quà "Phiên này" tính lại từ đầu
  if (live && s.liveSince && s.liveSince !== sessionStart) {
    sessionStart = s.liveSince;
    try { localStorage.setItem(SESSION_KEY, String(sessionStart)); } catch {}
    renderGifts();
  }
}

// Đồng hồ thời gian LIVE: đếm từ lúc phiên bắt đầu (máy chủ gửi liveSince khi đang kết nối)
const pad2 = (n) => String(n).padStart(2, '0');
function tickLiveTime() {
  const since = status.state === 'connected' ? status.liveSince : null;
  if (!since) return void ($('sLiveTime').textContent = '--:--');
  const sec = Math.max(0, Math.floor((Date.now() - since) / 1000));
  const h = Math.floor(sec / 3600);
  $('sLiveTime').textContent = `${h ? `${h}:` : ''}${pad2(Math.floor(sec / 60) % 60)}:${pad2(sec % 60)}`;
}
setInterval(tickLiveTime, 1000);

function setStats(s) {
  $('sReceived').textContent = fmt.format(s.received);
  $('sShowing').textContent = fmt.format(s.showing);
  $('sWaiting').textContent = fmt.format(s.waiting);
  $('sFiltered').textContent = fmt.format(s.filtered);
}

// ---------- Danh sách bình luận ----------
function addComment(c) {
  const feed = $('feed');
  const li = document.createElement('li');
  if (c.filtered) li.className = 'filtered';

  let avatar;
  if (c.avatar) {
    avatar = Object.assign(document.createElement('img'), { src: c.avatar, alt: '', referrerPolicy: 'no-referrer', loading: 'lazy' });
  } else {
    avatar = Object.assign(document.createElement('div'), { textContent: initials(c.nickname || c.username) });
  }
  avatar.classList.add('avatar');

  const body = document.createElement('div');
  const name = Object.assign(document.createElement('div'), { className: 'name', textContent: `@${c.username}` });
  if (c.filtered) name.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: c.filtered }));
  // Thời gian bình luận: bình luận cũ lấy giờ TikTok ghi nhận, bình luận mới lấy lúc nhận được
  const at = c.old && c.createdAt ? c.createdAt : c.at;
  const ago = Object.assign(document.createElement('span'), { className: 'ago', textContent: timeAgo(at) });
  ago.dataset.at = at ?? '';
  name.append(ago);
  // Chức vụ + lương hiện tại của người bình luận (tự cập nhật khi đổi)
  const meta = Object.assign(document.createElement('span'), { className: 'meta' });
  meta.dataset.user = c.username;
  paintMeta(meta);
  name.append(meta);
  body.append(name, Object.assign(document.createElement('div'), { className: 'text', textContent: c.text }));

  // Chặn / Bỏ chặn người bình luận (nút tự đổi theo danh sách chặn hiện tại)
  const block = Object.assign(document.createElement('button'), { type: 'button', className: 'block small' });
  block.dataset.user = c.username.toLowerCase();
  paintBlock(block);
  block.onclick = () => {
    const users = new Set(settings.blockedUsers);
    const u = block.dataset.user;
    if (users.has(u)) users.delete(u);
    else users.add(u);
    server.send({ type: 'settings', patch: { blockedUsers: [...users] } });
  };

  // Sếp Toán thăng/hạ chức cho người bình luận
  const promote = Object.assign(document.createElement('select'), { className: 'promote small', title: `Thăng chức cho @${c.username}` });
  promote.append(
    new Option('⬆ Thăng chức…', ''),
    ...RANK_TITLES.map((t) => new Option(t, t)),
    new Option('🛡 Xuống làm Bảo vệ', 'job:bao-ve'),
    new Option('🧹 Xuống làm Lao công', 'job:lao-cong'),
    new Option('💼 Đi đòi nợ khách hàng', 'job:doi-no'),
    new Option('📝 Làm Thư ký', 'job:thu-ky'),
    new Option('🧮 Làm Kế toán', 'job:ke-toan'),
    new Option('↩ Về lại xưởng', 'job:'),
  );
  promote.onchange = () => {
    const v = promote.value;
    if (!v) return;
    if (v.startsWith('job:')) server.send({ type: 'setJob', username: c.username, job: v.slice(4) });
    else server.send({ type: 'setRank', username: c.username, title: v, byBoss: true });
    promote.value = '';
  };
  // Sếp Toán tăng lương (triệu/tháng)
  const salary = Object.assign(document.createElement('select'), { className: 'promote small', title: `Tăng lương cho @${c.username}` });
  salary.append(
    new Option('💰 Tăng lương…', ''),
    new Option('🎲 Tăng ngẫu nhiên +3–6 triệu', 'raise'),
    ...[15, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 150, 200, 250, 300, 400, 500].map((v) => new Option(`${v} triệu`, v)),
    new Option('😴 Giảm lương vì làm biếng → 4tr6', 4.6),
  );
  salary.onchange = () => {
    if (!salary.value) return;
    server.send({ type: 'setSalary', username: c.username, amount: salary.value === 'raise' ? 'raise' : Number(salary.value) });
    salary.value = '';
  };
  // Sếp Toán xếp vị trí: Trưởng máy hoặc đứng máy nào
  const place = Object.assign(document.createElement('select'), { className: 'promote small', title: `Xếp vị trí cho @${c.username}` });
  const fillPlace = () => {
    const leads = settings?.machineLeads ?? {};
    const lead = document.createElement('optgroup');
    lead.label = 'Làm Trưởng máy';
    lead.append(...Object.entries(MACHINE_NAMES).map(([k, n]) => {
      const holder = leads[k];
      return new Option(holder === c.username ? `${n} ✓` : holder ? `${n} (thay @${holder})` : n, `lead:${k}`);
    }));
    const work = document.createElement('optgroup');
    work.label = 'Đứng máy';
    work.append(...Object.entries(MACHINE_NAMES).map(([k, n]) => new Option(n.replace('👑', '⚙'), `machine:${k}`)));
    place.replaceChildren(new Option('🏭 Vị trí…', ''), lead, work);
    if (Object.values(leads).includes(c.username)) place.append(new Option('✖ Thôi làm Trưởng máy', 'lead:'));
  };
  fillPlace();
  place.onfocus = fillPlace; // cập nhật ai đang giữ máy nào trước khi chọn
  place.onchange = () => {
    const [kind, machine] = place.value.split(':');
    if (kind === 'lead') server.send({ type: 'setLead', username: c.username, machine });
    else if (kind === 'machine') server.send({ type: 'setMachine', username: c.username, machine });
    place.value = '';
  };
  const actionsBox = Object.assign(document.createElement('div'), { className: 'feed-actions' });
  actionsBox.append(promote, salary, place, block);
  li.append(avatar, body, actionsBox);
  feed.append(li);
  while (feed.children.length > FEED_SIZE) feed.firstElementChild.remove();
  feed.scrollTop = feed.scrollHeight; // luôn cuộn xuống bình luận mới nhất
  $('feedEmpty').hidden = true;
}

// ---------- Top viewers + sửa tên hiển thị ----------
const viewerMap = new Map(); // username -> { username, nickname, origName, avatar }
let onlineSet = new Set();    // TikTok báo đang trong phòng
let salaries = {};            // username -> lương (triệu/tháng)
let jobs = {};                // username -> 'bao-ve' | 'lao-cong' | 'thu-ky' | 'ke-toan'
// 30 -> "30 triệu", 4.6 -> "4tr6"
const moneyText = (v) => (v < 1 ? `${Math.round(v * 1000)}k` : Number.isInteger(v) ? `${v} triệu` : `${Math.floor(v)}tr${Math.round((v % 1) * 10)}`);
const JOB_LABEL = { 'bao-ve': '🛡 Bảo vệ', 'lao-cong': '🧹 Lao công', 'thu-ky': '📝 Thư ký', 'ke-toan': '🧮 Kế toán', 'doi-no': '💼 Đòi nợ' };
let viewerFilter = 'live';    // 'live' = đang trong phiên, 'all' = tất cả
const ACTIVE_MS = 5 * 60 * 1000;
// 🟢 TikTok báo đang xem · 🟡 hoạt động ≤ 5 phút · ⚪ có thể đã rời
const presence = (v) => (onlineSet.has(v.username) ? 'on' : Date.now() - (v.lastAt ?? v.at ?? 0) <= ACTIVE_MS ? 'recent' : 'gone');
const viewerRanks = new Map(); // username -> { points, title }
function paintMeta(el) {
  const u = el.dataset.user;
  const r = viewerRanks.get(u);
  const parts = [];
  if (jobs[u]) parts.push(JOB_LABEL[jobs[u]]);
  else if (r?.title) parts.push(`👔 ${r.title}`);
  if (salaries[u]) parts.push(`💰 ${moneyText(salaries[u])}`);
  el.textContent = parts.join(' · ');
  el.hidden = !parts.length;
}
function renderViewers() {
  document.querySelectorAll('.feed .meta').forEach(paintMeta);
  const all = [...viewerMap.values()];
  const live = all.filter((v) => presence(v) !== 'gone');
  $('filterLive').textContent = `Đang trong phiên (${live.length})`;
  $('filterAll').textContent = `Tất cả (${all.length})`;
  $('filterLive').classList.toggle('on', viewerFilter === 'live');
  $('filterAll').classList.toggle('on', viewerFilter === 'all');
  const list = (viewerFilter === 'live' ? live : all).sort((a, b) =>
    (viewerRanks.get(b.username)?.points ?? 0) - (viewerRanks.get(a.username)?.points ?? 0) || (b.at ?? 0) - (a.at ?? 0));
  $('viewerCount').textContent = `${list.length} người`;
  $('viewersEmpty').hidden = list.length > 0;
  const focused = document.activeElement?.dataset?.user;
  $('viewers').replaceChildren(...list.slice(0, 100).map((v, i) => {
    const li = document.createElement('li');
    const av = v.avatar
      ? Object.assign(document.createElement('img'), { src: v.avatar, alt: '', referrerPolicy: 'no-referrer', loading: 'lazy' })
      : Object.assign(document.createElement('div'), { textContent: initials(v.origName || v.username) });
    av.classList.add('avatar');
    const info = Object.assign(document.createElement('div'), { className: 'info' });
    const orig = Object.assign(document.createElement('div'), { className: 'orig', textContent: `@${v.username} · TikTok: ${v.origName || v.nickname}` });
    const edit = Object.assign(document.createElement('form'), { className: 'edit' });
    const input = Object.assign(document.createElement('input'), { value: v.nickname !== v.origName ? v.nickname : '', placeholder: v.origName || v.username });
    input.dataset.user = v.username;
    const save = Object.assign(document.createElement('button'), { type: 'submit', className: 'small', textContent: 'Lưu' });
    const greet = Object.assign(document.createElement('button'), { type: 'button', className: 'small primary', textContent: '🎉 Chào mừng', title: 'Bắn pháo hoa + câu chào trên màn hình LIVE' });
    greet.onclick = () => {
      server.send({ type: 'greet', username: v.username });
      greet.textContent = '🎆 Đã chào';
      setTimeout(() => (greet.textContent = '🎉 Chào mừng'), 2000);
    };
    if (Object.values(settings?.machineLeads ?? {}).includes(v.username)) li.classList.add('is-lead');
    edit.append(input, save, greet);
    edit.onsubmit = (e) => {
      e.preventDefault();
      server.send({ type: 'setAlias', username: v.username, name: input.value });
      save.textContent = 'Đã lưu';
      setTimeout(() => (save.textContent = 'Lưu'), 1200);
    };
    const r = viewerRanks.get(v.username);
    const p = presence(v);
    const meta = Object.assign(document.createElement('div'), {
      className: 'meta',
      textContent: `${{ on: '🟢 Đang xem', recent: '🟡 Hoạt động gần đây', gone: '⚪ Có thể đã rời' }[p]} · ${r ? `${r.title} · ${r.points} điểm` : 'Nhân viên chính thức'}${salaries[v.username] ? ` · 💰 ${moneyText(salaries[v.username])}` : ''}${jobs[v.username] ? ` · ${JOB_LABEL[jobs[v.username]]}` : ''} · `,
    });
    li.classList.toggle('gone', p === 'gone');
    const ago = Object.assign(document.createElement('span'), { className: 'ago', textContent: timeAgo(v.lastAt ?? v.at) });
    ago.dataset.at = v.lastAt ?? v.at ?? '';
    meta.append(ago);
    info.append(orig, edit, meta);
    li.append(Object.assign(document.createElement('span'), { className: 'rank', textContent: i + 1 }), av, info);
    if (focused === v.username) setTimeout(() => input.focus(), 0);
    return li;
  }));
}
const MACHINE_NAMES = {
  song: '👑 Máy tạo sóng', offset: '👑 Máy in offset', canmang: '👑 Máy cán màng', flexo: '👑 Máy in flexo',
  boi: '👑 Máy bồi', be: '👑 Máy bế tự động', dan: '👑 Máy dán tự động', thanhpham: '👑 Khu thành phẩm',
};
// "vừa xong", "25 giây trước", "3 phút trước", "1 giờ trước"
function timeAgo(at) {
  if (!at) return '';
  const s = Math.max(0, Math.round((Date.now() - Number(at)) / 1000));
  if (s < 5) return '🕒 vừa xong';
  if (s < 60) return `🕒 ${s} giây trước`;
  if (s < 3600) return `🕒 ${Math.floor(s / 60)} phút trước`;
  return `🕒 ${Math.floor(s / 3600)} giờ trước`;
}
// Cập nhật chữ thời gian mỗi 5 giây (không vẽ lại cả danh sách để không làm mất chữ đang gõ)
setInterval(() => {
  for (const el of document.querySelectorAll('#viewers .ago, #feed .ago')) el.textContent = timeAgo(el.dataset.at);
  for (const el of document.querySelectorAll('.audit-row .visit')) {
    if (el.dataset.at) el.textContent = `vào lần cuối ${timeAgo(el.dataset.at).replace('🕒 ', '')}`;
  }
}, 5000);
// Ghi nhận hoạt động gần nhất của một người xem
function touchViewer(username, extra = {}) {
  const v = viewerMap.get(username);
  if (v) Object.assign(v, extra, { lastAt: Date.now() });
  return v;
}

$('filterLive').onclick = () => { viewerFilter = 'live'; renderViewers(); };
$('filterAll').onclick = () => { viewerFilter = 'all'; renderViewers(); };
let viewersTimer;
const renderViewersSoon = () => {
  // không vẽ lại khi đang gõ tên
  if (document.activeElement?.dataset?.user) return;
  clearTimeout(viewersTimer);
  viewersTimer = setTimeout(renderViewers, 300);
};
// Trạng thái (🟢🟡⚪) thay đổi theo thời gian: vẽ lại mỗi 30 giây
setInterval(renderViewersSoon, 30000);

// ---------- Nhạc nền ----------
let music = null;
const musicCmd = (cmd, extra = {}) => server.send({ type: 'music', cmd, ...extra });
$('mPrev').onclick = () => musicCmd('prev');
$('mNext').onclick = () => musicCmd('next');
$('mToggle').onclick = () => musicCmd('toggle');
$('mShuffle').onchange = (e) => musicCmd('shuffle', { on: e.target.checked });
$('mVol').oninput = (e) => {
  $('mVolOut').textContent = `${Math.round(e.target.value * 100)}%`;
  musicCmd('volume', { volume: Number(e.target.value) });
};
$('musicFile').onchange = async (e) => {
  const files = [...e.target.files];
  for (const [i, f] of files.entries()) {
    $('musicNow').textContent = `Đang tải ${i + 1}/${files.length}: ${f.name}…`;
    try {
      const res = await fetch(`/api/music?name=${encodeURIComponent(f.name)}`, { method: 'POST', headers: { 'Content-Type': 'audio/mpeg' }, body: f });
      if (!res.ok) throw new Error((await res.json()).error);
    } catch (err) {
      alert(`Không tải được ${f.name}: ${err.message}`);
    }
  }
  e.target.value = '';
  if (music) renderMusic(music);
};

function renderMusic(m) {
  music = m;
  const track = m.tracks[m.index];
  $('musicNow').textContent = track ? `${m.playing ? '▶ Đang phát' : '⏸ Tạm dừng'}: ${track.name}` : 'Chưa có bài nào. Tải file MP3 bạn có quyền sử dụng.';
  $('mToggle').textContent = m.playing ? '⏸ Tạm dừng' : '▶ Phát';
  $('mShuffle').checked = m.shuffle;
  if (document.activeElement !== $('mVol')) $('mVol').value = m.volume;
  $('mVolOut').textContent = `${Math.round(m.volume * 100)}%`;
  $('musicList').replaceChildren(...m.tracks.map((t, i) => {
    const li = document.createElement('li');
    if (i === m.index) li.className = 'now';
    const play = Object.assign(document.createElement('button'), { type: 'button', className: 'small', textContent: '▶', title: `Phát ${t.name}` });
    play.onclick = () => musicCmd('select', { index: i });
    const del = Object.assign(document.createElement('button'), { type: 'button', className: 'small', textContent: '✕', title: `Xoá ${t.name}` });
    del.onclick = async () => {
      if (confirm(`Xoá bài "${t.name}"?`)) await fetch(`/api/music/${encodeURIComponent(t.file)}`, { method: 'DELETE' });
    };
    li.append(Object.assign(document.createElement('span'), { textContent: `${i + 1}. ${t.name}` }), play, del);
    return li;
  }));
}

// ---------- Đoàn khách hàng audit ----------
let logos = {};
// Giống logoSlug ở máy chủ: "Kinh Đô" -> "kinh-do"
const logoSlug = (team) => String(team).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// Thêm / xoá công ty ngay trên dashboard
const saveTeams = (teams) => server.send({ type: 'settings', patch: { auditTeams: teams } });
$('addTeamForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('newTeam').value.trim().toUpperCase();
  if (!name) return;
  if (settings.auditTeams.some((t) => t.toUpperCase() === name)) return alert(`${name} đã có trong danh sách`);
  saveTeams([...settings.auditTeams, name]);
  $('newTeam').value = '';
});

async function uploadLogo(team, f, labelNode) {
  if (!f) return;
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) return alert('Chỉ nhận ảnh PNG, JPG, WEBP hoặc SVG');
  if (labelNode) labelNode.textContent = 'Đang tải…';
  try {
    const res = await fetch(`/api/logo/${encodeURIComponent(team)}`, { method: 'POST', headers: { 'Content-Type': f.type }, body: f });
    if (!res.ok) throw new Error((await res.json()).error);
  } catch (err) {
    alert(`Không tải được logo ${team}: ${err.message}`);
    if (labelNode) labelNode.textContent = 'Tải logo';
  }
}

// Link ảnh (Copy image address): nhờ máy chủ tải về
async function logoFromUrl(team, url) {
  try {
    const res = await fetch(`/api/logo-url/${encodeURIComponent(team)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
  } catch (err) {
    alert(`Không lấy được logo ${team} từ link: ${err.message}`);
  }
}
const isUrl = (t) => /^https?:\/\/\S+$/i.test(String(t).trim());

// Nút 📋 Dán: đọc clipboard (ảnh hoặc link ảnh). Lần đầu Chrome hỏi quyền đọc clipboard.
async function pasteFromClipboard(team, btn) {
  const label = btn.textContent;
  btn.textContent = 'Đang dán…';
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => /^image\/(png|jpeg|webp|svg\+xml)$/.test(t));
      if (type) return await uploadLogo(team, new File([await item.getType(type)], 'logo', { type }));
    }
    for (const item of items) {
      for (const type of ['text/plain', 'text/uri-list', 'text/html']) {
        if (!item.types.includes(type)) continue;
        const text = await (await item.getType(type)).text();
        const url = type === 'text/html' ? text.match(/<img[^>]+src="([^"]+)"/i)?.[1] : text.trim().split('\n')[0];
        if (url && isUrl(url)) return await logoFromUrl(team, url.trim());
      }
    }
    alert('Clipboard chưa có ảnh. Trên trang web: chuột phải vào logo → "Copy Image" (Sao chép hình ảnh) rồi bấm 📋 Dán lại.');
  } catch (err) {
    alert(`Không đọc được clipboard (${err.message}). Hãy bấm "Allow" khi Chrome hỏi quyền, hoặc rê chuột lên hàng rồi nhấn Ctrl+V / ⌘V.`);
  } finally {
    btn.textContent = label;
  }
}

// Ctrl+V / ⌘V: dán vào hàng đang rê chuột (hoặc ô logo đang chọn)
let hoverTeam = null;
document.addEventListener('paste', (e) => {
  const team = document.activeElement?.closest?.('.paste-target')?.dataset.team ?? hoverTeam;
  if (!team || document.activeElement?.matches?.('input, textarea')) return;
  const files = [...(e.clipboardData?.items ?? [])].filter((i) => i.kind === 'file' && i.type.startsWith('image/'));
  const text = e.clipboardData?.getData('text/plain') ?? '';
  const html = e.clipboardData?.getData('text/html') ?? '';
  const htmlImg = html.match(/<img[^>]+src="([^"]+)"/i)?.[1];
  e.preventDefault();
  if (files.length) return uploadLogo(team, files[0].getAsFile());
  if (isUrl(text)) return logoFromUrl(team, text.trim());
  if (htmlImg && isUrl(htmlImg)) return logoFromUrl(team, htmlImg);
  alert('Clipboard chưa có ảnh. Trên trang web: chuột phải vào logo → "Copy Image" rồi dán lại.');
});

let auditVisits = {};
function renderAuditButtons(teams) {
  // Đoàn chưa đến lên đầu, đoàn vừa vào gần nhất xuống cuối
  const sorted = [...teams].sort((a, b) => (auditVisits[a] ?? 0) - (auditVisits[b] ?? 0));
  $('auditButtons').replaceChildren(...sorted.map((team) => {
    const row = Object.assign(document.createElement('div'), { className: 'audit-row' });
    const url = logos[logoSlug(team)];
    const logo = url
      ? Object.assign(document.createElement('img'), { src: url, alt: `Logo ${team}`, className: 'audit-logo' })
      : Object.assign(document.createElement('span'), { className: 'audit-logo empty', textContent: 'Chưa có logo' });
    const name = Object.assign(document.createElement('b'), { textContent: team });
    const visit = Object.assign(document.createElement('small'), { className: 'ago visit' });
    visit.dataset.at = auditVisits[team] ?? '';
    visit.textContent = auditVisits[team] ? `vào lần cuối ${timeAgo(auditVisits[team]).replace('🕒 ', '')}` : 'Chưa đến';
    name.append(visit);

    const upload = Object.assign(document.createElement('label'), { className: 'small upload', textContent: url ? 'Đổi logo' : 'Tải logo' });
    const file = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/svg+xml', hidden: true });
    file.onchange = () => uploadLogo(team, file.files[0], upload.firstChild);
    upload.append(file);
    // Bấm vào ô logo rồi Ctrl+V / ⌘V để dán ảnh; hoặc kéo thả file ảnh vào ô
    logo.tabIndex = 0;
    logo.title = 'Bấm vào đây rồi Ctrl+V để dán logo, hoặc kéo thả ảnh vào';
    logo.dataset.team = team;
    logo.classList.add('paste-target');
    logo.addEventListener('dragover', (e) => { e.preventDefault(); logo.classList.add('drag'); });
    logo.addEventListener('dragleave', () => logo.classList.remove('drag'));
    logo.addEventListener('drop', (e) => {
      e.preventDefault();
      logo.classList.remove('drag');
      uploadLogo(team, [...e.dataTransfer.files].find((f) => f.type.startsWith('image/')), upload.firstChild);
    });

    const invite = Object.assign(document.createElement('button'), { type: 'button', className: 'small primary', textContent: 'Mời vào' });
    invite.onclick = () => server.send({ type: 'audit', team });
    const remove = Object.assign(document.createElement('button'), { type: 'button', className: 'small', textContent: '✕', title: `Xoá ${team}` });
    remove.onclick = () => {
      if (confirm(`Xoá ${team} khỏi danh sách đoàn audit?`)) saveTeams(settings.auditTeams.filter((t) => t !== team));
    };
    const paste = Object.assign(document.createElement('button'), { type: 'button', className: 'small', textContent: '📋 Dán', title: `Dán logo ${team} từ clipboard` });
    paste.onclick = () => pasteFromClipboard(team, paste);
    row.addEventListener('mouseenter', () => (hoverTeam = team));
    row.addEventListener('mouseleave', () => { if (hoverTeam === team) hoverTeam = null; });
    row.append(logo, name, paste, upload, invite, remove);
    return row;
  }));
}

// Nút Chặn ↔ Bỏ chặn trên mỗi bình luận
function paintBlock(btn) {
  const blocked = settings?.blockedUsers?.includes(btn.dataset.user);
  btn.textContent = blocked ? 'Bỏ chặn' : 'Chặn';
  btn.title = `${blocked ? 'Bỏ chặn' : 'Chặn'} @${btn.dataset.user}`;
  btn.classList.toggle('unblock', Boolean(blocked));
}

// ---------- Cài đặt ----------
function setSettings(s) {
  settings = s;
  document.querySelectorAll('.feed .block').forEach(paintBlock);
  if (typeof renderViewersSoon === 'function') renderViewersSoon();
  renderAuditButtons(s.auditTeams ?? []);
  for (const form of forms) {
    for (const el of form.elements) {
      if (!el.name || !(el.name in s) || el === document.activeElement) continue;
      const v = s[el.name];
      if (el.type === 'checkbox') el.checked = v;
      else if (Array.isArray(v)) el.value = v.join('\n');
      else el.value = v;
    }
  }
  updateOutputs();
}

function updateOutputs() {
  for (const out of document.querySelectorAll('output[data-for]')) {
    const el = document.querySelector(`[name="${out.dataset.for}"]`);
    out.textContent = el.name === 'bgOpacity' ? `${Math.round(el.value * 100)}%` : el.value;
  }
}

let saveTimer;
function readForm(form) {
  const patch = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    patch[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'range' || el.type === 'number' ? Number(el.value) : el.value;
  }
  return patch;
}
for (const form of forms) {
  form.addEventListener('submit', (e) => e.preventDefault());
  form.addEventListener('input', () => {
    updateOutputs();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => server.send({ type: 'settings', patch: Object.assign({}, ...forms.map(readForm)) }), 250);
  });
}

// ---------- Xem trước ----------
const preview = document.querySelector('.preview');
const frame = preview.firstElementChild;
const frameSel = $('frameSel');
let frameW = 1080;
function applyFrame() {
  const [w, h] = frameSel.value.split('x').map(Number);
  frameW = w;
  Object.assign(frame.style, { width: `${w}px`, height: `${h}px` });
  preview.classList.toggle('portrait', h > w);
  fitFrame();
  try { localStorage.setItem('frame', frameSel.value); } catch {}
}
try { frameSel.value = localStorage.getItem('frame') || frameSel.value; } catch {}
frameSel.onchange = applyFrame;
applyFrame();
function fitFrame() {
  frame.style.transform = `scale(${preview.clientWidth / frameW})`;
}
new ResizeObserver(fitFrame).observe(preview);

// ---------- Giao diện overlay + URL cho OBS ----------
// Link cho OBS / LIVE Studio luôn kèm ?an-toan=0.75: thu khung lại để điện thoại không cắt mất mép
const SAFE_PARAM = 'an-toan=0.75';
const withSafe = (url) => `${url}${url.includes('?') ? '&' : '?'}${SAFE_PARAM}`;
const themeSel = $('themeSel');
let overlayUrl;
let tunnelBase = null; // https://….trycloudflare.com nếu đường hầm đang chạy
function applyTheme() {
  const path = themeSel.value;
  overlayUrl = withSafe(`${location.origin}${path}`);
  $('overlayUrl').textContent = overlayUrl;
  renderTunnel();
  loadPreview();
  try { localStorage.setItem('theme', path); } catch {}
}
// Xem trước = chạy thêm một overlay đầy đủ trong Chrome (nặng): mặc định tắt, tự dỡ khi ẩn tab dashboard
let previewOn = false;
try { previewOn = localStorage.getItem('previewOn') === '1'; } catch {}
function loadPreview() {
  const show = previewOn && !document.hidden;
  const src = show ? `${themeSel.value}${themeSel.value.includes('?') ? '&' : '?'}preview` : 'about:blank';
  if (frame.getAttribute('src') !== src) frame.src = src;
  preview.classList.toggle('off', !previewOn);
  $('previewBtn').classList.toggle('on', previewOn);
  $('previewBtn').textContent = previewOn ? '👁 Đang xem trước' : '👁 Xem trước';
}
$('previewBtn').onclick = () => {
  previewOn = !previewOn;
  try { localStorage.setItem('previewOn', previewOn ? '1' : '0'); } catch {}
  loadPreview();
};
document.addEventListener('visibilitychange', loadPreview);
try { themeSel.value = localStorage.getItem('theme') || themeSel.value; } catch {}
if (!themeSel.value) themeSel.selectedIndex = 0;
themeSel.onchange = applyTheme;
applyTheme();
async function copyText(btn, text, label) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Đã sao chép';
  } catch {
    btn.textContent = 'Hãy chép thủ công';
  }
  setTimeout(() => (btn.textContent = label), 1500);
}
$('copyBtn').onclick = () => copyText($('copyBtn'), overlayUrl, 'Sao chép URL cho OBS');

// ---------- Link Cloudflare cho TikTok LIVE Studio (Add link chỉ nhận https) ----------
function renderTunnel() {
  const link = tunnelBase ? withSafe(`${tunnelBase}${themeSel.value}`) : '';
  $('tunnelRow').hidden = !tunnelBase;
  $('tunnelHint').hidden = Boolean(tunnelBase);
  $('tunnelUrl').textContent = link;
}
async function loadTunnel() {
  try {
    tunnelBase = (await (await fetch('/api/tunnel')).json()).url;
  } catch {
    tunnelBase = null;
  }
  renderTunnel();
}
$('copyTunnelBtn').onclick = () => copyText($('copyTunnelBtn'), $('tunnelUrl').textContent, 'Sao chép link LIVE Studio');
loadTunnel();
setInterval(loadTunnel, 15000); // đường hầm chạy lại thì địa chỉ đổi: tự cập nhật

// ---------- Quà nhận được: tổng xu + ước tính tiền ----------
let gifts = [];
let giftScope = 'session';
// Giờ bắt đầu phiên LIVE gần nhất (giữ lại sau khi tắt LIVE để vẫn xem được tổng phiên vừa rồi)
const SESSION_KEY = 'giftSessionStart';
var sessionStart = null;
try { sessionStart = Number(localStorage.getItem(SESSION_KEY)) || null; } catch {}
const RATE_KEY = 'giftRateVnd';
try { const r = Number(localStorage.getItem(RATE_KEY)); if (r > 0) $('giftRate').value = r; } catch {}
const fmtNum = (n) => Math.round(n).toLocaleString('vi-VN');
function renderGifts() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const from = giftScope === 'session' ? (sessionStart ?? start.getTime()) : giftScope === 'today' ? start.getTime() : 0;
  const list = gifts.filter((g) => g.at >= from);
  const coins = list.reduce((s, g) => s + (g.coins || 0), 0);
  const rate = Number($('giftRate').value) || 0;
  $('giftCoins').textContent = fmtNum(coins);
  $('giftVnd').textContent = `${fmtNum(coins * rate)} ₫`;
  // Tiêu đề tab trình duyệt hiện số tiền ước tính, nhìn tab là biết
  document.title = `${fmtNum(coins * rate)} ₫ · Live Comment Studio`;
  $('giftCount').textContent = fmtNum(list.length);
  // Top người tặng
  const by = new Map();
  for (const g of list) by.set(g.username, { name: g.nickname || g.username, coins: (by.get(g.username)?.coins ?? 0) + (g.coins || 0) });
  const medals = ['🥇', '🥈', '🥉'];
  $('giftTop').replaceChildren(...[...by.values()].sort((a, b) => b.coins - a.coins).slice(0, 5)
    .map((u, i) => Object.assign(document.createElement('span'), { textContent: `${medals[i] ?? '🎁'} ${u.name} · ${fmtNum(u.coins)} xu` })));
  $('giftList').replaceChildren(...list.slice(-200).reverse().map((g) => {
    const li = document.createElement('li');
    const d = new Date(g.at);
    li.append(
      Object.assign(document.createElement('span'), { className: 't', textContent: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }),
      Object.assign(document.createElement('span'), { className: 'n', textContent: `@${g.username} tặng ${g.gift} x${g.count}` }),
      Object.assign(document.createElement('span'), { className: 'c', textContent: `${fmtNum(g.coins)} xu` }),
    );
    return li;
  }));
  $('giftEmpty').hidden = list.length > 0;
}
$('giftRate').oninput = () => {
  try { localStorage.setItem(RATE_KEY, $('giftRate').value); } catch {}
  renderGifts();
};
const GIFT_SCOPES = [['giftSession', 'session'], ['giftToday', 'today'], ['giftAll', 'all']];
for (const [id, scope] of GIFT_SCOPES) {
  $(id).onclick = () => {
    giftScope = scope;
    for (const [other, sc] of GIFT_SCOPES) $(other).classList.toggle('on', sc === scope);
    renderGifts();
  };
}
