import test from 'node:test';
import assert from 'node:assert/strict';
import { toComment, cleanUsername } from '../src/tiktok.js';

test('toComment đọc dữ liệu dạng tiktok-live-connector 2.5 (displayId, content, avatarThumb)', () => {
  const c = toComment({
    common: { msgId: '123', createTime: '1730000000000' },
    user: { nickname: 'Yến', displayId: 'yen.sao', avatarThumb: { urlList: ['https://p16.tiktokcdn.com/a.webp'] } },
    content: ' Giá bao nhiêu? ',
  });
  assert.deepEqual({ ...c, at: 0 }, {
    id: '123', username: 'yen.sao', nickname: 'Yến', avatar: 'https://p16.tiktokcdn.com/a.webp', text: 'Giá bao nhiêu?', at: 0, createdAt: 1730000000000,
  });
});

test('toComment vẫn đọc dạng cũ (uniqueId, comment, profilePicture)', () => {
  const c = toComment({ msgId: '9', user: { uniqueId: 'abc', profilePicture: { urls: ['https://x/y.jpg'] } }, comment: 'hi' });
  assert.equal(c.username, 'abc');
  assert.equal(c.text, 'hi');
  assert.equal(c.avatar, 'https://x/y.jpg');
});

test('cleanUsername nhận @ten và link', () => {
  assert.equal(cleanUsername('@yensaodothitoan'), 'yensaodothitoan');
  assert.equal(cleanUsername('https://www.tiktok.com/@yensaodothitoan/live'), 'yensaodothitoan');
});
