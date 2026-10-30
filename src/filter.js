// Bộ lọc bình luận: từ khóa cấm, người dùng bị chặn, link, spam và trùng lặp.
// Trả về null nếu hợp lệ, hoặc chuỗi lý do bị loại.

// Bỏ dấu tiếng Việt để "ngu" chặn được cả "ngú", "NGU"...
export function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|vn|io|me|ly|xyz|shop)\b)/i;

export class CommentFilter {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.recentTexts = new Map(); // text đã chuẩn hóa -> thời điểm
    this.lastByUser = new Map();  // username -> thời điểm bình luận hợp lệ gần nhất
  }

  check(comment, settings) {
    const t = this.now();
    const user = comment.username.toLowerCase();
    const text = normalize(comment.text);

    if (!text) return 'Trống';
    if (settings.blockedUsers.includes(user)) return 'Người dùng bị chặn';
    if (comment.text.length > settings.maxLength) return 'Quá dài';
    if (settings.blockLinks && LINK_RE.test(comment.text)) return 'Chứa link';
    if (/(.)\1{7,}/u.test(text)) return 'Spam ký tự';

    const padded = ` ${text} `;
    for (const word of settings.blockedWords) {
      const w = normalize(word);
      // Cụm nhiều từ: khớp chuỗi con; một từ: khớp nguyên từ (tránh "ngu" chặn nhầm "nguyen")
      if (w && (w.includes(' ') ? text.includes(w) : padded.includes(` ${w} `))) {
        return `Từ khóa cấm: ${word}`;
      }
    }

    this.#prune(t, settings);

    if (settings.userCooldownSec > 0) {
      const last = this.lastByUser.get(user);
      if (last !== undefined && t - last < settings.userCooldownSec * 1000) return 'Gửi quá nhanh';
    }
    if (settings.dupWindowSec > 0) {
      const last = this.recentTexts.get(text);
      if (last !== undefined && t - last < settings.dupWindowSec * 1000) return 'Trùng lặp';
    }

    this.lastByUser.set(user, t);
    this.recentTexts.set(text, t);
    return null;
  }

  #prune(t, settings) {
    if (this.recentTexts.size < 2000 && this.lastByUser.size < 2000) return;
    const keep = Math.max(settings.dupWindowSec, settings.userCooldownSec) * 1000;
    for (const [k, v] of this.recentTexts) if (t - v > keep) this.recentTexts.delete(k);
    for (const [k, v] of this.lastByUser) if (t - v > keep) this.lastByUser.delete(k);
  }
}
