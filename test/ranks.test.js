import test from 'node:test';
import assert from 'node:assert/strict';
import { Ranks, rankOf, RANKS } from '../src/ranks.js';

test('rankOf trả đúng chức vụ theo mốc điểm', () => {
  assert.equal(rankOf(0).title, 'Học việc');
  assert.equal(rankOf(29).title, 'Học việc');
  assert.equal(rankOf(30).title, 'Công nhân');
  assert.equal(rankOf(4000).title, 'Giám đốc nhà máy');
  assert.equal(rankOf(4000).next, null);
  assert.equal(rankOf(120).next, 250);
  assert.equal(RANKS.length, 8);
});

test('award cộng điểm và báo thăng chức khi qua mốc', () => {
  const r = new Ranks(null);
  const a = r.award({ username: 'an', nickname: 'An' }, 20);
  assert.equal(a.promoted, false);
  assert.equal(a.title, 'Học việc');
  const b = r.award({ username: 'an', nickname: 'An' }, 15);
  assert.equal(b.promoted, true);
  assert.equal(b.title, 'Công nhân');
  assert.equal(b.points, 35);
});

test('top xếp theo điểm giảm dần', () => {
  const r = new Ranks(null);
  r.award({ username: 'a' }, 10);
  r.award({ username: 'b' }, 300);
  r.award({ username: 'c' }, 50);
  assert.deepEqual(r.top(2).map((u) => u.username), ['b', 'c']);
  assert.equal(r.top(1)[0].title, 'Tổ trưởng');
});
