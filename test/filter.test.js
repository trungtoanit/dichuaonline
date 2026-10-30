import test from 'node:test';
import assert from 'node:assert/strict';
import { CommentFilter, normalize } from '../src/filter.js';
import { sanitize } from '../src/settings.js';

const settings = sanitize({ blockedWords: ['ngu', 'lừa đảo'], blockedUsers: ['@SpamBot'] });
const c = (text, username = 'user1') => ({ id: Math.random().toString(), username, nickname: username, text });

test('normalize bỏ dấu tiếng Việt', () => {
  assert.equal(normalize('  Đẹp   QUÁ  '), 'dep qua');
});

test('chặn từ khóa cấm, không phân biệt dấu, khớp nguyên từ', () => {
  const f = new CommentFilter();
  assert.match(f.check(c('Shop NGÚ thế'), settings), /Từ khóa cấm/);
  assert.match(f.check(c('shop này lua dao', 'u2'), settings), /Từ khóa cấm/);
  assert.equal(f.check(c('chào bạn Nguyên', 'u3'), settings), null);
});

test('chặn người dùng, link, spam ký tự, quá dài', () => {
  const f = new CommentFilter();
  assert.equal(f.check(c('hi', 'spambot'), settings), 'Người dùng bị chặn');
  assert.equal(f.check(c('vào www.abc.xyz'), settings), 'Chứa link');
  assert.equal(f.check(c('hahahaaaaaaaaaaa', 'u4'), settings), 'Spam ký tự');
  assert.equal(f.check(c('x'.repeat(151), 'u5'), settings), 'Quá dài');
});

test('chống trùng lặp và gửi quá nhanh theo thời gian', () => {
  let now = 0;
  const f = new CommentFilter(() => now);
  assert.equal(f.check(c('Giá bao nhiêu?', 'a'), settings), null);
  assert.equal(f.check(c('giá bao nhiêu?', 'b'), settings), 'Trùng lặp');
  now = 1000; // trong 2 giây
  assert.equal(f.check(c('câu khác', 'a'), settings), 'Gửi quá nhanh');
  now = 31_000;
  assert.equal(f.check(c('Giá bao nhiêu?', 'c'), settings), null);
});

test('sanitize giới hạn 1–5 bình luận và 3–15 giây', () => {
  const s = sanitize({ maxVisible: 9, durationSec: 1, position: 'x' });
  assert.equal(s.maxVisible, 5);
  assert.equal(s.durationSec, 3);
  assert.equal(s.position, 'bottom-left');
});
