// Kết nối TikTok LIVE bằng username (thư viện không chính thức tiktok-live-connector),
// chuẩn hóa dữ liệu bình luận và tự kết nối lại khi mất mạng (có giới hạn số lần).
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { TikTokLiveConnection, WebcastEvent, ControlEvent, SignConfig } from 'tiktok-live-connector';

// Nhớ mã phòng của lần kết nối thành công gần nhất: kết nối lại vào thẳng phòng,
// bỏ qua bước dò mã phòng (TikTok hay chặn tạm thời khi dò nhiều lần)
const ROOM_FILE = path.resolve('data', 'last-room.json');
const readRooms = () => { try { return JSON.parse(fs.readFileSync(ROOM_FILE, 'utf8')); } catch { return {}; } };
// API key Euler Stream (máy chủ ký): biến môi trường EULER_API_KEY hoặc dán vào file data/euler-key.txt.
// Đọc lại mỗi lần kết nối nên dán key xong không cần khởi động lại.
const KEY_FILE = path.resolve('data', 'euler-key.txt');
function signApiKey() {
  let key = process.env.EULER_API_KEY;
  if (!key) try { key = fs.readFileSync(KEY_FILE, 'utf8').trim() || undefined; } catch {}
  // Thư viện giữ sẵn một client máy chủ ký; đổi key thì bỏ client cũ để key mới có hiệu lực ngay
  if (key && SignConfig.apiKey !== key) SignConfig.cachedInstance = undefined;
  return key;
}
function saveRoom(username, roomId) {
  const rooms = readRooms();
  if (roomId) rooms[username] = String(roomId);
  else delete rooms[username];
  fs.mkdirSync(path.dirname(ROOM_FILE), { recursive: true });
  fs.writeFileSync(ROOM_FILE, JSON.stringify(rooms));
}

// Giá xu một số quà phổ biến, dùng khi TikTok không gửi kèm
// (bảng quà đầy đủ của TikTok cần gói Euler trả phí). Quà lạ tính tối thiểu 1 xu; log in mã quà để bổ sung.
const KNOWN_GIFTS = [
  [5655, { coins: 1, combo: true, name: 'Rose' }],
  [8913, { coins: 10, combo: true, name: 'Rosa' }],
  [5269, { coins: 1, combo: true, name: 'TikTok' }],
  [6064, { coins: 1, combo: true, name: 'GG' }],
  [5827, { coins: 1, combo: true, name: 'Ice Cream Cone' }],
  [5487, { coins: 5, combo: true, name: 'Finger Heart' }],
  [5658, { coins: 20, combo: true, name: 'Perfume' }],
  [5879, { coins: 30, combo: true, name: 'Doughnut' }],
];

const OFFLINE_RECHECK_SEC = 30; // kênh chưa LIVE / vừa tắt LIVE: kiểm tra lại định kỳ
const RATE_LIMIT_RECHECK_SEC = 10 * 60; // máy chủ ký báo hết lượt trong ngày: thử lại 10 phút/lần

