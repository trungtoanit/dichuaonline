import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve('data');
const FILE = path.join(DATA_DIR, 'settings.json');

export const DEFAULTS = {
  // Kênh TikTok điền sẵn trên dashboard, tự cập nhật theo lần kết nối gần nhất
  username: 'huyntrang140806',
  // Hiển thị
  maxVisible: 3,          // 1–5 bình luận cùng lúc
  durationSec: 8,         // 3–15 giây rồi tự biến mất
  queueMax: 50,           // hàng chờ tối đa, quá thì bỏ bình luận cũ nhất
  position: 'bottom-left',
  accent: '#2dd4bf',
  fontSize: 30,
  width: 760,
  bgOpacity: 0.85,
  showAvatar: true,
  // Lọc
  blockedWords: [],
  blockedUsers: [],
  dupWindowSec: 30,       // cùng nội dung trong khoảng này coi là trùng
  userCooldownSec: 2,     // mỗi người tối đa 1 bình luận / khoảng này
  maxLength: 150,
  blockLinks: true,
};

const POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

const clamp = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

const toList = (v) =>
  (Array.isArray(v) ? v : String(v ?? '').split(/[\n,]/))
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 500);

export function sanitize(input, base = DEFAULTS) {
  const s = { ...base, ...input };
  return {
    username: String(s.username ?? '').trim().replace(/^@/, '').slice(0, 64) || DEFAULTS.username,
    maxVisible: Math.round(clamp(s.maxVisible, 1, 5, DEFAULTS.maxVisible)),
    durationSec: clamp(s.durationSec, 3, 15, DEFAULTS.durationSec),
    queueMax: Math.round(clamp(s.queueMax, 5, 500, DEFAULTS.queueMax)),
    position: POSITIONS.includes(s.position) ? s.position : DEFAULTS.position,
    accent: /^#[0-9a-f]{6}$/i.test(s.accent) ? s.accent : DEFAULTS.accent,
    fontSize: Math.round(clamp(s.fontSize, 12, 48, DEFAULTS.fontSize)),
    width: Math.round(clamp(s.width, 240, 1200, DEFAULTS.width)),
    bgOpacity: clamp(s.bgOpacity, 0, 1, DEFAULTS.bgOpacity),
    showAvatar: Boolean(s.showAvatar),
    blockedWords: toList(s.blockedWords),
    blockedUsers: toList(s.blockedUsers).map((u) => u.replace(/^@/, '').toLowerCase()),
    dupWindowSec: clamp(s.dupWindowSec, 0, 600, DEFAULTS.dupWindowSec),
    userCooldownSec: clamp(s.userCooldownSec, 0, 120, DEFAULTS.userCooldownSec),
    maxLength: Math.round(clamp(s.maxLength, 10, 500, DEFAULTS.maxLength)),
    blockLinks: Boolean(s.blockLinks),
  };
}

export function loadSettings() {
  try {
    return sanitize(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch {
    return sanitize({});
  }
}

export function saveSettings(settings) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(settings, null, 2));
}
