// Kết nối TikTok LIVE bằng username (thư viện không chính thức tiktok-live-connector),
// chuẩn hóa dữ liệu bình luận và tự kết nối lại khi mất mạng (có giới hạn số lần).
import { EventEmitter } from 'node:events';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const MAX_RETRIES = 5;

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
      signApiKey: process.env.EULER_API_KEY || undefined,
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
    conn.on(WebcastEvent.ROOM_USER, (data) => {
      const viewers = Number(data.total ?? data.viewerCount);
      if (Number.isFinite(viewers)) this.emit('viewers', viewers);
    });
    conn.on(WebcastEvent.STREAM_END, () => {
      this.manualStop = true;
      this.#setStatus('ended', 'Phiên LIVE đã kết thúc');
    });
    conn.on(ControlEvent.DISCONNECTED, () => {
      if (this.conn === conn && !this.manualStop) this.#scheduleRetry('Mất kết nối');
    });
    conn.on(ControlEvent.ERROR, (err) => console.error('[tiktok]', err?.message ?? err));

    try {
      const state = await conn.connect();
      if (this.conn !== conn) return; // đã bị thay thế trong lúc chờ
      this.retries = 0;
      this.#setStatus('connected', `Đang nhận dữ liệu từ @${this.username} (room ${state.roomId})`);
    } catch (err) {
      if (this.conn !== conn) return;
      const msg = String(err?.message ?? err);
      if (err?.name === 'UserOfflineError' || /offline|not.*live|isn't online/i.test(msg)) {
        this.manualStop = true;
        return this.#setStatus('error', `@${this.username} hiện không LIVE`);
      }
      this.#scheduleRetry(`Lỗi kết nối: ${msg}`);
    }
  }

  #scheduleRetry(reason) {
    if (this.retries >= MAX_RETRIES) {
      this.manualStop = true;
      return this.#setStatus('error', `${reason}. Đã thử lại ${MAX_RETRIES} lần. Kiểm tra username có đúng và đang LIVE không, rồi bấm Kết nối lại.`);
    }
    this.retries += 1;
    const delay = Math.min(30, 2 ** this.retries) * 1000; // 2s, 4s, 8s, 16s, 30s
    this.#setStatus('reconnecting', `${reason}. Thử lại lần ${this.retries}/${MAX_RETRIES} sau ${delay / 1000}s...`);
    this.retryTimer = setTimeout(() => {
      if (!this.manualStop) this.#open();
    }, delay);
  }
}
