// Trò chơi "bản đồ quê": người xem bình luận tên tỉnh để nhận quê, sau đó mỗi tim +1 điểm, mỗi xu quà +50 điểm cho tỉnh đó.
// Quê của từng người giữ qua các buổi LIVE; điểm các tỉnh giữ tới khi bấm xoá trên dashboard.
import fs from 'node:fs';
import path from 'node:path';
import { detectProvince, PROVINCE_BY_ID } from '../public/provinces.js';

const FANS_MAX = 300; // số người góp điểm giữ lại cho mỗi tỉnh
export const GIFT_POINTS_PER_COIN = 50;    // tặng quà: 1 xu = +50 điểm cho quê
export const MILESTONES = [50, 100, 500];  // mốc điểm của một tỉnh: overlay ăn mừng khi vượt qua

export class QueGame {
  constructor(file = null) {
    this.file = file;
    this.hometowns = {}; // username -> { id, nickname }
    this.scores = {};    // mã tỉnh -> điểm
    this.fans = {};      // mã tỉnh -> { username: điểm đã góp }
    this.saveTimer = null;
    if (file) {
      try {
        const d = JSON.parse(fs.readFileSync(file, 'utf8'));
        this.hometowns = d.hometowns ?? {};
        this.scores = d.scores ?? {};
        this.fans = d.fans ?? {};
      } catch {}
    }
  }

  // Bình luận có tên tỉnh → nhận (hoặc đổi) quê. Trả về { id, changed, isNew } hoặc null (isNew: lần đầu nhận quê).
  claim(person, text) {
    const id = detectProvince(text);
    if (!id || !person?.username) return null;
    const isNew = !this.hometowns[person.username];
    const changed = this.hometowns[person.username]?.id !== id;
    this.hometowns[person.username] = { id, nickname: person.nickname ?? person.username };
    if (changed) this.#saveSoon();
    return { id, changed, isNew };
  }

  // Thả tim / tặng quà: chỉ tính khi người đó đã nhận quê. Trả về { id, add, total, fan, milestones } hoặc null.
  like(person, count = 1) {
    const home = this.hometowns[person?.username];
    const add = Math.max(0, Math.floor(Number(count) || 0));
    if (!home || !add) return null;
    const { id } = home;
    const before = this.scores[id] ?? 0;
    this.scores[id] = before + add;
    const fans = (this.fans[id] ??= {});
    fans[person.username] = (fans[person.username] ?? 0) + add;
    if (Object.keys(fans).length > FANS_MAX) {
      const weakest = Object.entries(fans).sort((a, b) => a[1] - b[1])[0][0];
      if (weakest !== person.username) delete fans[weakest];
    }
    this.#saveSoon();
    const total = this.scores[id];
    return { id, add, total, fan: this.topFan(id), milestones: MILESTONES.filter((m) => before < m && total >= m) };
  }

  topFan(id) {
    const best = Object.entries(this.fans[id] ?? {}).sort((a, b) => b[1] - a[1])[0];
    return best ? { username: best[0], nickname: this.hometowns[best[0]]?.nickname ?? best[0], points: best[1] } : null;
  }

  // Trạng thái gửi overlay: điểm, số người nhận quê và người góp nhiều nhất của từng tỉnh
  snapshot() {
    const people = {};
    for (const h of Object.values(this.hometowns)) people[h.id] = (people[h.id] ?? 0) + 1;
    const provinces = {};
    for (const id of new Set([...Object.keys(this.scores), ...Object.keys(people)])) {
      if (!PROVINCE_BY_ID.has(id)) continue;
      provinces[id] = { score: this.scores[id] ?? 0, people: people[id] ?? 0, fan: this.topFan(id) };
    }
    return { provinces };
  }

  // Xoá điểm để bắt đầu ván mới (giữ quê đã nhận)
  resetScores() {
    this.scores = {};
    this.fans = {};
    this.#saveSoon();
  }

  #saveSoon() {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => this.save(), 2000);
  }

  save() {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify({ hometowns: this.hometowns, scores: this.scores, fans: this.fans }));
  }
}
