// Hàng đợi hiển thị: tối đa `maxVisible` bình luận trên màn hình,
// mỗi bình luận tự biến mất sau `durationSec`, bình luận mới chờ đến lượt.
import { EventEmitter } from 'node:events';

export class DisplayQueue extends EventEmitter {
  constructor(getSettings) {
    super();
    this.getSettings = getSettings;
    this.waiting = [];
    this.showing = []; // { ...comment, shownAt, expiresAt }
    this.timers = new Map();
  }

  push(comment) {
    const { queueMax } = this.getSettings();
    this.waiting.push(comment);
    // Livestream đông: bỏ bình luận cũ nhất để overlay không bị trễ quá xa
    while (this.waiting.length > queueMax) this.waiting.shift();
    this.#fill();
  }

  clear() {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.waiting = [];
    this.showing = [];
    this.emit('change', this.showing);
  }

  // Gọi khi đổi cài đặt (vd. giảm số lượng hiển thị)
  refresh() {
    const { maxVisible } = this.getSettings();
    while (this.showing.length > maxVisible) this.#remove(this.showing[0].id, false);
    this.#fill(true);
  }

  #fill(forceEmit = false) {
    const { maxVisible, durationSec } = this.getSettings();
    let changed = forceEmit;
    while (this.showing.length < maxVisible && this.waiting.length) {
      const c = this.waiting.shift();
      const now = Date.now();
      const item = { ...c, shownAt: now, expiresAt: now + durationSec * 1000 };
      this.showing.push(item);
      this.timers.set(item.id, setTimeout(() => this.#remove(item.id), durationSec * 1000));
      changed = true;
    }
    if (changed) this.emit('change', this.showing);
  }

  #remove(id, refill = true) {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this.showing = this.showing.filter((c) => c.id !== id);
    if (refill) this.#fill(true);
  }

  get waitingCount() {
    return this.waiting.length;
  }
}