export function cleanUsername(input) {
  const s = String(input ?? '').trim();
  const fromUrl = s.match(/tiktok\.com\/@([^/?#]+)/i);
  return (fromUrl ? fromUrl[1] : s).replace(/^@/, '').trim();
}

function avatarOf(user) {
  const pic = user?.profilePicture ?? user?.avatarThumb;
  const url = pic?.url?.[0] ?? pic?.urls?.[0] ?? pic?.urlList?.[0] ?? pic?.urlListList?.[0];
  return typeof url === 'string' && url.startsWith('https://') ? url : null;
}

// Hỗ trợ cả hai dạng dữ liệu: bản cũ (uniqueId, comment) và bản 2.5+ (displayId, content)
export function toUser(user = {}) {
  const username = String(user.uniqueId || user.displayId || user.nickname || 'unknown');
  return { username, nickname: String(user.nickname || username), avatar: avatarOf(user) };
}

export function toComment(data) {
  return {
    id: String(data.common?.msgId ?? data.msgId ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`),
    ...toUser(data.user),
    text: String(data.comment ?? data.content ?? '').trim(),
    at: Date.now(),
    createdAt: Number(data.common?.createTime) || Date.now(),
  };
}

export class TikTokSource extends EventEmitter {
  constructor() {
    super();
    this.conn = null;
    this.username = null;
    this.manualStop = true;
    this.retries = 0;
    this.retryTimer = null;
    this.status = { state: 'idle', message: 'Chưa kết nối' };
  }

  #setStatus(state, message) {
    this.status = { state, message, username: this.username, retries: this.retries };
    this.emit('status', this.status);
  }

  async connect(rawUsername) {
    const username = cleanUsername(rawUsername);
    if (!username) return this.#setStatus('error', 'Hãy nhập username TikTok');
    await this.disconnect();
    this.username = username;
    this.manualStop = false;
    this.retries = 0;
    this.#open();
  }

  async disconnect() {
    this.manualStop = true;
    clearTimeout(this.retryTimer);
    const conn = this.conn;
    this.conn = null;
    if (conn) {
      conn.removeAllListeners();
      await conn.disconnect().catch(() => {});
    }
    if (this.username) this.#setStatus('idle', 'Đã ngắt kết nối');
  }

  async #open() {
    this.#setStatus('connecting', `Đang kết nối @${this.username}...`);
    const conn = new TikTokLiveConnection(this.username, {
      signApiKey: signApiKey(),
      processInitialData: false, // không đẩy lại bình luận cũ lên màn hình
    });
    this.conn = conn;
    const openedAt = Date.now();

    conn.on(WebcastEvent.CHAT, (data) => {
      const c = toComment(data);
      // TikTok gửi kèm bình luận cũ ngay lúc kết nối: chỉ hiện trên dashboard, không đưa lên overlay
      if (c.createdAt < openedAt - 5000) c.old = true;
      if (c.text) this.emit('comment', c);
    });
    conn.on(WebcastEvent.MEMBER, (data) => {
      if (data.user) this.emit('member', { ...toUser(data.user), at: Date.now() });
    });
    // Hoạt động tính điểm chăm chỉ
    conn.on(WebcastEvent.LIKE, (data) => {
      if (data.user) this.emit('activity', { ...toUser(data.user), kind: 'like', count: Number(data.count ?? data.likeCount) || 1 });
    });
    // TikTok nhiều khi không gửi kèm thông tin quà (giá xu, loại quà) → tra bảng quà có sẵn. Không rõ loại thì coi là quà combo cho chắc (không bị tính trùng).
    const giftList = new Map(KNOWN_GIFTS); // mã quà -> { coins, combo, name }
    const giftInfo = (data) => {
      const d = data.giftDetails ?? {};
      const k = giftList.get(Number(data.giftId)) ?? {};
      return {
        coins: Number(d.diamondCount) || k.coins || 1,
        combo: d.giftType ? Number(d.giftType) === 1 : (k.combo ?? true),
        name: d.giftName || k.name || `quà lạ mã ${data.giftId}`,
      };
    };
    // Quà combo (vd. Hoa hồng) gửi nhiều tin trong một chuỗi: tính khi kết thúc chuỗi.
    // TikTok đôi khi không gửi tin kết thúc → chờ 4s không có tin mới thì tự tính; tin kết thúc đến muộn chỉ tính phần còn thiếu.
    const combos = new Map(); // người + mã quà -> { timer, data, done }
    const emitGift = (data, count) => {
      const g = giftInfo(data);
      const coins = g.coins * count; // số xu TikTok
      const u = toUser(data.user);
      console.log(`[quà] @${u.username} tặng ${g.name} x${count} = ${coins} xu`);
      this.emit('activity', { ...u, kind: 'gift', count, coins, gift: g.name });
    };
    conn.on(WebcastEvent.GIFT, (data) => {
      if (!data.user) return;
      const count = Number(data.repeatCount) || 1;
      if (!giftInfo(data).combo) return emitGift(data, count);
      const key = `${data.user.userId ?? toUser(data.user).username}:${data.giftId}`;
      const c = combos.get(key) ?? { done: 0 };
      clearTimeout(c.timer);
      const flush = () => {
        const extra = (Number(c.data.repeatCount) || 1) - c.done;
        if (extra > 0) emitGift(c.data, extra);
        c.done += Math.max(0, extra);
      };
      c.data = data;
      if (Number(data.repeatEnd) === 1) {
        flush();
        combos.delete(key);
        return;
      }
      if (count < c.done) c.done = 0; // chuỗi mới
      c.timer = setTimeout(() => { flush(); c.timer = setTimeout(() => combos.delete(key), 60000); }, 4000);
      combos.set(key, c);
    });
    conn.on(WebcastEvent.SHARE, (data) => {
      if (data.user) this.emit('activity', { ...toUser(data.user), kind: 'share', count: 1 });
    });
    conn.on(WebcastEvent.FOLLOW, (data) => {
      if (data.user) this.emit('activity', { ...toUser(data.user), kind: 'follow', count: 1 });
    });
    conn.on(WebcastEvent.ROOM_USER, (data) => {
      const viewers = Number(data.total ?? data.viewerCount);
      if (Number.isFinite(viewers)) this.emit('viewers', viewers);
      // Danh sách người xem TikTok đang hiện (Top viewers): chắc chắn đang ở trong phòng
      if (Array.isArray(data.ranks)) this.emit('roomRanks', data.ranks.filter((r) => r.user).map((r) => toUser(r.user)));
    });
    conn.on(WebcastEvent.STREAM_END, () => {
      // Hết phiên: chờ phiên LIVE mới thay vì dừng hẳn
      this.#scheduleRetry('Phiên LIVE đã kết thúc', OFFLINE_RECHECK_SEC, 'ended');
    });
    conn.on(ControlEvent.DISCONNECTED, () => {
      if (this.conn === conn && !this.manualStop) this.#scheduleRetry('Mất kết nối');
    });
    conn.on(ControlEvent.ERROR, (err) => console.error('[tiktok]', err?.message ?? err));

    const roomHint = readRooms()[this.username];
    try {
      const state = await conn.connect(roomHint);
      if (this.conn !== conn) return; // đã bị thay thế trong lúc chờ
      this.retries = 0;
      saveRoom(this.username, state.roomId);
      this.#setStatus('connected', `Đang nhận dữ liệu từ @${this.username} (room ${state.roomId})`);
    } catch (err) {
      if (this.conn !== conn) return;
      const msg = String(err?.message ?? err);
      // Phòng cũ không còn (LIVE mới có mã phòng mới): quên mã cũ, lần sau dò lại
      if (roomHint) saveRoom(this.username, null);
      if (err?.name === 'UserOfflineError' || /offline|not.*live|isn't online/i.test(msg)) {
        return this.#scheduleRetry(`@${this.username} hiện chưa LIVE`, OFFLINE_RECHECK_SEC, 'error');
      }
      // Hết lượt kết nối miễn phí trong ngày của máy chủ ký: thử lại thưa (10 phút/lần) để không đốt thêm lượt
      if (/rate.?limit/i.test(msg)) {
        return this.#scheduleRetry('Máy chủ ký TikTok báo hết lượt kết nối miễn phí hôm nay (thêm EULER_API_KEY để bỏ giới hạn)', RATE_LIMIT_RECHECK_SEC);
      }
      this.#scheduleRetry(`Lỗi kết nối: ${msg}`);
    }
  }

  // Thử lại không giới hạn (2s, 4s, 8s, 16s rồi 30s/lần) cho đến khi bấm Ngắt.
  // Máy chủ ký (Euler Stream) đôi khi lỗi tạm thời ("illegal web id", 500, quá giới hạn) — tự hồi phục.
  #scheduleRetry(reason, fixedSec = null, state = 'reconnecting') {
    clearTimeout(this.retryTimer);
    const conn = this.conn;
    this.conn = null;
    if (conn) {
      conn.removeAllListeners();
      conn.disconnect().catch(() => {});
    }
    this.retries += 1;
    const delay = (fixedSec ?? Math.min(30, 2 ** this.retries)) * 1000;
    this.#setStatus(state, `${reason}. Tự thử lại lần ${this.retries} sau ${delay / 1000}s...`);
    this.retryTimer = setTimeout(() => {
      if (!this.manualStop) this.#open();
    }, delay);
  }
}
