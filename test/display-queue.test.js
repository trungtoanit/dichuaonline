import test from 'node:test';
import assert from 'node:assert/strict';
import { DisplayQueue } from '../src/display-queue.js';

const item = (id) => ({ id: String(id), username: 'u', text: `t${id}` });

test('hiển thị tối đa maxVisible, phần còn lại xếp hàng và tự đẩy lên khi hết giờ', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const q = new DisplayQueue(() => ({ maxVisible: 2, durationSec: 5, queueMax: 50 }));
  [1, 2, 3, 4].forEach((i) => q.push(item(i)));
  assert.deepEqual(q.showing.map((c) => c.id), ['1', '2']);
  assert.equal(q.waitingCount, 2);

  t.mock.timers.tick(5000);
  assert.deepEqual(q.showing.map((c) => c.id), ['3', '4']);
  assert.equal(q.waitingCount, 0);

  t.mock.timers.tick(5000);
  assert.equal(q.showing.length, 0);
});

test('hàng chờ quá queueMax thì bỏ bình luận cũ nhất', () => {
  const q = new DisplayQueue(() => ({ maxVisible: 1, durationSec: 5, queueMax: 5 }));
  for (let i = 1; i <= 10; i++) q.push(item(i));
  assert.equal(q.waitingCount, 5);
  assert.equal(q.waiting[0].id, '6');
  q.clear();
});
