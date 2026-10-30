import { connectWS, initials } from '/ws-client.js';

const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat('vi-VN');
const FEED_SIZE = 200;
const forms = [$('displayForm'), $('filterForm')];
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
      setSettings(msg.settings);
      demo = msg.demo;
      setStatus(msg.status);
      // Lấy username từ máy chủ, không dùng giá trị trình duyệt tự khôi phục khi tải lại trang
      if (document.activeElement !== $('username')) $('username').value = msg.status.username || msg.settings.username;
      // Mở / F5 dashboard thì tự kết nối nếu chưa kết nối (hoặc lần trước bị lỗi)
      if (!['connected', 'connecting', 'reconnecting'].includes(msg.status.state) && $('username').value) {
        server.send({ type: 'connect', username: $('username').value });
      }
      break;
    case 'comment': addComment(msg.comment); break;
    case 'stats': setStats(msg.stats); break;
    case 'status': setStatus(msg.status); break;
    case 'settings': setSettings(msg.settings); break;
    case 'demo': demo = msg.demo; setStatus(status); break;
  }
}

// ---------- Kết nối ----------
$('connectForm').addEventListener('submit', (e) => {
  e.preventDefault();
  server.send({ type: 'connect', username: $('username').value });
});
$('disconnectBtn').onclick = () => server.send({ type: 'disconnect' });
$('demoBtn').onclick = () => server.send({ type: 'demo', on: !demo });
$('clearBtn').onclick = () => server.send({ type: 'clear' });
$('clearMembersBtn').onclick = () => server.send({ type: 'clearMembers' });

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
}

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
  body.append(name, Object.assign(document.createElement('div'), { className: 'text', textContent: c.text }));

  const block = Object.assign(document.createElement('button'), { type: 'button', className: 'block small', textContent: 'Chặn' });
  block.title = `Chặn @${c.username}`;
  block.onclick = () => {
    const users = new Set(settings.blockedUsers);
    users.add(c.username.toLowerCase());
    server.send({ type: 'settings', patch: { blockedUsers: [...users] } });
  };

  li.append(avatar, body, block);
  const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40;
  feed.append(li);
  while (feed.children.length > FEED_SIZE) feed.firstElementChild.remove();
  if (atBottom) feed.scrollTop = feed.scrollHeight;
  $('feedEmpty').hidden = true;
}

// ---------- Cài đặt ----------
function setSettings(s) {
  settings = s;
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
    saveTimer = setTimeout(() => server.send({ type: 'settings', patch: { ...readForm(forms[0]), ...readForm(forms[1]) } }), 250);
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
const themeSel = $('themeSel');
let overlayUrl;
function applyTheme() {
  const path = themeSel.value;
  overlayUrl = `${location.origin}${path}`;
  $('overlayUrl').textContent = overlayUrl;
  frame.src = `${path}${path.includes('?') ? '&' : '?'}preview`;
  try { localStorage.setItem('theme', path); } catch {}
}
try { themeSel.value = localStorage.getItem('theme') || themeSel.value; } catch {}
if (!themeSel.value) themeSel.selectedIndex = 0;
themeSel.onchange = applyTheme;
applyTheme();
$('copyBtn').onclick = async () => {
  try {
    await navigator.clipboard.writeText(overlayUrl);
    $('copyBtn').textContent = 'Đã sao chép';
  } catch {
    $('copyBtn').textContent = 'Hãy chép thủ công';
  }
  setTimeout(() => ($('copyBtn').textContent = 'Sao chép URL cho OBS'), 1500);
};
