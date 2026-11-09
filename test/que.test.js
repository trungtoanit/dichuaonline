import test from 'node:test';
import assert from 'node:assert/strict';
import { detectProvince, PROVINCES } from '../public/provinces.js';
import { PROVINCE_SHAPES } from '../public/vn-map.js';
import { QueGame } from '../src/que.js';

test('detectProvince nhận tên tỉnh có dấu, không dấu, viết liền, tên thành phố quen gọi', () => {
  assert.equal(detectProvince('Quê Nghệ An nè cả nhà'), 'VN-22');
  assert.equal(detectProvince('nghe an'), 'VN-22');
  assert.equal(detectProvince('NGHEAN đâu'), 'VN-22');
  assert.equal(detectProvince('Sài Gòn có mặt'), 'VN-SG');
  assert.equal(detectProvince('tphcm'), 'VN-SG');
  assert.equal(detectProvince('Đà Lạt mộng mơ'), 'VN-35');
  assert.equal(detectProvince('Bà Rịa Vũng Tàu'), 'VN-43');
  assert.equal(detectProvince('Đắk Lắk'), 'VN-33');
  assert.equal(detectProvince('Hà Nam'), 'VN-63');
  assert.equal(detectProvince('Hà Nội'), 'VN-HN');
});

test('detectProvince: không có tỉnh thì null, nhiều tỉnh thì ưu tiên tỉnh sau chữ "quê"', () => {
  assert.equal(detectProvince('Chào cả nhà'), null);
  assert.equal(detectProvince('anh ơi nam định'), 'VN-67');
  assert.equal(detectProvince('ở Hà Nội nhưng quê mình Thanh Hóa'), 'VN-21');
  assert.equal(detectProvince('Cần Thơ với Cà Mau'), 'VN-CT');
  // "quang nam" không được khớp nhầm khi gõ "quảng ngãi"
  assert.equal(detectProvince('Quảng Ngãi ơi'), 'VN-29');
});

test('63 tỉnh đều có hình trên bản đồ', () => {
  assert.equal(PROVINCES.length, 63);
  const shapes = new Set(PROVINCE_SHAPES.map((s) => s.id));
  for (const p of PROVINCES) assert.ok(shapes.has(p.id), `thiếu hình ${p.name}`);
});

test('QueGame: thả tim chỉ cộng điểm khi đã bình luận nhận quê', () => {
  const g = new QueGame(null);
  const an = { username: 'an', nickname: 'An' };
  assert.equal(g.like(an, 5), null);
  assert.deepEqual(g.claim(an, 'quê Nghệ An'), { id: 'VN-22', changed: true, isNew: true });
  assert.deepEqual(g.claim(an, 'Nghệ An mãi đỉnh'), { id: 'VN-22', changed: false, isNew: false });
  const hit = g.like(an, 3);
  assert.equal(hit.id, 'VN-22');
  assert.equal(hit.add, 3);
  assert.equal(hit.total, 3);
  assert.equal(hit.fan.username, 'an');
  g.claim(an, 'giờ về Hà Tĩnh');
  assert.equal(g.like(an, 1).id, 'VN-23');
  assert.deepEqual(g.snapshot().provinces['VN-22'], { score: 3, people: 0, fan: { username: 'an', nickname: 'An', points: 3 } });
  g.resetScores();
  assert.deepEqual(g.snapshot().provinces['VN-23'], { score: 0, people: 1, fan: null });
});

test('QueGame báo các mốc điểm vừa vượt qua', () => {
  const g = new QueGame(null);
  const b = { username: 'b', nickname: 'B' };
  g.claim(b, 'Huế');
  assert.deepEqual(g.like(b, 49).milestones, []);
  assert.deepEqual(g.like(b, 1).milestones, [50]);
  assert.deepEqual(g.like(b, 500).milestones, [100, 500]);
  assert.deepEqual(g.like(b, 5).milestones, []);
});
