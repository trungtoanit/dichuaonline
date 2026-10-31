// Điểm chăm chỉ và chức vụ trong nhà máy. Lưu ra file để chức vụ còn ở các buổi LIVE sau.
import fs from 'node:fs';
import path from 'node:path';

export const RANKS = [
  { min: 0, title: 'Học việc' },
  { min: 30, title: 'Công nhân' },
  { min: 100, title: 'Thợ đứng máy' },
  { min: 250, title: 'Tổ trưởng' },
  { min: 500, title: 'Trưởng ca' },
  { min: 1000, title: 'Quản đốc' },
  { min: 2000, title: 'Phó giám đốc' },
  { min: 4000, title: 'Giám đốc nhà máy' },
];

// Điểm cho từng hoạt động trên LIVE
export const POINTS = {
  comment: 10,
  like: 1,        // mỗi lượt tim
  likeMax: 30,    // tối đa mỗi lần TikTok gửi gộp
  gift: 50,       // mỗi món quà
  share: 20,
  follow: 30,
};

export const rankOf = (points) => {
  let level = 0;
  RANKS.forEach((r, i) => { if (points >= r.min) level = i; });
  return { level, title: RANKS[level].title, next: RANKS[level + 1]?.min ?? null };
};

export class Ranks {
  // file = null: chỉ giữ trong bộ nhớ (dùng cho người giả lập)
  constructor(file = path.resolve('data', 'ranks.json')) {
    this.file = file;
    this.users = new Map(); // username -> { username, nickname, avatar, points }
    this.saveTimer = null;
    if (file) try {
      for (const u of JSON.parse(fs.readFileSync(file, 'utf8'))) this.users.set(u.username, u);
    } catch {}
  }

  // Cộng điểm; trả về thông tin chức vụ và có vừa thăng chức không
  award(person, points) {
    const key = person.username;
    const u = this.users.get(key) ?? { username: key, points: 0 };
    const before = rankOf(u.points).level;
    u.points += points;
    u.nickname = person.nickname || u.nickname || key;
    if (person.avatar) u.avatar = person.avatar;
    this.users.set(key, u);
    this.#scheduleSave();
    const rank = rankOf(u.points);
    return { ...this.entry(u), promoted: rank.level > before };
  }

  // Đặt chức vụ: nâng điểm lên mốc của chức vụ đó (exact = true thì đặt đúng mốc, có thể hạ chức)
  setRank(person, title, exact = false) {
    const level = RANKS.findIndex((r) => r.title.toLowerCase() === String(title).toLowerCase());
    if (level < 0) throw new Error(`Không có chức vụ "${title}"`);
    const key = person.username;
    const u = this.users.get(key) ?? { username: key, points: 0 };
    u.points = exact ? RANKS[level].min : Math.max(u.points, RANKS[level].min);
    u.nickname = person.nickname || u.nickname || key;
    this.users.set(key, u);
    this.#scheduleSave();
    return this.entry(u);
  }

  entry(u) {
    const r = rankOf(u.points);
    return { username: u.username, nickname: u.nickname, avatar: u.avatar ?? null, points: u.points, level: r.level, title: r.title, next: r.next };
  }

  get(username) {
    const u = this.users.get(username);
    return u ? this.entry(u) : null;
  }

  top(n = 5) {
    return [...this.users.values()].sort((a, b) => b.points - a.points).slice(0, n).map((u) => this.entry(u));
  }

  // Chức vụ của những người đang có mặt (gửi kèm khi overlay mới mở)
  pick(usernames) {
    const out = {};
    for (const name of usernames) {
      const e = this.get(name);
      if (e) out[name] = e;
    }
    return out;
  }

  #scheduleSave() {
    if (!this.file) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 3000);
  }

  save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify([...this.users.values()], null, 1));
  }
}
